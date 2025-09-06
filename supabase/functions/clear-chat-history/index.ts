import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  
  try {
    const { userId } = await req.json();
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required', request_id: requestId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Delete all chat logs for the user
    const { error } = await supabase
      .from('chat_logs')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('[Clear Chat] Database error:', error);
      throw error;
    }

    console.log(`[Clear Chat] Successfully cleared chat history for user ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Chat history cleared successfully',
        request_id: requestId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Clear Chat] Function error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Unknown error',
        request_id: requestId,
        error_class: error.message?.includes('required') ? 'DataContract' : 'Logic'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});