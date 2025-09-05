import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Camera, Utensils, Heart, Shield, Clock, Star, CheckCircle, Mic, Phone, MessageSquare } from "lucide-react";

interface LandingProps {
  onGetStarted: () => void;
}
export default function Landing({
  onGetStarted
}: LandingProps) {
  return <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/lovable-uploads/47ea420a-6f0b-4294-86c9-2a679f56730d.png" alt="FitBear AI logo" className="h-8 w-auto object-contain" />
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">FITBEAR AI</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={onGetStarted} className="bg-gradient-primary text-sm sm:text-base px-3 sm:px-4">
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 sm:py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center space-y-6 sm:space-y-8">
            <div className="flex items-center justify-center gap-3">
              <img src="/lovable-uploads/47ea420a-6f0b-4294-86c9-2a679f56730d.png" alt="FitBear AI logo" className="h-96 w-auto object-contain" />
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-6xl font-bold leading-tight">FitBear AI: Health and Nutrition powered by the The Fit Bear philosophy!</h2>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">Chat or speak with Coach C to get personal guidance on meals, workouts, and everyday choices—built for Indian food and routines but catering to a global audience.</p>
            <div className="flex flex-col gap-4 justify-center items-center pt-4">
              <Button size="lg" className="bg-gradient-primary px-8 sm:px-10 py-3 sm:py-4 text-base sm:text-lg" onClick={onGetStarted}>
                Get Started Free
              </Button>
              <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><Mic className="w-4 h-4" />Voice</div>
                <div className="flex items-center gap-2"><MessageCircle className="w-4 h-4" />Chat</div>
                <div className="flex items-center gap-2"><Camera className="w-4 h-4" />Photo</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pain → Promise → Proof */}
      <section className="py-16 sm:py-20 bg-muted/30">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="text-center space-y-4">
              <h3 className="text-lg sm:text-xl font-semibold text-destructive">The Problem</h3>
              <ul className="space-y-2 text-muted-foreground text-sm sm:text-base">
                <li>"Confusing diets."</li>
                <li>"Western apps don't get Indian food."</li>
                <li>"No time for gyms."</li>
              </ul>
            </div>
            <div className="text-center space-y-4">
              <h3 className="text-lg sm:text-xl font-semibold text-primary">Our Promise</h3>
              <p className="text-muted-foreground text-sm sm:text-base">
                "Daily guidance that fits your thali, your routine, your budget."
              </p>
            </div>
            <div className="text-center space-y-4">
              <h3 className="text-lg sm:text-xl font-semibold text-secondary">The Proof</h3>
              <div className="space-y-2">
                <p className="text-2xl font-bold text-primary">+19%</p>
                <p className="text-sm text-muted-foreground">
                  Avg. plan adherence in 14 days
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 sm:py-20">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">How it works</h2>
            <p className="text-lg sm:text-xl text-muted-foreground">Simple. Personal. Effective.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-lg sm:text-2xl font-bold text-primary-foreground">1</span>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold">Create Profile</h3>
              <p className="text-muted-foreground text-sm sm:text-base">Goals, health flags, Veg/Jain preferences, and your schedule.</p>
            </div>
            <div className="text-center space-y-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-lg sm:text-2xl font-bold text-primary-foreground">2</span>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold">Talk to Coach C</h3>
              <p className="text-muted-foreground text-sm sm:text-base">Text or voice chat to get Coach C to give you expert guidance.</p>
            </div>
            <div className="text-center space-y-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-lg sm:text-2xl font-bold text-primary-foreground">3</span>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold">Snap Your Meals</h3>
              <p className="text-muted-foreground text-sm sm:text-base">
                Instant macros analysis and real-time adjustments.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Outcomes */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">What you get</h2>
            <p className="text-xl text-muted-foreground">Features designed for real outcomes</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="p-6">
              <CardContent className="space-y-4">
                <Camera className="w-8 h-8 text-primary" />
                <h3 className="font-semibold">Meal photo analyzer</h3>
                <p className="text-sm text-muted-foreground">
                  So you know kcal, protein, fibre in seconds.
                </p>
              </CardContent>
            </Card>
            <Card className="p-6">
              <CardContent className="space-y-4">
                <Utensils className="w-8 h-8 text-primary" />
                <h3 className="font-semibold">Menu scanner</h3>
                <p className="text-sm text-muted-foreground">
                  So you order the best option at restaurants.
                </p>
              </CardContent>
            </Card>
            <Card className="p-6">
              <CardContent className="space-y-4">
                <Mic className="w-8 h-8 text-primary" />
                <h3 className="font-semibold">Coach C voice chat</h3>
                <p className="text-sm text-muted-foreground">
                  So you stay consistent on busy days.
                </p>
              </CardContent>
            </Card>
            <Card className="p-6">
              <CardContent className="space-y-4">
                <Heart className="w-8 h-8 text-primary" />
                <h3 className="font-semibold">Indian portion presets</h3>
                <p className="text-sm text-muted-foreground">
                  So plans match rotis/katori, not ounces.
                </p>
              </CardContent>
            </Card>
            <Card className="p-6">
              <CardContent className="space-y-4">
                <Shield className="w-8 h-8 text-primary" />
                <h3 className="font-semibold">Medical flags aware</h3>
                <p className="text-sm text-muted-foreground">
                  So plans respect BP, diabetes, thyroid.
                </p>
              </CardContent>
            </Card>
            <Card className="p-6">
              <CardContent className="space-y-4">
                <CheckCircle className="w-8 h-8 text-primary" />
                <h3 className="font-semibold">Habit nudges & check-ins</h3>
                <p className="text-sm text-muted-foreground">
                  So you actually follow through.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Interactive Proof */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Try it now</h2>
            <p className="text-xl text-muted-foreground">Experience the magic before you commit</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6 border-primary/20">
              <CardContent className="space-y-4">
                <Camera className="w-8 h-8 text-primary" />
                <h3 className="font-semibold">Live Demo</h3>
                <p className="text-sm text-muted-foreground">
                  Upload a sample plate → see macro breakdown
                </p>
                <Button variant="outline" className="w-full">Try Demo</Button>
              </CardContent>
            </Card>
            <Card className="p-6 border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5">
              <CardContent className="space-y-4">
                <Heart className="w-8 h-8 text-primary" />
                <h3 className="font-semibold">60-sec Health Checkup</h3>
                <p className="text-sm text-muted-foreground">Get calories, macros and portion guidance for your meals</p>
                <Button className="w-full bg-gradient-primary" onClick={onGetStarted}>
                  Start Checkup
                </Button>
              </CardContent>
            </Card>
            <Card className="p-6 border-primary/20">
              <CardContent className="space-y-4">
                <Utensils className="w-8 h-8 text-primary" />
                <h3 className="font-semibold">Restaurant Sandbox</h3>
                <p className="text-sm text-muted-foreground">
                  Paste a menu photo → get best picks
                </p>
                <Button variant="outline" className="w-full">Try Scanner</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Success stories</h2>
            <p className="text-xl text-muted-foreground">Real people, real results</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="p-6">
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-primary-foreground">RS</span>
                  </div>
                  <div>
                    <p className="font-semibold">Ravi Sharma</p>
                    <p className="text-sm text-muted-foreground">Mumbai</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  "Lost 5kg in 2 months while keeping my street food cravings satisfied. Coach C gets Indian food!"
                </p>
                <div className="flex text-yellow-500">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
                </div>
              </CardContent>
            </Card>
            
            <Card className="p-6 border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5">
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-primary-foreground">PK</span>
                  </div>
                  <div>
                    <p className="font-semibold">Priya Kapoor</p>
                    <p className="text-sm text-muted-foreground">Delhi</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  "Busy consultant, vegetarian; -3.2 kg in 28 days without giving up biryani. The voice chat kept me going!"
                </p>
                <div className="flex text-yellow-500">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
                </div>
                <Badge variant="secondary">Featured Case Study</Badge>
              </CardContent>
            </Card>
            
            <Card className="p-6">
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-primary-foreground">AS</span>
                  </div>
                  <div>
                    <p className="font-semibold">Amit Singh</p>
                    <p className="text-sm text-muted-foreground">Bangalore</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  "The meal scanner is magic! Finally know what I'm eating at office canteen. Perfect for my diabetes management."
                </p>
                <div className="flex text-yellow-500">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Plans & pricing</h2>
            <p className="text-xl text-muted-foreground">Start free, upgrade when ready</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6">
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold">Free</h3>
                  <p className="text-3xl font-bold">₹0<span className="text-sm font-normal text-muted-foreground">/month</span></p>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    Coach C chat (limited)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    Menu scanner (3 uses)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    1 plate/day analyzer
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    7-day starter plan
                  </li>
                </ul>
                <Button variant="outline" className="w-full" onClick={onGetStarted}>
                  Get Started
                </Button>
              </CardContent>
            </Card>
            
            <Card className="p-6 border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5 relative">
              <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-gradient-primary">
                Most Popular
              </Badge>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold">Plus</h3>
                  <p className="text-3xl font-bold">₹299<span className="text-sm font-normal text-muted-foreground">/month</span></p>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    Unlimited photo analysis
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    Weekly voice calls with Coach C
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    Habit tracking
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    All Free features
                  </li>
                </ul>
                <Button className="w-full bg-gradient-primary" onClick={onGetStarted}>
                  Start Plus
                </Button>
              </CardContent>
            </Card>
            
            <Card className="p-6">
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold">Family</h3>
                  <p className="text-3xl font-bold">₹499<span className="text-sm font-normal text-muted-foreground">/month</span></p>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    4 profiles
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    Kid-safe plans
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    Family meal coordination
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    All Plus features
                  </li>
                </ul>
                <Button variant="outline" className="w-full" onClick={onGetStarted}>
                  Start Family
                </Button>
              </CardContent>
            </Card>
          </div>
          
          <div className="text-center mt-8">
            <p className="text-sm text-muted-foreground">
              <Shield className="w-4 h-4 inline mr-1" />
              Cancel anytime. 7-day refund if not helpful.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Frequently asked questions</h2>
            <p className="text-xl text-muted-foreground">Everything you need to know</p>
          </div>
          
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="font-semibold mb-2">Will this work for vegetarians/Jains?</h3>
              <p className="text-muted-foreground">Absolutely! Coach C is specially designed for Indian dietary preferences including Jain, vegetarian, and vegan options.</p>
            </Card>
            
            <Card className="p-6">
              <h3 className="font-semibold mb-2">Can I use Hindi or Hinglish?</h3>
              <p className="text-muted-foreground">Yes! Coach C understands Hindi, English, and Hinglish. Speak naturally in your preferred language.</p>
            </Card>
            
            <Card className="p-6">
              <h3 className="font-semibold mb-2">Is it safe for diabetes/BP/thyroid?</h3>
              <p className="text-muted-foreground">Coach C considers your medical conditions and creates plans accordingly. However, always consult your doctor for medical advice.</p>
            </Card>
            
            <Card className="p-6">
              <h3 className="font-semibold mb-2">What if I eat out a lot?</h3>
              <p className="text-muted-foreground">Perfect! Our menu scanner helps you make the best choices at restaurants, and Coach C adapts your daily plan based on your meals.</p>
            </Card>
            
            <Card className="p-6">
              <h3 className="font-semibold mb-2">How accurate is photo analysis?</h3>
              <p className="text-muted-foreground">Our AI is trained specifically on Indian foods and portions. It recognizes rotis, rice, dals, sabzis, and calculates macros with high accuracy.</p>
            </Card>
            
            <Card className="p-6">
              <h3 className="font-semibold mb-2">Where is my data stored?</h3>
              <p className="text-muted-foreground">All data is stored securely in India with enterprise-grade encryption. We never sell your personal information.</p>
            </Card>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Get started on your health journey in under 60 seconds
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands who've transformed their health with Coach C
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-gradient-primary text-lg px-8 py-6" onClick={onGetStarted}>
              <Heart className="w-5 h-5 mr-2" />
              Start free health checkup
            </Button>
            <Button variant="outline" size="lg" className="px-6">
              <Phone className="w-5 h-5 mr-2" />
              WhatsApp fallback
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-white flex items-center justify-center">
                <img src="/lovable-uploads/47ea420a-6f0b-4294-86c9-2a679f56730d.png" alt="FitBear AI logo" className="w-6 h-6 object-contain" />
              </div>
              <span className="font-semibold gradient-text">Fitbear AI</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Not a substitute for medical advice. Consult your doctor for health concerns.
            </p>
          </div>
        </div>
      </footer>
    </div>;
}