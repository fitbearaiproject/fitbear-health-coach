import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay } from "date-fns";
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
  Utensils,
  Plus,
  Minus
} from "lucide-react";

export function Dashboard() {
  const [todayStats, setTodayStats] = useState({
    calories: 0,
    targetCalories: 2000,
    protein: 0,
    targetProtein: 120,
    carbs: 0,
    targetCarbs: 200,
    fat: 0,
    targetFat: 67,
    water: 0,
    targetWater: 8,
  });
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  // Load real data from Supabase
  useEffect(() => {
    if (user) {
      loadTodayStats();
    }
  }, [user]);

  const loadTodayStats = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const today = new Date();
      const from = startOfDay(today);
      const to = endOfDay(today);

      // Load today's meal totals
      const { data: meals } = await supabase
        .from('meal_logs')
        .select('kcal, protein_g, carbs_g, fat_g')
        .eq('user_id', user.id)
        .gte('meal_time', from.toISOString())
        .lte('meal_time', to.toISOString());

      // Load today's water intake
      const { data: hydration } = await supabase
        .from('hydration_logs')
        .select('cups')
        .eq('user_id', user.id)
        .eq('log_date', format(today, 'yyyy-MM-dd'));

      // Load user targets
      const { data: profile } = await supabase
        .from('profiles')
        .select('targets')
        .eq('user_id', user.id)
        .maybeSingle();

      const mealTotals = meals?.reduce((acc, meal) => ({
        calories: acc.calories + (meal.kcal || 0),
        protein: acc.protein + (meal.protein_g || 0),
        carbs: acc.carbs + (meal.carbs_g || 0),
        fat: acc.fat + (meal.fat_g || 0),
      }), { calories: 0, protein: 0, carbs: 0, fat: 0 }) || { calories: 0, protein: 0, carbs: 0, fat: 0 };

      const totalWater = hydration?.reduce((sum, log) => sum + log.cups, 0) || 0;
      const targets = (profile?.targets as any) || {};

      setTodayStats({
        calories: Math.round(mealTotals.calories),
        targetCalories: targets.calories_per_day || 2000,
        protein: Math.round(mealTotals.protein),
        targetProtein: targets.protein_g || 120,
        carbs: Math.round(mealTotals.carbs),
        targetCarbs: targets.carbs_g || 200,
        fat: Math.round(mealTotals.fat),
        targetFat: targets.fat_g || 67,
        water: totalWater,
        targetWater: 8,
      });

    } catch (error) {
      console.error('Error loading today stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateWater = async (increment: number) => {
    if (!user) return;
    
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      if (increment > 0) {
        // Add cups
        await supabase
          .from('hydration_logs')
          .insert({
            user_id: user.id,
            cups: increment,
            log_date: today
          });
      } else {
        // Remove cups (need to find and delete/update recent entries)
        const { data: recentLogs } = await supabase
          .from('hydration_logs')
          .select('id, cups')
          .eq('user_id', user.id)
          .eq('log_date', today)
          .order('logged_at', { ascending: false })
          .limit(1);

        if (recentLogs && recentLogs.length > 0) {
          const log = recentLogs[0];
          if (log.cups > 1) {
            await supabase
              .from('hydration_logs')
              .update({ cups: log.cups - 1 })
              .eq('id', log.id);
          } else {
            await supabase
              .from('hydration_logs')
              .delete()
              .eq('id', log.id);
          }
        }
      }
      
      // Reload stats
      await loadTodayStats();
    } catch (error) {
      console.error('Error updating water:', error);
    }
  };

  const weeklyProgress = [
    { day: "Mon", calories: 1950 },
    { day: "Tue", calories: 1800 },
    { day: "Wed", calories: 2100 },
    { day: "Thu", calories: 1750 },
    { day: "Fri", calories: 1900 },
    { day: "Sat", calories: 2200 },
    { day: "Sun", calories: todayStats.calories },
  ];

  if (isLoading) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your health data...</p>
        </div>
      </div>
    );
  }

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
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Water</p>
                <p className="text-2xl font-bold">{todayStats.water} cups</p>
                <p className="text-xs text-muted-foreground">of {todayStats.targetWater}</p>
              </div>
              <div className="flex flex-col gap-1">
                <Button
                  size="sm"
                  onClick={() => updateWater(1)}
                  className="h-8 w-8 p-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateWater(-1)}
                  className="h-8 w-8 p-0"
                  disabled={todayStats.water === 0}
                >
                  <Minus className="h-4 w-4" />
                </Button>
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
            <Button 
              className="h-20 bg-gradient-primary shadow-primary"
              onClick={() => {
                const navEvent = new CustomEvent('navigate', { detail: 'coach' });
                window.dispatchEvent(navEvent);
              }}
            >
              <div className="text-center">
                <MessageCircle className="w-6 h-6 mx-auto mb-2" />
                <span>Chat with Coach C</span>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-20"
              onClick={() => {
                const navEvent = new CustomEvent('navigate', { detail: 'meal-scanner' });
                window.dispatchEvent(navEvent);
              }}
            >
              <div className="text-center">
                <Camera className="w-6 h-6 mx-auto mb-2" />
                <span>Scan Meal</span>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-20"
              onClick={() => {
                const navEvent = new CustomEvent('navigate', { detail: 'menu-scanner' });
                window.dispatchEvent(navEvent);
              }}
            >
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