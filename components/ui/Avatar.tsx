import React from 'react';
import { User } from 'lucide-react';

interface AvatarProps {
  src?: string;
  fallback: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ src, fallback, size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-24 h-24 text-xl'
  };

  const fallbackText = fallback || '?';

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-surface-elevated border border-white/10 flex items-center justify-center overflow-hidden shrink-0 ${className}`}>
      {src ? (
        <img src={src} alt={fallbackText} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <span className="font-bold text-content-secondary flex items-center justify-center w-full h-full bg-surface-elevated">
            {fallbackText.substring(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  );
};
