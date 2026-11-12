// Player-made squads: anyone can build futsal or football teams, rate their players
// and invite them by email. Everyone in a squad sees it once they sign in with that email.
//   playerSquads/{id}   readable when signed in; listed for its members; only the owner edits
import { collection, deleteDoc, doc, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { mailAddedToSquad } from './emails';
import { db } from '../services/storage';

/** Team sports use GK/DEF/MID/FWD; padel uses the side of the court (LEFT backhand, RIGHT forehand). */
export type SquadPosition = 'GK' | 'DEF' | 'MID' | 'FWD' | 'LEFT' | 'RIGHT';
export interface SquadMember { id: string; name: string; email?: string; rating: number; position: SquadPosition; number?: number }
/** The captain's lineup: formation, who starts in each slot, and the bench (player ids). */
export interface SquadLineup { formation: string; slots: (string | null)[]; bench: string[] }
export interface PlayerSquad {
    id: string;
    sport: 'futsal' | 'football' | 'padel';
    name: string;
    onPitch: number;
    ownerUid: string;
    ownerEmail: string;
    ownerName: string;
    players: SquadMember[];
    /** Lower-case emails of the owner and every player with an email, so each can list the squad. */
    members: string[];
    lineup?: SquadLineup;
    createdAt: string;
    updatedAt?: number;
}

const clean = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const lower = (s?: string) => (s || '').trim().toLowerCase();
export const memberId = () => `sm_${Math.random().toString(36).slice(2, 9)}`;
const withMembers = (s: PlayerSquad): PlayerSquad => ({ ...s, members: [...new Set([lower(s.ownerEmail), ...s.players.map(p => lower(p.email))].filter(Boolean))] });

export const subscribeMySquads = (email: string | undefined, cb: (rows: PlayerSquad[]) => void) => {
    const e = lower(email);
    if (!db || !e) { cb([]); return () => {}; }
    return onSnapshot(query(collection(db, 'playerSquads'), where('members', 'array-contains', e)),
        snap => cb(snap.docs.map(d => ({ ...d.data(), id: d.id }) as PlayerSquad).sort((a, b) => a.createdAt.localeCompare(b.createdAt))),
        err => { console.error('Squads', err); cb([]); });
};

export const createSquad = async (s: Omit<PlayerSquad, 'id' | 'members' | 'createdAt'>): Promise<PlayerSquad> => {
    if (!db) throw new Error('Database not available');
    const ref = doc(collection(db, 'playerSquads'));
    const full = withMembers({ ...s, id: ref.id, members: [], createdAt: new Date().toISOString() });
    await setDoc(ref, clean(full));
    return full;
};
export const saveSquad = (s: PlayerSquad) => (db ? setDoc(doc(db, 'playerSquads', s.id), clean({ ...withMembers(s), updatedAt: Date.now() })) : Promise.resolve());
export const saveLineup = (id: string, lineup: SquadLineup) => (db ? updateDoc(doc(db, 'playerSquads', id), clean({ lineup, updatedAt: Date.now() })) : Promise.resolve());
export const deleteSquad = (s: PlayerSquad) => (db ? deleteDoc(doc(db, 'playerSquads', s.id)) : Promise.resolve());

/** Tell a newly added player they're in the squad. */
export const emailSquadInvite = (s: PlayerSquad, p: SquadMember) => mailAddedToSquad({ sport: s.sport, squad: s.name, captain: s.ownerName }, p);

/** Squad players from a registration form; ratings and positions already on the squad are kept. */
export const membersFrom = (players: { id: string; name: string; email?: string; number?: number; position?: string }[], prior: SquadMember[] = []): SquadMember[] =>
    players.filter(p => p.name.trim()).map(p => {
        const old = prior.find(x => x.id === p.id || x.name.trim().toLowerCase() === p.name.trim().toLowerCase());
        const pos = (['GK', 'DEF', 'MID', 'FWD'].includes(p.position || '') ? p.position : old?.position || 'MID') as SquadPosition;
        return { id: old?.id || p.id, name: p.name.trim(), email: lower(p.email) || old?.email, rating: old?.rating ?? 70, position: pos, number: p.number ?? old?.number };
    });
