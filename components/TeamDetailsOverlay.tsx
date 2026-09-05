import React, { useState } from 'react';
import { X, ArrowLeft, Info } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import { MatchResultCard } from './MatchResultCard';
import { Match, Team } from '../types';

export const formatCleanName = (name: string | undefined | null): string => { if (!name) return ''; return name.replace(/^&\s*/, '').replace(/\s*&$/, '').trim(); };
export const TeamDetailsOverlay = ({ team, matches, teams, tournament, onClose, showContactInfo = false }: { team: Team, matches: Match[], teams: Team[], tournament?: any, onClose: () => void, showContactInfo?: boolean }) => {
    const [activeTab, setActiveTab] = useState<'UPCOMING' | 'RESULTS'>('RESULTS');
    const [filterPeriod, setFilterPeriod] = useState<'TODAY' | 'ALL'>('ALL');

    if (!team) return null;

    const teamId = team.id;
    const teamMatches = matches.filter(m => m.team1Id === teamId || m.team2Id === teamId);
    
    const completedMatches = teamMatches.filter(m => (m.status === 'COMPLETED' || String(m.status).toUpperCase() === 'FINISHED'));
    const upcomingMatches = teamMatches.filter(m => (m.status !== 'COMPLETED' && String(m.status).toUpperCase() !== 'FINISHED'));

    const wins = team.wins !== undefined ? team.wins : completedMatches.filter(m => m.winnerTeamId === teamId).length;
    const losses = team.losses !== undefined ? team.losses : (completedMatches.length - wins);
    const played = wins + losses;
    const gd = (team.gamesWon || 0) - (team.gamesLost || 0);

    const getFirstName = (name?: string) => name ? name.split(' ')[0] : '';
    const displayTitle = formatCleanName([getFirstName(team.player1?.name), getFirstName(team.player2?.name)].filter(n => n && n.trim()).join(' & ') || team.name || 'TBA') || 'TBA';

    const isToday = (dateString: string) => {
        const d = new Date(dateString);
        const today = new Date();
        return d.getDate() === today.getDate() &&
            d.getMonth() === today.getMonth() &&
            d.getFullYear() === today.getFullYear();
    };

    let displayMatches = activeTab === 'UPCOMING' ? upcomingMatches : completedMatches;
    if (filterPeriod === 'TODAY') {
        displayMatches = displayMatches.filter(m => m.scheduledTime && isToday(m.scheduledTime));
    }
    
    displayMatches.sort((a, b) => new Date(b.scheduledTime).getTime() - new Date(a.scheduledTime).getTime());

    return (
        <div className="fixed top-16 md:top-24 left-0 right-0 bottom-0 z-[999] bg-black/90 backdrop-blur-sm flex justify-end animate-in fade-in duration-300">
            <div className="w-full md:w-[500px] h-full bg-[#0A0A0A] border-l border-t border-white/5 flex flex-col animate-in slide-in-from-right duration-300 shadow-xl overflow-hidden">
                
                {/* Header Section Matches Design */}
                <div className="p-4 md:p-6 pb-6 bg-[#111111] shadow-lg relative flex flex-col rounded-bl-[24px] border-b border-white/5">
                    <div className="flex justify-between items-center mb-4">
                        <button onClick={onClose} className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors">
                            <ArrowLeft size={24} />
                        </button>
                        <button className="p-2 -mr-2 text-content-muted hover:text-white rounded-full transition-colors">
                            <Info size={24} />
                        </button>
                    </div>

                    <div className="flex items-center gap-4 mb-6">
                        <div className="flex relative shrink-0">
                            {team?.player1?.photoUrl ? (
                                <Avatar src={team.player1.photoUrl} fallback={team.player1.name || ''} size="lg" className="border-[4px] border-[#111111] z-10 w-16 h-16 shadow-xl" />
                            ) : (
                                <Avatar fallback={displayTitle} size="lg" className="border-[4px] border-[#111111] z-10 w-16 h-16 shadow-xl" />
                            )}
                            {team?.player2 && (
                                <Avatar src={team.player2.photoUrl} fallback={team.player2.name || ''} size="lg" className="border-[4px] border-[#111111] -ml-6 z-0 w-16 h-16 shadow-xl" />
                            )}
                        </div>
                        <h2 className="text-xl md:text-2xl font-black text-white leading-tight">{displayTitle}</h2>
                    </div>

                    <div className="flex justify-between items-center text-center px-0 md:px-2">
                        <div className="flex-1 border-r border-white/10">
                            <div className="text-2xl font-black text-white">{played}</div>
                            <div className="text-[10px] text-content-muted font-bold uppercase mt-1 tracking-wider">Played</div>
                        </div>
                        <div className="flex-1 border-r border-white/10">
                            <div className="text-2xl font-black text-white">{wins}</div>
                            <div className="text-[10px] text-content-muted font-bold uppercase mt-1 tracking-wider">Win</div>
                        </div>
                        <div className="flex-1 border-r border-white/10">
                            <div className="text-2xl font-black text-white">{losses}</div>
                            <div className="text-[10px] text-content-muted font-bold uppercase mt-1 tracking-wider">Loss</div>
                        </div>
                        <div className="flex-1">
                            <div className="text-2xl font-black text-white">{gd > 0 ? `+${gd}` : gd}</div>
                            <div className="text-[10px] text-content-muted font-bold uppercase mt-1 tracking-wider">GD</div>
                        </div>
                    </div>

                    <div className="mt-6 flex bg-white/5 p-1 rounded-full relative z-10 border border-white/5">
                        <button 
                            className={`flex-1 py-2 text-sm font-black capitalize rounded-full transition-all ${activeTab === 'UPCOMING' ? 'bg-[#2A2A2A] text-white shadow-lg border border-white/10' : 'text-content-muted hover:text-white'}`}
                            onClick={() => setActiveTab('UPCOMING')}
                        >
                            Upcoming
                        </button>
                        <button 
                            className={`flex-1 py-2 text-sm font-black capitalize rounded-full transition-all ${activeTab === 'RESULTS' ? 'bg-[#2A2A2A] text-white shadow-lg border border-white/10' : 'text-content-muted hover:text-white'}`}
                            onClick={() => setActiveTab('RESULTS')}
                        >
                            Results
                        </button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto px-4 md:px-6 pt-4 pb-20 space-y-4">
                    {/* Players Contact & Info segments */}
                    {(team.player1 || team.player2) && (
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                            <h3 className="text-xs font-black tracking-widest text-[#4D78FF] uppercase">
                                {showContactInfo ? "Team Players & Contact Info" : "Team Players"}
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {team.player1 && (
                                    <div className="space-y-1">
                                        <div className="text-[9px] text-content-muted font-black uppercase tracking-widest">Player 1</div>
                                        <div className="font-bold text-white text-sm">{team.player1.name || "N/A"}</div>
                                        {showContactInfo && team.player1.phone && <div className="text-xs text-content-secondary">📞 {team.player1.phone}</div>}
                                        {showContactInfo && team.player1.email && <div className="text-xs text-content-secondary truncate" title={team.player1.email}>✉️ {team.player1.email}</div>}
                                        {showContactInfo && (team.player1 as any).cnic && <div className="text-[11px] text-content-secondary">🪪 CNIC: {(team.player1 as any).cnic}</div>}
                                    </div>
                                )}
                                {team.player2 && (
                                    <div className="space-y-1">
                                        <div className="text-[9px] text-content-muted font-black uppercase tracking-widest">Player 2</div>
                                        <div className="font-bold text-white text-sm">{team.player2.name || "N/A"}</div>
                                        {showContactInfo && team.player2.phone && <div className="text-xs text-content-secondary">📞 {team.player2.phone}</div>}
                                        {showContactInfo && team.player2.email && <div className="text-xs text-content-secondary truncate" title={team.player2.email}>✉️ {team.player2.email}</div>}
                                        {showContactInfo && (team.player2 as any).cnic && <div className="text-[11px] text-content-secondary">🪪 CNIC: {(team.player2 as any).cnic}</div>}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex bg-[#1A1A1A] rounded-xl overflow-hidden p-1 border border-white/5">
                        <button 
                            className={`flex-1 py-2 text-xs md:text-sm font-black uppercase tracking-wider rounded-lg transition-all ${filterPeriod === 'TODAY' ? 'bg-[#4D78FF] text-white shadow-lg' : 'text-content-muted hover:bg-white/5'}`}
                            onClick={() => setFilterPeriod('TODAY')}
                        >
                            Today
                        </button>
                        <button 
                            className={`flex-1 py-2 text-xs md:text-sm font-black uppercase tracking-wider rounded-lg transition-all ${filterPeriod === 'ALL' ? 'bg-[#4D78FF] text-white shadow-lg' : 'text-content-muted hover:bg-white/5'}`}
                            onClick={() => setFilterPeriod('ALL')}
                        >
                            All
                        </button>
                    </div>

                    {displayMatches.length > 0 ? (
                        <div className="space-y-3">
                            {displayMatches.map((m: Match) => {
                                const t1 = teams.find(t => t.id === m.team1Id);
                                const t2 = teams.find(t => t.id === m.team2Id);
                                const t1Name = t1 ? formatCleanName([getFirstName(t1.player1?.name), getFirstName(t1.player2?.name)].filter(n => n && n.trim()).join(' & ') || t1.name) || 'TBA' : formatCleanName(m.team1Name) || 'TBA';
                                const t2Name = t2 ? formatCleanName([getFirstName(t2.player1?.name), getFirstName(t2.player2?.name)].filter(n => n && n.trim()).join(' & ') || t2.name) || 'TBA' : formatCleanName(m.team2Name) || 'TBA';
                                const isT1Team = m.team1Id === teamId;
                                const isT2Team = m.team2Id === teamId;
                                
                                return (
                                    <div key={m.id} className="bg-[#111111] p-4 rounded-xl border border-white/5 shadow-md">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-[10px] text-content-muted font-black uppercase tracking-widest">{m.roundName || 'Match'}</span>
                                            <div className="flex items-center gap-3">
                                                {m.scheduledTime && (
                                                    <span className="text-[10px] text-content-muted/60 font-bold uppercase tracking-widest">
                                                        {new Date(m.scheduledTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}
                                                    </span>
                                                )}
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${(m.status === 'COMPLETED' || String(m.status).toUpperCase() === 'FINISHED') ? (m.winnerTeamId === teamId ? 'text-[#b4fc57]' : 'text-[#E65C31]') : 'text-[#4D78FF]'}`}>
                                                    {(m.status === 'COMPLETED' || String(m.status).toUpperCase() === 'FINISHED') ? (m.winnerTeamId === teamId ? 'WON' : 'LOST') : m.status}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center gap-3">
                                            <div className={`flex-1 text-sm sm:text-base font-bold truncate ${isT1Team ? 'text-white' : 'text-content-secondary'}`}>{t1Name}</div>
                                            
                                            {m.status !== 'SCHEDULED' && (
                                                <div className="flex shrink-0 items-center justify-center font-mono font-black text-sm bg-black/40 px-3 py-1.5 rounded-lg border border-white/10 text-white gap-2">
                                                    {(m.score?.p1SetScores && m.score?.p1SetScores.length > 0) ? (
                                                        <div className="flex gap-2 text-xs">
                                                            {m.score.p1SetScores.map((s1: number, i: number) => {
                                                                const s2 = (m.score?.p2SetScores && m.score.p2SetScores[i] !== undefined) ? m.score.p2SetScores[i] : 0;
                                                                return <span key={i} className="bg-white/10 px-1.5 py-0.5 rounded text-content-primary">{s1} - {s2}</span>;
                                                            })}
                                                        </div>
                                                    ) : (m.score?.p1Sets !== undefined && m.score?.p2Sets !== undefined && (m.score.p1Sets > 0 || m.score.p2Sets > 0)) ? (
                                                        <span>{m.score.p1Sets} - {m.score.p2Sets}</span>
                                                    ) : (
                                                        <span>{m.score?.p1Games || 0} - {m.score?.p2Games || 0}</span>
                                                    )}
                                                </div>
                                            )}

                                            {m.status === 'SCHEDULED' && (
                                                <div className="flex shrink-0 items-center justify-center font-black text-[10px] uppercase bg-black/40 px-3 py-1.5 rounded-lg border border-white/10 text-content-muted tracking-widest">
                                                    {tournament?.venue || 'Venue TBD'}
                                                </div>
                                            )}

                                            <div className={`flex-1 text-right text-sm sm:text-base font-bold truncate ${isT2Team ? 'text-white' : 'text-content-secondary'}`}>{t2Name}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-content-muted text-sm italic py-12 text-center bg-white/5 rounded-2xl">
                             No matches found for {filterPeriod.toLowerCase()} {activeTab.toLowerCase()}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
