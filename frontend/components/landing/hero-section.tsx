export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 py-24">
      <div className="max-w-4xl mx-auto text-center relative z-10">
        {/* Amorphous AI Blob */}
        <div className="flex justify-center mb-8 animate-fade-in-up">
          <div className="w-20 h-20 blob-entrance">
            <div className="w-full h-full blob-spin">
              <div className="w-full h-full blob-morph bg-gradient-to-br from-indigo via-indigo to-teal shadow-[0_8px_40px_rgba(99,102,241,0.4),0_4px_16px_rgba(20,184,166,0.25)]" />
            </div>
          </div>
        </div>

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
          This simulator demonstrates how Google&apos;s CP-SAT constraint solver can transform weeks of complex enterprise training planning into 30 seconds of pure mathematical optimisation.
        </p>

        {/* Proof of Concept Badge */}
        <div className="mt-6 animate-fade-in-up-delay-2">
          <span className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo bg-indigo/10 border border-indigo/20 rounded-full">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Proof of Concept Simulator
          </span>
        </div>

        {/* Explanation */}
        <p className="mt-6 text-sm text-muted max-w-xl mx-auto leading-relaxed animate-fade-in-up-delay-2">
          Using synthetic workforce data, this tool proves that constraint programming can solve complex scheduling problems — handling shift patterns, room capacities, and training requirements that would overwhelm traditional manual approaches.
        </p>

        {/* CTA Button */}
        <div className="mt-10 animate-fade-in-up-delay-3">
          <a
            href="/app"
            className="inline-flex items-center gap-2 px-8 py-4 text-lg font-semibold text-white rounded-full transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-indigo/25"
            style={{
              background: "linear-gradient(135deg, #6366F1 0%, #14B8A6 100%)",
            }}
          >
            Launch the Simulator
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
      </div>
    </section>
  );
}
