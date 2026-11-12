import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, MapPin, Share2 } from 'lucide-react';
import { tierLabel } from '../../lib/pointsSystems';
import { computeStandings, hasKnockoutStage, isKnockout, playerStats } from '../engine';
import { TIEBREAKER_LABELS } from '../presets';
import type { FutsalCategory, FutsalMatch, FutsalTeam } from '../types';
import { Ball, Crest, dateRange, Empty, Loading, MatchList, MatchRow, playerName, Shell, Star, Trophy, useFutsalTournament, useNow, useToast } from './shared';
import { Bracket, CategoryStandings, Squads, StatsView } from './views';
import { publicPath } from '../sport';

const TABS = [
    { id: 'overview', label: 'Overview' }, { id: 'matches', label: 'Matches' }, { id: 'standings', label: 'Standings' },
    { id: 'bracket', label: 'Bracket' }, { id: 'leaderboard', label: 'Leaderboard' }, { id: 'stats', label: 'Stats' }, { id: 'teams', label: 'Teams' },
] as const;
type Tab = typeof TABS[number]['id'];

export const TournamentPage: React.FC<{ id: string; tab?: string }> = ({ id, tab: tabProp }) => {
    const { t, teams, matches, loading } = useFutsalTournament(id);
    const tab: Tab = (TABS.find(x => x.id === tabProp)?.id || 'overview');
    const [catId, setCatId] = useState<string>(() => { try { return sessionStorage.getItem(`fx-cat-${id}`) || ''; } catch { return ''; } });
    const now = useNow(1000, matches.some(m => m.status === 'LIVE'));
    const { toast, node } = useToast();
    const cat = t?.categories.find(c => c.id === catId) || t?.categories[0];
    useEffect(() => { try { if (cat) sessionStorage.setItem(`fx-cat-${id}`, cat.id); } catch { /* ignore */ } }, [cat, id]);
    useEffect(() => { if (t) document.title = `${t.name} | Match Up Futsal`; }, [t]);

    const catMatches = useMemo(() => (cat ? matches.filter(m => m.categoryId === cat.id) : []), [matches, cat]);
    const [pitch, setPitch] = useState('');

    if (loading) return <Shell><div className="fx-wrap"><Loading /></div></Shell>;
    if (!t || !cat) return <Shell><div className="fx-wrap"><Empty title="Competition not found">It may have been removed.</Empty></div></Shell>;

    const share = async () => {
        const url = `${window.location.origin}/#${publicPath(t)}`;
        try {
            if (navigator.share) await navigator.share({ title: t.name, url });
            else { await navigator.clipboard.writeText(url); toast('Link copied'); }
        } catch { /* cancelled */ }
    };
    const go = (next: Tab) => { window.location.hash = `${publicPath(t)}${next === 'overview' ? '' : `/${next}`}`; };
    const live = catMatches.filter(m => m.status === 'LIVE');
    const upcoming = catMatches.filter(m => m.status === 'SCHEDULED' && m.startAt).sort((a, b) => a.startAt!.localeCompare(b.startAt!)).slice(0, 4);
    const recent = catMatches.filter(m => m.status === 'COMPLETED').sort((a, b) => String(b.startAt).localeCompare(String(a.startAt))).slice(0, 4);
    const final = catMatches.find(m => m.stage === 'F' && m.status === 'COMPLETED');
    const champion = final ? teams.find(x => x.id === final.winnerId) : undefined;
    const accepted = teams.filter(x => x.categoryId === cat.id && x.status === 'ACCEPTED');
    const hasKo = catMatches.some(m => isKnockout(m.stage));
    const visibleTabs = TABS.filter(x => x.id !== 'leaderboard' && (x.id !== 'bracket' || hasKo || hasKnockoutStage(cat.format)) && (x.id !== 'standings' || cat.format !== 'KNOCKOUT'));

    return (
        <Shell tour={t} active={tab === 'leaderboard' ? 'leaderboard' : 'details'}>
            <div className="fx-wrap">
                <header className="fx-thead fx-thead--compact">
                    <div className="fx-thead__row">
                        <div>
                            <span className="fx-eyebrow"><Star /> {tierLabel(t.tier)} · {t.city}</span>
                            <h1 className="fx-silver fx-thead__title">{t.name}</h1>
                            <div className="fx-thead__meta">
                                <span className="fx-pill"><CalendarDays size={13} />{dateRange(t)}</span>
                                <span className="fx-pill"><MapPin size={13} />{t.venue}</span>
                                {live.length > 0 && <span className="fx-pill fx-pill--live">{live.length} live</span>}
                                {t.status === 'COMPLETED' && <span className="fx-pill">Finished</span>}
                            </div>
                        </div>
                        <div className="fx-row">
                            {t.status === 'REGISTRATION' && <a className="fx-btn fx-btn--primary" href={`#${publicPath(t)}/register`}>Register a team</a>}
                            <button type="button" className="fx-btn" onClick={share}><Share2 />Share</button>
                        </div>
                    </div>
                    {t.categories.length > 1 && (
                        <div className="fx-chips" style={{ marginTop: 18 }} role="group" aria-label="Category">
                            {t.categories.map(c => <button key={c.id} type="button" className={`fx-chip ${c.id === cat.id ? 'is-on' : ''}`} aria-pressed={c.id === cat.id} onClick={() => setCatId(c.id)}>{c.name}</button>)}
                        </div>
                    )}
                </header>

                <div className="fx-sticky-tabs">
                    <nav className="fx-tabs" aria-label="Sections">
                        {visibleTabs.map(x => <button key={x.id} type="button" className={tab === x.id ? 'is-on' : ''} aria-current={tab === x.id ? 'page' : undefined} onClick={() => go(x.id)}>{x.label}</button>)}
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
                                            <span className="fx-eyebrow" style={{ color: 'var(--fx-gold)' }}>{cat.name} champions</span>
                                            <h2 className="fx-silver" style={{ fontSize: 'clamp(28px,5vw,44px)', marginTop: 6 }}>{champion.name}</h2>
                                        </div>
                                        <Crest team={champion} size={64} />
                                    </div>
                                </section>
                            )}
                            {live.length > 0 && (
                                <section className="fx-section">
                                    <div className="fx-section__head"><h2>Live</h2></div>
                                    <div className="fx-matches">{live.map(m => <MatchRow key={m.id} m={m} t={t} teams={teams} matches={matches} now={now} />)}</div>
                                </section>
                            )}
                            <div className="fx-grid2" style={{ alignItems: 'start' }}>
                                <section className="fx-section" style={{ marginTop: live.length ? 0 : 34 }}>
                                    <div className="fx-section__head"><h2>Up next</h2><button type="button" className="fx-link" onClick={() => go('matches')}>All fixtures →</button></div>
                                    {upcoming.length ? <div className="fx-matches">{upcoming.map(m => <MatchRow key={m.id} m={m} t={t} teams={teams} matches={matches} now={now} />)}</div> : <Empty title="Nothing scheduled">Check back when fixtures are out.</Empty>}
                                    {recent.length > 0 && (
                                        <>
                                            <div className="fx-section__head" style={{ marginTop: 26 }}><h2>Results</h2></div>
                                            <div className="fx-matches">{recent.map(m => <MatchRow key={m.id} m={m} t={t} teams={teams} matches={matches} now={now} />)}</div>
                                        </>
                                    )}
                                </section>
                                <section className="fx-section" style={{ marginTop: live.length ? 0 : 34 }}>
                                    <TopScorers teams={accepted} matches={catMatches} />
                                </section>
                            </div>
                        </>
                    )}

                    {tab === 'matches' && (
                        <section className="fx-section" style={{ marginTop: 14 }}>
                            {t.pitches.length > 1 && (
                                <div className="fx-chips" role="group" aria-label="Pitch">
                                    <button type="button" className={`fx-chip ${!pitch ? 'is-on' : ''}`} onClick={() => setPitch('')}>All pitches</button>
                                    {t.pitches.map(p => <button key={p} type="button" className={`fx-chip ${pitch === p ? 'is-on' : ''}`} onClick={() => setPitch(p)}>{p}</button>)}
                                </div>
                            )}
                            <MatchList list={catMatches.filter(m => !pitch || m.pitch === pitch)} t={t} teams={teams} matches={matches} now={now} />
                        </section>
                    )}
                    {tab === 'standings' && <section className="fx-section" style={{ marginTop: 14 }}><CategoryStandings cat={cat} teams={teams} matches={matches} /><p className="fx-legend"><button type="button" className="fx-link" onClick={() => window.print()}>Print / save as PDF</button><span><i />Qualifies</span><span>Level on points: {cat.rules.tiebreakers.slice(0, 2).map(x => TIEBREAKER_LABELS[x].toLowerCase()).join(', then ')}…</span></p></section>}
                    {tab === 'bracket' && <section className="fx-section" style={{ marginTop: 14 }}><Bracket t={t} cat={cat} teams={teams} matches={matches} /></section>}
                    {tab === 'leaderboard' && <section className="fx-section" style={{ marginTop: 14 }}><TournamentLeaderboard teams={accepted} matches={catMatches} cat={cat} /></section>}
                    {tab === 'stats' && <section className="fx-section" style={{ marginTop: 14 }}><StatsView t={t} cat={cat} teams={teams} matches={matches} /></section>}
                    {tab === 'teams' && <section className="fx-section" style={{ marginTop: 14 }}><Squads teams={teams} cat={cat} matches={matches} /></section>}
                </main>
            </div>
            {node}
        </Shell>
    );
};

const TopScorers: React.FC<{ teams: ReturnType<typeof useFutsalTournament>['teams']; matches: FutsalMatch[] }> = ({ teams, matches }) => {
    const rows = useMemo(() => [...playerStats(teams, matches).values()].filter(l => l.goals > 0).sort((a, b) => b.goals - a.goals || b.assists - a.assists).slice(0, 5), [teams, matches]);
    if (!rows.length) return null;
    return (
        <div className="fx-card fx-leader" style={{ marginTop: 16 }}>
            <h3><Ball />Top scorers</h3>
            {rows.map((l, i) => (
                <div key={l.playerId} className={`fx-lrow ${i === 0 ? 'is-top' : ''}`}>
                    <span>{i + 1}</span>
                    <span className="fx-lrow__who"><b>{playerName(teams, l.playerId)}</b><small>{teams.find(t => t.id === l.teamId)?.name}</small></span>
                    <b>{l.goals}</b>
                </div>
            ))}
        </div>
    );
};

/**
 * This tournament's leaderboard only: players by goals, then assists, player of the match and rating;
 * teams by points from every match they've played here.
 */
const TournamentLeaderboard: React.FC<{ teams: FutsalTeam[]; matches: FutsalMatch[]; cat: FutsalCategory }> = ({ teams, matches, cat }) => {
    const [kind, setKind] = useState<'players' | 'teams'>('players');
    const players = useMemo(() => [...playerStats(teams, matches).values()].filter(l => l.apps > 0)
        .sort((a, b) => b.goals - a.goals || b.assists - a.assists || b.motm - a.motm || (b.ratedMatches ? b.rating : 0) - (a.ratedMatches ? a.rating : 0)), [teams, matches]);
    const table = useMemo(() => computeStandings(teams.map(t => t.id), matches, cat.rules, { includeLive: true }), [teams, matches, cat]);
    const name = (id: string) => teams.find(t => t.id === id);
    return (
        <div className="fx-card fx-lb">
            <div className="fx-lb__head">
                <div className="fx-tabs fx-tabs--sm">
                    <button type="button" className={kind === 'players' ? 'is-on' : ''} onClick={() => setKind('players')}>Players</button>
                    <button type="button" className={kind === 'teams' ? 'is-on' : ''} onClick={() => setKind('teams')}>Teams</button>
                </div>
                <small className="fx-muted">{cat.name} · this tournament only</small>
            </div>
            <div className="fx-lb__scroll">
                {kind === 'players' ? (
                    players.length ? (
                        <table className="fx-lb__table">
                            <thead><tr><th>#</th><th>Player</th><th>P</th><th>G</th><th>A</th><th title="Player of the match">POTM</th><th>Rtg</th></tr></thead>
                            <tbody>{players.map((l, i) => (
                                <tr key={l.playerId} className={i < 3 ? `is-top is-${i + 1}` : ''}><td>{i + 1}</td><td><b>{playerName(teams, l.playerId)}</b><small>{name(l.teamId)?.name}</small></td><td>{l.apps}</td><td><b>{l.goals}</b></td><td>{l.assists}</td><td>{l.motm}</td><td>{l.ratedMatches ? l.rating.toFixed(1) : '–'}</td></tr>
                            ))}</tbody>
                        </table>
                    ) : <Empty title="No numbers yet">The leaderboard fills in as matches are played.</Empty>
                ) : (
                    <table className="fx-lb__table">
                        <thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
                        <tbody>{table.map((r, i) => (
                            <tr key={r.teamId} className={i < 3 ? `is-top is-${i + 1}` : ''}><td>{i + 1}</td><td><span className="fx-lb__team"><Crest team={name(r.teamId)} size={26} /><b>{name(r.teamId)?.name}</b></span></td><td>{r.p}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td><td>{r.gd > 0 ? `+${r.gd}` : r.gd}</td><td><b>{r.pts}</b></td></tr>
                        ))}</tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
