import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const { audio } = await req.json();
    
    if (!audio) {
      throw new Error('Audio data is required');
    }

    // Convert base64 to binary
    const binaryAudio = Uint8Array.from(atob(audio), c => c.charCodeAt(0));

    // Call Deepgram STT API with nova-2 model and multi-language support
    const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&language=multi&smart_format=true', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${Deno.env.get('DEEPGRAM_API_KEY')}`,
        'Content-Type': 'audio/webm',
      },
      body: binaryAudio,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Deepgram STT error: ${errorText}`);
    }

    const result = await response.json();
    
    if (!result.results?.channels?.[0]?.alternatives?.[0]?.transcript) {
      throw new Error('No transcript found in response');
    }

    const transcript = result.results.channels[0].alternatives[0].transcript;
    const confidence = result.results.channels[0].alternatives[0].confidence || 0;
    const detectedLanguage = result.results.channels[0].detected_language || 'unknown';
    const latencyMs = Date.now() - startTime;

    return new Response(
      JSON.stringify({ 
        transcript,
        confidence,
        detected_language: detectedLanguage,
        latency_ms: latencyMs,
        request_id: requestId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in deepgram-stt function:', error);
    const latencyMs = Date.now() - startTime;
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        request_id: requestId,
        latency_ms: latencyMs,
        error_class: error.message.includes('API key') || error.message.includes('auth') ? 'Auth' :
                     error.message.includes('429') ? 'RateLimit' :
                     error.message.includes('network') || error.message.includes('fetch') ? 'Network' :
                     error.message.includes('required') || error.message.includes('validation') ? 'DataContract' :
                     'Logic'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});