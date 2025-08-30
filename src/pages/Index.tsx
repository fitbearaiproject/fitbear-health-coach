import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { Dashboard } from "@/components/Dashboard";
import { CoachChat } from "@/components/CoachChat";
import MenuScanner from "./MenuScanner";
import MealScanner from "./MealScanner";
import Logs from "./Logs";
import Profile from "./Profile";
import Settings from "./Settings";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const { user } = useAuth();

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
      <Navigation currentPage={currentPage} onNavigate={setCurrentPage} />
      {renderPage()}
    </div>
  );
};

export default Index;
