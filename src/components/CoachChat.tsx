import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Mic, MicOff, Volume2, VolumeX, Square } from "lucide-react";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
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
  
  const { toast } = useToast();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

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
    if (!messageText.trim() || !userId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('coach-chat', {
        body: {
          message: messageText,
          userId: userId
        }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Auto-speak if enabled
      if (autoSpeak) {
        await playAudio(data.reply);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const playAudio = async (text: string) => {
    try {
      setIsPlaying(true);
      
      const { data, error } = await supabase.functions.invoke('deepgram-tts', {
        body: { text }
      });

      if (error) throw error;

      // Stop current audio if playing
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }

      // Create and play new audio
      const audio = new Audio(`data:audio/mpeg;base64,${data.audioContent}`);
      currentAudioRef.current = audio;
      
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => {
        setIsPlaying(false);
        toast({
          title: "Audio Error",
          description: "Failed to play audio response",
          variant: "destructive",
        });
      };

      await audio.play();

    } catch (error) {
      console.error('Error playing audio:', error);
      setIsPlaying(false);
      toast({
        title: "Audio Error",
        description: "Failed to generate audio response",
        variant: "destructive",
      });
    }
  };

  const stopAudio = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setIsPlaying(false);
    }
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

          if (data.transcript && data.transcript.trim()) {
            await handleSendMessage(data.transcript);
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

  if (!userId) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
          <p className="text-muted-foreground">Please log in to chat with Coach C</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Avatar className="w-12 h-12">
          <AvatarImage src="/coach-avatar.png" alt="Coach C" />
          <AvatarFallback className="bg-gradient-primary text-primary-foreground font-bold">
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
                    <AvatarImage src="/coach-avatar.png" alt="Coach C" />
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
                  <AvatarImage src="/coach-avatar.png" alt="Coach C" />
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