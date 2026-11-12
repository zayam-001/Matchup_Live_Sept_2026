// One OBS link per court: #obs/<tournamentId>/court/<courtId or court name>.
// Shows whichever match is live on that court, keeps the finished one up for a
// few minutes, and switches by itself when the referee starts the next match,
// so the stream operator never has to change the browser source.
import React, { useEffect, useMemo, useState } from 'react';
import { applyOverlayBackground } from '../lib/overlayBackground';
import OBSOverlay from './OBSOverlay';
import { useTournamentMatches } from '../hooks/useTournamentMatches';
import type { Match } from '../types';

const HOLD_FINISHED_MS = 5 * 60000;
const isLive = (m: Match) => ['IN_PROGRESS', 'LIVE'].includes(String(m.status).toUpperCase());
const isDone = (m: Match) => ['COMPLETED', 'FINISHED'].includes(String(m.status).toUpperCase());
const stamp = (m: any) => Date.parse(m.completedAt || m.endedAt || m.updatedAt || m.startedAt || m.scheduledTime || '') || 0;

export const onCourt = (m: Match, court: string) => {
    const key = court.trim().toLowerCase();
    return [m.actualCourtId, m.courtId, m.scheduledCourtId, m.court, m.courtName].some(v => v && String(v).replace(/^"|"$/g, '').trim().toLowerCase() === key);
};

export const CourtOBS: React.FC<{ tournamentId: string; court: string }> = ({ tournamentId, court }) => {
    const { matches } = useTournamentMatches(tournamentId);
    const [now, setNow] = useState(Date.now());
    useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id); }, []);

    // See-through inside OBS; the Match Up background when opened in a normal browser.
    useEffect(() => applyOverlayBackground(), []);

    // The match last seen live here, and when it finished, so its result stays up for a while.
    const [held, setHeld] = useState<{ id: string; doneAt?: number } | null>(null);
    const live = useMemo(() => matches.filter(m => onCourt(m, court) && isLive(m)).sort((a, b) => stamp(b) - stamp(a))[0], [matches, court]);
    useEffect(() => {
        if (live) { if (held?.id !== live.id || held.doneAt) setHeld({ id: live.id }); return; }
        if (held && !held.doneAt) {
            const m = matches.find(x => x.id === held.id);
            if (m && isDone(m)) setHeld({ id: held.id, doneAt: Date.now() });
            else if (!m || !onCourt(m, court)) setHeld(null);
        }
    }, [live, matches, court, held]);
    const current = live || (held?.doneAt && now - held.doneAt < HOLD_FINISHED_MS ? matches.find(x => x.id === held.id) : undefined);

    // Nothing on court: stay transparent so the stream shows just the video.
    if (!current) return <div style={{ minHeight: '100vh', background: 'transparent' }} />;
    return <OBSOverlay key={current.id} tournamentId={tournamentId} matchId={current.id} />;
};

export default CourtOBS;
