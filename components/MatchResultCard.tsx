import React, { useState } from 'react';
import { Match, Team, MatchStatus } from '../types';
import { Avatar } from './ui/Avatar';
import { Trophy, CalendarDays, MapPin, Copy, Check } from 'lucide-react';
import { WinnerBanner } from './WinnerBanner';

export const formatCleanName = (name: string | undefined | null): string => { if (!name) return ''; return name.replace(/^&\s*/, '').replace(/\s*&$/, '').trim(); };
export const MatchResultCard = ({ match, teams, tournament, onEdit }: { match: Match; teams: Team[]; tournament?: any; onEdit?: () => void }) => {
    const [showWinnerBanner, setShowWinnerBanner] = useState(false);
    const [copiedObs, setCopiedObs] = useState(false);

    const handleCopyObsUrl = () => {
        const tId = match.tournamentId || tournament?.id || 'tbd';
        const url = `https://matchup.com.pk/#obs/${tId}/${match.id}`;
        navigator.clipboard.writeText(url);
        setCopiedObs(true);
        setTimeout(() => setCopiedObs(false), 1500);
    };

    const t1 = teams.find((t) => t.id === match.team1Id);
    const t2 = teams.find((t) => t.id === match.team2Id);
    const isT1Winner = match.winnerTeamId === match.team1Id;
    const isT2Winner = match.winnerTeamId === match.team2Id;

    const getFirstName = (name?: string) => (name ? name.split(' ')[0] : '');
    const t1Name = formatCleanName([getFirstName(t1?.player1?.name), getFirstName(t1?.player2?.name)].filter(n => n && n.trim()).join(' & ') || t1?.name || match.team1Name || 'TBA') || 'TBA';
    const t2Name = formatCleanName([getFirstName(t2?.player1?.name), getFirstName(t2?.player2?.name)].filter(n => n && n.trim()).join(' & ') || t2?.name || match.team2Name || 'TBA') || 'TBA';

    // Extract sets/scores
    let p1Sets = match.score?.p1Sets || 0;
    let p2Sets = match.score?.p2Sets || 0;
    let p1SetScores = match.score?.p1SetScores ? [...match.score.p1SetScores] : [];
    let p2SetScores = match.score?.p2SetScores ? [...match.score.p2SetScores] : [];
    const p1Games = match.score?.p1Games ?? 0;
    const p2Games = match.score?.p2Games ?? 0;
    const isCompleted = match.status === 'COMPLETED' || String(match.status).toUpperCase() === 'FINISHED' || !!match.winnerTeamId;

    if (!isCompleted) {
        // If it's a multi-set match, append the current game scores to the set arrays so they render
        if (match.score?.currentSet && p1SetScores.length < match.score.currentSet) {
            p1SetScores.push(p1Games);
            p2SetScores.push(p2Games);
        } else if (!match.score?.currentSet && p1SetScores.length === 0 && (p1Games > 0 || p2Games > 0)) {
            p1SetScores.push(p1Games);
            p2SetScores.push(p2Games);
        }
    }

    if (p1SetScores.length > 0) {
        let p1 = 0; let p2 = 0;
        p1SetScores.forEach((s: number, i: number) => {
            const os = p2SetScores[i] || 0;
            if (s > os) p1++; else if (os > s) p2++;
        });
        p1Sets = p1;
        p2Sets = p2;
    } else if (p1Games > 0 || p2Games > 0) {
        p1SetScores = [p1Games];
        p2SetScores = [p2Games];
        if (p1Games > p2Games) p1Sets = 1;
        else if (p2Games > p1Games) p2Sets = 1;
    }


    if (isCompleted && p1Sets === 0 && p2Sets === 0 && p1SetScores.length === 0 && p1Games === 0 && p2Games === 0) {
        if (isT1Winner) { p1Sets = 1; p1SetScores = [1]; p2SetScores = [0]; }
        else if (isT2Winner) { p2Sets = 1; p1SetScores = [0]; p2SetScores = [1]; }
    }

    const isSingleGameFormat = (p1Sets === 0 && p2Sets === 0 && (p1Games > 0 || p2Games > 0)) || (p1SetScores.length === 1 && (p1SetScores[0] > 1 || p2SetScores[0] > 1));
    const hasSetScores = p1SetScores.length > 0 && !isSingleGameFormat;

    const winnerText = isT1Winner ? `${t1Name}` : isT2Winner ? `${t2Name}` : 'MATCH';

    // Formatting date
    const dateOpts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
    let dateFormatted = '';
    if (match.scheduledTime) {
        try {
            const date = new Date(match.scheduledTime);
            if (!isNaN(date.getTime())) {
                dateFormatted = date.toLocaleString('en-US', dateOpts);
            }
        } catch (e) {
            // ignore
        }
    }

    return (
        <div className="bg-[#1A1A1A] rounded-3xl p-6 border border-white/5 shadow-2xl relative w-full overflow-hidden">
            {/* Background embellishment */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none select-none">
                <div className="text-[200px] font-black italic tracking-tighter">P</div>
            </div>

            {/* Round / Stage Name */}
            <div className="text-center font-black uppercase tracking-[0.2em] mb-8 text-content-muted text-xs sm:text-sm relative z-10 transition-colors">
                {match.roundName || 'Match'}
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center relative z-10 gap-8 md:gap-4">
                
                {/* Left Team */}
                <div className="flex flex-col items-center flex-1 w-full relative">
                    <div className="flex justify-center mb-4 relative">
                        {t1?.player1?.photoUrl ? (
                            <Avatar src={t1.player1.photoUrl} fallback={t1.player1.name || ''} size="lg" className="ring-[6px] ring-[#1A1A1A] z-10 shadow-xl" />
                        ) : (
                            <Avatar fallback={t1Name} size="lg" className="ring-[6px] ring-[#1A1A1A] z-10 shadow-xl" />
                        )}
                        {t1?.player2 && (
                            <Avatar src={t1.player2.photoUrl} fallback={t1.player2.name || ''} size="lg" className="ring-[6px] ring-[#1A1A1A] -ml-5 z-0 shadow-xl" />
                        )}
                        {isT1Winner && (
                            <div className="absolute -bottom-2 -right-2 bg-amber-400 p-1.5 rounded-full shadow-[0_0_15px_rgba(251,191,36,0.5)] z-20">
                                <Trophy size={16} className="text-black fill-black" />
                            </div>
                        )}
                    </div>
                    
                    <div className={`text-lg sm:text-xl font-black tracking-tight text-center mb-5 ${isT1Winner ? 'text-white' : 'text-gray-400'}`}>
                        {t1Name}
                    </div>
                    
                    {/* Set boxes */}
                    {hasSetScores && (
                        <div className="flex border border-white/10 rounded-xl overflow-hidden divide-x divide-white/10 shadow-inner bg-black/20">
                            {[0, 1, 2].map(i => {
                                if (p1SetScores[i] === undefined) return null;
                                const isSetWinner = p1SetScores[i] > (p2SetScores[i] || 0);
                                return (
                                    <div key={i} className={`w-12 h-12 flex items-center justify-center font-black text-lg sm:text-xl transition-colors ${isSetWinner ? 'text-white bg-white/5' : 'text-gray-500'}`}>
                                        {p1SetScores[i]}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {(!isCompleted && (match.score?.p1Points !== '0' || match.score?.p2Points !== '0')) && (
                        <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 px-3 py-0.5 rounded-full border border-white/10 whitespace-nowrap shadow-lg">
                            <span className="text-[#4D78FF] font-black text-xs font-mono">{match.score?.p1Points || '0'}</span>
                            <span className="text-white/30 text-[10px]">PTS</span>
                            <span className="text-white font-black text-xs font-mono">{match.score?.p2Points || '0'}</span>
                        </div>
                    )}
                </div>

                {/* Center Area: Overall Result */}
                <div className="flex flex-col items-center justify-center shrink-0 w-full md:w-auto relative mb-2 md:mb-0">
                    <div className="text-center mb-4 min-h-[48px] flex flex-col justify-end">
                        <div className="text-[#4D78FF] font-bold text-sm sm:text-base leading-tight max-w-[160px] mx-auto truncate text-center">
                             {winnerText}
                        </div>
                        <div className="text-white font-black uppercase tracking-[0.2em] mt-1 text-sm sm:text-base">
                             {((match.status === 'COMPLETED' || String(match.status).toUpperCase() === 'FINISHED') || String(match.status).toUpperCase() === 'COMPLETED' || String(match.status).toUpperCase() === 'FINISHED') ? 'WON' : 'TBD'}
                        </div>
                    </div>
                    
                    {isSingleGameFormat ? (
                         <div className="flex rounded-xl overflow-hidden shadow-2xl border border-white/5">
                            <div className={`w-14 h-16 sm:w-16 sm:h-20 flex items-center justify-center font-black text-2xl sm:text-3xl ${isT1Winner ? 'bg-[#4D78FF] text-white shadow-[inset_0_0_20px_rgba(255,255,255,0.2)]' : 'bg-[#2A2A2A] text-white text-opacity-80'}`}>
                                {p1Games || (p1SetScores.length > 0 ? p1SetScores[0] : 0)}
                            </div>
                            <div className={`w-14 h-16 sm:w-16 sm:h-20 flex items-center justify-center font-black text-2xl sm:text-3xl border-l border-white/10 ${isT2Winner ? 'bg-[#4D78FF] text-white shadow-[inset_0_0_20px_rgba(255,255,255,0.2)]' : 'bg-[#2A2A2A] text-white text-opacity-80'}`}>
                                {p2Games || (p2SetScores.length > 0 ? p2SetScores[0] : 0)}
                            </div>
                        </div>
                    ) : (
                        <div className="flex rounded-xl overflow-hidden shadow-2xl border border-white/5">
                            <div className={`w-14 h-16 sm:w-16 sm:h-20 flex items-center justify-center font-black text-2xl sm:text-3xl transition-all ${isT1Winner ? 'bg-[#4D78FF] text-white shadow-[inset_0_0_15px_rgba(255,255,255,0.2)]' : 'bg-[#2A2A2A] text-white text-opacity-80'}`}>
                                {p1Sets}
                            </div>
                            <div className={`w-14 h-16 sm:w-16 sm:h-20 flex items-center justify-center font-black text-2xl sm:text-3xl transition-all border-l border-white/10 ${isT2Winner ? 'bg-[#4D78FF] text-white shadow-[inset_0_0_15px_rgba(255,255,255,0.2)]' : 'bg-[#2A2A2A] text-white text-opacity-80'}`}>
                                {p2Sets}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Team */}
                <div className="flex flex-col items-center flex-1 w-full relative">
                    <div className="flex justify-center mb-4 relative">
                        {t2?.player1?.photoUrl ? (
                            <Avatar src={t2.player1.photoUrl} fallback={t2.player1.name || ''} size="lg" className="ring-[6px] ring-[#1A1A1A] z-10 shadow-xl" />
                        ) : (
                            <Avatar fallback={t2Name} size="lg" className="ring-[6px] ring-[#1A1A1A] z-10 shadow-xl" />
                        )}
                        {t2?.player2 && (
                            <Avatar src={t2.player2.photoUrl} fallback={t2.player2.name || ''} size="lg" className="ring-[6px] ring-[#1A1A1A] -ml-5 z-0 shadow-xl" />
                        )}
                        {isT2Winner && (
                            <div className="absolute -bottom-2 -right-2 bg-amber-400 p-1.5 rounded-full shadow-[0_0_15px_rgba(251,191,36,0.5)] z-20">
                                <Trophy size={16} className="text-black fill-black" />
                            </div>
                        )}
                    </div>
                    
                    <div className={`text-lg sm:text-xl font-black tracking-tight text-center mb-5 ${isT2Winner ? 'text-white' : 'text-gray-400'}`}>
                        {t2Name}
                    </div>
                    
                    {/* Set boxes */}
                    {hasSetScores && (
                        <div className="flex border border-white/10 rounded-xl overflow-hidden divide-x divide-white/10 shadow-inner bg-black/20">
                            {[0, 1, 2].map(i => {
                                if (p2SetScores[i] === undefined) return null;
                                const isSetWinner = p2SetScores[i] > (p1SetScores[i] || 0);
                                return (
                                    <div key={i} className={`w-12 h-12 flex items-center justify-center font-black text-lg sm:text-xl transition-colors ${isSetWinner ? 'text-white bg-white/5' : 'text-gray-500'}`}>
                                        {p2SetScores[i]}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Metadata: Date & Venue */}
            <div className="flex flex-col sm:flex-row justify-between items-center mt-8 pt-5 border-t border-white/5 text-content-muted text-xs sm:text-sm font-medium relative z-10 gap-3 sm:gap-0">
                <div className="flex items-center gap-2">
                    <CalendarDays size={16} className="text-[#4D78FF]" />
                    {dateFormatted || 'TBA'}
                </div>
                <div className="flex flex-wrap items-center gap-2 justify-center">
                    <button 
                        onClick={handleCopyObsUrl} 
                        className="bg-brand/10 hover:bg-brand/20 text-brand border border-brand/20 hover:border-brand/40 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow flex items-center gap-1.5"
                    >
                        {copiedObs ? <Check size={14} /> : <Copy size={14} />}
                        OBS Link
                    </button>
                    {onEdit && (
                        <button onClick={onEdit} className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-white text-xs font-bold transition-colors shadow">
                            Edit Score
                        </button>
                    )}
                    {((match.status === 'COMPLETED' || String(match.status).toUpperCase() === 'FINISHED') || String(match.status).toUpperCase() === 'COMPLETED' || String(match.status).toUpperCase() === 'FINISHED') && (
                        <button 
                            onClick={() => setShowWinnerBanner(true)} 
                            className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 hover:border-amber-500/40 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow flex items-center gap-1.5"
                        >
                            <Trophy size={13} className="mb-0.5" />
                            Generate Banner
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-[#E65C31]" />
                    {tournament?.venue ? tournament.venue : 'Venue TBA'}
                </div>
            </div>

            {showWinnerBanner && (
                <WinnerBanner 
                    match={match}
                    tournamentName={tournament?.name || (match as any).tournamentName || "Tournament"}
                    teams={teams}
                    sponsors={tournament?.sponsors}
                    onClose={() => setShowWinnerBanner(false)}
                />
            )}
        </div>
    );
};

