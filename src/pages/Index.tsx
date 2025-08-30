import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { Dashboard } from "@/components/Dashboard";
import { CoachChat } from "@/components/CoachChat";

const Index = () => {
  const [currentPage, setCurrentPage] = useState("dashboard");

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard />;
      case "coach":
        return <CoachChat userId="temp-user-id" />;
      case "menu-scanner":
        return (
          <div className="flex-1 p-6">
            <h1 className="text-3xl font-bold mb-4">Menu Scanner</h1>
            <p className="text-muted-foreground">Upload restaurant menus to get personalized recommendations...</p>
          </div>
        );
      case "meal-scanner":
        return (
          <div className="flex-1 p-6">
            <h1 className="text-3xl font-bold mb-4">Meal Scanner</h1>
            <p className="text-muted-foreground">Snap photos of your meals for automatic nutrition tracking...</p>
          </div>
        );
      case "logs":
        return (
          <div className="flex-1 p-6">
            <h1 className="text-3xl font-bold mb-4">Nutrition Logs</h1>
            <p className="text-muted-foreground">View your daily and weekly nutrition history...</p>
          </div>
        );
      case "profile":
        return (
          <div className="flex-1 p-6">
            <h1 className="text-3xl font-bold mb-4">Profile (BPS)</h1>
            <p className="text-muted-foreground">Manage your Body Profile System settings...</p>
          </div>
        );
      case "settings":
        return (
          <div className="flex-1 p-6">
            <h1 className="text-3xl font-bold mb-4">Settings</h1>
            <p className="text-muted-foreground">Customize your app preferences and targets...</p>
          </div>
        );
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
