export default function LandingPage() {
  return (
    <main className="h-screen w-screen overflow-hidden bg-[#030308] relative">
      {/* Fixed deep space background with aurora gradients */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-[#8B5CF6]/5 via-transparent to-transparent" />
        <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-gradient-to-tl from-[#EC4899]/5 via-[#06B6D4]/3 to-transparent" />
      </div>

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] z-0"
        style={{
          backgroundImage: `linear-gradient(#ffffff80 1px, transparent 1px), linear-gradient(90deg, #ffffff80 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#8B5CF6]/20 blur-[100px] rounded-full z-0" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#06B6D4]/15 blur-[100px] rounded-full z-0" />

      {/* Main content - single viewport */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-6 animate-fade-in">
        {/* Amorphous AI Blob */}
        <div className="mb-8 animate-scale-in">
          <div className="blob-spin" style={{ width: 80, height: 80 }}>
            <div
              className="blob-morph"
              style={{
                width: "100%",
                height: "100%",
                background:
                  "linear-gradient(135deg, #8B5CF6 0%, #06B6D4 50%, #EC4899 100%)",
                boxShadow:
                  "0 8px 40px rgba(139, 92, 246, 0.4), 0 4px 16px rgba(6, 182, 212, 0.25)",
                borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%",
              }}
            />
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-center leading-tight text-balance max-w-4xl animate-slide-up">
          <span className="text-white">Stop Scheduling Manually.</span>
          <br />
          <span className="bg-gradient-to-r from-[#8B5CF6] via-[#06B6D4] to-[#EC4899] bg-clip-text text-transparent">
            Let Mathematics Do It.
          </span>
        </h1>

        {/* Subheadline - simplified */}
        <p className="mt-6 text-lg sm:text-xl text-white/50 max-w-xl mx-auto text-center leading-relaxed text-pretty animate-slide-up animation-delay-100">
          Transform weeks of complex training planning into seconds using
          constraint-based optimisation.
        </p>

        {/* Badge */}
        <div className="mt-6 animate-slide-up animation-delay-200">
          <span className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-[0.3em] text-white/60 bg-white/10 border border-white/10 rounded-full backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
            Proof of Concept
          </span>
        </div>

        {/* CTA Button */}
        <div className="mt-10 animate-slide-up animation-delay-300">
          <a
            href="/app"
            className="group inline-flex items-center gap-3 px-8 py-4 text-lg font-semibold text-white rounded-full border border-white/20 transition-all duration-300 hover:scale-105 hover:border-[#8B5CF6]/50 hover:bg-[#8B5CF6]/10 hover:shadow-lg hover:shadow-[#8B5CF6]/20"
          >
            Launch the Simulator
            <svg
              className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
          </a>
        </div>

        {/* Footer line */}
        <div className="absolute bottom-8 left-0 right-0 text-center animate-fade-in animation-delay-400">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/40">
            Powered by Google CP-SAT
          </p>
        </div>
      </div>
    </main>
  );
}
