import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Trash2, Target, Calculator } from "lucide-react";

const Settings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [targets, setTargets] = useState({
    calories_per_day: '',
    protein_g: '',
    fiber_g: '',
    sodium_mg: '',
    sugar_g: '',
    carbs_g: '',
    fat_g: ''
  });
  const [profile, setProfile] = useState<any>(null);
  const [autoCalculating, setAutoCalculating] = useState(false);

  useEffect(() => {
    if (user) {
      loadTargets();
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const calculateNutritionTargets = () => {
    if (!profile) return null;

    const { weight_kg, height_cm, age_years, gender, activity_level, health_goals } = profile;
    
    if (!weight_kg || !height_cm || !age_years || !gender) {
      toast({
        title: "Incomplete Profile",
        description: "Please complete your profile (weight, height, age, gender) to auto-calculate targets",
        variant: "destructive"
      });
      return null;
    }

    // Mifflin-St Jeor BMR calculation
    let bmr;
    if (gender === 'male') {
      bmr = (10 * weight_kg) + (6.25 * height_cm) - (5 * age_years) + 5;
    } else {
      bmr = (10 * weight_kg) + (6.25 * height_cm) - (5 * age_years) - 161;
    }

    // Activity multipliers
    const activityMultipliers = {
      sedentary: 1.2,
      lightly_active: 1.375,
      moderately_active: 1.55,
      very_active: 1.725,
      extra_active: 1.9
    };

    const multiplier = activityMultipliers[activity_level as keyof typeof activityMultipliers] || 1.2;
    let tdee = bmr * multiplier;

    // Adjust for health goals
    if (health_goals?.toLowerCase().includes('weight loss')) {
      tdee -= 300; // 300 cal deficit for gradual weight loss
    } else if (health_goals?.toLowerCase().includes('muscle gain')) {
      tdee += 200; // 200 cal surplus for muscle gain
    }

    // Macronutrient calculations
    const protein = Math.round(weight_kg * 1.8); // 1.8g per kg bodyweight
    const fat = Math.round((tdee * 0.25) / 9); // 25% of calories from fat
    const carbs = Math.round((tdee - (protein * 4) - (fat * 9)) / 4); // Remaining calories from carbs
    const fiber = Math.round(Math.max(25, weight_kg * 0.35)); // 25g minimum or 0.35g/kg
    const sodium = 2300; // Standard recommendation
    const sugar = Math.round(tdee * 0.1 / 4); // Max 10% of calories from added sugar

    return {
      calories_per_day: Math.round(tdee).toString(),
      protein_g: protein.toString(),
      carbs_g: carbs.toString(),
      fat_g: fat.toString(),
      fiber_g: fiber.toString(),
      sodium_mg: sodium.toString(),
      sugar_g: sugar.toString()
    };
  };

  const autoCalculateTargets = async () => {
    setAutoCalculating(true);
    const calculated = calculateNutritionTargets();
    
    if (calculated) {
      setTargets(calculated);
      toast({
        title: "Targets Calculated",
        description: "Nutrition targets auto-calculated based on your profile. You can adjust them if needed."
      });
    }
    setAutoCalculating(false);
  };

  const loadTargets = async () => {
    try {
      const { data, error } = await supabase
        .from('targets')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setTargets({
          calories_per_day: data.calories_per_day?.toString() || '',
          protein_g: data.protein_g?.toString() || '',
          fiber_g: data.fiber_g?.toString() || '',
          sodium_mg: data.sodium_mg?.toString() || '',
          sugar_g: data.sugar_g?.toString() || '',
          carbs_g: data.carbs_g?.toString() || '',
          fat_g: data.fat_g?.toString() || ''
        });
      }
    } catch (error) {
      console.error('Error loading targets:', error);
      toast({
        title: "Error",
        description: "Failed to load nutrition targets",
        variant: "destructive"
      });
    }
  };

  const saveTargets = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const targetsData = {
        user_id: user.id,
        calories_per_day: targets.calories_per_day ? parseInt(targets.calories_per_day) : null,
        protein_g: targets.protein_g ? parseInt(targets.protein_g) : null,
        fiber_g: targets.fiber_g ? parseInt(targets.fiber_g) : null,
        sodium_mg: targets.sodium_mg ? parseInt(targets.sodium_mg) : null,
        sugar_g: targets.sugar_g ? parseInt(targets.sugar_g) : null,
        carbs_g: targets.carbs_g ? parseInt(targets.carbs_g) : null,
        fat_g: targets.fat_g ? parseInt(targets.fat_g) : null
      };

      // Upsert without unique constraint: do manual insert/update
      const { data: existing, error: findError } = await supabase
        .from('targets')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (findError && findError.code !== 'PGRST116') throw findError;

      if (existing) {
        const { error: updError } = await supabase
          .from('targets')
          .update({
            calories_per_day: targetsData.calories_per_day,
            protein_g: targetsData.protein_g,
            fiber_g: targetsData.fiber_g,
            sodium_mg: targetsData.sodium_mg,
            sugar_g: targetsData.sugar_g,
            carbs_g: targetsData.carbs_g,
            fat_g: targetsData.fat_g,
            user_id: user.id
          })
          .eq('user_id', user.id);
        if (updError) throw updError;
      } else {
        const { error: insError } = await supabase
          .from('targets')
          .insert(targetsData);
        if (insError) throw insError;
      }

      toast({
        title: "Success",
        description: "Nutrition targets updated successfully"
      });
    } catch (error) {
      console.error('Error saving targets:', error);
      toast({
        title: "Error",
        description: "Failed to save nutrition targets",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteAccount = async () => {
    if (!user) return;
    
    setDeleting(true);
    try {
      // Delete user data first
      try {
        await Promise.all([
          supabase.from('meal_logs').delete().eq('user_id', user.id),
          supabase.from('chat_logs').delete().eq('user_id', user.id),
          supabase.from('targets').delete().eq('user_id', user.id),
          supabase.from('profiles').delete().eq('user_id', user.id),
          supabase.from('photos').delete().eq('user_id', user.id),
          supabase.from('ocr_results').delete().eq('user_id', user.id),
          supabase.from('nudges').delete().eq('user_id', user.id)
        ]);
      } catch (dataError) {
        console.warn('Error deleting user data:', dataError);
      }

      // Delete auth user (this will cascade to related data)
      const { error: authError } = await supabase.auth.admin.deleteUser(user.id);
      
      if (authError) {
        // If admin delete fails, try regular signOut
        await supabase.auth.signOut();
      }

      toast({
        title: "Account Deleted",
        description: "Your account and all data have been permanently deleted"
      });
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({
        title: "Error",
        description: "Failed to delete account. Please contact support.",
        variant: "destructive"
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setTargets(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="flex-1 p-6 max-w-4xl mx-auto">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage your nutrition targets and account preferences
          </p>
          <p className="text-xs text-muted-foreground mt-2 italic">
            Fit Bear uses Bio-Psycho-Social framework: we'll use your biological metrics + lifestyle patterns + habit-friendly nudges to personalize your targets.
          </p>
        </div>

        {/* Nutrition Targets */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Nutrition Targets
            </CardTitle>
            <CardDescription>
              Set your daily nutrition goals. These targets will be used to track your progress and provide personalized recommendations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-2 mb-4">
              <Button 
                onClick={autoCalculateTargets} 
                disabled={autoCalculating || !profile}
                variant="outline"
                size="sm"
              >
                {autoCalculating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <Calculator className="h-4 w-4 mr-2" />
                    Auto-Calculate
                  </>
                )}
              </Button>
              <span className="text-sm text-muted-foreground flex items-center">
                Based on your profile and health goals
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="calories">Daily Calories</Label>
                <Input
                  id="calories"
                  type="number"
                  placeholder="2000"
                  value={targets.calories_per_day}
                  onChange={(e) => handleInputChange('calories_per_day', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="protein">Protein (g)</Label>
                <Input
                  id="protein"
                  type="number"
                  placeholder="120"
                  value={targets.protein_g}
                  onChange={(e) => handleInputChange('protein_g', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="carbs">Carbohydrates (g)</Label>
                <Input
                  id="carbs"
                  type="number"
                  placeholder="250"
                  value={targets.carbs_g}
                  onChange={(e) => handleInputChange('carbs_g', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="fat">Fat (g)</Label>
                <Input
                  id="fat"
                  type="number"
                  placeholder="70"
                  value={targets.fat_g}
                  onChange={(e) => handleInputChange('fat_g', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="fiber">Fiber (g)</Label>
                <Input
                  id="fiber"
                  type="number"
                  placeholder="25"
                  value={targets.fiber_g}
                  onChange={(e) => handleInputChange('fiber_g', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="sodium">Sodium (mg)</Label>
                <Input
                  id="sodium"
                  type="number"
                  placeholder="2300"
                  value={targets.sodium_mg}
                  onChange={(e) => handleInputChange('sodium_mg', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="sugar">Sugar (g)</Label>
                <Input
                  id="sugar"
                  type="number"
                  placeholder="50"
                  value={targets.sugar_g}
                  onChange={(e) => handleInputChange('sugar_g', e.target.value)}
                />
              </div>
            </div>
            
            <Button 
              onClick={saveTargets} 
              disabled={loading}
              className="w-full md:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Targets'
              )}
            </Button>
          </CardContent>
        </Card>

        <Separator />

        {/* Danger Zone */}
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Permanently delete your account and all associated data. This action cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={deleting}>
                  {deleting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Account
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your account and remove all your data from our servers including:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>All meal logs and nutrition data</li>
                      <li>Chat history with Coach C</li>
                      <li>Profile information and preferences</li>
                      <li>Uploaded photos and scan results</li>
                      <li>Nutrition targets and settings</li>
                    </ul>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={deleteAccount}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, delete my account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;