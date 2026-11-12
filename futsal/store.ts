// Futsal data access. Firestore in production; in local dev, `#futsal?demo=1`
// switches to a browser-only store so testing never writes to the live database.
import { collection, deleteDoc, doc, onSnapshot, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../services/storage';
import { buildDemo } from './demo';
import type { FutsalMatch, FutsalTeam, FutsalTournament } from './types';

type Kind = 'tournaments' | 'teams' | 'matches';
const COLLECTION: Record<Kind, string> = { tournaments: 'futsalTournaments', teams: 'futsalTeams', matches: 'futsalMatches' };
type Row = { id: string; [k: string]: any };

// ---------------------------------------------------------------- demo backend

const DEMO_KEY = 'futsal_demo_db';
const DEMO_FLAG = 'futsal_demo';

// The flag lives in sessionStorage so demo data never sticks to a browser: closing
// the tab ends it. An older build kept it in localStorage; clear that on load.
try { localStorage.removeItem(DEMO_FLAG); } catch { /* private mode */ }
const readFlag = () => { try { return sessionStorage.getItem(DEMO_FLAG) === '1'; } catch { return false; } };

/** Demo mode is a local-dev tool only; production always uses Firestore. */
export const isDemo = (): boolean => {
    if (!(import.meta as any).env?.DEV) return false;
    const q = window.location.hash.split('?')[1] || '';
    const p = new URLSearchParams(q).get('demo');
    try {
        if (p === '1') sessionStorage.setItem(DEMO_FLAG, '1');
        if (p === '0') sessionStorage.removeItem(DEMO_FLAG);
    } catch { /* private mode */ }
    return p === '1' || (p !== '0' && readFlag());
};

type DemoDb = Record<Kind, Record<string, Row>>;
let demoCache: DemoDb | null = null;
const demoListeners = new Set<() => void>();

const loadDemo = (): DemoDb => {
    if (demoCache) return demoCache;
    try {
        const raw = localStorage.getItem(DEMO_KEY);
        if (raw) return (demoCache = JSON.parse(raw));
    } catch { /* fall through to a fresh seed */ }
    const seed = buildDemo();
    demoCache = {
        tournaments: Object.fromEntries(seed.tournaments.map(r => [r.id, r])),
        teams: Object.fromEntries(seed.teams.map(r => [r.id, r])),
        matches: Object.fromEntries(seed.matches.map(r => [r.id, r])),
    };
    saveDemo();
    return demoCache;
};
const saveDemo = () => {
    try { localStorage.setItem(DEMO_KEY, JSON.stringify(demoCache)); } catch { /* quota */ }
    demoListeners.forEach(fn => fn());
};
if (typeof window !== 'undefined') {
    // Another tab (the scorer, an OBS window) wrote: pick it up here.
    window.addEventListener('storage', e => {
        if (e.key !== DEMO_KEY) return;
        demoCache = null;
        demoListeners.forEach(fn => fn());
    });
}
export const resetDemo = () => { try { localStorage.removeItem(DEMO_KEY); } catch { /* ignore */ } demoCache = null; loadDemo(); };

const demoSubscribe = <T>(kind: Kind, match: (r: Row) => boolean, cb: (rows: T[]) => void) => {
    const run = () => cb(Object.values(loadDemo()[kind]).filter(match).map(r => structuredClone(r)) as T[]);
    demoListeners.add(run);
    queueMicrotask(run);
    return () => { demoListeners.delete(run); };
};

// ---------------------------------------------------------------- helpers

/** Firestore rejects undefined values; drop them. */
const clean = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const listen = <T>(kind: Kind, field: string | null, value: string | null, cb: (rows: T[]) => void, onError?: (e: any) => void) => {
    if (isDemo()) return demoSubscribe<T>(kind, r => !field || r[field] === value, cb);
    if (!db) { cb([]); return () => {}; }
    const col = collection(db, COLLECTION[kind]);
    const q = field ? query(col, where(field, '==', value)) : col;
    return onSnapshot(q, snap => cb(snap.docs.map(d => ({ ...d.data(), id: d.id }) as T)), err => {
        console.error(`Error loading futsal ${kind}:`, err);
        onError?.(err);
        cb([]);
    });
};

const listenOne = <T>(kind: Kind, id: string, cb: (row: T | null) => void) => {
    if (isDemo()) return demoSubscribe<T>(kind, r => r.id === id, rows => cb(rows[0] || null));
    if (!db) { cb(null); return () => {}; }
    return onSnapshot(doc(db, COLLECTION[kind], id), d => cb(d.exists() ? ({ ...d.data(), id: d.id } as T) : null), err => {
        console.error(`Error loading futsal ${kind} ${id}:`, err);
        cb(null);
    });
};

const put = async (kind: Kind, rows: Row[]) => {
    if (!rows.length) return;
    if (isDemo()) {
        const d = loadDemo();
        rows.forEach(r => { d[kind][r.id] = clean(r); });
        saveDemo();
        return;
    }
    if (!db) throw new Error('Database not available');
    // Firestore batches cap at 500 writes.
    for (let i = 0; i < rows.length; i += 400) {
        const batch = writeBatch(db);
        rows.slice(i, i + 400).forEach(r => batch.set(doc(db!, COLLECTION[kind], r.id), clean(r)));
        await batch.commit();
    }
};

const remove = async (kind: Kind, ids: string[]) => {
    if (!ids.length) return;
    if (isDemo()) {
        const d = loadDemo();
        ids.forEach(id => { delete d[kind][id]; });
        saveDemo();
        return;
    }
    if (!db) throw new Error('Database not available');
    if (ids.length === 1) { await deleteDoc(doc(db, COLLECTION[kind], ids[0])); return; }
    for (let i = 0; i < ids.length; i += 400) {
        const batch = writeBatch(db);
        ids.slice(i, i + 400).forEach(id => batch.delete(doc(db!, COLLECTION[kind], id)));
        await batch.commit();
    }
};

// ---------------------------------------------------------------- API

export const subscribeFutsalTournaments = (cb: (rows: FutsalTournament[]) => void) => listen<FutsalTournament>('tournaments', null, null, cb);
export const subscribeFutsalTournament = (id: string, cb: (t: FutsalTournament | null) => void) => listenOne<FutsalTournament>('tournaments', id, cb);
export const subscribeFutsalTeams = (tournamentId: string | null, cb: (rows: FutsalTeam[]) => void) =>
    listen<FutsalTeam>('teams', tournamentId ? 'tournamentId' : null, tournamentId, cb);
export const subscribeFutsalMatches = (tournamentId: string | null, cb: (rows: FutsalMatch[]) => void) =>
    listen<FutsalMatch>('matches', tournamentId ? 'tournamentId' : null, tournamentId, cb);
export const subscribeFutsalMatch = (id: string, cb: (m: FutsalMatch | null) => void) => listenOne<FutsalMatch>('matches', id, cb);

export const saveFutsalTournament = (t: FutsalTournament) => put('tournaments', [t as Row]);
export const saveFutsalTeam = (t: FutsalTeam) => put('teams', [t as Row]);
export const saveFutsalTeams = (rows: FutsalTeam[]) => put('teams', rows as Row[]);
export const deleteFutsalTeam = (id: string) => remove('teams', [id]);
export const saveFutsalMatch = (m: FutsalMatch) => put('matches', [{ ...m, updatedAt: Date.now() } as Row]);
export const saveFutsalMatches = (rows: FutsalMatch[]) => put('matches', rows as Row[]);
export const deleteFutsalMatches = (ids: string[]) => remove('matches', ids);

export const deleteFutsalTournament = async (t: FutsalTournament, teamIds: string[], matchIds: string[]) => {
    await remove('matches', matchIds);
    await remove('teams', teamIds);
    await remove('tournaments', [t.id]);
};

export const isFirestoreReady = () => isDemo() || !!db;
