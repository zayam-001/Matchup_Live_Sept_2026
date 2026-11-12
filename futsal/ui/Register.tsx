import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Plus, Trash2, Upload } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../services/storage';
import { teamInitials } from '../engine';
import { newId, PRESETS } from '../presets';
import { isDemo, saveFutsalTeam } from '../store';
import type { FutsalTeam, Position, SquadPlayer } from '../types';
import { Crest, dateRange, Empty, Loading, Shell, Star, useFutsalTournament, useToast } from './shared';
import { publicPath, sportOf } from '../sport';
import { createSquad, membersFrom, saveSquad, subscribeMySquads, type PlayerSquad } from '../squads';
import { readXlsx, writeXlsx } from '../xlsx';
import { parseCsv } from './BulkTeams';

const SQUAD_HEAD = ['Player Name', 'Email (optional)', 'Phone (optional)', 'Shirt Number', 'Position (GK/DEF/MID/FWD)'];
/** One team's squad sheet for registration (the organiser's bulk sheet has a team column too). */
const downloadSquadSheet = async () => {
    const blob = await writeXlsx([SQUAD_HEAD, ['Hamza Siddiqui', 'hamza@example.com', '03001234567', '1', 'GK'], ['Ali Raza', '', '', '7', 'FWD']], 'Squad');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'MatchUp_Team_Squad.xlsx'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const playersFromSheet = (rows: string[][]): SquadPlayer[] => {
    const head = (rows[0] || []).map(h => h.toLowerCase());
    const col = (re: RegExp) => head.findIndex(h => re.test(h));
    const c = { name: col(/player|name/), email: col(/mail/), phone: col(/phone|mobile|whatsapp/), num: col(/shirt|number|no\b/), pos: col(/pos/) };
    if (c.name < 0) throw new Error('no-name');
    return rows.slice(1).filter(r => (r[c.name] || '').trim()).map(r => {
        const pos = (c.pos >= 0 ? (r[c.pos] || '').trim().toUpperCase() : '') as Position;
        const num = c.num >= 0 && /^\d{1,2}$/.test((r[c.num] || '').trim()) ? Number(r[c.num].trim()) : undefined;
        const email = c.email >= 0 ? (r[c.email] || '').trim().toLowerCase() : '';
        return { id: newId('p_'), name: r[c.name].trim(), email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : undefined, phone: c.phone >= 0 ? (r[c.phone] || '').trim() || undefined : undefined, number: num, position: POSITIONS.includes(pos) ? pos : '' };
    });
};

export const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#84CC16', '#E5E7EB', '#111827', '#A855F7'];
export const POSITIONS: Position[] = ['GK', 'DEF', 'MID', 'FWD'];

export const useSignedInUser = () => {
    const [user, setUser] = useState<any>(auth?.currentUser || null);
    const [ready, setReady] = useState(!auth || !!auth.currentUser);
    useEffect(() => {
        if (!auth) return;
        return onAuthStateChanged(auth, (u: any) => { setUser(u); setReady(true); });
    }, []);
    const real = user && !user.isAnonymous ? user : null;
    return { user: isDemo() ? (real || { uid: 'demo-captain', email: 'captain@demo.pk', displayName: 'Demo Captain' }) : real, ready: isDemo() || ready };
};

const blankPlayer = (): SquadPlayer => ({ id: newId('p_'), name: '', position: '' });

/** Squad editor shared by team registration and the organiser's team sheet. */
export const SquadEditor: React.FC<{ players: SquadPlayer[]; onChange: (p: SquadPlayer[]) => void; max: number; showContacts?: boolean }> = ({ players, onChange, max, showContacts = true }) => {
    const set = (i: number, patch: Partial<SquadPlayer>) => onChange(players.map((p, k) => (k === i ? { ...p, ...patch } : p)));
    return (
        <div className="fx-list">
            {players.map((p, i) => (
                <div key={p.id} className="fx-li" style={{ flexWrap: 'wrap' }}>
                    <input className="fx-input" style={{ width: 64, flex: '0 0 64px' }} inputMode="numeric" aria-label={`Shirt number for player ${i + 1}`} placeholder="#" value={p.number ?? ''} onChange={e => set(i, { number: e.target.value ? Number(e.target.value.replace(/\D/g, '').slice(0, 2)) : undefined })} />
                    <input className="fx-input" style={{ flex: '1 1 180px' }} aria-label={`Name of player ${i + 1}`} placeholder="Full name" value={p.name} onChange={e => set(i, { name: e.target.value })} />
                    <select className="fx-select" style={{ width: 90, flex: '0 0 90px' }} aria-label={`Position of player ${i + 1}`} value={p.position || ''} onChange={e => set(i, { position: e.target.value as Position })}>
                        <option value="">Pos</option>{POSITIONS.map(x => <option key={x} value={x}>{x}</option>)}
                    </select>
                    {showContacts && <input className="fx-input" style={{ flex: '1 1 170px' }} type="email" aria-label={`Email of player ${i + 1}`} placeholder="Email (optional)" value={p.email || ''} onChange={e => set(i, { email: e.target.value.trim().toLowerCase() })} />}
                    {showContacts && <input className="fx-input" style={{ flex: '1 1 130px' }} aria-label={`Phone of player ${i + 1}`} placeholder="Phone (optional)" inputMode="tel" value={p.phone || ''} onChange={e => set(i, { phone: e.target.value })} />}
                    <button type="button" className="fx-btn fx-btn--sm" aria-label={`Remove player ${i + 1}`} onClick={() => onChange(players.filter((_, k) => k !== i))}><Trash2 /></button>
                </div>
            ))}
            <button type="button" className="fx-btn" disabled={players.length >= max} onClick={() => onChange([...players, blankPlayer()])}><Plus />Add player ({players.length}/{max})</button>
        </div>
    );
};

export const Register: React.FC<{ tournamentId: string }> = ({ tournamentId }) => {
    const { t, teams, loading } = useFutsalTournament(tournamentId);
    const { user, ready } = useSignedInUser();
    const { toast, node } = useToast();
    const mine = useMemo(() => teams.filter(x => user && x.captainUid === user.uid), [teams, user]);
    const [editing, setEditing] = useState<FutsalTeam | null>(null);
    const [form, setForm] = useState<FutsalTeam | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    // Squads this captain already made in Team management (same sport): register one as is.
    const [squads, setSquads] = useState<PlayerSquad[]>([]);
    const [fromSquad, setFromSquad] = useState<string>('');
    useEffect(() => (user?.email && !isDemo() ? subscribeMySquads(user.email, setSquads) : undefined), [user?.email]);
    const ownSquads = useMemo(() => squads.filter(s => s.ownerUid === user?.uid && t && s.sport === sportOf(t)), [squads, user?.uid, t]);
    const sheet = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!t || !user || form) return;
        const base: FutsalTeam = editing || {
            id: newId('t_'), tournamentId: t.id, categoryId: t.categories[0]?.id || '', name: '', shortName: '', color: COLORS[mine.length % COLORS.length],
            captainUid: user.uid, captainName: user.displayName || '', captainEmail: user.email || '', captainPhone: '',
            players: Array.from({ length: t.categories[0]?.rules.squadMin || 5 }, blankPlayer), status: 'PENDING', registeredAt: new Date().toISOString(),
        };
        setForm(structuredClone(base));
    }, [t, user, editing, form, mine.length]);

    if (loading || !ready) return <Shell><div className="fx-wrap"><Loading /></div></Shell>;
    if (!t) return <Shell><div className="fx-wrap"><Empty title="Competition not found" /></div></Shell>;

    const locked = !!t.squadLockAt && Date.now() > new Date(t.squadLockAt).getTime();
    const open = t.status === 'REGISTRATION';
    const cat = form ? t.categories.find(c => c.id === form.categoryId) || t.categories[0] : t.categories[0];

    const signIn = () => {
        try { sessionStorage.setItem('postAuthRedirect', `${publicPath(t)}/register`); } catch { /* ignore */ }
        window.location.hash = 'auth-player';
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form || !cat) return;
        const players = form.players.filter(p => p.name.trim()).map(p => ({ ...p, name: p.name.trim() }));
        const nums = players.map(p => p.number).filter(n => n != null);
        if (!form.name.trim()) return setError('Give your team a name.');
        if (!form.captainName.trim() || !form.captainPhone?.trim()) return setError('Add the captain’s name and phone so the organiser can reach you.');
        if (players.length < cat.rules.squadMin) return setError(`${cat.name} needs at least ${cat.rules.squadMin} players.`);
        if (players.length > cat.rules.squadMax) return setError(`${cat.name} allows at most ${cat.rules.squadMax} players.`);
        if (new Set(nums).size !== nums.length) return setError('Two players have the same shirt number.');
        const clash = teams.find(x => x.id !== form.id && x.categoryId === form.categoryId && x.name.trim().toLowerCase() === form.name.trim().toLowerCase());
        if (clash) return setError('A team with that name is already registered in this category.');
        const full = teams.filter(x => x.categoryId === form.categoryId && x.status === 'ACCEPTED').length >= cat.maxTeams;
        if (!editing && full) return setError(`${cat.name} is full. Pick another category or ask the organiser.`);
        setError(''); setBusy(true);
        try {
            await saveFutsalTeam({ ...form, name: form.name.trim(), shortName: (form.shortName || teamInitials(form.name)).toUpperCase().slice(0, 3), players, status: editing ? form.status : 'PENDING' });
            // The same team shows up in Team management, where the captain can add emails, ratings and positions.
            if (!editing && !isDemo() && user) {
                const linked = ownSquads.find(s => s.id === fromSquad);
                const sync = linked
                    ? saveSquad({ ...linked, name: form.name.trim(), players: membersFrom(players, linked.players) })
                    : createSquad({ sport: sportOf(t), name: form.name.trim(), onPitch: cat.rules.onPitch, ownerUid: user.uid, ownerEmail: (user.email || '').toLowerCase(), ownerName: form.captainName.trim() || user.displayName || 'Captain', players: membersFrom(players) });
                await sync.catch(() => {});
            }
            toast(editing ? 'Squad updated' : 'Team registered. The organiser will review it. You’ll also find it in Team management.');
            setEditing(null); setForm(null); setFromSquad('');
        } catch (err: any) {
            setError(err?.code === 'permission-denied' ? 'You don’t have permission to do that. Try signing in again.' : 'Couldn’t save. Check your connection and try again.');
        } finally { setBusy(false); }
    };

    return (
        <Shell active="home">
            <div className="fx-wrap" style={{ maxWidth: 860, paddingBottom: 60 }}>
                <header className="fx-thead">
                    <a className="fx-link" href={`#${publicPath(t)}`}>← {t.name}</a>
                    <span className="fx-eyebrow" style={{ display: 'flex', marginTop: 14 }}><Star /> Team registration</span>
                    <h1 className="fx-silver" style={{ marginTop: 10, fontSize: 'clamp(34px,6vw,58px)' }}>{t.name}</h1>
                    <p className="fx-muted" style={{ margin: '10px 0 0' }}>{dateRange(t)} · {t.venue}, {t.city}{t.squadLockAt ? ` · Squads lock ${new Date(t.squadLockAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}</p>
                </header>

                {!user ? (
                    <div className="fx-card fx-card--pad fx-stack">
                        <h2 style={{ fontSize: 28 }}>Sign in to register</h2>
                        <p className="fx-muted" style={{ margin: 0 }}>The captain registers the team with their Match Up account, then can edit the squad until it locks.</p>
                        <div><button type="button" className="fx-btn fx-btn--primary" onClick={signIn}>Sign in or create an account</button></div>
                    </div>
                ) : (
                    <div className="fx-stack">
                        {mine.length > 0 && (
                            <div className="fx-card fx-card--pad">
                                <h3 style={{ fontSize: 22, marginBottom: 10 }}>Your teams</h3>
                                <div className="fx-list">
                                    {mine.map(x => (
                                        <div key={x.id} className="fx-li">
                                            <Crest team={x} size={34} />
                                            <div className="fx-li__main"><b>{x.name}</b><small>{t.categories.find(c => c.id === x.categoryId)?.name} · {x.players.length} players</small></div>
                                            <span className={`fx-pill ${x.status === 'ACCEPTED' ? 'fx-pill--ok' : x.status === 'REJECTED' ? 'fx-pill--live' : ''}`}>{x.status === 'PENDING' ? 'Awaiting approval' : x.status.toLowerCase()}</span>
                                            {!locked && x.status !== 'REJECTED' && <button type="button" className="fx-btn fx-btn--sm" onClick={() => { setEditing(x); setForm(null); window.scrollTo({ top: 400, behavior: 'smooth' }); }}>Edit squad</button>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!open && !editing ? (
                            <div className="fx-note fx-note--warn">Registration is closed for this competition.{mine.length ? '' : ' Contact the organiser if you think this is a mistake.'}</div>
                        ) : locked && editing ? (
                            <div className="fx-note fx-note--warn">Squads are locked. Ask the organiser to make changes.</div>
                        ) : form && cat && (
                            <form className="fx-card fx-card--pad fx-stack" onSubmit={submit} noValidate>
                                <div className="fx-row fx-row--between">
                                    <h2 style={{ fontSize: 28 }}>{editing ? `Edit ${editing.name}` : 'New team'}</h2>
                                    <Crest team={{ ...form, shortName: form.shortName || teamInitials(form.name || 'Team') }} size={52} />
                                </div>
                                {!editing && ownSquads.length > 0 && (
                                    <div className="fx-field"><label>Start from</label>
                                        <div className="fx-chips">
                                            <button type="button" className={`fx-chip ${!fromSquad ? 'is-on' : ''}`} aria-pressed={!fromSquad} onClick={() => { setFromSquad(''); setForm({ ...form, name: '', players: Array.from({ length: cat.rules.squadMin }, blankPlayer) }); }}>New team</button>
                                            {ownSquads.map(sq => (
                                                <button key={sq.id} type="button" className={`fx-chip ${fromSquad === sq.id ? 'is-on' : ''}`} aria-pressed={fromSquad === sq.id} onClick={() => {
                                                    const ps: SquadPlayer[] = sq.players.map(p => ({ id: p.id, name: p.name, email: p.email, number: p.number, position: (POSITIONS as string[]).includes(p.position) ? p.position as Position : '' }));
                                                    setFromSquad(sq.id);
                                                    setForm({ ...form, name: sq.name, shortName: '', players: [...ps, ...Array.from({ length: Math.max(0, cat.rules.squadMin - ps.length) }, blankPlayer)] });
                                                }}>{sq.name} · {sq.players.length}</button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="fx-grid2">
                                    <div className="fx-field"><label htmlFor="fx-cat">Category</label>
                                        <select id="fx-cat" className="fx-select" value={form.categoryId} disabled={!!editing} onChange={e => {
                                            const next = t.categories.find(c => c.id === e.target.value);
                                            const pad = Math.max(0, (next?.rules.squadMin || 0) - form.players.length);
                                            setForm({ ...form, categoryId: e.target.value, players: [...form.players, ...Array.from({ length: pad }, blankPlayer)] });
                                        }}>
                                            {t.categories.map(c => <option key={c.id} value={c.id}>{c.name} · {PRESETS[c.rules.preset]?.label}{c.entryFee ? ` · ${t.currency} ${c.entryFee.toLocaleString()}` : ''}</option>)}
                                        </select>
                                    </div>
                                    <div className="fx-field"><label htmlFor="fx-name">Team name</label><input id="fx-name" className="fx-input" value={form.name} maxLength={40} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Clifton Comets" /></div>
                                    <div className="fx-field"><label htmlFor="fx-short">Short name (3 letters)</label><input id="fx-short" className="fx-input" value={form.shortName} maxLength={3} onChange={e => setForm({ ...form, shortName: e.target.value.toUpperCase() })} placeholder={teamInitials(form.name || 'Team')} /></div>
                                    <div className="fx-field"><label>Kit colour</label>
                                        <div className="fx-chips">{COLORS.map(c => <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={form.color === c} onClick={() => setForm({ ...form, color: c })} style={{ width: 30, height: 30, borderRadius: 999, background: c, border: form.color === c ? '3px solid #fff' : '1px solid rgba(255,255,255,.3)' }} />)}</div>
                                    </div>
                                </div>
                                <div className="fx-grid3">
                                    <div className="fx-field"><label htmlFor="fx-cn">Captain</label><input id="fx-cn" className="fx-input" value={form.captainName} onChange={e => setForm({ ...form, captainName: e.target.value })} /></div>
                                    <div className="fx-field"><label htmlFor="fx-cp">Captain phone</label><input id="fx-cp" className="fx-input" inputMode="tel" value={form.captainPhone || ''} onChange={e => setForm({ ...form, captainPhone: e.target.value })} /></div>
                                    <div className="fx-field"><label htmlFor="fx-ce">Captain email</label><input id="fx-ce" className="fx-input" type="email" value={form.captainEmail || ''} onChange={e => setForm({ ...form, captainEmail: e.target.value })} /></div>
                                </div>
                                <div>
                                    <div className="fx-row fx-row--between" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                                        <div><h3 style={{ fontSize: 20 }}>Squad</h3><span className="fx-muted" style={{ fontSize: 13 }}>{cat.rules.squadMin}–{cat.rules.squadMax} players · {cat.rules.onPitch} on the pitch · type names below or upload a sheet</span></div>
                                        <div className="fx-row" style={{ gap: 6 }}>
                                            <button type="button" className="fx-btn fx-btn--sm" onClick={() => downloadSquadSheet()}><Download />Template</button>
                                            <button type="button" className="fx-btn fx-btn--sm" onClick={() => sheet.current?.click()}><Upload />Upload Excel</button>
                                            <input ref={sheet} type="file" hidden accept=".xlsx,.csv" onChange={async e => {
                                                const f = e.target.files?.[0]; e.target.value = '';
                                                if (!f) return;
                                                if (/\.xls$/i.test(f.name)) { setError('That’s the old .xls format. Save it as Excel Workbook (.xlsx) and upload again.'); return; }
                                                try {
                                                    const ps = playersFromSheet(/\.xlsx$/i.test(f.name) ? await readXlsx(f) : parseCsv(await f.text()));
                                                    if (!ps.length) { setError('That sheet has no players under the header.'); return; }
                                                    if (ps.length > cat.rules.squadMax) setError(`The sheet has ${ps.length} players; only the first ${cat.rules.squadMax} were added.`); else setError('');
                                                    setForm({ ...form, players: ps.slice(0, cat.rules.squadMax) });
                                                    toast(`${Math.min(ps.length, cat.rules.squadMax)} players added from ${f.name}`);
                                                } catch { setError('Couldn’t read that file. Start from the template and keep the "Player Name" column.'); }
                                            }} />
                                        </div>
                                    </div>
                                    <SquadEditor players={form.players} max={cat.rules.squadMax} onChange={players => setForm({ ...form, players })} />
                                    <p className="fx-muted" style={{ fontSize: 12, margin: '8px 0 0' }}>Phone numbers link results to each player’s Match Up profile.</p>
                                </div>
                                {error && <div className="fx-note fx-note--err" role="alert">{error}</div>}
                                <div className="fx-row">
                                    <button type="submit" className="fx-btn fx-btn--primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save squad' : 'Register team'}</button>
                                    {editing && <button type="button" className="fx-btn" onClick={() => { setEditing(null); setForm(null); }}>Cancel</button>}
                                </div>
                            </form>
                        )}
                    </div>
                )}
            </div>
            {node}
        </Shell>
    );
};
