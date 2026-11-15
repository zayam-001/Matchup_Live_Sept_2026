// Futsal broadcast mode for venue TVs and streams. Same structure as padel's
// BroadcastMode (header, live grid that pages six at a time, ticker) with a
// European-night football look. Between matches it shows what's next and the tables.
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Logo } from '../../components/ui/Logo';
import { computeStandings, isLeagueFormat, leagueQualifiers, eventMinute, foulsFor, phaseLabel, scoreOf, sourceLabel } from '../engine';
import type { FutsalCategory, FutsalMatch, FutsalTeam, FutsalTournament } from '../types';
import { clockText, playerName, ShootoutTrack, stageText, useNow } from './shared';
import { CREST, NEUTRAL, SIDE_FILL, SIDE_LINE } from './palette';
import { publicPath } from '../sport';
import './broadcast.css';

const PAGE = 6;

const Star = () => <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z" /></svg>;
const Ball = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="10" /><path d="M12 7.2l3.6 2.6-1.4 4.2H9.8L8.4 9.8z" fill="currentColor" stroke="none" />
    </svg>
);

/** A team's own logo when it has one; otherwise a shield with its short name. */
const TeamMark: React.FC<{ team?: FutsalTeam; fallback: React.ReactNode }> = ({ team, fallback }) =>
    team?.logoUrl ? <img className="fb-logo" src={team.logoUrl} alt="" /> : <>{fallback}</>;

const Crest: React.FC<{ team?: FutsalTeam }> = ({ team }) => team?.logoUrl ? <span className="fb-crest fb-crest--img" aria-hidden="true"><img src={team.logoUrl} alt="" /></span> : (
    <span className="fb-crest" aria-hidden="true">
        <svg viewBox="0 0 40 45">
            <path d="M20 1.5L37 7v14c0 11-7.4 19-17 22.5C10.4 40 3 32 3 21V7z" fill="url(#fbCrest)" stroke={CREST.stroke} strokeWidth="1.6" />
            <defs><linearGradient id="fbCrest" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={CREST.top} /><stop offset="1" stopColor={CREST.bottom} /></linearGradient></defs>
            <path d="M20 5l13 4.3V21c0 8.6-5.6 15-13 18" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="1" />
        </svg>
        <span>{team?.shortName || '?'}</span>
    </span>
);

const nameOf = (teams: FutsalTeam[], matches: FutsalMatch[], m: FutsalMatch, side: 'home' | 'away') => {
    const t = teams.find(x => x.id === (side === 'home' ? m.homeId : m.awayId));
    if (t) return t.name;
    const label = sourceLabel(side === 'home' ? m.homeFrom : m.awayFrom, matches);
    return label.split(' · ')[1] || label;
};

/** A live-score card: Live tab on top, competition and group, crests over names, big score, ticking clock. */
const MatchCard: React.FC<{ m: FutsalMatch; cat: FutsalCategory; t: FutsalTournament; teams: FutsalTeam[]; matches: FutsalMatch[]; now: number }> = ({ m, cat, t, teams, matches, now }) => {
    const s = scoreOf(m);
    const running = ['PLAYING', 'PAUSED'].includes(m.periodState);
    const ticking = m.periodState === 'PLAYING';
    return (
        <div className="fb-card">
            <span className={`fb-card__tab ${ticking ? 'is-live' : ''}`}>{ticking ? <><i />Live</> : phaseLabel(m, cat.rules)}</span>
            <div className="fb-card__comp">{t.name}<span>{stageText(m)}{m.pitch ? ` · ${m.pitch}` : ''}</span></div>
            <div className="fb-card__main">
                {(['home', 'away'] as const).map((side, i) => {
                    const team = teams.find(x => x.id === (side === 'home' ? m.homeId : m.awayId));
                    const el = (
                        <div key={side} className="fb-team">
                            <Crest team={team} />
                            <b>{nameOf(teams, matches, m, side)}</b>
                            {team?.captainName && <small>C · {team.captainName}</small>}
                        </div>
                    );
                    if (i) return el;
                    return [el, (
                        <div key="score" className="fb-score">
                            <div className="fb-score__panel">{s.home}<em>:</em>{s.away}</div>
                            <div className={`fb-score__clock ${ticking ? 'is-running' : ''}`}>
                                <span className="fb-score__time">{running ? clockText(m, cat, now) : phaseLabel(m, cat.rules)}</span>
                                {running && <small>{m.periodState === 'PAUSED' ? 'Clock stopped' : phaseLabel(m, cat.rules)}</small>}
                            </div>
                            {s.hasPens && m.periodState !== 'SHOOTOUT' && <div className="fb-score__pens">Penalties {s.pensHome}–{s.pensAway}</div>}
                        </div>
                    )];
                })}
            </div>
            {(m.periodState === 'SHOOTOUT' || s.hasPens) && <ShootoutTrack m={m} names={{ home: nameOf(teams, matches, m, 'home'), away: nameOf(teams, matches, m, 'away') }} className="fx-pens--bc" />}
            <div className="fb-card__foot">
                {(['home', 'away'] as const).map(side => {
                    const goals = m.events.filter(e => !e.auto && ((e.type === 'GOAL' && e.side === side) || (e.type === 'OWN_GOAL' && e.side !== side)));
                    return (
                        <div key={side} className={`fb-side ${side === 'away' ? 'fb-side--away' : ''}`}>
                            {goals.slice(-4).map(e => <span key={e.id} className="fb-goal"><Ball />{playerName(teams, e.playerId)?.split(' ').slice(-1)[0] || 'Goal'}{e.type === 'OWN_GOAL' ? ' (og)' : ''} {eventMinute(cat.rules, e)}</span>)}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

/** One match in focus: the card, head-to-head stats and both lineups, like a match-centre app. */
const MatchFocus: React.FC<{ m: FutsalMatch; cat: FutsalCategory; t: FutsalTournament; teams: FutsalTeam[]; matches: FutsalMatch[]; now: number }> = props => {
    const { m, cat, teams } = props;
    const home = teams.find(x => x.id === m.homeId), away = teams.find(x => x.id === m.awayId);
    const count = (side: 'home' | 'away', f: (e: FutsalMatch['events'][number]) => boolean) => m.events.filter(e => e.side === side && !e.auto && f(e)).length;
    const s = scoreOf(m);
    const rows: [string, number, number][] = [
        ['Goals', s.home, s.away],
        ['Assisted goals', count('home', e => e.type === 'GOAL' && !!e.assistId), count('away', e => e.type === 'GOAL' && !!e.assistId)],
        ['Fouls', foulsFor(m, cat.rules, 'home'), foulsFor(m, cat.rules, 'away')],
        ['Long shots', count('home', e => e.goalType === 'long_shot'), count('away', e => e.goalType === 'long_shot')],
        ['Set pieces', count('home', e => e.goalType === 'free_kick' || e.goalType === 'penalty'), count('away', e => e.goalType === 'free_kick' || e.goalType === 'penalty')],
    ];
    const lineup = (team: FutsalTeam | undefined, side: 'home' | 'away') => {
        if (!team) return null;
        const lu = m.lineups?.[side];
        const ids = lu?.players?.length ? lu.players : team.players.map(p => p.id);
        // Goals and assists this match, per player: shown as G / A tags (with a count when more than one).
        const tally = (key: 'playerId' | 'assistId') => m.events.filter(e => e.type === 'GOAL' && e.side === side && !e.auto && e[key])
            .reduce((n, e) => n.set(e[key]!, (n.get(e[key]!) || 0) + 1), new Map<string, number>());
        const goals = tally('playerId'), assists = tally('assistId');
        const tag = (n: number | undefined, l: string) => n ? <span className={`fb-lineup__tag is-${l.toLowerCase()}`} title={l === 'G' ? 'Goals' : 'Assists'}>{n > 1 ? n : ''}{l}</span> : null;
        return (
            <div className="fb-lineup">
                <h3 style={{ color: SIDE_LINE[side] }}>{team.name}</h3>
                {team.players.filter(p => ids.includes(p.id)).map(p => (
                    <div key={p.id} className="fb-lineup__row">
                        <span className="fb-lineup__num" style={{ background: SIDE_FILL[side] }}>{p.number ?? ''}</span>
                        <span className="fb-lineup__name">{p.name}</span>
                        {lu?.gk === p.id && <span className="fb-lineup__tag">GK</span>}
                        {p.id === team.players[0]?.id && <span className="fb-lineup__tag is-c">C</span>}
                        {tag(goals.get(p.id), 'G')}{tag(assists.get(p.id), 'A')}
                    </div>
                ))}
            </div>
        );
    };
    return (
        <div className="fb-focus">
            <div className="fb__cell fb-focus__card">
                <MatchCard {...props} />
                {/* The match's own public page: anyone can open and share it. */}
                <a className="fb-matchlink" href={`#${publicPath(props.t)}/m/${m.id}`} target="_blank" rel="noopener noreferrer">Open match page ↗</a>
            </div>
            <div className="fb-focus__panels">
                <section className="fb-panel fb-stats">
                    <h2>Match stats</h2>
                    {rows.map(([k, h, a]) => {
                        const total = h + a || 1;
                        return (
                            <div key={k} className="fb-stat">
                                <b>{h}</b>
                                <div><span>{k}</span><div className="fb-stat__bar"><i style={{ width: `${(h / total) * 100}%`, background: SIDE_LINE.home }} /><i style={{ width: `${(a / total) * 100}%`, background: SIDE_LINE.away }} /></div></div>
                                <b>{a}</b>
                            </div>
                        );
                    })}
                </section>
                <section className="fb-panel fb-lineups">
                    <h2>Lineups</h2>
                    <div className="fb-lineups__cols">{lineup(home, 'home')}{lineup(away, 'away')}</div>
                </section>
            </div>
        </div>
    );
};

const Idle: React.FC<{ t: FutsalTournament; teams: FutsalTeam[]; matches: FutsalMatch[] }> = ({ t, teams, matches }) => {
    const next = matches.filter(m => m.status === 'SCHEDULED' && m.startAt).sort((a, b) => a.startAt!.localeCompare(b.startAt!)).slice(0, 6);
    const cat = t.categories[0];
    const accepted = teams.filter(x => x.categoryId === cat.id && x.status === 'ACCEPTED');
    const groups = [...new Set(accepted.map(x => x.groupId).filter(Boolean) as string[])].sort();
    const tables = isLeagueFormat(cat.format)
        ? [{ name: 'League', ids: accepted.map(x => x.id), ms: matches.filter(m => m.stage === 'LEAGUE') }]
        : groups.map(g => ({ name: `Group ${g}`, ids: accepted.filter(x => x.groupId === g).map(x => x.id), ms: matches.filter(m => m.stage === 'GROUP' && m.group === g) }));
    const q = cat.format === 'GROUPS_KNOCKOUT' ? cat.advancePerGroup : leagueQualifiers(cat) || 1;
    return (
        <div className="fb-idle">
            <section className="fb-panel">
                <h2>Coming up</h2>
                {next.length ? next.map(m => (
                    <div key={m.id} className="fb-fixture">
                        <span className="fb-fixture__when">{new Date(m.startAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}<small>{new Date(m.startAt!).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</small></span>
                        <span className="fb-fixture__team"><TeamMark team={teams.find(x => x.id === m.homeId)} fallback={<i className="fb-dot" style={{ background: SIDE_LINE.home }} />} /><span>{nameOf(teams, matches, m, 'home')}</span></span>
                        <span className="fb-vs">VS</span>
                        <span className="fb-fixture__team fb-fixture__away"><span>{nameOf(teams, matches, m, 'away')}</span><TeamMark team={teams.find(x => x.id === m.awayId)} fallback={<i className="fb-dot" style={{ background: SIDE_LINE.away }} />} /></span>
                    </div>
                )) : <div className="fb-fixture"><span /><span>No upcoming fixtures</span></div>}
            </section>
            <section className="fb-panel">
                <h2>Standings</h2>
                <div className="fb-tables">
                    {tables.map(g => (
                        <div key={g.name}>
                            <h3>{g.name}</h3>
                            <table className="fb-table">
                                <thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
                                <tbody>
                                    {computeStandings(g.ids, g.ms, cat.rules, { includeLive: true, seedOf: id => accepted.find(x => x.id === id)?.seed ?? 99 }).map((r, i) => {
                                        const team = accepted.find(x => x.id === r.teamId);
                                        return (
                                            <tr key={r.teamId} className={i < q ? 'is-q' : ''}>
                                                <td>{i + 1}</td>
                                                <td><span className="fb-fixture__team"><TeamMark team={team} fallback={<i className="fb-dot" style={{ background: NEUTRAL }} />} /><span>{team?.name}</span></span></td>
                                                <td>{r.p}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td><td>{r.gd > 0 ? `+${r.gd}` : r.gd}</td><td className="pts">{r.pts}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

/** Sponsor logos scrolling in the marquee (used instead of results when the tournament has sponsors). */
const SponsorTicker: React.FC<{ sponsors: { name: string; logoUrl: string }[] }> = ({ sponsors }) => {
    // Enough copies to fill a wide screen before the loop repeats.
    const row = Array.from({ length: Math.max(2, Math.ceil(8 / sponsors.length)) }, () => sponsors).flat();
    const item = (s: { name: string; logoUrl: string }, k: string) => <span key={k} className="fb-sponsor"><img src={s.logoUrl} alt={s.name} /></span>;
    return (
        <footer className="fb-ticker">
            <div style={{ overflow: 'hidden', flex: 1, display: 'flex' }}>
                <div className="fb-ticker__track fb-ticker__track--logos">{row.map((s, i) => item(s, `a${i}`))}{row.map((s, i) => item(s, `b${i}`))}</div>
            </div>
        </footer>
    );
};

const Ticker: React.FC<{ teams: FutsalTeam[]; matches: FutsalMatch[] }> = ({ teams, matches }) => {
    const short = (id?: string) => teams.find(x => x.id === id)?.shortName || 'TBD';
    const done = matches.filter(m => m.status === 'COMPLETED').sort((a, b) => String(b.startAt).localeCompare(String(a.startAt))).slice(0, 8)
        .map(m => { const s = scoreOf(m); return { k: m.id, el: <span key={m.id}><em>FT</em>{short(m.homeId)} <b>{s.home}–{s.away}</b> {short(m.awayId)}{s.hasPens ? ` (${s.pensHome}–${s.pensAway} p)` : ''}</span> }; });
    const next = matches.filter(m => m.status === 'SCHEDULED' && m.startAt && m.homeId && m.awayId).sort((a, b) => a.startAt!.localeCompare(b.startAt!)).slice(0, 8)
        .map(m => ({ k: m.id, el: <span key={m.id}><em>{new Date(m.startAt!).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</em>{short(m.homeId)} v {short(m.awayId)}</span> }));
    const items = [...done, ...next];
    if (!items.length) return null;
    return (
        <footer className="fb-ticker">
            <span className="fb-ticker__label"><Star />{done.length ? 'Results' : 'Fixtures'}</span>
            <div style={{ overflow: 'hidden', flex: 1, display: 'flex' }}>
                <div className="fb-ticker__track">{items.map(x => x.el)}{items.map(x => React.cloneElement(x.el, { key: `${x.k}-2` }))}</div>
            </div>
        </footer>
    );
};

export const FutsalBroadcast: React.FC<{ t: FutsalTournament; teams: FutsalTeam[]; matches: FutsalMatch[]; onClose: () => void }> = ({ t, teams, matches, onClose }) => {
    const live = useMemo(() => matches.filter(m => m.status === 'LIVE'), [matches]);
    const now = useNow(250, live.length > 0);
    const [selected, setSelected] = useState<string | 'ALL'>('ALL');
    const [page, setPage] = useState(0);
    const pages = Math.max(1, Math.ceil(live.length / PAGE));
    const safe = Math.min(page, pages - 1);
    const shown = live.slice(safe * PAGE, (safe + 1) * PAGE);
    // One live match always opens in focus: card, stats and lineups.
    const active = selected !== 'ALL' ? live.find(m => m.id === selected) : live.length === 1 ? live[0] : undefined;
    const catOf = (m: FutsalMatch) => t.categories.find(c => c.id === m.categoryId) || t.categories[0];

    useEffect(() => { if (selected !== 'ALL' && !active) setSelected('ALL'); }, [selected, active]);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') setPage(p => Math.min(p + 1, pages - 1));
            else if (e.key === 'ArrowLeft') setPage(p => Math.max(p - 1, 0));
            else if (e.key === 'Escape') { if (selected !== 'ALL') setSelected('ALL'); else onClose(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [pages, selected, onClose]);

    // Paging keeps a full six-slot grid so a lone match on the last page doesn't fill the screen.
    const n = pages > 1 ? PAGE : shown.length;
    const layout = n <= 1 ? 1 : n === 2 ? 2 : n <= 4 ? 4 : 6;
    const year = t.startDate?.slice(0, 4);

    return createPortal(
        <div className={`fb ${t.theme === 'crimson' ? 'fb--crimson' : ''}`} role="dialog" aria-label={`${t.name} broadcast`}>
            <div className="fb__stars" aria-hidden="true" />
            <div className="fb__beam fb__beam--l" aria-hidden="true" />
            <div className="fb__beam fb__beam--r" aria-hidden="true" />
            <div className="fb__pitch" aria-hidden="true" />

            <header className="fb__head">
                <div className="fb__brand">
                    <Logo size={84} variant="white" className="shrink-0 !w-[clamp(48px,8vh,84px)] !h-auto aspect-[800/586]" />
                    {t.logoUrl && <><span className="fb__sep" aria-hidden="true" /><img src={t.logoUrl} alt={t.name} /></>}
                </div>
                <div className="fb__title">
                    <h1>{t.name}{year && !t.name.includes(year) ? ` | ${year}` : ''}</h1>
                    <div className="fb__stars-row" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <Star key={i} />)}</div>
                    <div className="fb__venue">{t.venue}</div>
                </div>
                <div className="fb__right">
                    <div className="fb__chips">
                        {live.length > 0 && <span className="fb__chip"><i />{live.length} Live</span>}
                        <button type="button" className="fb__btn" onClick={onClose} title="Close broadcast mode" aria-label="Close broadcast mode"><X size={16} /></button>
                    </div>
                    {selected === 'ALL' && pages > 1 && (
                        <div className="fb__pages">
                            <button type="button" className="fb__btn" onClick={() => setPage(Math.max(safe - 1, 0))} disabled={safe === 0} aria-label="Previous page"><ChevronLeft size={16} /></button>
                            <span>Page {safe + 1} / {pages}</span>
                            <button type="button" className="fb__btn" onClick={() => setPage(Math.min(safe + 1, pages - 1))} disabled={safe >= pages - 1} aria-label="Next page"><ChevronRight size={16} /></button>
                        </div>
                    )}
                </div>
            </header>

            <main className="fb__stage">
                {active ? (
                    <div className="fb-focus-wrap">
                        {live.length > 1 && <button type="button" className="fb__chip fb-back" onClick={() => setSelected('ALL')}><ChevronLeft size={14} /> All {live.length} live matches</button>}
                        <MatchFocus m={active} cat={catOf(active)} t={t} teams={teams} matches={matches} now={now} />
                    </div>
                ) : live.length ? (
                    <motion.div key={safe} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }} className={`fb__grid fb__grid--${layout}`}>
                        {shown.map(m => (
                            <div key={m.id} className={`fb__cell ${live.length > 1 ? 'is-click' : ''}`} onClick={live.length > 1 ? () => setSelected(m.id) : undefined} title={live.length > 1 ? 'Show this match full-screen' : undefined}>
                                <MatchCard m={m} cat={catOf(m)} t={t} teams={teams} matches={matches} now={now} />
                            </div>
                        ))}
                    </motion.div>
                ) : (
                    <Idle t={t} teams={teams} matches={matches} />
                )}
            </main>

            {t.sponsors?.length ? <SponsorTicker sponsors={t.sponsors} /> : <Ticker teams={teams} matches={matches} />}
        </div>,
        document.body,
    );
};

export default FutsalBroadcast;
