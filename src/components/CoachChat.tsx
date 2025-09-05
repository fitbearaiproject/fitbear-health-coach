import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Send, Mic, MicOff, Volume2, VolumeX, MessageCircle, Loader2 } from "lucide-react";

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

interface CoachChatProps {
  userId: string;
}

export const CoachChat = ({ userId }: CoachChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const { toast } = useToast();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const ttsBytesRef = useRef(0);
  const ttsObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadChatHistory();
    setupSpeechRecognition();
    
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      if (ttsAbortRef.current) {
        ttsAbortRef.current.abort();
      }
      if (ttsObjectUrlRef.current) {
        URL.revokeObjectURL(ttsObjectUrlRef.current);
      }
    };
  }, [userId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadChatHistory = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('chat_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) throw error;

      const formattedMessages: Message[] = data.map(log => ({
        id: log.id,
        content: log.content,
        role: log.role as 'user' | 'assistant',
        timestamp: new Date(log.created_at)
      }));

      setMessages(formattedMessages);
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const setupSpeechRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
        toast({
          title: "Voice recognition error",
          description: "Please try again or type your message",
          variant: "destructive",
        });
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast({
        title: "Voice recognition not supported",
        description: "Please type your message instead",
        variant: "destructive",
      });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input.trim(),
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('coach-chat', {
        body: {
          message: userMessage.content,
          userId: userId
        }
      });

      if (error) throw error;

      const botText: string = data?.text || data?.reply || data?.originalReply || '';

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: botText,
        role: 'assistant',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (autoSpeak && botText) {
        await playAudio(botText);
      }

      toast({
        title: "Message sent",
        description: "Coach C has responded to your message",
      });

    } catch (error: any) {
      console.error('Error sending message:', error);
      
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          
          const { data, error: retryError } = await supabase.functions.invoke('coach-chat', {
            body: {
              message: userMessage.content,
              userId: userId
            }
          });

          if (retryError) throw retryError;

          const botText: string = data?.text || data?.reply || data?.originalReply || '';

          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            content: botText,
            role: 'assistant', 
            timestamp: new Date()
          };

          setMessages(prev => [...prev, assistantMessage]);

          if (autoSpeak && botText) {
            await playAudio(botText);
          }
          
          break;
        } catch (retryError) {
          if (attempt === 2) {
            setMessages(prev => [...prev, {
              id: (Date.now() + 1).toString(),
              content: "I'm having trouble connecting right now. Please try again in a moment.",
              role: 'assistant',
              timestamp: new Date()
            }]);
          }
        }
      }

      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    }

    setIsLoading(false);
  };

  const playAudio = async (text: string) => {
    const sanitizeForTTS = (t: string) =>
      t
        .replace(/```[\s\S]*?```/g, '')
        .replace(/[*_`~>#\[\]()!-]/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const SUPABASE_URL = "https://xnncvfuamecmjvvoaywz.supabase.co";

    // Stop any ongoing playback
    if (ttsAbortRef.current) {
      ttsAbortRef.current.abort();
      ttsAbortRef.current = null;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    const ctrl = new AbortController();
    ttsAbortRef.current = ctrl;

    const clean = sanitizeForTTS(text);
    
    // Use entire text block for continuous playback
    let cancelled = false;
    setIsPlaying(true);

    const playEntireText = async () => {
      if (cancelled) {
        setIsPlaying(false);
        currentAudioRef.current = null;
        return;
      }

      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/deepgram-tts-stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg'
          },
          body: JSON.stringify({
            text: clean,
            voice: 'aura-2-thalia-en'
          }),
          signal: ctrl.signal,
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          throw new Error(`TTS request failed: ${response.status} ${errText}`);
        }

        const contentType = response.headers.get('Content-Type') || '';
        // Prefer true streaming playback via MediaSource when possible
        if ('MediaSource' in window && contentType.includes('audio')) {
          const mediaSource = new MediaSource();
          const objectUrl = URL.createObjectURL(mediaSource);
          ttsObjectUrlRef.current = objectUrl;

          const audio = new Audio(objectUrl);
          audio.onended = () => {
            setIsPlaying(false);
            currentAudioRef.current = null;
            if (ttsObjectUrlRef.current) {
              URL.revokeObjectURL(ttsObjectUrlRef.current);
              ttsObjectUrlRef.current = null;
            }
          };
          audio.onerror = () => {
            setIsPlaying(false);
            currentAudioRef.current = null;
            if (ttsObjectUrlRef.current) {
              URL.revokeObjectURL(ttsObjectUrlRef.current);
              ttsObjectUrlRef.current = null;
            }
            console.error('Audio playback failed');
          };

          currentAudioRef.current = audio;
          setIsPlaying(true);

          const reader = response.body?.getReader();
          if (!reader) throw new Error('No readable stream from TTS response');

          mediaSource.onsourceopen = async () => {
            try {
              const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
              let started = false;
              while (true) {
                if (ctrl.signal.aborted) {
                  try { await reader.cancel(); } catch {}
                  try { mediaSource.endOfStream(); } catch {}
                  break;
                }
                const { value, done } = await reader.read();
                if (done) {
                  if (!sourceBuffer.updating) {
                    try { mediaSource.endOfStream(); } catch {}
                  } else {
                    sourceBuffer.addEventListener('updateend', () => {
                      try { mediaSource.endOfStream(); } catch {}
                    }, { once: true });
                  }
                  break;
                }
                if (!value) continue;

                await new Promise<void>((resolve, reject) => {
                  const onError = () => {
                    sourceBuffer.removeEventListener('error', onError);
                    reject(new Error('SourceBuffer error'));
                  };
                  const onUpdateEnd = async () => {
                    sourceBuffer.removeEventListener('updateend', onUpdateEnd);
                    if (!started) {
                      started = true;
                      try { await audio.play(); } catch (e) { console.error('Autoplay error:', e); }
                    }
                    resolve();
                  };
                  sourceBuffer.addEventListener('error', onError, { once: true });
                  sourceBuffer.addEventListener('updateend', onUpdateEnd, { once: true });
                  try {
                    sourceBuffer.appendBuffer(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
                  } catch (e) {
                    sourceBuffer.removeEventListener('error', onError);
                    sourceBuffer.removeEventListener('updateend', onUpdateEnd);
                    reject(e as Error);
                  }
                });
              }
            } catch (e) {
              console.error('Streaming playback error, falling back to blob:', e);
              // Fallback to blob playback
              try {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                if (ttsObjectUrlRef.current) URL.revokeObjectURL(ttsObjectUrlRef.current);
                ttsObjectUrlRef.current = url;
                const fallbackAudio = currentAudioRef.current || new Audio(url);
                currentAudioRef.current = fallbackAudio;
                await fallbackAudio.play();
              } catch (e2) {
                throw e2;
              }
            }
          };
        } else {
          // Fallback: non-streaming blob playback or non-audio error
          if (!contentType.includes('audio')) {
            // Likely JSON error from edge function
            const err = await response.text();
            throw new Error(err);
          }
          const audioBlob = await response.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          ttsObjectUrlRef.current = audioUrl;
          const audio = new Audio(audioUrl);
          audio.onended = () => {
            setIsPlaying(false);
            currentAudioRef.current = null;
            if (ttsObjectUrlRef.current) {
              URL.revokeObjectURL(ttsObjectUrlRef.current);
              ttsObjectUrlRef.current = null;
            }
          };
          audio.onerror = () => {
            setIsPlaying(false);
            currentAudioRef.current = null;
            if (ttsObjectUrlRef.current) {
              URL.revokeObjectURL(ttsObjectUrlRef.current);
              ttsObjectUrlRef.current = null;
            }
            console.error('Audio playback failed');
          };
          currentAudioRef.current = audio;
          setIsPlaying(true);
          await audio.play();
        }
      } catch (error) {
        setIsPlaying(false);
        currentAudioRef.current = null;
        console.error('TTS playback failed:', error);
      }
    };

    // Begin playback
    playEntireText();

    // Handle cancel/abort
    ctrl.signal.addEventListener('abort', () => {
      cancelled = true;
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      setIsPlaying(false);
    });
  };

  const stopAudio = () => {
    if (ttsAbortRef.current) {
      ttsAbortRef.current.abort();
      ttsAbortRef.current = null;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setIsPlaying(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-background">
      {/* Header */}
      <Card className="rounded-none border-b border-l-0 border-r-0 border-t-0">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12 md:h-16 md:w-16">
              <AvatarImage 
                src="/lovable-uploads/00de3c1c-78fb-4830-8c11-79cdf5a2069d.png" 
                alt="Coach C" 
                className="object-cover"
              />
              <AvatarFallback>CC</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <CardTitle className="text-lg md:text-xl">Coach C</CardTitle>
              <CardDescription className="text-sm md:text-base">
                Your Personal Health Coach
              </CardDescription>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="secondary" className="text-xs">Nutrition Expert</Badge>
                <Badge variant="secondary" className="text-xs">Wellness Guide</Badge>
                {isPlaying && <Badge variant="outline" className="text-xs">🔊 Speaking</Badge>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={autoSpeak ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoSpeak(!autoSpeak)}
                className="hidden md:flex"
              >
                {autoSpeak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
              {isPlaying && (
                <Button variant="outline" size="sm" onClick={stopAudio}>
                  Stop
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-4xl mx-auto">
          {messages.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  <MessageCircle className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">Start a conversation with Coach C</h3>
                  <p className="text-sm">
                    Ask about nutrition, meal planning, health goals, or anything wellness-related.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <Avatar className="h-8 w-8 md:h-10 md:w-10 flex-shrink-0">
                  <AvatarImage 
                    src="/lovable-uploads/00de3c1c-78fb-4830-8c11-79cdf5a2069d.png" 
                    alt="Coach C" 
                    className="object-cover"
                  />
                  <AvatarFallback>CC</AvatarFallback>
                </Avatar>
              )}
              <div
                className={`max-w-[85%] md:max-w-[70%] rounded-lg p-3 md:p-4 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground ml-auto'
                    : 'bg-muted'
                }`}
              >
                <p className="text-sm md:text-base whitespace-pre-wrap leading-relaxed">
                  {message.content}
                </p>
                <p className="text-xs opacity-70 mt-2">
                  {message.timestamp.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </p>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <Avatar className="h-8 w-8 md:h-10 md:w-10 flex-shrink-0">
                <AvatarImage 
                  src="/lovable-uploads/00de3c1c-78fb-4830-8c11-79cdf5a2069d.png" 
                  alt="Coach C" 
                  className="object-cover"
                />
                <AvatarFallback>CC</AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-lg p-3 md:p-4">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Coach C is thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <Separator />

      {/* Input */}
      <div className="p-4 bg-background">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask Coach C about nutrition, health goals, meal planning..."
                className="pr-12 py-3 md:py-4 text-sm md:text-base"
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 md:h-10 md:w-10"
                onClick={toggleListening}
                disabled={isLoading}
              >
                {isListening ? (
                  <MicOff className="h-4 w-4 text-red-500" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
            </div>
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="h-12 px-4 md:px-6"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
            <span>
              {isListening ? 'Listening...' : 'Press Enter to send or click mic to speak'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAutoSpeak(!autoSpeak)}
              className="md:hidden"
            >
              {autoSpeak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};