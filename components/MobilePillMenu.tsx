import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";

const ease = [0.22, 1, 0.36, 1] as const;

interface MenuItem {
  label: string;
  onClick?: () => void;
  href?: string;
}

interface FloatingMenuProps {
  items: MenuItem[];
}

function MenuButton({
  label,
  onClick,
  href,
  isOpen,
  index,
}: MenuItem & {
  isOpen: boolean;
  index: number;
}) {
  const [hovered, setHovered] = useState(false);
  const animatingRef = useRef(false);
  const pendingLeaveRef = useRef(false);
  const chars = label.split("");
  const lockDuration = 30 * chars.length + 300;

  const handleEnter = useCallback(() => {
    pendingLeaveRef.current = false;
    if (hovered) return;
    setHovered(true);
    animatingRef.current = true;
    setTimeout(() => {
      animatingRef.current = false;
      if (pendingLeaveRef.current) {
        pendingLeaveRef.current = false;
        setHovered(false);
      }
    }, lockDuration);
  }, [hovered, lockDuration]);

  const handleLeave = useCallback(() => {
    if (animatingRef.current) {
      pendingLeaveRef.current = true;
    } else {
      setHovered(false);
    }
  }, []);

  const Component = href ? "a" : "button";

  return (
    <motion.div
      className="text-white text-[24px] sm:text-[28px] uppercase leading-none overflow-hidden w-full"
      style={{
        fontFamily: "'Space Grotesk', 'Outfit', sans-serif",
        letterSpacing: "-0.02em",
        height: "1em",
        fontWeight: 700,
        display: "block",
        cursor: "pointer"
      }}
      animate={{ opacity: isOpen ? 1 : 0 }}
      transition={{
        duration: 0.4,
        delay: isOpen ? 0.3 + 0.05 * index : 0,
        ease,
      }}
    >
      <Component
        onClick={onClick}
        href={href}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className="flex justify-center w-full no-underline text-white hover:text-white"
        style={{ display: "flex", justifyContent: "center" }}
      >
        {chars.map((char, i) => (
          <span
            key={i}
            className="inline-block overflow-hidden"
            style={{ height: "1em" }}
          >
            <span
              className="flex flex-col"
              style={{
                transitionProperty: "transform",
                transitionDuration: hovered ? "800ms" : "0ms",
                transitionDelay: hovered ? `${30 * i}ms` : "0ms",
                transform: hovered ? "translateY(-50%)" : "translateY(0%)",
                transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              <span
                className="block"
                style={{ height: "1em", lineHeight: "1em", minWidth: char === " " ? "0.3em" : "auto" }}
              >
                {char}
              </span>
              <span
                className="block text-[#030e43]"
                style={{ height: "1em", lineHeight: "1em", minWidth: char === " " ? "0.3em" : "auto" }}
                aria-hidden
              >
                {char}
              </span>
            </span>
          </span>
        ))}
      </Component>
    </motion.div>
  );
}

export function MobilePillMenu({ items }: FloatingMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);
  
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <div className="relative z-[10000]" style={{ width: 44, height: 44 }} ref={containerRef}>
      <motion.div
        className="absolute top-0 right-0 overflow-hidden flex flex-col"
        style={{
          fontFamily: "'Space Grotesk', 'Inter', sans-serif",
          cursor: isOpen ? "default" : "pointer",
          transformOrigin: "top right",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)"
        }}
        animate={{
          width: isOpen ? 280 : 44,
          height: isOpen ? 380 : 44,
          borderRadius: isOpen ? 24 : 22,
        }}
        whileHover={isOpen ? undefined : { scale: 1.05 }}
        transition={{
          duration: 0.8,
          ease,
          height: { duration: isOpen ? 0.8 : 0.4, ease },
          width: { duration: isOpen ? 0.8 : 0.4, ease },
          scale: { duration: 0.25, ease }
        }}
      >
        {/* Background layer */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{
            backgroundColor: isOpen ? "#E55C30" : "rgba(3, 14, 67, 0.6)",
            borderColor: isOpen ? "#E55C30" : "rgba(255, 255, 255, 0.1)",
          }}
          transition={{ duration: isOpen ? 0.2 : 0.4, ease }}
          style={{
            borderWidth: 1,
            borderStyle: "solid",
            borderRadius: "inherit",
            backdropFilter: isOpen ? "none" : "blur(12px)",
            WebkitBackdropFilter: isOpen ? "none" : "blur(12px)",
          }}
        />

        {/* Dark circle expanding to reveal hover effects */}
        <motion.div
          className="absolute pointer-events-none"
          style={{
            width: "200%",
            height: "200%",
            borderRadius: "50%",
            right: "-50%",
            top: "-50%",
            backgroundColor: "#020D45",
          }}
          animate={{ top: isOpen ? "-20%" : "-200%" }}
          transition={{
            duration: 0.8,
            ease,
            delay: isOpen ? 0.1 : 0,
          }}
        />

        {/* Top bar: hamburger on the left when opened */}
        <motion.div
          className="relative z-10 flex items-center shrink-0 cursor-pointer w-full"
          onClick={() => setIsOpen(!isOpen)}
          animate={{
            paddingLeft: isOpen ? 24 : 0,
            paddingRight: isOpen ? 24 : 0,
            justifyContent: isOpen ? "flex-start" : "center",
            height: 44,
            marginTop: isOpen ? 12 : 0,
          }}
          transition={{ duration: 0.8, ease }}
        >
          <div className="relative w-[24px] h-[24px] flex items-center justify-center">
            <motion.span
              className="absolute block h-[2px] rounded-full"
              animate={{
                width: isOpen ? 20 : 18,
                rotate: isOpen ? 45 : 0,
                y: isOpen ? 0 : -3,
                backgroundColor: "#fff",
              }}
              transition={{ duration: 0.4, ease }}
            />
            <motion.span
              className="absolute block h-[2px] rounded-full"
              animate={{
                width: isOpen ? 20 : 18,
                rotate: isOpen ? -45 : 0,
                y: isOpen ? 0 : 3,
                backgroundColor: "#fff",
              }}
              transition={{ duration: 0.4, ease }}
            />
          </div>
        </motion.div>

        {/* Menu items */}
        <div
          className="relative z-10 flex flex-col gap-6 items-center justify-center flex-1 w-full"
          style={{
            pointerEvents: isOpen ? "auto" : "none",
            opacity: isOpen ? 1 : 0,
            overflow: "hidden",
            paddingBottom: isOpen ? 24 : 0,
          }}
        >
          {items.map((item, idx) => (
            <MenuButton
              key={item.label}
              label={item.label}
              href={item.href}
              onClick={() => {
                if (item.onClick) item.onClick();
                setIsOpen(false);
              }}
              isOpen={isOpen}
              index={idx}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
