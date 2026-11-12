import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { MatchupLogo } from '../../components/MatchupLogo';
import { clockMs, displayClock, isKnockout, phaseLabel, scoreOf, sourceLabel, STAGE_NAMES } from '../engine';
import { isDemo, subscribeFutsalMatches, subscribeFutsalTeams, subscribeFutsalTournament, subscribeFutsalTournaments } from '../store';
import { CREST } from './palette';
import type { FutsalCategory, FutsalMatch, FutsalTeam, FutsalTournament, SlotSource } from '../types';
import { publicPath } from '../sport';

// ---------------------------------------------------------------- hooks

/** Re-render on an interval, e.g. to run a match clock. */
export const useNow = (ms = 1000, active = true) => {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        if (!active) return;
        const id = setInterval(() => setNow(Date.now()), ms);
        return () => clearInterval(id);
    }, [ms, active]);
    return now;
};

export const useFutsalTournament = (id?: string) => {
    const [t, setT] = useState<FutsalTournament | null | undefined>(undefined);
    const [teams, setTeams] = useState<FutsalTeam[] | null>(null);
    const [matches, setMatches] = useState<FutsalMatch[] | null>(null);
    useEffect(() => {
        if (!id) return;
        setT(undefined); setTeams(null); setMatches(null);
        const a = subscribeFutsalTournament(id, setT);
        const b = subscribeFutsalTeams(id, setTeams);
        const c = subscribeFutsalMatches(id, setMatches);
        return () => { a(); b(); c(); };
    }, [id]);
    return { t, teams: teams || [], matches: matches || [], loading: t === undefined || teams === null || matches === null };
};

export const useAllFutsal = (withMatches = true) => {
    const [ts, setTs] = useState<FutsalTournament[] | null>(null);
    const [teams, setTeams] = useState<FutsalTeam[] | null>(null);
    const [matches, setMatches] = useState<FutsalMatch[] | null>(withMatches ? null : []);
    useEffect(() => {
        const a = subscribeFutsalTournaments(setTs);
        const b = subscribeFutsalTeams(null, setTeams);
        const c = withMatches ? subscribeFutsalMatches(null, setMatches) : () => {};
        return () => { a(); b(); c(); };
    }, [withMatches]);
    return { tournaments: ts || [], teams: teams || [], matches: matches || [], loading: ts === null || teams === null || matches === null };
};

export const useToast = () => {
    const [msg, setMsg] = useState('');
    useEffect(() => { if (!msg) return; const id = setTimeout(() => setMsg(''), 2600); return () => clearTimeout(id); }, [msg]);
    return { toast: setMsg, node: msg ? <div className="fx-toast" role="status">{msg}</div> : null };
};

// ---------------------------------------------------------------- formatting

export const fmtTime = (iso?: string) => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
export const fmtDay = (iso?: string) => iso ? new Date(iso).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }) : 'To be scheduled';
export const fmtDate = (ymd?: string) => ymd ? new Date(`${ymd}T00:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '';
export const dateRange = (t: FutsalTournament) => t.endDate && t.endDate !== t.startDate ? `${fmtDate(t.startDate)} – ${fmtDate(t.endDate)}` : fmtDate(t.startDate);

export const catOf = (t: FutsalTournament, id: string): FutsalCategory => t.categories.find(c => c.id === id) || t.categories[0];

export const teamName = (teams: FutsalTeam[], id?: string, src?: SlotSource, matches: FutsalMatch[] = []) => {
    const team = id ? teams.find(x => x.id === id) : undefined;
    return team ? team.name : sourceLabel(src, matches).split(' · ')[1] || sourceLabel(src, matches);
};

export const playerName = (teams: FutsalTeam[], id?: string) => {
    if (!id) return '';
    for (const t of teams) { const p = t.players.find(x => x.id === id); if (p) return p.name; }
    return 'Unknown player';
};

/** Live clock text for a match, e.g. "14:32", or the phase when the clock isn't running. */
export const clockText = (m: FutsalMatch, cat: FutsalCategory, now: number) => {
    if (m.status !== 'LIVE' || !['PLAYING', 'PAUSED'].includes(m.periodState)) return phaseLabel(m, cat.rules);
    // Like football: once the half's time is up the clock keeps running as added time.
    return displayClock(cat.rules, m.period, clockMs(m, now));
};

export const stageText = (m: FutsalMatch) => (m.stage === 'GROUP' ? `Group ${m.group}` : STAGE_NAMES[m.stage]);

// ---------------------------------------------------------------- bits

export const Ball: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 7.2l3.6 2.6-1.4 4.2H9.8L8.4 9.8z" fill="currentColor" stroke="none" />
        <path d="M12 7.2V2.4M15.6 9.8l4.4-1.6M14.2 14l2.8 3.8M9.8 14L7 17.8M8.4 9.8L4 8.2" />
    </svg>
);

export const Star: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z" /></svg>
);

export const Trophy: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path d="M20 8h24v14c0 9-5.4 16-12 16s-12-7-12-16V8z" fill="currentColor" />
        <path d="M20 13H10c0 9 4 14 11 15M44 13h10c0 9-4 14-11 15" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M28 38h8v8h-8z" fill="currentColor" />
        <path d="M20 56h24l-3-10H23z" fill="currentColor" />
    </svg>
);

/** A shield in the team's colour with its three-letter code. */
export const Crest: React.FC<{ team?: FutsalTeam; size?: number; label?: string }> = ({ team, size = 40, label }) => {
    const id = `g${(team?.id || label || 'x').replace(/[^a-z0-9]/gi, '')}`;
    // An uploaded club logo replaces the drawn shield.
    if (team?.logoUrl) return <span className="fx-crest fx-crest--logo" style={{ '--s': `${size}px` } as React.CSSProperties} aria-hidden="true"><img src={team.logoUrl} alt="" loading="lazy" /></span>;
    return (
        <span className="fx-crest" style={{ '--s': `${size}px` } as React.CSSProperties} aria-hidden="true">
            <svg viewBox="0 0 40 45">
                <defs>
                    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor={CREST.top} />
                        <stop offset="1" stopColor={CREST.bottom} />
                    </linearGradient>
                </defs>
                <path d="M20 1.5L37 7v14c0 11-7.4 19-17 22.5C10.4 40 3 32 3 21V7z" fill={`url(#${id})`} stroke={CREST.stroke} strokeWidth="1.4" />
                <path d="M20 5l13 4.3V21c0 8.6-5.6 15-13 18" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="1" />
            </svg>
            {team?.logoUrl ? <img src={team.logoUrl} alt="" /> : <span>{team?.shortName || label || '?'}</span>}
        </span>
    );
};

/**
 * The public futsal/football shell. Inside a tournament (`tour`), the menu is that tournament's:
 * details and Match Up home; there's no way back to the list of competitions.
 */
export const Shell: React.FC<{ active?: 'home' | 'details' | 'leaderboard' | 'none'; children: React.ReactNode; bare?: boolean; tour?: Pick<FutsalTournament, 'id' | 'sport'> }> = ({ active = 'none', children, bare, tour }) => {
    const demo = isDemo();
    useEffect(() => {
        const prev = document.title;
        document.title = 'Futsal & Football | Match Up';
        window.scrollTo(0, 0);
        return () => { document.title = prev; };
    }, []);
    return (
        <div className="fx">
            <div className="fx__sky" aria-hidden="true" />
            <div className="fx__body">
                {!bare && (
                    <header className="fx-top">
                        <div className="fx-wrap fx-top__in">
                            <a className="fx-brand" href={tour ? `#${publicPath(tour)}` : '#futsal'} aria-label={tour ? 'Tournament details' : 'Match Up Futsal home'}>
                                <MatchupLogo className="h-6 w-auto" />
                                <span className="fx-brand__tag">{tour?.sport === 'football' ? 'Football' : 'Futsal'}</span>
                            </a>
                            {demo && <span className="fx-demo" title="Local demo data, nothing is saved to the live database">Demo data</span>}
                            <nav className="fx-nav" aria-label="Sections">
                                {tour ? <>
                                    <a href={`#${publicPath(tour)}`} aria-current={active === 'details' || active === 'leaderboard' ? 'page' : undefined}>Tournament details</a>
                                </> : <a href="#futsal" aria-current={active === 'home' ? 'page' : undefined}>Competitions</a>}
                                <a href="#landing">Match Up home</a>
                            </nav>
                        </div>
                    </header>
                )}
                {children}
            </div>
        </div>
    );
};

export const Loading: React.FC<{ label?: string }> = ({ label = 'Loading' }) => (
    <div className="fx-empty" role="status"><Ball className="fx-spin-ball" /> <b style={{ fontSize: 18 }}>{label}…</b></div>
);

export const Empty: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
    <div className="fx-empty"><b>{title}</b>{children}</div>
);

/** One fixture as a row: time, teams, score or kick-off, live state. */
export const MatchRow: React.FC<{ m: FutsalMatch; t: FutsalTournament; teams: FutsalTeam[]; matches: FutsalMatch[]; now: number; showCat?: boolean }> = ({ m, t, teams, matches, now, showCat }) => {
    const cat = catOf(t, m.categoryId);
    const home = teams.find(x => x.id === m.homeId), away = teams.find(x => x.id === m.awayId);
    const s = scoreOf(m);
    const live = m.status === 'LIVE', done = m.status === 'COMPLETED';
    const homeWon = done && m.winnerId && m.winnerId === m.homeId, awayWon = done && m.winnerId && m.winnerId === m.awayId;
    return (
        <a className={`fx-match ${live ? 'is-live' : ''}`} href={`#${publicPath(t)}/m/${m.id}`}>
            <span className="fx-match__when">
                <b>{m.startAt ? fmtTime(m.startAt) : 'TBC'}</b>
                <span>{m.pitch || ''}{showCat && t.categories.length > 1 ? ` · ${cat.name}` : ''}</span>
                <span>{stageText(m)}</span>
            </span>
            <span className={`fx-match__team ${awayWon ? 'is-lost' : ''} ${!home ? 'is-tbd' : ''}`}>
                <Crest team={home} size={34} label="?" />
                <span>{teamName(teams, m.homeId, m.homeFrom, matches)}</span>
            </span>
            <span className="fx-match__score">
                {live || done ? <b>{s.home} – {s.away}</b> : <span className="fx-match__vs">vs</span>}
                {live ? <small className="is-live">{clockText(m, cat, now)}</small>
                    : done ? <small>{s.hasPens ? `${s.pensHome}–${s.pensAway} pens` : m.decidedBy === 'forfeit' ? 'Walkover' : phaseLabel(m, cat.rules)}</small>
                        : <small>{m.startAt ? new Date(m.startAt).toLocaleDateString([], { day: 'numeric', month: 'short' }) : ''}</small>}
            </span>
            <span className={`fx-match__team fx-match__team--away ${homeWon ? 'is-lost' : ''} ${!away ? 'is-tbd' : ''}`}>
                <Crest team={away} size={34} label="?" />
                <span>{teamName(teams, m.awayId, m.awayFrom, matches)}</span>
            </span>
            <ChevronRight size={18} className="fx-match__go" aria-hidden="true" />
        </a>
    );
};

/** Matches grouped under day headings. */
export const MatchList: React.FC<{ list: FutsalMatch[]; t: FutsalTournament; teams: FutsalTeam[]; matches: FutsalMatch[]; now: number; showCat?: boolean }> = ({ list, t, teams, matches, now, showCat }) => {
    const days = useMemo(() => {
        const out = new Map<string, FutsalMatch[]>();
        [...list].sort((a, b) => String(a.startAt || '9').localeCompare(String(b.startAt || '9')) || a.matchNo - b.matchNo).forEach(m => {
            const k = m.startAt ? new Date(m.startAt).toDateString() : 'tbc';
            if (!out.has(k)) out.set(k, []);
            out.get(k)!.push(m);
        });
        return [...out.entries()];
    }, [list]);
    if (!list.length) return <Empty title="No matches here yet">Fixtures appear once the organiser publishes the schedule.</Empty>;
    return (
        <div>
            {days.map(([k, ms]) => (
                <section key={k}>
                    <h3 className="fx-day">{k === 'tbc' ? 'To be scheduled' : fmtDay(ms[0].startAt)}</h3>
                    <div className="fx-matches">{ms.map(m => <MatchRow key={m.id} m={m} t={t} teams={teams} matches={matches} now={now} showCat={showCat} />)}</div>
                </section>
            ))}
        </div>
    );
};

export const isKo = (m: FutsalMatch) => isKnockout(m.stage);

/** A penalty shootout kick by kick: ✓ scored, ✕ missed, empty dots for the kicks still to come in the first five. */
export const ShootoutTrack: React.FC<{ m: FutsalMatch; names: { home: string; away: string }; className?: string }> = ({ m, names, className = '' }) => {
    const all = (m.events || []).filter(e => e.type === 'PEN_SCORED' || e.type === 'PEN_MISSED');
    const row = (side: 'home' | 'away') => {
        const ks = all.filter(e => e.side === side);
        const pad = Math.max(0, 5 - ks.length);
        return (
            <div className="fx-pens__row">
                <b>{names[side]}</b>
                <span className="fx-pens__dots">
                    {ks.map(e => <i key={e.id} className={e.type === 'PEN_SCORED' ? 'is-in' : 'is-out'}>{e.type === 'PEN_SCORED' ? '✓' : '✕'}</i>)}
                    {Array.from({ length: pad }, (_, k) => <i key={`p${k}`} />)}
                </span>
                <em>{ks.filter(e => e.type === 'PEN_SCORED').length}</em>
            </div>
        );
    };
    return <div className={`fx-pens ${className}`} aria-label="Penalty shootout"><span className="fx-pens__title">Penalties</span>{row('home')}{row('away')}</div>;
};
