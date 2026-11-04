import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { MatchupLogo } from "./MatchupLogo";
import "./mobileMenu.css";

const ease = [0.22, 1, 0.36, 1] as const;

interface MenuItem {
  label: string;
  onClick?: () => void;
  href?: string;
  /** Shown as a button in the footer instead of a big link. */
  variant?: "primary" | "ghost";
}

interface FloatingMenuProps {
  items: MenuItem[];
}

/** Full-screen menu for phones: big numbered links, actions pinned to the bottom. */
export function MobilePillMenu({ items }: FloatingMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsOpen(false); };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      openerRef.current?.focus();
    };
  }, [isOpen]);

  // Close first so the page can scroll again, then run the item's action.
  const choose = (e: React.MouseEvent, item: MenuItem) => {
    if (item.href?.startsWith("#")) e.preventDefault();
    setIsOpen(false);
    requestAnimationFrame(() => {
      if (item.onClick) item.onClick();
      else if (item.href?.startsWith("#")) {
        document.getElementById(item.href.slice(1))?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      }
    });
  };

  const links = items.filter(i => !i.variant);
  const actions = items.filter(i => i.variant);

  return (
    <>
      <button ref={openerRef} type="button" className="mm-toggle" aria-label="Open menu" aria-expanded={isOpen} onClick={() => setIsOpen(true)}>
        <span /><span /><span />
      </button>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              className="mm"
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              initial={reduce ? { opacity: 0 } : { clipPath: "circle(0% at calc(100% - 40px) 40px)" }}
              animate={reduce ? { opacity: 1 } : { clipPath: "circle(150% at calc(100% - 40px) 40px)" }}
              exit={reduce ? { opacity: 0 } : { clipPath: "circle(0% at calc(100% - 40px) 40px)" }}
              transition={{ duration: reduce ? 0.15 : 0.6, ease }}
            >
              <div className="mm__glow" aria-hidden="true" />
              <div className="mm__bar">
                <a className="mm__logo" href="#top" onClick={e => choose(e, { label: "Home", href: "#top" })} aria-label="Match Up home">
                  <MatchupLogo className="h-6 w-auto" />
                </a>
                <button ref={closeRef} type="button" className="mm__close" aria-label="Close menu" onClick={() => setIsOpen(false)}>
                  <span /><span />
                </button>
              </div>

              <nav className="mm__links" aria-label="Main">
                {links.map((item, i) => {
                  const Tag = item.href ? "a" : "button";
                  return (
                    <motion.div
                      key={item.label}
                      initial={reduce ? false : { opacity: 0, y: 28 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: reduce ? 0 : 0.18 + i * 0.05, ease }}
                    >
                      <Tag className="mm__link" href={item.href} type={item.href ? undefined : "button"} onClick={(e: React.MouseEvent) => choose(e, item)}>
                        <small>{String(i + 1).padStart(2, "0")}</small>
                        <span>{item.label}</span>
                        <ArrowUpRight size={22} aria-hidden="true" />
                      </Tag>
                    </motion.div>
                  );
                })}
              </nav>

              {actions.length > 0 && (
                <motion.div
                  className="mm__actions"
                  initial={reduce ? false : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: reduce ? 0 : 0.2 + links.length * 0.05, ease }}
                >
                  {actions.map(item => (
                    <button key={item.label} type="button" className={`mm__btn mm__btn--${item.variant}`} onClick={e => choose(e, item)}>
                      {item.label}{item.variant === "primary" && " →"}
                    </button>
                  ))}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
