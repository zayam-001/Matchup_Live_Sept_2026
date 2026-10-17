import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import { MatchResultCard } from './MatchResultCard';
import { Match, Team } from '../types';

export const formatCleanName = (name: string | undefined | null): string => { if (!name) return ''; return name.replace(/^&\s*/, '').replace(/\s*&$/, '').trim(); };
export const TeamDetailsOverlay = ({ team, matches, teams, tournament, onClose, showContactInfo = false }: { team: Team, matches: Match[], teams: Team[], tournament?: any, onClose: () => void, showContactInfo?: boolean }) => {
    const [activeTab, setActiveTab] = useState<'UPCOMING' | 'RESULTS'>('RESULTS');
    const [filterPeriod, setFilterPeriod] = useState<'TODAY' | 'ALL'>('ALL');

    // Esc closes; the page behind doesn't scroll while the drawer is open.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
    }, [onClose]);

    if (!team) return null;

    const teamId = team.id;
    const isDone = (m: Match) => m.status === 'COMPLETED' || String(m.status).toUpperCase() === 'FINISHED';
    const isLive = (m: Match) => ['IN_PROGRESS', 'LIVE'].includes(String(m.status).toUpperCase());
    const teamMatches = matches.filter(m => m.team1Id === teamId || m.team2Id === teamId);
    const completedMatches = teamMatches.filter(isDone);
    const upcomingMatches = teamMatches.filter(m => !isDone(m));

    const t: any = team;
    const wins = t.wins !== undefined ? t.wins : completedMatches.filter(m => m.winnerTeamId === teamId).length;
    const ties = t.ties !== undefined ? t.ties : completedMatches.filter(m => !m.winnerTeamId).length;
    const losses = t.losses !== undefined ? t.losses : Math.max(0, completedMatches.length - wins - ties);
    const played = t.matchesPlayed !== undefined ? t.matchesPlayed : wins + losses + ties;
    const isPointsTable = t.pointsScored !== undefined; // Team Americano standings row
    const diff = isPointsTable ? (t.pointDifferential ?? 0) : (t.gamesWon || 0) - (t.gamesLost || 0);
    const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

    const getFirstName = (name?: string) => name ? name.split(' ')[0] : '';
    const playersLine = [team.player1?.name, team.player2?.name].filter(n => n && n.trim() && n.toUpperCase() !== 'N/A').join(' & ');
    const displayTitle = formatCleanName(team.name || playersLine) || 'TBA';
    const showPlayersLine = !!playersLine && formatCleanName(team.name || '').toLowerCase() !== playersLine.toLowerCase();
    const sideName = (tm: Team | undefined, fallback?: string) => tm
        ? formatCleanName(tm.name || [getFirstName(tm.player1?.name), getFirstName(tm.player2?.name)].filter(n => n && n.trim()).join(' & ')) || 'TBA'
        : formatCleanName(fallback) || 'TBA';

    const isToday = (dateString: string) => {
        const d = new Date(dateString);
        const today = new Date();
        return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    };

    let displayMatches = activeTab === 'UPCOMING' ? upcomingMatches : completedMatches;
    if (filterPeriod === 'TODAY') displayMatches = displayMatches.filter(m => m.scheduledTime && isToday(m.scheduledTime));
    displayMatches = [...displayMatches].sort((a, b) => activeTab === 'UPCOMING'
        ? new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()
        : new Date(b.scheduledTime).getTime() - new Date(a.scheduledTime).getTime());

    const stats: { label: string; value: string; tone?: string }[] = [
        { label: 'Played', value: String(played) },
        { label: 'Won', value: String(wins), tone: 'text-[#34D399]' },
        ...(isPointsTable || ties > 0 ? [{ label: 'Tied', value: String(ties) }] : []),
        { label: 'Lost', value: String(losses), tone: 'text-[#FF7A6B]' },
        { label: isPointsTable ? 'Diff' : 'GD', value: signed(diff), tone: diff > 0 ? 'text-[#34D399]' : diff < 0 ? 'text-[#FF7A6B]' : undefined },
        ...(isPointsTable ? [{ label: 'Score', value: String(t.points ?? t.pointsScored ?? 0), tone: 'text-[#7EA0FF]' }] : []),
    ];

    const scoreOf = (m: Match) => {
        const sc: any = m.score || {};
        if (sc.p1SetScores?.length) return sc.p1SetScores.map((s1: number, i: number) => `${s1}-${sc.p2SetScores?.[i] ?? 0}`).join('  ');
        if ((sc.p1Sets || 0) > 0 || (sc.p2Sets || 0) > 0) return `${sc.p1Sets}-${sc.p2Sets}`;
        return `${sc.p1Games || 0}-${sc.p2Games || 0}`;
    };
    const badgeOf = (m: Match) => {
        if (isDone(m)) {
            if (!m.winnerTeamId) return { text: 'Tied', cls: 'bg-white/10 text-white/80' };
            return m.winnerTeamId === teamId ? { text: 'Won', cls: 'bg-[#34D399]/15 text-[#34D399]' } : { text: 'Lost', cls: 'bg-[#FF7A6B]/15 text-[#FF7A6B]' };
        }
        if (isLive(m)) return { text: 'Live', cls: 'bg-[#FF3B3B]/15 text-[#FF6B6B]' };
        return { text: m.scheduledTime ? new Date(m.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Scheduled', cls: 'bg-[#4D78FF]/15 text-[#7EA0FF]' };
    };

    const playerCard = (p: any, label: string) => p && (
        <div className="flex items-center gap-3 min-w-0">
            <Avatar src={p.photoUrl} fallback={p.name || ''} size="md" className="w-10 h-10 shrink-0" />
            <div className="min-w-0">
                <div className="text-[10px] text-white/45 font-bold uppercase tracking-widest">{label}</div>
                <div className="font-bold text-white text-sm truncate">{p.name || 'N/A'}</div>
                {showContactInfo && p.phone && <div className="text-xs text-white/60 truncate">📞 {p.phone}</div>}
                {showContactInfo && p.email && <div className="text-xs text-white/60 truncate" title={p.email}>✉️ {p.email}</div>}
                {showContactInfo && p.cnic && <div className="text-[11px] text-white/60">🪪 CNIC: {p.cnic}</div>}
            </div>
        </div>
    );

    return createPortal(
        <div className="fixed inset-0 z-[10000] flex justify-end animate-in fade-in duration-200" role="dialog" aria-modal="true" aria-label={`${displayTitle} details`}>
            <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default" />
            <aside className="relative w-full sm:w-[520px] h-full flex flex-col bg-[#0B1030] border-l border-white/10 shadow-[-30px_0_80px_rgba(0,0,0,0.5)] animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="shrink-0 px-5 sm:px-6 pt-5 pb-5 border-b border-white/10 bg-[radial-gradient(120%_120%_at_100%_0%,rgba(77,120,255,0.25),transparent_55%)]">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                            <div className="flex shrink-0">
                                <Avatar src={team.player1?.photoUrl} fallback={team.player1?.name || displayTitle} size="lg" className="w-14 h-14 border-[3px] border-[#0B1030] z-10" />
                                {team.player2 && <Avatar src={team.player2.photoUrl} fallback={team.player2.name || ''} size="lg" className="w-14 h-14 border-[3px] border-[#0B1030] -ml-5" />}
                            </div>
                            <div className="min-w-0">
                                <div className="text-2xl leading-tight font-black text-white truncate tracking-tight">{displayTitle}</div>
                                {showPlayersLine && <p className="text-sm text-white/60 truncate mt-0.5">{playersLine}</p>}
                            </div>
                        </div>
                        <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 w-10 h-10 grid place-items-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="mt-5 grid gap-px rounded-2xl overflow-hidden border border-white/10 bg-white/10" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
                        {stats.map(st => (
                            <div key={st.label} className="bg-[#0E1438] px-2 py-3 text-center">
                                <div className={`text-xl font-black ${st.tone || 'text-white'}`}>{st.value}</div>
                                <div className="text-[9px] text-white/50 font-bold uppercase tracking-widest mt-0.5 truncate">{st.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
                    {(team.player1 || team.player2) && (
                        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                            <div className="text-[11px] font-black tracking-widest text-[#7EA0FF] uppercase mb-3">{showContactInfo ? 'Players & contact' : 'Players'}</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {playerCard(team.player1, 'Player 1')}
                                {playerCard(team.player2, 'Player 2')}
                            </div>
                        </section>
                    )}

                    <div className="flex items-center gap-3">
                        <div className="flex flex-1 bg-white/5 p-1 rounded-full border border-white/10">
                            {(['RESULTS', 'UPCOMING'] as const).map(tab => (
                                <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                                    className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-full transition-all ${activeTab === tab ? 'bg-[#4D78FF] text-white shadow-lg shadow-[#4D78FF]/25' : 'text-white/55 hover:text-white'}`}>
                                    {tab === 'RESULTS' ? 'Results' : 'Upcoming'} <span className="opacity-70">({tab === 'RESULTS' ? completedMatches.length : upcomingMatches.length})</span>
                                </button>
                            ))}
                        </div>
                        <div className="flex bg-white/5 p-1 rounded-full border border-white/10">
                            {(['ALL', 'TODAY'] as const).map(per => (
                                <button key={per} type="button" onClick={() => setFilterPeriod(per)}
                                    className={`px-3 py-2 text-[11px] font-black uppercase tracking-wider rounded-full transition-all ${filterPeriod === per ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white'}`}>
                                    {per === 'ALL' ? 'All' : 'Today'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {displayMatches.length > 0 ? (
                        <div className="space-y-2.5">
                            {displayMatches.map((m: Match) => {
                                const t1Name = sideName(teams.find(x => x.id === m.team1Id), m.team1Name);
                                const t2Name = sideName(teams.find(x => x.id === m.team2Id), m.team2Name);
                                const badge = badgeOf(m);
                                const started = isDone(m) || isLive(m);
                                return (
                                    <div key={m.id} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
                                        <div className="flex items-center justify-between gap-3 mb-2.5">
                                            <span className="text-[10px] text-white/50 font-black uppercase tracking-widest truncate">
                                                {[m.roundName || 'Match', m.court, m.scheduledTime ? new Date(m.scheduledTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''].filter(Boolean).join(' · ')}
                                            </span>
                                            <span className={`shrink-0 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${badge.cls}`}>{badge.text}</span>
                                        </div>
                                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                                            <div className={`text-sm font-bold truncate ${m.team1Id === teamId ? 'text-white' : 'text-white/55'}`}>{t1Name}</div>
                                            <div className={`font-mono font-black text-sm px-3 py-1.5 rounded-lg border border-white/10 ${started ? 'bg-black/30 text-white' : 'bg-transparent text-white/40'}`}>{started ? scoreOf(m) : 'vs'}</div>
                                            <div className={`text-sm font-bold truncate text-right ${m.team2Id === teamId ? 'text-white' : 'text-white/55'}`}>{t2Name}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-white/50 text-sm py-12 text-center rounded-2xl border border-dashed border-white/10">
                            No {activeTab === 'RESULTS' ? 'results' : 'upcoming matches'}{filterPeriod === 'TODAY' ? ' today' : ''} yet.
                        </div>
                    )}
                </div>
            </aside>
        </div>,
        document.body
    );
};
