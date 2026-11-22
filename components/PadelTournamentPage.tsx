// Public padel tournament page (#tournament/<slug>), in the same look as the futsal/football one (IBA
// Champions League): overview, matches, standings, bracket and teams, with Watch Live and live scores.
// Registration has its own page (#register/<slug>); this one links to it while entries are open.
import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronRight, MapPin, Share2, Trophy } from 'lucide-react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db, isMatchInCategory, isTeamInCategory } from '../services/storage';
import { useTournamentDoc } from '../hooks/useTournamentDoc';
import { useTournamentMatches } from '../hooks/useTournamentMatches';
import type { Match, Team, Tournament } from '../types';
import { MatchupLogo } from './MatchupLogo';
import { CountryFlag } from './CountrySelect';
import { SpectatorBracket, bracketMatches } from './SpectatorBracket';
import { StandingsTable } from './LiveScoreboard';
import { WatchLivePlayer, tournamentStreams } from './LiveVideo';
import { isFipTournament, getPointsSystem } from '../lib/pointsSystems';
import { isTournamentFinished } from '../lib/lifecycle';
import { isByeMatch, isByeTeam } from '../lib/byes';
import { fullSurname } from '../lib/nameDisplay';
import '../futsal/futsal.css';
import './spectator.css';
import './padelpage.css';

const TABS = [
    { id: 'overview', label: 'Overview' }, { id: 'matches', label: 'Matches' }, { id: 'standings', label: 'Standings' },
    { id: 'bracket', label: 'Bracket' }, { id: 'teams', label: 'Teams' },
] as const;
type Tab = typeof TABS[number]['id'];

/** A link may carry the tournament's slug (current or from before a rename) or its id. */
const usePadelTournamentId = (key: string) => {
    const [id, setId] = useState<string | null>(null);
    useEffect(() => {
        let live = true;
        (async () => {
            const col = collection(db, 'tournaments');
            for (const q of [query(col, where('slug', '==', key), limit(1)), query(col, where('oldSlugs', 'array-contains', key), limit(1))]) {
                const snap = await getDocs(q).catch(() => null);
                if (snap && !snap.empty) { if (live) setId(snap.docs[0].id); return; }
            }
            if (live) setId(key);
        })();
        return () => { live = false; };
    }, [key]);
    return id;
};

const isLive = (m: Match) => ['IN_PROGRESS', 'LIVE'].includes(String(m.status).toUpperCase()) && !m.winnerTeamId;
const isDone = (m: Match) => ['COMPLETED', 'FINISHED'].includes(String(m.status).toUpperCase()) || !!m.winnerTeamId;
const whenOf = (m: Match) => (m as any).scheduledTime || (m as any).scheduledAt || '';
const timeText = (v: string) => { const d = new Date(v); return isNaN(+d) ? 'TBC' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
const dateText = (v: string) => { const d = new Date(v); return isNaN(+d) ? '' : d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }); };
const range = (t: Tournament) => [t.startDate, t.endDate].filter(Boolean).map(d => new Date(String(d)).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })).filter((v, i, a) => a.indexOf(v) === i).join(' – ');

/** A pair's two players, with flags: "NUNES Gustavo" style for FIP events, full names otherwise. */
const PairNames = ({ team, fallback, fip, flags }: { team?: Team; fallback?: string; fip: boolean; flags: boolean }) => {
    const players = team && !isByeTeam(team) ? [team.player1, team.player2].filter(p => p?.name && p.name !== 'TBD') : [];
    if (!players.length) return <span className="pt-pair is-tbd">{team?.name && !isByeTeam(team) ? team.name : fallback || 'TBD'}</span>;
    return (
        <span className="pt-pair">
            {players.map((p: any, i) => {
                const last = fullSurname(p);
                const first = fip && last ? String(p.name).replace(new RegExp(`\\s*${String(p.lastName || last).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'), '') : '';
                return (
                    <span key={i} className="pt-pair__p">
                        {flags && p.country && <CountryFlag code={p.country} className="w-5 h-[14px] rounded-[2px]" />}
                        {fip ? <><b>{last}</b> {first}</> : <b>{p.name}</b>}
                    </span>
                );
            })}
        </span>
    );
};

const MatchRow = ({ m, t, teams }: { m: Match; t: Tournament; teams: Team[] }) => {
    const fip = isFipTournament(t as any), flags = !!t.showNationFlags;
    const t1 = teams.find(x => x.id === m.team1Id), t2 = teams.find(x => x.id === m.team2Id);
    const live = isLive(m), done = isDone(m);
    const s1 = m.score?.p1SetScores || [], s2 = m.score?.p2SetScores || [];
    const won1 = done && m.winnerTeamId && m.winnerTeamId === m.team1Id, won2 = done && m.winnerTeamId && m.winnerTeamId === m.team2Id;
    const sets = (mine: number[], other: number[], cur?: number) => (
        <span className="pt-sets">
            {mine.map((g, i) => <b key={i} className={g > (other[i] ?? 0) ? 'is-won' : ''}>{g}</b>)}
            {live && <b className="is-now">{cur ?? 0}</b>}
        </span>
    );
    return (
        <a className={`fx-match pt-match ${live ? 'is-live' : ''}`} href={`#live/${t.slug || t.id}`}>
            <span className="fx-match__when">
                <b>{whenOf(m) ? timeText(whenOf(m)) : 'TBC'}</b>
                <span>{m.court || ''}</span>
                <span>{m.roundName || ''}</span>
            </span>
            <span className="pt-match__teams">
                <span className={`pt-match__row ${won2 ? 'is-lost' : ''}`}><PairNames team={t1} fallback={m.team1Name} fip={fip} flags={flags} />{(live || done) && sets(s1, s2, m.score?.p1Games)}</span>
                <span className={`pt-match__row ${won1 ? 'is-lost' : ''}`}><PairNames team={t2} fallback={m.team2Name} fip={fip} flags={flags} />{(live || done) && sets(s2, s1, m.score?.p2Games)}</span>
            </span>
            <span className="pt-match__state">{live ? <span className="fx-pill fx-pill--live">Live</span> : done ? <span className="fx-pill">Final</span> : <small>{whenOf(m) ? dateText(whenOf(m)) : ''}</small>}</span>
            <ChevronRight size={18} className="fx-match__go" aria-hidden="true" />
        </a>
    );
};

export const PadelTournamentPage: React.FC<{ id: string }> = ({ id: key }) => {
    const id = usePadelTournamentId(key);
    const { tournament: t, loading } = useTournamentDoc(id);
    const { matches } = useTournamentMatches(id);
    const [tab, setTab] = useState<Tab>('overview');
    const [catId, setCatId] = useState('');
    const [court, setCourt] = useState('');
    const [watching, setWatching] = useState(false);
    const [copied, setCopied] = useState(false);
    useEffect(() => { if (t) document.title = `${t.name} | Match Up`; window.scrollTo(0, 0); }, [t?.name]); // eslint-disable-line react-hooks/exhaustive-deps

    const cats = t?.categories || [];
    const cat = cats.find((c: any) => c.id === catId) || cats[0];
    const catMatches = useMemo(() => (t ? matches.filter((m: Match) => !cat || isMatchInCategory(m, cat.id, t)) : []), [matches, cat, t]);
    const played = catMatches.filter((m: Match) => !isByeMatch(m, t?.teams || []));
    const teams: Team[] = (t?.teams || []).filter((x: Team) => !isByeTeam(x) && (!cat || isTeamInCategory(x, cat.id, t)) && String(x.status).toUpperCase() === 'ACCEPTED');

    if (loading || !id) return <div className="fx"><div className="fx__sky" /><div className="fx__body"><div className="fx-wrap"><div className="fx-empty"><b>Loading…</b></div></div></div></div>;
    if (!t) return <div className="fx"><div className="fx__sky" /><div className="fx__body"><div className="fx-wrap"><div className="fx-empty"><b>Tournament not found</b>It may have been renamed or removed.</div></div></div></div>;

    const fip = isFipTournament(t as any);
    const finished = isTournamentFinished(t, matches);
    const live = played.filter(isLive);
    const upcoming = played.filter((m: Match) => !isLive(m) && !isDone(m)).sort((a: Match, b: Match) => String(whenOf(a) || '9').localeCompare(String(whenOf(b) || '9'))).slice(0, 5);
    const recent = played.filter(isDone).sort((a: Match, b: Match) => String(whenOf(b)).localeCompare(String(whenOf(a)))).slice(0, 5);
    const ko = bracketMatches(catMatches, cat?.format || t.format);
    const finalMatch = ko.filter((m: Match) => !/3rd|third/i.test(m.roundName || '')).sort((a: Match, b: Match) => (Number(b.round) || 0) - (Number(a.round) || 0))[0];
    const champion = finalMatch && isDone(finalMatch) && /final/i.test(finalMatch.roundName || '') && !/semi|quarter/i.test(finalMatch.roundName || '') ? teams.find(x => x.id === finalMatch.winnerTeamId) : undefined;
    const pureKnockout = /ELIMINATION|KNOCKOUT/i.test(String(cat?.format || t.format || '')) && !/GROUP/i.test(String(cat?.format || t.format || ''));
    const visible = TABS.filter(x => (x.id !== 'bracket' || ko.length > 0) && (x.id !== 'standings' || !pureKnockout));
    const registrationOpen = !finished && (String(t.status).toUpperCase() === 'REGISTRATION' || (!!t.registrationDeadline && new Date(t.registrationDeadline) > new Date()));
    const streams = tournamentStreams(t).length > 0;
    const tierId = [(t as any).rankingTier, (t as any).pointsSystem].find((x: any) => String(x || '').startsWith('fip'));
    const tier = fip ? getPointsSystem(tierId).label : 'Padel';
    const courts = [...new Set(played.map((m: Match) => m.court).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })) as string[];
    const share = async () => {
        const url = `${window.location.origin}/#tournament/${t.slug || t.id}`;
        try {
            if (navigator.share) await navigator.share({ title: t.name, url });
            else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); }
        } catch { /* cancelled */ }
    };

    return (
        <div className="fx">
            <div className="fx__sky" aria-hidden="true" />
            <div className="fx__body">
                <header className="fx-top">
                    <div className="fx-wrap fx-top__in">
                        <a className="fx-brand" href={`#tournament/${t.slug || t.id}`} aria-label="Tournament details"><MatchupLogo className="h-6 w-auto" /><span className="fx-brand__tag">Padel</span></a>
                        <nav className="fx-nav" aria-label="Sections">
                            <a href={`#live/${t.slug || t.id}`}>Live scores</a>
                            <a href="#landing">Match Up home</a>
                        </nav>
                    </div>
                </header>
                <div className="fx-wrap">
                    <header className="fx-thead fx-thead--compact pt-head">
                        <div className="fx-thead__row">
                            <div>
                                <span className="fx-eyebrow">{tier}{t.city ? ` · ${t.city}` : ''}</span>
                                <h1 className="fx-silver fx-thead__title">{t.name}</h1>
                                <div className="fx-thead__meta">
                                    {range(t) && <span className="fx-pill"><CalendarDays size={13} />{range(t)}</span>}
                                    {t.venue && <span className="fx-pill"><MapPin size={13} />{t.venue}</span>}
                                    {live.length > 0 && <span className="fx-pill fx-pill--live">{live.length} live</span>}
                                    {finished && <span className="fx-pill">Finished</span>}
                                </div>
                            </div>
                            <div className="fx-row">
                                {registrationOpen && <a className="fx-btn fx-btn--primary" href={`#register/${t.slug || t.id}`}>Register a team</a>}
                                {streams && <button type="button" className="fx-btn pt-btn--live" onClick={() => setWatching(true)}><span className="spx-btn__dot" />Watch Live</button>}
                                <a className="fx-btn" href={`#live/${t.slug || t.id}`}>Live scores</a>
                                <button type="button" className="fx-btn" onClick={share}><Share2 />{copied ? 'Link copied' : 'Share'}</button>
                            </div>
                        </div>
                        {cats.length > 1 && (
                            <div className="fx-chips" style={{ marginTop: 18 }} role="group" aria-label="Category">
                                {cats.map((c: any) => <button key={c.id} type="button" className={`fx-chip ${c.id === cat?.id ? 'is-on' : ''}`} aria-pressed={c.id === cat?.id} onClick={() => setCatId(c.id)}>{c.name}</button>)}
                            </div>
                        )}
                    </header>

                    <div className="fx-sticky-tabs">
                        <nav className="fx-tabs" aria-label="Sections">
                            {visible.map(x => <button key={x.id} type="button" className={tab === x.id ? 'is-on' : ''} aria-current={tab === x.id ? 'page' : undefined} onClick={() => setTab(x.id)}>{x.label}</button>)}
                        </nav>
                    </div>

                    <main style={{ paddingBottom: 60 }}>
                        {tab === 'overview' && (
                            <>
                                {champion && (
                                    <section className="fx-section">
                                        <div className="fx-card fx-card--pad" style={{ display: 'flex', alignItems: 'center', gap: 18, borderColor: 'rgba(242,207,114,.45)' }}>
                                            <Trophy className="fx-gold-ic" />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <span className="fx-eyebrow" style={{ color: 'var(--fx-gold)' }}>{cat?.name || ''} champions</span>
                                                <h2 className="fx-silver" style={{ fontSize: 'clamp(24px,4.4vw,40px)', marginTop: 6 }}><PairNames team={champion} fip={fip} flags={!!t.showNationFlags} /></h2>
                                            </div>
                                        </div>
                                    </section>
                                )}
                                {live.length > 0 && (
                                    <section className="fx-section">
                                        <div className="fx-section__head"><h2>Live</h2>{streams && <button type="button" className="fx-link" onClick={() => setWatching(true)}>Watch live video →</button>}</div>
                                        <div className="fx-matches">{live.map((m: Match) => <MatchRow key={m.id} m={m} t={t} teams={t.teams || []} />)}</div>
                                    </section>
                                )}
                                <div className="fx-grid2" style={{ alignItems: 'start' }}>
                                    <section className="fx-section" style={{ marginTop: live.length ? 0 : 34 }}>
                                        <div className="fx-section__head"><h2>Up next</h2><button type="button" className="fx-link" onClick={() => setTab('matches')}>All matches →</button></div>
                                        {upcoming.length ? <div className="fx-matches">{upcoming.map((m: Match) => <MatchRow key={m.id} m={m} t={t} teams={t.teams || []} />)}</div> : <div className="fx-empty"><b>Nothing scheduled</b>Check back when the order of play is out.</div>}
                                    </section>
                                    <section className="fx-section" style={{ marginTop: live.length ? 0 : 34 }}>
                                        <div className="fx-section__head"><h2>Results</h2></div>
                                        {recent.length ? <div className="fx-matches">{recent.map((m: Match) => <MatchRow key={m.id} m={m} t={t} teams={t.teams || []} />)}</div> : <div className="fx-empty"><b>No results yet</b>Finished matches show here.</div>}
                                    </section>
                                </div>
                                <section className="fx-section">
                                    <div className="fx-card fx-card--pad pt-facts">
                                        <div><small>Format</small><b>{String(cat?.format || t.format || '').replace(/_/g, ' ').toLowerCase() || '—'}</b></div>
                                        <div><small>Pairs</small><b>{teams.length}</b></div>
                                        <div><small>Matches played</small><b>{played.filter(isDone).length} / {played.length}</b></div>
                                        {(cat?.prizeMoney || t.prizeMoney) ? <div><small>Prize money</small><b>{t.currency || 'Rs'} {Number(cat?.prizeMoney || t.prizeMoney).toLocaleString()}</b></div> : null}
                                        {courts.length > 0 && <div><small>Courts</small><b>{courts.length}</b></div>}
                                    </div>
                                </section>
                            </>
                        )}

                        {tab === 'matches' && (
                            <section className="fx-section" style={{ marginTop: 14 }}>
                                {courts.length > 1 && (
                                    <div className="fx-chips" role="group" aria-label="Court" style={{ marginBottom: 14 }}>
                                        <button type="button" className={`fx-chip ${!court ? 'is-on' : ''}`} onClick={() => setCourt('')}>All courts</button>
                                        {courts.map(c => <button key={c} type="button" className={`fx-chip ${court === c ? 'is-on' : ''}`} onClick={() => setCourt(c)}>{c}</button>)}
                                    </div>
                                )}
                                <MatchDays list={played.filter((m: Match) => !court || m.court === court)} t={t} />
                            </section>
                        )}

                        {tab === 'standings' && (
                            <section className="fx-section spx" style={{ marginTop: 14 }}>
                                <StandingsTable tournament={t} tournamentId={t.id} categoryId={cat?.id || null} initialTeams={teams} matches={played} />
                            </section>
                        )}

                        {tab === 'bracket' && (
                            <section className="fx-section spx" style={{ marginTop: 14 }}>
                                <SpectatorBracket matches={catMatches} teams={t.teams || []} format={cat?.format || t.format} flags={!!t.showNationFlags} fip={fip} />
                            </section>
                        )}

                        {tab === 'teams' && (
                            <section className="fx-section" style={{ marginTop: 14 }}>
                                {teams.length ? (
                                    <div className="pt-teams">
                                        {[...teams].sort((a, b) => String(fip ? fullSurname(a.player1) : a.name).localeCompare(String(fip ? fullSurname(b.player1) : b.name))).map(x => (
                                            <div key={x.id} className="fx-card pt-team"><PairNames team={x} fip={fip} flags={!!t.showNationFlags} /></div>
                                        ))}
                                    </div>
                                ) : <div className="fx-empty"><b>No pairs yet</b>Accepted pairs show here.</div>}
                            </section>
                        )}
                    </main>
                </div>
            </div>
            {watching && <WatchLivePlayer tournament={t} liveMatches={live} onClose={() => setWatching(false)} />}
        </div>
    );
};

/** Matches under day headings, in order of play. */
const MatchDays = ({ list, t }: { list: Match[]; t: Tournament }) => {
    const days = useMemo(() => {
        const out = new Map<string, Match[]>();
        [...list].sort((a, b) => String(whenOf(a) || '9').localeCompare(String(whenOf(b) || '9'))).forEach(m => {
            const k = whenOf(m) ? new Date(whenOf(m)).toDateString() : 'tbc';
            out.set(k, [...(out.get(k) || []), m]);
        });
        return [...out.entries()];
    }, [list]);
    if (!list.length) return <div className="fx-empty"><b>No matches yet</b>The order of play appears here once it's drawn.</div>;
    return (
        <>
            {days.map(([k, ms]) => (
                <div key={k} style={{ marginBottom: 22 }}>
                    <h3 className="pt-day">{k === 'tbc' ? 'Time to be confirmed' : new Date(k).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
                    <div className="fx-matches">{ms.map(m => <MatchRow key={m.id} m={m} t={t} teams={t.teams || []} />)}</div>
                </div>
            ))}
        </>
    );
};

export default PadelTournamentPage;
