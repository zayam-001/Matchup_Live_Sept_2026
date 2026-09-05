import React from 'react';

interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'glass' | 'panel';
  className?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  variant = 'default', 
  className = '',
  onClick
}) => {
  const variants = {
    default: "bg-card-dark border-primary/10 shadow-xl",
    elevated: "bg-surface-dark border-primary/20 shadow-2xl",
    glass: "glass-panel shadow-lg",
    panel: "bg-surface-dark border-primary/10 shadow-md",
  };

  return (
    <div 
      onClick={onClick}
      className={`
        rounded-2xl border p-6 transition-all duration-300
        ${variants[variant]}
        ${onClick ? 'cursor-pointer hover:border-primary hover:shadow-primary/10 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};
