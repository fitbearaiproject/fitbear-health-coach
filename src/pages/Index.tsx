import { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { Dashboard } from "@/components/Dashboard";
import { CoachChat } from "@/components/CoachChat";
import { OnboardingCarousel } from "@/components/OnboardingCarousel";
import MenuScanner from "./MenuScanner";
import MealScanner from "./MealScanner";
import Logs from "./Logs";
import Profile from "./Profile";
import Settings from "./Settings";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

const Index = () => {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user } = useAuth();

  // Listen for navigation events from quick actions
  useEffect(() => {
    const handleNavigate = (event: CustomEvent) => {
      setCurrentPage(event.detail);
      setIsMobileMenuOpen(false); // Close mobile menu on navigation
    };
    
    window.addEventListener('navigate', handleNavigate as EventListener);
    return () => window.removeEventListener('navigate', handleNavigate as EventListener);
  }, []);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isMobileMenuOpen && !target.closest('.mobile-nav') && !target.closest('.mobile-menu-trigger')) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isMobileMenuOpen]);

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard />;
      case "coach":
        return <CoachChat userId={user?.id || ""} />;
      case "menu-scanner":
        return <MenuScanner />;
      case "meal-scanner":
        return <MealScanner />;
      case "logs":
        return <Logs />;
      case "profile":
        return <Profile />;
      case "settings":
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Navigation */}
      <div className="hidden lg:block">
        <Navigation currentPage={currentPage} onNavigate={setCurrentPage} />
      </div>

      {/* Mobile Navigation Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="mobile-nav fixed left-0 top-0 h-full w-80 max-w-[85vw] bg-card border-r border-border shadow-2xl">
            <Navigation 
              currentPage={currentPage} 
              onNavigate={(page) => {
                setCurrentPage(page);
                setIsMobileMenuOpen(false);
              }} 
              isMobile={true}
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <div className="lg:hidden border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
          <div className="flex items-center justify-between p-4">
            <Button
              variant="ghost"
              size="sm"
              className="mobile-menu-trigger"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>
            <h1 className="text-lg font-bold gradient-text">Fitbear AI</h1>
            <div className="w-10" /> {/* Spacer for centering */}
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          {renderPage()}
        </div>
      </div>
      
      {/* Onboarding Carousel */}
      <OnboardingCarousel />
    </div>
  );
};

export default Index;
