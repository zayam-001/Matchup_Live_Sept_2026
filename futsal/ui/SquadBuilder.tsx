// "My squad" on a player's profile: their team on a pitch, FIFA-style. Drag (or tap
// one, then another) to swap players between positions and the bench; tap a
// player for their stats against the team average. A planning space: the layout
// is kept in this browser and never changes the official squad or lineups.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { playerStats, type PlayerLine } from '../engine';
import type { FutsalMatch, FutsalTeam, SquadPlayer } from '../types';
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from 'recharts';
import './squad.css';
import { ShareButton, SquadShareCard } from './ShareCard';

type Slot = [number, number]; // x%, y% with the goal at the bottom
export const FORMATIONS: Record<number, Record<string, Slot[]>> = {
    5: { '1-2-1': [[50, 88], [50, 62], [22, 44], [78, 44], [50, 20]], '2-2': [[50, 88], [30, 62], [70, 62], [30, 28], [70, 28]], '3-1': [[50, 88], [20, 58], [50, 62], [80, 58], [50, 22]], '2-1-1': [[50, 88], [30, 64], [70, 64], [50, 42], [50, 18]] },
    6: { '2-2-1': [[50, 88], [30, 66], [70, 66], [28, 42], [72, 42], [50, 18]], '3-2': [[50, 88], [20, 62], [50, 66], [80, 62], [32, 28], [68, 28]], '2-3': [[50, 88], [30, 66], [70, 66], [18, 34], [50, 30], [82, 34]] },
    7: { '3-2-1': [[50, 88], [20, 66], [50, 68], [80, 66], [32, 42], [68, 42], [50, 18]], '2-3-1': [[50, 88], [30, 68], [70, 68], [18, 44], [50, 46], [82, 44], [50, 18]], '3-3': [[50, 88], [20, 64], [50, 66], [80, 64], [20, 30], [50, 28], [80, 30]] },
    // Football
    8: { '3-3-1': [[50, 90], [22, 70], [50, 72], [78, 70], [22, 46], [50, 48], [78, 46], [50, 18]], '3-2-2': [[50, 90], [22, 70], [50, 72], [78, 70], [34, 48], [66, 48], [34, 20], [66, 20]], '2-3-2': [[50, 90], [32, 70], [68, 70], [18, 46], [50, 48], [82, 46], [34, 20], [66, 20]] },
    9: { '3-3-2': [[50, 90], [22, 70], [50, 72], [78, 70], [22, 46], [50, 48], [78, 46], [36, 20], [64, 20]], '3-4-1': [[50, 90], [22, 70], [50, 72], [78, 70], [14, 46], [38, 48], [62, 48], [86, 46], [50, 18]], '4-3-1': [[50, 90], [14, 70], [38, 72], [62, 72], [86, 70], [28, 46], [50, 48], [72, 46], [50, 18]] },
    11: {
        '4-3-3': [[50, 90], [14, 70], [38, 73], [62, 73], [86, 70], [28, 48], [50, 51], [72, 48], [18, 22], [50, 16], [82, 22]],
        '4-4-2': [[50, 90], [14, 70], [38, 73], [62, 73], [86, 70], [14, 46], [38, 49], [62, 49], [86, 46], [36, 18], [64, 18]],
        '4-2-3-1': [[50, 90], [14, 70], [38, 73], [62, 73], [86, 70], [36, 54], [64, 54], [18, 36], [50, 36], [82, 36], [50, 14]],
        '3-5-2': [[50, 90], [26, 72], [50, 74], [74, 72], [10, 46], [30, 52], [50, 44], [70, 52], [90, 46], [36, 18], [64, 18]],
    },
};
const ROLE = (y: number, i: number) => (i === 0 ? 'GK' : y >= 55 ? 'DEF' : y >= 35 ? 'MID' : 'FWD');

/** A FIFA-style overall from what the player has done; referee ratings weigh in when present. */
export const overall = (l?: PlayerLine) => {
    if (!l || !l.apps) return 60;
    const form = 60 + Math.min(30, l.goals * 3 + l.assists * 2 + l.motm * 4 + l.cleanSheets * 3) - Math.min(8, l.yellows + l.reds * 3);
    const v = l.ratedMatches ? form * 0.4 + l.rating * 20 * 0.6 : form;
    return Math.max(45, Math.min(99, Math.round(v)));
};

export interface Layout { formation: string; slots: (string | null)[]; bench: string[] }

/** The lineup a player last set on "My squad" (or the default one), with pitch positions: for read-only previews. */
export const savedLineup = (team: FutsalTeam, onPitch: number) => {
    const size = FORMATIONS[onPitch] ? onPitch : 5;
    const forms = FORMATIONS[size];
    const ids = new Set(team.players.map(p => p.id));
    let formation = Object.keys(forms)[0];
    let slots: (string | null)[] | null = null;
    try {
        const saved = JSON.parse(localStorage.getItem(`fx-squad-${team.id}`) || 'null') as Layout | null;
        if (saved && forms[saved.formation] && saved.slots.length === size && saved.slots.every(id => !id || ids.has(id))) { formation = saved.formation; slots = saved.slots; }
    } catch { /* default below */ }
    if (!slots) {
        const gk = team.players.find(p => p.position === 'GK') || team.players[0];
        slots = [gk?.id || null, ...team.players.filter(p => p.id !== gk?.id).slice(0, size - 1).map(p => p.id)];
        while (slots.length < size) slots.push(null);
    }
    const byId = new Map(team.players.map(p => [p.id, p]));
    return { formation, players: forms[formation].map(([x, y], i) => ({ x, y, player: slots![i] ? byId.get(slots![i]!) : undefined })) };
};

/**
 * `ratings` replaces the stats-based rating (player-made squads rate their own players);
 * `side` renders under the player panel (a function gets the selected player).
 * With `lineup` + `onLineup` the layout lives on the squad instead of this browser;
 * `readOnly` lets members look and tap players but not move anyone.
 */
export const SquadBuilder: React.FC<{
    team: FutsalTeam; onPitch: number; matches: FutsalMatch[]; meId?: string; ratings?: Record<string, number>;
    side?: React.ReactNode | ((p?: SquadPlayer) => React.ReactNode); tools?: React.ReactNode;
    lineup?: Layout | null; onLineup?: (l: Layout) => void; readOnly?: boolean; compactHead?: boolean; sportLabel?: string;
}> = ({ team, onPitch, matches, meId, ratings, side, tools, lineup, onLineup, readOnly, compactHead, sportLabel = 'Futsal' }) => {
    const size = FORMATIONS[onPitch] ? onPitch : 5;
    const forms = FORMATIONS[size];
    const key = `fx-squad-${team.id}`;
    const shared = !!onLineup || readOnly;
    const lines = useMemo(() => playerStats([team], matches.filter(m => m.homeId === team.id || m.awayId === team.id)), [team, matches]);
    const byId = useMemo(() => new Map(team.players.map(p => [p.id, p])), [team]);
    const idsKey = team.players.map(p => p.id).join(',');

    const fresh = (formation = Object.keys(forms)[0]): Layout => {
        const gk = team.players.find(p => p.position === 'GK') || team.players[0];
        const rest = team.players.filter(p => p.id !== gk?.id);
        const slots = [gk?.id || null, ...rest.slice(0, size - 1).map(p => p.id)];
        while (slots.length < size) slots.push(null);
        return { formation, slots, bench: rest.slice(size - 1).map(p => p.id) };
    };
    // Fit a saved layout to the current squad: removed players drop out, new ones join the bench.
    const fit = (saved?: Layout | null): Layout => {
        if (!saved || !forms[saved.formation] || saved.slots.length !== size) return fresh(saved && forms[saved.formation] ? saved.formation : undefined);
        const slots = saved.slots.map(id => (id && byId.has(id) ? id : null));
        const bench = saved.bench.filter(id => byId.has(id) && !slots.includes(id));
        const placed = new Set([...slots, ...bench].filter(Boolean) as string[]);
        return { formation: saved.formation, slots, bench: [...bench, ...team.players.filter(p => !placed.has(p.id)).map(p => p.id)] };
    };
    const [layout, setLayout] = useState<Layout>(() => {
        if (shared) return fit(lineup);
        try { return fit(JSON.parse(localStorage.getItem(key) || 'null') as Layout | null); } catch { return fresh(); }
    });
    // Only the captain's own moves are saved; members follow the saved lineup live.
    const touched = useRef(false);
    const edit = (fn: (l: Layout) => Layout) => { if (readOnly) return; touched.current = true; setLayout(fn); };
    useEffect(() => {
        if (!shared) { try { localStorage.setItem(key, JSON.stringify(layout)); } catch { /* private mode */ } return; }
        if (!touched.current || !onLineup) return;
        const t = setTimeout(() => onLineup(layout), 500);
        return () => clearTimeout(t);
    }, [key, layout, shared]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { setLayout(prev => fit(readOnly ? lineup : prev)); }, [idsKey]); // eslint-disable-line react-hooks/exhaustive-deps
    const lineupKey = JSON.stringify(lineup || null);
    useEffect(() => { if (readOnly) setLayout(fit(lineup)); }, [lineupKey, readOnly]); // eslint-disable-line react-hooks/exhaustive-deps

    const [sel, setSel] = useState<string | null>(meId && byId.has(meId) ? meId : layout.slots.find(Boolean) || null);
    const [drag, setDrag] = useState<string | null>(null);
    const [over, setOver] = useState<string | null>(null);

    // Where a player sits: a pitch slot index, or the bench.
    const where = (id: string): { slot: number } | { bench: number } | null => {
        const s = layout.slots.indexOf(id);
        if (s >= 0) return { slot: s };
        const b = layout.bench.indexOf(id);
        return b >= 0 ? { bench: b } : null;
    };
    const swap = (a: string, target: { slot: number } | { bench: true; id?: string }) => {
        edit(prev => {
            const next: Layout = { ...prev, slots: [...prev.slots], bench: [...prev.bench] };
            const from = (() => { const s = next.slots.indexOf(a); if (s >= 0) return { slot: s }; const b = next.bench.indexOf(a); return b >= 0 ? { bench: b } : null; })();
            if (!from) return prev;
            if ('slot' in target) {
                const occupant = next.slots[target.slot];
                if ('slot' in from) { next.slots[from.slot] = occupant; next.slots[target.slot] = a; }
                else { next.bench.splice(from.bench, 1, ...(occupant ? [occupant] : [])); next.slots[target.slot] = a; }
            } else if ('slot' in from) {
                // Pitch to bench: swap with the bench player dropped on, or just sit down.
                const bi = target.id ? next.bench.indexOf(target.id) : -1;
                if (bi >= 0) { next.slots[from.slot] = next.bench[bi]; next.bench[bi] = a; }
                else { next.slots[from.slot] = null; next.bench.push(a); }
            } else if (target.id) {
                const bi = next.bench.indexOf(target.id);
                [next.bench[from.bench], next.bench[bi]] = [next.bench[bi], next.bench[from.bench]];
            }
            return next;
        });
    };
    // Tap a player, then another (or an empty spot) to swap; tap again to keep viewing.
    const tap = (id: string) => {
        if (!sel || sel === id) { setSel(id); return; }
        const w = where(id);
        if (w && 'slot' in w) swap(sel, { slot: w.slot });
        else swap(sel, { bench: true, id });
        setSel(sel);
    };
    const [pendingSwap, setPendingSwap] = useState(false);

    // A kit shirt with rating, form bar and name, FIFA-style; same drag and tap handling as before.
    const card = (id: string, role?: string) => {
        const p = byId.get(id)!;
        const l = lines.get(id);
        const ovr = ratings?.[id] ?? overall(l);
        const gk = role === 'GK' || (!role && p.position === 'GK');
        return (
            <button key={id} type="button" draggable={!readOnly} className={`sq-shirt ${sel === id ? 'is-sel' : ''} ${drag === id ? 'is-drag' : ''} ${meId === id ? 'is-me' : ''}`}
                onDragStart={e => { setDrag(id); e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; }}
                onDragEnd={() => { setDrag(null); setOver(null); }}
                onClick={() => (!readOnly && pendingSwap && sel && sel !== id ? (tap(id), setPendingSwap(false)) : setSel(id))}
                aria-pressed={sel === id} aria-label={`${p.name}, ${role || 'substitute'}, overall ${ovr}`}>
                <span className="sq-shirt__row">
                    <b className="sq-shirt__ovr">{ovr}</b>
                    <Kit gk={gk} num={p.number} />
                    {p.id === team.players[0]?.id && <i className="sq-shirt__cap" title="Captain">C</i>}
                </span>
                <span className="sq-shirt__bar"><i style={{ width: `${Math.min(100, ovr)}%` }} /></span>
                <span className="sq-shirt__name">{p.name.split(' ').slice(-1)[0]}</span>
            </button>
        );
    };
    const drop = (target: { slot: number } | { bench: true; id?: string }) => (e: React.DragEvent) => {
        e.preventDefault();
        if (readOnly) return;
        const id = e.dataTransfer.getData('text/plain') || drag;
        if (id) { swap(id, target); setSel(id); }
        setDrag(null); setOver(null);
    };
    const slots = forms[layout.formation];
    const selected = sel ? byId.get(sel) : undefined;
    const selRole = sel ? (() => { const i = layout.slots.indexOf(sel); return i >= 0 ? ROLE(slots[i][1], i) : 'SUB'; })() : '';

    // Tilted pitch: far end narrower; shirts stay upright (positions are projected, not the pitch rotated).
    const proj = (x: number, y: number) => { const k = y / 100; return { x: 50 + (x - 50) * (0.7 + 0.3 * k), y: 4 + 92 * (0.08 + 0.92 * k) - 2 }; };
    const poly = (pts: [number, number][]) => pts.map(([x, y]) => { const q = proj(x, y); return `${q.x},${q.y}`; }).join(' ');
    const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
        const pts: [number, number][] = [];
        for (let a = a0; a <= a1; a += 10) pts.push([cx + r * Math.cos((a * Math.PI) / 180), cy + r * 1.35 * Math.sin((a * Math.PI) / 180)]);
        return poly(pts);
    };
    const btn = 'sq-btn';

    return (
        <div className={`sq sq--fold ${size >= 8 ? 'sq--big' : ''}`}>

            <section className="sq-board">
                <div className="sq-board__bar">
                    <div><h3>{team.name}</h3><small>{team.players.length} players · {size} a side · {readOnly ? `${layout.formation} · set by the captain` : 'drag a shirt, or tap one then another, to swap'}</small></div>
                    <div className="sq-board__tools">
                        {tools}
                        <ShareButton className={btn} label="Share" filename={`${team.name.replace(/[^\w]+/g, '-')}-squad.png`} title={`${team.name} squad`} card={() => (
                            <SquadShareCard sportLabel={sportLabel} team={team.name} formation={layout.formation} onPitch={size}
                                starters={slots.map(([x, y], i) => { const id = layout.slots[i]; const p = id ? byId.get(id) : undefined; return p ? { x, y, name: p.name, number: p.number, rating: ratings?.[p.id] ?? overall(lines.get(p.id)), role: ROLE(y, i), captain: p.id === team.players[0]?.id } : null; }).filter(Boolean) as any}
                                subs={layout.bench.map(id => byId.get(id)).filter(Boolean).map(p => ({ name: p!.name, number: p!.number, rating: ratings?.[p!.id] ?? overall(lines.get(p!.id)) }))} />
                        )} />
                        {!readOnly && <>
                            <div className="sq-forms" role="group" aria-label="Formation">
                                {Object.keys(forms).map(f => <button key={f} type="button" className={layout.formation === f ? 'is-on' : ''} aria-pressed={layout.formation === f} onClick={() => edit(l => ({ ...l, formation: f }))}>{f}</button>)}
                            </div>
                            <button type="button" className={btn} disabled={!sel} onClick={() => setPendingSwap(v => !v)}>{pendingSwap ? 'Cancel' : 'Swap'}</button>
                            <button type="button" className={btn} onClick={() => edit(() => fresh(layout.formation))}>Reset</button>
                        </>}
                    </div>
                </div>
                {pendingSwap && selected && <p className="sq-board__hint">Tap where {selected.name.split(' ')[0]} should go.</p>}
                <div className="sq-pitch">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                        <defs>
                            <linearGradient id="sq-grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1D7038" /><stop offset="1" stopColor="#2FA14C" /></linearGradient>
                            <radialGradient id="sq-light" cx=".5" cy=".5" r=".7"><stop offset="0" stopColor="rgba(255,255,255,.16)" /><stop offset="1" stopColor="rgba(0,0,0,.25)" /></radialGradient>
                        </defs>
                        <polygon points={poly([[0, 100], [100, 100], [100, 103], [0, 103]])} fill="#0d2414" />
                        <polygon points={poly([[0, 0], [100, 0], [100, 100], [0, 100]])} fill="url(#sq-grass)" />
                        {Array.from({ length: 10 }, (_, i) => <polygon key={i} points={poly([[0, i * 10], [100, i * 10], [100, i * 10 + 5], [0, i * 10 + 5]])} fill="rgba(255,255,255,.05)" />)}
                        <polygon points={poly([[0, 0], [100, 0], [100, 100], [0, 100]])} fill="url(#sq-light)" />
                        <g fill="none" stroke="rgba(255,255,255,.8)" strokeWidth=".4">
                            <polygon points={poly([[3, 3], [97, 3], [97, 97], [3, 97]])} />
                            <polyline points={poly([[3, 50], [97, 50]])} />
                            <polyline points={arc(50, 50, 10, 0, 360)} />
                            <polygon points={poly([[25, 3], [75, 3], [75, 18], [25, 18]])} />
                            <polygon points={poly([[25, 82], [75, 82], [75, 97], [25, 97]])} />
                            <polygon points={poly([[38, 89], [62, 89], [62, 97], [38, 97]])} />
                            <polyline points={arc(50, 82, 7, 200, 340)} />
                        </g>
                    </svg>
                    {slots.map(([x, y], i) => {
                        const id = layout.slots[i];
                        const q = proj(x, y);
                        return (
                            <div key={i} className={`sq-slot ${over === `s${i}` ? 'is-over' : ''}`} style={{ left: `${q.x}%`, top: `${q.y}%`, zIndex: Math.round(y) }}
                                onDragOver={e => { if (readOnly) return; e.preventDefault(); setOver(`s${i}`); }} onDragLeave={() => setOver(null)} onDrop={drop({ slot: i })}
                                onClick={!id && sel && !readOnly ? () => { swap(sel, { slot: i }); } : undefined}>
                                {id ? card(id, ROLE(y, i)) : <span className="sq-slot__empty" aria-label="Empty position">{ROLE(y, i)}</span>}
                            </div>
                        );
                    })}
                </div>
                <div className="sq-bench">
                    <h4>Substitutes</h4>
                    <div className={`sq-bench__row ${over === 'bench' ? 'is-over' : ''}`} onDragOver={e => { if (readOnly) return; e.preventDefault(); setOver('bench'); }} onDragLeave={() => setOver(null)} onDrop={drop({ bench: true })}>
                        {layout.bench.map(id => (
                            <div key={id} onDragOver={e => e.preventDefault()} onDrop={e => { e.stopPropagation(); drop({ bench: true, id })(e); }}>{card(id)}</div>
                        ))}
                        {!layout.bench.length && <span className="sq-board__hint">{readOnly ? 'No substitutes.' : 'Drag a shirt here to bench a player.'}</span>}
                    </div>
                </div>
            </section>
            <aside className="sq-aside">
                <PlayerHeader team={team} p={selected} role={selRole} lines={lines} rating={selected ? ratings?.[selected.id] : undefined} custom={!!ratings} compact={compactHead} />
                {typeof side === 'function' ? side(selected) : side}
            </aside>
        </div>
    );
};

/** A plain kit shirt (Match Up colours, no club marks); goalkeepers wear the alternate kit. */
const Kit: React.FC<{ gk?: boolean; num?: number }> = ({ gk, num }) => (
    <svg viewBox="0 0 40 40" className={`sq-kit ${gk ? 'is-gk' : ''}`} aria-hidden="true">
        <path d="M13 4 L8 6 L2 12 L6 18 L9 16 L9 36 L31 36 L31 16 L34 18 L38 12 L32 6 L27 4 Q20 9 13 4 Z" className="sq-kit__body" />
        <path d="M13 4 Q20 9 27 4" className="sq-kit__collar" />
        <path d="M9 16 L9 36 M31 16 L31 36" className="sq-kit__trim" />
        {num != null && <text x="20" y="27" textAnchor="middle">{num}</text>}
    </svg>
);

/** The selected player, FIFA-style: avatar, position, big rating, form bar, name, and a skill hexagon. */
const PlayerHeader: React.FC<{ team: FutsalTeam; p?: SquadPlayer; role: string; lines: Map<string, PlayerLine>; rating?: number; custom?: boolean; compact?: boolean }> = ({ team, p, role, lines, rating, custom, compact }) => {
    if (!p) return <section className="sq-head sq-head--empty">Tap a player on the pitch to see their card.</section>;
    const l = lines.get(p.id);
    const ovr = rating ?? overall(l);
    const apps = l?.apps || 0;
    const per = (n: number) => (apps ? n / apps : 0);
    const c = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
    // 0–100 from real numbers: 2 goals a match, 1.5 assists, a clean sheet every match … score full marks.
    const skills = [
        { k: 'Attack', v: c(per(l?.goals || 0) * 50) },
        { k: 'Creativity', v: c(per(l?.assists || 0) * 66) },
        { k: 'Impact', v: c(l?.ratedMatches ? l.rating * 20 : per(l?.motm || 0) * 200) },
        { k: 'Defence', v: c(per(l?.cleanSheets || 0) * 100) },
        { k: 'Discipline', v: apps ? c(100 - per((l?.yellows || 0) + 3 * (l?.reds || 0)) * 50) : 0 },
        { k: 'Experience', v: c(apps * 10) },
    ];
    const initials = p.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return (
        <section className="sq-head">
            <div className="sq-head__id">
                <span className="sq-head__avatar">{initials}</span>
                <div className="sq-head__main">
                    <span className="sq-head__pos"><i />{role}</span>
                    <b className="sq-head__ovr">{ovr}</b>
                </div>
                <div className="sq-head__who">
                    <span className="sq-head__bar"><i style={{ width: `${ovr}%` }} /></span>
                    <h3>{p.name}</h3>
                    <small>#{p.number ?? '–'} · {team.name}{p.id === team.players[0]?.id ? ' · Captain' : ''}</small>
                </div>
            </div>
            {compact ? null : custom ? (
                <dl className="sq-head__info">
                    <div><dt>Position</dt><dd>{p.position || role}</dd></div>
                    <div><dt>Rating</dt><dd>{ovr}</dd></div>
                    <div><dt>Shirt</dt><dd>{p.number ?? '–'}</dd></div>
                    <div><dt>Email</dt><dd>{p.email || 'Not added'}</dd></div>
                </dl>
            ) : (
                <>
                    <div className="sq-head__radar">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={skills} outerRadius="68%">
                                <PolarGrid stroke="rgba(255,255,255,.16)" />
                                <PolarAngleAxis dataKey="k" tick={{ fill: '#C9D4FF', fontSize: 12, fontWeight: 700 }} />
                                <Radar dataKey="v" stroke="#FF8A5B" strokeWidth={2.5} fill="#FF8A5B" fillOpacity={0.2} isAnimationActive={false} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="sq-head__nums">
                        {[['Apps', apps], ['Goals', l?.goals || 0], ['Assists', l?.assists || 0], ['Rating', l?.ratedMatches ? l.rating.toFixed(1) : '–']].map(([k, v]) => (
                            <span key={k as string}><b>{v}</b><small>{k}</small></span>
                        ))}
                    </div>
                </>
            )}
        </section>
    );
};

export default SquadBuilder;
