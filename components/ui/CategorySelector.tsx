import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'motion/react';

export const CategorySelector = ({ categories, selectedCategoryId, onSelectCategory, matches }: any) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to active category on mount or change
  useEffect(() => {
    if (containerRef.current) {
      const activeElement = containerRef.current.querySelector('[data-active="true"]');
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [selectedCategoryId]);

  return (
    <div className="w-full relative">
      <div 
        ref={containerRef}
        className="flex overflow-x-auto gap-2 p-2 bg-[#111111]/80 backdrop-blur-xl rounded-[24px] border border-white/10 shadow-2xl relative [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] snap-x w-max max-w-full mx-auto"
      >
        {categories.map((cat: any) => {
          const hasLiveMatch = matches?.some((m: any) => 
            m.categoryId === cat.id && 
            (m.status === 'IN_PROGRESS' || String(m.status).toUpperCase() === 'LIVE') && 
            !m.winnerTeamId
          );
          const isActive = selectedCategoryId === cat.id;

          return (
            <button
              key={cat.id}
              data-active={isActive}
              onClick={() => onSelectCategory(cat.id)}
              className={`relative px-8 py-4 rounded-[16px] text-xs font-display font-black uppercase tracking-[0.1em] transition-all cursor-pointer border-none snap-center whitespace-nowrap shrink-0 group
                ${isActive 
                  ? 'text-black' 
                  : 'text-white/50 hover:text-white bg-transparent'}`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeCategoryBg"
                  className="absolute inset-0 bg-white rounded-[16px] shadow-[0_4px_20px_rgba(255,255,255,0.2)] -z-10"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              
              <span className="relative z-10 flex items-center gap-2">
                {cat.name}
                {hasLiveMatch && (
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isActive ? 'bg-[#E65C31]' : 'bg-[#4D78FF]'}`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${isActive ? 'bg-[#E65C31]' : 'bg-[#4D78FF]'}`}></span>
                  </span>
                )}
              </span>
              
              {/* Subtle hover effect for inactive */}
              {!isActive && (
                <div className="absolute inset-0 rounded-[16px] bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
