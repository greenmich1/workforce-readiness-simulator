const metrics = [
  {
    value: "30s",
    label: "Average solve time for 500 employees",
    color: "indigo",
  },
  {
    value: "100%",
    label: "Constraint satisfaction guaranteed",
    color: "teal",
  },
  {
    value: "70%+",
    label: "Typical reduction in training days",
    color: "indigo",
  },
  {
    value: "OR-Tools",
    label: "Powered by Google's industrial-grade solver",
    color: "teal",
  },
];

export function MetricsSection() {
  return (
    <section className="relative py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {metrics.map((metric, index) => (
            <div
              key={metric.label}
              className="group relative p-6 md:p-8 rounded-2xl backdrop-blur-xl text-center transition-all duration-300 hover:scale-[1.02]"
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                boxShadow: "0 4px 24px -4px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
              }}
            >
              {/* Subtle gradient overlay on hover */}
              <div 
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: metric.color === "indigo" 
                    ? "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, transparent 100%)"
                    : "linear-gradient(135deg, rgba(20, 184, 166, 0.08) 0%, transparent 100%)",
                }}
              />

              <div className="relative z-10">
                <div 
                  className={`text-3xl md:text-4xl font-bold mb-3 ${
                    metric.color === "indigo" ? "text-indigo" : "text-teal"
                  }`}
                >
                  {metric.value}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
                  {metric.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
