import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: number;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration: number;
}

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

const emit = () => {
  listeners.forEach((l) => l([...toasts]));
};

const dismiss = (id: number) => {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
};

const push = (variant: ToastVariant, title: string, description?: string, duration = 5000) => {
  const id = nextId++;
  toasts = [...toasts, { id, variant, title, description, duration }];
  emit();
  if (duration > 0) {
    window.setTimeout(() => dismiss(id), duration);
  }
  return id;
};

// Global, framework-agnostic API: `toast.error("Failed to save team", err.message)`
// can be called from anywhere (components, hooks, services/storage.ts) without
// needing React context - fixes the pattern found across this app where a
// caught error only ever reached console.error and the user was never told
// anything went wrong.
export const toast = {
  success: (title: string, description?: string, duration?: number) => push('success', title, description, duration),
  error: (title: string, description?: string, duration?: number) => push('error', title, description, duration ?? 7000),
  warning: (title: string, description?: string, duration?: number) => push('warning', title, description, duration),
  info: (title: string, description?: string, duration?: number) => push('info', title, description, duration),
  dismiss,
};

const VARIANT_STYLES: Record<ToastVariant, { icon: React.ReactNode; accent: string }> = {
  success: { icon: <CheckCircle2 size={20} />, accent: 'border-l-emerald-400 text-emerald-400' },
  error: { icon: <XCircle size={20} />, accent: 'border-l-red-400 text-red-400' },
  warning: { icon: <AlertTriangle size={20} />, accent: 'border-l-amber-400 text-amber-400' },
  info: { icon: <Info size={20} />, accent: 'border-l-[#4D78FF] text-[#4D78FF]' },
};

// Mount this once near the app root (see App.tsx). Renders in a fixed
// top-right stack so it never blocks interaction, unlike the native
// alert()/confirm() dialogs this app used everywhere before.
export const ToastContainer: React.FC = () => {
  const [items, setItems] = useState<ToastItem[]>(toasts);

  useEffect(() => {
    listeners.add(setItems);
    return () => { listeners.delete(setItems); };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100000] flex flex-col gap-2 w-[min(360px,calc(100vw-2rem))] pointer-events-none">
      {items.map((t) => {
        const style = VARIANT_STYLES[t.variant];
        return (
          <div
            key={t.id}
            role="alert"
            className={`pointer-events-auto bg-[#16161a] border border-white/10 border-l-4 ${style.accent} rounded-xl shadow-2xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200`}
          >
            <span className="shrink-0 mt-0.5">{style.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white leading-snug">{t.title}</p>
              {t.description && (
                <p className="text-xs text-white/60 mt-1 leading-snug break-words">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-white/40 hover:text-white transition-colors -m-1 p-1"
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
