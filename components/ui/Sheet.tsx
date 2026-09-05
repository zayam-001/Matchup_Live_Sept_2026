import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full';
}

export const Sheet: React.FC<SheetProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md'
}) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    full: 'max-w-full'
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end isolate">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className={`relative w-full ${sizeClasses[size]} bg-surface-panel h-full shadow-2xl border-l border-white/10 flex flex-col animate-in slide-in-from-right duration-300`}>
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-start bg-surface-ground/50">
          <div>
            {title && <h2 className="text-xl font-bold text-white">{title}</h2>}
            {description && <div className="text-sm text-content-secondary mt-1">{description}</div>}
          </div>
          <button 
            onClick={onClose}
            className="text-content-muted hover:text-white p-2 hover:bg-white/5 rounded-lg transition-colors -mr-2 -mt-2"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-6 border-t border-white/10 bg-surface-ground/50 mt-auto">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
