export function Footer() {
  return (
    <footer 
      className="relative py-8 px-6"
      style={{
        borderTop: "1px solid rgba(255, 255, 255, 0.05)",
      }}
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-muted-foreground text-sm font-medium">
          Enterprise Training Scheduler
        </div>
        
        <a
          href="/app"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-indigo transition-colors duration-200"
        >
          Launch App
          <svg 
            className="w-4 h-4" 
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
    </footer>
  );
}
