"use client"

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { ArrowRight, Zap, Shield, TrendingDown } from "lucide-react"

// Custom Cursor Component (from portfolio)
function CustomCursor() {
  const cursorX = useMotionValue(-100)
  const cursorY = useMotionValue(-100)
  const cursorXSpring = useSpring(cursorX, { stiffness: 500, damping: 28 })
  const cursorYSpring = useSpring(cursorY, { stiffness: 500, damping: 28 })
  
  const [isHovering, setIsHovering] = useState(false)

  useEffect(() => {
    const moveCursor = (e: MouseEvent) => {
      cursorX.set(e.clientX)
      cursorY.set(e.clientY)
    }

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('a, button, [data-cursor-hover]')) {
        setIsHovering(true)
      }
    }

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('a, button, [data-cursor-hover]')) {
        setIsHovering(false)
      }
    }

    window.addEventListener('mousemove', moveCursor)
    window.addEventListener('mouseover', handleMouseOver)
    window.addEventListener('mouseout', handleMouseOut)

    return () => {
      window.removeEventListener('mousemove', moveCursor)
      window.removeEventListener('mouseover', handleMouseOver)
      window.removeEventListener('mouseout', handleMouseOut)
    }
  }, [cursorX, cursorY])

  return (
    <>
      {/* Main cursor dot */}
      <motion.div
        className="fixed top-0 left-0 w-4 h-4 rounded-full bg-gradient-to-r from-violet to-cyan pointer-events-none z-[9999] mix-blend-difference hidden md:block"
        style={{
          x: cursorXSpring,
          y: cursorYSpring,
          translateX: '-50%',
          translateY: '-50%',
        }}
        animate={{
          scale: isHovering ? 0.5 : 1,
        }}
        transition={{ duration: 0.15 }}
      />
      {/* Cursor ring */}
      <motion.div
        className="fixed top-0 left-0 w-10 h-10 rounded-full pointer-events-none z-[9999] hidden md:flex items-center justify-center"
        style={{
          x: cursorXSpring,
          y: cursorYSpring,
          translateX: '-50%',
          translateY: '-50%',
          border: '1px solid #ffffff4d',
        }}
        animate={{
          scale: isHovering ? 1.5 : 1,
          borderColor: isHovering ? '#8B5CF680' : '#ffffff4d',
        }}
        transition={{ duration: 0.3 }}
      />
    </>
  )
}

// Parallax Star Component
function Star({ 
  star, 
  index, 
  smoothMouseX, 
  smoothMouseY 
}: { 
  star: { x: string; y: string; size: number; brightness: number; depth: number; twinkleSpeed: number }
  index: number
  smoothMouseX: ReturnType<typeof useSpring>
  smoothMouseY: ReturnType<typeof useSpring>
}) {
  const starMoveX = useTransform(smoothMouseX, [-0.5, 0.5], [-40 * star.depth * 10, 40 * star.depth * 10])
  const starMoveY = useTransform(smoothMouseY, [-0.5, 0.5], [-40 * star.depth * 10, 40 * star.depth * 10])
  
  const glowOpacityHex = Math.round(star.brightness * 0.15 * 255).toString(16).padStart(2, '0')
  const shadowOpacityHex = Math.round(star.brightness * 0.8 * 255).toString(16).padStart(2, '0')
  
  return (
    <motion.div
      className="absolute"
      style={{
        left: star.x,
        top: star.y,
        x: starMoveX,
        y: starMoveY,
      }}
    >
      <motion.div
        className="absolute rounded-full"
        style={{
          width: star.size * 3,
          height: star.size * 3,
          left: -star.size,
          top: -star.size,
          background: `radial-gradient(circle, #ffffff${glowOpacityHex} 0%, transparent 70%)`,
        }}
        animate={{
          scale: [1, 1.3, 1],
          opacity: [star.brightness * 0.3, star.brightness * 0.5, star.brightness * 0.3],
        }}
        transition={{
          duration: star.twinkleSpeed * 1.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: index * 0.1,
        }}
      />
      <motion.div
        className="rounded-full"
        style={{
          width: star.size,
          height: star.size,
          backgroundColor: '#FFFFFF',
          boxShadow: `0 0 ${star.size * 2}px #ffffff${shadowOpacityHex}`,
        }}
        animate={{
          opacity: [star.brightness * 0.5, star.brightness, star.brightness * 0.6, star.brightness * 0.9, star.brightness * 0.5],
          scale: [1, 1.2, 0.95, 1.15, 1],
        }}
        transition={{
          duration: star.twinkleSpeed,
          repeat: Infinity,
          ease: "easeInOut",
          delay: index * 0.15,
        }}
      />
    </motion.div>
  )
}

// Parallax Background
function ParallaxBackground() {
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  
  const smoothMouseX = useSpring(mouseX, { stiffness: 50, damping: 20 })
  const smoothMouseY = useSpring(mouseY, { stiffness: 50, damping: 20 })

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e
      const { innerWidth, innerHeight } = window
      mouseX.set((clientX - innerWidth / 2) / innerWidth)
      mouseY.set((clientY - innerHeight / 2) / innerHeight)
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [mouseX, mouseY])

  const stars = [
    // Southern Cross constellation
    { x: '38%', y: '25%', size: 8, brightness: 0.95, depth: 0.25, twinkleSpeed: 2.5 },
    { x: '38%', y: '45%', size: 10, brightness: 1, depth: 0.25, twinkleSpeed: 2 },
    { x: '32%', y: '35%', size: 5, brightness: 0.8, depth: 0.26, twinkleSpeed: 3 },
    { x: '44%', y: '35%', size: 7, brightness: 0.9, depth: 0.24, twinkleSpeed: 2.8 },
    // Pointers
    { x: '58%', y: '32%', size: 9, brightness: 0.98, depth: 0.28, twinkleSpeed: 2.2 },
    { x: '66%', y: '28%', size: 7, brightness: 0.88, depth: 0.29, twinkleSpeed: 2.6 },
    // Scattered stars
    { x: '15%', y: '20%', size: 4, brightness: 0.45, depth: 0.32, twinkleSpeed: 4 },
    { x: '82%', y: '22%', size: 8, brightness: 0.95, depth: 0.22, twinkleSpeed: 2.3 },
    { x: '75%', y: '55%', size: 5, brightness: 0.55, depth: 0.3, twinkleSpeed: 3.5 },
    { x: '20%', y: '65%', size: 4, brightness: 0.4, depth: 0.35, twinkleSpeed: 4.5 },
    { x: '88%', y: '68%', size: 4, brightness: 0.48, depth: 0.32, twinkleSpeed: 3.8 },
    { x: '10%', y: '45%', size: 3, brightness: 0.35, depth: 0.38, twinkleSpeed: 5 },
    { x: '92%', y: '42%', size: 3, brightness: 0.3, depth: 0.36, twinkleSpeed: 5 },
    { x: '50%', y: '75%', size: 2, brightness: 0.2, depth: 0.45, twinkleSpeed: 6 },
  ]

  const bgMoveX = useTransform(smoothMouseX, [-0.5, 0.5], [-20, 20])
  const bgMoveY = useTransform(smoothMouseY, [-0.5, 0.5], [-20, 20])

  return (
    <div className="fixed inset-0 z-0 overflow-hidden">
      {/* Deep space background */}
      <div className="absolute inset-0 bg-background" />
      
      {/* Aurora gradient overlays */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-violet/5 via-transparent to-transparent" />
      <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-gradient-to-tl from-pink/5 via-cyan/3 to-transparent" />
      
      {/* Atmospheric glow */}
      <motion.div
        className="absolute inset-0 opacity-40"
        style={{
          x: bgMoveX,
          y: bgMoveY,
        }}
      >
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-violet/20 blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-cyan/15 blur-[100px]" />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 rounded-full bg-pink/10 blur-[80px]" />
      </motion.div>

      {/* Stars with parallax */}
      {stars.map((star, index) => (
        <Star 
          key={`star-${index}`} 
          star={star} 
          index={index} 
          smoothMouseX={smoothMouseX} 
          smoothMouseY={smoothMouseY} 
        />
      ))}

      {/* Noise texture overlay */}
      <div 
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Grid overlay */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(#ffffff80 1px, transparent 1px),
            linear-gradient(90deg, #ffffff80 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px'
        }}
      />
    </div>
  )
}

// Metric Card Component
function MetricCard({ 
  value, 
  label, 
  color, 
  delay 
}: { 
  value: string
  label: string
  color: "violet" | "cyan"
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay }}
      className="text-center"
    >
      <div className={`text-2xl md:text-3xl font-bold mb-1 ${color === "violet" ? "text-violet" : "text-cyan"}`}>
        {value}
      </div>
      <p className="text-xs text-white/50 leading-tight">
        {label}
      </p>
    </motion.div>
  )
}

// Feature Pill Component
function FeaturePill({ 
  icon, 
  text, 
  delay 
}: { 
  icon: React.ReactNode
  text: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay }}
      className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm"
    >
      <span className="text-violet">{icon}</span>
      <span className="text-sm text-white/70">{text}</span>
    </motion.div>
  )
}

export default function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div 
      ref={containerRef}
      className="relative min-h-screen h-screen overflow-hidden cursor-none md:cursor-none"
    >
      <CustomCursor />
      <ParallaxBackground />

      {/* Main Content - Single Viewport */}
      <main className="relative z-10 h-screen flex flex-col justify-center items-center px-6">
        <div className="max-w-4xl mx-auto text-center">
          
          {/* Status Badge */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
              <motion.span 
                className="w-2 h-2 rounded-full bg-gradient-to-r from-violet to-cyan"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="text-xs font-medium text-white/60 uppercase tracking-wider">
                Proof of Concept
              </span>
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1] mb-6 text-balance"
          >
            <span className="text-white">Enterprise Training.</span>
            <br />
            <span className="bg-gradient-to-r from-violet via-cyan to-pink bg-clip-text text-transparent">
              Mathematically Optimised.
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed mb-8 text-pretty"
          >
            Google&apos;s CP-SAT solver transforms weeks of complex scheduling into 
            30 seconds of pure optimisation. Handles shifts, rooms, and constraints 
            that spreadsheets never could.
          </motion.p>

          {/* Feature Pills */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap justify-center gap-3 mb-10"
          >
            <FeaturePill 
              icon={<Zap className="w-4 h-4" />}
              text="30s Solve Time"
              delay={0.35}
            />
            <FeaturePill 
              icon={<Shield className="w-4 h-4" />}
              text="100% Constraint Satisfaction"
              delay={0.4}
            />
            <FeaturePill 
              icon={<TrendingDown className="w-4 h-4" />}
              text="70%+ Fewer Training Days"
              delay={0.45}
            />
          </motion.div>

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <motion.a
              href="/app"
              data-cursor-hover
              className="inline-flex items-center gap-3 px-8 py-4 text-lg font-semibold text-white rounded-full transition-all duration-300"
              style={{
                background: "linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)",
                boxShadow: "0 0 40px rgba(139, 92, 246, 0.3), 0 0 80px rgba(6, 182, 212, 0.2)",
              }}
              whileHover={{ 
                scale: 1.05,
                boxShadow: "0 0 60px rgba(139, 92, 246, 0.5), 0 0 100px rgba(6, 182, 212, 0.3)",
              }}
              whileTap={{ scale: 0.98 }}
            >
              Launch the Simulator
              <ArrowRight className="w-5 h-5" />
            </motion.a>
          </motion.div>

          {/* Metrics Row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-12 pt-8 border-t border-white/5"
          >
            <div className="grid grid-cols-3 gap-6 max-w-lg mx-auto">
              <MetricCard 
                value="500+" 
                label="Employees Scheduled" 
                color="violet" 
                delay={0.65}
              />
              <MetricCard 
                value="OR-Tools" 
                label="Google Solver" 
                color="cyan" 
                delay={0.7}
              />
              <MetricCard 
                value="Real-time" 
                label="Visualisation" 
                color="violet" 
                delay={0.75}
              />
            </div>
          </motion.div>
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="absolute bottom-6 left-0 right-0 flex justify-center"
        >
          <p className="text-white/30 text-xs tracking-wider">
            Mathematical Optimisation for Workforce Training
          </p>
        </motion.div>
      </main>
    </div>
  )
}
