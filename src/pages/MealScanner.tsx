import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Camera, Loader2, Upload, X, Plus, ImageIcon, Clock } from 'lucide-react';

interface DishItem {
  name: string;
  portion: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  flags: string[];
}

interface MealAnalysis {
  dishes: DishItem[];
  total_kcal: number;
  meal_notes: string;
  portion_confidence: string;
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Load recent meals on component mount
  useEffect(() => {
    if (user) {
      loadRecentMeals();
    }
  }, [user]);

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

  const uploadImageToStorage = async (file: File): Promise<string> => {
    const fileName = `meal_${user?.id}_${Date.now()}.jpg`;
    const filePath = `meals/${fileName}`;

    const { data, error } = await supabase.storage
      .from('meal-photos')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false
      });

    if (error) {
      throw new Error(`Failed to upload image: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('meal-photos')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result as string;
        // Remove data:image/jpeg;base64, prefix
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = error => reject(error);
    });
  };

  const analyzeMeal = async () => {
    if (!selectedImage || !user) return;

    setIsAnalyzing(true);
    setIsUploading(true);
    setError('');

    try {
      // First upload image to storage
      const imageUrl = await uploadImageToStorage(selectedImage);
      setUploadedImageUrl(imageUrl);
      setIsUploading(false);

      // Convert image to base64 for analysis
      const base64Image = await convertToBase64(selectedImage);

      // Analyze the meal
      const { data, error: supabaseError } = await supabase.functions.invoke('meal-analyze', {
        body: {
          image_data: base64Image,
          user_id: user.id
        }
      });

      if (supabaseError) throw supabaseError;

      if (data.error) {
        throw new Error(data.error);
      }

      setAnalysis(data as AnalysisResult);
      toast({
        title: "Meal analyzed successfully!",
        description: "Review the detected items below and log your meal.",
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

  const logMealToDB = async () => {
    if (!analysis || !user) return;

    setIsLogging(true);

    try {
      // Check for potential duplicates in the last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recentLogs } = await supabase
        .from('meal_logs')
        .select('dish_name, kcal')
        .eq('user_id', user.id)
        .gte('meal_time', oneHourAgo);

      // Simple deduplication: check if similar meal logged recently
      const currentTotalKcal = analysis.analysis.total_kcal;
      const isDuplicate = recentLogs?.some(log => 
        Math.abs(log.kcal - currentTotalKcal) < 50 && 
        analysis.analysis.dishes.some(dish => 
          log.dish_name.toLowerCase().includes(dish.name.toLowerCase().split(' ')[0])
        )
      );

      if (isDuplicate) {
        const shouldContinue = confirm('A similar meal was logged recently. Continue anyway?');
        if (!shouldContinue) {
          setIsLogging(false);
          return;
        }
      }

      // Log each dish as a separate entry
      const mealTime = new Date().toISOString();
      const mealDay = new Date().toISOString().split('T')[0];

      for (const dish of analysis.analysis.dishes) {
        const { error } = await supabase
          .from('meal_logs')
          .insert({
            user_id: user.id,
            dish_name: dish.name,
            quantity: 1,
            unit: dish.portion,
            kcal: dish.kcal,
            protein_g: dish.protein_g,
            carbs_g: dish.carbs_g,
            fat_g: dish.fat_g,
            notes: `${dish.flags.join(', ')} - ${analysis.analysis.meal_notes}`,
            source: 'photo',
            meal_time: mealTime,
            meal_day_ist: mealDay,
            image_url: uploadedImageUrl
          });

        if (error) throw error;
      }

      toast({
        title: "Meal logged successfully!",
        description: `Logged ${analysis.analysis.dishes.length} items to your nutrition diary.`,
      });

      // Refresh recent meals and clear current analysis
      await loadRecentMeals();
      setAnalysis(null);
      setSelectedImage(null);
      setImagePreview('');
      setUploadedImageUrl('');

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
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2"
                    >
                      <Camera className="h-4 w-4" />
                      Take Photo / Upload
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
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

          {/* Analysis Results */}
          {analysis && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Detected Items</CardTitle>
                  <CardDescription>
                    Confidence: {analysis.analysis.portion_confidence} | Total: {analysis.analysis.total_kcal} kcal
                  </CardDescription>
                </div>
                <Button
                  onClick={logMealToDB}
                  disabled={isLogging}
                  className="flex items-center gap-2"
                >
                  {isLogging ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Log Meal
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analysis.analysis.meal_notes && (
                    <Alert>
                      <AlertDescription>{analysis.analysis.meal_notes}</AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="space-y-3">
                    {analysis.analysis.dishes.map((dish, index) => (
                      <Card key={index} className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium">{dish.name}</h4>
                          <span className="text-sm font-medium">{dish.kcal} kcal</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">Portion: {dish.portion}</p>
                        <div className="grid grid-cols-3 gap-4 text-xs mb-2">
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
                      </Card>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Recent Meals */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Recent Meals
              </CardTitle>
              <CardDescription>Your last 5 logged meals</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                {recentMeals.length > 0 ? (
                  <div className="space-y-3">
                    {recentMeals.map((meal) => (
                      <Card key={meal.id} className="p-3">
                        <div className="flex items-start gap-3">
                          {meal.image_url && (
                            <img
                              src={meal.image_url}
                              alt={meal.dish_name}
                              className="w-12 h-12 object-cover rounded"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate">{meal.dish_name}</h4>
                            <p className="text-xs text-muted-foreground">{meal.kcal} kcal</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(meal.meal_time).toLocaleDateString('en-IN')} • {' '}
                              {new Date(meal.meal_time).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Camera className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No meals logged yet</p>
                    <p className="text-xs">Start by scanning your first meal!</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}