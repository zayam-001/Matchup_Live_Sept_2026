// A "Bye" is an empty draw slot, not a team. Organisers sometimes add it by hand as a team named "Bye";
// it must never show in standings or team counts, and a match against it (a walkover) isn't a played match.
import type { Match, Team } from '../types';

export const isByeTeam = (t?: Partial<Team> | null) => !!t && /^\s*bye\s*$/i.test(String(t.name || ''));

/** A walkover against a bye: no score, so it's left out of results, standings and the matches-played count. */
export const isByeMatch = (m: Partial<Match> & { isWalkover?: boolean }, teams: Partial<Team>[] = []) =>
    !!m.isWalkover || [m.team1Id, m.team2Id].some(id => id === 'BYE' || isByeTeam(teams.find(t => t.id === id)))
    || /^\s*bye\s*$/i.test(String(m.team1Name || '')) || /^\s*bye\s*$/i.test(String(m.team2Name || ''));
