import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Send, Mic, MicOff, Volume2, VolumeX, MessageCircle, Loader2, User, Trash2 } from "lucide-react";

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
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState<'hermes' | 'clone'>(() => {
    return (localStorage.getItem('coach-voice') as 'hermes' | 'clone') || 'hermes';
  });
  const { toast } = useToast();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const ttsBytesRef = useRef(0);
  const ttsObjectUrlRef = useRef<string | null>(null);
  
  // Web Audio API refs for volume amplification
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const preGainRef = useRef<GainNode | null>(null);
  const postGainRef = useRef<GainNode | null>(null);
  const eqPresenceRef = useRef<BiquadFilterNode | null>(null);
  const eqHighShelfRef = useRef<BiquadFilterNode | null>(null);
  const limiterRef = useRef<DynamicsCompressorNode | null>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadChatHistory();
    setupSpeechRecognition();
    
    return () => {
      // Cleanup audio and Web Audio API resources
      cleanupWebAudio();
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

  const cleanupWebAudio = () => {
    console.log('[Web Audio] Cleaning up resources');
    
    // Disconnect and clear source node
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch (e) {
        console.warn('[Web Audio] Source disconnect warning:', e);
      }
      sourceNodeRef.current = null;
    }
    
    // Clear pre-gain
    if (preGainRef.current) {
      try {
        preGainRef.current.disconnect();
      } catch (e) {
        console.warn('[Web Audio] PreGain disconnect warning:', e);
      }
      preGainRef.current = null;
    }

    // Clear EQ nodes
    if (eqPresenceRef.current) {
      try {
        eqPresenceRef.current.disconnect();
      } catch (e) {
        console.warn('[Web Audio] EQ Presence disconnect warning:', e);
      }
      eqPresenceRef.current = null;
    }
    if (eqHighShelfRef.current) {
      try {
        eqHighShelfRef.current.disconnect();
      } catch (e) {
        console.warn('[Web Audio] EQ HighShelf disconnect warning:', e);
      }
      eqHighShelfRef.current = null;
    }
    
    // Clear compressor/limiter
    if (compressorRef.current) {
      try {
        compressorRef.current.disconnect();
      } catch (e) {
        console.warn('[Web Audio] Compressor disconnect warning:', e);
      }
      compressorRef.current = null;
    }
    if (limiterRef.current) {
      try {
        limiterRef.current.disconnect();
      } catch (e) {
        console.warn('[Web Audio] Limiter disconnect warning:', e);
      }
      limiterRef.current = null;
    }
    
    // Clear post-gain
    if (gainNodeRef.current) {
      try {
        gainNodeRef.current.disconnect();
      } catch (e) {
        console.warn('[Web Audio] Gain disconnect warning:', e);
      }
      gainNodeRef.current = null;
    }
    if (postGainRef.current) {
      try {
        postGainRef.current.disconnect();
      } catch (e) {
        console.warn('[Web Audio] PostGain disconnect warning:', e);
      }
      postGainRef.current = null;
    }
    
    // Close audio context
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {
        console.warn('[Web Audio] Context close warning:', e);
      }
      audioContextRef.current = null;
    }
  };

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
    try {
      setIsPlayingAudio(true);
      
      let audioUrl = '';
      const shouldUseClone = selectedVoice === 'clone';
      
      if (shouldUseClone) {
        // Ensure any previous nodes are torn down so we can rebuild a fresh, louder chain
        cleanupWebAudio();
        audioUrl = `https://xnncvfuamecmjvvoaywz.supabase.co/functions/v1/cartesia-tts-stream?text=${encodeURIComponent(text)}&voice_id=bc6b3ad8-7a84-47e2-b655-4a087d2f8c4d`;
      } else {
        audioUrl = `https://xnncvfuamecmjvvoaywz.supabase.co/functions/v1/deepgram-tts-stream?text=${encodeURIComponent(text)}&voice=aura-2-hermes-en`;
      }

      console.log('Attempting to play audio from:', audioUrl);

      // Create a new audio element for this request
      const audio = new Audio();
      currentAudioRef.current = audio;

      // Set up event listeners before setting the src
      let hasStartedPlaying = false;
      let retryCount = 0;
      const maxRetries = 2; // Reduced from 3 to 2

      const handleSuccess = () => {
        console.log('Audio started playing successfully');
        hasStartedPlaying = true;
      };

      const handleError = (error: any) => {
        console.error('Audio playback error:', error);
        if (!hasStartedPlaying && retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying audio playback (attempt ${retryCount}/${maxRetries})`);
          setTimeout(() => {
            if (currentAudioRef.current === audio && !hasStartedPlaying) {
              // Gentler retry - just try playing again without reload
              audio.play().catch((retryError) => {
                console.error('Retry failed:', retryError);
                if (retryCount === maxRetries) {
                  setIsPlayingAudio(false);
                }
              });
            }
          }, 1500 * retryCount); // Slightly longer delay
        } else {
          setIsPlayingAudio(false);
        }
      };

      const handleLoadError = () => {
        console.error('Audio load error');
        handleError('Load failed');
      };

      const handlePlayError = (e: any) => {
        console.error('Audio play error:', e);
        handleError(e);
      };

      const handleEnded = () => {
        console.log('Audio playback ended');
        setIsPlayingAudio(false);
        if (currentAudioRef.current === audio) {
          currentAudioRef.current = null;
        }
      };

      const handleCanPlayThrough = () => {
        console.log('Audio can play through - ready for playback');
        if (!hasStartedPlaying) {
          // Set up Web Audio API here when we know the audio is ready
          if (shouldUseClone) {
            try {
              try {
                // Create or reuse a single AudioContext for the session
                const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
                const audioContext = audioContextRef.current ?? new AudioCtx();
                audioContextRef.current = audioContext;
                if (audioContext.state === 'suspended') {
                  audioContext.resume().catch(() => {});
                }

                // Prevent double-connecting the same media element
                if (sourceNodeRef.current) {
                  console.log('[Web Audio] Chain already initialized for this playback');
                  return;
                }

                // Build nodes
                const source = audioContext.createMediaElementSource(audio);
                sourceNodeRef.current = source;

                const preGain = audioContext.createGain();
                preGain.gain.value = 8.0; // hit the dynamics harder
                preGainRef.current = preGain;
                gainNodeRef.current = preGain; // backward compat

                const eqPresence = audioContext.createBiquadFilter();
                eqPresence.type = 'peaking';
                eqPresence.frequency.value = 3000; // speech intelligibility band
                eqPresence.Q.value = 1.0;
                eqPresence.gain.value = 7.0; // +7 dB
                eqPresenceRef.current = eqPresence;

                const eqHigh = audioContext.createBiquadFilter();
                eqHigh.type = 'highshelf';
                eqHigh.frequency.value = 4500;
                eqHigh.gain.value = 4.0; // gentle shimmer for clarity
                eqHighShelfRef.current = eqHigh;

                const compressor = audioContext.createDynamicsCompressor();
                compressor.threshold.value = -22;
                compressor.knee.value = 30;
                compressor.ratio.value = 12;
                compressor.attack.value = 0.002;
                compressor.release.value = 0.2;
                compressorRef.current = compressor;

                // Brickwall-like limiter
                const limiter = audioContext.createDynamicsCompressor();
                limiter.threshold.value = -8;
                limiter.knee.value = 0;
                limiter.ratio.value = 20;
                limiter.attack.value = 0.001;
                limiter.release.value = 0.1;
                limiterRef.current = limiter;

                const postGain = audioContext.createGain();
                postGain.gain.value = 4.0; // final loudness boost
                postGainRef.current = postGain;

                // Strong amplification for soft clone voices
                audio.volume = 1.0;
                audio.muted = false;

                // Connect: source -> preGain -> eqPresence -> eqHigh -> compressor -> limiter -> postGain -> destination
                source.connect(preGain);
                preGain.connect(eqPresence);
                eqPresence.connect(eqHigh);
                eqHigh.connect(compressor);
                compressor.connect(limiter);
                limiter.connect(postGain);
                postGain.connect(audioContext.destination);

                console.log('Web Audio API setup: pre/post gain + EQ + compressor + limiter (very loud)');
              } catch (webAudioError) {
                console.warn('Web Audio API setup failed, playing without amplification:', webAudioError);
              }
            } catch (webAudioError) {
              console.warn('Web Audio API setup failed, playing without amplification:', webAudioError);
            }
          }
        }
      };

      const handleStalled = () => {
        console.log('Audio stalled - network issue detected');
        // Don't automatically reload on stall - this was causing the race condition
        // Just log it and let the browser handle buffering
      };

      const handleWaiting = () => {
        console.log('Audio waiting for more data...');
        // Let the browser handle buffering naturally
      };

      // Add event listeners
      audio.addEventListener('play', handleSuccess);
      audio.addEventListener('error', handleLoadError);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('canplaythrough', handleCanPlayThrough);
      audio.addEventListener('stalled', handleStalled);
      audio.addEventListener('waiting', handleWaiting);

      // Set the source and configure
      audio.src = audioUrl;
      audio.preload = 'auto';
      audio.crossOrigin = 'anonymous'; // For CORS

      // Start playback after a brief moment to ensure everything is set up
      setTimeout(async () => {
        if (currentAudioRef.current === audio) {
          try {
            await audio.play();
            if (!hasStartedPlaying) {
              handleSuccess();
            }
          } catch (playError) {
            console.error('Initial play failed:', playError);
            handlePlayError(playError);
          }
        }
      }, 100);

    } catch (error) {
      console.error('Audio setup error:', error);
      setIsPlayingAudio(false);
    }
  };

  const stopAudio = () => {
    console.log('[TTS] Stop audio requested');
    
    // GUARDRAIL: Robust cleanup with error handling including Web Audio API
    cleanupWebAudio();
    
    if (ttsAbortRef.current) {
      try {
        ttsAbortRef.current.abort();
      } catch (e) {
        console.warn('[TTS] Abort controller error:', e);
      }
      ttsAbortRef.current = null;
    }
    
    if (currentAudioRef.current) {
      try { 
        currentAudioRef.current.pause();
        currentAudioRef.current.src = '';
        currentAudioRef.current.load();
      } catch (e) {
        console.warn('[TTS] Audio stop error:', e);
      }
      currentAudioRef.current = null;
    }
    
    if (ttsObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(ttsObjectUrlRef.current);
      } catch (e) {
        console.warn('[TTS] URL revoke error:', e);
      }
      ttsObjectUrlRef.current = null;
    }
    
    setIsPlayingAudio(false);
    console.log('[TTS] Audio stopped and cleaned up');
  };

  const handleVoiceChange = (voice: 'hermes' | 'clone') => {
    setSelectedVoice(voice);
    localStorage.setItem('coach-voice', voice);
    toast({
      title: "Voice Changed",
      description: `Switched to ${voice === 'clone' ? 'Your Voice Clone' : 'Hermes Default'} voice`,
    });
  };

  const clearChatHistory = async () => {
    if (!userId) return;
    
    try {
      const { error } = await supabase.functions.invoke('clear-chat-history', {
        body: { userId }
      });
      
      if (error) throw error;
      
      setMessages([]);
      toast({
        title: "Chat Cleared",
        description: "Your conversation history has been cleared",
      });
    } catch (error) {
      console.error('Error clearing chat:', error);
      toast({
        title: "Error",
        description: "Failed to clear chat history",
        variant: "destructive",
      });
    }
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
                {isPlayingAudio && <Badge variant="outline" className="text-xs">🔊 Speaking</Badge>}
              </div>
            </div>
            <div className="flex flex-col gap-2 md:flex-row">
              {/* Voice Selection */}
              <Select value={selectedVoice} onValueChange={handleVoiceChange}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hermes" className="text-xs">
                    <div className="flex items-center gap-2">
                      <Volume2 className="h-3 w-3" />
                      Hermes (Default)
                    </div>
                  </SelectItem>
                  <SelectItem value="clone" className="text-xs">
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3" />
                      Your Voice Clone
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearChatHistory}
                  className="text-destructive hover:text-destructive"
                  title="Clear chat history"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  variant={autoSpeak ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAutoSpeak(!autoSpeak)}
                  className="hidden md:flex"
                >
                  {autoSpeak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </Button>
                {isPlayingAudio && (
                  <Button variant="outline" size="sm" onClick={stopAudio}>
                    Stop
                  </Button>
                )}
              </div>
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