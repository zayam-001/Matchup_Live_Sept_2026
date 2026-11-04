import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpDown, CalendarDays, ChevronDown, ChevronRight, Loader2, Medal, RotateCcw, Search, SlidersHorizontal, Trophy, Users, X } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import { useGlobalRankings } from '../hooks/useGlobalRankings';
import { STAGE_LABELS, STAGE_WEIGHT, tournamentTierLabel, type KnockoutStage } from '../lib/pointsSystems';
import { countsForRankings, type RankedPlayer } from '../lib/globalLeaderboard';
import './player/player.css';

const TIERS = ['Platinum', 'Gold', 'Silver', 'Bronze', 'Local'];
const PAGE = 20;
type SortKey = 'points' | 'wins' | 'winRate' | 'events';

const winRate = (p: RankedPlayer) => (p.matchesPlayed ? p.wins / p.matchesPlayed : 0);

const bestFinish = (p: RankedPlayer) => {
    const stages = p.results.map(r => r.stage).filter(Boolean) as KnockoutStage[];
    if (!stages.length) return '';
    return STAGE_LABELS[stages.sort((a, b) => (STAGE_WEIGHT[b] || 0) - (STAGE_WEIGHT[a] || 0))[0]] || '';
};

/** The same player, counting only the results that pass the current filters. */
const applyFilters = (rows: RankedPlayer[], tier: string, tournamentId: string, division: string): RankedPlayer[] => {
    if (!tier && !tournamentId && !division) return rows;
    const out: RankedPlayer[] = [];
    rows.forEach(r => {
        const results = r.results.filter(x => (!tier || x.tier === tier) && (!tournamentId || x.tournamentId === tournamentId) && (!division || x.division === division));
        if (!results.length) return;
        const wins = results.reduce((n, x) => n + x.wins, 0);
        const losses = results.reduce((n, x) => n + x.losses, 0);
        const tierCounts: Record<string, number> = {};
        results.forEach(x => { tierCounts[x.tier] = (tierCounts[x.tier] || 0) + 1; });
        out.push({
            ...r, results, wins, losses, tierCounts,
            points: results.reduce((n, x) => n + x.points, 0),
            matchesPlayed: wins + losses,
            tournaments: new Set(results.map(x => x.tournamentId)).size,
        });
    });
    return out;
};

const STAGE_CODE: Record<string, string> = { CHAMPION: 'WIN', RUNNER_UP: 'FIN', SEMI_FINALIST: 'SF', QUARTER_FINALIST: 'QF', ROUND_OF_16: 'R16', ROUND_OF_32: 'R32', ROUND_OF_64: 'R64' };
const topStage = (p: RankedPlayer) => p.results.map(r => r.stage || '').sort((a, b) => (STAGE_WEIGHT[b as KnockoutStage] || 0) - (STAGE_WEIGHT[a as KnockoutStage] || 0))[0] || '';

/** A drawer section that opens and closes, with a one-line summary when closed. */
const Fold: React.FC<{ title: string; summary: React.ReactNode; children: React.ReactNode }> = ({ title, summary, children }) => {
    const [open, setOpen] = useState(false);
    return (
        <section className={`lb-pc__section lb-fold ${open ? 'is-open' : ''}`}>
            <button type="button" className="lb-fold__head" aria-expanded={open} onClick={() => setOpen(o => !o)}>
                <h3>{title}</h3>
                <span className="lb-fold__sum">{summary}</span>
                <ChevronDown size={18} className="lb-fold__chev" />
            </button>
            <div className="lb-fold__body"><div><div className="lb-fold__inner">{children}</div></div></div>
        </section>
    );
};

/** FIFA-style player card with season stats and tournament history. */
const PlayerDrawer: React.FC<{ player: RankedPlayer; onClose: () => void }> = ({ player, onClose }) => {
    const card = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
    }, [onClose]);

    const count = (stage: string) => player.results.filter(r => r.stage === stage).length;
    const titles = count('CHAMPION');
    const rate = Math.round(winRate(player) * 100);
    const divCounts: Record<string, number> = {};
    player.results.forEach(r => { divCounts[r.division] = (divCounts[r.division] || 0) + 1; });
    const division = Object.entries(divCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Men';
    const stage = topStage(player);
    const parts = player.name.trim().split(/\s+/);
    const last = parts.length > 1 ? parts.pop()! : parts[0];
    const first = parts.length && last !== parts[0] ? parts.join(' ') : '';
    const variant = player.rank === 1 ? 'is-legend' : player.rank <= 10 ? 'is-elite' : 'is-standard';
    const history = [...player.results].sort((a, b) => b.points - a.points || (STAGE_WEIGHT[b.stage as KnockoutStage] || 0) - (STAGE_WEIGHT[a.stage as KnockoutStage] || 0));

    // Card follows the pointer a little, like a held trading card.
    const tilt = (e: React.PointerEvent) => {
        const el = card.current; if (!el || e.pointerType !== 'mouse') return;
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.style.setProperty('--rx', `${(0.5 - y) * 14}deg`);
        el.style.setProperty('--ry', `${(x - 0.5) * 16}deg`);
        el.style.setProperty('--mx', `${x * 100}%`);
        el.style.setProperty('--my', `${y * 100}%`);
    };
    const untilt = () => { const el = card.current; if (!el) return; ['--rx', '--ry'].forEach(k => el.style.setProperty(k, '0deg')); el.style.setProperty('--mx', '50%'); el.style.setProperty('--my', '30%'); };

    const attrs: [string, string | number][] = [
        ['PTS', player.points], ['WON', player.wins],
        ['WIN', player.matchesPlayed ? `${rate}%` : '-'], ['MAT', player.matchesPlayed],
        ['EVT', player.tournaments], ['TTL', titles],
    ];

    return createPortal(
        <div className="pp pp-drawer" role="dialog" aria-modal="true" aria-label={`${player.name} player card`}>
            <button type="button" className="pp-drawer__scrim" aria-label="Close" onClick={onClose} />
            <aside className="pp-drawer__panel lb-pc">
                <div className="lb-pc__bar">
                    <span>Player card</span>
                    <button type="button" className="pp-drawer__x" aria-label="Close" onClick={onClose}><X size={18} /></button>
                </div>

                <div className="lb-pc__stage">
                    <div ref={card} className={`lb-card ${variant}`} onPointerMove={tilt} onPointerLeave={untilt}>
                        <span className="lb-card__shine" aria-hidden="true" />
                        <div className="lb-card__top">
                            <div className="lb-card__rating">
                                <strong>{player.points}</strong>
                                <span>PTS</span>
                                <em>{STAGE_CODE[stage] || 'GRP'}</em>
                            </div>
                            <Avatar src={player.photoUrl} fallback={player.name} size="xl" className="lb-card__photo" />
                        </div>
                        <div className="lb-card__name">
                            {first && <small>{first}</small>}
                            <b>{last}</b>
                        </div>
                        <dl className="lb-card__attrs">
                            {attrs.map(([k, v]) => <div key={k}><dd>{v}</dd><dt>{k}</dt></div>)}
                        </dl>
                        <div className="lb-card__foot">
                            <span>#{player.rank}</span>
                            <i aria-hidden="true" />
                            <span>{division}</span>
                        </div>
                    </div>
                </div>

                <Fold title="Season stats" summary={player.matchesPlayed ? <>{rate}%<i />{player.wins}-{player.losses}</> : 'No matches'}>
                    <div className="lb-pc__season">
                        <div className="lb-pc__ring" style={{ '--p': rate } as React.CSSProperties} role="img" aria-label={`Win rate ${rate}%`}>
                            <strong>{player.matchesPlayed ? `${rate}%` : '-'}</strong>
                            <span>Win rate</span>
                        </div>
                        <dl className="lb-pc__nums">
                            <div><dt>Matches</dt><dd>{player.matchesPlayed}</dd></div>
                            <div className="is-win"><dt>Won</dt><dd>{player.wins}</dd></div>
                            <div className="is-loss"><dt>Lost</dt><dd>{player.losses}</dd></div>
                            <div><dt>Events</dt><dd>{player.tournaments}</dd></div>
                        </dl>
                    </div>
                </Fold>

                <Fold title="Best finishes" summary={<>{titles ? `${titles} ${titles === 1 ? 'title' : 'titles'}` : bestFinish(player) || 'Group stage'}</>}>
                    <div className="lb-pc__finishes">
                        {(['CHAMPION', 'RUNNER_UP', 'SEMI_FINALIST', 'QUARTER_FINALIST'] as const).map(st => (
                            <div key={st} className={count(st) ? '' : 'is-none'}>
                                <span className={`lb-pc__badge is-${st.toLowerCase()}`}>{STAGE_CODE[st]}</span>
                                <b>{count(st)}</b>
                                <small>{STAGE_LABELS[st]}</small>
                            </div>
                        ))}
                    </div>
                </Fold>

                <Fold title="Tournament history" summary={<>{player.results.length} {player.results.length === 1 ? 'entry' : 'entries'}</>}>
                    <ul className="lb-pc__log">
                        {history.map((r, i) => (
                            <li key={`${r.tournamentId}-${i}`} className={`is-${(r.stage || 'group').toLowerCase()}`} style={{ animationDelay: `${0.05 * i + 0.25}s` }}>
                                <span className={`lb-pc__badge is-${(r.stage || 'group').toLowerCase()}`}>{STAGE_CODE[r.stage || ''] || 'GRP'}</span>
                                <span className="lb-pc__event">
                                    <b>{r.tournamentName}</b>
                                    <small>{[r.category, r.tier].filter(Boolean).join(' · ')}</small>
                                </span>
                                <span className="lb-pc__wlmini"><b>{r.wins}-{r.losses}</b><small>W-L</small></span>
                                <span className="lb-pc__pts"><b>+{r.points}</b><small>pts</small></span>
                            </li>
                        ))}
                    </ul>
                </Fold>
            </aside>
        </div>,
        document.body,
    );
};

const DIVISIONS = ['', 'Men', 'Women', 'Kids'];

/** Counts up to `value` (from the last value shown) whenever it changes. */
const CountUp: React.FC<{ value: number }> = ({ value }) => {
    const [n, setN] = useState(0);
    const from = useRef(0);
    useEffect(() => {
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { from.current = value; setN(value); return; }
        const start = from.current, t0 = performance.now();
        let raf = 0;
        const tick = (t: number) => {
            const p = Math.min(1, (t - t0) / 900);
            const next = Math.round(start + (value - start) * (1 - Math.pow(1 - p, 3)));
            from.current = next; setN(next);
            if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [value]);
    return <>{n.toLocaleString()}</>;
};

/** Public Match Up leaderboard. */
export const GlobalLeaderboard: React.FC = () => {
    const { rankings, tournaments, loading } = useGlobalRankings();
    const [q, setQ] = useState('');
    const [tier, setTier] = useState('');
    const [division, setDivision] = useState('');
    const [tournamentId, setTournamentId] = useState('');
    const [sort, setSort] = useState<SortKey>('points');
    const [shown, setShown] = useState(PAGE);
    const [selected, setSelected] = useState<RankedPlayer | null>(null);
    const [moreOpen, setMoreOpen] = useState(false);

    const events = useMemo(() => tournaments.filter(countsForRankings)
        .filter(t => !tier || tournamentTierLabel(t) === tier)
        .sort((a, b) => String(b.startDate || '').localeCompare(String(a.startDate || ''))), [tournaments, tier]);

    useEffect(() => { if (tournamentId && !events.some(t => t.id === tournamentId)) setTournamentId(''); }, [events, tournamentId]);
    useEffect(() => { setShown(PAGE); }, [q, tier, division, tournamentId, sort]);

    // Rank by the chosen sort across the filtered results, then search within that.
    const ranked = useMemo(() => {
        const rows = [...applyFilters(rankings, tier, tournamentId, division)];
        const tie = (a: RankedPlayer, b: RankedPlayer) => b.points - a.points || b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name);
        rows.sort((a, b) => {
            if ((a.points > 0) !== (b.points > 0)) return a.points > 0 ? -1 : 1;
            if (sort === 'wins') return b.wins - a.wins || tie(a, b);
            if (sort === 'winRate') return winRate(b) - winRate(a) || b.matchesPlayed - a.matchesPlayed || tie(a, b);
            if (sort === 'events') return b.tournaments - a.tournaments || tie(a, b);
            return tie(a, b);
        });
        return rows.map((r, i) => ({ ...r, rank: i + 1 }));
    }, [rankings, tier, division, tournamentId, sort]);

    const rows = useMemo(() => {
        const n = q.trim().toLowerCase();
        return n ? ranked.filter(r => r.name.toLowerCase().includes(n)) : ranked;
    }, [ranked, q]);

    // Bars are drawn against the leader in the current view.
    const topPoints = useMemo(() => Math.max(0, ...ranked.map(r => r.points)), [ranked]);
    const filtered = !!(tier || division || tournamentId || q.trim());
    const activeCount = [tier, tournamentId, sort !== 'points'].filter(Boolean).length;
    const clear = () => { setQ(''); setTier(''); setDivision(''); setTournamentId(''); setSort('points'); };

    return (
        <div className="pp lb">
            <header className="lb-top">
                <div className="lb-top__title">
                    <h1>Player <em>Leaderboard</em></h1>
                </div>
                {!loading && (
                    <dl className="lb-stats">
                        <div><Users size={18} /><dt>Players</dt><dd><CountUp value={ranked.length} /></dd></div>
                        <div><Medal size={18} /><dt>With points</dt><dd><CountUp value={ranked.filter(r => r.points > 0).length} /></dd></div>
                        <div><CalendarDays size={18} /><dt>Tournaments</dt><dd><CountUp value={tournamentId ? 1 : events.length} /></dd></div>
                    </dl>
                )}
            </header>
            <div className="lb-main">
            {loading ? (
                <div className="pp-empty"><Loader2 className="animate-spin" size={22} /></div>
            ) : (
                <>
                    <div className="lb-filters">
                        <div className="lb-filters__top">
                            <div className="lb-seg" role="group" aria-label="Division" style={{ '--i': DIVISIONS.indexOf(division) } as React.CSSProperties}>
                                <span className="lb-seg__thumb" aria-hidden="true" />
                                {DIVISIONS.map(d => (
                                    <button key={d || 'all'} type="button" aria-pressed={division === d} className={division === d ? 'is-on' : ''} onClick={() => setDivision(d)}>{d || 'All'}</button>
                                ))}
                            </div>
                            <div className="lb-filters__find">
                                <label className="lb-search">
                                    <Search size={17} />
                                    <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search a player" aria-label="Search players" />
                                    {q && <button type="button" onClick={() => setQ('')} aria-label="Clear search"><X size={15} /></button>}
                                </label>
                                <button type="button" className={`lb-toggle ${moreOpen ? 'is-open' : ''}`} aria-expanded={moreOpen} aria-controls="lb-more" onClick={() => setMoreOpen(o => !o)}>
                                    <SlidersHorizontal size={16} />
                                    <span>Filters</span>
                                    {activeCount > 0 && <b>{activeCount}</b>}
                                    <ChevronDown size={15} className="lb-toggle__chev" />
                                </button>
                            </div>
                        </div>
                        <div id="lb-more" className={`lb-filters__more ${moreOpen ? 'is-open' : ''}`}>
                            <div>
                                <div className="lb-filters__bottom">
                                    <div className="lb-cats" role="group" aria-label="Category">
                                        {['', ...TIERS].map(t => (
                                            <button key={t || 'all'} type="button" aria-pressed={tier === t} className={`lb-cat ${tier === t ? 'is-on' : ''}`} data-tier={t || 'all'} onClick={() => setTier(t)}>
                                                {t && <i aria-hidden="true" />}{t || 'All categories'}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="lb-picks">
                                        <label className="lb-pick lb-pick--wide">
                                            <CalendarDays size={15} />
                                            <select value={tournamentId} onChange={e => setTournamentId(e.target.value)} aria-label="Tournament">
                                                <option value="">All tournaments</option>
                                                {events.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                            </select>
                                            <ChevronDown size={14} />
                                        </label>
                                        <label className="lb-pick">
                                            <ArrowUpDown size={15} />
                                            <select value={sort} onChange={e => setSort(e.target.value as SortKey)} aria-label="Sort by">
                                                <option value="points">Points</option>
                                                <option value="wins">Wins</option>
                                                <option value="winRate">Win rate</option>
                                                <option value="events">Events played</option>
                                            </select>
                                            <ChevronDown size={14} />
                                        </label>
                                        {(filtered || sort !== 'points') && <button type="button" className="lb-reset" onClick={clear}><RotateCcw size={14} /> Reset</button>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="lb-board">
                        <div className="lb-head" aria-hidden="true">
                            <span>Rank</span><span>Player</span><span className="lb-head__stats">Stats</span><span className="lb-head__pts">Points</span>
                        </div>
                        <ol className="lb-list">
                            {rows.slice(0, shown).map(r => {
                                const parts = r.name.trim().split(/\s+/);
                                const last = parts.length > 1 ? parts.pop() : '';
                                return (
                                    <li key={r.key}>
                                        <button type="button" className={`lb-row ${r.rank === 1 ? 'is-first' : r.rank <= 3 ? 'is-podium' : ''} ${r.points === 0 ? 'is-zero' : ''}`} onClick={() => setSelected(r)} aria-label={`${r.name}, rank ${r.rank}, ${r.points} points. View results`}>
                                            <span className="lb-row__fill" style={{ width: `${topPoints ? (r.points / topPoints) * 100 : 0}%` }} aria-hidden="true" />
                                            <span className="lb-row__rank">{r.rank === 1 ? <Trophy size={20} /> : null}{r.rank}</span>
                                            <Avatar src={r.photoUrl} fallback={r.name} size="md" className="lb-row__avatar" />
                                            <span className="lb-row__name">
                                                {last ? <><small>{parts.join(' ')}</small><b>{last}</b></> : <b>{parts[0]}</b>}
                                            </span>
                                            <span className="lb-row__stats">
                                                <span><i>Won</i>{r.wins}</span>
                                                <span><i>Lost</i>{r.losses}</span>
                                                <span><i>Win %</i>{r.matchesPlayed ? Math.round(winRate(r) * 100) : '-'}</span>
                                                <span><i>Events</i>{r.tournaments}</span>
                                                <span className="lb-row__best"><i>Best</i>{bestFinish(r) || 'Group stage'}</span>
                                            </span>
                                            <span className="lb-row__score">{r.points}</span>
                                            <ChevronRight size={20} className="lb-row__go" aria-hidden="true" />
                                        </button>
                                    </li>
                                );
                            })}
                        </ol>
                        {rows.length === 0 && (
                            <div className="pp-empty">
                                No players match these filters.
                                {filtered && <button type="button" className="pp-btn pp-btn--ghost mt-3" onClick={clear}>Clear filters</button>}
                            </div>
                        )}
                    </div>
                    {rows.length > shown && (
                        <div className="pp-more">
                            <span className="pp-muted">Showing {shown} of {rows.length.toLocaleString()}</span>
                            <button type="button" className="pp-btn pp-btn--ghost" onClick={() => setShown(n => n + PAGE)}>Show more</button>
                        </div>
                    )}

                </>
            )}
            </div>
            {selected && <PlayerDrawer player={selected} onClose={() => setSelected(null)} />}
        </div>
    );
};
