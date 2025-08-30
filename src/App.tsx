import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import { Loader2 } from "lucide-react";

const App = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Routes>
        <Route path="/auth" element={user ? <Navigate to="/" /> : <Auth />} />
        <Route path="/" element={user ? <Index /> : <Navigate to="/auth" />} />
        <Route path="*" element={user ? <NotFound /> : <Navigate to="/auth" />} />
      </Routes>
    </TooltipProvider>
  );
};

export default App;
