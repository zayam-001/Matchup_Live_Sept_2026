import React from 'react';
import { Tournament } from '../types';
import { Avatar } from './ui/Avatar';
import { MapPin, Trophy, Calendar } from 'lucide-react';
import { motion } from 'motion/react';

interface TournamentBannerCardProps {
  tournament: Tournament;
  variant: 'live' | 'ongoing' | 'upcoming' | 'completed';
  onClick: () => void;
}

export const TournamentBannerCard: React.FC<TournamentBannerCardProps> = ({
  tournament,
  variant,
  onClick,
}) => {
  const isLive = variant === 'live';
  const isOngoing = variant === 'ongoing';
  const isUpcoming = variant === 'upcoming';
  const isCompleted = variant === 'completed';

  // Helper to format date nicely
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'TBD';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'TBD';
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (e) {
      return 'TBD';
    }
  };

  const formattedStartDate = formatDate(tournament.startDate);

  // Geometric gradient background for placeholder
  const placeholderGradient = isLive
    ? 'from-[#4D78FF]/25 via-[#111113] to-[#1B1B1E]'
    : isOngoing
    ? 'from-[#E65C31]/15 via-[#111113] to-[#1B1B1E]'
    : isUpcoming
    ? 'from-[#4D78FF]/10 via-[#111113] to-[#1B1B1E]'
    : 'from-[#1B1B1E] via-[#111113] to-[#1B1B1E]';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      whileHover={{ y: -6, scale: 1.02 }}
      className={`w-full group ${isCompleted ? 'opacity-80 hover:opacity-100' : ''} transition-all duration-300 cursor-pointer`}
      onClick={onClick}
    >
      <div
        className="w-full h-56 rounded-2xl overflow-hidden relative border border-white/5 bg-[#1B1B1E] shadow-2xl transition-all group-hover:border-[#4D78FF]/50 group-hover:shadow-[#4D78FF]/10"
      >
        {/* Banner Image / Cover */}
        {tournament.bannerUrl ? (
          <img
            src={tournament.bannerUrl}
            alt={`${tournament.name} Banner`}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className={`absolute inset-0 w-full h-full bg-gradient-to-br ${placeholderGradient}`}>
            <div className="absolute inset-0 opacity-5 bg-[linear-gradient(45deg,#fff_12.5%,transparent_12.5%,transparent_50%,#fff_50%,#fff_62.5%,transparent_62.5%,transparent_100%)] bg-[length:30px_30px]" />
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent opacity-95 transition-opacity group-hover:opacity-100" />

        {/* Absolute Badges on Top */}
        <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
          {isLive && (
            <span className="flex items-center gap-1.5 bg-[#4D78FF] text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md shadow-md">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
              Live Now
            </span>
          )}
          {isOngoing && (
            <span className="flex items-center gap-1 bg-[#E65C31]/15 text-[#E65C31] border border-[#E65C31]/30 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md shadow-md">
              Underway
            </span>
          )}
          {isUpcoming && (
            <span className="flex items-center gap-1 bg-white/10 text-white border border-white/10 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md shadow-md">
              Upcoming
            </span>
          )}
          {isCompleted && (
            <span className="flex items-center gap-1 bg-white/5 text-white/60 border border-white/5 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md">
              Completed
            </span>
          )}
        </div>

        {/* Top Right Organizer Logo Badge */}
        <div className="absolute top-4 right-4 z-10">
          <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 shadow-lg">
            <Avatar
              src={tournament.organizerLogo}
              fallback={tournament.organizer || 'M'}
              size="sm"
              className="w-4 h-4 border-none shrink-0"
            />
            <span className="text-[8px] font-black uppercase tracking-wider text-white max-w-[80px] truncate">
              {tournament.organizer || 'Matchup'}
            </span>
          </div>
        </div>

        {/* Cinematic Card Meta Content (Bottom overlay) */}
        <div className="absolute bottom-0 inset-x-0 p-5 z-10 flex flex-col justify-end">
          <div className="space-y-1">
            <span className={`text-[10px] font-black uppercase tracking-widest block font-mono ${isOngoing ? 'text-[#E65C31]' : 'text-[#4D78FF]'}`}>
              {isLive ? `● Live • ${(tournament.teams || []).length} Teams` : isOngoing ? `Underway since ${formattedStartDate}` : isUpcoming ? `Upcoming • ${formattedStartDate}` : 'Tournament Finished'}
            </span>
            <h3 className="text-base md:text-lg font-black text-white uppercase tracking-wider line-clamp-1 group-hover:text-[#4D78FF] transition-colors leading-tight">
              {tournament.name}
            </h3>
          </div>

          {/* Expanded Meta Info */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10 text-[9px] text-gray-400 font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1 min-w-0">
              <MapPin size={11} className="text-[#4D78FF] shrink-0" />
              <span className="truncate max-w-[120px]">{tournament.venue || 'Global Arena'}</span>
            </span>
            <span className="flex items-center gap-1 text-accent-success shrink-0 font-mono">
              <Trophy size={11} />
              <span>{tournament.currency === 'USD' ? '$' : 'Rs'} {(tournament.prizeMoney || 0).toLocaleString()}</span>
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
