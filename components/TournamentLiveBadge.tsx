import React, { useMemo } from 'react';
import { useTournamentMatches } from '../hooks/useTournamentMatches';
import { Badge } from './ui/Badge';

export const TournamentLiveBadge = ({ tournamentId, defaultStatus }: { tournamentId: string, defaultStatus: string }) => {
    const { matches } = useTournamentMatches(tournamentId);
    
    const isLive = useMemo(() => {
        // If we have matches, check if any is IN_PROGRESS
        if (matches && matches.length > 0) {
            return matches.some((m: any) => m.status === 'IN_PROGRESS' || m.status === 'LIVE');
        }
        // If no matches yet but tournament is active, maybe we fallback to not showing live or showing it based on defaultStatus?
        // Actually the user explicitly wants: "is there a match that is still live in this tournament... if yes highlight it. if no, then fix this."
        return false;
    }, [matches, defaultStatus]);
    
    if (!isLive) return null;
    return <Badge variant="live" className="shrink-0 animate-pulse">LIVE</Badge>;
};
