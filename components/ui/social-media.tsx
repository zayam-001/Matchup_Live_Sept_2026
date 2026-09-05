import React from 'react';

export interface SocialItem {
  href: string;
  ariaLabel: string;
  tooltip: string;
  color: string;
  svgUrl: string;
}

export const SocialTooltip = ({ items }: { items: SocialItem[] }) => {
  return (
    <div className="flex items-center gap-4">
      {items.map((item, index) => (
        <a
          key={index}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={item.ariaLabel}
          className="group relative flex items-center justify-center w-12 h-12 rounded-full border border-white/10 bg-white/5 transition-all hover:bg-white/10"
          style={{ '--hover-color': item.color } as React.CSSProperties}
        >
          {/* Tooltip */}
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 scale-95 origin-bottom text-xs font-bold px-2 py-1 rounded bg-black/90 text-white border border-white/10 pointer-events-none transition-all duration-200 group-hover:opacity-100 group-hover:-top-12 group-hover:scale-100 z-10 whitespace-nowrap">
            {item.tooltip}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-white/10" />
          </div>
          
          {/* Icon */}
          <img 
            src={item.svgUrl} 
            alt={item.ariaLabel} 
            className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" 
            style={{ 
              filter: 'invert(1)',
              mixBlendMode: 'plus-lighter'
            }} 
          />
          {/* Hover Glow */}
          <div 
            className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur-md pointer-events-none"
            style={{ backgroundColor: item.color }}
          />
        </a>
      ))}
    </div>
  );
};
