import React from 'react';
import { Tournament } from '../types';
import { Avatar } from './ui/Avatar';
import { MapPin, Trophy, Calendar } from 'lucide-react';
import { motion } from 'motion/react';
import './tournamentBannerCard.css';

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

        {/* Readability scrim: dark band under the text so busy banner art never fights it */}
        <div className="tbc-scrim" />

        {/* Status badge */}
        <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
          <span className={`tbc-pill ${isLive ? 'tbc-pill--live' : isOngoing ? 'tbc-pill--ongoing' : isCompleted ? 'tbc-pill--done' : ''}`}>
            {isLive && <span className="tbc-pill__dot" />}
            {isLive ? 'Live now' : isOngoing ? 'Underway' : isUpcoming ? 'Upcoming' : 'Completed'}
          </span>
        </div>

        {/* Organizer badge */}
        <div className="absolute top-4 right-4 z-10">
          <div className="tbc-org">
            <Avatar
              src={tournament.organizerLogo}
              fallback={tournament.organizer || 'M'}
              size="sm"
              className="w-5 h-5 border-none shrink-0"
            />
            <span className="tbc-org__name">{tournament.organizer || 'Matchup'}</span>
          </div>
        </div>

        {/* Bottom content */}
        <div className="absolute bottom-0 inset-x-0 p-5 z-10 flex flex-col justify-end">
          <span className="tbc-kicker">
            {isLive ? <><i className="tbc-kicker__dot" /> Live · {(tournament.teams || []).length} teams</> : isOngoing ? `Underway since ${formattedStartDate}` : isUpcoming ? <><Calendar size={12} /> {formattedStartDate}</> : 'Tournament finished'}
          </span>
          <h3 className="tbc-title">{tournament.name}</h3>

          <div className="tbc-meta">
            <span className="tbc-meta__venue">
              <MapPin size={13} className="shrink-0" />
              <span className="truncate">{tournament.venue || 'Global Arena'}</span>
            </span>
            {!!tournament.prizeMoney && (
              <span className="tbc-meta__prize">
                <Trophy size={13} />
                {tournament.currency === 'USD' ? '$' : 'Rs'} {tournament.prizeMoney.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
