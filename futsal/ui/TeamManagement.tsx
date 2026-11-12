// Team management: your tournament team plus squads you build yourself. Whoever makes a
// squad is its captain: they set the formation and subs and add, rate and remove players
// (who get an email invite). Players added by someone else see the same squad, read-only.
import React, { useEffect, useMemo, useState } from 'react';
import { Mail, Plus, Trash2, UserPlus, X } from 'lucide-react';
import { toast } from '../../components/Toast';
import { confirmDialog } from '../../components/ui/ConfirmDialog';
import { createSquad, deleteSquad, emailSquadInvite, memberId, saveLineup, saveSquad, subscribeMySquads, type PlayerSquad, type SquadMember, type SquadPosition } from '../squads';
import { mailAddedToSquad, mailRemovedFromSquad, mailSquadCardUpdated } from '../emails';
import { saveFutsalTeam } from '../store';
import type { FutsalMatch, FutsalTeam, FutsalTournament, Position, SquadPlayer } from '../types';
import { SquadBuilder } from './SquadBuilder';
import { ShareButton, SquadShareCard } from './ShareCard';

interface Account { id?: string; uid?: string; email?: string; fullName?: string; name?: string; position?: string }
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const POSITIONS: SquadPosition[] = ['GK', 'DEF', 'MID', 'FWD'];

export const TeamManagement: React.FC<{
    account: Account; sport: 'futsal' | 'football';
    tournament?: { team: FutsalTeam; onPitch: number; matches: FutsalMatch[]; meId?: string; tour?: FutsalTournament; squadMax?: number };
}> = ({ account, sport, tournament }) => {
    const uid = account.id || account.uid || '';
    const myEmail = (account.email || '').toLowerCase();
    const myName = account.fullName || account.name || 'Me';
    const [all, setAll] = useState<PlayerSquad[] | null>(null);
    useEffect(() => subscribeMySquads(account.email, setAll), [account.email]);
    const squads = useMemo(() => (all || []).filter(s => s.sport === sport), [all, sport]);
    const [pick, setPick] = useState<string>(tournament ? 'tournament' : '');
    const [creating, setCreating] = useState(false);
    useEffect(() => { if (!pick && squads[0]) setPick(squads[0].id); if (!pick && !squads.length && !tournament && all) setCreating(true); }, [squads, pick, tournament, all]);
    const current = squads.find(s => s.id === pick);

    const chips = (
        <div className="tm-chips" role="tablist" aria-label="Squads">
            {tournament && <button type="button" role="tab" aria-selected={pick === 'tournament'} className={pick === 'tournament' ? 'is-on' : ''} onClick={() => { setPick('tournament'); setCreating(false); }}>{tournament.team.name}<small>Tournament</small></button>}
            {squads.map(s => <button key={s.id} type="button" role="tab" aria-selected={pick === s.id} className={pick === s.id ? 'is-on' : ''} onClick={() => { setPick(s.id); setCreating(false); }}>{s.name}<small>{s.ownerUid === uid ? 'Yours' : `by ${s.ownerName.split(' ')[0]}`}</small></button>)}
            <button type="button" className={`tm-new ${creating ? 'is-on' : ''}`} onClick={() => setCreating(true)}><Plus size={14} /> New squad</button>
        </div>
    );

    if (creating) return <div className="tm">{chips}<NewSquad sport={sport} myName={myName} onCancel={squads.length || tournament ? () => setCreating(false) : undefined} onCreate={async (name, onPitch, rows) => {
        try {
            // The captain leads the squad, then everyone typed in; shirt numbers fill in order.
            const me: SquadMember = { id: memberId(), name: myName, email: myEmail || undefined, rating: 75, position: (['GK', 'DEF', 'MID', 'FWD'].includes(account.position || '') ? account.position : 'MID') as SquadPosition, number: 1 };
            const players = [me, ...rows.map((r, i) => ({ ...r, id: memberId(), number: i + 2 }))];
            const s = await createSquad({ sport, name, onPitch, ownerUid: uid, ownerEmail: myEmail, ownerName: myName, players });
            const invited = players.filter(p => p.email && p.email !== myEmail);
            await Promise.all(invited.map(p => emailSquadInvite(s, p).catch(() => {})));
            setPick(s.id); setCreating(false);
            toast.success('Squad created', invited.length ? `We emailed ${invited.length} player${invited.length > 1 ? 's' : ''}.` : 'Set your formation and subs next.');
        } catch (e: any) { toast.error('Couldn’t create the squad', e?.code === 'permission-denied' ? 'Sign in again and retry.' : 'Check your connection and try again.'); }
    }} /></div>;

    if (pick === 'tournament' && tournament) {
        const t = tournament.team;
        // The tournament team's captain can manage the squad until the organiser's squad deadline.
        const captain = (!!uid && t.captainUid === uid) || (!!myEmail && (t.captainEmail || '').toLowerCase() === myEmail);
        const lockAt = tournament.tour?.squadLockAt;
        const locked = (!!lockAt && Date.now() > new Date(lockAt).getTime()) || t.status === 'REJECTED' || t.status === 'WITHDRAWN';
        const roster: Roster = {
            sport, name: t.name, captain: t.captainName || myName, tournament: tournament.tour?.name, captainId: t.players[0]?.id, max: tournament.squadMax,
            players: t.players.map(p => ({ id: p.id, name: p.name, email: p.email, rating: p.rating ?? 60, position: (p.position || 'MID') as SquadPosition, number: p.number })),
            // Keep what the organiser recorded (phone, account link) when the captain edits a player.
            save: players => saveFutsalTeam({ ...t, players: players.map(m => { const old = t.players.find(x => x.id === m.id); return { ...old, id: m.id, name: m.name, email: m.email, number: m.number, position: m.position as Position, rating: m.rating }; }) }),
        };
        const ratings = Object.fromEntries(t.players.filter(p => p.rating != null).map(p => [p.id, p.rating!]));
        return <div className="tm">{chips}<SquadBuilder key={t.id} sportLabel={sport === 'football' ? 'Football' : 'Futsal'} team={t} onPitch={tournament.onPitch} matches={tournament.matches} meId={tournament.meId} ratings={Object.keys(ratings).length ? ratings : undefined} compactHead={captain && !locked}
            side={captain && !locked ? (sel?: SquadPlayer) => <OwnerPanel roster={roster} selectedId={sel?.id} />
                : <p className="tm-note">{captain ? `Squads are locked for ${tournament.tour?.name || 'this tournament'}. Ask the organiser to make changes.` : `${t.captainName || 'Your captain'} manages this tournament squad. Your lineup here is saved on this device.`}</p>} /></div>;
    }
    if (!current) return <div className="tm">{chips}<div className="qp-empty fxs-card"><b>{all ? 'No squads yet' : 'Loading your squads…'}</b>{all && <span>Create a squad and add your players.</span>}</div></div>;

    const owner = current.ownerUid === uid;
    const team: FutsalTeam = {
        id: current.id, tournamentId: '', categoryId: '', name: current.name, shortName: current.name.slice(0, 3).toUpperCase(), color: '#4F6EF7',
        captainName: current.ownerName, players: current.players.map(p => ({ id: p.id, name: p.name, email: p.email, number: p.number, position: p.position as Position })),
        status: 'ACCEPTED', registeredAt: current.createdAt,
    };
    const ratings = Object.fromEntries(current.players.map(p => [p.id, p.rating]));
    const meId = current.players.find(p => p.email && p.email.toLowerCase() === myEmail)?.id;
    return (
        <div className="tm">
            {chips}
            <SquadBuilder key={current.id} sportLabel={sport === 'football' ? 'Football' : 'Futsal'} team={team} onPitch={current.onPitch} matches={[]} meId={meId} ratings={ratings}
                lineup={current.lineup} readOnly={!owner} compactHead={owner}
                onLineup={owner ? l => saveLineup(current.id, l).catch(() => toast.error('Couldn’t save the lineup', 'Check your connection.')) : undefined}
                side={owner ? (sel?: SquadPlayer) => <OwnerPanel roster={{ sport, name: current.name, captain: current.ownerName, captainId: current.players[0]?.id, players: current.players, save: players => saveSquad({ ...current, players }), remove: () => deleteSquad(current) }} selectedId={sel?.id} /> : <p className="tm-note">{current.ownerName} is the captain of this squad, so only they can change it. Make your own with “New squad”.</p>} />
        </div>
    );
};

type Row = Omit<SquadMember, 'id' | 'number'> & { key: number };
let rowKey = 0;
const blankRow = (): Row => ({ key: ++rowKey, name: '', rating: 70, position: 'MID', email: '' });

/** Name the squad, pick the size, and type in the players (only names are required). */
const NewSquad: React.FC<{ sport: 'futsal' | 'football'; myName: string; onCreate: (name: string, onPitch: number, rows: Omit<SquadMember, 'id' | 'number'>[]) => Promise<void>; onCancel?: () => void }> = ({ sport, myName, onCreate, onCancel }) => {
    const [name, setName] = useState('');
    const sizes = sport === 'futsal' ? [5, 6, 7] : [7, 9, 11];
    const [onPitch, setOnPitch] = useState(sport === 'futsal' ? 5 : 11);
    const [rows, setRows] = useState<Row[]>(() => Array.from({ length: (sport === 'futsal' ? 5 : 11) - 1 }, blankRow));
    const [busy, setBusy] = useState(false);
    const set = (k: number, patch: Partial<Row>) => setRows(rs => rs.map(r => (r.key === k ? { ...r, ...patch } : r)));
    const filled = rows.filter(r => r.name.trim());
    const submit = async () => {
        if (!name.trim()) { toast.error('Give your squad a name'); return; }
        const bad = filled.find(r => !Number.isInteger(r.rating) || r.rating < 1 || r.rating > 99);
        if (bad) { toast.error(`${bad.name}: rating must be 1 to 99`); return; }
        const badMail = filled.find(r => r.email && !EMAIL.test(r.email.trim()));
        if (badMail) { toast.error(`${badMail.name}: check the email`); return; }
        setBusy(true);
        try { await onCreate(name.trim(), onPitch, filled.map(({ key: _k, ...r }) => ({ ...r, name: r.name.trim().replace(/\s+/g, ' '), email: r.email?.trim().toLowerCase() || undefined }))); }
        finally { setBusy(false); }
    };
    return (
        <div className="tm-create">
            <div className="tm-create__top">
                <label className="tm-field tm-create__name">Squad name<input className="qp-input" autoFocus placeholder="e.g. Sunday Strikers" value={name} onChange={e => setName(e.target.value)} /></label>
                <label className="tm-field">Players on the pitch<span className="qp-seg">{sizes.map(n => <button key={n} type="button" className={onPitch === n ? 'is-on' : ''} onClick={() => {
                    setOnPitch(n);
                    setRows(rs => rs.filter(r => r.name.trim()).length >= n - 1 ? rs : [...rs.filter(r => r.name.trim()), ...Array.from({ length: n - 1 - rs.filter(r => r.name.trim()).length }, blankRow)]);
                }}>{n} a side</button>)}</span></label>
            </div>
            <div className="tm-rows">
                <div className="tm-row tm-row--head"><span>#</span><span>Player name</span><span>Rating</span><span>Position</span><span>Email (optional)</span><span /></div>
                <div className="tm-row tm-row--me"><span>1</span><span className="tm-row__me">{myName} <em>Captain · you</em></span><span>75</span><span>–</span><span className="qp-muted">Edit later on the pitch</span><span /></div>
                {rows.map((r, i) => (
                    <div key={r.key} className="tm-row">
                        <span>{i + 2}</span>
                        <input className="qp-input" placeholder="Name" aria-label={`Player ${i + 2} name`} value={r.name} onChange={e => set(r.key, { name: e.target.value })} />
                        <input className="qp-input tm-row__rating" type="number" min={1} max={99} aria-label={`Player ${i + 2} rating`} value={r.rating || ''} onChange={e => set(r.key, { rating: Number(e.target.value.slice(0, 2)) })} />
                        <span className="qp-seg tm-row__pos">{POSITIONS.map(x => <button key={x} type="button" className={r.position === x ? 'is-on' : ''} onClick={() => set(r.key, { position: x })}>{x}</button>)}</span>
                        <input className="qp-input" type="email" placeholder="We'll send an invite" aria-label={`Player ${i + 2} email`} value={r.email || ''} onChange={e => set(r.key, { email: e.target.value })} />
                        <button type="button" className="tm-row__del" aria-label={`Remove row ${i + 2}`} onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))}><X size={14} /></button>
                    </div>
                ))}
                <button type="button" className="tm-rows__add" onClick={() => setRows(rs => [...rs, blankRow()])}><Plus size={14} /> Add another player</button>
            </div>
            <div className="tm-create__foot">
                <span className="qp-muted">{filled.length + 1} players · the first {onPitch} start, the rest go to subs. Change it all on the pitch after.</span>
                {onCancel && <button type="button" className="qp-btn" onClick={onCancel}>Cancel</button>}
                <button type="button" className="qp-btn qp-btn--primary" disabled={busy || !name.trim()} onClick={submit}><Plus size={16} /> {busy ? 'Creating…' : 'Create squad'}</button>
            </div>
        </div>
    );
};

/** What the captain edits: a player-made squad or their tournament team, behind one interface. */
interface Roster {
    sport: 'futsal' | 'football' | 'padel'; name: string; captain: string; tournament?: string; captainId?: string; max?: number;
    players: SquadMember[]; save: (players: SquadMember[]) => Promise<void>; remove?: () => Promise<void>;
}
const ctxOf = (r: Roster) => ({ sport: r.sport, squad: r.name, captain: r.captain, tournament: r.tournament });

/** The captain's tools: edit the tapped player, add new ones, delete the squad. */
const OwnerPanel: React.FC<{ roster: Roster; selectedId?: string }> = ({ roster, selectedId }) => {
    const [adding, setAdding] = useState(false);
    const p = roster.players.find(x => x.id === selectedId);
    const full = !!roster.max && roster.players.length >= roster.max;
    return (
        <>
            {p && <PlayerEditor key={p.id} roster={roster} p={p} />}
            {adding ? <AddPlayer roster={roster} onClose={() => setAdding(false)} />
                : <button type="button" className="qp-btn qp-btn--primary tm-addbtn" disabled={full} onClick={() => setAdding(true)}><UserPlus size={16} /> {full ? `Squad full (${roster.max})` : 'Add player'}</button>}
            {roster.remove && <button type="button" className="tm-owner__del" onClick={async () => { if (await confirmDialog({ title: `Delete ${roster.name}?`, body: 'Everyone in it loses access. This can’t be undone.', confirmLabel: 'Delete squad', danger: true, requireText: roster.name })) roster.remove!().catch(() => toast.error('Couldn’t delete the squad')); }}><Trash2 size={13} /> Delete squad</button>}
        </>
    );
};

const validRating = (v: string) => { const r = Number(v); return Number.isInteger(r) && r >= 1 && r <= 99 ? r : null; };
const PADEL_SIDES: SquadPosition[] = ['LEFT', 'RIGHT'];
const sideName = (p: SquadPosition) => (p === 'LEFT' ? 'Left · backhand' : p === 'RIGHT' ? 'Right · forehand' : p);
const PosSeg: React.FC<{ value: SquadPosition; onChange: (p: SquadPosition) => void; padel?: boolean }> = ({ value, onChange, padel }) => (
    <span className="qp-seg">{(padel ? PADEL_SIDES : POSITIONS).map(x => <button key={x} type="button" className={value === x ? 'is-on' : ''} onClick={() => onChange(x)}>{padel ? sideName(x) : x}</button>)}</span>
);

/** Rating, position, shirt and email of one player. A new email sends the invite; other changes send a card update. */
const PlayerEditor: React.FC<{ roster: Roster; p: SquadMember }> = ({ roster, p }) => {
    const [rating, setRating] = useState(String(p.rating));
    const padel = roster.sport === 'padel';
    const [position, setPosition] = useState<SquadPosition>(p.position);
    const [number, setNumber] = useState(p.number != null ? String(p.number) : '');
    const [email, setEmail] = useState(p.email || '');
    const [busy, setBusy] = useState(false);
    const isCaptain = p.id === roster.captainId;
    const num = number.trim() ? Number(number) : undefined;
    const dirty = rating !== String(p.rating) || position !== p.position || num !== p.number || email.trim().toLowerCase() !== (p.email || '');
    const save = async () => {
        const r = validRating(rating);
        const e = email.trim().toLowerCase();
        if (r == null) { toast.error('Rating must be 1 to 99'); return; }
        if (num != null && (!Number.isInteger(num) || num < 0 || num > 99)) { toast.error('Shirt number must be 0 to 99'); return; }
        if (num != null && roster.players.some(x => x.id !== p.id && x.number === num)) { toast.info(`#${num} is taken`, 'Pick another shirt number.'); return; }
        if (e && !EMAIL.test(e)) { toast.error('Check the email address'); return; }
        if (e && roster.players.some(x => x.id !== p.id && x.email?.toLowerCase() === e)) { toast.info('Another player already has that email'); return; }
        const next: SquadMember = { ...p, rating: r, position, number: num, email: e || undefined };
        setBusy(true);
        try {
            await roster.save(roster.players.map(x => (x.id === p.id ? next : x)));
            const newEmail = !!e && e !== (p.email || '');
            const changes: [string, string, string][] = [];
            if (r !== p.rating) changes.push(['Rating', String(p.rating), String(r)]);
            if (position !== p.position) changes.push([padel ? 'Side' : 'Position', padel ? sideName(p.position) : p.position, padel ? sideName(position) : position]);
            if (num !== p.number) changes.push(['Shirt', p.number != null ? `#${p.number}` : '–', num != null ? `#${num}` : '–']);
            // A first email is the invite (it shows their card); otherwise tell them what changed.
            if (newEmail) await mailAddedToSquad(ctxOf(roster), next).catch(() => {});
            else if (e && changes.length && !isCaptain) await mailSquadCardUpdated(ctxOf(roster), next, changes).catch(() => {});
            toast.success(`${p.name} updated`, newEmail ? `Invite sent to ${e}.` : e && changes.length && !isCaptain ? 'We emailed them the change.' : undefined);
        } catch (err: any) { toast.error('Couldn’t save', err?.code === 'permission-denied' ? 'Only the captain can change this squad.' : 'Check your connection and try again.'); }
        finally { setBusy(false); }
    };
    const remove = async () => {
        if (!(await confirmDialog({ title: `Remove ${p.name}?`, body: `They leave ${roster.name}${p.email ? ' and we’ll email them' : ''}. Stats from matches they played stay.`, confirmLabel: 'Remove', danger: true }))) return;
        try {
            await roster.save(roster.players.filter(x => x.id !== p.id));
            if (p.email) await mailRemovedFromSquad(ctxOf(roster), p).catch(() => {});
            toast.success(`${p.name} removed`);
        } catch { toast.error('Couldn’t remove the player'); }
    };
    return (
        <section className="tm-owner">
            <span className="fxs-label">Edit {p.name.split(' ')[0]}{isCaptain ? ' · captain' : ''}</span>
            <div className={`tm-owner__form ${padel ? '' : 'tm-owner__form--3'}`}>
                <label className="tm-field tm-field--rating">Rating<input className="qp-input" type="number" min={1} max={99} value={rating} onChange={e => setRating(e.target.value.slice(0, 2))} /></label>
                {!padel && <label className="tm-field tm-field--rating">Shirt<input className="qp-input" type="number" min={0} max={99} placeholder="#" value={number} onChange={e => setNumber(e.target.value.slice(0, 2))} /></label>}
                <label className="tm-field">{padel ? 'Side' : 'Position'}<PosSeg padel={padel} value={position} onChange={setPosition} /></label>
                <label className="tm-field tm-field--wide">Email {!p.email && <small>· optional, sends an invite</small>}
                    <span className="tm-email"><Mail size={14} /><input className="qp-input" type="email" placeholder="player@email.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && dirty) save(); }} /></span></label>
            </div>
            <div className="tm-owner__row">
                <button type="button" className="qp-btn qp-btn--primary" disabled={!dirty || busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
                {p.email && !isCaptain && !dirty && <button type="button" className="qp-btn" onClick={() => mailAddedToSquad(ctxOf(roster), p).then(() => toast.success('Invite sent again', p.email)).catch(() => toast.error('Couldn’t send the email'))}><Mail size={14} /> Re-invite</button>}
                {!isCaptain && <button type="button" className="qp-btn qp-btn--danger" onClick={remove}><Trash2 size={14} /> Remove</button>}
            </div>
        </section>
    );
};

const AddPlayer: React.FC<{ roster: Roster; onClose: () => void }> = ({ roster, onClose }) => {
    const padel = roster.sport === 'padel';
    const [name, setName] = useState('');
    const [rating, setRating] = useState('70');
    const [position, setPosition] = useState<SquadPosition>(padel ? (roster.players.some(p => p.position === 'RIGHT') ? 'LEFT' : 'RIGHT') : 'MID');
    const [email, setEmail] = useState('');
    const [busy, setBusy] = useState(false);
    const add = async () => {
        const r = validRating(rating);
        const e = email.trim().toLowerCase();
        if (!name.trim()) { toast.error('Add the player’s name'); return; }
        if (r == null) { toast.error('Rating must be 1 to 99'); return; }
        if (e && !EMAIL.test(e)) { toast.error('Check the email address'); return; }
        if (e && roster.players.some(p => p.email?.toLowerCase() === e)) { toast.info('That player is already in the squad'); return; }
        if (roster.players.some(p => p.name.trim().toLowerCase() === name.trim().toLowerCase())) { toast.info('There’s already a player with that name', 'Add a surname or initial.'); return; }
        if (roster.max && roster.players.length >= roster.max) { toast.info('Squad is full', `The most is ${roster.max} players.`); return; }
        const used = new Set(roster.players.map(p => p.number));
        let number = 1; while (used.has(number)) number++;
        const member: SquadMember = { id: memberId(), name: name.trim().replace(/\s+/g, ' '), email: e || undefined, rating: r, position, number };
        setBusy(true);
        try {
            await roster.save([...roster.players, member]);
            if (e) await mailAddedToSquad(ctxOf(roster), member).catch(() => {});
            toast.success(padel ? `${member.name} added` : `${member.name} added to the subs`, e ? `Invite sent to ${e}.` : undefined);
            setName(''); setEmail(''); setRating('70');
        } catch (err: any) { toast.error('Couldn’t add the player', err?.code === 'permission-denied' ? 'Only the captain can change this squad.' : 'Check your connection and try again.'); }
        finally { setBusy(false); }
    };
    return (
        <section className="tm-owner">
            <span className="tm-owner__head"><span className="fxs-label">Add player</span><button type="button" aria-label="Close" onClick={onClose}><X size={14} /></button></span>
            <div className="tm-owner__form">
                <label className="tm-field tm-field--wide">Name<input className="qp-input" autoFocus placeholder="Full name" value={name} onChange={e => setName(e.target.value)} /></label>
                <label className="tm-field tm-field--rating">Rating<input className="qp-input" type="number" min={1} max={99} value={rating} onChange={e => setRating(e.target.value.slice(0, 2))} /></label>
                <label className="tm-field">{padel ? 'Side' : 'Position'}<PosSeg padel={padel} value={position} onChange={setPosition} /></label>
                <label className="tm-field tm-field--wide">Email <small>· optional, sends an invite</small><input className="qp-input" type="email" placeholder="player@email.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} /></label>
            </div>
            <button type="button" className="qp-btn qp-btn--primary" disabled={busy} onClick={add}><UserPlus size={16} /> {busy ? 'Adding…' : 'Add to squad'}</button>
        </section>
    );
};

// ---------------------------------------------------------------- padel squads

/**
 * Padel squads: a pair (the first two players, on their sides of the court) plus up to two reserves.
 * Same rules as futsal: the creator is captain; players they add see the squad read-only.
 */
export const PadelSquads: React.FC<{ account: Account }> = ({ account }) => {
    const uid = account.id || account.uid || '';
    const myEmail = (account.email || '').toLowerCase();
    const myName = account.fullName || account.name || 'Me';
    const [all, setAll] = useState<PlayerSquad[] | null>(null);
    useEffect(() => subscribeMySquads(account.email, setAll), [account.email]);
    const squads = useMemo(() => (all || []).filter(s => s.sport === 'padel'), [all]);
    const [pick, setPick] = useState('');
    const [creating, setCreating] = useState(false);
    useEffect(() => { if (!pick && squads[0]) setPick(squads[0].id); if (!pick && !squads.length && all) setCreating(true); }, [squads, pick, all]);
    const current = squads.find(s => s.id === pick);
    const [sel, setSel] = useState<string | undefined>();
    const chips = (
        <div className="tm-chips" role="tablist" aria-label="Padel squads">
            {squads.map(s => <button key={s.id} type="button" role="tab" aria-selected={pick === s.id} className={pick === s.id ? 'is-on' : ''} onClick={() => { setPick(s.id); setCreating(false); setSel(undefined); }}>{s.name}<small>{s.ownerUid === uid ? 'Yours' : `by ${s.ownerName.split(' ')[0]}`}</small></button>)}
            <button type="button" className={`tm-new ${creating ? 'is-on' : ''}`} onClick={() => setCreating(true)}><Plus size={14} /> New pair</button>
        </div>
    );
    if (creating) return <div className="tm">{chips}<NewPadelSquad myName={myName} onCancel={squads.length ? () => setCreating(false) : undefined} onCreate={async (name, partner) => {
        try {
            const players: SquadMember[] = [{ id: memberId(), name: myName, email: myEmail || undefined, rating: 75, position: partner?.position === 'RIGHT' ? 'LEFT' : 'RIGHT' }];
            if (partner) players.push({ ...partner, id: memberId() });
            const s = await createSquad({ sport: 'padel', name, onPitch: 2, ownerUid: uid, ownerEmail: myEmail, ownerName: myName, players });
            if (partner?.email && partner.email !== myEmail) await emailSquadInvite(s, players[1]).catch(() => {});
            setPick(s.id); setCreating(false);
            toast.success('Pair created', partner?.email ? `Invite sent to ${partner.email}.` : 'Add your partner next.');
        } catch (e: any) { toast.error('Couldn’t create the pair', e?.code === 'permission-denied' ? 'Sign in again and retry.' : 'Check your connection and try again.'); }
    }} /></div>;
    if (!current) return <div className="tm">{chips}<div className="qp-empty fxs-card"><b>{all ? 'No padel squads yet' : 'Loading…'}</b></div></div>;
    const owner = current.ownerUid === uid;
    const [a, b, ...reserves] = current.players;
    const selected = current.players.find(p => p.id === sel) || a;
    const roster: Roster = { sport: 'padel', name: current.name, captain: current.ownerName, captainId: a?.id, max: 4, players: current.players, save: players => saveSquad({ ...current, players }), remove: () => deleteSquad(current) };
    // On court: the right-side (forehand) player on the right, left-side on the left.
    const left = [a, b].find(p => p?.position === 'LEFT') || b, right = [a, b].find(p => p && p !== left) || undefined;
    const card = (p: SquadMember | undefined, slot: string) => p ? (
        <button type="button" className={`pq-card ${sel === p.id || (!sel && p === a) ? 'is-sel' : ''} ${p.email?.toLowerCase() === myEmail ? 'is-me' : ''}`} onClick={() => setSel(p.id)}>
            <span className="pq-card__top"><b>{p.rating}</b><small>{p.position === 'LEFT' ? 'L' : 'R'}</small></span>
            <span className="pq-card__face">{p.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
            <span className="pq-card__name">{p.name.split(' ').slice(-1)[0]}{p.id === a?.id ? ' · C' : ''}</span>
        </button>
    ) : <span className="pq-card is-open">{slot}</span>;
    return (
        <div className="tm">
            {chips}
            <div className="pq">
                <section className="pq-board">
                    <header className="pq-head"><div><h3>{current.name}</h3><small>Padel pair{reserves.length ? ` · ${reserves.length} reserve${reserves.length > 1 ? 's' : ''}` : ''} · tap a player</small></div>
                        <ShareButton className="sq-btn" label="Share" filename={`${current.name.replace(/[^\w]+/g, '-')}-pair.png`} title={`${current.name} padel pair`} card={() => (
                            <SquadShareCard sportLabel="Padel" team={current.name} formation="Pair" onPitch={2}
                                starters={[left, right].filter(Boolean).map((p, i) => ({ x: i ? 70 : 30, y: 78, name: p!.name, rating: p!.rating, role: p!.position === 'LEFT' ? 'LEFT' : 'RIGHT', captain: p!.id === a?.id }))}
                                subs={reserves.map(p => ({ name: p.name, rating: p.rating }))} />
                        )} />
                    </header>
                    <div className="pq-court">
                        <div className="pq-court__far"><span>Opponents</span></div>
                        <div className="pq-court__net" />
                        <div className="pq-court__near">{card(left, 'Left side')}{card(right, 'Partner')}</div>
                    </div>
                    <div className="pq-res"><h4>Reserves</h4>{reserves.length ? reserves.map(p => <React.Fragment key={p.id}>{card(p, '')}</React.Fragment>) : <span className="sq-board__hint">{owner ? 'Add up to two reserves.' : 'No reserves.'}</span>}</div>
                </section>
                <aside className="sq-aside">
                    {selected && (
                        <section className="sq-head pq-who">
                            <span className="sq-head__avatar">{selected.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                            <div><b className="sq-head__ovr">{selected.rating}</b><h3>{selected.name}</h3><small>{sideName(selected.position)}{selected.id === a?.id ? ' · Captain' : ''}</small></div>
                        </section>
                    )}
                    {owner ? <OwnerPanel roster={roster} selectedId={selected?.id} /> : <p className="tm-note">{current.ownerName} is the captain of this pair, so only they can change it. Make your own with “New pair”.</p>}
                </aside>
            </div>
        </div>
    );
};

const NewPadelSquad: React.FC<{ myName: string; onCreate: (name: string, partner?: Omit<SquadMember, 'id'>) => Promise<void>; onCancel?: () => void }> = ({ myName, onCreate, onCancel }) => {
    const [name, setName] = useState('');
    const [pName, setPName] = useState('');
    const [pEmail, setPEmail] = useState('');
    const [pRating, setPRating] = useState('70');
    const [pSide, setPSide] = useState<SquadPosition>('LEFT');
    const [busy, setBusy] = useState(false);
    const submit = async () => {
        if (!name.trim()) { toast.error('Give your pair a name'); return; }
        const r = validRating(pRating);
        if (pName.trim() && r == null) { toast.error('Rating must be 1 to 99'); return; }
        if (pEmail.trim() && !EMAIL.test(pEmail.trim())) { toast.error('Check your partner’s email'); return; }
        setBusy(true);
        try { await onCreate(name.trim(), pName.trim() ? { name: pName.trim(), email: pEmail.trim().toLowerCase() || undefined, rating: r || 70, position: pSide } : undefined); }
        finally { setBusy(false); }
    };
    return (
        <div className="tm-create">
            <div className="tm-create__top"><label className="tm-field tm-create__name">Pair name<input className="qp-input" autoFocus placeholder="e.g. Smash Brothers" value={name} onChange={e => setName(e.target.value)} /></label></div>
            <div className="tm-rows">
                <div className="tm-row tm-row--me"><span>1</span><span className="tm-row__me">{myName} <em>Captain · you</em></span><span>75</span><span>{pSide === 'LEFT' ? 'Right' : 'Left'}</span><span className="qp-muted">Edit later</span><span /></div>
                <div className="tm-row">
                    <span>2</span>
                    <input className="qp-input" placeholder="Partner’s name (optional)" value={pName} onChange={e => setPName(e.target.value)} />
                    <input className="qp-input tm-row__rating" type="number" min={1} max={99} value={pRating} onChange={e => setPRating(e.target.value.slice(0, 2))} />
                    <span className="qp-seg tm-row__pos tm-row__pos--2">{PADEL_SIDES.map(x => <button key={x} type="button" className={pSide === x ? 'is-on' : ''} onClick={() => setPSide(x)}>{x === 'LEFT' ? 'Left' : 'Right'}</button>)}</span>
                    <input className="qp-input" type="email" placeholder="We'll send an invite" value={pEmail} onChange={e => setPEmail(e.target.value)} />
                    <span />
                </div>
            </div>
            <div className="tm-create__foot">
                <span className="qp-muted">You can add up to two reserves after.</span>
                {onCancel && <button type="button" className="qp-btn" onClick={onCancel}>Cancel</button>}
                <button type="button" className="qp-btn qp-btn--primary" disabled={busy || !name.trim()} onClick={submit}><Plus size={16} /> {busy ? 'Creating…' : 'Create pair'}</button>
            </div>
        </div>
    );
};

export default TeamManagement;
