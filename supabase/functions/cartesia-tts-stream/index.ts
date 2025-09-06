import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function sanitize(text: string) {
  // Strip basic markdown/HTML/SSML to keep TTS stable
  return text
    .replace(/```[\s\S]*?```/g, '') // code blocks
    .replace(/[*_`~>#\[\]()!-]/g, ' ') // md symbols
    .replace(/<[^>]+>/g, ' ') // tags
    .replace(/\s+/g, ' ') // collapse whitespace
    .replace(/namaste/gi, '') // Remove "namaste" for Coach C English-only
    // Add pronunciation hints for Indian English context
    .replace(/\blassi\b/gi, 'luss-ee')
    .replace(/\broti\b/gi, 'row-tee')
    .replace(/\bkatori\b/gi, 'kuh-tor-ee')
    .replace(/\braita\b/gi, 'rai-ta')
    .replace(/\bsabzi\b/gi, 'sub-zee')
    .replace(/\bdal\b/gi, 'dahl')
    .replace(/\bpapad\b/gi, 'pah-pad')
    .replace(/\bchapati\b/gi, 'chuh-pah-tee')
    .trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const start = Date.now();

  try {
    const url = new URL(req.url);
    let text: string | undefined;
    let voiceId: string | undefined;

    if (req.method === 'GET') {
      text = url.searchParams.get('text') || undefined;
      voiceId = url.searchParams.get('voice_id') || undefined;
    } else {
      // Default to POST JSON
      try {
        const body = await req.json();
        text = body?.text;
        voiceId = body?.voice_id;
      } catch (_) {
        text = undefined;
      }
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return new Response(
        JSON.stringify({ error: 'Text is required', request_id: requestId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use the user's voice clone ID or default
    const selectedVoiceId = (voiceId && typeof voiceId === 'string') ? voiceId : 'bc6b3ad8-7a84-47e2-b655-4a087d2f8c4d';
    const cleanText = sanitize(text);

    // Split long text into manageable chunks (~800 chars) by sentence to avoid upstream limits
    const sentences = cleanText.match(/[^.!?]+[.!?]*/g) || [cleanText];
    const chunks: string[] = [];
    let buf = '';
    for (const s of sentences) {
      if ((buf + s).length > 800 && buf) {
        chunks.push(buf.trim());
        buf = s;
      } else {
        buf += s;
      }
    }
    if (buf.trim()) chunks.push(buf.trim());

    console.log(`[Cartesia TTS] Processing ${chunks.length} chunks for voice ${selectedVoiceId}`);

    // Stream bytes from each chunk sequentially to the client
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for (const part of chunks) {
            const requestBody = {
              model_id: "sonic-2",
              transcript: part,
              voice: {
                mode: "id",
                id: selectedVoiceId
              },
              output_format: {
                container: "mp3",
                encoding: "mp3",
                sample_rate: 44100
              },
              language: "en-IN", // Indian English for better pronunciation
              speed: "normal"
            };

            console.log(`[Cartesia TTS] Requesting chunk: "${part.substring(0, 50)}..."`);

            const upstream = await fetch('https://api.cartesia.ai/tts/bytes', {
              method: 'POST',
              headers: {
                'Cartesia-Version': '2024-06-10',
                'X-API-Key': Deno.env.get('CARTESIA_API_KEY'),
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
            });

            if (!upstream.ok) {
              const errText = await upstream.text().catch(() => '');
              console.error(`[Cartesia TTS] Error (${upstream.status}): ${errText}`);
              throw new Error(`Cartesia TTS error (${upstream.status}): ${errText}`);
            }

            console.log(`[Cartesia TTS] Successfully received audio for chunk`);

            const reader = upstream.body?.getReader();
            if (!reader) continue;
            
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              if (value) controller.enqueue(value);
            }
          }
          controller.close();
          console.log(`[Cartesia TTS] Stream completed in ${Date.now() - start}ms`);
        } catch (e) {
          console.error('[Cartesia TTS] Stream error:', e);
          try { controller.error(e); } catch {}
        }
      }
    });

    const headers = new Headers(corsHeaders);
    headers.set('Content-Type', 'audio/mpeg');
    headers.set('X-Voice-ID', selectedVoiceId);
    headers.set('X-Request-Id', requestId);
    headers.set('X-Provider', 'Cartesia');

    return new Response(stream, { headers });
  } catch (error: any) {
    console.error('[Cartesia TTS] Function error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Unknown error',
        request_id: requestId,
        provider: 'Cartesia',
        error_class: error.message?.includes('API key') || error.message?.includes('auth') ? 'Auth' :
                     error.message?.includes('429') ? 'RateLimit' :
                     error.message?.includes('network') || error.message?.includes('fetch') ? 'Network' :
                     error.message?.includes('required') || error.message?.includes('validation') ? 'DataContract' :
                     'Logic'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
