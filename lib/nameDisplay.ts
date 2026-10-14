// Organisers choose whether the broadcast screen and OBS overlay show player
// names or the team name (Tournament.nameDisplay).

import type { NameDisplayMode } from '../types';

export const NAME_DISPLAY_OPTIONS: { id: NameDisplayMode | ''; label: string; hint: string }[] = [
    { id: '', label: 'Default', hint: 'Player names on the broadcast screen, team name on the OBS overlay' },
    { id: 'players', label: 'Player names', hint: 'Both partners on the broadcast screen and OBS overlay' },
    { id: 'team', label: 'Team name', hint: 'The team name on the broadcast screen and OBS overlay' },
];

const realName = (name?: string | null) => {
    const n = String(name || '').trim();
    return n && n.toUpperCase() !== 'N/A' ? n : '';
};

/** The players of a team that actually exist (Player Americano "teams" carry an N/A partner). */
export const teamPlayerNames = (team: any): string[] =>
    [team?.player1?.name, team?.player2?.name].map(realName).filter(Boolean);

/** Surnames for tight spaces like the OBS scorebug: "Ali Khan / Bilal Ahmed" -> "KHAN / AHMED". */
export const surnamePair = (names: string[]) =>
    names.map(n => n.split(/\s+/).filter(Boolean).pop() || n).join(' / ').toUpperCase();
