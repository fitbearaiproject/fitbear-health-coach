import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const slides = [
  {
    title: "Meet Coach C",
    content: "Your personal health coach powered by AI. Chat with me using text or voice for personalized nutrition guidance.",
    image: "/lovable-uploads/00de3c1c-78fb-4830-8c11-79cdf5a2069d.png",
    tip: "Try saying 'Hello Coach C' to start a conversation!"
  },
  {
    title: "Scan Your Meals",
    content: "Take a photo of any meal to instantly analyze its nutrition content, calories, and get personalized recommendations.",
    image: "/images/meal-scan-demo.png",
    tip: "Works great with Indian dishes, homemade food, and restaurant meals!"
  },
  {
    title: "Menu Scanner",
    content: "Upload restaurant menu photos to get AI-powered recommendations tailored to your health goals and dietary preferences.",
    image: "/images/menu-scan-demo.png", 
    tip: "Perfect for dining out while staying on track with your nutrition goals."
  },
  {
    title: "Track Your Progress",
    content: "View detailed logs of your meals, nutrition intake, and progress towards your health goals over time.",
    image: "/images/logs-demo.png",
    tip: "Your data helps Coach C provide better recommendations."
  },
  {
    title: "You're All Set!",
    content: "Start your health journey today. Your free health checkup with Coach C is just a chat away.",
    image: "/lovable-uploads/00de3c1c-78fb-4830-8c11-79cdf5a2069d.png",
    tip: "Ready to transform your health? Let's begin!"
  }
];

export const OnboardingCarousel = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user) return;

      try {
        // Check if user has completed onboarding
        const { data: profile } = await supabase
          .from('profiles')
          .select('prefs')
          .eq('user_id', user.id)
          .maybeSingle();

        const hasCompletedOnboarding = (profile?.prefs as any)?.onboarding_completed;
        
        if (!hasCompletedOnboarding) {
          // Small delay to let the app load
          setTimeout(() => setIsOpen(true), 1000);
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
      }
    };

    checkOnboardingStatus();
  }, [user]);

  const handleComplete = async () => {
    if (!user) return;

    try {
      // Mark onboarding as completed
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          prefs: { onboarding_completed: true }
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error updating onboarding status:', error);
    }

    setIsOpen(false);
  };

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      handleComplete();
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const currentSlideData = slides[currentSlide];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-md mx-auto p-0 gap-0">
        <div className="relative">
          {/* Close button */}
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-4 right-4 z-10"
            onClick={handleComplete}
          >
            <X className="h-4 w-4" />
          </Button>

          {/* Slide content */}
          <div className="p-6 text-center">
            <div className="mb-4">
              <img 
                src={currentSlideData.image} 
                alt={currentSlideData.title}
                className="w-24 h-24 mx-auto rounded-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/lovable-uploads/00de3c1c-78fb-4830-8c11-79cdf5a2069d.png";
                }}
              />
            </div>
            
            <h2 className="text-xl font-bold mb-2">{currentSlideData.title}</h2>
            <p className="text-muted-foreground mb-4">{currentSlideData.content}</p>
            
            <div className="bg-primary/10 rounded-lg p-3 mb-6">
              <p className="text-sm font-medium text-primary">💡 {currentSlideData.tip}</p>
            </div>

            {/* Progress dots */}
            <div className="flex justify-center gap-2 mb-6">
              {slides.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentSlide ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={prevSlide}
                disabled={currentSlide === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>

              <span className="text-sm text-muted-foreground">
                {currentSlide + 1} of {slides.length}
              </span>

              <Button size="sm" onClick={nextSlide}>
                {currentSlide === slides.length - 1 ? (
                  "Get Started"
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};