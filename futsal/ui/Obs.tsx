// Transparent overlay for OBS / streaming, laid out like a European-night broadcast: a flat scorebug
// top-left, and goal, card, kick-off, half-time and full-time panels at the bottom. The tournament's theme
// (crimson for IBA Champions League) sets the colours.
import React, { useEffect, useRef, useState } from 'react';
import { applyOverlayBackground } from '../../lib/overlayBackground';
import { Logo } from '../../components/ui/Logo';
import { eventMinute, foulsFor, scoreOf, shortHanded, fmtClock } from '../engine';
import type { FutsalCategory, FutsalEvent, FutsalMatch, FutsalTeam, Side } from '../types';
import { catOf, clockText, Crest, fmtTime, playerName, ShootoutTrack, stageText, useFutsalTournament, useNow } from './shared';

const HOLD_FINISHED_MS = 5 * 60000;
const POP_MS = 7000;
const POP_TYPES = ['GOAL', 'OWN_GOAL', 'YELLOW', 'RED'];

/** The short phase tag beside the clock: 1H, 2H, ET1, HT, FT, PENS. */
const phaseTag = (m: FutsalMatch, cat: FutsalCategory) => {
    const r = cat.rules;
    if (m.status === 'COMPLETED') return m.decidedBy === 'penalties' ? 'FT · PENS' : m.decidedBy === 'extra_time' || m.decidedBy === 'golden_goal' ? 'AET' : 'FT';
    if (m.periodState === 'SHOOTOUT') return 'PENS';
    if (m.periodState === 'BREAK') return m.period === 1 && r.periods === 2 ? 'HT' : 'BREAK';
    if (m.period > r.periods) return `ET${m.period - r.periods}`;
    if (r.periods === 2) return m.period === 1 ? '1H' : '2H';
    return r.periods === 1 ? '' : `P${m.period}`;
};

/** Goal scorers of one side, in order, e.g. "Ali 12', 40'". An own goal counts for the other side. */
const scorers = (m: FutsalMatch, cat: FutsalCategory, teams: FutsalTeam[], side: Side) => {
    const byName = new Map<string, string[]>();
    m.events.filter(e => (e.type === 'GOAL' && e.side === side) || (e.type === 'OWN_GOAL' && e.side !== side)).forEach(e => {
        const name = (e.playerId ? playerName(teams, e.playerId) : 'Goal') + (e.type === 'OWN_GOAL' ? ' (og)' : '');
        byName.set(name, [...(byName.get(name) || []), eventMinute(cat.rules, e) + (e.goalType === 'penalty' ? ' (P)' : '')]);
    });
    return [...byName].map(([name, mins]) => `${name} ${mins.join(', ')}`);
};

/** `matchId` pins one match; `pitch` follows whatever is live on that pitch and keeps a result up for 5 minutes. */
export const Obs: React.FC<{ tournamentId: string; matchId?: string; pitch?: string }> = ({ tournamentId, matchId, pitch }) => {
    const { t, teams, matches } = useFutsalTournament(tournamentId);
    const [held, setHeld] = useState<{ id: string; doneAt?: number } | null>(null);
    const tick = useNow(30000, !!pitch);
    const livePitch = pitch ? matches.find(x => x.pitch === pitch && x.status === 'LIVE') : undefined;
    useEffect(() => {
        if (!pitch) return;
        if (livePitch) { if (held?.id !== livePitch.id || held.doneAt) setHeld({ id: livePitch.id }); return; }
        if (held && !held.doneAt) {
            const x = matches.find(y => y.id === held.id);
            if (x?.status === 'COMPLETED') setHeld({ id: held.id, doneAt: Date.now() });
            else if (!x || x.pitch !== pitch) setHeld(null);
        }
    }, [pitch, livePitch, matches, held]);
    const m = pitch
        ? livePitch || (held?.doneAt && tick - held.doneAt < HOLD_FINISHED_MS ? matches.find(x => x.id === held.id) : undefined)
        : matches.find(x => x.id === matchId);
    const now = useNow(250, m?.status === 'LIVE');
    const [pop, setPop] = useState<FutsalEvent | null>(null);
    const seen = useRef<Set<string> | null>(null);
    const seenFor = useRef<string | null>(null);

    // See-through inside OBS; the Match Up background when opened in a normal browser.
    useEffect(() => applyOverlayBackground(), []);

    // Pop up each new goal or card once; ones already there when the overlay loads stay quiet.
    useEffect(() => {
        if (!m) return;
        // A different match on the pitch starts quiet too.
        if (seenFor.current !== m.id) { seenFor.current = m.id; seen.current = null; }
        const moments = m.events.filter(e => POP_TYPES.includes(e.type));
        if (!seen.current) { seen.current = new Set(moments.map(e => e.id)); return; }
        const fresh = moments.find(e => !seen.current!.has(e.id));
        moments.forEach(e => seen.current!.add(e.id));
        if (fresh) {
            setPop(fresh);
            const id = setTimeout(() => setPop(null), POP_MS);
            return () => clearTimeout(id);
        }
    }, [m]);

    if (!t || !m) return null;
    const cat = catOf(t, m.categoryId);
    const home = teams.find(x => x.id === m.homeId), away = teams.find(x => x.id === m.awayId);
    const team = (side: Side) => (side === 'home' ? home : away);
    const code = (side: Side) => team(side)?.shortName || (side === 'home' ? 'HOM' : 'AWY');
    const s = scoreOf(m);
    const shorts = shortHanded(m, cat.rules, now);
    const reds = (side: Side) => m.events.filter(e => e.type === 'RED' && e.side === side).length;
    const notStarted = m.status === 'SCHEDULED' || m.periodState === 'PRE';
    const running = m.status === 'LIVE' && ['PLAYING', 'PAUSED'].includes(m.periodState);
    // "45:00 +01:20" splits into the clock and an added-time tab, the way TV shows it.
    const [clock, added] = running ? clockText(m, cat, now).split(' +') : ['', undefined];
    const tag = phaseTag(m, cat);
    const theme = t.theme === 'crimson' ? 'obs--crimson' : '';

    const isGoal = pop && (pop.type === 'GOAL' || pop.type === 'OWN_GOAL');
    const popSide: Side = pop ? (pop.type === 'OWN_GOAL' ? (pop.side === 'home' ? 'away' : 'home') : pop.side) : 'home';
    const popPlayer = pop?.playerId ? playerName(teams, pop.playerId) : team(popSide)?.name;
    const showCard = !pop && (notStarted || m.periodState === 'BREAK' || m.status === 'COMPLETED');
    const cardTitle = notStarted ? `Kick-off ${fmtTime(m.startAt)}` : m.status === 'COMPLETED'
        ? (tag === 'AET' ? 'After extra time' : tag === 'FT' ? 'Full time' : 'Full time · penalties')
        : tag === 'HT' ? 'Half-time' : 'Break';
    const chevron = (dir: 'r' | 'l') => <svg className="obs-chev" viewBox="0 0 10 28" aria-hidden="true"><path d={dir === 'r' ? 'M2 2l6 12-6 12' : 'M8 2L2 14l6 12'} fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>;
    /** The long team bar shared by the scorebug and the panels: HOME › 2 | 1 ‹ AWAY. */
    const bar = (names: Record<Side, string>, withReds: boolean, middle?: React.ReactNode) => (
        <span className="obs-bar">
            <b className="obs-bar__name">{names.home}{withReds && reds('home') > 0 && <span className="obs-reds">{Array.from({ length: reds('home') }, (_, i) => <i key={i} />)}</span>}</b>
            {chevron('r')}
            <span className="obs-bar__score">{middle ?? <><span>{s.home}</span><i /><span>{s.away}</span></>}</span>
            {chevron('l')}
            <b className="obs-bar__name obs-bar__name--away">{withReds && reds('away') > 0 && <span className="obs-reds">{Array.from({ length: reds('away') }, (_, i) => <i key={i} />)}</span>}{names.away}</b>
        </span>
    );
    const fullNames = { home: team('home')?.name || code('home'), away: team('away')?.name || code('away') };
    /** A panel above a full-width team bar with a crest at each end. */
    const panel = (title: React.ReactNode, body: React.ReactNode, middle?: React.ReactNode, cls = '') => (
        <div className={`obs-card ${cls}`} role="status">
            <div className="obs-card__panel">
                <div className="obs-card__head">{title}</div>
                {body}
            </div>
            <div className="obs-card__row">
                <span className="obs-card__crest"><Crest team={team('home')} size={84} label={code('home')} /></span>
                {bar(fullNames, false, middle)}
                <span className="obs-card__crest"><Crest team={team('away')} size={84} label={code('away')} /></span>
            </div>
        </div>
    );

    return (
        <div className={`fx obs ${theme}`} style={{ background: 'transparent', minHeight: '100vh' }}>
            <div className="obs-bug" aria-label="Scoreboard">
                <div className="obs-bug__main">
                    <span className="obs-bug__comp">{t.logoUrl ? <img src={t.logoUrl} alt={t.name} /> : <Logo size={40} variant="white" />}</span>
                    {!notStarted && <span className={`obs-bug__clock ${running ? '' : 'is-phase'}`}>{running ? clock : tag}</span>}
                    <span className="obs-bug__gap" aria-hidden="true" />
                    {bar({ home: code('home'), away: code('away') }, true, notStarted ? <em>v</em> : undefined)}
                    <span className="obs-bug__edge" aria-hidden="true" />
                    {added && <span className="obs-bug__added">+{added.replace(/^0/, '')}</span>}
                </div>
                <div className="obs-bug__strip">
                    {running && tag && <span>{tag === '1H' ? '1st half' : tag === '2H' ? '2nd half' : tag}</span>}
                    {s.hasPens && m.periodState !== 'SHOOTOUT' && <span>Pens {s.pensHome}–{s.pensAway}</span>}
                    {cat.rules.foulLimit > 0 && m.status === 'LIVE' && <span>Fouls {foulsFor(m, cat.rules, 'home')} · {foulsFor(m, cat.rules, 'away')}</span>}
                    {shorts.map(x => <span key={x.side} className="is-alert">{code(x.side)} −1 · {fmtClock(x.remainingMs)}</span>)}
                    <span className="obs-bug__brand"><Logo size={16} variant="white" /> Match Up</span>
                </div>
            </div>

            {(m.periodState === 'SHOOTOUT' || (s.hasPens && m.status !== 'COMPLETED')) && <ShootoutTrack m={m} names={{ home: code('home'), away: code('away') }} className="fx-pens--obs obs-pens" />}

            {pop && isGoal && panel(
                'Goal',
                <div className={`obs-card__goal obs-card__goal--${popSide}`}>
                    <b>{popPlayer}{pop.type === 'OWN_GOAL' ? ' (og)' : ''}</b> <span>{eventMinute(cat.rules, pop)}{pop.goalType === 'penalty' ? ' (P)' : ''}</span>
                </div>,
                undefined, 'obs-card--goal',
            )}
            {pop && !isGoal && (
                <div className="obs-booking" role="status" key={pop.id}>
                    <span className="obs-card__crest"><Crest team={team(pop.side)} size={64} label={code(pop.side)} /></span>
                    <span className="obs-booking__bar">
                        <i className={`obs-booking__card ${pop.type === 'RED' ? 'is-red' : ''}`} aria-hidden="true" />
                        <b>{popPlayer}</b>
                        <small>{eventMinute(cat.rules, pop)}</small>
                    </span>
                </div>
            )}
            {showCard && panel(
                cardTitle,
                notStarted
                    ? (m.pitch ? <div className="obs-card__note">{t.name} · {stageText(m)} · {m.pitch}</div> : <div className="obs-card__note">{t.name} · {stageText(m)}</div>)
                    : (s.home > 0 || s.away > 0)
                        ? <div className="obs-card__scorers">
                            <ul>{scorers(m, cat, teams, 'home').map(x => <li key={x}>{x}</li>)}</ul>
                            <ul>{scorers(m, cat, teams, 'away').map(x => <li key={x}>{x}</li>)}</ul>
                        </div>
                        : <div className="obs-card__note">{t.name} · {stageText(m)}</div>,
                notStarted ? <em>v</em> : (s.hasPens ? <><span>{s.home}</span><i /><span>{s.away}</span><small>({s.pensHome}–{s.pensAway} pens)</small></> : undefined),
            )}
        </div>
    );
};
