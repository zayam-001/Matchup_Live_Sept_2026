// Transparent overlay for OBS / streaming: a scorebug, a goal pop-up and full-time card.
import React, { useEffect, useRef, useState } from 'react';
import { applyOverlayBackground } from '../../lib/overlayBackground';
import { foulsFor, scoreOf, shortHanded, fmtClock } from '../engine';
import type { FutsalEvent } from '../types';
import { SIDE_LINE } from './palette';
import { Ball, catOf, clockText, playerName, ShootoutTrack, useFutsalTournament, useNow } from './shared';

const HOLD_FINISHED_MS = 5 * 60000;

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

    // Pop up each new goal once; goals already there when the overlay loads stay quiet.
    useEffect(() => {
        if (!m) return;
        // A different match on the pitch starts quiet too.
        if (seenFor.current !== m.id) { seenFor.current = m.id; seen.current = null; }
        const goals = m.events.filter(e => (e.type === 'GOAL' || e.type === 'OWN_GOAL') && !e.auto);
        if (!seen.current) { seen.current = new Set(goals.map(e => e.id)); return; }
        const fresh = goals.find(e => !seen.current!.has(e.id));
        goals.forEach(e => seen.current!.add(e.id));
        if (fresh) {
            setPop(fresh);
            const id = setTimeout(() => setPop(null), 7000);
            return () => clearTimeout(id);
        }
    }, [m]);

    if (!t || !m) return null;
    const cat = catOf(t, m.categoryId);
    const home = teams.find(x => x.id === m.homeId), away = teams.find(x => x.id === m.awayId);
    const s = scoreOf(m);
    const shorts = shortHanded(m, cat.rules, now);
    const scorerSide = pop ? (pop.type === 'OWN_GOAL' ? (pop.side === 'home' ? 'away' : 'home') : pop.side) : 'home';
    const scorerTeam = scorerSide === 'home' ? home : away;

    return (
        <div className="fx fx-obs" style={{ background: 'transparent', minHeight: '100vh' }}>
            <div className="fx-bug" aria-label="Scoreboard">
                <span className="fx-bug__brand"><Ball /></span>
                <span className="fx-bug__team" style={{ '--c': SIDE_LINE.home } as React.CSSProperties}><i />{home?.shortName || 'HOM'}</span>
                <span className="fx-bug__score">{s.home}–{s.away}</span>
                <span className="fx-bug__team" style={{ '--c': SIDE_LINE.away } as React.CSSProperties}>{away?.shortName || 'AWY'}<i /></span>
                <span className="fx-bug__clock">{clockText(m, cat, now)}</span>
            </div>
            <div className="fx-bug__sub">
                {s.hasPens && m.periodState !== 'SHOOTOUT' && <span>Pens {s.pensHome}–{s.pensAway}</span>}
                {cat.rules.foulLimit > 0 && m.status === 'LIVE' && <span>Fouls {foulsFor(m, cat.rules, 'home')} · {foulsFor(m, cat.rules, 'away')}</span>}
                {shorts.map(x => <span key={x.side} style={{ background: 'rgba(255,59,107,.85)' }}>{(x.side === 'home' ? home : away)?.shortName} −1 · {fmtClock(x.remainingMs)}</span>)}
            </div>
            {(m.periodState === 'SHOOTOUT' || (s.hasPens && m.status !== 'COMPLETED')) && <ShootoutTrack m={m} names={{ home: home?.shortName || 'HOM', away: away?.shortName || 'AWY' }} className="fx-pens--obs" />}
            {pop && (
                <div className="fx-pop" role="status">
                    <b>Goal</b>
                    <div>
                        <small>{scorerTeam?.name}</small>
                        <span>{pop.playerId ? playerName(teams, pop.playerId) : scorerTeam?.name}{pop.type === 'OWN_GOAL' ? ' (og)' : ''}</span>
                    </div>
                    <b style={{ fontSize: 44 }}>{s.home}–{s.away}</b>
                </div>
            )}
            {m.status === 'COMPLETED' && !pop && (
                <div className="fx-pop">
                    <div><small>Full time</small><span>{home?.name} {s.home}–{s.away} {away?.name}</span></div>
                </div>
            )}
        </div>
    );
};
