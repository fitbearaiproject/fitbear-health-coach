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
    fiber: 0,
    targetFiber: 25,
    sugar: 0,
    targetSugar: 25,
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
        .select('kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g')
        .eq('user_id', user.id)
        .gte('meal_time', from.toISOString())
        .lte('meal_time', to.toISOString());

      // Load today's water intake
      const { data: hydration } = await supabase
        .from('hydration_logs')
        .select('cups')
        .eq('user_id', user.id)
        .eq('log_date', format(today, 'yyyy-MM-dd'));

      // Load user targets from targets table (not profiles.targets)
      const { data: userTargets } = await supabase
        .from('targets')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      const mealTotals = meals?.reduce((acc, meal) => ({
        calories: acc.calories + (meal.kcal || 0),
        protein: acc.protein + (meal.protein_g || 0),
        carbs: acc.carbs + (meal.carbs_g || 0),
        fat: acc.fat + (meal.fat_g || 0),
        fiber: acc.fiber + (meal.fiber_g || 0),
        sugar: acc.sugar + ((meal as any).sugar_g || 0),
      }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 }) || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 };

      const totalWater = hydration?.reduce((sum, log) => sum + log.cups, 0) || 0;

      setTodayStats({
        calories: Math.round(mealTotals.calories),
        targetCalories: userTargets?.calories_per_day || 2000,
        protein: Math.round(mealTotals.protein),
        targetProtein: userTargets?.protein_g || 120,
        carbs: Math.round(mealTotals.carbs),
        targetCarbs: userTargets?.carbs_g || 200,
        fat: Math.round(mealTotals.fat),
        targetFat: userTargets?.fat_g || 67,
        fiber: Math.round(mealTotals.fiber),
        targetFiber: userTargets?.fiber_g || 25,
        sugar: Math.round(mealTotals.sugar),
        targetSugar: userTargets?.sugar_g || 25,
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
    <div className="flex-1 p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          {(() => {
            const hour = new Date().getHours();
            const greeting = hour < 12 ? 'Good morning!' : hour < 17 ? 'Good afternoon!' : 'Good evening!';
            return <h1 className="text-2xl sm:text-3xl font-bold">{greeting} 🌟</h1>;
          })()}
          <p className="text-muted-foreground">Let's make today a healthy one</p>
          <p className="text-xs text-muted-foreground mt-1 italic">
            Your progress isn't just about numbers—it's about building habits that fit your life (BPS-design).
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-sm text-muted-foreground">Today</p>
          <p className="text-lg font-semibold">{new Date().toLocaleDateString('en-IN', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric' 
          })}</p>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-gradient-primary text-primary-foreground shadow-primary">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <Flame className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm opacity-90">Calories Today</p>
                <p className="text-xl sm:text-2xl font-bold truncate">{todayStats.calories}</p>
                <p className="text-xs opacity-75">of {todayStats.targetCalories}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-secondary text-secondary-foreground shadow-secondary">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <Activity className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm opacity-90">Protein</p>
                <p className="text-xl sm:text-2xl font-bold truncate">{todayStats.protein}g</p>
                <p className="text-xs opacity-75">of {todayStats.targetProtein}g</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-success text-success-foreground shadow-glow">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <Apple className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm opacity-90">Carbs</p>
                <p className="text-xl sm:text-2xl font-bold truncate">{todayStats.carbs}g</p>
                <p className="text-xs opacity-75">of {todayStats.targetCarbs}g</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <Droplets className="w-6 h-6 sm:w-8 sm:h-8 text-accent flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">Water (1 cup = 250ml)</p>
                <p className="text-xl sm:text-2xl font-bold truncate">{todayStats.water} cups</p>
                <p className="text-xs text-muted-foreground">of {todayStats.targetWater}</p>
              </div>
              <div className="flex flex-col gap-1">
                <Button
                  size="sm"
                  onClick={() => updateWater(1)}
                  className="h-8 w-8 p-0 touch-manipulation"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateWater(-1)}
                  className="h-8 w-8 p-0 touch-manipulation"
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
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {/* Today's Progress */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Target className="w-5 h-5 flex-shrink-0" />
              <span className="truncate">Today's Nutrition Progress</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Calories</span>
                <span className="font-medium">{todayStats.calories}/{todayStats.targetCalories}</span>
              </div>
              <Progress 
                value={(todayStats.calories / todayStats.targetCalories) * 100} 
                className="h-3"
              />
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Protein</span>
                <span className="font-medium">{todayStats.protein}g/{todayStats.targetProtein}g</span>
              </div>
              <Progress 
                value={(todayStats.protein / todayStats.targetProtein) * 100} 
                className="h-3"
              />
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Carbs</span>
                <span className="font-medium">{todayStats.carbs}g/{todayStats.targetCarbs}g</span>
              </div>
              <Progress 
                value={(todayStats.carbs / todayStats.targetCarbs) * 100} 
                className="h-3"
              />
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Fat</span>
                <span className="font-medium">{todayStats.fat}g/{todayStats.targetFat}g</span>
              </div>
              <Progress 
                value={(todayStats.fat / todayStats.targetFat) * 100} 
                className="h-3"
              />
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Fiber</span>
                <span className="font-medium">{todayStats.fiber}g/{todayStats.targetFiber}g</span>
              </div>
              <Progress 
                value={(todayStats.fiber / todayStats.targetFiber) * 100} 
                className="h-3"
              />
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Sugar</span>
                <span className="font-medium">{todayStats.sugar}g/{todayStats.targetSugar}g</span>
              </div>
              <Progress 
                value={(todayStats.sugar / todayStats.targetSugar) * 100} 
                className="h-3"
              />
            </div>
          </CardContent>
        </Card>

        {/* Weekly Overview */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <TrendingUp className="w-5 h-5 flex-shrink-0" />
              <span className="truncate">Weekly Calories Overview</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {weeklyProgress.map((day, index) => (
                <div key={day.day} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-10 flex-shrink-0">{day.day}</span>
                  <div className="flex-1">
                    <Progress 
                      value={(day.calories / todayStats.targetCalories) * 100} 
                      className="h-3"
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-16 text-right flex-shrink-0">
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
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Zap className="w-5 h-5 flex-shrink-0" />
            <span>Quick Actions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <Button 
              className="h-16 sm:h-20 bg-gradient-primary shadow-primary touch-manipulation"
              onClick={() => {
                const navEvent = new CustomEvent('navigate', { detail: 'coach' });
                window.dispatchEvent(navEvent);
              }}
            >
              <div className="text-center">
                <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1 sm:mb-2" />
                <span className="text-sm sm:text-base">Chat with Coach C</span>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-16 sm:h-20 touch-manipulation"
              onClick={() => {
                const navEvent = new CustomEvent('navigate', { detail: 'meal-scanner' });
                window.dispatchEvent(navEvent);
              }}
            >
              <div className="text-center">
                <Camera className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1 sm:mb-2" />
                <span className="text-sm sm:text-base">Scan Meal</span>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-16 sm:h-20 touch-manipulation"
              onClick={() => {
                const navEvent = new CustomEvent('navigate', { detail: 'menu-scanner' });
                window.dispatchEvent(navEvent);
              }}
            >
              <div className="text-center">
                <Utensils className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1 sm:mb-2" />
                <span className="text-sm sm:text-base">Scan Menu</span>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}