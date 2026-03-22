"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="h-screen w-screen overflow-hidden bg-background relative">
      {/* Fixed deep space background with aurora gradients */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[#030308]" />
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
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-6">
        {/* Amorphous AI Blob */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
          className="mb-8"
        >
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
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-center leading-tight text-balance max-w-4xl"
        >
          <span className="text-white">Stop Scheduling Manually.</span>
          <br />
          <span className="bg-gradient-to-r from-[#8B5CF6] via-[#06B6D4] to-[#EC4899] bg-clip-text text-transparent">
            Let Mathematics Do It.
          </span>
        </motion.h1>

        {/* Subheadline - simplified */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-6 text-lg sm:text-xl text-white/50 max-w-xl mx-auto text-center leading-relaxed text-pretty"
        >
          Transform weeks of complex training planning into seconds using
          constraint-based optimisation.
        </motion.p>

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-6"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-[0.3em] text-white/60 bg-white/10 border border-white/10 rounded-full backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse-dot" />
            Proof of Concept
          </span>
        </motion.div>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-10"
        >
          <a
            href="/app"
            className="group inline-flex items-center gap-3 px-8 py-4 text-lg font-semibold text-white rounded-full border border-white/20 transition-all duration-300 hover:scale-105 hover:border-[#8B5CF6]/50 hover:bg-[#8B5CF6]/10 hover:shadow-lg hover:shadow-[#8B5CF6]/20"
          >
            Launch the Simulator
            <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
          </a>
        </motion.div>

        {/* Footer line */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="absolute bottom-8 left-0 right-0 text-center"
        >
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/40">
            Powered by Google CP-SAT
          </p>
        </motion.div>
      </div>
    </main>
  );
}
