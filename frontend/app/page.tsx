import { HeroSection } from "@/components/landing/hero-section";
import { ProblemSection } from "@/components/landing/problem-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { MetricsSection } from "@/components/landing/metrics-section";
import { Footer } from "@/components/landing/footer";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background overflow-hidden">
      {/* Background ambient gradient */}
      <div 
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.15), transparent),
            radial-gradient(ellipse 60% 40% at 70% 10%, rgba(20, 184, 166, 0.08), transparent),
            radial-gradient(ellipse 50% 30% at 30% 20%, rgba(251, 191, 36, 0.05), transparent)
          `,
        }}
      />
      
      <HeroSection />
      <ProblemSection />
      <HowItWorksSection />
      <MetricsSection />
      <Footer />
    </main>
  );
}
