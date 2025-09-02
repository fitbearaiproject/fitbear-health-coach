import { Badge } from "@/components/ui/badge";

interface NutritionBadgesProps {
  dish: {
    kcal?: number;
    macros?: {
      protein_g?: number;
      carbs_g?: number;
      fat_g?: number;
      fiber_g?: number;
    };
    tags?: string[];
    portion?: {
      grams?: number;
    };
  };
}

export const NutritionBadges = ({ dish }: NutritionBadgesProps) => {
  const badges = [];
  const { kcal, macros, tags, portion } = dish;
  
  // High protein (>20g or >30% of calories from protein)
  if (macros?.protein_g && macros.protein_g >= 20) {
    badges.push({ text: "High Protein", variant: "default" as const });
  } else if (macros?.protein_g && kcal && (macros.protein_g * 4 / kcal) > 0.3) {
    badges.push({ text: "High Protein", variant: "default" as const });
  }

  // High fiber (>5g per serving)
  if (macros?.fiber_g && macros.fiber_g >= 5) {
    badges.push({ text: "High Fiber", variant: "secondary" as const });
  }

  // Low GI indicators (whole grains, legumes)
  if (tags?.some(tag => 
    tag.toLowerCase().includes('whole grain') || 
    tag.toLowerCase().includes('dal') ||
    tag.toLowerCase().includes('legume') ||
    tag.toLowerCase().includes('quinoa') ||
    tag.toLowerCase().includes('oats')
  )) {
    badges.push({ text: "Low GI", variant: "outline" as const });
  }

  // Iron rich (typically dal, spinach, meat)
  if (tags?.some(tag => 
    tag.toLowerCase().includes('dal') || 
    tag.toLowerCase().includes('spinach') ||
    tag.toLowerCase().includes('meat') ||
    tag.toLowerCase().includes('iron')
  )) {
    badges.push({ text: "Iron Rich", variant: "secondary" as const });
  }

  // Heart healthy (low saturated fat, high fiber)
  if (macros?.fiber_g && macros.fiber_g >= 3 && 
      (!macros?.fat_g || macros.fat_g <= 10)) {
    badges.push({ text: "Heart Healthy", variant: "outline" as const });
  }

  // Antioxidant rich (vegetables, fruits, colorful foods)
  if (tags?.some(tag => 
    tag.toLowerCase().includes('vegetable') ||
    tag.toLowerCase().includes('fruit') ||
    tag.toLowerCase().includes('berries') ||
    tag.toLowerCase().includes('colorful')
  )) {
    badges.push({ text: "Antioxidant Rich", variant: "secondary" as const });
  }

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {badges.map((badge, index) => (
        <Badge key={index} variant={badge.variant} className="text-xs">
          {badge.text}
        </Badge>
      ))}
    </div>
  );
};