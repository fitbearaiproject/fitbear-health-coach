import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useHydration } from '@/hooks/useHydration';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, TrendingUp, Target, ImageIcon, Droplets, Plus, Minus, Pencil, Trash, Check, X } from 'lucide-react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, subDays, subWeeks } from 'date-fns';

interface MealLog {
  id: string;
  dish_name: string;
  quantity: number;
  unit: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
  meal_time: string;
  source: string;
  notes?: string;
  image_url?: string;
}

interface NutritionTotals {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  meals_count: number;
}

interface UserTargets {
  calories_per_day?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
}

export default function Logs() {
  const [selectedFilter, setSelectedFilter] = useState<'today' | 'week' | 'custom'>('today');
  const [customDateRange, setCustomDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [totals, setTotals] = useState<NutritionTotals>({ kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0, meals_count: 0 });
  const [targets, setTargets] = useState<UserTargets>({});
  const [isLoading, setIsLoading] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();
const { hydrationLogs, todayTotal: waterToday, addWater, removeWater, loadHydrationLogs } = useHydration();

  // Inline edit state for meal logs
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<Partial<MealLog>>({});

  const startEdit = (log: MealLog) => {
    setEditingId(log.id);
    setEditingValues({
      quantity: log.quantity,
      unit: log.unit,
      kcal: log.kcal,
      protein_g: log.protein_g,
      carbs_g: log.carbs_g,
      fat_g: log.fat_g,
      fiber_g: log.fiber_g || 0,
      notes: log.notes || ''
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingValues({});
  };

  const handleQuantityChange = (newQty: number) => {
    if (!editingId) {
      setEditingValues(v => ({ ...v, quantity: newQty }));
      return;
    }
    const baseLog = logs.find(l => l.id === editingId);
    setEditingValues(v => {
      if (!baseLog || !baseLog.quantity || newQty <= 0) return { ...v, quantity: newQty };
      const perKcal = (baseLog.kcal || 0) / baseLog.quantity;
      const perProtein = (baseLog.protein_g || 0) / baseLog.quantity;
      const perCarbs = (baseLog.carbs_g || 0) / baseLog.quantity;
      const perFat = (baseLog.fat_g || 0) / baseLog.quantity;
      const perFiber = (baseLog.fiber_g || 0) / baseLog.quantity;
      return {
        ...v,
        quantity: newQty,
        kcal: Math.round(perKcal * newQty),
        protein_g: Math.round(perProtein * newQty * 10) / 10,
        carbs_g: Math.round(perCarbs * newQty * 10) / 10,
        fat_g: Math.round(perFat * newQty * 10) / 10,
        fiber_g: Math.round(perFiber * newQty * 10) / 10,
      };
    });
  };

  const saveEdit = async () => {
    if (!editingId || !user) return;
    try {
      const { error } = await supabase
        .from('meal_logs')
        .update(editingValues)
        .eq('id', editingId)
        .eq('user_id', user.id);
      if (error) throw error;
      toast({ title: 'Log updated' });
      setEditingId(null);
      setEditingValues({});
      await loadLogs();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update log';
      toast({ title: 'Update failed', description: msg, variant: 'destructive' });
    }
  };

  const deleteLog = async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('meal_logs')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      toast({ title: 'Log deleted' });
      await loadLogs();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete log';
      toast({ title: 'Delete failed', description: msg, variant: 'destructive' });
    }
  };

  // Calculate date range based on selected filter
  const getDateRange = () => {
    const now = new Date();
    
    switch (selectedFilter) {
      case 'today':
        return {
          from: startOfDay(now),
          to: endOfDay(now)
        };
      case 'week':
        return {
          from: startOfWeek(now, { weekStartsOn: 1 }), // Monday start
          to: endOfWeek(now, { weekStartsOn: 1 })
        };
      case 'custom':
        return {
          from: customDateRange.from || startOfDay(subDays(now, 7)),
          to: customDateRange.to || endOfDay(now)
        };
      default:
        return {
          from: startOfDay(now),
          to: endOfDay(now)
        };
    }
  };

  // Load user targets
  const loadTargets = async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('targets')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile?.targets) {
        setTargets(profile.targets as UserTargets);
      }
    } catch (err) {
      console.error('Error loading targets:', err);
    }
  };

  // Load meal logs
  const loadLogs = async () => {
    if (!user) return;

    setIsLoading(true);
    
    try {
      const { from, to } = getDateRange();
      
      const { data, error } = await supabase
        .from('meal_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('meal_time', from.toISOString())
        .lte('meal_time', to.toISOString())
        .order('meal_time', { ascending: false });

      if (error) throw error;

      const mealLogs = data || [];
      setLogs(mealLogs);

      // Calculate totals
      const newTotals = mealLogs.reduce((acc, log) => ({
        kcal: acc.kcal + (log.kcal || 0),
        protein_g: acc.protein_g + (log.protein_g || 0),
        carbs_g: acc.carbs_g + (log.carbs_g || 0),
        fat_g: acc.fat_g + (log.fat_g || 0),
        fiber_g: acc.fiber_g + (log.fiber_g || 0),
        sugar_g: acc.sugar_g + (log.sugar_g || 0),
        meals_count: acc.meals_count + 1
      }), { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0, meals_count: 0 });

      setTotals(newTotals);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load logs';
      toast({
        title: "Failed to load logs",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load data on component mount and when filters change
  useEffect(() => {
    if (user) {
      loadTargets();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadLogs();
    }
  }, [user, selectedFilter, customDateRange]);

  // Group logs by date
  const groupedLogs = logs.reduce((acc, log) => {
    const date = format(new Date(log.meal_time), 'yyyy-MM-dd');
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(log);
    return acc;
  }, {} as Record<string, MealLog[]>);

  const handleCustomDateSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range) {
      setCustomDateRange(range);
      setSelectedFilter('custom');
    }
    setDatePickerOpen(false);
  };

  const getFilterLabel = () => {
    const { from, to } = getDateRange();
    
    switch (selectedFilter) {
      case 'today':
        return format(from, 'EEEE, MMM d');
      case 'week':
        return `${format(from, 'MMM d')} - ${format(to, 'MMM d')}`;
      case 'custom':
        return customDateRange.from && customDateRange.to
          ? `${format(customDateRange.from, 'MMM d')} - ${format(customDateRange.to, 'MMM d')}`
          : 'Select dates';
      default:
        return 'Unknown';
    }
  };

  const getProteinProgress = () => {
    if (!targets.protein_g) return 0;
    return Math.min((totals.protein_g / targets.protein_g) * 100, 100);
  };

  const getCaloriesProgress = () => {
    if (!targets.calories_per_day) return 0;
    return Math.min((totals.kcal / targets.calories_per_day) * 100, 100);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Nutrition Logs</h1>
        <p className="text-muted-foreground">
          Track your daily nutrition intake and progress towards your goals.
        </p>
      </div>

      {/* Filter Tabs */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Filter by Period</span>
            <span className="text-sm font-normal text-muted-foreground">
              {getFilterLabel()}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedFilter} onValueChange={(value) => setSelectedFilter(value as typeof selectedFilter)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="week">This Week</TabsTrigger>
              <TabsTrigger value="custom">Custom Range</TabsTrigger>
            </TabsList>
            
            <TabsContent value="custom" className="mt-4">
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customDateRange.from ? (
                      customDateRange.to ? (
                        <>
                          {format(customDateRange.from, "LLL dd, y")} -{" "}
                          {format(customDateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(customDateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={customDateRange.from}
                    selected={{ from: customDateRange.from, to: customDateRange.to }}
                    onSelect={handleCustomDateSelect}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Tabs defaultValue="nutrition" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="nutrition">Nutrition</TabsTrigger>
          <TabsTrigger value="hydration">Water Intake</TabsTrigger>
        </TabsList>
        
        <TabsContent value="nutrition" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Totals and Progress */}
            <div className="space-y-6">
          {/* Nutrition Totals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Nutrition Totals
              </CardTitle>
              <CardDescription>
                {totals.meals_count} dish{totals.meals_count !== 1 ? 'es' : ''} logged
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-primary">{Math.round(totals.kcal)}</p>
                  <p className="text-xs text-muted-foreground">Calories</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{Math.round(totals.protein_g)}</p>
                  <p className="text-xs text-muted-foreground">Protein (g)</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">{Math.round(totals.carbs_g)}</p>
                  <p className="text-xs text-muted-foreground">Carbs (g)</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">{Math.round(totals.fat_g)}</p>
                  <p className="text-xs text-muted-foreground">Fat (g)</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">{Math.round(totals.fiber_g)}</p>
                  <p className="text-xs text-muted-foreground">Fiber (g)</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-pink-600">{Math.round(totals.sugar_g)}</p>
                  <p className="text-xs text-muted-foreground">Sugar (g)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Progress Tracking */}
          {(targets.protein_g || targets.calories_per_day) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Progress vs Targets
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {targets.calories_per_day && (
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Calories</span>
                      <span>{Math.round(totals.kcal)} / {targets.calories_per_day}</span>
                    </div>
                    <Progress value={getCaloriesProgress()} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {Math.round(getCaloriesProgress())}% of daily goal
                    </p>
                  </div>
                )}
                
                {targets.protein_g && (
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Protein</span>
                      <span>{Math.round(totals.protein_g)}g / {targets.protein_g}g</span>
                    </div>
                    <Progress value={getProteinProgress()} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {Math.round(getProteinProgress())}% of daily goal
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Meal Logs */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Meal History</CardTitle>
              <CardDescription>
                Your logged meals for the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading logs...</p>
                </div>
              ) : Object.keys(groupedLogs).length === 0 ? (
                <div className="text-center py-8">
                  <TrendingUp className="h-8 w-8 mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">No meals logged for this period</p>
                  <p className="text-sm text-muted-foreground">Start tracking by using Menu Scanner or Meal Scanner</p>
                </div>
              ) : (
                <ScrollArea className="h-96">
                  <div className="space-y-6">
                    {Object.entries(groupedLogs)
                      .sort(([a], [b]) => b.localeCompare(a))
                      .map(([date, dayLogs]) => (
                        <div key={date}>
                          <div className="flex items-center gap-2 mb-3">
                            <h3 className="font-semibold">
                              {format(new Date(date), 'EEEE, MMMM d')}
                            </h3>
                            <Badge variant="outline" className="text-xs">
                              {dayLogs.length} meal{dayLogs.length !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                          
                          <div className="space-y-2 mb-4">
                            {dayLogs.map((log) => (
                              <Card key={log.id} className="p-3">
                                <div className="flex items-start gap-3">
                                  {log.image_url && (
                                    <img
                                      src={log.image_url}
                                      alt={log.dish_name}
                                      className="w-12 h-12 object-cover rounded"
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between">
                                      <div>
                                        <h4 className="font-medium text-sm">{log.dish_name}</h4>
                                        <p className="text-xs text-muted-foreground">
                                          {log.quantity} {log.unit} • {' '}
                                          {format(new Date(log.meal_time), 'h:mm a')}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium">{log.kcal} kcal</p>
                                        <Badge variant="secondary" className="text-xs">
                                          {log.source}
                                        </Badge>
                                      </div>
                                    </div>

                                    {editingId === log.id ? (
                                      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                        <Input
                                          value={editingValues.quantity as number || 0}
                                          onChange={(e) => handleQuantityChange(parseFloat(e.target.value) || 0)}
                                          type="number"
                                          step="0.1"
                                          placeholder="Qty"
                                          className="h-8"
                                        />
                                        <Input
                                          value={editingValues.unit as string || ''}
                                          onChange={(e) => setEditingValues(v => ({ ...v, unit: e.target.value }))}
                                          placeholder="Unit"
                                          className="h-8"
                                        />
                                        <Input
                                          value={editingValues.kcal as number || 0}
                                          onChange={(e) => setEditingValues(v => ({ ...v, kcal: parseInt(e.target.value) || 0 }))}
                                          type="number"
                                          placeholder="kcal"
                                          className="h-8"
                                        />
                                        <Input
                                          value={editingValues.protein_g as number || 0}
                                          onChange={(e) => setEditingValues(v => ({ ...v, protein_g: parseFloat(e.target.value) || 0 }))}
                                          type="number"
                                          placeholder="Protein (g)"
                                          className="h-8"
                                        />
                                        <Input
                                          value={editingValues.carbs_g as number || 0}
                                          onChange={(e) => setEditingValues(v => ({ ...v, carbs_g: parseFloat(e.target.value) || 0 }))}
                                          type="number"
                                          placeholder="Carbs (g)"
                                          className="h-8"
                                        />
                                        <Input
                                          value={editingValues.fat_g as number || 0}
                                          onChange={(e) => setEditingValues(v => ({ ...v, fat_g: parseFloat(e.target.value) || 0 }))}
                                          type="number"
                                          placeholder="Fat (g)"
                                          className="h-8"
                                        />
                                        <Input
                                          value={(editingValues.fiber_g as number) || 0}
                                          onChange={(e) => setEditingValues(v => ({ ...v, fiber_g: parseFloat(e.target.value) || 0 }))}
                                          type="number"
                                          placeholder="Fiber (g)"
                                          className="h-8"
                                        />
                                        <div className="flex items-center gap-2">
                                          <Button size="sm" onClick={saveEdit} className="h-8 px-3">
                                            <Check className="h-4 w-4" />
                                          </Button>
                                          <Button size="sm" variant="outline" onClick={cancelEdit} className="h-8 px-3">
                                            <X className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="grid grid-cols-4 gap-2 mt-2 text-xs">
                                          <div>
                                            <span className="text-muted-foreground">P:</span>
                                            <span className="ml-1">{Math.round(log.protein_g || 0)}g</span>
                                          </div>
                                          <div>
                                            <span className="text-muted-foreground">C:</span>
                                            <span className="ml-1">{Math.round(log.carbs_g || 0)}g</span>
                                          </div>
                                          <div>
                                            <span className="text-muted-foreground">F:</span>
                                            <span className="ml-1">{Math.round(log.fat_g || 0)}g</span>
                                          </div>
                                          <div>
                                            <span className="text-muted-foreground">Fi:</span>
                                            <span className="ml-1">{Math.round(log.fiber_g || 0)}g</span>
                                          </div>
                                        </div>

                                        {log.notes && (
                                          <p className="text-xs text-muted-foreground mt-1 truncate">
                                            {log.notes}
                                          </p>
                                        )}

                                        <div className="mt-2 flex gap-2">
                                          <Button size="sm" variant="outline" onClick={() => startEdit(log)} className="h-8 px-3">
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                          <Button size="sm" variant="destructive" onClick={() => deleteLog(log.id)} className="h-8 px-3">
                                            <Trash className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                          
                          <Separator />
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </TabsContent>
    
    <TabsContent value="hydration" className="mt-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Water Stats */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Droplets className="h-4 w-4" />
                Water Intake Today
              </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-center space-y-4">
                  <div className="text-4xl font-bold text-blue-600">{waterToday}</div>
                  <p className="text-sm text-muted-foreground">cups consumed (1 cup = 250ml)</p>
                <div className="flex gap-2 justify-center">
                  <Button size="sm" onClick={() => addWater(1)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Cup
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => removeWater()}
                    disabled={waterToday === 0}
                  >
                    <Minus className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Right Column - Water History */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Water History</CardTitle>
              <CardDescription>Your hydration logs for the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                {hydrationLogs.length === 0 ? (
                  <div className="text-center py-8">
                    <Droplets className="h-8 w-8 mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">No water logs for this period</p>
                    <p className="text-sm text-muted-foreground">Start tracking your hydration!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {hydrationLogs.map((log) => (
                      <Card key={log.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{log.cups} cup{log.cups !== 1 ? 's' : ''}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(log.logged_at), 'MMM d, h:mm a')}
                            </p>
                          </div>
                          <Droplets className="h-5 w-5 text-blue-500" />
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </TabsContent>
  </Tabs>
    </div>
  );
}