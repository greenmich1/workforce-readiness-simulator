export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 py-24">
      <div className="max-w-4xl mx-auto text-center relative z-10">
        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground leading-tight animate-fade-in-up text-balance">
          Stop Scheduling Training Manually.
          <br />
          <span className="bg-gradient-to-r from-indigo to-teal bg-clip-text text-transparent">
            Let Mathematics Do It.
          </span>
        </h1>

        {/* Subheadline */}
        <p className="mt-8 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed animate-fade-in-up-delay-1 text-pretty">
          Enterprise Training Scheduler uses Google&apos;s CP-SAT constraint solver to turn weeks of complex planning into 30 seconds of pure optimisation.
        </p>

        {/* CTA Button */}
        <div className="mt-12 animate-fade-in-up-delay-2">
          <a
            href="/app"
            className="inline-flex items-center gap-2 px-8 py-4 text-lg font-semibold text-white rounded-full transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-indigo/25"
            style={{
              background: "linear-gradient(135deg, #6366F1 0%, #14B8A6 100%)",
            }}
          >
            Launch the Scheduler
            <svg 
              className="w-5 h-5" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M13 7l5 5m0 0l-5 5m5-5H6" 
              />
            </svg>
          </a>
        </div>

        {/* Subtle scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-pulse-glow">
          <svg 
            className="w-6 h-6 text-muted" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M19 14l-7 7m0 0l-7-7m7 7V3" 
            />
          </svg>
        </div>
      </div>
    </section>
  );
}
