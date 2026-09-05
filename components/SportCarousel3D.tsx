import React from 'react';

const CAROUSEL_DATA = [
  { id: 1, icon: '⚡', label: 'MATCH', color: 'bg-primary' },
  { id: 2, icon: '🏆', label: 'WIN', color: 'bg-accent' },
  { id: 3, icon: '🎾', label: 'SERVE', color: 'bg-neutral-800' },
  { id: 4, icon: '🥇', label: 'COMPETE', color: 'bg-primary' },
  { id: 5, icon: '📊', label: 'RANK', color: 'bg-accent' },
  { id: 6, icon: '🏓', label: 'DOMINATE', color: 'bg-neutral-800' },
];

export const SportCarousel3D = () => {
  return (
    <div className="relative w-full h-full flex items-center justify-center [perspective:1000px]">
      <div 
        className="relative w-[180px] h-[240px] [transform-style:preserve-3d] animate-carousel-spin"
      >
        {CAROUSEL_DATA.map((card, index) => {
          const rotationAngle = (360 / CAROUSEL_DATA.length) * index;
          return (
            <div
              key={card.id}
              className={`absolute inset-0 flex flex-col items-center justify-center rounded-2xl shadow-2xl ${card.color} [backface-visibility:hidden]`}
              style={{
                transform: `rotateY(${rotationAngle}deg) translateZ(160px)`,
              }}
            >
              <span className="text-6xl mb-4">{card.icon}</span>
              <span className="font-extrabold text-2xl tracking-wider text-white">
                {card.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
