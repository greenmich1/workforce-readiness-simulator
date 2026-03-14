const steps = [
  {
    number: "01",
    title: "Configure",
    description: "Set workforce size, shift patterns, classroom capacity, and training window to model your enterprise scenario.",
    gradient: "from-indigo to-indigo/60",
  },
  {
    number: "02",
    title: "Generate",
    description: "The simulator creates synthetic workforce data — employees, courses, and constraints — representing real scheduling complexity.",
    gradient: "from-indigo/60 to-teal/60",
  },
  {
    number: "03",
    title: "Optimise",
    description: "Google's CP-SAT solver mathematically minimises fragmentation, respects all constraints, and schedules the workforce in under 30 seconds.",
    gradient: "from-teal/60 to-teal",
  },
];

export function HowItWorksSection() {
  return (
    <section className="relative py-24 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            How it works
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            See how constraint programming handles complex scheduling problems
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connecting line (desktop only) */}
          <div 
            className="hidden md:block absolute top-12 left-1/6 right-1/6 h-px"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.3), rgba(20, 184, 166, 0.3), transparent)",
            }}
          />

          {steps.map((step, index) => (
            <div 
              key={step.number}
              className="relative text-center"
            >
              {/* Step number with gradient ring */}
              <div className="relative inline-flex mb-6">
                <div 
                  className="w-24 h-24 rounded-full flex items-center justify-center relative z-10"
                  style={{
                    background: "rgba(10, 10, 15, 0.8)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                  }}
                >
                  <span className={`text-3xl font-bold bg-gradient-to-r ${step.gradient} bg-clip-text text-transparent`}>
                    {step.number}
                  </span>
                </div>
                {/* Glow effect */}
                <div 
                  className="absolute inset-0 rounded-full blur-xl opacity-30"
                  style={{
                    background: index === 0 
                      ? "rgba(99, 102, 241, 0.4)" 
                      : index === 2 
                        ? "rgba(20, 184, 166, 0.4)"
                        : "linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(20, 184, 166, 0.3))",
                  }}
                />
              </div>

              <h3 className="text-xl font-semibold text-foreground mb-3">
                {step.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed max-w-xs mx-auto text-pretty">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
