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

/**
 * A player's full surname for the FIP scorebug: the stored `lastName` (from the FIP entry list, so
 * "Melero Bernal" stays whole), else the part before the comma of "Surname, First", else the last word.
 */
export const fullSurname = (player: any): string => {
    if (player?.lastName && String(player.lastName).trim()) return String(player.lastName).trim().toUpperCase();
    const n = realName(player?.name);
    if (!n) return '';
    return (n.includes(',') ? n.split(',')[0] : n.split(/\s+/).pop() || n).trim().toUpperCase();
};

/** Surnames for tight spaces like the OBS scorebug: "Ali Khan / Bilal Ahmed" -> "KHAN / AHMED". */
export const surnamePair = (names: string[]) =>
    names.map(n => n.split(/\s+/).filter(Boolean).pop() || n).join(' / ').toUpperCase();
