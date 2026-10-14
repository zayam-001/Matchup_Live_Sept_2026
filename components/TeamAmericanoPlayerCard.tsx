import React, { useMemo } from 'react';
import { Clock, Coffee, MapPin, Trophy, Users } from 'lucide-react';
import type { Match, Team, Tournament } from '../types';
import { useTournamentMatches } from '../hooks/useTournamentMatches';
import {
    computeTeamAmericanoStandings,
    getRoundOverview,
    getTeamAmericanoConfig,
    isMatchFinished,
    isTeamActive,
    matchPoints,
} from '../lib/teamAmericano';
import { isMatchInCategory, isTeamInCategory } from '../services/storage';

interface Props {
    tournament: Tournament;
    team: Team;
    playerEmail?: string;
    onOpen?: () => void;
    matches?: Match[]; // optional: skip the live subscription when the caller already has them
}

const cleanCourt = (c?: string | null) => String(c || '').replace(/"/g, '') || 'TBD';
const fmtTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : 'TBD');

/** Player-facing: my team, my standing, my next match/court, or my bye. */
export const TeamAmericanoPlayerCard: React.FC<Props> = ({ tournament, team, playerEmail, onOpen, matches: providedMatches }) => {
    const { matches: subscribedMatches } = useTournamentMatches(providedMatches ? null : tournament.id);
    const allMatches = providedMatches || subscribedMatches;
    const categoryId = team.categoryId || null;
    const cfg = getTeamAmericanoConfig(tournament, categoryId);

    const { standing, total, next, live, byeRound } = useMemo(() => {
        const matches = (allMatches || []).filter(m => isMatchInCategory(m, categoryId, tournament));
        const teams = (tournament.teams || []).filter(t => (t.status === 'ACCEPTED' || !isTeamActive(t)) && t.status !== 'REJECTED' && isTeamInCategory(t, categoryId, tournament, matches));
        const table = computeTeamAmericanoStandings(teams, matches, cfg).filter(t => isTeamActive(t));
        const mine = matches.filter(m => m.team1Id === team.id || m.team2Id === team.id);
        const live = mine.find(m => String(m.status).toUpperCase() === 'IN_PROGRESS');
        const next = mine
            .filter(m => !isMatchFinished(m) && m !== live)
            .sort((a, b) => (a.round - b.round) || String(a.scheduledTime || '').localeCompare(String(b.scheduledTime || '')))[0];
        const upcomingRound = getRoundOverview(teams, matches).find(r => !r.finished);
        const byeRound = upcomingRound && upcomingRound.byeTeamIds.includes(team.id) ? upcomingRound.round : null;
        return { standing: table.find(t => t.id === team.id), total: table.length, next, live, byeRound };
    }, [allMatches, tournament, team.id, categoryId]);

    const partner = team.player1?.email === playerEmail ? team.player2 : team.player1;
    const opponent = (m: { team1Id?: string; team2Id?: string; team1Name?: string; team2Name?: string }) =>
        m.team1Id === team.id ? (m.team2Name || 'TBD') : (m.team1Name || 'TBD');
    const myScore = (m: any) => {
        const [a, b] = matchPoints(m);
        return m.team1Id === team.id ? `${a} - ${b}` : `${b} - ${a}`;
    };

    return (
        <div onClick={onOpen} className={`rounded-2xl border border-brand/20 bg-surface-dark p-5 space-y-4 ${onOpen ? 'cursor-pointer hover:border-brand/50 transition-colors' : ''}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-brand">{tournament.name} · Team Americano</div>
                    <div className="text-xl font-black italic tracking-tight text-white truncate mt-1">{team.name}</div>
                    <div className="text-xs text-content-muted flex items-center gap-1.5 mt-0.5"><Users size={12} /> with {partner?.name || 'your partner'}</div>
                </div>
                {standing && standing.matchesPlayed + standing.byes > 0 && (
                    <div className="text-right shrink-0">
                        <div className="text-2xl font-black text-white">#{standing.standingRank}<span className="text-sm text-content-muted font-bold"> / {total}</span></div>
                        <div className="text-[11px] text-brand font-bold">{standing.points} pts · {standing.wins}W</div>
                    </div>
                )}
            </div>

            {live ? (
                <div className="rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 px-4 py-3 flex items-center justify-between gap-3">
                    <div className="text-sm text-white"><span className="text-[#10B981] font-black text-xs uppercase mr-2">Live</span>Round {live.round} vs <b>{opponent(live)}</b> · {cleanCourt(live.court)}</div>
                    <div className="font-mono font-black text-white">{myScore(live)}</div>
                </div>
            ) : byeRound ? (
                <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-content-secondary flex items-center gap-2">
                    <Coffee size={15} className="text-brand" /> You have a bye in round {byeRound}. It still earns standings points.
                </div>
            ) : next ? (
                <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-content-muted mb-1">Next match · Round {next.round}{next.stage === 'KNOCKOUT' ? ` · ${next.roundName}` : ''}</div>
                    <div className="text-white font-bold">vs {opponent(next)}</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-content-secondary">
                        <span className="flex items-center gap-1"><MapPin size={12} /> {cleanCourt(next.court)}</span>
                        <span className="flex items-center gap-1"><Clock size={12} /> {fmtTime(next.scheduledTime)}</span>
                    </div>
                </div>
            ) : standing && standing.knockoutStage === 'CHAMPION' ? (
                <div className="rounded-xl bg-[#FFD700]/10 border border-[#FFD700]/30 px-4 py-3 text-sm text-white flex items-center gap-2"><Trophy size={15} className="text-[#FFD700]" /> Champions!</div>
            ) : (
                <div className="text-xs text-content-muted">{allMatches.length ? 'No more matches scheduled for your team.' : 'The schedule hasn\'t been published yet.'}</div>
            )}
        </div>
    );
};

export default TeamAmericanoPlayerCard;
