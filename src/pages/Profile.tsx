import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { User, Heart, Activity, Target, Info, Loader2 } from 'lucide-react';
interface ProfileData {
  display_name?: string;
  gender?: string;
  age_years?: number;
  height_cm?: number;
  weight_kg?: number;
  diet_type?: string;
  activity_level?: string;
  health_goals?: string;
  conditions?: string[];
  allergies?: string[];
  cuisines?: string[];
  bps_notes?: string;
  sleep_hours?: number;
  stress_level?: string;
}
const DIET_TYPES = [{
  value: 'non_vegetarian',
  label: 'Non-Vegetarian'
}, {
  value: 'vegetarian',
  label: 'Vegetarian'
}, {
  value: 'vegan',
  label: 'Vegan'
}, {
  value: 'ovo_vegetarian',
  label: 'Ovo-Vegetarian'
}, {
  value: 'pescatarian',
  label: 'Pescatarian'
}];
const ACTIVITY_LEVELS = [{
  value: 'sedentary',
  label: 'Sedentary (little/no exercise)'
}, {
  value: 'lightly_active',
  label: 'Lightly Active (light exercise 1-3 days/week)'
}, {
  value: 'moderately_active',
  label: 'Moderately Active (moderate exercise 3-5 days/week)'
}, {
  value: 'very_active',
  label: 'Very Active (hard exercise 6-7 days/week)'
}, {
  value: 'extremely_active',
  label: 'Extremely Active (very hard exercise/training)'
}];
const STRESS_LEVELS = [{
  value: 'low',
  label: 'Low'
}, {
  value: 'moderate',
  label: 'Moderate'
}, {
  value: 'high',
  label: 'High'
}, {
  value: 'very_high',
  label: 'Very High'
}];
const COMMON_CONDITIONS = ['Diabetes Type 1', 'Diabetes Type 2', 'Hypertension', 'High Cholesterol', 'Thyroid Issues', 'PCOS', 'Heart Disease', 'Kidney Disease', 'Liver Disease', 'Arthritis', 'Osteoporosis', 'Asthma', 'Food Allergies', 'Digestive Issues', 'Anxiety', 'Depression'];
const COMMON_ALLERGIES = ['Nuts', 'Dairy', 'Gluten', 'Soy', 'Eggs', 'Shellfish', 'Fish', 'Sesame', 'Tomatoes', 'Onions', 'Garlic'];
const INDIAN_CUISINES = ['North Indian', 'South Indian', 'Bengali', 'Gujarati', 'Punjabi', 'Maharashtrian', 'Tamil', 'Kerala', 'Rajasthani', 'Hyderabadi', 'Street Food', 'Continental', 'Chinese', 'Italian'];
export default function Profile() {
  const [profile, setProfile] = useState<ProfileData>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();

  // Load profile data
  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);
  const loadProfile = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const {
        data,
        error
      } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      if (data) {
        setProfile({
          display_name: data.display_name || '',
          gender: data.gender || '',
          age_years: data.age_years || undefined,
          height_cm: data.height_cm || undefined,
          weight_kg: data.weight_kg || undefined,
          diet_type: data.diet || '',
          activity_level: data.activity_level || '',
          health_goals: data.health_goals || '',
          conditions: Array.isArray(data.conditions) ? data.conditions.filter(c => typeof c === 'string') as string[] : [],
          allergies: Array.isArray(data.allergies) ? data.allergies.filter(a => typeof a === 'string') as string[] : [],
          cuisines: Array.isArray(data.cuisines) ? data.cuisines.filter(c => typeof c === 'string') as string[] : [],
          bps_notes: data.bps_notes || '',
          sleep_hours: data.sleep_hours || undefined,
          stress_level: data.stress_level || ''
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load profile';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  const handleInputChange = (field: keyof ProfileData, value: any) => {
    setProfile(prev => ({
      ...prev,
      [field]: value
    }));
  };
  const handleArrayToggle = (field: 'conditions' | 'allergies' | 'cuisines', item: string) => {
    setProfile(prev => {
      const currentArray = prev[field] || [];
      const newArray = currentArray.includes(item) ? currentArray.filter(i => i !== item) : [...currentArray, item];
      return {
        ...prev,
        [field]: newArray
      };
    });
  };
  const saveProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    setError('');
    try {
      const profileData = {
        user_id: user.id,
        display_name: profile.display_name,
        gender: profile.gender,
        age_years: profile.age_years,
        height_cm: profile.height_cm,
        weight_kg: profile.weight_kg,
        diet: profile.diet_type as any,
        // Map to the correct field
        activity_level: profile.activity_level,
        health_goals: profile.health_goals,
        conditions: profile.conditions,
        allergies: profile.allergies,
        cuisines: profile.cuisines,
        bps_notes: profile.bps_notes,
        sleep_hours: profile.sleep_hours,
        stress_level: profile.stress_level
      };
      const {
        error
      } = await supabase.from('profiles').upsert(profileData);
      if (error) throw error;
      toast({
        title: "Profile saved!",
        description: "Your Body Profile System has been updated successfully."
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save profile';
      setError(errorMessage);
      toast({
        title: "Save failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };
  if (isLoading) {
    return <div className="container mx-auto p-6 max-w-4xl">
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your profile...</p>
        </div>
      </div>;
  }
  return <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">User Profile</h1>
        <p className="text-muted-foreground">
          Manage your health profile to get personalized recommendations from Coach C and scanners.
        </p>
      </div>

      {error && <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>}

      <div className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Basic Information
            </CardTitle>
            <CardDescription>
              Your basic demographic and physical information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="display_name">Display Name</Label>
                <Input id="display_name" value={profile.display_name || ''} onChange={e => handleInputChange('display_name', e.target.value)} placeholder="Your preferred name" />
              </div>
              <div>
                <Label htmlFor="gender">Gender</Label>
                <Select onValueChange={value => handleInputChange('gender', value)} value={profile.gender}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="age_years">Age (years)</Label>
                <Input id="age_years" type="number" value={profile.age_years || ''} onChange={e => handleInputChange('age_years', parseInt(e.target.value) || undefined)} placeholder="Enter your age" min="13" max="120" />
              </div>
              <div>
                <Label htmlFor="height_cm">Height (cm)</Label>
                <Input id="height_cm" type="number" value={profile.height_cm || ''} onChange={e => handleInputChange('height_cm', parseFloat(e.target.value) || undefined)} placeholder="Enter your height" min="100" max="250" step="0.1" />
              </div>
              <div>
                <Label htmlFor="weight_kg">Weight (kg)</Label>
                <Input id="weight_kg" type="number" value={profile.weight_kg || ''} onChange={e => handleInputChange('weight_kg', parseFloat(e.target.value) || undefined)} placeholder="Enter your weight" min="20" max="300" step="0.1" />
              </div>
              <div>
                <Label htmlFor="sleep_hours">Sleep Hours (per night)</Label>
                <Input id="sleep_hours" type="number" value={profile.sleep_hours || ''} onChange={e => handleInputChange('sleep_hours', parseFloat(e.target.value) || undefined)} placeholder="Average sleep hours" min="3" max="12" step="0.5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lifestyle Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Lifestyle & Activity
            </CardTitle>
            <CardDescription>
              Your dietary preferences and activity patterns
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="diet_type">Diet Type</Label>
                <Select onValueChange={value => handleInputChange('diet_type', value)} value={profile.diet_type}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your diet type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DIET_TYPES.map(diet => <SelectItem key={diet.value} value={diet.value}>
                        {diet.label}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="activity_level">Activity Level</Label>
                <Select onValueChange={value => handleInputChange('activity_level', value)} value={profile.activity_level}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your activity level" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_LEVELS.map(level => <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="stress_level">Stress Level</Label>
                <Select onValueChange={value => handleInputChange('stress_level', value)} value={profile.stress_level}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your stress level" />
                  </SelectTrigger>
                  <SelectContent>
                    {STRESS_LEVELS.map(level => <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="health_goals">Health Goals</Label>
                <Input id="health_goals" value={profile.health_goals || ''} onChange={e => handleInputChange('health_goals', e.target.value)} placeholder="e.g., Weight loss, Muscle gain, Better energy" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Health Conditions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-4 w-4" />
              Health Conditions
            </CardTitle>
            <CardDescription>
              Select any health conditions that may affect your nutrition needs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {COMMON_CONDITIONS.map(condition => <div key={condition} className="flex items-center space-x-2">
                  <Checkbox id={`condition-${condition}`} checked={(profile.conditions || []).includes(condition)} onCheckedChange={() => handleArrayToggle('conditions', condition)} />
                  <Label htmlFor={`condition-${condition}`} className="text-sm font-normal cursor-pointer">
                    {condition}
                  </Label>
                </div>)}
            </div>
            {(profile.conditions || []).length > 0 && <div className="mt-4">
                <p className="text-sm text-muted-foreground mb-2">Selected conditions:</p>
                <div className="flex flex-wrap gap-1">
                  {(profile.conditions || []).map(condition => <Badge key={condition} variant="secondary" className="text-xs">
                      {condition}
                    </Badge>)}
                </div>
              </div>}
          </CardContent>
        </Card>

        {/* Allergies & Food Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Food Allergies & Preferences</CardTitle>
            <CardDescription>
              Help us provide safer and more relevant food recommendations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-base font-medium">Allergies</Label>
              <p className="text-sm text-muted-foreground mb-3">Select foods you're allergic to</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {COMMON_ALLERGIES.map(allergy => <div key={allergy} className="flex items-center space-x-2">
                    <Checkbox id={`allergy-${allergy}`} checked={(profile.allergies || []).includes(allergy)} onCheckedChange={() => handleArrayToggle('allergies', allergy)} />
                    <Label htmlFor={`allergy-${allergy}`} className="text-sm font-normal cursor-pointer">
                      {allergy}
                    </Label>
                  </div>)}
              </div>
            </div>

            <Separator />

            <div>
              <Label className="text-base font-medium">Preferred Cuisines</Label>
              <p className="text-sm text-muted-foreground mb-3">Select your favorite types of food</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {INDIAN_CUISINES.map(cuisine => <div key={cuisine} className="flex items-center space-x-2">
                    <Checkbox id={`cuisine-${cuisine}`} checked={(profile.cuisines || []).includes(cuisine)} onCheckedChange={() => handleArrayToggle('cuisines', cuisine)} />
                    <Label htmlFor={`cuisine-${cuisine}`} className="text-sm font-normal cursor-pointer">
                      {cuisine}
                    </Label>
                  </div>)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              Additional Notes
            </CardTitle>
            <CardDescription>
              Any additional information that might help Coach C provide better recommendations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea value={profile.bps_notes || ''} onChange={e => handleInputChange('bps_notes', e.target.value)} placeholder="e.g., Recent surgery, medication side effects, specific dietary restrictions, fitness goals, etc." rows={4} />
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={saveProfile} disabled={isSaving} className="w-full md:w-auto">
            {isSaving ? <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving Profile...
              </> : <>
                <Target className="h-4 w-4 mr-2" />
                Save BPS Profile
              </>}
          </Button>
        </div>
      </div>
    </div>;
}