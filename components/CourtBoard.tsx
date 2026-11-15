// Organiser overview: which matches are on which court. Filter by court and by state (live, up next,
// finished); each court shows its live match first, then what's next in time order, then results.
import React, { useEffect, useMemo, useState } from 'react';
import type { Match, Tournament } from '../types';
import { useTournamentMatches } from '../hooks/useTournamentMatches';
import { isMatchInCategory } from '../services/storage';
import { Card } from './ui/Card';

type State = 'live' | 'next' | 'done';
const stateOf = (m: Match): State => {
    const s = String(m.status || '').toUpperCase();
    return ['IN_PROGRESS', 'LIVE'].includes(s) ? 'live' : ['COMPLETED', 'FINISHED'].includes(s) ? 'done' : 'next';
};
const clean = (v: unknown) => (v ? String(v).replace(/^"|"$/g, '').trim() : '');
const timeOf = (m: Match) => Date.parse(m.scheduledStartTime || m.scheduledTime || '') || 0;
const NO_COURT = 'No court yet';

export const CourtBoard: React.FC<{ tournament: Tournament; categoryId: string | null }> = ({ tournament, categoryId }) => {
    const { matches: all } = useTournamentMatches(tournament.id);
    // Venue court ids -> names, so matches that store an id still land under the right court.
    const [idToName, setIdToName] = useState<Map<string, string>>(new Map());
    const venueIds = (((tournament as any).venueIds?.length ? (tournament as any).venueIds : [(tournament as any).venueId]) || []).filter(Boolean) as string[];
    useEffect(() => {
        if (!venueIds.length) return;
        let live = true;
        import('../services/storage').then(({ getCourtsByVenueIds }) => getCourtsByVenueIds(venueIds))
            .then((res: any[]) => live && setIdToName(new Map(res.map(c => [c.id, c.courtName || c.name || c.id]))))
            .catch(() => {});
        return () => { live = false; };
    }, [venueIds.join('|')]);

    const own = tournament.courts || [];
    const courtOf = (m: Match) => {
        const names = [m.actualCourtId, m.courtId, m.scheduledCourtId, m.court, m.courtName].map(clean).filter(v => v && v !== 'TBD').map(v => idToName.get(v) || v);
        return names.find(n => own.some(c => c.toLowerCase() === n.toLowerCase())) || names[0] || NO_COURT;
    };

    const matches = useMemo(() => (all || []).filter(m => isMatchInCategory(m, categoryId, tournament)), [all, categoryId, tournament]);
    const byCourt = useMemo(() => {
        const map = new Map<string, Match[]>(own.map(c => [c, []]));
        matches.forEach(m => { const c = courtOf(m); map.set(c, [...(map.get(c) || []), m]); });
        const rank: Record<State, number> = { live: 0, next: 1, done: 2 };
        map.forEach(list => list.sort((a, b) => rank[stateOf(a)] - rank[stateOf(b)] || (stateOf(a) === 'done' ? timeOf(b) - timeOf(a) : timeOf(a) - timeOf(b))));
        return [...map.entries()].sort(([a], [b]) => (a === NO_COURT ? 1 : b === NO_COURT ? -1 : a.localeCompare(b, undefined, { numeric: true })));
    }, [matches, idToName, own.join('|')]);

    const [court, setCourt] = useState('ALL');
    const [state, setState] = useState<'all' | State>('all');
    if (!matches.length) return null;
    const shown = byCourt.filter(([c]) => court === 'ALL' || c === court);
    const chip = (on: boolean) => `px-3 py-1.5 rounded-full text-xs font-bold border transition-colors whitespace-nowrap ${on ? 'bg-brand text-white border-brand' : 'bg-white/5 text-content-secondary border-white/10 hover:text-white'}`;
    const label: Record<State, string> = { live: 'Live', next: 'Up next', done: 'Finished' };
    const pill: Record<State, string> = { live: 'bg-accent-live/20 text-accent-live', next: 'bg-white/10 text-content-secondary', done: 'bg-accent-success/15 text-accent-success' };

    return (
        <Card variant="panel" className="p-5 mt-6">
            <h3 className="text-lg font-bold text-white">Matches by court</h3>
            <p className="text-content-secondary text-sm mt-1">What’s live, what’s next and what’s finished on each court.</p>
            <div className="flex gap-2 overflow-x-auto mt-4 pb-1">
                <button className={chip(court === 'ALL')} onClick={() => setCourt('ALL')}>All courts</button>
                {byCourt.map(([c, list]) => (
                    <button key={c} className={chip(court === c)} onClick={() => setCourt(c)}>
                        {list.some(m => stateOf(m) === 'live') && <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent-live mr-1.5 align-middle animate-pulse" />}
                        {c} · {list.length}
                    </button>
                ))}
            </div>
            <div className="flex gap-2 mt-2">
                {(['all', 'live', 'next', 'done'] as const).map(s => <button key={s} className={chip(state === s)} onClick={() => setState(s)}>{s === 'all' ? 'All' : label[s]}</button>)}
            </div>
            <div className={`grid gap-4 mt-4 ${shown.length > 1 ? 'md:grid-cols-2 xl:grid-cols-3' : ''}`}>
                {shown.map(([c, list]) => {
                    const rows = list.filter(m => state === 'all' || stateOf(m) === state);
                    return (
                        <div key={c} className="rounded-xl border border-white/10 bg-surface-dark/60">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                                <span className="font-bold text-white">{c}</span>
                                <span className="text-xs text-content-muted">{list.filter(m => stateOf(m) === 'done').length}/{list.length} played</span>
                            </div>
                            {rows.length ? (
                                <ul className="divide-y divide-white/5">
                                    {rows.map(m => {
                                        const st = stateOf(m), t = timeOf(m);
                                        const sets = (m.score?.p1SetScores || []).map((g, i) => `${g}-${m.score?.p2SetScores?.[i] ?? 0}`).join(' ');
                                        return (
                                            <li key={m.id} className="px-4 py-2.5 text-sm">
                                                <div className="flex items-center justify-between gap-2 text-[11px] text-content-muted">
                                                    <span className="truncate">{m.roundName || 'Match'}{t ? ` · ${new Date(t).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}</span>
                                                    <span className={`shrink-0 px-2 py-0.5 rounded-full font-bold ${pill[st]}`}>{label[st]}</span>
                                                </div>
                                                <div className="mt-1 flex items-center justify-between gap-3">
                                                    <span className="text-white truncate">{m.team1Name || 'TBD'} <span className="text-content-muted">v</span> {m.team2Name || 'TBD'}</span>
                                                    {st !== 'next' && sets && <span className="shrink-0 font-bold text-white tabular-nums">{sets}{st === 'live' ? ` · ${m.score?.p1Games ?? 0}-${m.score?.p2Games ?? 0}` : ''}</span>}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : <p className="px-4 py-4 text-sm text-content-muted">No {state === 'all' ? '' : label[state as State].toLowerCase() + ' '}matches.</p>}
                        </div>
                    );
                })}
            </div>
        </Card>
    );
};
