import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronRight, Download } from 'lucide-react';
import type { Match, Team, Tournament } from '../types';
import {
    computeTeamAmericanoStandings,
    getTeamAmericanoConfig,
    isTeamActive,
    toPlayerStandings,
    type TeamAmericanoStanding,
} from '../lib/teamAmericano';
import { isMatchInCategory, isTeamInCategory } from '../services/storage';

interface Props {
    tournament: Tournament;
    categoryId?: string | null;
    matches: Match[];
    onTeamSelect?: (team: Team) => void;
    showExport?: boolean;
}

const STAGE_BADGE: Record<string, string> = {
    CHAMPION: 'Champion',
    RUNNER_UP: 'Runner-up',
    SEMI_FINALIST: 'Semifinal',
};

const rankBadge = (rank: number) => {
    const styles = rank === 1 ? 'bg-[#FFD700] text-[#8B6508]' : rank === 2 ? 'bg-[#C0C0C0] text-[#4A4A4A]' : rank === 3 ? 'bg-[#CD7F32] text-[#5C3A16]' : 'bg-white/10 text-gray-400';
    return <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${styles}`}>{rank}</span>;
};

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/**
 * Live Team Americano standings, always derived from the matches so admins,
 * spectators and players see the same ranking.
 */
export const TeamAmericanoStandings: React.FC<Props> = ({ tournament, categoryId, matches, onTeamSelect, showExport }) => {
    const cfg = getTeamAmericanoConfig(tournament, categoryId);
    const [view, setView] = useState<'teams' | 'players'>('teams');

    const standings = useMemo(() => {
        const catMatches = (matches || []).filter(m => isMatchInCategory(m, categoryId || null, tournament));
        const teams = (tournament.teams || []).filter(t =>
            (t.status === 'ACCEPTED' || !isTeamActive(t)) && t.status !== 'REJECTED' && isTeamInCategory(t, categoryId || null, tournament, catMatches));
        return computeTeamAmericanoStandings(teams, catMatches, cfg).filter(t => isTeamActive(t));
    }, [tournament, categoryId, matches]);

    const players = useMemo(() => toPlayerStandings(standings as TeamAmericanoStanding[]), [standings]);
    const hasUnresolvedTie = standings.some(t => t.tieUnresolved && t.standingRank <= 4);

    const exportCsv = () => {
        const header = ['Rank', 'Team', 'Player 1', 'Player 2', 'Played', 'Wins', 'Losses', 'Draws', 'Points For', 'Points Against', 'Differential', 'Byes', 'Bye Points', 'Total Points'];
        const rows = standings.map(t => [t.standingRank, t.name, t.player1?.name, t.player2?.name, t.matchesPlayed, t.wins, t.losses, t.ties, t.pointsScored, t.pointsConceded, t.pointDifferential, t.byes, t.byePoints, t.points]);
        const csv = [header, ...rows].map(r => r.map(csvCell).join(',')).join('\n');
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(tournament.name || 'tournament').replace(/\s+/g, '_')}_Team_Americano_Standings.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (standings.length === 0) {
        return <div className="p-10 text-center text-content-muted text-sm border border-dashed border-white/10 rounded-2xl">No confirmed teams yet.</div>;
    }

    return (
        <div className="space-y-3 w-full">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-[#4D78FF] font-black text-sm uppercase tracking-[0.2em] flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#4D78FF] animate-pulse" />
                    Team Americano Standings
                </h3>
                <div className="flex items-center gap-2">
                    {cfg.showPlayerStandings && (
                        <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10">
                            {(['teams', 'players'] as const).map(v => (
                                <button key={v} type="button" onClick={() => setView(v)}
                                    className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors ${view === v ? 'bg-brand text-white' : 'text-content-muted hover:text-white'}`}>
                                    {v}
                                </button>
                            ))}
                        </div>
                    )}
                    {showExport && (
                        <button type="button" onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-white/10">
                            <Download size={13} /> CSV
                        </button>
                    )}
                </div>
            </div>

            {hasUnresolvedTie && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    Teams marked "Tied" are still level after every tiebreaker. The organizer decides the order or runs a sudden-death playoff.
                </div>
            )}

            <div className="bg-[#0A0A0A] rounded-2xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                    {view === 'teams' ? (
                        <table className="w-full text-left font-mono min-w-[640px]">
                            <thead className="bg-[#111111] text-[10px] text-content-muted font-black uppercase tracking-widest border-b border-white/10">
                                <tr>
                                    <th className="px-3 md:px-5 py-3">Team</th>
                                    <th className="px-2 py-3 text-center" title="Matches played">P</th>
                                    <th className="px-2 py-3 text-center" title="Wins - Losses - Draws">W-L-D</th>
                                    <th className="px-2 py-3 text-center" title="Points for">PF</th>
                                    <th className="px-2 py-3 text-center" title="Points against">PA</th>
                                    <th className="px-2 py-3 text-center" title="Point differential">+/-</th>
                                    <th className="px-2 py-3 text-center" title="Byes (points awarded)">Byes</th>
                                    <th className="px-3 md:px-5 py-3 text-right text-[#4D78FF]" title="Total points (points for + bye points)">Pts</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {standings.map(t => (
                                    <tr key={t.id} onClick={() => onTeamSelect?.(t)} className={`hover:bg-white/[0.03] transition-colors group ${onTeamSelect ? 'cursor-pointer' : ''}`}>
                                        <td className="px-3 md:px-5 py-3">
                                            <div className="flex items-center gap-2.5">
                                                {rankBadge(t.standingRank)}
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-black text-white text-sm truncate">{t.name || 'TBA'}</span>
                                                        {STAGE_BADGE[t.knockoutStage] && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand/20 text-brand shrink-0">{STAGE_BADGE[t.knockoutStage]}</span>}
                                                        {t.tieUnresolved && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 shrink-0">Tied</span>}
                                                    </div>
                                                    <div className="text-[11px] text-content-muted truncate font-sans">{[t.player1?.name, t.player2?.name].filter(Boolean).join(' & ')}</div>
                                                </div>
                                                {onTeamSelect && <ChevronRight size={14} className="text-[#9CA3AF] opacity-0 group-hover:opacity-100 shrink-0 ml-auto" />}
                                            </div>
                                        </td>
                                        <td className="px-2 py-3 text-center text-[#8A9AB0] text-sm">{t.matchesPlayed}</td>
                                        <td className="px-2 py-3 text-center text-content-secondary text-sm">{t.wins}-{t.losses}-{t.ties}</td>
                                        <td className="px-2 py-3 text-center text-white text-sm">{t.pointsScored}</td>
                                        <td className="px-2 py-3 text-center text-[#8A9AB0] text-sm">{t.pointsConceded}</td>
                                        <td className={`px-2 py-3 text-center text-sm font-bold ${t.pointDifferential > 0 ? 'text-[#10B981]' : t.pointDifferential < 0 ? 'text-[#EF4444]' : 'text-[#8A9AB0]'}`}>{t.pointDifferential > 0 ? `+${t.pointDifferential}` : t.pointDifferential}</td>
                                        <td className="px-2 py-3 text-center text-[#8A9AB0] text-sm" title={t.byes ? `${t.byePoints} bye points` : undefined}>{t.byes ? `${t.byes} (+${t.byePoints})` : '-'}</td>
                                        <td className="px-3 md:px-5 py-3 text-right text-[#4D78FF] font-black text-lg">{t.points}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full text-left font-mono min-w-[480px]">
                            <thead className="bg-[#111111] text-[10px] text-content-muted font-black uppercase tracking-widest border-b border-white/10">
                                <tr>
                                    <th className="px-3 md:px-5 py-3">Player</th>
                                    <th className="px-2 py-3">Team</th>
                                    <th className="px-2 py-3 text-center">P</th>
                                    <th className="px-2 py-3 text-center">W</th>
                                    <th className="px-3 md:px-5 py-3 text-right text-[#4D78FF]">Pts</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {players.map(p => (
                                    <tr key={p.key}>
                                        <td className="px-3 md:px-5 py-3"><div className="flex items-center gap-2.5">{rankBadge(p.rank)}<span className="text-white text-sm font-bold">{p.playerName}</span></div></td>
                                        <td className="px-2 py-3 text-content-secondary text-sm">{p.teamName}</td>
                                        <td className="px-2 py-3 text-center text-[#8A9AB0] text-sm">{p.matchesPlayed}</td>
                                        <td className="px-2 py-3 text-center text-[#10B981] text-sm">{p.wins}</td>
                                        <td className="px-3 md:px-5 py-3 text-right text-[#4D78FF] font-black">{p.points}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
            <p className="text-[10px] text-content-muted px-1">Ranked by total points, then: {cfg.tiebreakers.map(tb => ({ wins: 'wins', pointDiff: 'point difference', headToHead: 'head-to-head', fewestByes: 'fewest byes' }[tb])).join(' → ')}.</p>
        </div>
    );
};

export default TeamAmericanoStandings;
