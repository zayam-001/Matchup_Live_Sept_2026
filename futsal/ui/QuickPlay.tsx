// Quick Play in the player portal: the hub (my matches and friends), the new-match
// wizard, the scoring screen, and the referee entry page (#qp) that opens a match
// by its 6-digit code.
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, CalendarDays, Check, ChevronLeft, ChevronRight, RotateCcw, Settings2, Copy, Mail, MapPin, Minus, Play, Plus, Trash2, Trophy, Undo2, UserPlus, X } from 'lucide-react';
import '../../components/admin.css';
import './portal.css';
import { QRCodeSVG } from 'qrcode.react';
import { auth, loginReferee } from '../../services/storage';
import { ScoreShareCard, ShareButton } from './ShareCard';
import { toast } from '../../components/Toast';
import { confirmDialog } from '../../components/ui/ConfirmDialog';
import {
    boardTable, playerKey, publishBoard, subscribeBoard, QUICK_POINTS, type BoardDoc,
    clockMs, createQuickMatch, decide, rotTeamOf, deuceLimitOf, deuceName, finishGame, freshScore, isRotation, pensBestOf, pensDecided, pensNext, pensTally, saveQuickMatch, teamIndexOn, teamOn, deleteQuickMatch, emailInvites, emailFriendInvite, explain, findByCode, gameState, loadFriends, matchMinute, padelOver, padelPoint, pointLabel,
    quickTable, saveFriends, saveQuickScore, scoreText, setDone, setsOf, setsToWin, setsWon, sideLimits, sideOf, SPORT_NAMES, SUBS, subscribeMyQuickMatches, subscribeQuickMatch,
    type Friend, type QuickEvent, type QuickMatch, type QuickPlayer, type QuickSide, type QuickSport,
} from '../quick';

interface Account { id?: string; uid?: string; email?: string; fullName?: string; name?: string }
const SPORTS: QuickSport[] = ['padel', 'futsal', 'football'];
const PHOTOS: Record<string, string> = Object.fromEntries(
    Object.entries(import.meta.glob('../../assets/portal/*.{jpg,jpeg,png,webp}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>)
        .map(([p, url]) => [p.split('/').pop()!.replace(/\.[^.]+$/, ''), url]),
);
const when = (iso: string) => new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Live/upcoming/finished quick matches for the signed-in player (optionally one sport). */
export const useQuickMatches = (email?: string, sport?: QuickSport) => {
    const [rows, setRows] = useState<QuickMatch[] | null>(null);
    useEffect(() => subscribeMyQuickMatches(email, setRows), [email]);
    return useMemo(() => (rows || []).filter(m => !sport || m.sport === sport), [rows, sport]);
};

// ---------------------------------------------------------------- hub

const initials = (name: string) => name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
const first = (name: string) => name.trim().split(/\s+/)[0] || name;

export const QuickHub: React.FC<{ account: Account; sport?: QuickSport; openId?: string }> = ({ account, sport, openId }) => {
    const uid = account.id || account.uid || '';
    const all = useQuickMatches(account.email);
    const matches = useMemo(() => all.filter(m => !sport || m.sport === sport), [all, sport]);
    const [mode, setMode] = useState<{ kind: 'list' } | { kind: 'new' } | { kind: 'match'; id: string }>(openId ? { kind: 'match', id: openId } : { kind: 'list' });
    const [friends, setFriends] = useState<Friend[]>([]);
    const [tab, setTab] = useState<'LIVE' | 'SCHEDULED' | 'COMPLETED'>('LIVE');
    useEffect(() => { if (uid) loadFriends(uid).then(setFriends).catch(() => {}); }, [uid]);
    // The host's device publishes each finished match to the community leaderboard (once per session).
    useEffect(() => {
        const host = auth?.currentUser?.uid;
        if (!host) return;
        all.filter(m => m.status === 'COMPLETED' && m.hostUid === host).forEach(m => {
            const k = `qb-${m.id}-${m.updatedAt || 0}`;
            try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); } catch { /* private mode */ }
            publishBoard(m).catch(e => console.warn('Leaderboard publish', e?.code || e));
        });
    }, [all]);
    const counts = { LIVE: 0, SCHEDULED: 0, COMPLETED: 0 } as Record<QuickMatch['status'], number>;
    matches.forEach(m => { counts[m.status]++; });
    // Open on the first tab that has something in it.
    useEffect(() => { if (!counts[tab]) { const k = (['LIVE', 'SCHEDULED', 'COMPLETED'] as const).find(x => counts[x]); if (k) setTab(k); } }, [matches.length]); // eslint-disable-line react-hooks/exhaustive-deps

    if (mode.kind === 'new') return <QuickWizard account={account} sport={sport} friends={friends} onCancel={() => setMode({ kind: 'list' })} onCreated={id => setMode({ kind: 'match', id })} />;
    if (mode.kind === 'match') return <QuickMatchView id={mode.id} account={account} onBack={() => setMode({ kind: 'list' })} onNew={() => setMode({ kind: 'new' })} />;

    const shown = matches.filter(m => m.status === tab);
    const photo = PHOTOS[sport || 'live'] || PHOTOS.live;
    return (
        <div className="qx">
            <section className="qx-hero" style={photo ? { '--photo': `url("${photo}")` } as React.CSSProperties : undefined}>
                <div>
                    <span className="qx-kicker">Quick Play{sport ? ` · ${SPORT_NAMES[sport]}` : ''}</span>
                    <h2>Set up a match in a minute</h2>
                    <p>Pick the teams, invite players by email and give the referee code to whoever keeps score. Results count towards your stats, XP and the local table.</p>
                </div>
                <button type="button" className="qx-cta" onClick={() => setMode({ kind: 'new' })}><Plus size={18} /> New match</button>
            </section>
            <section className="qx-panel qx-matches">
                <header className="qx-panel__head">
                    <span className="qx-kicker">Your matches</span>
                    <span className="qx-tabs" role="tablist">
                        {([['LIVE', 'Live'], ['SCHEDULED', 'Upcoming'], ['COMPLETED', 'Finished']] as const).map(([k, l]) => (
                            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'is-on' : ''} onClick={() => setTab(k)}>{l} <small>{counts[k]}</small></button>
                        ))}
                    </span>
                </header>
                {shown.length ? <div className="qx-cards">{shown.map(m => <MatchCard key={m.id} m={m} me={{ uid, email: account.email }} onOpen={() => setMode({ kind: 'match', id: m.id })} />)}</div>
                    : <div className="qx-empty"><Play size={26} /><b>{matches.length ? `Nothing ${tab === 'LIVE' ? 'live' : tab === 'SCHEDULED' ? 'coming up' : 'finished'} yet` : 'No quick matches yet'}</b><span>{matches.length ? 'Your other matches are under the other tabs.' : 'Start one and it shows up here for everyone you add.'}</span></div>}
            </section>
            <LocalTable matches={all} sport={sport} email={account.email} />
        </div>
    );
};

/**
 * The Quick Play leaderboard: "Your circle" from matches you're in, or "Everyone" from every published
 * match. Points: 1 to play, 3 a win or 1 a draw, plus 1 per goal (padel: per set won). Players are
 * tracked by email, so only those with one rank. Separate from the official rankings.
 */
const LocalTable: React.FC<{ matches: QuickMatch[]; sport?: QuickSport; email?: string }> = ({ matches, sport, email }) => {
    const [scope, setScope] = useState<'circle' | 'all'>('circle');
    const [board, setBoard] = useState<BoardDoc[] | null>(null);
    const [myKey, setMyKey] = useState('');
    useEffect(() => (scope === 'all' ? subscribeBoard(setBoard) : undefined), [scope]);
    useEffect(() => { if (email) playerKey(email).then(setMyKey).catch(() => {}); }, [email]);
    const me = (email || '').toLowerCase();
    const rows = useMemo(() => scope === 'all'
        ? boardTable(board || [], sport).map(r => ({ id: r.key, name: r.name, p: r.p, w: r.w, goals: r.goals, pts: r.pts, mine: r.key === myKey }))
        : quickTable(matches, sport).map(r => ({ id: r.email, name: r.name, p: r.p, w: r.w, goals: r.goals, pts: r.pts, mine: r.email === me })), [scope, board, matches, sport, myKey, me]);
    const pos = rows.findIndex(r => r.mine);
    const top = rows.slice(0, 10);
    const line = (r: typeof rows[number], i: number) => <tr key={r.id} className={r.mine ? 'is-me' : ''}><td>{i + 1}</td><td><span className="qx-av">{initials(r.name)}</span>{r.name}</td><td>{r.p}</td><td>{r.w}</td><td>{r.goals}</td><td><b>{r.pts}</b></td></tr>;
    return (
        <section className="qx-panel qx-table">
            <header className="qx-panel__head">
                <span className="qx-kicker"><Trophy size={13} /> Leaderboard{sport ? ` · ${SPORT_NAMES[sport]}` : ''}</span>
                <span className="qx-tabs qx-tabs--sm">{(['circle', 'all'] as const).map(k => <button key={k} type="button" className={scope === k ? 'is-on' : ''} onClick={() => setScope(k)}>{k === 'circle' ? 'Your circle' : 'Everyone'}</button>)}</span>
            </header>
            {pos >= 0 && <span className="qx-mypos qx-mypos--bar">You’re #{pos + 1} · {rows[pos].pts} pts</span>}
            {scope === 'all' && board === null ? <div className="qx-empty qx-empty--sm"><span>Loading…</span></div>
                : rows.length ? (
                    <table>
                        <thead><tr><th>#</th><th>Player</th><th>P</th><th>W</th><th>{sport === 'padel' ? 'Sets' : 'G'}</th><th>Pts</th></tr></thead>
                        <tbody>{top.map(line)}{pos >= 10 && line(rows[pos], pos)}</tbody>
                    </table>
                ) : <div className="qx-empty qx-empty--sm"><b>No results yet</b><span>Finish a match and everyone with an email gets points.</span></div>}
            <small className="qx-foot">Points: play {QUICK_POINTS.play} · win {QUICK_POINTS.win} · draw {QUICK_POINTS.draw} · {sport === 'padel' ? 'set won' : 'goal'} {QUICK_POINTS.goal}. Only players with an email count. Separate from the official rankings.</small>
        </section>
    );
};

const MatchCard: React.FC<{ m: QuickMatch; me: { uid?: string; email?: string }; onOpen: () => void }> = ({ m, me, onOpen }) => {
    if (isRotation(m)) {
        const games = m.score.rot?.games || [];
        const myTeam = rotTeamOf(m, me);
        const rows = (m.teams || []).map((t, i) => ({ t, i, w: games.filter(g => g.winner === i).length })).sort((a, b) => b.w - a.w);
        return (
            <button type="button" className={`qx-mc ${m.status === 'LIVE' ? 'is-live' : ''}`} onClick={onOpen}>
                <span className="qx-mc__top"><span className={`qp-sport is-${m.sport}`}>{SPORT_NAMES[m.sport]}</span>{m.status === 'LIVE' ? <em className="qx-live">Live</em> : <small>{when(m.startAt)}</small>}<b className="qx-res is-D">WS</b></span>
                {rows.slice(0, 4).map(({ t, i, w }) => (
                    <span key={i} className={`qx-mc__team ${myTeam === i ? 'is-mine' : ''}`}><span className="qx-mc__who"><b>{t.name}</b><small>{t.players.map(p => first(p.name)).join(' · ')}</small></span>{m.status !== 'SCHEDULED' && <b className="qx-mc__n">{w}</b>}</span>
                ))}
                <span className="qx-mc__sets">Winner stays · {games.length} game{games.length === 1 ? '' : 's'}</span>
            </button>
        );
    }
    const mine = sideOf(m, me);
    const result = m.status === 'COMPLETED' && mine ? (m.winner === 'draw' ? 'D' : m.winner === mine ? 'W' : 'L') : null;
    const [hs, as] = m.sport === 'padel' ? setsWon(m) : (m.score.goals || [0, 0]);
    const team = (side: QuickSide, n: number) => {
        const t = side === 'home' ? m.home : m.away;
        return (
            <span className={`qx-mc__team ${m.winner === side ? 'is-win' : ''} ${mine === side ? 'is-mine' : ''}`}>
                <span className="qx-mc__who"><b>{t.name}</b><small>{t.players.map(p => first(p.name)).join(' · ')}</small></span>
                {m.status !== 'SCHEDULED' && <b className="qx-mc__n">{n}</b>}
            </span>
        );
    };
    return (
        <button type="button" className={`qx-mc ${m.status === 'LIVE' ? 'is-live' : ''}`} onClick={onOpen}>
            <span className="qx-mc__top">
                <span className={`qp-sport is-${m.sport}`}>{SPORT_NAMES[m.sport]}</span>
                {m.status === 'LIVE' ? <em className="qx-live">Live</em> : <small>{when(m.startAt)}</small>}
                {result && <b className={`qx-res is-${result}`}>{result}</b>}
            </span>
            {team('home', hs)}
            {team('away', as)}
            {m.sport === 'padel' && m.status !== 'SCHEDULED' && <span className="qx-mc__sets">{scoreText(m)}</span>}
            {m.venue && <small className="qx-mc__venue"><MapPin size={12} /> {m.venue}</small>}
        </button>
    );
};

/** Quick matches as cards (for a sport's Matches page). `bare` drops the panel and header. */
export const QuickMatchList: React.FC<{ account: Account; sport: QuickSport; onOpen: (id: string) => void; onNew: () => void; bare?: boolean }> = ({ account, sport, onOpen, onNew, bare }) => {
    const matches = useQuickMatches(account.email, sport);
    const cards = matches.length
        ? <div className="qx-cards">{matches.map(m => <MatchCard key={m.id} m={m} me={{ uid: account.id || account.uid, email: account.email }} onOpen={() => onOpen(m.id)} />)}</div>
        : <div className="qx-empty qx-empty--sm"><Play size={22} /><b>No quick matches yet</b><span>Set one up and it shows here for everyone you add.</span><button type="button" className="qx-ghost" onClick={onNew}><Plus size={14} /> New {SPORT_NAMES[sport].toLowerCase()} match</button></div>;
    if (bare) return cards;
    return (
        <section className="qx-panel">
            <header className="qx-panel__head"><span className="qx-kicker">Quick Play matches</span><button type="button" className="qx-ghost" onClick={onNew}><Plus size={14} /> New {SPORT_NAMES[sport].toLowerCase()} match</button></header>
            {cards}
        </section>
    );
};
/** How many quick matches the player has in a sport (for tab counts). */
export const useQuickCount = (email: string | undefined, sport: QuickSport) => useQuickMatches(email, sport).length;

/** The Add Friend page: the same friends list, on its own. */
/** Add Friend: invite panel on the left (adding sends them an email), your friends on the right. */
export const FriendsPage: React.FC<{ account: Account; photo?: string; onQuickPlay?: () => void }> = ({ account, photo, onQuickPlay }) => {
    const uid = account.id || account.uid || '';
    const myName = account.fullName || account.name || 'A friend';
    const [friends, setFriends] = useState<Friend[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [busy, setBusy] = useState(false);
    const [q, setQ] = useState('');
    useEffect(() => { if (uid) loadFriends(uid).then(setFriends).catch(() => {}).finally(() => setLoaded(true)); else setLoaded(true); }, [uid]);
    const add = async () => {
        const e = email.trim().toLowerCase();
        if (!name.trim()) { toast.error('Add your friend’s name'); return; }
        if (!EMAIL.test(e)) { toast.error('Enter a valid email'); return; }
        if (e === (account.email || '').toLowerCase()) { toast.info('That’s your own email'); return; }
        if (friends.some(f => f.email === e)) { toast.info('Already in your friends'); return; }
        const friend = { name: name.trim().replace(/\s+/g, ' '), email: e };
        const next = [friend, ...friends];
        setBusy(true);
        try {
            await saveFriends(uid, next);
            setFriends(next); setName(''); setEmail('');
            const sent = await emailFriendInvite({ name: myName, email: account.email }, friend).then(() => true, () => false);
            toast.success(`${friend.name} added`, sent ? `We emailed an invite to ${e}.` : 'Saved, but the invite email didn’t send.');
        } catch { toast.error('Couldn’t save your friend', 'Check your connection and try again.'); }
        finally { setBusy(false); }
    };
    const resend = async (f: Friend) => {
        try { await emailFriendInvite({ name: myName, email: account.email }, f); toast.success('Invite sent again', f.email); }
        catch { toast.error('Couldn’t send the email'); }
    };
    const remove = async (f: Friend) => {
        if (!(await confirmDialog({ title: `Remove ${f.name}?`, body: 'They’re taken off your friends list. You can add them again any time.', confirmLabel: 'Remove', danger: true }))) return;
        const next = friends.filter(x => x.email !== f.email);
        try { await saveFriends(uid, next); setFriends(next); } catch { toast.error('Couldn’t remove that friend'); }
    };
    const shown = friends.filter(f => !q.trim() || `${f.name} ${f.email}`.toLowerCase().includes(q.trim().toLowerCase()));
    return (
        <div className="fr">
            <section className="fr-invite" style={photo ? { '--photo': `url("${photo}")` } as React.CSSProperties : undefined}>
                <div className="fr-invite__copy">
                    <span className="fr-kicker">Add friend</span>
                    <h2>Bring your crew</h2>
                    <p>Add someone by email. We send them an invite, and you can pick them in one tap for matches and squads.</p>
                </div>
                <div className="fr-form">
                    <label>Name<input className="fr-input" placeholder="Their full name" value={name} onChange={e => setName(e.target.value)} /></label>
                    <label>Email<input className="fr-input" type="email" placeholder="friend@email.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} /></label>
                    <button type="button" className="fr-send" disabled={busy || !uid} onClick={add}><Mail size={17} /> {busy ? 'Sending…' : 'Add & send invite'}</button>
                </div>
                <ol className="fr-steps">
                    <li><b>1</b>They get an email from Match Up</li>
                    <li><b>2</b>They sign up with that email</li>
                    <li><b>3</b>You play together</li>
                </ol>
            </section>
            <section className="fr-list">
                <header className="fr-list__head">
                    <div><span className="fr-kicker">Your friends</span><b className="fr-count">{friends.length}</b></div>
                    {friends.length > 5 && <input className="fr-input fr-search" placeholder="Search friends" value={q} onChange={e => setQ(e.target.value)} />}
                    {onQuickPlay && friends.length > 0 && <button type="button" className="fr-ghost" onClick={onQuickPlay}><Play size={15} /> Set up a match</button>}
                </header>
                {!loaded ? <div className="fr-empty"><span>Loading…</span></div>
                    : !friends.length ? (
                        <div className="fr-empty">
                            <span className="fr-empty__icon"><UserPlus size={30} /></span>
                            <b>No friends yet</b>
                            <span>Add the people you play with. They’ll show up here.</span>
                        </div>
                    ) : (
                        <ul className="fr-grid">
                            {shown.map(f => (
                                <li key={f.email} className="fr-card">
                                    <span className="fr-avatar">{f.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                                    <span className="fr-card__who"><b>{f.name}</b><small>{f.email}</small></span>
                                    <span className="fr-card__acts">
                                        <button type="button" title="Send the invite again" aria-label={`Email ${f.name} again`} onClick={() => resend(f)}><Mail size={15} /></button>
                                        <button type="button" title="Remove" aria-label={`Remove ${f.name}`} onClick={() => remove(f)}><Trash2 size={15} /></button>
                                    </span>
                                </li>
                            ))}
                            {!shown.length && <li className="fr-none">No friends match “{q}”.</li>}
                        </ul>
                    )}
            </section>
        </div>
    );
};

// ---------------------------------------------------------------- wizard

type Draft = { name: string; players: QuickPlayer[] };
const sameP = (a: QuickPlayer, b: QuickPlayer) => (!!a.email && !!b.email && a.email === b.email) || (!!a.uid && a.uid === b.uid);
const LETTERS = 'ABCDEFGH';
const teamLabel = (i: number) => `Team ${LETTERS[i] || i + 1}`;

/** What's wrong with the teams, if anything (shown under the teams and checked again on create). */
const teamProblem = (sport: QuickSport, onPitch: number, teams: Draft[]): string | null => {
    const { min, max } = sideLimits(sport, onPitch);
    for (const [i, t] of teams.entries()) {
        const name = t.name.trim() || teamLabel(i);
        if (t.players.length < min) return sport === 'padel' ? `${name} needs 2 players. Padel is 2 v 2.` : `${name} needs at least one player.`;
        if (t.players.length > max) return `${name} has ${t.players.length} players; the most is ${max}.`;
        const bad = t.players.find(p => p.email && !EMAIL.test(p.email));
        if (bad) return `Check ${bad.name}’s email.`;
        const names = t.players.map(p => p.name.trim().toLowerCase());
        if (new Set(names).size !== names.length) return `${name} has two players with the same name. Add a surname.`;
    }
    for (let i = 0; i < teams.length; i++) for (let j = i + 1; j < teams.length; j++) {
        const clash = teams[i].players.find(p => teams[j].players.some(q => sameP(p, q)));
        if (clash) return `${clash.name} is on two teams.`;
        if (teams[i].name.trim() && teams[i].name.trim().toLowerCase() === teams[j].name.trim().toLowerCase()) return 'Give every team a different name.';
    }
    return null;
};

type Fmt = { sets: number; games: number; deuceLimit: number; halves: number; minutes: number; onPitch: number; pensBestOf: number; mode: 'match' | 'rotation'; goalCap: number; drawRule: 'pens' | 'champion' | 'challenger' };
const DRAW_RULES: Fmt['drawRule'][] = ['pens', 'champion', 'challenger'];
const drawName = (r: Fmt['drawRule']) => (r === 'pens' ? 'Penalties decide' : r === 'champion' ? 'Team on longer goes off' : 'Newest team goes off');
/** A short line describing the format. */
const fmtLine = (sport: QuickSport, f: Partial<Fmt>, teams = 2) => sport === 'padel'
    ? `${(f.sets || 3) === 1 ? 'One set' : `Best of ${f.sets || 3}`} · ${f.games || 6} games · ${deuceName(f.deuceLimit ?? 0).toLowerCase()}`
    : f.mode === 'rotation'
        ? `Winner stays · ${teams} teams · ${f.minutes} min${f.goalCap ? ` or first to ${f.goalCap}` : ''}`
        : `${f.onPitch} a side · ${(f.halves || 2) > 1 ? `${f.halves} × ${f.minutes}` : f.minutes} min`;

/** The setting rows for a sport's format, shared by match setup and in-match settings. */
const FormatRows: React.FC<{ sport: QuickSport; f: Fmt; set: (f: Fmt) => void; teams?: number; setTeams?: (n: number) => void; setSize: (n: number) => void; locked?: boolean; minSize?: number }> = ({ sport, f, set, teams = 2, setTeams, setSize, locked, minSize = 1 }) => {
    if (sport === 'padel') return <>
        <Cycle label="Match length" value={f.sets} options={[[1, 'One set'], [3, 'Best of 3 sets']]} custom={{ min: 5, max: 9, step: 2, text: n => `Best of ${n} sets` }} onChange={v => set({ ...f, sets: v })} />
        <Cycle label="Games per set" value={f.games} options={[[4, '4 games'], [6, '6 games']]} custom={{ min: 1, max: 9, text: n => `${n} game${n > 1 ? 's' : ''}${n >= 8 ? ' (pro set)' : ''}` }} onChange={v => set({ ...f, games: v })} />
        <Cycle label="At deuce" value={f.deuceLimit} options={[[0, 'Golden point'], [99, 'Advantage'], [2, 'Star point']]} custom={{ min: 1, max: 6, text: n => `${n} advantage${n > 1 ? 's' : ''}, then golden point` }}
            hint={f.deuceLimit === 2 ? 'Two advantages, then golden point on the third deuce (FIP 2026)' : f.deuceLimit === 0 ? 'Next point at 40-40 wins the game' : f.deuceLimit >= 99 ? 'Win by two points' : undefined} onChange={v => set({ ...f, deuceLimit: v })} />
    </>;
    const sizes = (sport === 'futsal' ? [5, 6, 7] : [7, 9, 11]).filter(n => n >= minSize);
    const rotation = f.mode === 'rotation';
    return <>
        {setTeams && !locked && <Cycle label="Format" value={rotation ? 1 : 0} options={[[0, 'Single match'], [1, 'Winner stays']]} hint={rotation ? 'Winner stays on, loser swaps with the next team' : '2 teams, one result'} onChange={v => set({ ...f, mode: v ? 'rotation' : 'match', ...(v ? { minutes: 10, halves: 1 } : { minutes: sport === 'football' ? 30 : 20, halves: 2 }) })} />}
        {rotation && setTeams && !locked && <Cycle label="Teams" value={teams} options={[[3, '3 teams'], [4, '4 teams']]} custom={{ min: 5, max: 8, text: n => `${n} teams` }} onChange={setTeams} />}
        <Cycle label="Players per side" value={f.onPitch} options={sizes.map(n => [n, `${n} a side`] as [number, string])} custom={{ min: Math.max(3, minSize), max: 11, text: n => `${n} a side` }} onChange={setSize} hint={`Up to ${f.onPitch + SUBS[sport]} per team with subs`} />
        {rotation ? <>
            <Cycle label="Game length" value={f.minutes} options={[[5, '5 min'], [7, '7 min'], [10, '10 min'], [12, '12 min'], [15, '15 min']]} custom={{ min: 1, max: 60, text: n => `${n} min` }} onChange={v => set({ ...f, minutes: v })} />
            <Cycle label="Game ends at" value={f.goalCap} options={[[0, 'Time only'], [1, 'First goal'], [2, 'First to 2'], [3, 'First to 3']]} custom={{ min: 4, max: 10, text: n => `First to ${n}` }} hint="Or whoever leads when time runs out" onChange={v => set({ ...f, goalCap: v })} />
            <Cycle label="If it’s level" value={DRAW_RULES.indexOf(f.drawRule)} options={DRAW_RULES.map((r, i) => [i, drawName(r)] as [number, string])} onChange={v => set({ ...f, drawRule: DRAW_RULES[v] })} />
        </> : <>
            <Cycle label="Periods" value={f.halves} options={[[1, 'One period'], [2, 'Two halves']]} custom={{ min: 3, max: 4, text: n => `${n} periods` }} onChange={v => set({ ...f, halves: v })} />
            <Cycle label={f.halves === 2 ? 'Half length' : f.halves === 1 ? 'Match length' : 'Period length'} value={f.minutes} options={[[10, '10 min'], [15, '15 min'], [20, '20 min'], [25, '25 min'], [30, '30 min'], [45, '45 min']]} custom={{ min: 1, max: 90, text: n => `${n} min` }} onChange={v => set({ ...f, minutes: v })} />
        </>}
        <Cycle label="Penalty shootout" value={f.pensBestOf} options={[[3, 'Best of 3'], [5, 'Best of 5']]} custom={{ min: 1, max: 10, text: n => `Best of ${n}` }} hint="Then sudden death" onChange={v => set({ ...f, pensBestOf: v })} />
    </>;
};

const QuickWizard: React.FC<{ account: Account; sport?: QuickSport; friends: Friend[]; onCancel: () => void; onCreated: (id: string) => void }> = ({ account, sport: preset, friends, onCancel, onCreated }) => {
    const myName = account.fullName || account.name || 'Me';
    const me: QuickPlayer = { name: myName, email: (account.email || '').toLowerCase() || undefined, uid: auth?.currentUser?.uid || account.id || account.uid };
    const [step, setStep] = useState(preset ? 2 : 1);
    const [sport, setSport] = useState<QuickSport>(preset || 'futsal');
    const soon = new Date(Date.now() + 2 * 3600000); soon.setMinutes(0, 0, 0);
    const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const [startAt, setStartAt] = useState(local(soon));
    const [venue, setVenue] = useState('');
    const [fmt, setFmt] = useState<Fmt>({ sets: 3, games: 6, deuceLimit: 0, halves: 2, minutes: preset === 'football' ? 30 : 20, onPitch: preset === 'football' ? 7 : 5, pensBestOf: 5, mode: 'match', goalCap: 2, drawRule: 'pens' });
    const [teams, setTeamsState] = useState<Draft[]>([{ name: '', players: [me] }, { name: '', players: [] }]);
    const [sendEmails, setSendEmails] = useState(true);
    const [busy, setBusy] = useState(false);
    const rotation = sport !== 'padel' && fmt.mode === 'rotation';
    const onPitch = sport === 'padel' ? 2 : fmt.onPitch;
    const limits = sideLimits(sport, onPitch);
    const trim = (max: number, list = teams) => list.map(t => ({ ...t, players: t.players.slice(0, max) }));
    const setCount = (n: number) => setTeamsState(list => n > list.length ? [...list, ...Array.from({ length: n - list.length }, () => ({ name: '', players: [] }))] : list.slice(0, n));
    const setTeam = (i: number) => (t: Draft) => setTeamsState(list => list.map((x, k) => (k === i ? t : x)));
    // Switching sport resets the side size, and trims teams that are now too big.
    const pickSport = (sp: QuickSport) => {
        setSport(sp);
        const size = sp === 'padel' ? 2 : sp === 'futsal' ? 5 : 7;
        setFmt(f => ({ ...f, onPitch: size, minutes: sp === 'football' ? 30 : 20, halves: 2, mode: 'match' }));
        setTeamsState(list => trim(sideLimits(sp, size).max, list.slice(0, 2)));
        setStep(2);
    };
    const setSize = (n: number) => {
        setFmt(f => ({ ...f, onPitch: n }));
        const max = sideLimits(sport, n).max;
        if (teams.some(t => t.players.length > max)) toast.info('Teams trimmed', `${n} a side allows up to ${max} players per team.`);
        setTeamsState(list => trim(max, list));
    };
    const setFormat = (f: Fmt) => { setFmt(f); if (f.mode !== fmt.mode) setCount(f.mode === 'rotation' ? 3 : 2); };
    const problem = teamProblem(sport, onPitch, teams);
    const nameOf = (t: Draft, i: number) => t.name.trim() || (t.players[0] ? `${first(t.players[0].name)}’s team` : teamLabel(i));
    const invitees = teams.flatMap(t => t.players).filter(p => p.email && p.email !== me.email).length;
    const when2 = new Date(startAt);
    const timeOk = !Number.isNaN(when2.getTime());

    const create = async () => {
        if (problem) { toast.error('Check the teams', problem); setStep(3); return; }
        if (!timeOk) { toast.error('Pick a date and time'); setStep(2); return; }
        setBusy(true);
        try {
            const named = teams.map((t, i) => ({ name: nameOf(t, i), players: t.players }));
            const m = await createQuickMatch({
                sport, title: rotation ? `Winner stays · ${named.length} teams` : `${named[0].name} v ${named[1].name}`, venue: venue.trim() || undefined, startAt: when2.toISOString(),
                hostUid: me.uid || '', hostEmail: me.email || '', hostName: myName,
                format: sport === 'padel' ? { sets: fmt.sets, games: fmt.games, deuceLimit: fmt.deuceLimit, goldenPoint: fmt.deuceLimit === 0 }
                    : rotation ? { mode: 'rotation', halves: 1, minutes: fmt.minutes, onPitch: fmt.onPitch, goalCap: fmt.goalCap, drawRule: fmt.drawRule, pensBestOf: fmt.pensBestOf }
                        : { mode: 'match', halves: fmt.halves, minutes: fmt.minutes, onPitch: fmt.onPitch, pensBestOf: fmt.pensBestOf },
                home: named[0], away: named[1], ...(rotation ? { teams: named } : {}),
            });
            let note = 'Show the QR to your referee, or keep score yourself.';
            if (sendEmails && invitees) { const n = await emailInvites(m).catch(() => 0); note += n ? ` · ${n} invite${n > 1 ? 's' : ''} sent` : ' · invites didn’t send'; }
            toast.success(rotation ? 'Session created' : 'Match created', note);
            onCreated(m.id);
        } catch (e: any) {
            console.error('Create quick match', e);
            toast.error('Couldn’t create the match', explain(e));
            setBusy(false);
        }
    };

    const steps = ['Sport', 'Setup', 'Players', 'Review'];
    const canBack = step > 1 && !(preset && step === 2);
    return (
        <div className="qx qx--wizard">
            <div className="qx-steps">
                <button type="button" className="qx-back" onClick={canBack ? () => setStep(step - 1) : onCancel}><ArrowLeft size={16} /> {canBack ? 'Back' : 'Cancel'}</button>
                {steps.map((label, i) => (
                    <button key={label} type="button" disabled={i + 1 > step || (preset && i === 0)} onClick={() => setStep(i + 1)} className={`qx-step ${step === i + 1 ? 'is-on' : step > i + 1 ? 'is-done' : ''}`}>
                        <i>{step > i + 1 ? <Check size={12} /> : i + 1}</i>{label}
                    </button>
                ))}
            </div>

            {step === 1 && (
                <div className="qx-sports">
                    {SPORTS.map(sp => (
                        <button key={sp} type="button" className={`qx-sport ${sport === sp ? 'is-on' : ''}`} style={PHOTOS[sp] ? { '--photo': `url("${PHOTOS[sp]}")` } as React.CSSProperties : undefined} onClick={() => pickSport(sp)}>
                            <b>{SPORT_NAMES[sp]}</b><small>{sp === 'padel' ? '2 v 2 · sets and games' : sp === 'futsal' ? '5 to 7 a side · or winner stays' : '7 to 11 a side · or winner stays'}</small>
                        </button>
                    ))}
                </div>
            )}

            {step === 2 && (() => {
                const kick = timeOk ? when2.toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Pick a time';
                return (
                    <div className="qx-gs">
                        <section className="qx-gs__list" aria-label="Match settings">
                            <header className="qx-gs__head"><span className="qx-kicker">{SPORT_NAMES[sport]}</span><h3>Match settings</h3></header>
                            <label className="qx-gs__row qx-gs__row--input">
                                <span className="qx-gs__label"><CalendarDays size={15} /> Kick-off</span>
                                <input className="qx-gs__field" type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} />
                            </label>
                            <label className="qx-gs__row qx-gs__row--input">
                                <span className="qx-gs__label"><MapPin size={15} /> Venue <small>optional</small></span>
                                <input className="qx-gs__field" placeholder="Add a venue" value={venue} onChange={e => setVenue(e.target.value)} maxLength={60} />
                            </label>
                            <FormatRows sport={sport} f={fmt} set={setFormat} teams={teams.length} setTeams={setCount} setSize={setSize} />
                        </section>
                        <aside className="qx-gs__preview" style={PHOTOS[sport] ? { '--photo': `url("${PHOTOS[sport]}")` } as React.CSSProperties : undefined}>
                            <span className="qx-gs__badge">{SPORT_NAMES[sport]} · {rotation ? 'Winner stays' : 'Friendly'}</span>
                            <b className="qx-gs__vs">{rotation ? <>{teams.length}<i>teams</i></> : <>{onPitch}<i>v</i>{onPitch}</>}</b>
                            <dl className="qx-gs__facts">
                                <div><dt>Kick-off</dt><dd>{kick}</dd></div>
                                <div><dt>Venue</dt><dd>{venue.trim() || 'To be decided'}</dd></div>
                                <div><dt>Format</dt><dd>{fmtLine(sport, fmt, teams.length)}</dd></div>
                                <div><dt>Squads</dt><dd>{sport === 'padel' ? '2 players each' : `${onPitch} start · up to ${limits.max}`}</dd></div>
                                {rotation && <div><dt>If level</dt><dd>{drawName(fmt.drawRule)}</dd></div>}
                            </dl>
                            <button type="button" className="qx-cta qx-cta--wide" disabled={!timeOk} onClick={() => setStep(3)}>Next: pick players</button>
                        </aside>
                    </div>
                );
            })()}

            {step === 3 && (
                <>
                    <div className={`qx-teams ${teams.length > 2 ? 'qx-teams--many' : ''}`}>
                        {teams.map((t, i) => (
                            <React.Fragment key={i}>
                                {i === 1 && teams.length === 2 && <span className="qx-vs">VS</span>}
                                <TeamCard label={teamLabel(i)} team={t} set={setTeam(i)} others={teams.filter((_, k) => k !== i).flatMap(x => x.players)} me={me} friends={friends} sport={sport} onPitch={onPitch} />
                            </React.Fragment>
                        ))}
                    </div>
                    <div className="qx-actions">
                        {problem && <span className="qx-problem">{problem}</span>}
                        <button type="button" className="qx-cta" disabled={!!problem} onClick={() => setStep(4)}>Next: review</button>
                    </div>
                </>
            )}

            {step === 4 && (
                <div className="qx-review">
                    <div className="qx-card qx-preview">
                        <span className="qx-preview__meta"><span className={`qp-sport is-${sport}`}>{SPORT_NAMES[sport]}</span>{timeOk ? when(when2.toISOString()) : ''}{venue.trim() ? ` · ${venue.trim()}` : ''}</span>
                        <div className={`qx-preview__row ${teams.length > 2 ? 'qx-preview__row--many' : ''}`}>
                            {teams.map((t, k) => (
                                <React.Fragment key={k}>
                                    {k === 1 && teams.length === 2 && <span className="qx-vs">VS</span>}
                                    <div className="qx-preview__team">
                                        <b>{nameOf(t, k)}</b>
                                        <ul>{t.players.map((p, i) => <li key={i}><span className="qx-av">{initials(p.name)}</span>{p.name}{sameP(p, me) ? ' (you)' : ''}{!p.email && <small>no email</small>}</li>)}</ul>
                                    </div>
                                </React.Fragment>
                            ))}
                        </div>
                        <span className="qx-chips"><em>{fmtLine(sport, fmt, teams.length)}</em>{sport !== 'padel' && <><em>Up to {limits.max} per team</em><em>Shootout best of {fmt.pensBestOf}</em></>}{rotation && <em>{drawName(fmt.drawRule)}</em>}</span>
                        {rotation && <p className="qx-note qx-note--muted">{nameOf(teams[0], 0)} and {nameOf(teams[1], 1)} start. The winner stays on; the loser swaps with the next team in line.</p>}
                    </div>
                    <div className="qx-card qx-finish">
                        <label className="qx-toggle"><input type="checkbox" checked={sendEmails && invitees > 0} disabled={!invitees} onChange={e => setSendEmails(e.target.checked)} />
                            <span><b>Email the players</b><small>{invitees ? `${invitees} player${invitees > 1 ? 's' : ''} with an email get an invite.` : 'No other player has an email, so there’s no one to invite.'}</small></span></label>
                        <p className="qx-note">You’ll get a QR code for your referee to scan and keep score on their phone, or you can keep score yourself.</p>
                        <p className="qx-note qx-note--muted">Only players with an email get stats, XP and a place on the local table.</p>
                        <button type="button" className="qx-cta qx-cta--wide" disabled={busy} onClick={create}><Play size={17} /> {busy ? 'Creating…' : rotation ? 'Create session' : 'Create match'}</button>
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * A game-menu setting row: ◀ value ▶, with dots for where you are. Arrow keys work when it's focused.
 * With `custom`, the last stop is "Custom", which turns the value into a − n + stepper.
 */
const Cycle: React.FC<{ label: string; value: number; options: [number, string][]; onChange: (v: number) => void; hint?: string; custom?: { min: number; max: number; step?: number; text: (n: number) => string } }> = ({ label, value, options, onChange, hint, custom }) => {
    const known = options.findIndex(([v]) => v === value);
    const isCustom = !!custom && known < 0;
    const stops = options.length + (custom ? 1 : 0);
    const i = isCustom ? options.length : Math.max(0, known);
    const step = custom?.step || 1;
    // The first custom value that isn't already one of the presets.
    const firstCustom = () => { if (!custom) return value; for (let n = custom.min; n <= custom.max; n += step) if (!options.some(([v]) => v === n)) return n; return custom.min; };
    const go = (d: number) => {
        const k = (i + d + stops) % stops;
        onChange(custom && k === options.length ? firstCustom() : options[k][0]);
    };
    const bump = (d: number) => {
        if (!custom) return;
        let n = value + d * step;
        while (n >= custom.min && n <= custom.max && options.some(([v]) => v === n)) n += d * step;
        if (n >= custom.min && n <= custom.max) onChange(n);
    };
    return (
        <div className={`qx-gs__row ${isCustom ? 'is-custom' : ''}`} tabIndex={0} role="group" aria-label={`${label}: ${isCustom ? custom!.text(value) : options[i][1]}`}
            onKeyDown={e => { if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); } if (e.key === 'ArrowRight') { e.preventDefault(); go(1); } }}>
            <span className="qx-gs__label">{label}{hint && <small>{hint}</small>}</span>
            <span className="qx-gs__cycle">
                <button type="button" tabIndex={-1} aria-label={`Previous ${label}`} onClick={() => go(-1)}><ChevronLeft size={18} /></button>
                <span className="qx-gs__val">
                    {isCustom ? (
                        <span className="qx-gs__custom">
                            <button type="button" aria-label="Less" disabled={value - step < custom!.min} onClick={() => bump(-1)}><Minus size={14} /></button>
                            <b key={value}>{custom!.text(value)}</b>
                            <button type="button" aria-label="More" disabled={value + step > custom!.max} onClick={() => bump(1)}><Plus size={14} /></button>
                        </span>
                    ) : <b key={value}>{options[i][1]}</b>}
                    {stops <= 9 && <span className="qx-gs__dots">{Array.from({ length: stops }, (_, k) => <i key={k} className={`${k === i ? 'is-on' : ''} ${custom && k === options.length ? 'is-custom' : ''}`} />)}</span>}
                    {custom && !isCustom && i === options.length - 1 && <small className="qx-gs__more">▶ Custom</small>}
                </span>
                <button type="button" tabIndex={-1} aria-label={`Next ${label}`} onClick={() => go(1)}><ChevronRight size={18} /></button>
            </span>
        </div>
    );
};

const Choice: React.FC<{ label: string; value: number; options: [number, string, string][]; onChange: (v: number) => void }> = ({ label, value, options, onChange }) => (
    <div className="qx-card">
        <span className="qx-card__label">{label}</span>
        <span className="qx-choice">
            {options.map(([v, t, sub]) => <button key={v} type="button" aria-pressed={value === v} className={value === v ? 'is-on' : ''} onClick={() => onChange(v)}><b>{t}</b><small>{sub}</small></button>)}
        </span>
    </div>
);

/** One team: its name, a slot per player (starters then subs), and quick-add from friends. Its own component so typing keeps focus. */
const TeamCard: React.FC<{ label: string; team: Draft; set: (t: Draft) => void; others: QuickPlayer[]; me: QuickPlayer; friends: Friend[]; sport: QuickSport; onPitch: number }> = ({ label, team, set, others, me, friends, sport, onPitch }) => {
    const [n, setN] = useState('');
    const [e, setE] = useState('');
    const { max } = sideLimits(sport, onPitch);
    const full = team.players.length >= max;
    const where = (p: QuickPlayer) => (team.players.some(x => sameP(x, p)) ? 'here' : others.some(x => sameP(x, p)) ? 'other' : null);
    const addP = (p: QuickPlayer) => {
        if (full) { toast.info(`${team.name.trim() || label} is full`, sport === 'padel' ? 'Padel is 2 v 2.' : `Up to ${max} players per team.`); return false; }
        const w = where(p);
        if (w) { toast.info(w === 'here' ? `${p.name} is already on this team` : `${p.name} is on the other team`); return false; }
        if (team.players.some(x => x.name.trim().toLowerCase() === p.name.trim().toLowerCase())) { toast.info('Two players can’t share a name', 'Add a surname or initial.'); return false; }
        set({ ...team, players: [...team.players, p] });
        return true;
    };
    const submit = () => {
        const name = n.trim().replace(/\s+/g, ' ');
        const email = e.trim().toLowerCase();
        if (!name) { toast.error('Add the player’s name'); return; }
        if (email && !EMAIL.test(email)) { toast.error('Check the email', email); return; }
        if (addP({ name, email: email || undefined })) { setN(''); setE(''); }
    };
    const free = friends.filter(f => !where({ name: f.name, email: f.email }));
    const slots = Array.from({ length: max }, (_, i) => team.players[i]);
    return (
        <div className="qx-card qx-team">
            <input className="qx-input qx-team__name" value={team.name} placeholder={team.players[0] ? `${first(team.players[0].name)}’s team` : label} onChange={ev => set({ ...team, name: ev.target.value })} aria-label={`${label} name`} maxLength={30} />
            <small className="qx-team__count">{team.players.length} / {max} players{sport !== 'padel' ? ` · ${onPitch} start` : ''}</small>
            <ol className="qx-slots">
                {slots.map((p, i) => (
                    <React.Fragment key={i}>
                        {sport !== 'padel' && i === onPitch && <li className="qx-slots__sub">Subs</li>}
                        {p ? (
                            <li className="qx-slot">
                                <span className="qx-av">{initials(p.name)}</span>
                                <span className="qx-slot__who"><b>{p.name}{sameP(p, me) ? ' (you)' : ''}</b><small>{p.email || 'No email · no stats'}</small></span>
                                <button type="button" aria-label={`Remove ${p.name}`} onClick={() => set({ ...team, players: team.players.filter((_, k) => k !== i) })}><X size={14} /></button>
                            </li>
                        ) : i === team.players.length ? (
                            <li className="qx-slot qx-slot--add">
                                <input className="qx-input" placeholder={`Player ${i + 1} name`} value={n} onChange={ev => setN(ev.target.value)} onKeyDown={ev => { if (ev.key === 'Enter') submit(); }} />
                                <input className="qx-input" type="email" placeholder="Email (optional)" value={e} onChange={ev => setE(ev.target.value)} onKeyDown={ev => { if (ev.key === 'Enter') submit(); }} />
                                <button type="button" aria-label="Add player" onClick={submit}><Plus size={16} /></button>
                            </li>
                        ) : (sport === 'padel' || i < onPitch) ? <li className="qx-slot qx-slot--empty">Player {i + 1}</li> : null}
                    </React.Fragment>
                ))}
            </ol>
            {!full && (free.length > 0 || !where(me)) && (
                <div className="qx-quick">
                    {!where(me) && <button type="button" onClick={() => addP(me)}><Plus size={12} /> Me</button>}
                    {free.slice(0, 8).map(f => <button key={f.email} type="button" onClick={() => addP({ name: f.name, email: f.email })}><Plus size={12} /> {f.name}</button>)}
                </div>
            )}
            {full && <small className="qx-team__full"><Check size={13} /> Team complete</small>}
        </div>
    );
};

// ---------------------------------------------------------------- scoring

/** One scoring action: the new score, logged with the score before it so Undo is exact. */
type Save = (next: QuickMatch) => void;
const log = (m: QuickMatch, score: QuickMatch['score'], e: Omit<QuickEvent, 'id' | 'at' | 'prev'>): QuickMatch =>
    ({ ...m, score, events: [...m.events, { ...e, id: `${Date.now()}${Math.random().toString(36).slice(2, 5)}`, at: Date.now(), prev: m.score }] });
const undoLast = (m: QuickMatch): QuickMatch | null => {
    const last = m.events[m.events.length - 1];
    if (!last?.prev) return null;
    return { ...m, score: last.prev, events: m.events.slice(0, -1) };
};
const mmss = (ms: number) => { const t = Math.floor(ms / 1000); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };

export const QuickMatchView: React.FC<{ id: string; account?: Account; onBack?: () => void; onNew?: () => void; asReferee?: boolean }> = ({ id, account, onBack, onNew, asReferee }) => {
    const [m, setM] = useState<QuickMatch | null | undefined>(undefined);
    const [settings, setSettings] = useState(false);
    useEffect(() => subscribeQuickMatch(id, setM), [id]);
    // When the host's own match finishes, publish its points to the community leaderboard.
    const doneKey = m && m.status === 'COMPLETED' && !asReferee && m.hostUid === auth?.currentUser?.uid ? `${m.id}-${m.updatedAt || 0}` : '';
    useEffect(() => { if (doneKey && m) publishBoard(m).catch(() => {}); }, [doneKey]); // eslint-disable-line react-hooks/exhaustive-deps
    if (m === undefined) return <div className="qx-empty">Loading match…</div>;
    if (!m) return <div className="qx-empty"><b>Match not found</b><span>It may have been deleted by the host.</span>{onBack && <button type="button" className="qx-ghost" onClick={onBack}>Back</button>}</div>;
    const myUid = auth?.currentUser?.uid;
    const isHost = !asReferee && !!account && [myUid, account.id, account.uid].filter(Boolean).includes(m.hostUid);
    const canScore = isHost || !!asReferee;
    const save: Save = async next => {
        const prev = m;
        setM(next);
        try { await saveQuickScore(next); }
        catch (e) { setM(prev); toast.error('Score didn’t save', explain(e)); }
    };
    const Board = m.sport === 'padel' ? PadelBoard : TeamBoard;
    // Settings change the format too, which only the host may write.
    const saveSettings = async (next: QuickMatch) => {
        try { await saveQuickMatch(next); setM(next); setSettings(false); toast.success('Match settings saved'); }
        catch (e) { toast.error('Couldn’t save the settings', explain(e)); }
    };
    const tools = { onSettings: isHost && m.status !== 'COMPLETED' ? () => setSettings(true) : undefined, onNew: isHost ? onNew : undefined };
    return (
        <div className={`qx qx--match ${asReferee ? 'qx--ref' : ''}`}>
            {onBack && <button type="button" className="qx-back" onClick={onBack}><ArrowLeft size={16} /> All quick matches</button>}
            <Board m={m} canScore={canScore} save={save} {...tools} />
            {m.status !== 'SCHEDULED' && !isRotation(m) && (
                <div className="qx-sharebar">
                    <span>Post the {m.status === 'COMPLETED' ? 'result' : 'score'} on your socials</span>
                    <ShareButton className="qx-cta" label="Share score" filename={`matchup-${m.sport}-${m.id.slice(0, 6)}.png`} title={m.title} card={() => <ScoreShareCard m={m} me={account ? { uid: account.id || account.uid, email: account.email } : undefined} />} />
                </div>
            )}
            {isHost && m.status !== 'COMPLETED' && <RefereeQR m={m} onBack={onBack} />}
            {settings && <MatchSettings m={m} onClose={() => setSettings(false)} onSave={saveSettings} />}
        </div>
    );
};

type BoardTools = { onSettings?: () => void; onNew?: () => void };

/**
 * Start / Undo / Reset / End, shared by both boards. Ending is final: a finished match can't be
 * reopened, only replaced by a new one. Reset starts this match again from nothing.
 */
const Controls: React.FC<{ m: QuickMatch; save: Save; onStart: () => void; endLabel?: string; onEnd: () => void; extra?: React.ReactNode } & BoardTools> = ({ m, save, onStart, endLabel = 'End match', onEnd, extra, onSettings, onNew }) => {
    const back = undoLast(m);
    const played = m.events.length > 0;
    const reset = async () => {
        if (!(await confirmDialog({ title: 'Reset the score?', body: 'Everything goes back to the start: score, ' + (m.sport === 'padel' ? 'games and sets' : 'clock, goals, cards and fouls') + '. The match restarts from scratch.', confirmLabel: 'Reset score', danger: true }))) return;
        save({ ...m, status: 'SCHEDULED', score: freshScore(m.sport), events: [], winner: undefined });
        toast.success('Score reset', 'Start the match when you’re ready.');
    };
    if (m.status === 'COMPLETED') return (
        <div className="qx-final">
            <span><b>Full time.</b> This result is final and counts in everyone’s stats.</span>
            {onNew && <button type="button" className="qx-cta" onClick={onNew}><Plus size={16} /> Set up a new match</button>}
        </div>
    );
    return (
        <div className="qx-board__actions">
            {onSettings && <button type="button" className="qx-ghost qx-icon" onClick={onSettings} aria-label="Match settings" title="Match settings"><Settings2 size={17} /></button>}
            {(m.status === 'LIVE' || played) && <button type="button" className="qx-ghost" disabled={!played} onClick={reset}><RotateCcw size={16} /> Reset score</button>}
            {m.status === 'SCHEDULED' && <button type="button" className="qx-cta" onClick={onStart}><Play size={16} /> Start match</button>}
            {m.status === 'LIVE' && <>
                <button type="button" className="qx-ghost" disabled={!back} onClick={() => back && save(back)}><Undo2 size={16} /> Undo</button>
                {extra}
                <button type="button" className="qx-cta" onClick={onEnd}><Check size={16} /> {endLabel}</button>
            </>}
        </div>
    );
};

/** The host changes the format, time or venue mid-match; the score so far is kept. */
const MatchSettings: React.FC<{ m: QuickMatch; onClose: () => void; onSave: (next: QuickMatch) => void }> = ({ m, onClose, onSave }) => {
    const local = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
    const mf = m.format;
    const [f, setF] = useState<Fmt>({ sets: mf.sets || 3, games: mf.games || 6, deuceLimit: deuceLimitOf(mf), halves: mf.halves || 2, minutes: mf.minutes || 20, onPitch: mf.onPitch || 5, pensBestOf: mf.pensBestOf || pensBestOf(m), mode: mf.mode || 'match', goalCap: mf.goalCap ?? 2, drawRule: mf.drawRule || 'pens' });
    const [startAt, setStartAt] = useState(local(m.startAt));
    const [venue, setVenue] = useState(m.venue || '');
    const [busy, setBusy] = useState(false);
    const most = Math.max(...(m.teams || [m.home, m.away]).map(t => t.players.length));
    const minSize = Math.max(1, most - SUBS[m.sport]);
    const save = async () => {
        const d = new Date(startAt);
        if (Number.isNaN(d.getTime())) { toast.error('Pick a date and time'); return; }
        const format: QuickMatch['format'] = m.sport === 'padel'
            ? { sets: f.sets, games: f.games, deuceLimit: f.deuceLimit, goldenPoint: f.deuceLimit === 0 }
            : f.mode === 'rotation' ? { mode: 'rotation', halves: 1, minutes: f.minutes, onPitch: f.onPitch, goalCap: f.goalCap, drawRule: f.drawRule, pensBestOf: f.pensBestOf }
                : { mode: 'match', halves: f.halves, minutes: f.minutes, onPitch: f.onPitch, pensBestOf: f.pensBestOf };
        setBusy(true);
        await onSave({ ...m, format, startAt: d.toISOString(), venue: venue.trim() || undefined });
        setBusy(false);
    };
    return createPortal(
        <div className="qx-sheet" role="dialog" aria-label="Match settings" onClick={onClose}>
            <div className="qx-sheet__card qx-settings" onClick={e => e.stopPropagation()}>
                <header><b>Match settings</b><button type="button" aria-label="Close" onClick={onClose}><X size={16} /></button></header>
                <div className="qx-gs__list qx-settings__list">
                    <label className="qx-gs__row qx-gs__row--input"><span className="qx-gs__label">Kick-off</span><input className="qx-gs__field" type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} /></label>
                    <label className="qx-gs__row qx-gs__row--input"><span className="qx-gs__label">Venue</span><input className="qx-gs__field" placeholder="Add a venue" value={venue} onChange={e => setVenue(e.target.value)} maxLength={60} /></label>
                    <FormatRows sport={m.sport} f={f} set={setF} teams={(m.teams || []).length} setSize={n => setF({ ...f, onPitch: n })} locked minSize={minSize} />
                </div>
                {m.events.length > 0 && <p className="qx-note qx-note--muted">The score so far stays. To start over, use Reset score.</p>}
                <div className="qx-settings__btns">
                    <button type="button" className="qx-ghost" onClick={onClose}>Cancel</button>
                    <button type="button" className="qx-cta" disabled={busy} onClick={save}><Check size={16} /> {busy ? 'Saving…' : 'Save settings'}</button>
                </div>
            </div>
        </div>,
        document.body,
    );
};

const BoardHead: React.FC<{ m: QuickMatch; right?: React.ReactNode }> = ({ m, right }) => (
    <span className="qx-board__meta">
        <span className={`qp-sport is-${m.sport}`}>{SPORT_NAMES[m.sport]}</span>
        {m.status === 'LIVE' ? <em className="qx-live">Live</em> : m.status === 'COMPLETED' ? <span className="qx-ft">Full time</span> : <span className="qx-ft">Not started</span>}
        <span className="qx-board__when">{when(m.startAt)}{m.venue ? ` · ${m.venue}` : ''}</span>
        {right}
    </span>
);

/** Padel: point by point. 0-15-30-40, golden point or advantage, tie-breaks, sets. */
const PadelBoard: React.FC<{ m: QuickMatch; canScore: boolean; save: Save } & BoardTools> = ({ m, canScore, save, ...tools }) => {
    const games = m.format.games || 6;
    const sets = setsOf(m).length ? setsOf(m) : [{ h: 0, a: 0 }];
    const [hs, as] = setsWon(m);
    const over = padelOver(m);
    const live = m.status === 'LIVE';
    const state = live && !over ? gameState(m) : '';
    const point = (side: QuickSide) => {
        if (!live || over) return;
        const next = log(m, padelPoint(m, side), { side, kind: 'point' });
        save(next);
        if (padelOver(next)) toast.success('Game, set and match', `${(side === 'home' ? m.home : m.away).name} win. End the match to save it.`);
    };
    const end = async () => {
        const early = !over;
        if (!(await confirmDialog({
            title: 'End the match?',
            body: early ? `Neither pair has won ${setsToWin(m)} set${setsToWin(m) > 1 ? 's' : ''} yet. End it at ${scoreText(m)} anyway?` : `Final score ${scoreText(m)}. It goes into everyone’s stats and the local table.`,
            confirmLabel: 'End match',
        }))) return;
        save({ ...m, status: 'COMPLETED', winner: decide(m) });
    };
    return (
        <section className={`qx-board qx-pb ${live ? 'is-live' : ''}`}>
            <BoardHead m={m} right={<span className="qx-pb__fmt">{(m.format.sets || 3) === 1 ? 'One set' : `Best of ${m.format.sets || 3}`} · {games} games · {deuceName(deuceLimitOf(m.format))}</span>} />
            <div className="qx-pb__grid" role="table" aria-label="Score" style={{ '--sets': sets.length } as React.CSSProperties}>
                <div className="qx-pb__row qx-pb__row--head" role="row">
                    <span />{sets.map((_, i) => <span key={i}>Set {i + 1}</span>)}<span>{live && !over ? 'Game' : 'Sets'}</span>
                </div>
                {(['home', 'away'] as const).map(side => {
                    const t = side === 'home' ? m.home : m.away;
                    const k = side === 'home' ? 'h' : 'a';
                    return (
                        <div key={side} role="row" className={`qx-pb__row ${m.winner === side ? 'is-win' : ''}`}>
                            <span className="qx-pb__team"><b>{t.name}</b><small>{t.players.map(p => p.name).join(' · ')}</small></span>
                            {sets.map((x, i) => <span key={i} className={`qx-pb__set ${setDone(games, x) && x[k] > x[k === 'h' ? 'a' : 'h'] ? 'is-won' : ''}`}>{x[k]}</span>)}
                            <span className="qx-pb__pts">{live && !over ? pointLabel(m, side) : side === 'home' ? hs : as}</span>
                        </div>
                    );
                })}
            </div>
            {state && <span className="qx-pb__state">{state}</span>}
            {canScore && live && !over && (
                <div className="qx-pb__btns">
                    {(['home', 'away'] as const).map(side => (
                        <button key={side} type="button" className="qx-score-btn" onClick={() => point(side)}><Plus size={22} /> Point <span>{(side === 'home' ? m.home : m.away).name}</span></button>
                    ))}
                </div>
            )}
            {over && live && <p className="qx-banner">{(hs > as ? m.home : m.away).name} won {Math.max(hs, as)}–{Math.min(hs, as)} in sets. End the match to save it.</p>}
            {canScore ? <Controls m={m} save={save} {...tools} onStart={() => save({ ...m, status: 'LIVE' })} onEnd={end} />
                : m.status !== 'COMPLETED' && <p className="qx-note qx-note--muted qx-board__hint">The referee keeps the score. It updates here live.</p>}
        </section>
    );
};

/**
 * Futsal and football: a match clock with periods, goals with the scorer and minute, cards, futsal fouls,
 * penalty kicks and shootouts. In a "winner stays" session each game ends at the goal cap or the whistle,
 * and the winner stays on while the loser swaps with the next team.
 */
const TeamBoard: React.FC<{ m: QuickMatch; canScore: boolean; save: Save } & BoardTools> = ({ m, canScore, save, ...tools }) => {
    const [, tick] = useState(0);
    const [pick, setPick] = useState<{ side: QuickSide; kind: 'goal' | 'card' | 'pen' | 'shoot' } | null>(null);
    const [card, setCard] = useState<'Y' | 'R'>('Y');
    const [penIn, setPenIn] = useState(true);
    const c = m.score.clock || { period: 1, running: false, elapsed: 0 };
    useEffect(() => { if (!c.running) return; const t = setInterval(() => tick(x => x + 1), 1000); return () => clearInterval(t); }, [c.running]);
    const live = m.status === 'LIVE';
    const futsal = m.sport === 'futsal';
    const rot = isRotation(m) ? m.score.rot : undefined;
    const halves = rot ? 1 : m.format.halves || 2;
    const length = (m.format.minutes || 20) * 60000;
    const played = clockMs(c);
    const goals = m.score.goals || [0, 0];
    const fouls = m.score.fouls || [0, 0];
    const kicks = m.score.pens || [];
    const shootout = m.score.phase === 'pens';
    const best = pensBestOf(m);
    const decided = shootout && pensDecided(kicks, best);
    const level = goals[0] === goals[1];
    const team = (side: QuickSide) => teamOn(m, side);
    const tag = (side: QuickSide) => (rot ? { team: teamIndexOn(m, side), game: rot.games.length } : {});
    const setClock = (next: Partial<typeof c>) => save({ ...m, score: { ...m.score, clock: { ...c, ...next } } });
    const toggle = () => (c.running ? setClock({ running: false, elapsed: played, startedAt: undefined }) : setClock({ running: true, startedAt: Date.now() }));
    const lastPeriod = c.period >= halves;
    const periodName = (n: number) => (halves === 1 ? (rot ? `Game ${(rot.games.length || 0) + 1}` : 'Match') : halves === 2 ? (n === 1 ? '1st half' : '2nd half') : `Period ${n}`);
    const start = () => save({ ...m, status: 'LIVE', score: { ...m.score, clock: { period: 1, running: true, startedAt: Date.now(), elapsed: 0 } } });
    const stopClock = { ...c, running: false, elapsed: played, startedAt: undefined };

    /** Winner stays: settle the game (the loser goes off, the next team comes on). */
    const settleGame = (from: QuickMatch, msg?: string) => {
        const res = finishGame(from);
        const names = m.teams || [];
        save(log(from, res.score, { side: 'home', kind: 'gameend' }));
        toast.success(msg || (res.winner == null ? 'Level game' : `${names[res.winner]?.name} win`), `${names[res.off]?.name} go off · ${names[res.on]?.name} come on`);
    };
    const nextPeriod = async () => {
        if (!(await confirmDialog({ title: `End the ${periodName(c.period).toLowerCase()}?`, body: `${goals[0]}-${goals[1]}. The clock resets for the ${periodName(c.period + 1).toLowerCase()}${futsal ? ' and fouls go back to zero' : ''}.`, confirmLabel: 'End period' }))) return;
        save(log(m, { ...m.score, clock: { period: c.period + 1, running: false, elapsed: 0 }, ...(futsal ? { fouls: [0, 0] as [number, number] } : {}) }, { side: 'home', kind: 'period' }));
    };
    const toPens = () => save(log(m, { ...m.score, phase: 'pens', pens: [], clock: stopClock }, { side: 'home', kind: 'period' }));
    const endGame = async () => {
        if (level && !kicks.length && m.format.drawRule === 'pens') {
            if (!(await confirmDialog({ title: 'Level: penalties', body: `It’s ${goals[0]}-${goals[1]}. A best-of-${best} shootout decides who stays on.`, confirmLabel: 'Start shootout' }))) return;
            toPens();
            return;
        }
        settleGame({ ...m, score: { ...m.score, clock: stopClock } });
    };
    const end = async () => {
        if (rot) {
            const games = rot.games.length;
            if (!(await confirmDialog({ title: 'End the session?', body: `${games} game${games === 1 ? '' : 's'} played. The current game ${played || goals[0] + goals[1] ? 'isn’t counted unless you end it first' : 'hasn’t started'}. Results go into everyone’s stats.`, confirmLabel: 'End session' }))) return;
            save({ ...m, status: 'COMPLETED', winner: 'draw', score: { ...m.score, clock: stopClock } });
            return;
        }
        if (!(await confirmDialog({ title: 'End the match?', body: `Final score ${goals[0]}-${goals[1]}${kicks.length ? ` (${pensTally(kicks).h}-${pensTally(kicks).a} on penalties)` : ''}. It goes into everyone’s stats and the local table.`, confirmLabel: 'End match' }))) return;
        save({ ...m, status: 'COMPLETED', winner: decide(m), score: { ...m.score, clock: stopClock } });
    };
    const goal = (side: QuickSide, p?: QuickPlayer, pen = false) => {
        const g = [...goals] as [number, number];
        g[side === 'home' ? 0 : 1]++;
        const next = log(m, { ...m.score, goals: g }, { side, kind: 'goal', playerEmail: p?.email, playerName: p?.name, minute: matchMinute(m), pen, ...tag(side) });
        setPick(null);
        // Winner stays: reaching the goal cap ends the game straight away.
        if (rot && m.format.goalCap && g[side === 'home' ? 0 : 1] >= m.format.goalCap) {
            const res = finishGame(next);
            const names = m.teams || [];
            save({ ...next, score: res.score, events: [...next.events, { id: `${Date.now()}e`, side, kind: 'gameend', at: Date.now(), prev: next.score }] });
            toast.success(`${team(side).name} win the game`, `${names[res.off]?.name} go off · ${names[res.on]?.name} come on`);
            return;
        }
        save(next);
    };
    const penMiss = (side: QuickSide, p?: QuickPlayer) => { save(log(m, m.score, { side, kind: 'penmiss', playerEmail: p?.email, playerName: p?.name, minute: matchMinute(m), ...tag(side) })); setPick(null); };
    const giveCard = (side: QuickSide, p: QuickPlayer) => { save(log(m, m.score, { side, kind: 'card', card, playerEmail: p.email, playerName: p.name, minute: matchMinute(m), ...tag(side) })); setPick(null); };
    const foul = (side: QuickSide) => {
        const f = [...fouls] as [number, number];
        const i = side === 'home' ? 0 : 1;
        f[i]++;
        save(log(m, { ...m.score, fouls: f }, { side, kind: 'foul', minute: matchMinute(m), ...tag(side) }));
        if (f[i] === 5) toast.info(`${team(side).name}: 5 fouls`, 'From the next foul the other team gets a 10-metre free kick.');
    };
    const kick = (scored: boolean, name?: string) => {
        const side = pensNext(kicks);
        const next = [...kicks, { side, scored, ...(name ? { name } : {}) }];
        setPick(null);
        save(log(m, { ...m.score, pens: next }, { side, kind: 'period' }));
        if (pensDecided(next, best)) { const t = pensTally(next); toast.success(`${(t.h > t.a ? team('home') : team('away')).name} win on penalties`, `${t.h}-${t.a}. Confirm to save it.`); }
    };
    const confirmPens = () => (rot ? settleGame(m) : save({ ...m, status: 'COMPLETED', winner: decide(m), score: { ...m.score, clock: stopClock } }));
    const timeline = m.events.filter(e => (e.kind === 'goal' || e.kind === 'card' || e.kind === 'penmiss') && (!rot || e.game === rot.games.length));
    const pt = pensTally(kicks);
    const wins = rot ? (m.teams || []).map((_, i) => rot.games.filter(g => g.winner === i).length) : [];
    return (
        <section className={`qx-board qx-tb ${live ? 'is-live' : ''}`}>
            <BoardHead m={m} right={<span className="qx-pb__fmt">{rot ? `Winner stays · ${m.format.minutes} min${m.format.goalCap ? ` or first to ${m.format.goalCap}` : ''}` : `${m.format.onPitch} a side · ${halves > 1 ? `${halves} × ${m.format.minutes}` : m.format.minutes} min`}</span>} />
            {rot && (
                <div className="qx-rot">
                    <span className="qx-rot__label">On</span>
                    <b>{team('home').name}</b><i>v</i><b>{team('away').name}</b>
                    {rot.queue.length > 0 && <><span className="qx-rot__label">Next</span>{rot.queue.map((q, k) => <span key={q} className={`qx-rot__q ${k === 0 ? 'is-next' : ''}`}>{m.teams?.[q]?.name}</span>)}</>}
                </div>
            )}
            <div className="qx-tb__row">
                {(['home', 'away'] as const).map((side, k) => (
                    <React.Fragment key={side}>
                        {k === 1 && (
                            <div className="qx-clock">
                                <span className="qx-clock__period">{m.status === 'COMPLETED' ? 'Full time' : shootout ? 'Penalties' : periodName(c.period)}</span>
                                <b className={`qx-clock__time ${played > length ? 'is-over' : ''}`}>{mmss(Math.min(played, length))}{played > length && <small>+{mmss(played - length)}</small>}</b>
                                {canScore && live && !shootout && <button type="button" className={`qx-clock__btn ${c.running ? 'is-run' : ''}`} onClick={toggle}>{c.running ? 'Pause' : played ? 'Resume' : 'Start clock'}</button>}
                            </div>
                        )}
                        <div className={`qx-side ${m.winner === side ? 'is-win' : ''}`}>
                            <span className="qx-side__name">{team(side).name}</span>
                            <b className="qx-side__score">{goals[side === 'home' ? 0 : 1]}</b>
                            {kicks.length > 0 && <small className="qx-side__pens">({side === 'home' ? pt.h : pt.a} pens)</small>}
                            {futsal && !shootout && <small className={`qx-side__fouls ${fouls[side === 'home' ? 0 : 1] >= 5 ? 'is-max' : ''}`}>Fouls {fouls[side === 'home' ? 0 : 1]}/5</small>}
                            {canScore && live && !shootout && (
                                <div className="qx-side__acts">
                                    <button type="button" className="qx-score-btn" onClick={() => setPick({ side, kind: 'goal' })}><Plus size={20} /> Goal</button>
                                    <span className="qx-side__minor">
                                        <button type="button" onClick={() => { setPenIn(true); setPick({ side, kind: 'pen' }); }}>Penalty</button>
                                        <button type="button" onClick={() => setPick({ side, kind: 'card' })}><i className="qx-cardchip is-Y" /> Card</button>
                                        {futsal && <button type="button" onClick={() => foul(side)}>+ Foul</button>}
                                    </span>
                                </div>
                            )}
                        </div>
                    </React.Fragment>
                ))}
            </div>
            {shootout && (
                <div className="qx-shoot">
                    <div className="qx-shoot__rows">
                        {(['home', 'away'] as const).map(side => {
                            const ks = kicks.filter(x => x.side === side);
                            return (
                                <div key={side} className="qx-shoot__row">
                                    <b>{team(side).name}</b>
                                    <span>{ks.map((x, i) => <i key={i} className={x.scored ? 'is-in' : 'is-out'} title={x.name || undefined}>{x.scored ? '✓' : '✕'}</i>)}{Array.from({ length: Math.max(0, best - ks.length) }, (_, i) => <i key={`e${i}`} />)}</span>
                                    <em>{side === 'home' ? pt.h : pt.a}</em>
                                </div>
                            );
                        })}
                    </div>
                    {canScore && live && (decided
                        ? <button type="button" className="qx-cta qx-cta--wide" onClick={confirmPens}><Check size={16} /> Confirm: {(pt.h > pt.a ? team('home') : team('away')).name} win on penalties</button>
                        : <>
                            <span className="qx-shoot__next">Kick {pt.th + pt.ta + 1}{pt.th >= best && pt.ta >= best ? ' · sudden death' : ''}: <b>{team(pensNext(kicks)).name}</b></span>
                            <div className="qx-shoot__btns">
                                <button type="button" className="qx-score-btn" onClick={() => { setPenIn(true); setPick({ side: pensNext(kicks), kind: 'shoot' }); }}>Scored</button>
                                <button type="button" className="qx-score-btn qx-score-btn--miss" onClick={() => { setPenIn(false); setPick({ side: pensNext(kicks), kind: 'shoot' }); }}>Missed / saved</button>
                            </div>
                        </>)}
                </div>
            )}
            {rot && rot.games.length > 0 && (
                <div className="qx-rotgames">
                    <span className="qx-rot__label">Games</span>
                    <ol>{rot.games.map((g, i) => <li key={i}><small>{i + 1}</small>{m.teams?.[g.a]?.name} <b>{g.ga}-{g.gb}</b> {m.teams?.[g.b]?.name}{g.pa != null && <em>({g.pa}-{g.pb} p)</em>}</li>)}</ol>
                    <span className="qx-rot__wins">{(m.teams || []).map((t, i) => <span key={i}>{t.name} <b>{wins[i]}</b></span>)}</span>
                </div>
            )}
            {timeline.length > 0 && (
                <ol className="qx-timeline">
                    {timeline.map(e => (
                        <li key={e.id} className={`is-${e.side}`}>
                            <b>{e.minute ? `${e.minute}′` : ''}</b>
                            {e.kind === 'goal' ? <span>⚽ {e.playerName || 'Goal'}{e.pen ? ' (pen)' : ''}</span> : e.kind === 'penmiss' ? <span>✕ Penalty missed{e.playerName ? ` · ${e.playerName}` : ''}</span> : <span><i className={`qx-cardchip is-${e.card}`} /> {e.playerName}</span>}
                            <small>{e.team != null ? m.teams?.[e.team]?.name : team(e.side).name}</small>
                        </li>
                    ))}
                </ol>
            )}
            {canScore && live && !shootout && level && (lastPeriod || !!rot) && played > 0 && !rot && (
                <div className="qx-pensoffer"><span>Level in the last period.</span><button type="button" className="qx-ghost" onClick={toPens}>Go to penalties</button></div>
            )}
            {canScore ? <Controls m={m} save={save} {...tools} onStart={start}
                onEnd={rot ? end : lastPeriod ? end : nextPeriod} endLabel={rot ? 'End session' : lastPeriod ? 'End match' : `End ${periodName(c.period).toLowerCase()}`}
                extra={rot && live && !shootout ? <button type="button" className="qx-ghost" onClick={endGame}><Check size={16} /> End game</button> : undefined} />
                : m.status !== 'COMPLETED' && <p className="qx-note qx-note--muted qx-board__hint">The referee keeps the score. It updates here live.</p>}
            {pick && createPortal(
                <div className="qx-sheet" role="dialog" aria-label={pick.kind === 'goal' ? 'Who scored?' : pick.kind === 'pen' ? 'Penalty' : 'Card'} onClick={() => setPick(null)}>
                    <div className="qx-sheet__card" onClick={e => e.stopPropagation()}>
                        <header><b>{pick.kind === 'goal' ? 'Goal' : pick.kind === 'pen' ? 'Penalty' : pick.kind === 'shoot' ? (penIn ? 'Shootout: scored' : 'Shootout: missed') : 'Card'} · {team(pick.side).name}</b><button type="button" aria-label="Close" onClick={() => setPick(null)}><X size={16} /></button></header>
                        {pick.kind === 'card' && <span className="qx-sheet__cards">{(['Y', 'R'] as const).map(k => <button key={k} type="button" className={card === k ? 'is-on' : ''} onClick={() => setCard(k)}><i className={`qx-cardchip is-${k}`} /> {k === 'Y' ? 'Yellow' : 'Red'}</button>)}</span>}
                        {pick.kind === 'pen' && <span className="qx-sheet__cards">{[true, false].map(k => <button key={String(k)} type="button" className={penIn === k ? 'is-on' : ''} onClick={() => setPenIn(k)}>{k ? '✓ Scored' : '✕ Missed / saved'}</button>)}</span>}
                        <small className="qx-note--muted">{pick.kind === 'goal' ? 'Who scored?' : pick.kind === 'pen' || pick.kind === 'shoot' ? 'Who took it?' : 'Which player?'}</small>
                        <div className="qx-sheet__list">
                            {team(pick.side).players.map(p => <button key={p.email || p.name} type="button" onClick={() => (pick.kind === 'shoot' ? kick(penIn, p.name) : pick.kind === 'goal' ? goal(pick.side, p) : pick.kind === 'pen' ? (penIn ? goal(pick.side, p, true) : penMiss(pick.side, p)) : giveCard(pick.side, p))}><span className="qx-av">{initials(p.name)}</span>{p.name}</button>)}
                            {pick.kind === 'shoot' && <button type="button" className="is-plain" onClick={() => kick(penIn)}>Not sure who</button>}
                            {pick.kind === 'goal' && <button type="button" className="is-plain" onClick={() => goal(pick.side)}>Not sure / own goal</button>}
                            {pick.kind === 'pen' && <button type="button" className="is-plain" onClick={() => (penIn ? goal(pick.side, undefined, true) : penMiss(pick.side))}>Not sure who</button>}
                        </div>
                    </div>
                </div>,
                document.body,
            )}
        </section>
    );
};

/** The host's way to hand scoring to a referee: a QR that opens this match's scoreboard, no login or code. */
const RefereeQR: React.FC<{ m: QuickMatch; onBack?: () => void }> = ({ m, onBack }) => {
    const url = `${window.location.origin}/#qp/${m.refereeCode}`;
    const local = /^(localhost|127\.|\[::1\])/.test(window.location.hostname);
    return (
        <section className="qx-card qx-qr">
            <div className="qx-qr__code"><QRCodeSVG value={url} size={176} level="M" marginSize={2} bgColor="#FFFFFF" fgColor="#0A0F2C" /></div>
            <div className="qx-qr__text">
                <span className="qx-card__label">Referee</span>
                <h4>Scan to keep score</h4>
                <p>Ask your referee to scan this with their phone camera. It opens this match’s scoreboard straight away, with no sign-in. Or keep score yourself on this screen.</p>
                {local && <p className="qx-note qx-note--muted">You’re on a local test server, so phones can’t open this link. It works on your live site.</p>}
                <div className="qx-share__btns">
                    <button type="button" className="qx-ghost" onClick={() => navigator.clipboard.writeText(url).then(() => toast.success('Referee link copied')).catch(() => toast.info(url))}><Copy size={15} /> Copy link</button>
                    <button type="button" className="qx-ghost" onClick={async () => { const n = await emailInvites(m).catch(() => 0); n ? toast.success('Invites sent', `${n} emailed.`) : toast.info('No one to email', 'Add player emails to send invites.'); }}><Mail size={15} /> Email players</button>
                    <button type="button" className="qx-ghost qx-ghost--danger" onClick={async () => { if (await confirmDialog({ title: 'Delete this match?', body: 'It disappears for everyone invited, and its result leaves the stats.', confirmLabel: 'Delete', danger: true })) { try { await deleteQuickMatch(m); onBack?.(); } catch (e) { toast.error('Couldn’t delete', explain(e)); } } }}><Trash2 size={15} /> Delete</button>
                </div>
            </div>
        </section>
    );
};

// ---------------------------------------------------------------- referee entry (#qp or #qp/<code>)

export const QuickReferee: React.FC<{ code?: string }> = ({ code: initial }) => {
    const [code, setCode] = useState(initial || '');
    const [id, setId] = useState<string | null>(null);
    const [busy, setBusy] = useState(!!initial);
    const open = async (c = code) => {
        if (!/^\d{6}$/.test(c.trim())) { toast.error('Enter the 6-digit referee code'); return; }
        setBusy(true);
        try {
            await loginReferee().catch(() => {});
            const found = await findByCode(c);
            if (!found) toast.error('No match with that code', 'Check the code with the match host.');
            setId(found);
        } catch (e) { toast.error('Couldn’t open the match', explain(e)); }
        finally { setBusy(false); }
    };
    useEffect(() => { if (initial) open(initial); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return (
        <div className="admx fxp fxg qp-ref">
            <div className="fxg__bg" aria-hidden="true" />
            <header className="qx-refbar"><b>MATCH UP</b><span>Referee</span></header>
            <main className="fxg-main">
                {id ? <QuickMatchView id={id} asReferee onBack={initial ? undefined : () => setId(null)} /> : busy && initial ? <div className="qx-empty">Opening the match…</div> : (
                    <div className="qp-form fxs-card qp-ref__card">
                        <span className="fxs-label">Quick Play referee</span>
                        <p className="qp-muted">Scan the QR on the host’s phone, or enter the match code.</p>
                        <input className="qp-input qp-code-input" inputMode="numeric" maxLength={6} placeholder="000000" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} onKeyDown={e => { if (e.key === 'Enter') open(); }} autoFocus />
                        <button type="button" className="qp-btn qp-btn--primary" disabled={busy} onClick={() => open()}>{busy ? 'Opening…' : 'Open match'}</button>
                    </div>
                )}
            </main>
        </div>
    );
};

export default QuickReferee;
