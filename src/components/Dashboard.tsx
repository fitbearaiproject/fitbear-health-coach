import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  Target,
  TrendingUp,
  Calendar,
  Zap,
  Apple,
  Droplets,
  Flame,
  Activity,
  MessageCircle,
  Camera,
  Utensils
} from "lucide-react";

export function Dashboard() {
  // Mock data - will be replaced with real data from Supabase
  const todayStats = {
    calories: 1420,
    targetCalories: 2000,
    protein: 65,
    targetProtein: 120,
    carbs: 140,
    targetCarbs: 200,
    fat: 45,
    targetFat: 67,
    water: 6,
    targetWater: 8,
  };

  const weeklyProgress = [
    { day: "Mon", calories: 1950 },
    { day: "Tue", calories: 1800 },
    { day: "Wed", calories: 2100 },
    { day: "Thu", calories: 1750 },
    { day: "Fri", calories: 1900 },
    { day: "Sat", calories: 2200 },
    { day: "Sun", calories: 1420 },
  ];

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Good morning! 🌟</h1>
          <p className="text-muted-foreground">Let's make today a healthy one</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Today</p>
          <p className="text-lg font-semibold">{new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-primary text-primary-foreground shadow-primary">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Flame className="w-8 h-8" />
              <div>
                <p className="text-sm opacity-90">Calories Today</p>
                <p className="text-2xl font-bold">{todayStats.calories}</p>
                <p className="text-xs opacity-75">of {todayStats.targetCalories}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-secondary text-secondary-foreground shadow-secondary">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8" />
              <div>
                <p className="text-sm opacity-90">Protein</p>
                <p className="text-2xl font-bold">{todayStats.protein}g</p>
                <p className="text-xs opacity-75">of {todayStats.targetProtein}g</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-success text-success-foreground shadow-glow">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Apple className="w-8 h-8" />
              <div>
                <p className="text-sm opacity-90">Carbs</p>
                <p className="text-2xl font-bold">{todayStats.carbs}g</p>
                <p className="text-xs opacity-75">of {todayStats.targetCarbs}g</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Droplets className="w-8 h-8 text-accent" />
              <div>
                <p className="text-sm text-muted-foreground">Water</p>
                <p className="text-2xl font-bold">{todayStats.water} cups</p>
                <p className="text-xs text-muted-foreground">of {todayStats.targetWater}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Tracking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Today's Nutrition Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Calories</span>
                <span>{todayStats.calories}/{todayStats.targetCalories}</span>
              </div>
              <Progress 
                value={(todayStats.calories / todayStats.targetCalories) * 100} 
                className="h-2"
              />
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Protein</span>
                <span>{todayStats.protein}g/{todayStats.targetProtein}g</span>
              </div>
              <Progress 
                value={(todayStats.protein / todayStats.targetProtein) * 100} 
                className="h-2"
              />
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Carbs</span>
                <span>{todayStats.carbs}g/{todayStats.targetCarbs}g</span>
              </div>
              <Progress 
                value={(todayStats.carbs / todayStats.targetCarbs) * 100} 
                className="h-2"
              />
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Fat</span>
                <span>{todayStats.fat}g/{todayStats.targetFat}g</span>
              </div>
              <Progress 
                value={(todayStats.fat / todayStats.targetFat) * 100} 
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>

        {/* Weekly Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Weekly Calories Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {weeklyProgress.map((day, index) => (
                <div key={day.day} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-10">{day.day}</span>
                  <div className="flex-1">
                    <Progress 
                      value={(day.calories / todayStats.targetCalories) * 100} 
                      className="h-2"
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-16 text-right">
                    {day.calories}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button className="h-20 bg-gradient-primary shadow-primary">
              <div className="text-center">
                <MessageCircle className="w-6 h-6 mx-auto mb-2" />
                <span>Chat with Coach C</span>
              </div>
            </Button>
            
            <Button variant="outline" className="h-20">
              <div className="text-center">
                <Camera className="w-6 h-6 mx-auto mb-2" />
                <span>Scan Meal</span>
              </div>
            </Button>
            
            <Button variant="outline" className="h-20">
              <div className="text-center">
                <Utensils className="w-6 h-6 mx-auto mb-2" />
                <span>Scan Menu</span>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}