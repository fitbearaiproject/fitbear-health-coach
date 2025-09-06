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
    .trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const start = Date.now();

  try {
    // Verify API key exists
    const apiKey = Deno.env.get('DEEPGRAM_API_KEY');
    if (!apiKey) {
      throw new Error('DEEPGRAM_API_KEY environment variable is not set');
    }

    const url = new URL(req.url);
    let text: string | undefined;
    let voice: string | undefined;

    if (req.method === 'GET') {
      text = url.searchParams.get('text') || undefined;
      voice = url.searchParams.get('voice') || undefined;
    } else {
      // Default to POST JSON
      try {
        const body = await req.json();
        text = body?.text;
        voice = body?.voice;
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

    const voiceModel = (voice && typeof voice === 'string') ? voice : 'aura-2-hermes-en';
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

    // Stream bytes from each chunk sequentially to the client
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for (const part of chunks) {
            const query = new URLSearchParams({
              model: voiceModel,
              encoding: 'mp3',
            }).toString();

            console.log(`[Deepgram TTS] Requesting chunk: "${part.substring(0, 50)}..."`);

            const upstream = await fetch(`https://api.deepgram.com/v1/speak?${query}`, {
              method: 'POST',
              headers: {
                'Authorization': `Token ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'audio/mpeg',
              },
              body: JSON.stringify({ text: part }),
            });

            if (!upstream.ok) {
              const errText = await upstream.text().catch(() => '');
              console.error(`[Deepgram TTS] Error (${upstream.status}): ${errText}`);
              throw new Error(`Deepgram TTS error (${upstream.status}): ${errText}`);
            }

            console.log(`[Deepgram TTS] Successfully received audio for chunk`);

            const reader = upstream.body?.getReader();
            if (!reader) {
              console.warn(`[Deepgram TTS] No reader available for chunk`);
              continue;
            }
            
            try {
              while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                if (value && value.length > 0) {
                  controller.enqueue(value);
                }
              }
            } catch (e) {
              console.error(`[Deepgram TTS] Reader error for chunk:`, e);
              throw e;
            } finally {
              try {
                reader.releaseLock();
              } catch {}
            }
          }
          
          console.log(`[Deepgram TTS] All chunks processed, closing stream`);
          controller.close();
          console.log(`[Deepgram TTS] Stream completed in ${Date.now() - start}ms`);
        } catch (e) {
          console.error('[Deepgram TTS] Stream error:', e);
          try { 
            controller.error(e); 
          } catch (closeError) {
            console.error('[Deepgram TTS] Error closing controller:', closeError);
          }
        }
      }
    });

    const headers = new Headers(corsHeaders);
    headers.set('Content-Type', 'audio/mpeg');
    headers.set('X-Voice-Model', voiceModel);
    headers.set('X-Request-Id', requestId);

    return new Response(stream, { headers });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: error.message || 'Unknown error',
        request_id: requestId,
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
