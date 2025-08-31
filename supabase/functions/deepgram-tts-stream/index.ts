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
    const { text, voice } = await req.json();

    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new Error('Text is required');
    }

    const voiceModel = (voice && typeof voice === 'string') ? voice : 'aura-2-hermes-en';
    const cleanText = sanitize(text);

    const query = new URLSearchParams({
      model: voiceModel,
      encoding: 'mp3',
      bit_rate: '32000',
    }).toString();

    const upstream = await fetch(`https://api.deepgram.com/v1/speak?${query}` ,{
      method: 'POST',
      headers: {
        'Authorization': `Token ${Deno.env.get('DEEPGRAM_API_KEY')}`,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({ text: cleanText }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return new Response(
        JSON.stringify({
          error: `Deepgram TTS error (${upstream.status})`,
          details: errText,
          request_id: requestId,
          latency_ms: Date.now() - start,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Stream bytes directly to the client for fastest start
    const headers = new Headers(corsHeaders);
    headers.set('Content-Type', 'audio/mpeg');
    headers.set('X-Voice-Model', voiceModel);
    headers.set('X-Request-Id', requestId);

    return new Response(upstream.body, { headers });
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
