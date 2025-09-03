import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ImageProcessor, ScannerDiagnostics, MealScanRequest } from '@/lib/imageProcessor';
import { Camera, Loader2, Upload, X, Plus, ImageIcon, Clock, Info } from 'lucide-react';
import { NutritionBadges } from '@/components/NutritionBadges';

interface DishItem {
  name: string;
  portion: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  description: string;
  coach_note: string;
  flags: string[];
}

interface MealAnalysis {
  dishes: DishItem[];
  summary: {
    total_kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
  };
  overall_note?: string;
  parsing_error?: boolean;
}

interface AnalysisResult {
  request_id: string;
  analysis: MealAnalysis;
  model: string;
  latency_ms: number;
  user_context: string;
}

interface RecentMeal {
  id: string;
  dish_name: string;
  kcal: number;
  meal_time: string;
  image_url?: string;
}

interface SelectedDish {
  dish: DishItem;
  portion: string;
  quantity: number;
}

export default function MealScanner() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string>('');
  const [isLogging, setIsLogging] = useState(false);
  const [recentMeals, setRecentMeals] = useState<RecentMeal[]>([]);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('');
  const [diagnostics, setDiagnostics] = useState<ScannerDiagnostics | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [selectedDishes, setSelectedDishes] = useState<{ [key: string]: SelectedDish }>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Load user profile and recent meals
  useEffect(() => {
    if (user) {
      loadUserProfile();
      loadRecentMeals();
    }
  }, [user]);

  const loadUserProfile = async () => {
    if (!user) return;
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      setUserProfile(profile);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadRecentMeals = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('meal_logs')
        .select('id, dish_name, kcal, meal_time, image_url')
        .eq('user_id', user.id)
        .order('meal_time', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentMeals(data || []);
    } catch (err) {
      console.error('Error loading recent meals:', err);
    }
  };

  const handleImageSelect = (file: File) => {
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setError('Image size must be less than 10MB');
      return;
    }

    setSelectedImage(file);
    setError('');
    setAnalysis(null);
    setUploadedImageUrl('');
    setSelectedDishes({});

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageSelect(file);
    }
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageSelect(file);
    }
  };

  const analyzeMeal = async () => {
    if (!selectedImage || !user || !userProfile) return;

    setIsAnalyzing(true);
    setIsUploading(true);
    setError('');
    setDiagnostics(null);

    try {
      // Process and upload image
      const { signedUrl, originalSize, processedSize } = await ImageProcessor.processAndUpload(selectedImage);
      setUploadedImageUrl(signedUrl);
      setIsUploading(false);

      // Build profile and targets data
      const bps_profile = {
        diet_type: userProfile.diet_type,
        conditions: userProfile.conditions || [],
        activity_level: userProfile.activity_level,
        health_goals: userProfile.health_goals,
        allergies: userProfile.allergies || [],
        cuisines: userProfile.cuisines || []
      };
      
      const targets = (userProfile.targets as any) || {};

      const requestData: MealScanRequest = {
        image_url: signedUrl,
        bps_profile,
        targets
      };

      console.log('Sending meal scan request:', { originalSize, processedSize });

      // Analyze the meal
      const { data, error: supabaseError } = await supabase.functions.invoke('meal-analyze', {
        body: requestData
      });

      // Cleanup uploaded image
      setTimeout(() => ImageProcessor.cleanup(signedUrl), 5000);

      if (supabaseError) throw supabaseError;

      if (data.error) {
        setDiagnostics({
          request_id: data.request_id,
          status: 'error',
          latency_ms: data.latency_ms,
          model: data.model || 'unknown',
          error_class: data.error_class,
          image_px: `${Math.round(processedSize / 1024)}KB`,
          json_parse_ok: false
        });
        throw new Error(data.error);
      }

      setDiagnostics({
        request_id: data.request_id,
        status: data.status,
        latency_ms: data.latency_ms,
        model: data.model,
        image_px: data.image_px,
        json_parse_ok: data.json_parse_ok
      });

      setAnalysis(data as AnalysisResult);
      toast({
        title: "Meal analyzed successfully!",
        description: `Analysis completed in ${data.latency_ms}ms. Review the detected items below.`,
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze meal';
      setError(errorMessage);
      toast({
        title: "Analysis failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
      setIsUploading(false);
    }
  };

  const handleDishSelection = (dish: DishItem, checked: boolean) => {
    const dishKey = dish.name;
    
    if (checked) {
      setSelectedDishes(prev => ({
        ...prev,
        [dishKey]: {
          dish,
          portion: dish.portion,
          quantity: 1
        }
      }));
    } else {
      setSelectedDishes(prev => {
        const newSelected = { ...prev };
        delete newSelected[dishKey];
        return newSelected;
      });
    }
  };

  const updateDishPortion = (dishKey: string, portion: string) => {
    setSelectedDishes(prev => ({
      ...prev,
      [dishKey]: {
        ...prev[dishKey],
        portion
      }
    }));
  };

  const updateDishQuantity = (dishKey: string, quantity: number) => {
    setSelectedDishes(prev => ({
      ...prev,
      [dishKey]: {
        ...prev[dishKey],
        quantity: Math.max(0.1, quantity)
      }
    }));
  };

  const logSelectedDishes = async () => {
    if (!user || Object.keys(selectedDishes).length === 0) return;

    setIsLogging(true);

    try {
      const mealTime = new Date().toISOString();
      const mealDay = new Date().toISOString().split('T')[0];

      for (const [dishKey, selectedDish] of Object.entries(selectedDishes)) {
        const { dish, quantity } = selectedDish;
        
        // Calculate macros based on quantity
        const scaledKcal = Math.round(dish.kcal * quantity);
        const scaledProtein = Math.round(dish.protein_g * quantity * 10) / 10;
        const scaledCarbs = Math.round(dish.carbs_g * quantity * 10) / 10;
        const scaledFat = Math.round(dish.fat_g * quantity * 10) / 10;
        const scaledFiber = Math.round(dish.fiber_g * quantity * 10) / 10;

        const { error } = await supabase
          .from('meal_logs')
          .insert({
            user_id: user.id,
            dish_name: dish.name,
            quantity,
            unit: selectedDish.portion,
            kcal: scaledKcal,
            protein_g: scaledProtein,
            carbs_g: scaledCarbs,
            fat_g: scaledFat,
            fiber_g: scaledFiber,
            notes: `${dish.flags.join(', ')} - ${dish.coach_note}`,
            source: 'photo',
            meal_time: mealTime,
            image_url: uploadedImageUrl
          });


        if (error) throw error;
      }

      toast({
        title: "Meal logged successfully!",
        description: `Logged ${Object.keys(selectedDishes).length} items to your nutrition diary.`,
      });

      // Refresh recent meals and clear current analysis
      await loadRecentMeals();
      setSelectedDishes({});

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to log meal';
      toast({
        title: "Logging failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLogging(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Meal Scanner</h1>
        <p className="text-muted-foreground">
          Snap photos of your meals for automatic nutrition tracking and logging.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Upload and Analysis */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle>Capture Meal</CardTitle>
              <CardDescription>
                Take a photo or upload an image of your meal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {!selectedImage ? (
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button
                      variant="outline"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex items-center gap-2"
                    >
                      <Camera className="h-4 w-4" />
                      Take Photo
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Choose Image
                    </Button>
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleCameraCapture}
                      className="hidden"
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Meal preview"
                        className="w-full h-64 object-cover rounded-lg border"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedImage(null);
                          setImagePreview('');
                          setAnalysis(null);
                          setUploadedImageUrl('');
                          setSelectedDishes({});
                        }}
                        className="absolute top-2 right-2"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      {isUploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                          <div className="text-white text-center">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                            <p className="text-sm">Uploading image...</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={analyzeMeal}
                      disabled={isAnalyzing}
                      className="w-full"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          {isUploading ? 'Uploading & Analyzing...' : 'Analyzing Meal...'}
                        </>
                      ) : (
                        <>
                          <ImageIcon className="h-4 w-4 mr-2" />
                          Analyze Meal
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Selected Dishes Summary */}
          {Object.keys(selectedDishes).length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Selected Items ({Object.keys(selectedDishes).length})</CardTitle>
                  <CardDescription>
                    Review your selections before logging
                  </CardDescription>
                </div>
                <Button
                  onClick={logSelectedDishes}
                  disabled={isLogging}
                  className="flex items-center gap-2"
                >
                  {isLogging ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Log Selected Items
                </Button>
              </CardHeader>
            </Card>
          )}

          {/* Analysis Results */}
          {analysis && (
            <Card>
              <CardHeader>
                <CardTitle>Detected Items</CardTitle>
                <CardDescription>
                  Total: {analysis.analysis.summary.total_kcal} kcal | 
                  Protein: {analysis.analysis.summary.protein_g}g | 
                  Carbs: {analysis.analysis.summary.carbs_g}g | 
                  Fat: {analysis.analysis.summary.fat_g}g | 
                  Fiber: {analysis.analysis.summary.fiber_g}g
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analysis.analysis.overall_note && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>{analysis.analysis.overall_note}</AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="space-y-3">
                    {analysis.analysis.dishes.map((dish, index) => {
                      const dishKey = dish.name;
                      const isSelected = dishKey in selectedDishes;
                      const selectedDish = selectedDishes[dishKey];
                      
                      return (
                        <Card key={index} className="p-4">
                          <div className="flex items-start gap-3">
                            <Checkbox 
                              checked={isSelected}
                              onCheckedChange={(checked) => handleDishSelection(dish, checked as boolean)}
                              className="mt-1"
                            />
                            <div className="flex-1 space-y-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-medium">{dish.name}</h4>
                                  {dish.description && (
                                    <p className="text-sm text-muted-foreground mt-1">{dish.description}</p>
                                  )}
                                </div>
                                <span className="text-sm font-medium">{dish.kcal} kcal</span>
                              </div>
                              
                              {dish.coach_note && (
                                <div className="flex items-start gap-2 p-2 bg-blue-50 rounded-md">
                                  <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                  <p className="text-sm text-blue-700 italic">{dish.coach_note}</p>
                                </div>
                              )}

                              {isSelected && (
                                <div className="p-3 bg-gray-50 rounded-md space-y-3">
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <Label htmlFor={`portion-${dishKey}`} className="text-xs">Portion</Label>
                                      <Input
                                        id={`portion-${dishKey}`}
                                        value={selectedDish.portion}
                                        onChange={(e) => updateDishPortion(dishKey, e.target.value)}
                                        className="h-8 text-sm"
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor={`quantity-${dishKey}`} className="text-xs">Quantity</Label>
                                      <Input
                                        id={`quantity-${dishKey}`}
                                        type="number"
                                        min="0.1"
                                        step="0.1"
                                        value={selectedDish.quantity}
                                        onChange={(e) => updateDishQuantity(dishKey, parseFloat(e.target.value) || 1)}
                                        className="h-8 text-sm"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}

                              <p className="text-sm text-muted-foreground">Portion: {dish.portion}</p>
                              <div className="grid grid-cols-4 gap-4 text-xs">
                                <div>
                                  <span className="text-muted-foreground">Protein:</span>
                                  <span className="ml-1 font-medium">{dish.protein_g}g</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Carbs:</span>
                                  <span className="ml-1 font-medium">{dish.carbs_g}g</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Fat:</span>
                                  <span className="ml-1 font-medium">{dish.fat_g}g</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Fiber:</span>
                                  <span className="ml-1 font-medium">{dish.fiber_g}g</span>
                                </div>
                              </div>
                              {dish.flags.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {dish.flags.map((flag, flagIndex) => (
                                    <Badge key={flagIndex} variant="secondary" className="text-xs">
                                      {flag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Recent Meals & Diagnostics */}
        <div className="space-y-6">
          {/* Recent Meals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Recent Meals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentMeals.length > 0 ? (
                  recentMeals.map((meal) => (
                    <div key={meal.id} className="flex justify-between items-center p-2 border rounded-md">
                      <div>
                        <p className="font-medium text-sm">{meal.dish_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(meal.meal_time).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="secondary">{meal.kcal} kcal</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No recent meals logged
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Diagnostics */}
          {diagnostics && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Scan Diagnostics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Request ID</p>
                    <p className="font-mono text-xs">{diagnostics.request_id}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-muted-foreground">Latency</p>
                      <p className="font-medium">{diagnostics.latency_ms}ms</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Model</p>
                      <p className="font-medium">{diagnostics.model}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground">JSON Parse</p>
                    <p className="font-medium">
                      {diagnostics.json_parse_ok ? (
                        <span className="text-green-600">✓ Success</span>
                      ) : (
                        <span className="text-red-600">✗ Failed</span>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}