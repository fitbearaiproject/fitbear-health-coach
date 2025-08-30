import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Upload, Camera, Loader2, ThumbsUp, AlertTriangle, X, Plus } from 'lucide-react';

interface DishItem {
  name: string;
  portion: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  tags: string[];
  reasoning: string;
}

interface MenuAnalysis {
  top_picks: DishItem[];
  alternates: DishItem[];
  to_avoid: DishItem[];
  general_notes: string;
  parsing_error?: boolean;
}

interface AnalysisResult {
  request_id: string;
  analysis: MenuAnalysis;
  model: string;
  latency_ms: number;
  user_context: string;
}

export default function MenuScanner() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string>('');
  const [isLogging, setIsLogging] = useState<{ [key: string]: boolean }>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleImageSelect = (file: File) => {
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setError('Image size must be less than 10MB');
      return;
    }

    setSelectedImage(file);
    setError('');
    setAnalysis(null);

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

  const analyzeMenu = async () => {
    if (!selectedImage || !user) return;

    setIsAnalyzing(true);
    setError('');

    try {
      const base64Image = await convertToBase64(selectedImage);

      const { data, error: supabaseError } = await supabase.functions.invoke('menu-parse', {
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
        title: "Menu analyzed successfully!",
        description: "Check out your personalized recommendations below.",
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

  const logDishToMeals = async (dish: DishItem, category: string) => {
    if (!user) return;

    const dishKey = `${dish.name}-${category}`;
    setIsLogging(prev => ({ ...prev, [dishKey]: true }));

    try {
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
          notes: `${category} - ${dish.reasoning}`,
          source: 'menu',
          meal_time: new Date().toISOString(),
          meal_day_ist: new Date().toISOString().split('T')[0]
        });

      if (error) throw error;

      toast({
        title: "Dish logged!",
        description: `${dish.name} has been added to your meal log.`,
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to log dish';
      toast({
        title: "Logging failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLogging(prev => ({ ...prev, [dishKey]: false }));
    }
  };

  const DishCard = ({ dish, category, icon }: { dish: DishItem; category: string; icon: React.ReactNode }) => {
    const dishKey = `${dish.name}-${category}`;
    const isLoggingThis = isLogging[dishKey];

    return (
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {icon}
              <CardTitle className="text-lg">{dish.name}</CardTitle>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => logDishToMeals(dish, category)}
              disabled={isLoggingThis}
              className="flex items-center gap-1"
            >
              {isLoggingThis ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
              Log this
            </Button>
          </div>
          <CardDescription>{dish.reasoning}</CardDescription>
        </CardHeader>
        <CardContent>
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
            {!selectedImage ? (
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Choose Image
                </Button>
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
                    alt="Menu preview"
                    className="max-w-full h-auto max-h-64 rounded-lg border"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedImage(null);
                      setImagePreview('');
                      setAnalysis(null);
                    }}
                    className="absolute top-2 right-2"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  onClick={analyzeMenu}
                  disabled={isAnalyzing}
                  className="w-full sm:w-auto"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Analyzing Menu...
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4 mr-2" />
                      Analyze Menu
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
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Analysis Results */}
      {analysis && (
        <div className="space-y-6">
          {analysis.analysis.general_notes && (
            <Alert>
              <AlertDescription>{analysis.analysis.general_notes}</AlertDescription>
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
                    No dishes to avoid identified.
                  </p>
                )}
              </ScrollArea>
            </div>
          </div>

          {/* Analysis Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Analysis Details</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              <p>Model: {analysis.model} | Latency: {analysis.latency_ms}ms | Request ID: {analysis.request_id}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}