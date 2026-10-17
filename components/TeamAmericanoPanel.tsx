import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, Ban, Check, Coffee, Edit3, Loader2, Mail, RefreshCcw, RotateCcw, Shuffle, Trophy, UserMinus } from 'lucide-react';
import { auth, resetMatchToScheduled } from '../services/storage';
import type { Match, Team, Tournament } from '../types';
import {
    getRoundOverview,
    getTeamAmericanoConfig,
    isFinalsMatch,
    isMatchFinished,
    isMatchStarted,
    isTeamActive,
    matchPoints,
    summarizeTeamAmericano,
} from '../lib/teamAmericano';
import {
    generateSchedule,
    generateTeamAmericanoFinals,
    isTeamInCategory,
    regenerateTeamAmericanoRemainingRounds,
    sendTeamAmericanoRoundAlerts,
    swapTeamAmericanoTeams,
    updateTeamStatus,
} from '../services/storage';
import { toast } from './Toast';

interface Props {
    tournament: Tournament;
    categoryId: string | null;
    matches: Match[]; // already filtered to this category
    /** Open the admin's enter/correct-final-score dialog for a match. */
    onEnterResult?: (m: Match) => void;
}

const SCORING_LABEL = { points_total: 'total points', first_to: 'first to', timed: 'timed rounds' } as const;

const cleanCourt = (c?: string | null) => String(c || '').replace(/"/g, '') || 'TBD';
const fmtTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : 'TBD');

/** Schedule, byes, swaps, withdrawals, finals and round alerts for a Team Americano event. */
export const TeamAmericanoPanel: React.FC<Props> = ({ tournament, categoryId, matches, onEnterResult }) => {
    const cfg = getTeamAmericanoConfig(tournament, categoryId);
    const [busy, setBusy] = useState<string | null>(null);
    const [swap, setSwap] = useState<{ round: number; picked: string[] } | null>(null);

    const teams = useMemo(
        () => (tournament.teams || []).filter(t => t.status !== 'PENDING' && t.status !== 'REJECTED' && isTeamInCategory(t, categoryId, tournament, matches)),
        [tournament.teams, categoryId, matches],
    );
    const activeTeams = teams.filter(t => t.status === 'ACCEPTED' && isTeamActive(t));
    const inactiveTeams = teams.filter(t => !isTeamActive(t));
    const teamName = (id?: string) => teams.find(t => t.id === id)?.name || 'TBD';

    const roundMatches = matches.filter(m => !isFinalsMatch(m));
    const finals = matches.filter(isFinalsMatch).sort((a, b) => (a.round - b.round) || String(a.roundName).localeCompare(String(b.roundName)));
    const rounds = useMemo(() => getRoundOverview(teams, roundMatches), [teams, roundMatches]);
    const anyStarted = rounds.some(r => r.started);
    const openRounds = rounds.filter(r => !r.started);
    const allRoundsDone = rounds.length > 0 && rounds.every(r => r.finished);
    const scheduledIds = new Set(roundMatches.flatMap(m => [m.team1Id, m.team2Id]));
    const fieldChanged = rounds.length > 0 && (
        activeTeams.some(t => !scheduledIds.has(t.id)) ||
        openRounds.some(r => r.matches.some(m => !activeTeams.some(t => t.id === m.team1Id) || !activeTeams.some(t => t.id === m.team2Id)))
    );

    const courts = (categoryId ? tournament.categories?.find(c => c.id === categoryId)?.courts : undefined) || tournament.courts || [];
    const summary = summarizeTeamAmericano(activeTeams.length, courts.length, cfg);

    const run = async (key: string, fn: () => Promise<unknown>, success?: string) => {
        setBusy(key);
        try {
            await fn();
            if (success) toast.success(success);
        } catch (e: any) {
            console.error(e);
            toast.error("That didn't work", e?.message || 'Please try again.');
        } finally {
            setBusy(null);
        }
    };

    const generate = () => {
        if (rounds.length > 0 && !window.confirm('Regenerate the whole schedule? Every current Team Americano match is replaced with a new draw.')) return;
        run('generate', () => generateSchedule(tournament.id, undefined, {
            slots: [], courts: [], matchDuration: cfg.roundDuration, bufferTime: cfg.breakMinutes, useSeeding: false, categoryId,
        }), 'Schedule generated');
    };

    const changeStatus = (team: Team, status: 'WITHDRAWN' | 'DISQUALIFIED' | 'ACCEPTED') => {
        const verb = status === 'ACCEPTED' ? 'Reinstate' : status === 'WITHDRAWN' ? 'Withdraw' : 'Disqualify';
        const note = status === 'ACCEPTED' ? '' : cfg.withdrawalRule === 'void'
            ? '\n\nTheir played matches will be voided (this tournament is set to void them).'
            : '\n\nTheir played matches stay in the standings (this tournament is set to keep them).';
        if (!window.confirm(`${verb} ${team.name}?${note}${anyStarted && status !== 'ACCEPTED' ? '\n\nAfterwards, use "Regenerate remaining rounds" to rebuild the rounds that haven\'t started.' : ''}`)) return;
        run(`status_${team.id}`, () => updateTeamStatus(tournament.id, team.id, status), `${team.name}: ${status.toLowerCase()}`);
    };

    const togglePick = (round: number, teamId: string) => {
        const picked = swap && swap.round === round ? swap.picked : [];
        const next = picked.includes(teamId) ? picked.filter(id => id !== teamId) : [...picked, teamId];
        if (next.length < 2) {
            setSwap({ round, picked: next });
            return;
        }
        setSwap(null);
        run('swap', () => swapTeamAmericanoTeams(tournament.id, round, next[0], next[1], categoryId), `Swapped ${teamName(next[0])} and ${teamName(next[1])}`);
    };

    const chip = (round: number, teamId: string | undefined, swappable: boolean) => {
        if (!teamId) return <span className="text-content-muted">TBD</span>;
        const picked = swap?.round === round && swap.picked.includes(teamId);
        if (!swappable) return <span className="font-bold text-white truncate">{teamName(teamId)}</span>;
        return (
            <button type="button" onClick={() => togglePick(round, teamId)}
                className={`font-bold truncate px-2 py-0.5 rounded-md border transition-colors ${picked ? 'border-brand bg-brand/20 text-white' : 'border-dashed border-white/20 text-white hover:border-brand'}`}>
                {teamName(teamId)}
            </button>
        );
    };

    const isLiveMatch = (m: Match) => ['IN_PROGRESS', 'LIVE'].includes(String(m.status).toUpperCase());
    // Per-match admin actions: undo a mistaken start, enter/correct the result.
    const actionsCell = (m: Match) => (
        <span className="flex items-center justify-end gap-1">
            {isLiveMatch(m) && (
                <button type="button" title="Reset to not started (started by mistake)" disabled={!!busy}
                    onClick={() => {
                        const pts = (m.score?.history || []).length;
                        if (!window.confirm(pts ? `This match already has ${pts} point(s) scored. Reset it to not started and clear the score?` : 'Reset this match to not started? It leaves the live screens.')) return;
                        run(`reset_${m.id}`, () => resetMatchToScheduled(tournament.id, m.id, auth?.currentUser?.email || 'admin'), 'Match reset to not started');
                    }}
                    className="p-1.5 rounded-lg text-content-muted hover:text-amber-300 hover:bg-amber-500/10"><RotateCcw size={14} /></button>
            )}
            {onEnterResult && m.team1Id && m.team2Id && (
                <button type="button" title={isMatchFinished(m) ? 'Correct final score' : 'Enter final score & complete'} disabled={!!busy}
                    onClick={() => onEnterResult(m)}
                    className={`p-1.5 rounded-lg ${isMatchFinished(m) ? 'text-content-muted hover:text-white hover:bg-white/10' : 'text-brand hover:bg-brand/15'}`}>
                    {isMatchFinished(m) ? <Edit3 size={14} /> : <Check size={14} />}
                </button>
            )}
        </span>
    );

    const scoreCell = (m: Match) => {
        if (!isMatchStarted(m)) return <span className="text-content-muted text-xs">{fmtTime(m.scheduledTime)}</span>;
        const [a, b] = matchPoints(m);
        return <span className={`font-mono font-black ${isMatchFinished(m) ? 'text-white' : 'text-[#10B981]'}`}>{a} - {b}</span>;
    };

    return (
        <div className="space-y-5">
            <div className="rounded-2xl border border-brand/20 bg-brand/5 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <p className="text-white font-black uppercase tracking-wider text-sm">Team Americano</p>
                    <p className="text-xs text-content-secondary mt-1">
                        {activeTeams.length} teams · {summary.rounds} rounds · {summary.matchesPerRound} matches per round
                        {summary.byesPerRound ? ' · 1 bye per round' : ''} · {SCORING_LABEL[cfg.scoringMode]}{cfg.scoringMode !== 'timed' ? ` ${cfg.targetPoints}` : ` (${cfg.roundDuration} min)`}
                        {cfg.finals !== 'none' ? ` · ${cfg.finals === 'top2' ? 'top-2 final' : 'top-4 playoff'}` : ''}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {!anyStarted && (
                        <button type="button" onClick={generate} disabled={!!busy || activeTeams.length < 2}
                            className="bg-brand hover:bg-brand-light disabled:opacity-50 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                            {busy === 'generate' ? <Loader2 size={15} className="animate-spin" /> : <Shuffle size={15} />}
                            {rounds.length ? 'Regenerate Schedule' : 'Generate Schedule'}
                        </button>
                    )}
                    {anyStarted && openRounds.length > 0 && (
                        <button type="button" disabled={!!busy}
                            onClick={() => window.confirm(`Rebuild the ${openRounds.length} round(s) that haven't started, using the current team list? Played rounds are kept.`) && run('regen', () => regenerateTeamAmericanoRemainingRounds(tournament.id, categoryId), 'Remaining rounds regenerated')}
                            className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 border disabled:opacity-50 ${fieldChanged ? 'bg-amber-500 border-amber-500 text-black' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}>
                            {busy === 'regen' ? <Loader2 size={15} className="animate-spin" /> : <RefreshCcw size={15} />} Regenerate Remaining Rounds
                        </button>
                    )}
                    {cfg.finals !== 'none' && allRoundsDone && !finals.some(isMatchStarted) && (
                        <button type="button" disabled={!!busy} onClick={() => run('finals', () => generateTeamAmericanoFinals(tournament.id, categoryId), 'Finals created')}
                            className="bg-[#E65C31] hover:bg-[#E65C31]/90 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                            {busy === 'finals' ? <Loader2 size={15} className="animate-spin" /> : <Trophy size={15} />} {finals.length ? 'Recreate Finals' : 'Create Finals'}
                        </button>
                    )}
                </div>
            </div>

            {fieldChanged && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                    The team list no longer matches the schedule (a team was added, withdrew or was disqualified). {anyStarted ? 'Regenerate the remaining rounds' : 'Regenerate the schedule'} to fix it.
                </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-surface-panel p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-content-muted mb-3">Teams ({activeTeams.length}{cfg.minTeams ? `, min ${cfg.minTeams}` : ''})</p>
                <div className="grid sm:grid-cols-2 gap-2">
                    {activeTeams.map(t => (
                        <div key={t.id} className="flex items-center gap-2 bg-surface-ground rounded-xl px-3 py-2 border border-white/5">
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-white truncate">{t.name}</div>
                                <div className="text-[11px] text-content-muted truncate">{[t.player1?.name, t.player2?.name].filter(Boolean).join(' & ')}</div>
                            </div>
                            <button type="button" title="Withdraw" disabled={!!busy} onClick={() => changeStatus(t, 'WITHDRAWN')} className="p-1.5 rounded-lg text-content-muted hover:text-amber-300 hover:bg-amber-500/10"><UserMinus size={15} /></button>
                            <button type="button" title="Disqualify" disabled={!!busy} onClick={() => changeStatus(t, 'DISQUALIFIED')} className="p-1.5 rounded-lg text-content-muted hover:text-red-400 hover:bg-red-500/10"><Ban size={15} /></button>
                        </div>
                    ))}
                </div>
                {inactiveTeams.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {inactiveTeams.map(t => (
                            <span key={t.id} className="inline-flex items-center gap-2 text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-content-muted">
                                <span className="line-through">{t.name}</span>
                                <span className="uppercase text-[9px] font-bold">{String(t.status).toLowerCase()}</span>
                                <button type="button" className="text-brand hover:underline" onClick={() => changeStatus(t, 'ACCEPTED')}>Reinstate</button>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {rounds.length === 0 ? (
                <div className="p-10 text-center text-content-muted text-sm border border-dashed border-white/10 rounded-2xl">
                    No schedule yet. Accept at least {cfg.minTeams} teams, then generate the schedule.
                </div>
            ) : (
                <div className="space-y-3">
                    {swap && <p className="text-xs text-brand px-1">Round {swap.round}: pick a second team to swap with {teamName(swap.picked[0])}. <button className="underline" onClick={() => setSwap(null)}>Cancel</button></p>}
                    {rounds.map(r => {
                        const canSwap = !r.started;
                        return (
                            <div key={r.round} className="rounded-2xl border border-white/10 bg-surface-panel overflow-hidden">
                                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-white/[0.03] border-b border-white/5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-white font-black text-sm">Round {r.round}</span>
                                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${r.finished ? 'bg-white/10 text-content-muted' : r.started ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-brand/15 text-brand'}`}>
                                            {r.finished ? 'Done' : r.started ? 'In play' : 'Upcoming'}
                                        </span>
                                        <span className="text-[11px] text-content-muted">{fmtTime(r.matches[0]?.scheduledTime)}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {canSwap && (
                                            <button type="button" onClick={() => setSwap(swap?.round === r.round ? null : { round: r.round, picked: [] })}
                                                className={`text-[11px] font-bold px-2 py-1 rounded-md flex items-center gap-1 ${swap?.round === r.round ? 'bg-brand text-white' : 'text-content-muted hover:text-white'}`}>
                                                <ArrowLeftRight size={12} /> Swap
                                            </button>
                                        )}
                                        {!r.finished && (
                                            <button type="button" disabled={!!busy}
                                                onClick={() => run(`mail_${r.round}`, async () => {
                                                    const sent = await sendTeamAmericanoRoundAlerts(tournament.id, r.round, categoryId);
                                                    toast.success(`Round ${r.round} alerts sent`, `${sent} email${sent === 1 ? '' : 's'} queued.`);
                                                })}
                                                className="text-[11px] font-bold px-2 py-1 rounded-md flex items-center gap-1 text-content-muted hover:text-white">
                                                {busy === `mail_${r.round}` ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />} Alert players
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="divide-y divide-white/5">
                                    {r.matches.map(m => (
                                        <div key={m.id} className="grid grid-cols-[72px_1fr_auto_1fr_64px] sm:grid-cols-[96px_1fr_90px_1fr_72px] items-center gap-2 px-4 py-2.5 text-sm">
                                            <span className="text-[11px] font-bold text-content-muted uppercase truncate">{cleanCourt(m.court)}</span>
                                            <span className="flex justify-end min-w-0">{chip(r.round, m.team1Id, canSwap && swap?.round === r.round)}</span>
                                            <span className="text-center">{scoreCell(m)}</span>
                                            <span className="flex min-w-0">{chip(r.round, m.team2Id, canSwap && swap?.round === r.round)}</span>
                                            {actionsCell(m)}
                                        </div>
                                    ))}
                                    {r.byeTeamIds.map(id => (
                                        <div key={id} className="flex items-center gap-2 px-4 py-2 text-xs text-content-muted">
                                            <Coffee size={13} /> Bye: {canSwap && swap?.round === r.round ? chip(r.round, id, true) : <span className="text-white font-bold">{teamName(id)}</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}

                    {finals.length > 0 && (
                        <div className="rounded-2xl border border-[#E65C31]/30 bg-surface-panel overflow-hidden">
                            <div className="px-4 py-2.5 bg-[#E65C31]/10 border-b border-white/5 text-white font-black text-sm flex items-center gap-2"><Trophy size={14} className="text-[#E65C31]" /> Finals</div>
                            <div className="divide-y divide-white/5">
                                {finals.map(m => (
                                    <div key={m.id} className="grid grid-cols-[96px_1fr_90px_1fr] items-center gap-2 px-4 py-2.5 text-sm">
                                        <span className="text-[11px] font-bold text-[#E65C31] uppercase">{m.roundName}</span>
                                        <span className="text-right font-bold text-white truncate">{m.team1Id ? teamName(m.team1Id) : 'Winner SF1'}</span>
                                        <span className="text-center">{scoreCell(m)}</span>
                                        <span className="font-bold text-white truncate">{m.team2Id ? teamName(m.team2Id) : 'Winner SF2'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TeamAmericanoPanel;
