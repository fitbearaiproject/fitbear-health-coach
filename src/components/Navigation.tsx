import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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

export function Navigation({ currentPage, onNavigate }: NavigationProps) {
  return (
    <nav className="w-64 bg-card border-r border-border h-screen p-4 flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8 p-2">
        <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center">
          <span className="text-xl font-bold text-primary-foreground">🐻</span>
        </div>
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
                "w-full justify-start gap-3 h-12",
                isActive && "bg-gradient-primary shadow-primary"
              )}
              onClick={() => onNavigate(item.id)}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Button>
          );
        })}
      </div>

      {/* Logout */}
      <Button variant="ghost" className="justify-start gap-3 h-12 text-destructive">
        <LogOut className="w-5 h-5" />
        Logout
      </Button>
    </nav>
  );
}