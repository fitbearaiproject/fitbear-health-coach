import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface HealthCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
  icon?: React.ReactNode
  variant?: "default" | "wellness" | "nutrition" | "energy" | "glass"
  children?: React.ReactNode
}

const HealthCard = React.forwardRef<HTMLDivElement, HealthCardProps>(
  ({ className, title, description, icon, variant = "default", children, ...props }, ref) => {
    const getVariantClasses = () => {
      switch (variant) {
        case "wellness":
          return "wellness-card border-primary/20 bg-gradient-to-br from-background to-primary/5"
        case "nutrition":
          return "wellness-card border-success/20 bg-gradient-to-br from-background to-success/5"
        case "energy":
          return "wellness-card border-secondary/20 bg-gradient-to-br from-background to-secondary/5"
        case "glass":
          return "glass border-white/20"
        default:
          return "wellness-card"
      }
    }

    return (
      <Card 
        ref={ref} 
        className={cn(
          getVariantClasses(),
          "transition-all duration-300 hover:shadow-lg hover:scale-[1.02]",
          className
        )} 
        {...props}
      >
        {(title || description || icon) && (
          <CardHeader className="pb-3">
            {title && (
              <CardTitle className={cn(
                "flex items-center gap-2",
                variant === "wellness" && "text-primary",
                variant === "nutrition" && "text-success",
                variant === "energy" && "text-secondary"
              )}>
                {icon}
                {title}
              </CardTitle>
            )}
            {description && (
              <CardDescription className="text-muted-foreground">
                {description}
              </CardDescription>
            )}
          </CardHeader>
        )}
        <CardContent className="pt-0">
          {children}
        </CardContent>
      </Card>
    )
  }
)
HealthCard.displayName = "HealthCard"

export { HealthCard }