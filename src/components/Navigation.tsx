import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { 
  Home,
  MessageCircle,
  Camera,
  Utensils,
  BarChart3,
  User,
  Settings,
  LogOut
} from "lucide-react";


interface NavigationProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  isMobile?: boolean;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "coach", label: "Coach C", icon: MessageCircle },
  { id: "menu-scanner", label: "Menu Scanner", icon: Utensils },
  { id: "meal-scanner", label: "Meal Scanner", icon: Camera },
  { id: "logs", label: "Logs", icon: BarChart3 },
  { id: "profile", label: "Profile", icon: User },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Navigation({ currentPage, onNavigate, isMobile = false }: NavigationProps) {
  const { signOut } = useAuth();
  
  return (
    <nav className={cn(
      "bg-card border-r border-border h-screen p-4 flex flex-col",
      isMobile ? "w-full" : "w-64"
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8 p-2">
        <img src="/lovable-uploads/47ea420a-6f0b-4294-86c9-2a679f56730d.png" alt="FitBear AI logo" className="h-10 w-auto object-contain" />
        <div>
          <h1 className="text-xl font-bold gradient-text">Fitbear AI</h1>
          <p className="text-xs text-muted-foreground">Your Health Coach</p>
        </div>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          
          return (
            <Button
              key={item.id}
              variant={isActive ? "default" : "ghost"}
              className={cn(
                "w-full justify-start gap-3 h-12 text-left",
                isActive && "bg-gradient-primary shadow-primary"
              )}
              onClick={() => onNavigate(item.id)}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </Button>
          );
        })}
      </div>

      {/* Logout */}
      <Button 
        variant="ghost" 
        className="justify-start gap-3 h-12 text-destructive"
        onClick={signOut}
      >
        <LogOut className="w-5 h-5 flex-shrink-0" />
        <span>Logout</span>
      </Button>
    </nav>
  );
}