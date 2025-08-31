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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ImageProcessor, ScannerDiagnostics, MenuScanRequest } from '@/lib/imageProcessor';
import { Upload, Camera, Loader2, ThumbsUp, AlertTriangle, X, Plus, Info } from 'lucide-react';

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
  tags: string[];
  reasoning: string;
}

interface MenuAnalysis {
  top_picks: DishItem[];
  alternates: DishItem[];
  to_avoid: DishItem[];
  general_notes: string;
  overall_note?: string;
  parsing_error?: boolean;
}

interface AnalysisResult {
  request_id: string;
  analysis: MenuAnalysis;
  model: string;
  latency_ms: number;
  user_context: string;
  images_processed: number;
}

interface SelectedDish {
  dish: DishItem;
  category: string;
  portion: string;
  quantity: number;
}

export default function MenuScanner() {
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string>('');
  const [isLogging, setIsLogging] = useState(false);
  const [diagnostics, setDiagnostics] = useState<ScannerDiagnostics | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [selectedDishes, setSelectedDishes] = useState<{ [key: string]: SelectedDish }>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Load user profile and targets
  useEffect(() => {
    const loadProfile = async () => {
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
    
    loadProfile();
  }, [user]);

  const handleImageSelect = (files: FileList) => {
    const fileArray = Array.from(files);
    
    // Limit to 5 images
    if (fileArray.length > 5) {
      setError('Maximum 5 images allowed');
      return;
    }

    // Check file sizes
    const oversizedFiles = fileArray.filter(file => file.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      setError('All images must be less than 10MB');
      return;
    }

    setSelectedImages(fileArray);
    setError('');
    setAnalysis(null);
    setSelectedDishes({});

    // Create previews
    const previews: string[] = [];
    fileArray.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        previews[index] = e.target?.result as string;
        if (previews.length === fileArray.length) {
          setImagePreviews([...previews]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleImageSelect(files);
    }
  };

  const removeImage = (index: number) => {
    const newImages = selectedImages.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    setSelectedImages(newImages);
    setImagePreviews(newPreviews);
    if (newImages.length === 0) {
      setAnalysis(null);
      setSelectedDishes({});
    }
  };

  const analyzeMenu = async () => {
    if (selectedImages.length === 0 || !user || !userProfile) return;

    setIsAnalyzing(true);
    setError('');
    setDiagnostics(null);

    try {
      // Process first image only for now (can be extended for multiple)
      const { signedUrl, originalSize, processedSize } = await ImageProcessor.processAndUpload(selectedImages[0]);
      
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

      const requestData: MenuScanRequest = {
        image_url: signedUrl,
        bps_profile,
        targets
      };

      console.log('Sending menu scan request:', { originalSize, processedSize });

      const { data, error: supabaseError } = await supabase.functions.invoke('menu-parse', {
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
        title: "Menu analyzed successfully!",
        description: `Analyzed menu in ${data.latency_ms}ms. Check out your personalized recommendations below.`,
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze menu';
      setError(errorMessage);
      toast({
        title: "Analysis failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDishSelection = (dish: DishItem, category: string, checked: boolean) => {
    const dishKey = `${dish.name}-${category}`;
    
    if (checked) {
      setSelectedDishes(prev => ({
        ...prev,
        [dishKey]: {
          dish,
          category,
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
        const { dish, category, quantity } = selectedDish;
        
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
            notes: `${category} - ${dish.coach_note}`,
            source: 'menu',
            meal_time: mealTime
          });


        if (error) throw error;
      }

      toast({
        title: "Dishes logged!",
        description: `Successfully logged ${Object.keys(selectedDishes).length} dishes to your meal diary.`,
      });

      setSelectedDishes({});

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to log dishes';
      toast({
        title: "Logging failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLogging(false);
    }
  };

  const DishCard = ({ dish, category, icon }: { dish: DishItem; category: string; icon: React.ReactNode }) => {
    const dishKey = `${dish.name}-${category}`;
    const isSelected = dishKey in selectedDishes;
    const selectedDish = selectedDishes[dishKey];

    return (
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Checkbox 
                checked={isSelected}
                onCheckedChange={(checked) => handleDishSelection(dish, category, checked as boolean)}
              />
              {icon}
              <CardTitle className="text-lg">{dish.name}</CardTitle>
            </div>
          </div>
          {dish.description && (
            <CardDescription className="mt-2">{dish.description}</CardDescription>
          )}
          {dish.coach_note && (
            <div className="flex items-start gap-2 mt-2 p-2 bg-blue-50 rounded-md">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-700 italic">{dish.coach_note}</p>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isSelected && (
            <div className="mb-4 p-3 bg-gray-50 rounded-md space-y-3">
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
          
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <p className="text-sm text-muted-foreground">Portion</p>
              <p className="font-medium">{dish.portion}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Calories</p>
              <p className="font-medium">{dish.kcal} kcal</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Protein</p>
              <p className="font-medium">{dish.protein_g}g</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Carbs</p>
              <p className="font-medium">{dish.carbs_g}g</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fat</p>
              <p className="font-medium">{dish.fat_g}g</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fiber</p>
              <p className="font-medium">{dish.fiber_g}g</p>
            </div>
          </div>
          {dish.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {dish.tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Menu Scanner</h1>
        <p className="text-muted-foreground">
          Upload a restaurant menu to get personalized recommendations based on your health profile.
        </p>
      </div>

      {/* Upload Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Upload Menu Image</CardTitle>
          <CardDescription>
            Take a photo or upload an image of the restaurant menu
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {selectedImages.length === 0 ? (
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Choose Images (Max 5)
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="relative">
                      <img
                        src={preview}
                        alt={`Menu preview ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                      <Badge 
                        variant="secondary" 
                        className="absolute bottom-1 left-1 text-xs"
                      >
                        {index + 1}
                      </Badge>
                    </div>
                  ))}
                  {selectedImages.length < 5 && (
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-32 border-dashed flex flex-col items-center gap-2"
                    >
                      <Upload className="h-6 w-6" />
                      <span className="text-sm">Add More</span>
                    </Button>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {selectedImages.length} of 5 images selected
                  </p>
                  <Button
                    onClick={analyzeMenu}
                    disabled={isAnalyzing}
                    className="flex items-center gap-2"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyzing {selectedImages.length} image{selectedImages.length > 1 ? 's' : ''}...
                      </>
                    ) : (
                      <>
                        <Camera className="h-4 w-4" />
                        Analyze Menu ({selectedImages.length} image{selectedImages.length > 1 ? 's' : ''})
                      </>
                    )}
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Selected Dishes Summary */}
      {Object.keys(selectedDishes).length > 0 && (
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Selected Dishes ({Object.keys(selectedDishes).length})</CardTitle>
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
              Log Selected Dishes
            </Button>
          </CardHeader>
        </Card>
      )}

      {/* Analysis Results */}
      {analysis && (
        <div className="space-y-6">
          {(analysis.analysis.general_notes || analysis.analysis.overall_note) && (
            <Alert>
              <AlertDescription>
                {analysis.analysis.overall_note || analysis.analysis.general_notes}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Picks */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <ThumbsUp className="h-5 w-5 text-green-600" />
                <h2 className="text-xl font-bold text-green-600">Top Picks</h2>
              </div>
              <ScrollArea className="h-96">
                {analysis.analysis.top_picks.map((dish, index) => (
                  <DishCard 
                    key={index} 
                    dish={dish} 
                    category="Top Pick"
                    icon={<ThumbsUp className="h-4 w-4 text-green-600" />}
                  />
                ))}
                {analysis.analysis.top_picks.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">
                    No top picks identified in this menu.
                  </p>
                )}
              </ScrollArea>
            </div>

            {/* Alternates */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <h2 className="text-xl font-bold text-yellow-600">Alternates</h2>
              </div>
              <ScrollArea className="h-96">
                {analysis.analysis.alternates.map((dish, index) => (
                  <DishCard 
                    key={index} 
                    dish={dish} 
                    category="Alternate"
                    icon={<AlertTriangle className="h-4 w-4 text-yellow-600" />}
                  />
                ))}
                {analysis.analysis.alternates.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">
                    No alternate options identified.
                  </p>
                )}
              </ScrollArea>
            </div>

            {/* To Avoid */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <X className="h-5 w-5 text-red-600" />
                <h2 className="text-xl font-bold text-red-600">To Avoid</h2>
              </div>
              <ScrollArea className="h-96">
                {analysis.analysis.to_avoid.map((dish, index) => (
                  <DishCard 
                    key={index} 
                    dish={dish} 
                    category="To Avoid"
                    icon={<X className="h-4 w-4 text-red-600" />}
                  />
                ))}
                {analysis.analysis.to_avoid.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">
                    No items to avoid identified.
                  </p>
                )}
              </ScrollArea>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostics */}
      {diagnostics && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Scan Diagnostics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Request ID</p>
                <p className="font-mono text-xs">{diagnostics.request_id}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Latency</p>
                <p className="font-medium">{diagnostics.latency_ms}ms</p>
              </div>
              <div>
                <p className="text-muted-foreground">Model</p>
                <p className="font-medium">{diagnostics.model}</p>
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
  );
}