import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Mic, MicOff, Volume2, VolumeX, Square, ChevronDown, Activity, User } from "lucide-react";


interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface DiagnosticData {
  request_id?: string;
  endpoint?: string;
  status?: number;
  latency_ms?: number;
  tokens_in?: number;
  tokens_out?: number;
  retry_count?: number;
  error_class?: string;
  error_cause?: string;
  stt_language?: string;
  stt_confidence?: number;
  tts_voice?: string;
  tts_status?: string;
  tts_latency_ms?: number;
  tts_bytes?: number;
  model?: string;
}

interface CoachChatProps {
  userId?: string;
}

export function CoachChat({ userId }: CoachChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [userEmail, setUserEmail] = useState<string>('');
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [lastDiagnostics, setLastDiagnostics] = useState<DiagnosticData>({});
  
  const { toast } = useToast();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const ttsBytesRef = useRef<number>(0);
  const ttsObjectUrlRef = useRef<string | null>(null);

  // Check auth status
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setAuthStatus('authenticated');
        setUserEmail(session.user.email || '');
      } else {
        setAuthStatus('unauthenticated');
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setAuthStatus('authenticated');
        setUserEmail(session.user.email || '');
      } else {
        setAuthStatus('unauthenticated');
        setUserEmail('');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // Add welcome message on component mount
  useEffect(() => {
    const welcomeMessage: Message = {
      id: 'welcome',
      role: 'assistant',
      content: "Hello! I'm Coach C, your AI fitness and nutrition coach based on The Fit Bear philosophy. I'm here to help you achieve your health goals with sustainable, enjoyable approaches to fitness and nutrition. How can I help you today?",
      timestamp: new Date()
    };
    setMessages([welcomeMessage]);
  }, []);

  const handleSendMessage = async (messageText: string) => {
    if (!messageText.trim()) return;
    
    if (authStatus !== 'authenticated') {
      toast({
        title: "Authentication Required",
        description: "Please sign in to chat with Coach C",
        variant: "destructive",
      });
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    let retryCount = 0;
    const maxRetries = 1;
    
    while (retryCount <= maxRetries) {
      try {
        const { data, error } = await supabase.functions.invoke('coach-chat', {
          body: {
            message: messageText,
            userId: userId
          }
        });

        if (error) {
          if (error.message.includes('429') && retryCount < maxRetries) {
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
            continue;
          }
          throw error;
        }

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.text || data.reply,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, assistantMessage]);

        // Update diagnostics
        setLastDiagnostics({
          request_id: data.message_id,
          endpoint: '/coach-chat',
          status: 200,
          latency_ms: data.latency_ms,
          tokens_in: data.tokens_in,
          tokens_out: data.tokens_out,
          retry_count: retryCount,
          model: data.model
        });

        // Auto-speak if enabled
        if (autoSpeak) {
          await playAudio(data.text || data.reply);
        }

        break;

      } catch (error: any) {
        console.error('Error sending message:', error);
        
        if (retryCount < maxRetries) {
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
          continue;
        }

        // Update diagnostics with error
        setLastDiagnostics({
          endpoint: '/coach-chat',
          status: 500,
          retry_count: retryCount,
          error_class: error.message?.includes('API key') ? 'Auth' :
                      error.message?.includes('429') ? 'RateLimit' :
                      error.message?.includes('network') || error.message?.includes('fetch') ? 'Network' :
                      error.message?.includes('required') ? 'DataContract' : 'Logic',
          error_cause: error.message?.split('\n')[0] || 'Unknown error'
        });

        toast({
          title: "Error",
          description: "Failed to send message. Please try again.",
          variant: "destructive",
        });
        break;
      }
    }

    setIsLoading(false);
  };

  const playAudio = async (text: string) => {
    // Helper: strip markdown/HTML/SSML from text
    const sanitizeForTTS = (t: string) =>
      t
        .replace(/```[\s\S]*?```/g, '')
        .replace(/[*_`~>#\[\]()!-]/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const SUPABASE_URL = "https://xnncvfuamecmjvvoaywz.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhubmN2ZnVhbWVjbWp2dm9heXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0NDkwMzUsImV4cCI6MjA3MjAyNTAzNX0.mJttLdAFIT0nFDGF3cj1mBYhqy5o7xUMUSfePILllGM";

    const start = performance.now();
    const clean = sanitizeForTTS(text);

    // Stop current audio/stream if any
    if (ttsAbortRef.current) {
      ttsAbortRef.current.abort();
      ttsAbortRef.current = null;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    // Try low-latency streaming first via direct fetch
    try {
      setIsPlaying(true);
      ttsBytesRef.current = 0;

      const ctrl = new AbortController();
      ttsAbortRef.current = ctrl;

      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(`${SUPABASE_URL}/functions/v1/deepgram-tts-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ text: clean, voice: 'aura-2-hermes-en' }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body || !res.headers.get('Content-Type')?.includes('audio/mpeg')) {
        throw new Error(`Streaming TTS unavailable (${res.status})`);
      }

      // Stream into MediaSource for instant playback
      const mediaSource = new MediaSource();
      const audioEl = new Audio();
      currentAudioRef.current = audioEl;

      const objectUrl = URL.createObjectURL(mediaSource);
      ttsObjectUrlRef.current = objectUrl;
      audioEl.src = objectUrl;

      let sourceBuffer: SourceBuffer | null = null;
      let firstAppend = true;
      const queue: Uint8Array[] = [];

      mediaSource.addEventListener('sourceopen', async () => {
        try {
          sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
        } catch (e) {
          // Fallback if SourceBuffer not supported
          throw e;
        }

        const reader = res.body!.getReader();
        const pump = async () => {
          const { done, value } = await reader.read();
          if (done) {
            if (!mediaSource.readyState.includes('ended')) {
              mediaSource.endOfStream();
            }
            return;
          }

          if (value) {
            ttsBytesRef.current += value.byteLength;
            const chunk = new Uint8Array(value);
            if (sourceBuffer!.updating || queue.length) {
              queue.push(chunk);
            } else {
              sourceBuffer!.appendBuffer(chunk);
            }

            if (firstAppend) {
              firstAppend = false;
              const latency = Math.round(performance.now() - start);
              setLastDiagnostics(prev => ({ ...prev, tts_status: 'streaming', tts_latency_ms: latency, tts_voice: res.headers.get('X-Voice-Model') || 'aura-2-hermes-en' } as any));
              // Start playback ASAP
              audioEl.play().catch(() => {/* ignore */});
            }
          }

          return pump();
        };

        sourceBuffer!.addEventListener('updateend', () => {
          if (queue.length && sourceBuffer && !sourceBuffer.updating) {
            sourceBuffer.appendBuffer(queue.shift()!);
          }
        });

        pump().catch(err => {
          console.error('Streaming pump error:', err);
        });
      });

      audioEl.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(objectUrl);
        setLastDiagnostics(prev => ({ ...prev, tts_bytes: ttsBytesRef.current } as any));
      };

      audioEl.onerror = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(objectUrl);
        setLastDiagnostics(prev => ({ ...prev, tts_status: 'error' } as any));
        toast({ title: 'Audio Error', description: 'Playback error', variant: 'destructive' });
      };

      return; // success
    } catch (err) {
      console.warn('Streaming TTS failed, falling back to REST:', err);
      // Continue to REST fallback below
    }

    // REST fallback (base64)
    try {
      setIsPlaying(true);
      const t0 = performance.now();
      const { data, error } = await supabase.functions.invoke('deepgram-tts', {
        body: { text: clean, voice: 'aura-2-hermes-en' }
      });
      if (error) throw error;

      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }

      const audio = new Audio(`data:audio/mpeg;base64,${data.audioContent}`);
      currentAudioRef.current = audio;

      audio.onplay = () => {
        const latency = Math.round(performance.now() - t0);
        setLastDiagnostics(prev => ({ ...prev, tts_status: 'rest', tts_latency_ms: latency, tts_voice: data.voice_used, tts_bytes: data.audioContent?.length || 0 } as any));
      };

      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => {
        setIsPlaying(false);
        toast({ title: 'Audio Error', description: 'Failed to play audio response', variant: 'destructive' });
      };

      await audio.play();
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsPlaying(false);
      setLastDiagnostics(prev => ({ ...prev, tts_status: 'error', error_class: 'Network' } as any));
      toast({ title: 'Audio Error', description: 'Failed to generate audio response', variant: 'destructive' });
    }
  };

  const stopAudio = () => {
    if (ttsAbortRef.current) {
      try { ttsAbortRef.current.abort(); } catch {}
      ttsAbortRef.current = null;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (ttsObjectUrlRef.current) {
      try { URL.revokeObjectURL(ttsObjectUrlRef.current); } catch {}
      ttsObjectUrlRef.current = null;
    }
    setIsPlaying(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);

    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Recording Error",
        description: "Failed to access microphone",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    try {
      setIsLoading(true);

      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        
        try {
          const { data, error } = await supabase.functions.invoke('deepgram-stt', {
            body: { audio: base64Audio }
          });

          if (error) throw error;

          // Update STT diagnostics
          setLastDiagnostics(prev => ({
            ...prev,
            stt_language: data.detected_language,
            stt_confidence: data.confidence
          }));

          if (data.transcript && data.transcript.trim()) {
            setInputValue(data.transcript);
            // Optionally auto-send after STT
            // await handleSendMessage(data.transcript);
          } else {
            toast({
              title: "No Speech Detected",
              description: "Please try speaking more clearly",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error('Error processing audio:', error);
          toast({
            title: "Transcription Error",
            description: "Failed to transcribe audio",
            variant: "destructive",
          });
        } finally {
          setIsLoading(false);
        }
      };

    } catch (error) {
      console.error('Error processing audio:', error);
      setIsLoading(false);
    }
  };

  if (authStatus === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Loading...</h2>
        </div>
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
          <p className="text-muted-foreground mb-4">Please sign in to chat with Coach C</p>
          <Button onClick={() => window.location.href = '/auth'}>
            Go to Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-6 max-w-4xl mx-auto">
      {/* Auth Status Chip */}
      <div className="mb-4 flex items-center gap-2">
        <Badge variant="outline" className="gap-2">
          <User className="w-3 h-3" />
          Signed in as {userEmail}
        </Badge>
        
        {/* Diagnostics Toggle */}
        <Collapsible open={showDiagnostics} onOpenChange={setShowDiagnostics}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Activity className="w-3 h-3" />
              Diagnostics
              <ChevronDown className="w-3 h-3" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 p-3 bg-muted rounded-lg text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>Request ID: {lastDiagnostics.request_id || 'N/A'}</div>
              <div>Endpoint: {lastDiagnostics.endpoint || 'N/A'}</div>
              <div>Status: {lastDiagnostics.status || 'N/A'}</div>
              <div>Latency: {lastDiagnostics.latency_ms || 'N/A'}ms</div>
              <div>Tokens In: {lastDiagnostics.tokens_in || 'N/A'}</div>
              <div>Tokens Out: {lastDiagnostics.tokens_out || 'N/A'}</div>
              <div>Model: {lastDiagnostics.model || 'N/A'}</div>
              <div>Retries: {lastDiagnostics.retry_count || 0}</div>
              {lastDiagnostics.stt_language && (
                <div>STT Language: {lastDiagnostics.stt_language}</div>
              )}
              {typeof lastDiagnostics.stt_confidence !== 'undefined' && (
                <div>STT Confidence: {(lastDiagnostics.stt_confidence * 100).toFixed(1)}%</div>
              )}
              {lastDiagnostics.tts_voice && (
                <div>TTS Voice: {lastDiagnostics.tts_voice}</div>
              )}
              {lastDiagnostics.tts_status && (
                <div>TTS Status: {lastDiagnostics.tts_status}</div>
              )}
              {typeof lastDiagnostics.tts_latency_ms !== 'undefined' && (
                <div>TTS Start: {lastDiagnostics.tts_latency_ms}ms</div>
              )}
              {typeof lastDiagnostics.tts_bytes !== 'undefined' && (
                <div>TTS Bytes: {lastDiagnostics.tts_bytes}</div>
              )}
              {lastDiagnostics.error_class && (
                <div className="col-span-2 text-red-600">
                  Error: {lastDiagnostics.error_class} - {lastDiagnostics.error_cause}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <Avatar className="w-20 h-20">
          <AvatarImage src="/images/coach-cc.png" alt="Coach C avatar" />
          <AvatarFallback className="bg-gradient-primary text-primary-foreground font-bold text-lg">
            C
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-3xl font-bold gradient-text">Coach C</h1>
          <p className="text-muted-foreground">Your AI Fitness & Nutrition Coach</p>
        </div>
      </div>

      <div className="flex-1 border rounded-lg bg-card">
        <ScrollArea className="h-[500px] p-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <Avatar className="w-8 h-8">
                     <AvatarImage src="/images/coach-cc.png" alt="Coach C" />
                    <AvatarFallback className="bg-gradient-primary text-primary-foreground text-sm">
                      C
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground ml-auto'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <Avatar className="w-8 h-8">
                  <AvatarImage src="/images/coach-cc.png" alt="Coach C" />
                  <AvatarFallback className="bg-gradient-primary text-primary-foreground text-sm">
                    C
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted p-3 rounded-lg">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-4">
          {/* Controls */}
          <div className="flex items-center gap-2 mb-3">
            <Button
              variant={autoSpeak ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoSpeak(!autoSpeak)}
              className="gap-2"
            >
              {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              Auto-speak {autoSpeak ? 'ON' : 'OFF'}
            </Button>
            
            {isPlaying && (
              <Button
                variant="outline"
                size="sm"
                onClick={stopAudio}
                className="gap-2"
              >
                <Square className="w-4 h-4" />
                Stop Audio
              </Button>
            )}
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your message or use the mic..."
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(inputValue)}
              disabled={isLoading || isRecording}
              className="flex-1"
            />
            
            <Button
              variant={isRecording ? "destructive" : "outline"}
              size="icon"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            
            <Button
              onClick={() => handleSendMessage(inputValue)}
              disabled={!inputValue.trim() || isLoading || isRecording}
            >
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}