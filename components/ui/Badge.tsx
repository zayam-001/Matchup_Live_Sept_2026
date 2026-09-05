import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'brand' | 'outline' | 'live' | 'neutral' | 'warning' | 'success';
  className?: string;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant = 'default', 
  className = '',
  icon
}) => {
  const variants = {
    default: "bg-surface-elevated text-white border-white/10",
    brand: "bg-brand/10 text-brand border-brand/20",
    outline: "bg-transparent border-white/20 text-content-secondary",
    live: "bg-accent-live/10 text-accent-live border-accent-live/20 animate-pulse",
    neutral: "bg-surface-panel text-content-muted border-white/5",
    warning: "bg-accent-warning/10 text-accent-warning border-accent-warning/20",
    success: "bg-accent-success/10 text-accent-success border-accent-success/20",
  };

  return (
    <span className={`
      inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider border
      ${variants[variant]}
      ${className}
    `}>
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
};
