// Futsal and football share one engine and one set of collections; a tournament's
// `sport` decides the labels, presets and squad shapes. Older records have no
// `sport` and are futsal.
import type { FutsalTournament, PresetId } from './types';

export type Sport = 'futsal' | 'football';
export const SPORTS: Sport[] = ['futsal', 'football'];

export const sportOf = (t?: Pick<FutsalTournament, 'sport'> | null): Sport => (t?.sport === 'football' ? 'football' : 'futsal');
export const SPORT_LABEL: Record<Sport, string> = { futsal: 'Futsal', football: 'Football' };
export const sportLabel = (t?: Pick<FutsalTournament, 'sport'> | null) => SPORT_LABEL[sportOf(t)];

export const PRESETS_BY_SPORT: Record<Sport, PresetId[]> = {
    futsal: ['casual5', 'fifa5', 'six', 'seven', 'custom'],
    football: ['eleven', 'eleven_short', 'nine', 'eight', 'football_custom'],
};
export const DEFAULT_PRESET: Record<Sport, PresetId> = { futsal: 'casual5', football: 'eleven' };
export const presetSport = (p: PresetId): Sport => (PRESETS_BY_SPORT.football.includes(p) ? 'football' : 'futsal');
export const CUSTOM_PRESET: Record<Sport, PresetId> = { futsal: 'custom', football: 'football_custom' };
export const CATEGORY_NAMES: Record<Sport, string[]> = {
    futsal: ["Men's Open", "Women's Open", 'Kids U14', 'Corporate', 'Masters 35+'],
    football: ["Men's Open", "Women's Open", 'U17', 'U14', 'Corporate', 'Veterans 35+'],
};
export const PITCH_WORD: Record<Sport, string> = { futsal: 'Pitch', football: 'Ground' };

/** Hash routes are "#futsal/..." or "#football/..."; both open the same screens. */
export const routeRoot = (t?: Pick<FutsalTournament, 'sport'> | null) => sportOf(t);
/** A tournament's readable link name, from its name ("IBA Champions League" -> "iba-champions-league"). */
export const futsalSlug = (name?: string | null) => String(name || '').toLowerCase().trim()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
/** The tournament's part of a link: its readable name, or its id if it has no usable name. */
export const linkId = (t: Pick<FutsalTournament, 'id'> & { name?: string }) => futsalSlug(t.name) || t.id;
/** True when a link's tournament part (slug or old id) points at this tournament. */
export const matchesLink = (t: Pick<FutsalTournament, 'id' | 'name'>, key: string) => t.id === key || futsalSlug(t.name) === key;
export const publicPath = (t: Pick<FutsalTournament, 'sport' | 'id'> & { name?: string }) => `${routeRoot(t)}/t/${linkId(t)}`;
export const scorePath = (t: Pick<FutsalTournament, 'sport' | 'id'> & { name?: string }, matchId?: string) => `${routeRoot(t)}-score/${linkId(t)}${matchId ? `/${matchId}` : ''}`;
export const obsPath = (t: Pick<FutsalTournament, 'sport' | 'id'> & { name?: string }, matchId: string) => `${routeRoot(t)}-obs/${linkId(t)}/${matchId}`;
/** One overlay per pitch: it follows whichever match is live there. */
export const pitchObsPath = (t: Pick<FutsalTournament, 'sport' | 'id'> & { name?: string }, pitch: string) => `${routeRoot(t)}-obs/${linkId(t)}/court/${encodeURIComponent(pitch)}`;
