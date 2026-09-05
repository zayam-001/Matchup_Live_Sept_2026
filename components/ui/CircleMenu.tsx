'use client';

import { AnimatePresence, motion, useAnimationControls } from 'motion/react';
import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { cn } from '../../lib/utils';

import { MenuToggleIcon } from './menu-toggle-icon';

const CONSTANTS = {
  itemSize: 48,
  containerSize: 200,
  openStagger: 0.02,
  closeStagger: 0.07,
};

const STYLES: Record<string, Record<string, string>> = {
  trigger: {
    container:
      'rounded-full flex items-center bg-white justify-center cursor-pointer outline-none ring-0 hover:brightness-125 transition-all duration-100 z-50 shadow-lg shadow-white/20',
    active: 'bg-white',
  },
  item: {
    container:
      'rounded-full flex items-center justify-center absolute bg-surface-panel border border-white/10 hover:bg-white/10 cursor-pointer shadow-lg',
    label: 'text-xs text-white absolute bottom-full left-1/2 -translate-x-1/2 mb-2 font-bold whitespace-nowrap bg-surface-ground px-2 py-1 rounded',
  },
};

const pointOnCircle = (i: number, n: number, r: number, cx = 0, cy = 0) => {
  // Use pi to distribute evenly along the top semi-circle or full circle
  // We'll distribute them in an arc above the button
  const startAngle = Math.PI; // left
  const endAngle = 0; // right
  
  let theta;
  if (n === 1) {
    theta = -Math.PI / 2; // straight up
  } else {
    // Arc starts from left (Math.PI) to right (0) across the top
    theta = startAngle - (startAngle - endAngle) * (i / (n - 1));
  }
  
  const x = cx + r * Math.cos(theta);
  const y = cy + r * Math.sin(theta);
  return { x, y };
};

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  index: number;
  totalItems: number;
  isOpen: boolean;
}

const MenuItem = ({ icon, label, onClick, index, totalItems, isOpen }: MenuItemProps) => {
  // Radius adjust based on items to ensure they fit, usually 70-90px
  const r = Math.min(100, CONSTANTS.containerSize / 2);
  const { x, y } = pointOnCircle(index, totalItems, r);
  const [hovering, setHovering] = useState(false);

  return (
    <div className={STYLES.item.container}>
      <motion.button
        animate={{
          x: isOpen ? x : 0,
          y: isOpen ? y : 0,
          opacity: isOpen ? 1 : 0,
          scale: isOpen ? 1 : 0,
        }}
        whileHover={{
          scale: 1.1,
          transition: {
            duration: 0.1,
            delay: 0,
          },
        }}
        transition={{
          delay: isOpen ? index * CONSTANTS.openStagger : index * CONSTANTS.closeStagger,
          type: 'spring',
          stiffness: 300,
          damping: 30,
        }}
        style={{
          height: CONSTANTS.itemSize - 2,
          width: CONSTANTS.itemSize - 2,
        }}
        onClick={(e) => {
           e.stopPropagation();
           onClick();
        }}
        className={STYLES.item.container}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {icon}
        {hovering && <p className={STYLES.item.label}>{label}</p>}
      </motion.button>
    </div>
  );
};

interface MenuTriggerProps {
  setIsOpen: (isOpen: boolean) => void;
  isOpen: boolean;
  itemsLength: number;
  closeAnimationCallback: () => void;
  openIcon?: React.ReactNode;
  closeIcon?: React.ReactNode;
}

const MenuTrigger = ({
  setIsOpen,
  isOpen,
  itemsLength,
  closeAnimationCallback,
  openIcon,
  closeIcon,
}: MenuTriggerProps) => {
  const animate = useAnimationControls();
  const shakeAnimation = useAnimationControls();

  const scaleTransition = Array.from({ length: itemsLength - 1 })
    .map((_, index) => index + 1)
    .reduce((acc, _, index) => {
      const increasedValue = index * 0.15;
      acc.push(1 + increasedValue);
      return acc;
    }, [] as number[]);

  const closeAnimation = async () => {
    shakeAnimation.start({
      translateX: [0, 2, -2, 0, 2, -2, 0],
      transition: {
        duration: CONSTANTS.closeStagger,
        ease: 'linear',
        repeat: 3,
      },
    });
    for (let i = 0; i < scaleTransition.length; i++) {
        // Just animate container background if needed
      if (i !== scaleTransition.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, CONSTANTS.closeStagger * 100));
      }
    }
  };

  return (
    <motion.div animate={shakeAnimation} className="z-50 shrink-0">
      <motion.button
        animate={animate}
        style={{
          height: CONSTANTS.itemSize + 8,
          width: CONSTANTS.itemSize + 8,
        }}
        className={cn(STYLES.trigger.container, isOpen && STYLES.trigger.active)}
        onClick={(e) => {
          e.stopPropagation();
          if (isOpen) {
            setIsOpen(false);
            closeAnimationCallback();
            closeAnimation();
          } else {
            setIsOpen(true);
          }
        }}
      >
        <MenuToggleIcon open={isOpen} className="w-6 h-6 text-black" duration={300} />
      </motion.button>
    </motion.div>
  );
};

export const CircleMenu = ({
  items,
  openIcon = <Menu size={24} className="text-black" />,
  closeIcon = <X size={24} className="text-black" />,
}: {
  items: Array<{ label: string; icon: React.ReactNode; onClick: () => void }>;
  openIcon?: React.ReactNode;
  closeIcon?: React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const animate = useAnimationControls();

  const closeAnimationCallback = async () => {
    await animate.start({
      rotate: -180,
      filter: 'blur(1px)',
      transition: {
        duration: CONSTANTS.closeStagger * (items.length + 2),
        ease: 'linear',
      },
    });
    await animate.start({
      rotate: 0,
      filter: 'blur(0px)',
      transition: { duration: 0 },
    });
  };

  return (
    <div
      style={{
        width: CONSTANTS.containerSize,
        height: CONSTANTS.containerSize,
      }}
      className="relative flex items-center justify-center pointer-events-auto"
    >
      <MenuTrigger
        setIsOpen={setIsOpen}
        isOpen={isOpen}
        itemsLength={items.length}
        closeAnimationCallback={closeAnimationCallback}
        openIcon={openIcon}
        closeIcon={closeIcon}
      />
      <motion.div
        animate={animate}
        className={cn('absolute inset-0 z-0 flex items-center justify-center')}
      >
        {items.map((item, index) => {
          return (
            <MenuItem
              key={`menu-item-${index}`}
              icon={item.icon}
              label={item.label}
              onClick={() => {
                  setIsOpen(false);
                  item.onClick();
              }}
              index={index}
              totalItems={items.length}
              isOpen={isOpen}
            />
          );
        })}
      </motion.div>
    </div>
  );
};
