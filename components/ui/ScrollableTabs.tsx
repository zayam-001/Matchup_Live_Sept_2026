import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ScrollableTabsProps {
    children: React.ReactNode;
    className?: string;
    gradientColor?: string; // Optional: To match the background it's placed on
}

export const ScrollableTabs: React.FC<ScrollableTabsProps> = ({ 
    children, 
    className = '',
    gradientColor = 'bg-surface-ground'
}) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const checkScroll = () => {
        if (scrollContainerRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
            setCanScrollLeft(scrollLeft > 0);
            setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
        }
    };

    useEffect(() => {
        checkScroll();
        window.addEventListener('resize', checkScroll);
        // Sometimes the children render causes a layout resize right after mount
        const timer = setTimeout(checkScroll, 100);
        return () => {
            window.removeEventListener('resize', checkScroll);
            clearTimeout(timer);
        };
    }, [children]);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const offset = direction === 'left' ? -200 : 200;
            scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
        }
    };

    return (
        <div className={`relative flex items-center w-full group ${className}`}>
            {/* Left fade/button */}
            <div className={`absolute left-0 top-0 bottom-0 z-10 flex items-center transition-opacity duration-300 pointer-events-none ${canScrollLeft ? 'opacity-100' : 'opacity-0'}`}>
                {/* Gradient fade */}
                <div className={`absolute inset-0 w-24 bg-gradient-to-r from-[rgba(0,0,0,0.8)] via-[rgba(0,0,0,0.5)] to-transparent pointer-events-none shrink-0 mix-blend-multiply`} />
                <button 
                    onClick={() => scroll('left')}
                    className="relative ml-1 w-8 h-8 flex items-center justify-center bg-surface-panel/80 hover:bg-surface-elevated text-white rounded-full border border-white/10 shadow-lg transition-all backdrop-blur-md pointer-events-auto"
                >
                    <ChevronLeft size={16} />
                </button>
            </div>
            
            {/* Scrollable Container */}
            <div 
                ref={scrollContainerRef}
                onScroll={checkScroll}
                className="flex gap-2 overflow-x-auto w-full py-1 px-1 relative [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] snap-x"
            >
                {children}
            </div>

            {/* Right fade/button */}
            <div className={`absolute right-0 top-0 bottom-0 z-10 flex items-center justify-end transition-opacity duration-300 pointer-events-none ${canScrollRight ? 'opacity-100' : 'opacity-0'}`}>
                {/* Gradient fade */}
                <div className={`absolute right-0 inset-y-0 w-24 bg-gradient-to-l from-[rgba(0,0,0,0.8)] via-[rgba(0,0,0,0.5)] to-transparent pointer-events-none shrink-0 mix-blend-multiply`} />
                <button 
                    onClick={() => scroll('right')}
                    className="relative mr-1 w-8 h-8 flex items-center justify-center bg-surface-panel/80 hover:bg-surface-elevated text-white rounded-full border border-white/10 shadow-lg transition-all backdrop-blur-md pointer-events-auto"
                >
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
    );
};
