import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db, getAllRegisteredPlayers, subscribeToPlayerLinks, subscribeToTournaments } from '../services/storage';
import { computeGlobalLeaderboard, type RankedPlayer } from '../lib/globalLeaderboard';
import type { PlayerLink } from '../lib/playerIdentity';
import type { Match, Tournament } from '../types';

/** Live Match Up rankings: recalculated whenever a result or a merge changes. */
export const useGlobalRankings = () => {
    const [tournaments, setTournaments] = useState<Tournament[] | null>(null);
    const [links, setLinks] = useState<PlayerLink[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [matches, setMatches] = useState<Match[] | null>(null);

    useEffect(() => subscribeToTournaments((d: Tournament[]) => setTournaments(d)) as any, []);
    useEffect(() => subscribeToPlayerLinks(setLinks), []);
    useEffect(() => {
        getDocs(collection(db, 'matches'))
            .then(snap => setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() } as Match))))
            .catch(err => { console.error('Error loading matches:', err); setMatches([]); });
    }, []);
    useEffect(() => {
        getAllRegisteredPlayers().then(setAccounts).catch(err => console.error('Error loading players:', err));
    }, []);

    const rankings: RankedPlayer[] = useMemo(() => {
        if (!tournaments || !matches) return [];
        return computeGlobalLeaderboard(tournaments, accounts, Object.fromEntries(links.map(l => [l.id, l.uid])), matches);
    }, [tournaments, accounts, links, matches]);

    return { rankings, tournaments: tournaments || [], links, accounts, loading: tournaments === null || matches === null };
};
