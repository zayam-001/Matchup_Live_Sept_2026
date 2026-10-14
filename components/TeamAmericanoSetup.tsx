import React from 'react';
import { ArrowDown, ArrowUp, Clock, Grid, Layers, Users } from 'lucide-react';
import type { TeamAmericanoConfig, TeamAmericanoTiebreaker } from '../types';
import {
    TARGET_POINT_PRESETS,
    TIEBREAKER_LABELS,
    resolveTeamAmericanoConfig,
    suggestedRounds,
    summarizeTeamAmericano,
} from '../lib/teamAmericano';

interface Props {
    value?: TeamAmericanoConfig;
    onChange: (next: TeamAmericanoConfig) => void;
    teamCount: number; // max teams entered in the form
    courtCount: number;
}

const fieldClass = 'w-full bg-surface-panel p-3 rounded-xl text-white text-sm border border-white/10 outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all';
const labelClass = 'block text-content-secondary text-sm mb-1 font-medium';

const formatMinutes = (mins: number) => {
    if (mins <= 0) return '-';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m ? `${m}m` : ''}`.trim() : `${m}m`;
};

/** Team Americano options + a live summary of what the settings produce. */
export const TeamAmericanoSetup: React.FC<Props> = ({ value, onChange, teamCount, courtCount }) => {
    const cfg = resolveTeamAmericanoConfig(value);
    const set = (patch: Partial<TeamAmericanoConfig>) => onChange({ ...(value || {}), ...patch });
    const num = (v: string) => (v === '' ? undefined : Math.max(0, parseInt(v, 10) || 0));

    const fullRounds = suggestedRounds(teamCount || 0);
    const summary = summarizeTeamAmericano(teamCount || 0, courtCount, value);

    const moveTiebreaker = (index: number, dir: -1 | 1) => {
        const list = [...cfg.tiebreakers];
        const target = index + dir;
        if (target < 0 || target >= list.length) return;
        [list[index], list[target]] = [list[target], list[index]];
        set({ tiebreakers: list as TeamAmericanoTiebreaker[] });
    };

    return (
        <div className="space-y-5 bg-surface-ground p-4 rounded-xl border border-white/5">
            <div>
                <p className="text-white font-bold text-sm">Team Americano</p>
                <p className="text-xs text-content-muted mt-0.5">Pairs register once as a team and keep the same partner. Opponents rotate every round and teams are ranked by total points scored.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className={labelClass}>Min Teams</label>
                    <input type="number" min={2} className={fieldClass} value={value?.minTeams ?? ''} placeholder={String(cfg.minTeams)} onChange={e => set({ minTeams: num(e.target.value) })} />
                </div>
                <div>
                    <label className={labelClass}>Rounds</label>
                    <input type="number" min={1} className={fieldClass} value={value?.rounds ?? ''} placeholder={fullRounds ? `${fullRounds} (suggested)` : 'Auto'} onChange={e => set({ rounds: num(e.target.value) || undefined })} />
                </div>
            </div>
            {fullRounds > 0 && (
                <p className="text-[11px] text-content-muted -mt-3">
                    {fullRounds} rounds lets every team meet every other team once{teamCount % 2 ? ', with one team on a bye each round' : ''}.
                    {cfg.rounds && cfg.rounds < fullRounds ? ' With fewer rounds some teams never meet.' : ''}
                </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className={labelClass}>Match Scoring</label>
                    <select className={fieldClass} value={cfg.scoringMode} onChange={e => set({ scoringMode: e.target.value as TeamAmericanoConfig['scoringMode'] })}>
                        <option value="points_total">Total points (match ends at N combined)</option>
                        <option value="first_to">First to N points</option>
                        <option value="timed">Timed (ends at the buzzer)</option>
                    </select>
                </div>
                {cfg.scoringMode !== 'timed' && (
                    <div>
                        <label className={labelClass}>Points (N)</label>
                        <div className="flex gap-2">
                            {TARGET_POINT_PRESETS.map(p => (
                                <button key={p} type="button" onClick={() => set({ targetPoints: p })}
                                    className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all ${cfg.targetPoints === p ? 'border-brand bg-brand/10 text-white' : 'border-white/10 text-content-secondary hover:border-white/30'}`}>
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className={labelClass}>Round Duration (min)</label>
                    <input type="number" min={1} className={fieldClass} value={cfg.roundDuration} onChange={e => set({ roundDuration: num(e.target.value) || 1 })} />
                </div>
                <div>
                    <label className={labelClass}>Break (min)</label>
                    <input type="number" min={0} className={fieldClass} value={cfg.breakMinutes} onChange={e => set({ breakMinutes: num(e.target.value) ?? 0 })} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className={labelClass}>Bye Score</label>
                    <select className={fieldClass} value={cfg.byeScoring} onChange={e => set({ byeScoring: e.target.value as TeamAmericanoConfig['byeScoring'] })}>
                        <option value="average">Tournament average per match</option>
                        <option value="fixed">Fixed number of points</option>
                        <option value="zero">Zero</option>
                    </select>
                </div>
                {cfg.byeScoring === 'fixed' && (
                    <div>
                        <label className={labelClass}>Points per Bye</label>
                        <input type="number" min={0} className={fieldClass} value={cfg.byePoints} onChange={e => set({ byePoints: num(e.target.value) ?? 0 })} />
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className={labelClass}>Finals</label>
                    <select className={fieldClass} value={cfg.finals} onChange={e => set({ finals: e.target.value as TeamAmericanoConfig['finals'] })}>
                        <option value="none">No finals (standings decide)</option>
                        <option value="top2">Top 2 play a final</option>
                        <option value="top4">Top 4: semifinals + final</option>
                    </select>
                </div>
                <div>
                    <label className={labelClass}>If a Team Withdraws</label>
                    <select className={fieldClass} value={cfg.withdrawalRule} onChange={e => set({ withdrawalRule: e.target.value as TeamAmericanoConfig['withdrawalRule'] })}>
                        <option value="keep">Keep their played matches</option>
                        <option value="void">Void their played matches</option>
                    </select>
                </div>
            </div>

            <div>
                <label className={labelClass}>Tiebreaker Order <span className="text-content-muted font-normal">(after total points)</span></label>
                <div className="space-y-1.5">
                    {cfg.tiebreakers.map((tb, i) => (
                        <div key={tb} className="flex items-center gap-3 bg-surface-panel border border-white/10 rounded-xl px-3 py-2">
                            <span className="w-5 h-5 rounded-full bg-white/10 text-[10px] font-bold text-white flex items-center justify-center">{i + 1}</span>
                            <span className="flex-1 text-sm text-white">{TIEBREAKER_LABELS[tb]}</span>
                            <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => moveTiebreaker(i, -1)} className="p-1 text-content-muted hover:text-white disabled:opacity-20"><ArrowUp size={14} /></button>
                            <button type="button" aria-label="Move down" disabled={i === cfg.tiebreakers.length - 1} onClick={() => moveTiebreaker(i, 1)} className="p-1 text-content-muted hover:text-white disabled:opacity-20"><ArrowDown size={14} /></button>
                        </div>
                    ))}
                    <p className="text-[11px] text-content-muted px-1">Still level after all of these: the teams are flagged as tied for the admin to decide or settle with a sudden-death playoff.</p>
                </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer select-none">
                <input type="checkbox" checked={cfg.showPlayerStandings} onChange={e => set({ showPlayerStandings: e.target.checked })} className="mt-0.5 w-4 h-4 accent-[#4D78FF]" />
                <span>
                    <span className="block text-white text-sm font-bold">Show individual player standings</span>
                    <span className="block text-xs text-content-muted mt-0.5">Adds a per-player view next to the team table. Both players share their team's result.</span>
                </span>
            </label>

            <div className="rounded-xl border border-brand/20 bg-brand/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand mb-3">Live Summary {teamCount ? `· ${teamCount} teams · ${courtCount || 0} court${courtCount === 1 ? '' : 's'}` : ''}</p>
                {teamCount >= 2 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                        <div><Layers size={14} className="mx-auto text-content-muted mb-1" /><div className="text-white font-black text-lg">{summary.matchesPerRound}</div><div className="text-[10px] text-content-muted uppercase tracking-wider">Matches / round</div></div>
                        <div><Grid size={14} className="mx-auto text-content-muted mb-1" /><div className="text-white font-black text-lg">{summary.totalMatches}</div><div className="text-[10px] text-content-muted uppercase tracking-wider">Total matches</div></div>
                        <div><Clock size={14} className="mx-auto text-content-muted mb-1" /><div className="text-white font-black text-lg">{formatMinutes(summary.totalMinutes)}</div><div className="text-[10px] text-content-muted uppercase tracking-wider">Est. duration</div></div>
                        <div><Users size={14} className="mx-auto text-content-muted mb-1" /><div className="text-white font-black text-lg">{summary.courtsNeeded}</div><div className="text-[10px] text-content-muted uppercase tracking-wider">Courts needed</div></div>
                    </div>
                ) : (
                    <p className="text-xs text-content-muted">Enter the number of teams to see the schedule size.</p>
                )}
                {teamCount >= 2 && (
                    <p className="text-[11px] text-content-muted mt-3">
                        {summary.rounds} rounds{summary.byesPerRound ? ' · 1 bye per round' : ''}{summary.finalsMatches ? ` · ${summary.finalsMatches} finals match${summary.finalsMatches > 1 ? 'es' : ''}` : ''}.
                        {courtCount > 0 && courtCount < summary.courtsNeeded ? ` With ${courtCount} court${courtCount === 1 ? '' : 's'}, each round runs in ${summary.wavesPerRound} waves (${formatMinutes(summary.minutesPerRound)} per round).` : ''}
                    </p>
                )}
            </div>
        </div>
    );
};

export default TeamAmericanoSetup;
