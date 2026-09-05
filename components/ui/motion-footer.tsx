"use client";

import * as React from "react";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cn } from "@/lib/utils";
import { Download, Smartphone } from "lucide-react";
import { SocialTooltip } from "./social-media";

// Register ScrollTrigger safely for React
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// -------------------------------------------------------------------------
// 1. THEME-ADAPTIVE INLINE STYLES (MATCH UP THEME)
// -------------------------------------------------------------------------
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap');

.cinematic-footer-wrapper {
  font-family: 'Poppins', sans-serif;
  -webkit-font-smoothing: antialiased;
  
  /* Match Up Brand Variables */
  --foreground: #FFFFFF;
  --background: #0A0A0A;
  --primary: #4D78FF; /* Match Up Primary Blue */
  --secondary: #E65C31; /* Match Up Accent Orange */
  --destructive: #E65C31;
  
  --pill-bg-1: rgba(255, 255, 255, 0.03);
  --pill-bg-2: rgba(255, 255, 255, 0.01);
  --pill-shadow: rgba(10, 10, 10, 0.5);
  --pill-highlight: rgba(255, 255, 255, 0.1);
  --pill-inset-shadow: rgba(10, 10, 10, 0.8);
  --pill-border: rgba(255, 255, 255, 0.08);
  
  --pill-bg-1-hover: rgba(255, 255, 255, 0.08);
  --pill-bg-2-hover: rgba(255, 255, 255, 0.02);
  --pill-border-hover: rgba(255, 255, 255, 0.2);
  --pill-shadow-hover: rgba(10, 10, 10, 0.7);
  --pill-highlight-hover: rgba(255, 255, 255, 0.2);
}

@keyframes footer-breathe {
  0% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
  100% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
}

@keyframes footer-scroll-marquee {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

@keyframes footer-heartbeat {
  0%, 100% { transform: scale(1); filter: drop-shadow(0 0 5px rgba(230, 92, 49, 0.5)); }
  15%, 45% { transform: scale(1.2); filter: drop-shadow(0 0 10px rgba(230, 92, 49, 0.8)); }
  30% { transform: scale(1); }
}

.animate-footer-breathe {
  animation: footer-breathe 8s ease-in-out infinite alternate;
}

.animate-footer-scroll-marquee {
  animation: footer-scroll-marquee 40s linear infinite;
}

.animate-footer-heartbeat {
  animation: footer-heartbeat 2s cubic-bezier(0.25, 1, 0.5, 1) infinite;
}

/* Theme-adaptive Grid Background */
.footer-bg-grid {
  background-size: 60px 60px;
  background-image: 
    linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px);
  mask-image: linear-gradient(to bottom, transparent, black 30%, black 70%, transparent);
  -webkit-mask-image: linear-gradient(to bottom, transparent, black 30%, black 70%, transparent);
}

/* Theme-adaptive Aurora Glow - Match Up Theme */
.footer-aurora {
  background: radial-gradient(
    circle at 50% 50%, 
    rgba(77, 120, 255, 0.15) 0%, 
    rgba(230, 92, 49, 0.08) 40%, 
    transparent 70%
  );
}

/* Glass Pill Theming */
.footer-glass-pill {
  background: linear-gradient(145deg, var(--pill-bg-1) 0%, var(--pill-bg-2) 100%);
  box-shadow: 
      0 10px 30px -10px var(--pill-shadow), 
      inset 0 1px 1px var(--pill-highlight), 
      inset 0 -1px 2px var(--pill-inset-shadow);
  border: 1px solid var(--pill-border);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.footer-glass-pill:hover {
  background: linear-gradient(145deg, var(--pill-bg-1-hover) 0%, var(--pill-bg-2-hover) 100%);
  border-color: var(--pill-border-hover);
  box-shadow: 
      0 20px 40px -10px var(--pill-shadow-hover), 
      inset 0 1px 1px var(--pill-highlight-hover);
  color: var(--foreground);
}

/* Giant Background Text Masking */
.footer-giant-bg-text {
  font-size: 26vw;
  line-height: 0.75;
  font-weight: 900;
  letter-spacing: -0.05em;
  color: transparent;
  -webkit-text-stroke: 1px rgba(255, 255, 255, 0.05);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, transparent 60%);
  -webkit-background-clip: text;
  background-clip: text;
}

/* Metallic Text Glow */
.footer-text-glow {
  background: linear-gradient(180deg, #FFFFFF 0%, rgba(255, 255, 255, 0.4) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0px 0px 20px rgba(255, 255, 255, 0.15));
}
`;

// -------------------------------------------------------------------------
// 2. MAGNETIC BUTTON PRIMITIVE
// -------------------------------------------------------------------------
export type MagneticButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & 
  React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    as?: React.ElementType;
  };

const MagneticButton = React.forwardRef<HTMLElement, MagneticButtonProps>(
  ({ className, children, as: Component = "button", ...props }, forwardedRef) => {
    const localRef = useRef<HTMLElement>(null);

    useEffect(() => {
      if (typeof window === "undefined") return;
      const element = localRef.current;
      if (!element) return;

      const ctx = gsap.context(() => {
        const handleMouseMove = (e: MouseEvent) => {
          const rect = element.getBoundingClientRect();
          const h = rect.width / 2;
          const w = rect.height / 2;
          const x = e.clientX - rect.left - h;
          const y = e.clientY - rect.top - w;

          gsap.to(element, {
            x: x * 0.4,
            y: y * 0.4,
            rotationX: -y * 0.15,
            rotationY: x * 0.15,
            scale: 1.05,
            ease: "power2.out",
            duration: 0.4,
          });
        };

        const handleMouseLeave = () => {
          gsap.to(element, {
            x: 0,
            y: 0,
            rotationX: 0,
            rotationY: 0,
            scale: 1,
            ease: "elastic.out(1, 0.3)",
            duration: 1.2,
          });
        };

        element.addEventListener("mousemove", handleMouseMove as any);
        element.addEventListener("mouseleave", handleMouseLeave);

        return () => {
          element.removeEventListener("mousemove", handleMouseMove as any);
          element.removeEventListener("mouseleave", handleMouseLeave);
        };
      }, element);

      return () => ctx.revert();
    },[]);

    const Comp = Component as any;
    return (
      <Comp
        ref={(node: HTMLElement) => {
          (localRef as any).current = node;
          if (typeof forwardedRef === "function") forwardedRef(node);
          else if (forwardedRef) (forwardedRef as any).current = node;
        }}
        className={cn("cursor-pointer", className)}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);
MagneticButton.displayName = "MagneticButton";

// -------------------------------------------------------------------------
// 3. MAIN COMPONENT
// -------------------------------------------------------------------------
const MarqueeItem = () => (
  <div className="flex items-center space-x-12 px-6">
    <span>Real-Time Scoring</span> <span className="text-[#4D78FF]">✦</span>
    <span>Live Leaderboards</span> <span className="text-[#E65C31]">✦</span>
    <span>Pro Bracket Management</span> <span className="text-[#4D78FF]">✦</span>
    <span>Team Rosters & Stats</span> <span className="text-[#E65C31]">✦</span>
    <span>Absolute Glory</span> <span className="text-[#4D78FF]">✦</span>
  </div>
);

export function CinematicFooter() {
  const scrollToTop = () => {
    const container = document.getElementById("main-scroll-container");
    if (container) {
      container.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <footer className="relative w-full bg-[#050505] text-white cinematic-footer-wrapper border-t border-white/5 overflow-hidden">
        {/* Ambient Light */}
        <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] blur-[120px] pointer-events-none z-0 opacity-40 bg-[radial-gradient(circle_at_50%_50%,_rgba(77,120,255,0.15)_0%,_rgba(230,92,49,0.08)_40%,_transparent_70%)]" />
        <div className="footer-bg-grid absolute inset-0 z-0 pointer-events-none opacity-50" />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-20 pb-12 flex flex-col gap-20">
          
          <div className="flex flex-col lg:flex-row justify-between gap-16 lg:gap-8">
            
            {/* Left: Contact Form */}
            <div className="w-full lg:w-[45%] flex flex-col">
              <div className="bg-[#111111]/80 backdrop-blur-md border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-2 h-8 bg-[#E65C31] rounded-full"></div>
                  <div>
                    <h3 className="text-[#E65C31] text-[10px] font-black uppercase tracking-[0.2em] leading-none mb-1">Get in Touch</h3>
                    <h2 className="text-2xl font-bold text-white leading-none">Ready to Compete?</h2>
                  </div>
                </div>
                
                <p className="text-gray-400 text-sm mb-8 leading-relaxed">
                  Start your own league, manage your padel club, or drop us a message to learn how Match Up can elevate your next tournament.
                </p>
                
                <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); alert('Message sent!'); }}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input 
                      type="text" 
                      placeholder="Full Name" 
                      className="w-full bg-[#0A0A0A] border border-white/5 rounded-xl px-4 py-3.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#4D78FF] focus:bg-[#111] transition-all text-sm"
                      required
                    />
                    <input 
                      type="email" 
                      placeholder="Email Address" 
                      className="w-full bg-[#0A0A0A] border border-white/5 rounded-xl px-4 py-3.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#4D78FF] focus:bg-[#111] transition-all text-sm"
                      required
                    />
                  </div>
                  <textarea 
                    placeholder="Tell us about your event..." 
                    rows={3}
                    className="w-full bg-[#0A0A0A] border border-white/5 rounded-xl px-4 py-3.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#4D78FF] focus:bg-[#111] transition-all text-sm resize-none"
                    required
                  ></textarea>
                  <button 
                    type="submit" 
                    className="w-full bg-white hover:bg-gray-200 text-black font-bold py-4 rounded-xl transition-colors shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] text-sm tracking-wide uppercase mt-2"
                  >
                    Send Message
                  </button>
                </form>
              </div>
            </div>

            {/* Right: Branding & Links */}
            <div className="w-full lg:w-[45%] flex flex-col justify-end">
              <h2 className="text-5xl sm:text-7xl font-black footer-text-glow tracking-tighter mb-4 uppercase leading-[0.85]">
                Match Up<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4D78FF] to-[#E65C31]">Platform</span>
              </h2>
              <p className="text-gray-400 max-w-sm mb-10 text-sm leading-relaxed">
                Pakistan's premium padel tournament infrastructure. Real-time scoring, live brackets, and professional team management.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <MagneticButton as="a" href="#" className="footer-glass-pill px-8 py-4 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-3 group">
                  <Download className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                  App Store
                </MagneticButton>
                <MagneticButton as="a" href="#" className="footer-glass-pill px-8 py-4 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-3 group">
                  <Smartphone className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                  Google Play
                </MagneticButton>
              </div>

              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#4D78FF]">Follow Us</span>
                  <div className="h-px bg-white/10 flex-1" />
                </div>
                <SocialTooltip items={[
                  {
                    href: "https://www.instagram.com/matchupsport?igsh=MXBxbXo5NGpjNG0zcA==",
                    ariaLabel: "Instagram",
                    tooltip: "Instagram",
                    color: "#E1306C",
                    svgUrl: "https://svgl.app/library/instagram.svg",
                  },
                  {
                    href: "https://www.facebook.com/share/1DsDdPkkCd/?mibextid=wwXIfr",
                    ariaLabel: "Facebook",
                    tooltip: "Facebook",
                    color: "#3b5998",
                    svgUrl: "https://svgl.app/library/facebook.svg",
                  },
                ]} />
              </div>

            </div>
          </div>
          
          <div className="w-full h-px bg-white/10" />

          {/* Credits & Legal */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-4">
            <div className="flex items-center gap-6 text-gray-500 text-xs font-medium">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">Organizers</a>
            </div>

            <div className="text-gray-600 text-[10px] md:text-xs font-semibold tracking-widest uppercase text-center">
              © {new Date().getFullYear()} Match Up. All rights reserved.
            </div>

            <button
              onClick={scrollToTop}
              className="w-10 h-10 rounded-full bg-[#111] border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#222] transition-colors group"
            >
              <svg className="w-4 h-4 transform group-hover:-translate-y-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path>
              </svg>
            </button>
          </div>

        </div>
      </footer>
    </>
  );
}
