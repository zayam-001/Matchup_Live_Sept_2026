import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ClipboardCheck, Users, MapPin, Activity, Database, TrendingUp, X } from 'lucide-react';

export interface TimelineNode {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  angle: number; // 0 to 360
  energyLevel: number; // 0 to 100
  connectedNodes: string[];
}

const defaultData: TimelineNode[] = [
  { id: '1', title: 'Registration Forms', description: 'Custom forms with logic routing and payments.', icon: <ClipboardCheck size={20} />, angle: 0, energyLevel: 80, connectedNodes: ['2', '5'] },
  { id: '2', title: 'Teams & Brackets', description: 'Automated seeding, team rosters, and dynamic formats.', icon: <Users size={20} />, angle: 60, energyLevel: 95, connectedNodes: ['3', '4'] },
  { id: '3', title: 'Venue Booking', description: 'Court allocation, time-slots, and conflict resolution.', icon: <MapPin size={20} />, angle: 120, energyLevel: 70, connectedNodes: ['2', '4'] },
  { id: '4', title: 'Live Scoring', description: 'Real-time updates, referee interface, and broadcast modes.', icon: <Activity size={20} />, angle: 180, energyLevel: 100, connectedNodes: ['2', '5'] },
  { id: '5', title: 'Player Database', description: 'GWP tracking, history, ELOs, and rich profiles.', icon: <Database size={20} />, angle: 240, energyLevel: 85, connectedNodes: ['1', '4'] },
  { id: '6', title: 'Marketable Platform', description: 'Sponsors, ticketing, sub-branding tools.', icon: <TrendingUp size={20} />, angle: 300, energyLevel: 75, connectedNodes: ['1', '3'] },
];

export const RadialOrbitalTimeline = ({ timelineData = defaultData }: { timelineData?: TimelineNode[] }) => {
  const [activeNode, setActiveNode] = useState<TimelineNode | null>(null);

  // Map coordinate math:
  // r = radius. x = r * cos(angle), y = r * sin(angle)
  const radius = 140; 
  const center = { x: 200, y: 200 };

  const getCoordinates = (angleDegrees: number) => {
    const angleRads = (angleDegrees * Math.PI) / 180;
    return {
      x: center.x + radius * Math.cos(angleRads),
      y: center.y + radius * Math.sin(angleRads),
    };
  };

  return (
    <div className="relative w-full overflow-hidden flex flex-col md:flex-row items-center gap-8 justify-center min-h-[450px]">
      
      {/* Interactive Graph Section */}
      <div className="relative w-[400px] h-[400px] shrink-0">
        
        {/* Connection Lines (SVG) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 400">
          <circle cx="200" cy="200" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="4 4" />
          
          {/* Draw lines from center to nodes */}
          {timelineData.map((node) => {
             const coords = getCoordinates(node.angle);
             const isActive = activeNode?.id === node.id;
             const isConnected = activeNode?.connectedNodes.includes(node.id);
             const lineOpacity = isActive ? 0.8 : isConnected ? 0.4 : 0.1;
             const strokeColor = isActive || isConnected ? '#4D78FF' : '#ffffff';
             
             return (
               <line 
                 key={`line-core-${node.id}`}
                 x1="200" y1="200" x2={coords.x} y2={coords.y} 
                 stroke={strokeColor} 
                 strokeWidth={isActive ? 2 : 1}
                 strokeOpacity={lineOpacity}
                 className="transition-all duration-500"
               />
             );
          })}
        </svg>

        {/* Central Core Element */}
        <div className="absolute top-[170px] left-[170px] w-[60px] h-[60px]">
           <div className="w-full h-full rounded-full bg-primary/20 animate-ping absolute inset-0" />
           <div className="w-full h-full rounded-full bg-primary flex items-center justify-center text-white border-4 border-bg-dark z-10 relative shadow-[0_0_30px_rgba(77,120,255,0.5)]">
              <span className="font-black italic text-xs">CORE</span>
           </div>
        </div>

        {/* Orbital Nodes */}
        {timelineData.map((node) => {
          const coords = getCoordinates(node.angle);
          const isActive = activeNode?.id === node.id;
          const isConnected = activeNode?.connectedNodes.includes(node.id);
          
          return (
            <motion.button
              key={node.id}
              onClick={() => setActiveNode(isActive ? null : node)}
              className={`absolute w-12 h-12 -ml-6 -mt-6 rounded-full flex items-center justify-center z-20 transition-all duration-300 ${
                isActive ? 'bg-accent text-white scale-125 shadow-[0_0_20px_rgba(230,92,49,0.5)]' 
                : isConnected ? 'bg-primary text-white scale-110 shadow-lg'
                : 'bg-surface-dark border border-white/20 text-content-muted hover:border-primary hover:text-white'
              }`}
              style={{ left: coords.x, top: coords.y }}
              whileHover={{ scale: isActive ? 1.25 : 1.15 }}
            >
              {node.icon}
            </motion.button>
          );
        })}
      </div>

      {/* Info Panel Section */}
      <div className="w-full max-w-md h-[400px] relative">
        <AnimatePresence mode="wait">
          {activeNode ? (
            <motion.div
              key={activeNode.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-dark border border-primary/20 rounded-2xl p-6 h-full flex flex-col justify-between relative shadow-2xl"
            >
              <button 
                onClick={() => setActiveNode(null)} 
                className="absolute top-4 right-4 text-content-muted hover:text-white transition-colors"
              >
                <X size={20} />
              </button>

              <div>
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-6">
                  {activeNode.icon}
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">{activeNode.title}</h3>
                <p className="text-content-secondary leading-relaxed">{activeNode.description}</p>
              </div>

              <div className="mt-8">
                <div className="flex justify-between text-xs font-bold text-content-muted uppercase tracking-wider mb-2">
                  <span>Modularity Energy</span>
                  <span className="text-accent">{activeNode.energyLevel}%</span>
                </div>
                <div className="w-full bg-bg-dark rounded-full h-2 overflow-hidden border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${activeNode.energyLevel}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-primary to-accent" 
                  />
                </div>
                
                <div className="mt-6 pt-6 border-t border-white/5">
                   <p className="text-xs font-bold text-content-muted uppercase tracking-wider mb-3">Synergizes With</p>
                   <div className="flex flex-wrap gap-2">
                     {activeNode.connectedNodes.map(cId => {
                       const cNode = timelineData.find(n => n.id === cId);
                       if (!cNode) return null;
                       return (
                         <span key={cId} className="px-3 py-1 bg-surface-elevated border border-white/10 rounded-full text-xs text-white flex items-center gap-2 cursor-pointer hover:border-primary transition-colors" onClick={() => setActiveNode(cNode)}>
                           {cNode.icon} {cNode.title}
                         </span>
                       );
                     })}
                   </div>
                </div>
              </div>
            </motion.div>
          ) : (
             <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full border border-dashed border-white/10 rounded-2xl flex items-center justify-center text-center p-8 text-content-muted"
            >
              <div>
                <Activity size={32} className="mx-auto mb-4 opacity-50" />
                <p className="font-medium text-lg text-white mb-2">Explore the Ecosystem</p>
                <p className="text-sm">Click a node on the orbital map to view feature details and connections.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
