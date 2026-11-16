import React, { useEffect, useState } from 'react';
import { ChevronDown, Flag, Pause, Play, RotateCcw, Square, Star, Undo2, X } from 'lucide-react';
import { loginReferee } from '../../services/storage';
import {
    addEvent, adjustClock, displayClock, cardsFor, undoLast, clockMs, isKnockout, endPeriod, finishMatch, fmtClock, forfeitMatch, foulsFor, nextAction, pauseClock,
    periodLengthMs, phaseLabel, resetMatch, resolveSlots, resumeClock, scoreOf, shootoutDecided, shootoutNext, shortHanded, startPeriod, timeoutsLeft,
} from '../engine';
import { GOAL_TYPES, goalTypeLabel } from '../presets';
import { isDemo, saveFutsalMatch, saveFutsalMatches } from '../store';
import type { FutsalCategory, FutsalMatch, FutsalTeam, FutsalTournament, GoalType, Lineup, Side } from '../types';
import { SIDE_LINE } from './palette';
import { Ball, catOf, Crest, Empty, fmtTime, Loading, Shell, stageText, teamName, useFutsalTournament, useNow, useToast } from './shared';
import { scorePath } from '../sport';

const keyFor = (id: string) => `fx-score-${id}`;

export const Scorer: React.FC<{ tournamentId: string; matchId?: string }> = ({ tournamentId, matchId }) => {
    const { t, teams, matches, loading } = useFutsalTournament(tournamentId);
    const [authed, setAuthed] = useState(() => { try { return sessionStorage.getItem(keyFor(tournamentId)) === '1'; } catch { return false; } });
    // The link may name the tournament by its slug; the unlock is stored under its real id.
    useEffect(() => { try { if (t && sessionStorage.getItem(keyFor(t.id)) === '1') setAuthed(true); } catch { /* private mode */ } }, [t?.id]);
    const [code, setCode] = useState('');
    const [err, setErr] = useState('');

    if (loading) return <Shell bare><div className="fx-wrap"><Loading /></div></Shell>;
    if (!t) return <Shell bare><div className="fx-wrap"><Empty title="Competition not found" /></div></Shell>;

    if (!authed) {
        const submit = async (e: React.FormEvent) => {
            e.preventDefault();
            if (code.trim() !== String(t.scorerPasscode)) { setErr('That passcode isn’t right. Ask the organiser.'); return; }
            try {
                if (!isDemo()) await loginReferee();
                sessionStorage.setItem(keyFor(t.id), '1');
                setAuthed(true);
            } catch { setErr('Couldn’t sign in. Check your connection.'); }
        };
        return (
            <Shell bare>
                <div className="fx-scorer" style={{ paddingTop: 60 }}>
                    <form className="fx-card fx-card--pad fx-stack" onSubmit={submit}>
                        <span className="fx-eyebrow">Referee mode</span>
                        <h1 className="fx-silver" style={{ fontSize: 40 }}>{t.name}</h1>
                        <div className="fx-field"><label htmlFor="fx-pass">Referee passcode</label><input id="fx-pass" className="fx-input" inputMode="numeric" autoComplete="off" value={code} onChange={e => setCode(e.target.value)} autoFocus /></div>
                        {err && <div className="fx-note fx-note--err" role="alert">{err}</div>}
                        <button type="submit" className="fx-btn fx-btn--primary">Open referee mode</button>
                    </form>
                </div>
            </Shell>
        );
    }

    const m = matchId ? matches.find(x => x.id === matchId) : undefined;
    if (!m) return <MatchPicker t={t} teams={teams} matches={matches} />;
    return <Console key={m.id} t={t} cat={catOf(t, m.categoryId)} teams={teams} matches={matches} m={m} />;
};

const MatchPicker: React.FC<{ t: FutsalTournament; teams: FutsalTeam[]; matches: FutsalMatch[] }> = ({ t, teams, matches }) => {
    const [pitch, setPitch] = useState(() => { try { return localStorage.getItem('fx-score-pitch') || ''; } catch { return ''; } });
    const list = matches.filter(m => m.status !== 'COMPLETED' && m.homeId && m.awayId && (!pitch || m.pitch === pitch))
        .sort((a, b) => (a.status === 'LIVE' ? -1 : 0) - (b.status === 'LIVE' ? -1 : 0) || String(a.startAt || '9').localeCompare(String(b.startAt || '9')));
    return (
        <Shell bare>
            <div className="fx-scorer">
                <div className="fx-row fx-row--between" style={{ margin: '10px 0 14px' }}>
                    <div><span className="fx-eyebrow">Referee mode</span><h1 style={{ fontSize: 30, marginTop: 6 }}>{t.name}</h1></div>
                    <button type="button" className="fx-btn fx-btn--sm" onClick={() => { sessionStorage.removeItem(keyFor(t.id)); window.location.reload(); }}>Lock</button>
                </div>
                {t.pitches.length > 1 && (
                    <div className="fx-chips" style={{ marginBottom: 12 }}>
                        <button type="button" className={`fx-chip ${!pitch ? 'is-on' : ''}`} onClick={() => { setPitch(''); localStorage.removeItem('fx-score-pitch'); }}>All pitches</button>
                        {t.pitches.map(p => <button key={p} type="button" className={`fx-chip ${pitch === p ? 'is-on' : ''}`} onClick={() => { setPitch(p); localStorage.setItem('fx-score-pitch', p); }}>{p}</button>)}
                    </div>
                )}
                {!list.length ? <Empty title="Nothing to score">No upcoming matches with both teams known.</Empty> : (
                    <div className="fx-list">
                        {list.map(m => (
                            <a key={m.id} className="fx-li" href={`#${scorePath(t, m.id)}`} style={{ textDecoration: 'none' }}>
                                <div className="fx-li__main">
                                    <b>{teamName(teams, m.homeId)} v {teamName(teams, m.awayId)}</b>
                                    <small>{fmtTime(m.startAt)} · {m.pitch || 'No pitch'} · {catOf(t, m.categoryId).name} · {stageText(m)}</small>
                                </div>
                                {m.status === 'LIVE' ? <span className="fx-pill fx-pill--live">Live</span> : <span className="fx-btn fx-btn--sm fx-btn--primary">Score</span>}
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </Shell>
    );
};

/** An in-app confirmation (no browser dialogs on the referee's phone). */
interface Ask { title: string; body: string; confirm: string; danger?: boolean; run: () => void }

type Sheet =
    | { kind: 'goal'; side: Side; period: number; ms: number }
    | { kind: 'ratings' }
    | { kind: 'card'; side: Side; color: 'YELLOW' | 'RED' }
    | { kind: 'pen'; side: Side; scored: boolean }
    | { kind: 'sub'; side: Side; out?: string }
    | { kind: 'lineup'; side: Side }
    | { kind: 'menu' }
    | { kind: 'motm' }
    | null;

/** The futsal scoring screen. `onBack` returns to the referee's match list (defaults to the standalone scorer list). */
export const Console: React.FC<{ t: FutsalTournament; cat: FutsalCategory; teams: FutsalTeam[]; matches: FutsalMatch[]; m: FutsalMatch; onBack?: () => void }> = ({ t, cat, teams, matches, m: remote, onBack }) => {
    // Local copy so taps feel instant; the subscription catches up behind it.
    const [m, setM] = useState(remote);
    const [pending, setPending] = useState(0);
    useEffect(() => { if (!pending) setM(remote); }, [remote, pending]);
    const now = useNow(250, m.status === 'LIVE');
    const [sheet, setSheet] = useState<Sheet>(null);
    const { toast, node } = useToast();
    const rules = cat.rules;
    const home = teams.find(x => x.id === m.homeId)!, away = teams.find(x => x.id === m.awayId)!;
    const team = (s: Side) => (s === 'home' ? home : away);
    const s = scoreOf(m);
    const ms = clockMs(m, now);
    const len = periodLengthMs(rules, m.period || 1);
    const live = m.status === 'LIVE';
    const playing = m.periodState === 'PLAYING';
    const inPlay = playing || m.periodState === 'PAUSED';
    const next = nextAction(m, rules);
    const shorts = shortHanded(m, rules, now);

    useEffect(() => { document.title = `Scoring ${home?.shortName} v ${away?.shortName}`; }, [home, away]);

    const commit = async (nextM: FutsalMatch, msg?: string) => {
        setM(nextM);
        setPending(p => p + 1);
        try {
            await saveFutsalMatch(nextM);
            // A result (or a restart that undoes one) moves teams in or out of the next knockout round.
            if ((nextM.status === 'COMPLETED') !== (remote.status === 'COMPLETED')) {
                const all = matches.map(x => (x.id === nextM.id ? nextM : x));
                const changed = resolveSlots(cat, teams, all);
                if (changed.length) await saveFutsalMatches(changed);
            }
            if (msg) toast(msg);
        } catch (e: any) {
            toast(e?.code === 'permission-denied' ? 'Not allowed: re-enter the referee passcode' : 'Couldn’t save. It will retry when you’re back online.');
        } finally { setPending(p => p - 1); }
    };

    const act = (side: Side, type: 'FOUL' | 'TIMEOUT') => {
        if (type === 'TIMEOUT' && !timeoutsLeft(m, rules, side)) return;
        const n = addEvent(m, rules, { type, side });
        let msg: string | undefined;
        if (type === 'FOUL' && rules.foulLimit) {
            const f = foulsFor(n, rules, side);
            if (f === rules.foulLimit) msg = `${team(side).shortName}: ${f} fouls. The next one is a 10 m kick.`;
            if (f > rules.foulLimit) msg = `${team(side).shortName}: foul ${f}. Direct free kick from 10 m.`;
        }
        commit(n, msg || (type === 'TIMEOUT' ? `Timeout ${team(side).shortName}: clock paused` : undefined));
    };

    const lineupOf = (side: Side): Lineup => m.lineups?.[side] || { players: team(side).players.map(p => p.id), gk: team(side).players.find(p => p.position === 'GK')?.id };
    /** Who's on the pitch now: the keeper and the first players up to the side size start; subs swap in order. */
    const onField = (side: Side): string[] => {
        const lu = lineupOf(side);
        const order = [lu.gk, ...lu.players.filter(id => id !== lu.gk)].filter(Boolean) as string[];
        let on = order.slice(0, rules.onPitch || 5);
        m.events.filter(e => e.type === 'SUB' && e.side === side && e.inId).forEach(e => {
            on = on.includes(e.outId || '') ? on.map(id => (id === e.outId ? e.inId! : id)) : on.includes(e.inId!) ? on : [...on, e.inId!];
        });
        return on.filter(id => !cardsFor(m, id).red);
    };
    const onPitchIds = (side: Side) => {
        const lu = lineupOf(side);
        return team(side).players.filter(p => lu.players.includes(p.id) && !cardsFor(m, p.id).red);
    };

    const [ask, setAsk] = useState<Ask | null>(null);

    const big = () => {
        if (next.kind === 'start') {
            const withLineups = m.lineups ? m : { ...m, lineups: { home: lineupOf('home'), away: lineupOf('away') } };
            commit(startPeriod(withLineups), m.status === 'SCHEDULED' ? 'Kick-off! Clock running' : undefined);
        } else if (next.kind === 'end') {
            const ending = next.label === 'End match';
            setAsk({
                title: ending ? 'End the match?' : `${next.label}?`,
                body: `${home.shortName} ${s.home}–${s.away} ${away.shortName} at ${fmtClock(ms)}.${ending ? ' The result goes into the standings.' : ''}`,
                confirm: next.label,
                run: () => {
                    const n = endPeriod(m, rules);
                    commit(n, n.status === 'COMPLETED' ? 'Full time' : n.periodState === 'SHOOTOUT' ? 'Level: penalty shootout' : `${phaseLabel(m, rules)} over`);
                },
            });
        }
    };

    // Same as padel's "end match": stop now with the current score. A level knockout goes to penalties.
    const endNow = () => setAsk({
        title: 'End the match now?',
        body: `Final score ${home.shortName} ${s.home}–${s.away} ${away.shortName}.${isKnockout(m.stage) && s.home === s.away ? ' It’s level in a knockout, so it goes to penalties.' : ''}`,
        confirm: 'End match',
        run: () => {
            if (isKnockout(m.stage) && s.home === s.away) { commit({ ...pauseClock(m), periodState: 'SHOOTOUT' }, 'Level in a knockout: penalty shootout'); return; }
            commit(finishMatch(m), 'Full time');
        },
    });
    const restart = () => setAsk({
        title: 'Restart this match?',
        body: 'Every goal, foul, rating and the clock will be cleared. This can’t be undone.',
        confirm: 'Restart match', danger: true,
        run: () => commit(resetMatch(m), 'Match restarted'),
    });

    const over = inPlay && ms >= len;
    const remaining = Math.max(0, len - ms);

    return (
        <Shell bare>
            <div className="fx-scorer">
                <div className="fx-row fx-row--between" style={{ marginBottom: 10 }}>
                    {onBack ? <button type="button" className="fx-link" onClick={onBack}>← Matches</button> : <a className="fx-link" href={`#${scorePath(t)}`}>← Matches</a>}
                    <span className="fx-muted" style={{ fontSize: 12, fontWeight: 700 }}>{cat.name} · {stageText(m)}{m.pitch ? ` · ${m.pitch}` : ''}{pending ? ' · saving…' : ''}</span>
                    <button type="button" className="fx-btn fx-btn--sm" onClick={() => setSheet({ kind: 'menu' })} aria-label="Match options">•••</button>
                </div>

                <div className="fx-card fx-sc__board">
                    <div className="fx-sc__team" style={{ '--tc': SIDE_LINE.home } as React.CSSProperties}><Crest team={home} size={48} /><h3>{home.name}</h3></div>
                    <div className="fx-sc__mid">
                        <div className="fx-sc__score">{s.home}<span>–</span>{s.away}</div>
                        {s.hasPens && <div className="fx-mc__pens">Pens {s.pensHome}–{s.pensAway}</div>}
                        <div className={`fx-sc__clock ${playing ? 'is-run' : ''} ${over ? 'is-over' : ''}`} aria-live="off">
                            {playing && <i className="fx-sc__dot" aria-hidden="true" />}
                            {inPlay ? displayClock(rules, m.period, ms) : phaseLabel(m, rules)}
                        </div>
                        {inPlay && (
                            <div className="fx-sc__phase">
                                <span>{phaseLabel(m, rules)}{m.periodState === 'PAUSED' ? ' · clock stopped' : over ? ' · added time' : ''}</span>
                                <span className="fx-sc__progress" aria-hidden="true"><i style={{ width: `${Math.min(100, (ms / len) * 100)}%` }} /></span>
                            </div>
                        )}
                    </div>
                    <div className="fx-sc__team" style={{ '--tc': SIDE_LINE.away } as React.CSSProperties}><Crest team={away} size={48} /><h3>{away.name}</h3></div>
                </div>

                {m.status === 'COMPLETED' ? (
                    <div className="fx-stack" style={{ marginTop: 12 }}>
                        <div className="fx-note">Final: {home.name} {s.home}–{s.away} {away.name}{s.hasPens ? ` (${s.pensHome}–${s.pensAway} pens)` : ''}. Standings and the bracket are updated.</div>
                        <button type="button" className="fx-btn fx-btn--primary fx-sc__big" onClick={() => setSheet({ kind: 'motm' })}>{m.motm ? `Player of the match: ${[...home.players, ...away.players].find(p => p.id === m.motm)?.name}` : 'Pick player of the match'}</button>
                        <button type="button" className="fx-btn fx-sc__big" onClick={() => setSheet({ kind: 'ratings' })}><Star size={18} />{m.ratings && Object.keys(m.ratings).length ? `Player ratings · ${Object.keys(m.ratings).length} rated` : 'Rate players (optional)'}</button>
                        <div className="fx-sc__tools">
                            <button type="button" className="fx-btn" onClick={() => commit(reopen(m), 'Match reopened: carry on scoring')}><Undo2 />Reopen</button>
                            <button type="button" className="fx-btn fx-btn--danger" onClick={restart}><RotateCcw />Restart</button>
                        </div>
                        {onBack ? <button type="button" className="fx-btn fx-sc__big" onClick={onBack}>Next match</button> : <a className="fx-btn fx-sc__big" href={`#${scorePath(t)}`}>Next match</a>}
                    </div>
                ) : m.periodState === 'SHOOTOUT' ? (
                    <div className="fx-stack" style={{ marginTop: 12 }}>
                        <div className="fx-note">Penalty shootout. Next kick: <b>{team(shootoutNext(m)).name}</b></div>
                        <div className="fx-sc__main">
                            <button type="button" className="fx-sc__btn fx-sc__btn--goal" onClick={() => setSheet({ kind: 'pen', side: shootoutNext(m), scored: true })}>Scored</button>
                            <button type="button" className="fx-sc__btn" style={{ minHeight: 72, fontSize: 22 }} onClick={() => setSheet({ kind: 'pen', side: shootoutNext(m), scored: false })}>Missed / saved</button>
                        </div>
                        <ShootoutDots m={m} home={home} away={away} />
                        {shootoutDecided(m) && <button type="button" className="fx-btn fx-btn--primary" onClick={() => commit(finishMatch(m, 'penalties'))}>Confirm result</button>}
                        <button type="button" className="fx-btn" onClick={() => commit(undoLastPen(m))}><Undo2 />Undo last kick</button>
                    </div>
                ) : (
                    <>
                        <div className="fx-sc__main">
                            <button type="button" className="fx-btn fx-btn--primary fx-sc__big" disabled={next.kind === 'none'} onClick={big}>{next.kind === 'start' ? <Play /> : <Square />}{next.label}</button>
                            {inPlay ? (
                                <button type="button" className="fx-btn fx-sc__big" onClick={() => commit(playing ? pauseClock(m) : resumeClock(m))}>{playing ? <><Pause />Stop clock</> : <><Play />Start clock</>}</button>
                            ) : (
                                <button type="button" className="fx-btn fx-sc__big" onClick={() => setSheet({ kind: 'lineup', side: 'home' })} disabled={live && m.periodState !== 'BREAK' && m.periodState !== 'PRE'}>Lineups</button>
                            )}
                        </div>
                        <div className="fx-sc__sides">
                            {(['home', 'away'] as Side[]).map(side => {
                                const f = foulsFor(m, rules, side);
                                const limit = rules.foulLimit;
                                const goals = side === 'home' ? s.home : s.away;
                                return (
                                    <div key={side} className="fx-card fx-sc__side" style={{ '--tc': SIDE_LINE[side] } as React.CSSProperties}>
                                        <div className="fx-sc__side-head"><span className="fx-sc__swatch" /><h4>{team(side).name}</h4><b>{goals}</b></div>
                                        <button type="button" className="fx-sc__btn fx-sc__btn--goal" disabled={!live} onClick={() => setSheet({ kind: 'goal', side, period: m.period || 1, ms: clockMs(m) })}><Ball className="fx-sc__ball" />Goal</button>
                                        <button type="button" className={`fx-sc__btn fx-sc__foul ${limit && f >= limit ? 'is-limit' : ''}`} disabled={!live} onClick={() => act(side, 'FOUL')}>
                                            <span>Foul</span>
                                            {limit > 0
                                                ? <span className="fx-sc__fouls" aria-label={`${f} fouls`}>{Array.from({ length: limit }, (_, k) => <i key={k} className={k < f ? 'on' : ''} />)}{f > limit && <em>+{f - limit}</em>}</span>
                                                : <span className="fx-sc__count">{f}</span>}
                                        </button>
                                        <div className="fx-sc__extras">
                                            <button type="button" className="fx-sc__mini" disabled={!live} onClick={() => setSheet({ kind: 'card', side, color: 'YELLOW' })}><span className="fx-card-y" />Yellow</button>
                                            <button type="button" className="fx-sc__mini" disabled={!live} onClick={() => setSheet({ kind: 'card', side, color: 'RED' })}><span className="fx-card-r" />Red</button>
                                            <button type="button" className="fx-sc__mini" disabled={!live} onClick={() => setSheet({ kind: 'sub', side })}>⇄ Sub</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="fx-sc__tools">
                            <button type="button" className="fx-btn" disabled={!m.events.some(e => !e.type.startsWith('PERIOD'))} onClick={() => commit(undoLast(m), 'Undone')}><Undo2 />Undo</button>
                            <button type="button" className="fx-btn" disabled={!live} onClick={endNow}><Flag />End match</button>
                            {live && !isKnockout(m.stage) && s.home === s.away && m.period >= rules.periods && (
                                <button type="button" className="fx-btn" onClick={() => setAsk({
                                    title: 'Go to a penalty shootout?',
                                    body: `It’s level at ${s.home}–${s.away}. The shootout decides the winner of this match; in the league table it still counts as a draw.`,
                                    confirm: 'Penalty shootout',
                                    run: () => commit({ ...pauseClock(m), periodState: 'SHOOTOUT' }, 'Penalty shootout'),
                                })}>Penalties</button>
                            )}
                            <button type="button" className="fx-btn fx-btn--danger" disabled={m.status === 'SCHEDULED'} onClick={restart}><RotateCcw />Restart</button>
                        </div>
                        <RecentLog m={m} teams={teams} />
                    </>
                )}
            </div>

            {sheet && (
                <div className="fx-sheet" role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) setSheet(null); }}>
                    <div className="fx-sheet__panel">
                        <div className="fx-row fx-row--between" style={{ marginBottom: 6 }}>
                            <span />
                            <button type="button" className="fx-btn fx-btn--sm" aria-label="Close" onClick={() => setSheet(null)}><X /></button>
                        </div>
                        {sheet.kind === 'goal' && (
                            <GoalForm side={sheet.side} m={m} teams={{ home, away }} players={{ home: onPitchIds('home'), away: onPitchIds('away') }}
                                onSave={(ev, msg) => { commit(addEvent(m, rules, { ...ev, period: sheet.period, ms: sheet.ms })); toast(msg); setSheet(null); }} />
                        )}
                        {sheet.kind === 'ratings' && (
                            <RatingsForm home={home} away={away} m={m} onSave={ratings => { commit({ ...m, ratings }, 'Ratings saved'); setSheet(null); }} onSkip={() => setSheet(null)} />
                        )}
                        {sheet.kind === 'card' && (
                            <>
                                <h3>{sheet.color === 'YELLOW' ? 'Yellow' : 'Red'} card · {team(sheet.side).name}</h3>
                                <div className="fx-players">
                                    {team(sheet.side).players.filter(p => !cardsFor(m, p.id).red).map(p => {
                                        const c = cardsFor(m, p.id);
                                        return <button key={p.id} type="button" className="fx-player-btn" onClick={() => {
                                            const n = addEvent(m, rules, { type: sheet.color, side: sheet.side, playerId: p.id });
                                            const sentOff = n.events.some(e => e.type === 'RED' && e.playerId === p.id);
                                            commit(n, sentOff ? `${p.name} sent off${rules.redCardMinutes ? `: ${team(sheet.side).shortName} a player down for ${rules.redCardMinutes} min` : ''}` : undefined);
                                            setSheet(null);
                                        }}><span className="fx-num">{p.number ?? ''}</span><span>{p.name}</span>{c.yellows > 0 && <span className="fx-card-y" style={{ marginLeft: 'auto' }} />}</button>;
                                    })}
                                </div>
                            </>
                        )}
                        {sheet.kind === 'pen' && (() => {
                            // Who took the kick: anyone in the squad who hasn't been sent off.
                            const kick = (playerId?: string) => {
                                const taker = playerId ? team(sheet.side).players.find(p => p.id === playerId)?.name : '';
                                commit(addEvent(m, rules, { type: sheet.scored ? 'PEN_SCORED' : 'PEN_MISSED', side: sheet.side, ...(playerId ? { playerId } : {}) }), `${sheet.scored ? 'Scored' : 'Missed'}${taker ? ` · ${taker}` : ''}`);
                                setSheet(null);
                            };
                            return (
                                <>
                                    <h3>Penalty {sheet.scored ? 'scored' : 'missed'} · {team(sheet.side).name}</h3>
                                    <p className="fx-muted" style={{ margin: '0 0 8px' }}>Who took it?</p>
                                    <div className="fx-players">
                                        {team(sheet.side).players.filter(p => !cardsFor(m, p.id).red).map(p => (
                                            <button key={p.id} type="button" className="fx-player-btn" onClick={() => kick(p.id)}><span className="fx-num">{p.number ?? ''}</span><span>{p.name}</span>
                                                {m.events.some(e => (e.type === 'PEN_SCORED' || e.type === 'PEN_MISSED') && e.playerId === p.id) && <span className="fx-muted" style={{ marginLeft: 'auto', fontSize: 12 }}>already kicked</span>}</button>
                                        ))}
                                    </div>
                                    <button type="button" className="fx-btn" style={{ marginTop: 10, width: '100%' }} onClick={() => kick()}>Not sure who</button>
                                </>
                            );
                        })()}
                        {sheet.kind === 'sub' && (() => {
                            const lu = lineupOf(sheet.side);
                            const on = new Set(lu.players);
                            // Off: someone on the pitch. On: anyone else in the squad (futsal subs roll), never a sent-off player.
                            const pool = team(sheet.side).players.filter(p => !cardsFor(m, p.id).red);
                            const pitch = new Set(onField(sheet.side));
                            const choices = sheet.out ? pool.filter(p => p.id !== sheet.out && (!pitch.size || !pitch.has(p.id))) : pool.filter(p => !pitch.size || pitch.has(p.id));
                            const outName = sheet.out ? team(sheet.side).players.find(p => p.id === sheet.out)?.name : '';
                            return (
                                <>
                                    <h3>{sheet.out ? `Who comes on for ${outName}?` : `Substitution · ${team(sheet.side).name}: who goes off?`}</h3>
                                    {sheet.out && <button type="button" className="fx-btn fx-btn--sm" style={{ marginBottom: 8 }} onClick={() => setSheet({ kind: 'sub', side: sheet.side })}>← Change who goes off</button>}
                                    {!choices.length && <p className="fx-muted">{sheet.out ? 'No one on the bench. Add players to the lineup first.' : 'No players on the pitch yet. Set the lineup first.'}</p>}
                                    <div className="fx-players">
                                        {choices.map(p => <button key={p.id} type="button" className="fx-player-btn" onClick={() => {
                                            if (!sheet.out) { setSheet({ ...sheet, out: p.id }); return; }
                                            const lineups = { ...(m.lineups || {}), [sheet.side]: { ...lu, players: on.has(p.id) ? lu.players : [...lu.players, p.id] } };
                                            commit(addEvent({ ...m, lineups }, rules, { type: 'SUB', side: sheet.side, inId: p.id, outId: sheet.out }), `${p.name} on for ${outName}`);
                                            setSheet(null);
                                        }}><span className="fx-num">{p.number ?? ''}</span><span>{p.name}</span></button>)}
                                    </div>
                                </>
                            );
                        })()}
                        {sheet.kind === 'lineup' && (
                            <LineupEditor m={m} side={sheet.side} team={team(sheet.side)} lineup={lineupOf(sheet.side)} onSide={side => setSheet({ kind: 'lineup', side })}
                                onSave={lu => { commit({ ...m, lineups: { home: lineupOf('home'), away: lineupOf('away'), [sheet.side]: lu } }, 'Lineup saved'); }} />
                        )}
                        {sheet.kind === 'motm' && (
                            <>
                                <h3>Player of the match</h3>
                                <div className="fx-players">
                                    {[...home.players, ...away.players].map(p => <button key={p.id} type="button" className={`fx-player-btn ${m.motm === p.id ? 'is-on' : ''}`} onClick={() => { commit({ ...m, motm: p.id }, 'Saved'); setSheet(null); }}><span className="fx-num">{p.number ?? ''}</span><span>{p.name}</span></button>)}
                                </div>
                            </>
                        )}
                        {sheet.kind === 'menu' && (
                            <div className="fx-stack">
                                <h3>Match options</h3>
                                {m.status !== 'COMPLETED' && (['home', 'away'] as Side[]).map(side => (
                                    <button key={side} type="button" className="fx-btn fx-btn--danger" onClick={() => { setSheet(null); setAsk({ title: `${team(side).name} forfeits?`, body: `${team(side === 'home' ? 'away' : 'home').name} win ${rules.forfeitScore}–0 as a walkover.`, confirm: 'Confirm walkover', danger: true, run: () => commit(forfeitMatch(m, rules, side)) }); }}>{team(side).name} forfeits</button>
                                ))}
                                <button type="button" className="fx-btn fx-btn--danger" onClick={() => { setSheet(null); restart(); }}><RotateCcw />Restart match</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {ask && (
                <div className="fx-sheet fx-ask" role="alertdialog" aria-modal="true" aria-labelledby="fx-ask-title" onClick={e => { if (e.target === e.currentTarget) setAsk(null); }}>
                    <div className="fx-sheet__panel fx-ask__panel">
                        <h3 id="fx-ask-title">{ask.title}</h3>
                        <p>{ask.body}</p>
                        <div className="fx-ask__actions">
                            <button type="button" className="fx-btn" onClick={() => setAsk(null)} autoFocus>Cancel</button>
                            <button type="button" className={`fx-btn ${ask.danger ? 'fx-btn--danger' : 'fx-btn--primary'}`} onClick={() => { const run = ask.run; setAsk(null); run(); }}>{ask.confirm}</button>
                        </div>
                    </div>
                </div>
            )}
            {node}
        </Shell>
    );
};

/** Undo full time: back to a paused clock in the last period so scoring can continue. */
const reopen = (m: FutsalMatch): FutsalMatch => {
    let events = [...m.events];
    // Drop the closing marker and any walkover goals.
    if (events[events.length - 1]?.type === 'PERIOD_END') events = events.slice(0, -1);
    if (m.decidedBy === 'forfeit') events = [];
    return { ...m, events, status: events.length ? 'LIVE' : 'SCHEDULED', periodState: events.length ? 'PAUSED' : 'PRE', winnerId: null, decidedBy: undefined, forfeitBy: undefined, updatedAt: Date.now() };
};

/** One form for a goal: who scored (dropdown), optional assist, how it went in. */
const GoalForm: React.FC<{
    side: Side; m: FutsalMatch; teams: { home: FutsalTeam; away: FutsalTeam };
    players: { home: FutsalTeam['players']; away: FutsalTeam['players'] };
    onSave: (ev: { type: 'GOAL' | 'OWN_GOAL'; side: Side; playerId?: string; assistId?: string; goalType?: GoalType }, msg: string) => void;
}> = ({ side, m, teams, players, onSave }) => {
    const [own, setOwn] = useState(false);
    const [scorer, setScorer] = useState('');
    const [assist, setAssist] = useState('');
    const [kind, setKind] = useState<GoalType | ''>('');
    const other: Side = side === 'home' ? 'away' : 'home';
    const benefit = teams[side];
    // An own goal is by a player from the other team, credited to this side.
    const pool = own ? players[other] : players[side];
    const s = scoreOf(m);
    const after = `${side === 'home' ? s.home + 1 : s.home}–${side === 'away' ? s.away + 1 : s.away}`;
    const label = (p: FutsalTeam['players'][number]) => `${p.number != null ? `#${p.number} ` : ''}${p.name}`;
    return (
        <div className="fx-stack">
            <h3>Goal · {benefit.name}</h3>
            <div className="fx-chips" role="group" aria-label="Goal kind">
                <button type="button" className={`fx-chip ${!own ? 'is-on' : ''}`} onClick={() => { setOwn(false); setScorer(''); }}>Goal</button>
                <button type="button" className={`fx-chip ${own ? 'is-on' : ''}`} onClick={() => { setOwn(true); setScorer(''); setAssist(''); setKind(''); }}>Own goal by {teams[other].shortName}</button>
            </div>
            <div className="fx-field">
                <label htmlFor="fx-scorer">{own ? 'Player who put it in his own net' : 'Scorer'}</label>
                <select id="fx-scorer" className="fx-select" value={scorer} onChange={e => setScorer(e.target.value)} autoFocus>
                    <option value="">{own ? 'Choose a player' : 'Scorer not known'}</option>
                    {pool.map(p => <option key={p.id} value={p.id}>{label(p)}</option>)}
                </select>
            </div>
            {!own && (
                <>
                    <div className="fx-field">
                        <label htmlFor="fx-assist">Assist (optional)</label>
                        <select id="fx-assist" className="fx-select" value={assist} onChange={e => setAssist(e.target.value)}>
                            <option value="">No assist</option>
                            {players[side].filter(p => p.id !== scorer).map(p => <option key={p.id} value={p.id}>{label(p)}</option>)}
                        </select>
                    </div>
                    <div className="fx-field">
                        <label>Type of goal (optional)</label>
                        <div className="fx-goal-types">
                            {GOAL_TYPES.map(g => <button key={g.id} type="button" className={`fx-chip ${kind === g.id ? 'is-on' : ''}`} aria-pressed={kind === g.id} onClick={() => setKind(kind === g.id ? '' : g.id)}>{g.label}</button>)}
                        </div>
                    </div>
                </>
            )}
            <button type="button" className="fx-btn fx-btn--primary fx-sc__big" disabled={own && !scorer}
                onClick={() => onSave(own
                    ? { type: 'OWN_GOAL', side: other, playerId: scorer }
                    : { type: 'GOAL', side, playerId: scorer || undefined, assistId: assist || undefined, goalType: kind || undefined },
                    `${own ? 'Own goal' : 'Goal'} ${benefit.shortName}! ${after}`)}>
                Save goal · {after}
            </button>
        </div>
    );
};

/** Optional 1–5 star ratings for everyone who played, after full time. */
const RatingsForm: React.FC<{ home: FutsalTeam; away: FutsalTeam; m: FutsalMatch; onSave: (r: Record<string, number>) => void; onSkip: () => void }> = ({ home, away, m, onSave, onSkip }) => {
    const [r, setR] = useState<Record<string, number>>(m.ratings || {});
    const played = (team: FutsalTeam, side: Side) => {
        const lu = m.lineups?.[side]?.players;
        return team.players.filter(p => !lu?.length || lu.includes(p.id));
    };
    return (
        <div className="fx-stack">
            <h3>Rate the players</h3>
            <p className="fx-muted" style={{ margin: '-8px 0 0', fontSize: 13 }}>Optional. Tap a star; tap it again to clear. Ratings feed each player's average.</p>
            {([['home', home], ['away', away]] as const).map(([side, team]) => (
                <div key={side}>
                    <h4 style={{ fontSize: 16, margin: '6px 0 8px' }}>{team.name}</h4>
                    <div className="fx-list">
                        {played(team, side).map(p => (
                            <div key={p.id} className="fx-li fx-rate">
                                <span className="fx-num">{p.number ?? ''}</span>
                                <span className="fx-li__main"><b style={{ fontWeight: 600 }}>{p.name}</b></span>
                                <span className="fx-stars" role="radiogroup" aria-label={`Rating for ${p.name}`}>
                                    {[1, 2, 3, 4, 5].map(n => (
                                        <button key={n} type="button" role="radio" aria-checked={r[p.id] === n} aria-label={`${n} star${n > 1 ? 's' : ''}`}
                                            className={(r[p.id] || 0) >= n ? 'on' : ''}
                                            onClick={() => setR(prev => { const next = { ...prev }; if (next[p.id] === n) delete next[p.id]; else next[p.id] = n; return next; })}>
                                            <Star size={20} />
                                        </button>
                                    ))}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
            <div className="fx-row">
                <button type="button" className="fx-btn fx-btn--primary" onClick={() => onSave(r)}>Save ratings</button>
                <button type="button" className="fx-btn" onClick={onSkip}>Skip</button>
            </div>
        </div>
    );
};

const undoLastPen = (m: FutsalMatch): FutsalMatch => {
    let i = m.events.length - 1;
    while (i >= 0 && m.events[i].type !== 'PEN_SCORED' && m.events[i].type !== 'PEN_MISSED') i--;
    return i < 0 ? m : { ...m, events: m.events.filter((_, k) => k !== i), updatedAt: Date.now() };
};

const ShootoutDots: React.FC<{ m: FutsalMatch; home: FutsalTeam; away: FutsalTeam }> = ({ m, home, away }) => (
    <div className="fx-card fx-card--pad">
        {([['home', home], ['away', away]] as const).map(([side, team]) => (
            <div key={side} className="fx-row" style={{ marginBottom: 6 }}>
                <b style={{ width: 50 }}>{team.shortName}</b>
                {m.events.filter(e => e.side === side && (e.type === 'PEN_SCORED' || e.type === 'PEN_MISSED')).map(e => (
                    <span key={e.id} title={e.playerId ? team.players.find(p => p.id === e.playerId)?.name : undefined} style={{ width: 22, height: 22, borderRadius: 999, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, background: e.type === 'PEN_SCORED' ? 'rgba(59,227,155,.25)' : 'rgba(255,59,107,.25)' }}>{e.type === 'PEN_SCORED' ? '✓' : '✕'}</span>
                ))}
            </div>
        ))}
    </div>
);

/** What happened so far: the last few entries, with the rest a tap away. */
const RecentLog: React.FC<{ m: FutsalMatch; teams: FutsalTeam[] }> = ({ m, teams }) => {
    const [open, setOpen] = useState(false);
    const evs = [...m.events].filter(e => e.type !== 'PERIOD_START' || e.period > 0).reverse();
    if (!evs.length) return null;
    const name = (id?: string) => (id ? teams.flatMap(t => t.players).find(p => p.id === id)?.name : '') || '';
    const teamOf = (side: Side) => teams.find(t => t.id === (side === 'home' ? m.homeId : m.awayId));
    const shown = open ? evs : evs.slice(0, 3);
    const line = (e: FutsalMatch['events'][number]) => {
        if (e.type === 'PERIOD_START') return { icon: '▶', title: `Period ${e.period} kicked off`, sub: '' };
        if (e.type === 'PERIOD_END') return { icon: '■', title: `End of period ${e.period}`, sub: '' };
        if (e.type === 'GOAL') return { icon: 'ball', title: `Goal · ${name(e.playerId) || 'Unknown scorer'}`, sub: [e.goalType && goalTypeLabel(e.goalType), e.assistId && `Assist ${name(e.assistId)}`].filter(Boolean).join(' · ') };
        if (e.type === 'OWN_GOAL') return { icon: 'ball', title: `Own goal · ${name(e.playerId)}`, sub: '' };
        if (e.type === 'FOUL') return { icon: '!', title: 'Foul', sub: '' };
        if (e.type === 'PEN_SCORED' || e.type === 'PEN_MISSED') return { icon: e.type === 'PEN_SCORED' ? '✓' : '✕', title: e.type === 'PEN_SCORED' ? 'Penalty scored' : 'Penalty missed', sub: '' };
        const labels: Record<string, string> = { YELLOW: 'Yellow card', RED: 'Red card', TIMEOUT: 'Timeout', SUB: 'Substitution' };
        return { icon: '•', title: `${labels[e.type] || e.type}${e.playerId ? ` · ${name(e.playerId)}` : ''}`, sub: '' };
    };
    return (
        <div className="fx-card fx-sc__log">
            <button type="button" className="fx-sc__log-head" aria-expanded={open} onClick={() => setOpen(o => !o)}>
                <h4>Match log</h4>
                <span className="fx-pill">{evs.length}</span>
                <span className="fx-sc__log-toggle">{open ? 'Show less' : 'All events'}<ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} /></span>
            </button>
            <ul>
                {shown.map(e => {
                    const l = line(e);
                    const t = e.type.startsWith('PERIOD') ? undefined : teamOf(e.side);
                    return (
                        <li key={e.id} className={e.type.startsWith('PERIOD') ? 'is-marker' : ''}>
                            <span className="fx-sc__log-min">{fmtClock(e.ms)}</span>
                            <span className={`fx-sc__log-icon ${e.type === 'GOAL' || e.type === 'OWN_GOAL' ? 'is-goal' : ''}`} style={t ? { '--tc': SIDE_LINE[e.side] } as React.CSSProperties : undefined}>{l.icon === 'ball' ? <Ball /> : l.icon}</span>
                            <span className="fx-sc__log-text"><b>{l.title}</b>{(t || l.sub) && <small>{[t?.shortName, l.sub].filter(Boolean).join(' · ')}</small>}</span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

const LineupEditor: React.FC<{ m: FutsalMatch; side: Side; team: FutsalTeam; lineup: Lineup; onSide: (s: Side) => void; onSave: (l: Lineup) => void }> = ({ side, team, lineup, onSide, onSave }) => {
    const [lu, setLu] = useState<Lineup>(lineup);
    useEffect(() => setLu(lineup), [lineup, side]);
    const toggle = (id: string) => setLu(l => ({ ...l, players: l.players.includes(id) ? l.players.filter(x => x !== id) : [...l.players, id] }));
    return (
        <>
            <div className="fx-tabs" style={{ marginBottom: 12 }}>
                {(['home', 'away'] as Side[]).map(s => <button key={s} type="button" className={s === side ? 'is-on' : ''} onClick={() => onSide(s)}>{s === 'home' ? 'Home' : 'Away'}</button>)}
            </div>
            <h3>{team.name}: who’s playing?</h3>
            <p className="fx-muted" style={{ margin: '-6px 0 10px', fontSize: 13 }}>Tap players to include or leave out, then pick the goalkeeper.</p>
            <div className="fx-players">
                {team.players.map(p => <button key={p.id} type="button" className={`fx-player-btn ${lu.players.includes(p.id) ? 'is-on' : ''}`} onClick={() => toggle(p.id)}><span className="fx-num">{p.number ?? ''}</span><span>{p.name}</span></button>)}
            </div>
            <div className="fx-field" style={{ marginTop: 12 }}>
                <label htmlFor="fx-gk">Goalkeeper</label>
                <select id="fx-gk" className="fx-select" value={lu.gk || ''} onChange={e => setLu({ ...lu, gk: e.target.value || undefined, players: e.target.value && !lu.players.includes(e.target.value) ? [...lu.players, e.target.value] : lu.players })}>
                    <option value="">Not set</option>
                    {team.players.map(p => <option key={p.id} value={p.id}>{p.number ? `${p.number} · ` : ''}{p.name}</option>)}
                </select>
            </div>
            <button type="button" className="fx-btn fx-btn--primary" style={{ width: '100%', marginTop: 12 }} onClick={() => onSave(lu)}>Save lineup</button>
        </>
    );
};
