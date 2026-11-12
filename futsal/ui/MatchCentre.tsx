import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Clock3, Hand, Repeat } from 'lucide-react';
import { eventMinute, foulsFor, phaseLabel, periodName, scoreOf, shortHanded, timeoutsLeft, fmtClock } from '../engine';
import { goalTypeLabel } from '../presets';
import type { FutsalEvent, FutsalMatch, FutsalTeam, Side } from '../types';
import { SIDE_FILL } from './palette';
import { Ball, catOf, clockText, Crest, Empty, fmtDay, fmtTime, Loading, playerName, Shell, stageText, teamName, useFutsalTournament, useNow } from './shared';
import { publicPath } from '../sport';

const EV_TEXT: Partial<Record<FutsalEvent['type'], string>> = { GOAL: 'Goal', OWN_GOAL: 'Own goal', YELLOW: 'Yellow card', RED: 'Red card', TIMEOUT: 'Timeout', SUB: 'Substitution', FOUL: 'Foul' };

export const MatchCentre: React.FC<{ tournamentId: string; matchId: string }> = ({ tournamentId, matchId }) => {
    const { t, teams, matches, loading } = useFutsalTournament(tournamentId);
    const m = matches.find(x => x.id === matchId);
    const now = useNow(500, m?.status === 'LIVE');
    const [tab, setTab] = useState<'timeline' | 'lineups' | 'stats'>('timeline');
    useEffect(() => {
        if (!t || !m) return;
        const s = scoreOf(m);
        document.title = `${teamName(teams, m.homeId)} ${m.status === 'SCHEDULED' ? 'v' : `${s.home}-${s.away}`} ${teamName(teams, m.awayId)} | ${t.name}`;
    }, [t, m, teams]);

    if (loading) return <Shell><div className="fx-wrap"><Loading /></div></Shell>;
    if (!t || !m) return <Shell><div className="fx-wrap"><Empty title="Match not found">It may have been removed.</Empty></div></Shell>;

    const cat = catOf(t, m.categoryId);
    const home = teams.find(x => x.id === m.homeId), away = teams.find(x => x.id === m.awayId);
    const s = scoreOf(m);
    const live = m.status === 'LIVE';
    const running = live && m.periodState === 'PLAYING';
    const shorts = shortHanded(m, cat.rules, now);
    const goals = (side: Side) => m.events.filter(e => (e.type === 'GOAL' && e.side === side && !e.auto) || (e.type === 'OWN_GOAL' && e.side !== side));
    const sideLabel = (side: Side) => side === 'home' ? teamName(teams, m.homeId, m.homeFrom, matches) : teamName(teams, m.awayId, m.awayFrom, matches);

    return (
        <Shell tour={t}>
            <div className="fx-wrap fx-mc">
                <p className="fx-mc__meta">
                    {cat.name} · {stageText(m)} · {m.startAt ? `${fmtDay(m.startAt)}, ${fmtTime(m.startAt)}` : 'Time TBC'}{m.pitch ? ` · ${m.pitch}` : ''}
                </p>

                <div className="fx-card fx-mc__board">
                    <div className="fx-mc__teams">
                        <div className="fx-mc__team"><Crest team={home} size={76} label="?" /><h2>{sideLabel('home')}</h2></div>
                        <div className="fx-mc__score">
                            {live ? <span className="fx-pill fx-pill--live">{phaseLabel(m, cat.rules)}</span> : <span className="fx-pill">{m.status === 'SCHEDULED' ? 'Kick-off' : phaseLabel(m, cat.rules)}</span>}
                            <b className="fx-silver">{m.status === 'SCHEDULED' ? fmtTime(m.startAt) : `${s.home} – ${s.away}`}</b>
                            {live && ['PLAYING', 'PAUSED'].includes(m.periodState) && <span className={`fx-mc__clock ${running ? 'is-run' : ''}`}>{clockText(m, cat, now)}</span>}
                            {s.hasPens && <span className="fx-mc__pens">Penalties {s.pensHome} – {s.pensAway}</span>}
                            {m.decidedBy === 'forfeit' && <span className="fx-mc__pens">Walkover</span>}
                        </div>
                        <div className="fx-mc__team"><Crest team={away} size={76} label="?" /><h2>{sideLabel('away')}</h2></div>
                    </div>
                    {m.status !== 'SCHEDULED' && (
                        <div className="fx-scorers">
                            {(['home', 'away'] as Side[]).map(side => (
                                <div key={side}>
                                    {goals(side).map(e => <p key={e.id}><Ball className="" /> {playerName(teams, e.playerId)}{e.type === 'OWN_GOAL' ? ' (og)' : ''} {eventMinute(cat.rules, e)}</p>)}
                                </div>
                            ))}
                        </div>
                    )}
                    {live && (
                        <div className="fx-mc__counters">
                            {(['home', 'away'] as Side[]).map(side => {
                                const f = foulsFor(m, cat.rules, side);
                                const limit = cat.rules.foulLimit;
                                const short = shorts.find(x => x.side === side);
                                return (
                                    <div key={side} className="fx-counter">
                                        {limit > 0 && <span>Fouls <span className={`fx-fouls ${f >= limit ? 'is-limit' : ''}`}>{Array.from({ length: limit }, (_, i) => <i key={i} className={i < f ? 'on' : ''} />)}</span>{f > limit ? ` +${f - limit}` : ''}</span>}
                                        {cat.rules.timeoutsPerPeriod > 0 && m.period <= cat.rules.periods && <span>Timeout {timeoutsLeft(m, cat.rules, side) ? '✓' : 'used'}</span>}
                                        {short && <span className="fx-short">Player down {fmtClock(short.remainingMs)}</span>}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="fx-sticky-tabs" style={{ marginTop: 14 }}>
                    <nav className="fx-tabs" aria-label="Match sections">
                        {([['timeline', 'Timeline'], ['lineups', 'Lineups'], ['stats', 'Stats']] as const).map(([x, label]) => <button key={x} type="button" className={tab === x ? 'is-on' : ''} onClick={() => setTab(x)}>{label}</button>)}
                        <a href={`#${publicPath(t)}`}>Tournament details</a>
                    </nav>
                </div>

                <section className="fx-section" style={{ marginTop: 14 }}>
                    {tab === 'timeline' && <Timeline m={m} teams={teams} rulesOf={cat.rules} />}
                    {tab === 'lineups' && <Lineups m={m} home={home} away={away} onPitch={cat.rules.onPitch} />}
                    {tab === 'stats' && <MatchStats m={m} />}
                </section>
            </div>
        </Shell>
    );
};

const Timeline: React.FC<{ m: FutsalMatch; teams: FutsalTeam[]; rulesOf: any }> = ({ m, teams, rulesOf }) => {
    const evs = [...m.events].filter(e => e.type !== 'FOUL' && !(e.auto && e.type === 'GOAL')).reverse();
    if (!evs.length) return <Empty title={m.status === 'SCHEDULED' ? 'Not started' : 'Quiet so far'}>Goals, cards and substitutions appear here live.</Empty>;
    return (
        <div className="fx-timeline">
            {evs.map(e => {
                if (e.type === 'PERIOD_START' || e.type === 'PERIOD_END') {
                    return <div key={e.id} className="fx-ev fx-ev--marker"><span>{e.type === 'PERIOD_START' ? `${periodName(rulesOf, e.period)} · kick-off` : `End of ${periodName(rulesOf, e.period).toLowerCase()}`}</span></div>;
                }
                if (e.type === 'PEN_SCORED' || e.type === 'PEN_MISSED') {
                    return (
                        <div key={e.id} className={`fx-ev fx-ev--${e.side}`}>
                            <div className="fx-ev__body"><span className="fx-icon">{e.type === 'PEN_SCORED' ? '✓' : '✕'}</span><span>Penalty {e.type === 'PEN_SCORED' ? 'scored' : 'missed'}{e.playerId ? ` · ${playerName(teams, e.playerId)}` : ''}</span></div>
                            <span className="fx-ev__min">P</span>
                        </div>
                    );
                }
                const icon = e.type === 'GOAL' || e.type === 'OWN_GOAL' ? <span className="fx-icon fx-icon--goal"><Ball /></span>
                    : e.type === 'YELLOW' ? <span className="fx-icon"><span className="fx-card-y" /></span>
                        : e.type === 'RED' ? <span className="fx-icon"><span className="fx-card-r" /></span>
                            : e.type === 'SUB' ? <span className="fx-icon"><Repeat /></span>
                                : e.type === 'TIMEOUT' ? <span className="fx-icon"><Clock3 /></span> : <span className="fx-icon"><Hand /></span>;
                const who = e.type === 'SUB' ? `${playerName(teams, e.inId)} on` : e.playerId ? playerName(teams, e.playerId) : '';
                const sub = e.type === 'GOAL' && (e.assistId || e.goalType) ? [e.goalType && goalTypeLabel(e.goalType), e.assistId && `Assist: ${playerName(teams, e.assistId)}`].filter(Boolean).join(' · ') : e.type === 'SUB' ? `${playerName(teams, e.outId)} off` : e.auto && e.type === 'RED' ? 'Second yellow' : EV_TEXT[e.type];
                return (
                    <div key={e.id} className={`fx-ev fx-ev--${e.side}`}>
                        <div className="fx-ev__body">
                            {e.side === 'away' && icon}
                            <span><b>{who || EV_TEXT[e.type]}</b>{(who || e.type === 'OWN_GOAL') && <small>{e.type === 'OWN_GOAL' ? 'Own goal' : sub}</small>}</span>
                            {e.side === 'home' && icon}
                        </div>
                        <span className="fx-ev__min">{eventMinute(rulesOf, e)}</span>
                    </div>
                );
            })}
        </div>
    );
};

/** Spread n players across a line: GK at the back, the rest in rows. */
const layout = (n: number): number[] => (n <= 4 ? [n] : n === 5 ? [2, 2] : n === 6 ? [2, 3] : n === 7 ? [3, 3] : [3, n - 4]);

const Lineups: React.FC<{ m: FutsalMatch; home?: FutsalTeam; away?: FutsalTeam; onPitch: number }> = ({ m, home, away, onPitch }) => {
    const wide = typeof window !== 'undefined' && window.innerWidth > 760;
    const sideDots = (team: FutsalTeam | undefined, side: Side) => {
        if (!team) return [];
        const lu = m.lineups?.[side];
        const ids = lu?.players?.length ? lu.players : team.players.map(p => p.id);
        const gk = lu?.gk || team.players.find(p => p.position === 'GK')?.id || ids[0];
        const subs = m.events.filter(e => e.type === 'SUB' && e.side === side);
        const subbedOn = new Set(subs.map(e => e.inId));
        const starters = ids.filter(id => id !== gk && !subbedOn.has(id)).slice(0, Math.max(1, onPitch - 1));
        const rows = layout(starters.length + 1).slice();
        const out: { id: string; x: number; y: number }[] = [];
        const depth = (k: number, total: number) => 0.1 + (0.38 * (k + 1)) / (total + 1);
        out.push({ id: gk, x: 0.05, y: 0.5 });
        let used = 0;
        rows.forEach((count, r) => {
            for (let i = 0; i < count && used < starters.length; i++, used++) out.push({ id: starters[used], x: depth(r, rows.length) + 0.05, y: (i + 1) / (count + 1) });
        });
        return out.map(d => {
            // Home attacks left to right; away mirrored. On phones the pitch is vertical.
            const x = side === 'home' ? d.x : 1 - d.x;
            return wide ? { ...d, left: x * 100, top: d.y * 100 } : { ...d, left: d.y * 100, top: (side === 'home' ? d.x : 1 - d.x) * 100 };
        });
    };
    if (!home && !away) return <Empty title="Lineups not available">They appear once both teams are known.</Empty>;
    const num = (team: FutsalTeam | undefined, id: string) => team?.players.find(p => p.id === id);
    const bench = (team: FutsalTeam | undefined, side: Side) => {
        if (!team) return null;
        const on = new Set(sideDots(team, side).map(d => d.id));
        return team.players.filter(p => !on.has(p.id));
    };
    return (
        <div className="fx-stack">
            <div className="fx-pitch" role="img" aria-label="Lineups on the pitch">
                <svg className="fx-lines" viewBox={wide ? '0 0 200 100' : '0 0 100 125'} preserveAspectRatio="none" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth=".6">
                    {wide ? <>
                        <rect x="2" y="2" width="196" height="96" rx="1" /><line x1="100" y1="2" x2="100" y2="98" /><circle cx="100" cy="50" r="12" />
                        <path d="M2 30 Q26 30 26 50 Q26 70 2 70" /><path d="M198 30 Q174 30 174 50 Q174 70 198 70" />
                    </> : <>
                        <rect x="2" y="2" width="96" height="121" rx="1" /><line x1="2" y1="62.5" x2="98" y2="62.5" /><circle cx="50" cy="62.5" r="11" />
                        <path d="M30 2 Q30 22 50 22 Q70 22 70 2" /><path d="M30 123 Q30 103 50 103 Q70 103 70 123" />
                    </>}
                </svg>
                {(['home', 'away'] as Side[]).map(side => {
                    const team = side === 'home' ? home : away;
                    return sideDots(team, side).map(d => {
                        const p = num(team, d.id);
                        return (
                            <div key={`${side}${d.id}`} className="fx-dot" style={{ left: `${d.left}%`, top: `${d.top}%`, '--c': SIDE_FILL[side] } as React.CSSProperties}>
                                <i>{p?.number ?? ''}</i><span>{p?.name.split(' ').slice(-1)[0] || ''}</span>
                            </div>
                        );
                    });
                })}
            </div>
            <div className="fx-grid2">
                {([['home', home], ['away', away]] as const).map(([side, team]) => team && (
                    <div key={side} className="fx-card fx-card--pad">
                        <div className="fx-row" style={{ marginBottom: 8 }}><Crest team={team} size={28} /><h3 style={{ fontSize: 20 }}>{team.name}</h3></div>
                        <small className="fx-muted" style={{ fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', fontSize: 11 }}>Bench</small>
                        <div className="fx-bench">{(bench(team, side) || []).map(p => <span key={p.id} className="fx-pill"><b>{p.number ?? ''}</b>{p.name}</span>)}</div>
                        {m.events.filter(e => e.type === 'SUB' && e.side === side).map(e => (
                            <p key={e.id} className="fx-muted" style={{ margin: '8px 0 0', fontSize: 13 }}><ArrowLeftRight size={13} style={{ verticalAlign: -2 }} /> {e.ms ? fmtClock(e.ms) : ''} {playerName([team], e.inId)} for {playerName([team], e.outId)}</p>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

const MatchStats: React.FC<{ m: FutsalMatch }> = ({ m }) => {
    const rows = useMemo(() => {
        const c = (side: Side, type: FutsalEvent['type']) => m.events.filter(e => e.side === side && e.type === type && !(e.auto && e.type === 'GOAL')).length;
        const s = scoreOf(m);
        return [
            { k: 'Goals', h: s.home, a: s.away },
            { k: 'Fouls', h: c('home', 'FOUL'), a: c('away', 'FOUL') },
            { k: 'Yellow cards', h: c('home', 'YELLOW'), a: c('away', 'YELLOW') },
            { k: 'Red cards', h: m.events.filter(e => e.side === 'home' && e.type === 'RED').length, a: m.events.filter(e => e.side === 'away' && e.type === 'RED').length },
            { k: 'Timeouts', h: c('home', 'TIMEOUT'), a: c('away', 'TIMEOUT') },
            { k: 'Substitutions', h: c('home', 'SUB'), a: c('away', 'SUB') },
        ];
    }, [m]);
    if (m.status === 'SCHEDULED') return <Empty title="Not started">Match stats appear once the game kicks off.</Empty>;
    return (
        <div className="fx-card fx-card--pad" style={{ maxWidth: 640, margin: '0 auto' }}>
            {rows.map(r => {
                const total = r.h + r.a || 1;
                return (
                    <div key={r.k} className="fx-statbar">
                        <b>{r.h}</b>
                        <div className="fx-statbar__mid"><span>{r.k}</span><span className="fx-statbar__track"><i style={{ width: `${(r.h / total) * 100}%` }} /><i style={{ width: `${(r.a / total) * 100}%` }} /></span></div>
                        <b>{r.a}</b>
                    </div>
                );
            })}
        </div>
    );
};
