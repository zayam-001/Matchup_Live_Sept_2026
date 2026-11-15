// Futsal inside spectator mode. Same frame as padel's TournamentDetail (hero, stats,
// category selector, bottom dock) so both sports read as one product; only the
// match content is futsal: goals, clock, fouls, W/D/L tables.
import { isTournamentFinished } from '../../lib/lifecycle';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { Activity, ArrowUpRight, Award, Calendar, GitBranch, History, Layers, MapPin, Play, Share2, Timer, Trophy, Tv, Users } from 'lucide-react';
import '../../components/spectator.css';
import '../futsal.css';
import { Bracket } from './views';
import { CategorySelector } from '../../components/ui/CategorySelector';
import { computeStandings, hasKnockoutStage, isLeagueFormat, leagueQualifiers, eventMinute, foulsFor, isKnockout, playerStats, scoreOf, shortHanded, fmtClock, sourceLabel } from '../engine';
import { FORMAT_LABELS, goalTypeLabel, PRESETS } from '../presets';
import type { FutsalCategory, FutsalMatch, FutsalTeam, FutsalTournament } from '../types';
import { NEUTRAL, SIDE_LINE } from './palette';
import { clockText, playerName, stageText, useFutsalTournament, useNow } from './shared';
import { publicPath, sportLabel } from '../sport';

const FutsalBroadcast = React.lazy(() => import('./FutsalBroadcast'));

type Tab = 'live' | 'schedule' | 'results' | 'standings' | 'bracket' | 'timeline';

const fmtFull = (iso?: string) => (iso ? new Date(iso).toLocaleString([], { year: '2-digit', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'TBA');
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBA');
const fmtTime = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');

const nameOf = (teams: FutsalTeam[], matches: FutsalMatch[], m: FutsalMatch, side: 'home' | 'away') => {
    const id = side === 'home' ? m.homeId : m.awayId;
    const t = teams.find(x => x.id === id);
    if (t) return t.name;
    const label = sourceLabel(side === 'home' ? m.homeFrom : m.awayFrom, matches);
    return label.split(' · ')[1] || label;
};

const Empty: React.FC<{ icon: React.ReactNode; title: string; sub?: string }> = ({ icon, title, sub }) => (
    <div className="py-20 flex flex-col items-center justify-center text-center">
        <span className="text-[#9CA3AF] mb-4">{icon}</span>
        <p className="text-white text-xl font-black italic tracking-[0.15em] uppercase">{title}</p>
        {sub && <p className="text-[#9CA3AF] text-sm uppercase tracking-widest font-bold mt-2">{sub}</p>}
    </div>
);

export const FutsalSpectatorDetail: React.FC<{ tournamentId: string; onBack: () => void; searchQuery?: string }> = ({ tournamentId, searchQuery }) => {
    const { t, teams, matches, loading } = useFutsalTournament(tournamentId);
    const [activeTab, setActiveTab] = useState<Tab>('live');
    const [catId, setCatId] = useState<string | null>(null);
    const now = useNow(1000, matches.some(m => m.status === 'LIVE'));
    const tabsRef = useRef<HTMLDivElement>(null);
    const pillRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const heroRef = useRef<HTMLDivElement>(null);
    const [copied, setCopied] = useState(false);
    const [broadcast, setBroadcast] = useState(false);

    useEffect(() => { if (t && !catId) setCatId(t.categories[0]?.id || null); }, [t, catId]);
    useEffect(() => {
        const place = () => {
            const btn = tabsRef.current?.querySelector(`[data-tab="${activeTab}"]`) as HTMLElement | null;
            if (!btn || !pillRef.current) return;
            // First placement snaps; later tab changes slide.
            const to = { x: btn.offsetLeft, width: btn.offsetWidth };
            if (!pillRef.current.offsetWidth) gsap.set(pillRef.current, to);
            else gsap.to(pillRef.current, { ...to, duration: 0.35, ease: 'power3.out', overwrite: 'auto' });
        };
        place();
        // The dock's labels settle after fonts load and the live badge appears.
        const id = window.setTimeout(place, 400);
        window.addEventListener('resize', place);
        return () => { window.clearTimeout(id); window.removeEventListener('resize', place); };
    }, [activeTab, loading]);
    useEffect(() => {
        const el = heroRef.current;
        if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        let raf = 0;
        const onScroll = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => el.style.setProperty('--spx-par', `${Math.max(-60, Math.min(60, -el.getBoundingClientRect().top * 0.18))}px`));
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
    }, [loading]);

    const cat = t ? (t.categories.find(c => c.id === catId) || t.categories[0]) : undefined;
    const catTeams = useMemo(() => teams.filter(x => cat && x.categoryId === cat.id && x.status === 'ACCEPTED'), [teams, cat]);
    const catMatches = useMemo(() => {
        let list = matches.filter(m => cat && m.categoryId === cat.id);
        const q = searchQuery?.trim().toLowerCase();
        if (q) list = list.filter(m => [nameOf(teams, matches, m, 'home'), nameOf(teams, matches, m, 'away'), m.pitch || '', stageText(m)].some(s => s.toLowerCase().includes(q)));
        return list;
    }, [matches, cat, searchQuery, teams]);

    if (loading) return <div className="text-center p-10 text-gray-500">Loading...</div>;
    if (!t || !cat) return <div className="text-center p-10 text-gray-400">Tournament not found</div>;

    const live = catMatches.filter(m => m.status === 'LIVE');
    const played = catMatches.filter(m => m.status === 'COMPLETED');
    const startTs = t.startDate ? new Date(`${t.startDate}T00:00:00`).getTime() : 0;
    const finished = isTournamentFinished(t, matches);
    const heroStatus = live.length ? 'live' : finished ? 'done' : startTs > Date.now() ? 'soon' : 'on';
    const prize = 0;
    // Like padel: broadcast is for running events, off once it's over and nothing is live.
    const broadcastOff = !live.length && finished;
    const share = async () => {
        const url = window.location.href;
        try {
            if (navigator.share) await navigator.share({ title: t.name, url });
            else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); }
        } catch { /* cancelled */ }
    };
    const tabs: { id: Tab; label: string; icon: any }[] = [
        { id: 'live', label: 'Live', icon: Activity }, { id: 'schedule', label: 'Schedule', icon: Calendar },
        { id: 'results', label: 'Results', icon: Award }, { id: 'standings', label: 'Standings', icon: Trophy },
        // Knockout rounds or playoffs: the same bracket as the tournament page.
        ...(hasKnockoutStage(cat.format) || catMatches.some(m => isKnockout(m.stage)) ? [{ id: 'bracket' as Tab, label: 'Bracket', icon: GitBranch }] : []),
        { id: 'timeline', label: 'Feed', icon: History },
    ];

    return (
        <div className={`spx pb-32 pt-24 max-w-[1400px] mx-auto w-full animate-in fade-in duration-500 px-4 md:px-8 relative ${t.theme === 'crimson' ? 'spx-theme-crimson' : ''}`}>
            <section ref={heroRef} className="spx-hero">
                <div className="spx-hero__media" aria-hidden="true">
                    {t.bannerUrl ? <img src={t.bannerUrl} alt="" referrerPolicy="no-referrer" /> : <div className="spx-hero__art"><span className="spx-hero__art-court" /></div>}
                </div>
                <div className="spx-hero__shade" aria-hidden="true" />
                <div className="spx-hero__inner">
                    <div className="spx-hero__chips">
                        <span className={`spx-status spx-status--${heroStatus}`}>
                            {heroStatus === 'live' && <span className="spx-dot" />}
                            {heroStatus === 'live' ? `Live now · ${live.length} ${live.length === 1 ? 'match' : 'matches'}` : heroStatus === 'done' ? 'Tournament finished' : heroStatus === 'soon' ? `Starts ${fmtDate(`${t.startDate}T00:00:00`)}` : 'Underway'}
                        </span>
                        <span className="spx-status spx-status--on">{sportLabel(t)}</span>
                    </div>
                    <h1 className="spx-hero__title">{t.name}</h1>
                    <div className="spx-hero__meta">
                        <span><MapPin size={14} /> {t.venue || 'Global Arena'}</span>
                        <span><Calendar size={14} /> {fmtDate(`${t.startDate}T00:00:00`)}</span>
                        <span><Users size={14} /> {teams.filter(x => x.status === 'ACCEPTED').length} teams</span>
                        <span><Layers size={14} /> {PRESETS[cat.rules.preset]?.label} · {FORMAT_LABELS[cat.format]}</span>
                    </div>
                    <div className="spx-hero__actions">
                        <button type="button" className="spx-btn spx-btn--primary" onClick={broadcastOff ? undefined : () => setBroadcast(true)} disabled={broadcastOff}
                            aria-disabled={broadcastOff} title={broadcastOff ? 'Broadcast mode is off - this tournament has finished' : undefined}>
                            <Tv size={16} /> {broadcastOff ? 'Broadcast ended' : 'Broadcast mode'}
                        </button>
                        <button type="button" className="spx-btn spx-btn--ghost" onClick={() => { setActiveTab('live'); contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><Play size={16} /> {live.length ? 'Watch live' : 'View matches'}</button>
                        <a className="spx-btn spx-btn--ghost" href={`#${publicPath(t)}`} target="_blank" rel="noopener noreferrer">Open tournament page <ArrowUpRight size={16} /></a>
                        <button type="button" className="spx-btn spx-btn--icon" onClick={share} aria-label="Share tournament"><Share2 size={16} />{copied && <span className="spx-copied">Link copied</span>}</button>
                    </div>
                </div>
                <div className="spx-stats">
                    <div className="spx-stat"><span className="spx-stat__icon"><Activity size={16} /></span><strong>{live.length}</strong><small>Live now</small></div>
                    <div className="spx-stat"><span className="spx-stat__icon"><Users size={16} /></span><strong>{catTeams.length}</strong><small>Teams</small></div>
                    <div className="spx-stat"><span className="spx-stat__icon"><Layers size={16} /></span><strong>{played.length}<em>/{catMatches.length}</em></strong><small>Matches played</small></div>
                    <div className="spx-stat spx-stat--prize"><span className="spx-stat__icon"><Trophy size={16} /></span><strong>{played.reduce((n, m) => { const s = scoreOf(m); return n + s.home + s.away; }, 0) || prize}</strong><small>Goals scored</small></div>
                </div>
            </section>

            {t.categories.length > 0 && (
                <div className="max-w-7xl mx-auto px-4 mb-10 mt-6 z-20 relative">
                    <CategorySelector categories={t.categories} selectedCategoryId={cat.id} onSelectCategory={setCatId} matches={matches} />
                </div>
            )}

            <div ref={contentRef} className="max-w-7xl mx-auto px-1 sm:px-4 mb-16 spx-content-wrap">
                <div className="spx-panel" key={activeTab}>
                    <div className="p-1.5 sm:p-6 md:p-8 min-h-[500px]">
                        {activeTab === 'live' && (live.length === 0
                            ? <Empty icon={<Timer size={48} />} title="No active matches" sub="Waiting for the next kick-off..." />
                            : <div className="grid gap-4 md:grid-cols-2 animate-in fade-in duration-500">{live.map(m => <LiveMatch key={m.id} m={m} cat={cat} teams={teams} matches={matches} now={now} t={t} />)}</div>)}
                        {activeTab === 'schedule' && <Schedule list={catMatches.filter(m => m.status !== 'COMPLETED')} teams={teams} matches={matches} />}
                        {activeTab === 'results' && <Results list={played} teams={teams} matches={matches} />}
                        {activeTab === 'standings' && <Standings cat={cat} teams={teams} matches={catMatches} />}
                        {activeTab === 'bracket' && <div className={`fx fx-embed ${t.theme === 'crimson' ? 'fx--crimson' : ''}`}><Bracket t={t} cat={cat} teams={teams} matches={matches} /></div>}
                        {activeTab === 'timeline' && <Feed list={catMatches} teams={teams} matches={matches} cat={cat} />}
                    </div>
                </div>
            </div>

            {broadcast && !broadcastOff && (
                <React.Suspense fallback={null}>
                    <FutsalBroadcast t={t} teams={teams} matches={matches} onClose={() => setBroadcast(false)} />
                </React.Suspense>
            )}

            <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6 flex justify-center z-50 pointer-events-none">
                <div className="pointer-events-auto w-full max-w-[600px] mx-auto" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                    <div ref={tabsRef} className="spx-dock relative flex items-center justify-between rounded-full p-1 md:p-1.5">
                        <div ref={pillRef} className="spx-dock__pill absolute top-1 bottom-1 md:top-1.5 md:bottom-1.5 rounded-full" style={{ left: 0, width: 0 }} />
                        {tabs.map(tab => {
                            const Icon = tab.icon;
                            const on = activeTab === tab.id;
                            return (
                                <button key={tab.id} data-tab={tab.id} onClick={() => setActiveTab(tab.id)}
                                    className={`relative z-10 flex flex-col md:flex-row items-center justify-center py-2 px-3 md:py-3 md:px-4 rounded-full text-center transition-all duration-300 cursor-pointer border-none bg-transparent whitespace-nowrap overflow-visible gap-1 md:gap-2 flex-1 ${on ? 'text-white font-black' : 'text-gray-400 hover:text-white font-bold'}`}>
                                    <Icon size={16} className={`shrink-0 md:w-[18px] md:h-[18px] transition-colors ${on ? 'text-white animate-pulse' : 'text-gray-400'}`} />
                                    <div className="flex items-center justify-center">
                                        <span className={`text-[9px] md:text-xs uppercase tracking-wider md:tracking-widest font-display whitespace-nowrap ${on ? 'font-black' : 'font-bold'}`}>{tab.label}</span>
                                        {tab.id === 'live' && live.length > 0 && <span className="spx-dock__badge">{live.length}</span>}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

const LiveMatch: React.FC<{ m: FutsalMatch; cat: FutsalCategory; teams: FutsalTeam[]; matches: FutsalMatch[]; now: number; t: FutsalTournament }> = ({ m, cat, teams, matches, now }) => {
    const s = scoreOf(m);
    const shorts = shortHanded(m, cat.rules, now);
    const goals = m.events.filter(e => (e.type === 'GOAL' || e.type === 'OWN_GOAL') && !e.auto).slice(-4).reverse();
    const sideTeam = (side: 'home' | 'away') => teams.find(x => x.id === (side === 'home' ? m.homeId : m.awayId));
    return (
        <div className="bg-[#0A0A0A] rounded-2xl border border-white/5 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-[#111111] border-b border-white/10 text-[10px] font-black uppercase tracking-widest">
                <span className="flex items-center gap-2 text-[#E65C31]"><span className="w-1.5 h-1.5 rounded-full bg-[#E65C31] animate-ping" /> Live · {stageText(m)}</span>
                <span className="text-content-muted">{m.pitch || ''}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-6">
                {(['home', 'away'] as const).map((side, i) => {
                    const team = sideTeam(side);
                    const f = foulsFor(m, cat.rules, side);
                    const el = (
                        <div key={side} className={`min-w-0 ${i ? 'text-right' : ''}`}>
                            <div className={`flex items-center gap-2 ${i ? 'justify-end' : ''}`}>
                                <span className="w-2 h-8 rounded-full shrink-0" style={{ background: SIDE_LINE[side] }} />
                                <span className="text-white font-black text-sm md:text-base uppercase tracking-wide truncate">{nameOf(teams, matches, m, side)}</span>
                            </div>
                            {cat.rules.foulLimit > 0 && <div className={`mt-2 text-[10px] font-black uppercase tracking-widest ${f >= cat.rules.foulLimit ? 'text-[#E65C31]' : 'text-content-muted'}`}>Fouls {f}{f >= cat.rules.foulLimit ? ' · 10 m kick' : ''}</div>}
                            {shorts.find(x => x.side === side) && <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-red-400">Player down {fmtClock(shorts.find(x => x.side === side)!.remainingMs)}</div>}
                        </div>
                    );
                    return i === 0 ? [el, (
                        <div key="mid" className="text-center">
                            <div className="text-white font-black text-4xl md:text-5xl font-mono tracking-tight">{s.home}<span className="text-white/30 mx-1">-</span>{s.away}</div>
                            <div className="mt-2 inline-flex items-center bg-[#E65C31]/10 border border-[#E65C31]/30 text-[#E65C31] px-3 py-1 rounded-lg text-xs font-mono font-bold">{clockText(m, cat, now)}</div>
                            {s.hasPens && <div className="mt-1 text-[10px] text-content-muted font-black uppercase tracking-widest">Pens {s.pensHome}-{s.pensAway}</div>}
                        </div>
                    )] : el;
                })}
            </div>
            {goals.length > 0 && (
                <div className="px-5 pb-4 flex flex-wrap gap-2">
                    {goals.map(e => (
                        <span key={e.id} className="bg-white/5 text-gray-300 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-white/5">
                            ⚽ {eventMinute(cat.rules, e)} {playerName(teams, e.playerId) || nameOf(teams, matches, m, e.type === 'OWN_GOAL' ? (e.side === 'home' ? 'away' : 'home') : e.side)}{e.type === 'OWN_GOAL' ? ' (og)' : ''}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

const TableShell: React.FC<{ title: string; icon: React.ReactNode; count: number; head: React.ReactNode; children: React.ReactNode }> = ({ title, icon, count, head, children }) => (
    <div className="space-y-3 mb-8">
        <div className="flex items-center gap-2 px-1">
            {icon}
            <h4 className="text-sm font-black text-white uppercase tracking-widest">{title}</h4>
            <span className="text-[10px] font-bold text-content-muted bg-white/5 border border-white/5 px-2 py-0.5 rounded-full">{count} {count === 1 ? 'match' : 'matches'}</span>
        </div>
        <div className="bg-[#0A0A0A] rounded-2xl border border-white/5 overflow-hidden w-full shadow-2xl">
            <div className="overflow-x-auto w-full">
                <table className="w-full text-left font-mono min-w-[720px]">
                    <thead className="bg-[#111111] text-[10px] text-content-muted font-black uppercase tracking-widest border-b border-white/10">{head}</thead>
                    <tbody className="divide-y divide-white/5 text-xs text-white">{children}</tbody>
                </table>
            </div>
        </div>
    </div>
);

const Schedule: React.FC<{ list: FutsalMatch[]; teams: FutsalTeam[]; matches: FutsalMatch[] }> = ({ list, teams, matches }) => {
    if (!list.length) return <Empty icon={<Calendar size={48} />} title="Nothing scheduled" />;
    const sorted = [...list].sort((a, b) => String(a.startAt || '9').localeCompare(String(b.startAt || '9')) || a.matchNo - b.matchNo);
    return (
        <TableShell title="Upcoming" icon={<Calendar size={16} className="text-[#4D78FF]" />} count={sorted.length}
            head={<tr><th className="px-6 py-4">Stage / Round</th><th className="px-6 py-4">Home</th><th className="px-6 py-4 text-center">Kick-off</th><th className="px-6 py-4">Away</th><th className="px-6 py-4 text-center">Pitch</th></tr>}>
            {sorted.map(m => (
                <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4"><div className="text-white font-black text-xs uppercase tracking-wider">{stageText(m)}</div><div className="text-[9px] text-content-muted font-black uppercase tracking-widest mt-0.5">Match {m.matchNo}</div></td>
                    <td className="px-6 py-4 font-black text-sm truncate max-w-[180px]">{nameOf(teams, matches, m, 'home')}</td>
                    <td className="px-6 py-4 text-center">
                        {m.status === 'LIVE'
                            ? <span className="inline-flex items-center bg-[#E65C31]/10 border border-[#E65C31]/30 text-[#E65C31] px-3 py-1 rounded-lg text-xs font-bold">LIVE</span>
                            : <><div className="text-gray-300 text-xs font-bold">{fmtTime(m.startAt) || 'TBA'}</div><div className="text-[9px] text-content-muted mt-0.5">{m.startAt ? fmtDate(m.startAt) : ''}</div></>}
                    </td>
                    <td className="px-6 py-4 font-black text-sm truncate max-w-[180px]">{nameOf(teams, matches, m, 'away')}</td>
                    <td className="px-6 py-4 text-center"><span className="bg-white/5 text-gray-300 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-white/5">{m.pitch || 'TBA'}</span></td>
                </tr>
            ))}
        </TableShell>
    );
};

const Results: React.FC<{ list: FutsalMatch[]; teams: FutsalTeam[]; matches: FutsalMatch[] }> = ({ list, teams, matches }) => {
    if (!list.length) return <Empty icon={<Award size={48} />} title="No results yet" />;
    const sorted = [...list].sort((a, b) => String(b.startAt || '').localeCompare(String(a.startAt || '')));
    const groups = [{ title: 'Knockout', rows: sorted.filter(m => isKnockout(m.stage)) }, { title: 'Group stage', rows: sorted.filter(m => !isKnockout(m.stage)) }];
    return (
        <>
            {groups.filter(g => g.rows.length).map(g => (
                <TableShell key={g.title} title={g.title} icon={<Trophy size={16} className="text-[#E65C31]" />} count={g.rows.length}
                    head={<tr><th className="px-6 py-4">Stage / Round</th><th className="px-6 py-4">Winner</th><th className="px-6 py-4 text-center">Score</th><th className="px-6 py-4">Opponent</th><th className="px-6 py-4 text-center">Pitch</th><th className="px-6 py-4 text-right">Played</th></tr>}>
                    {g.rows.map(m => {
                        const s = scoreOf(m);
                        const draw = !m.winnerId;
                        const homeWon = m.winnerId === m.homeId;
                        const winSide = draw || homeWon ? 'home' : 'away';
                        const loseSide = winSide === 'home' ? 'away' : 'home';
                        const ws = winSide === 'home' ? s.home : s.away, ls = winSide === 'home' ? s.away : s.home;
                        const wp = winSide === 'home' ? s.pensHome : s.pensAway, lp = winSide === 'home' ? s.pensAway : s.pensHome;
                        return (
                            <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                                <td className="px-6 py-4"><div className="text-white font-black text-xs uppercase tracking-wider">{stageText(m)}</div><div className="text-[9px] text-content-muted font-black uppercase tracking-widest mt-0.5">{m.decidedBy === 'forfeit' ? 'Walkover' : m.decidedBy === 'penalties' ? 'Penalties' : m.decidedBy === 'extra_time' || m.decidedBy === 'golden_goal' ? 'After extra time' : 'Full time'}</div></td>
                                <td className="px-6 py-4"><div className="flex items-center gap-2">{!draw && <Trophy size={14} className="text-[#E65C31] fill-amber-400 shrink-0" />}<span className="font-black text-sm text-white truncate max-w-[160px]">{nameOf(teams, matches, m, winSide)}</span></div></td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-mono font-bold ${draw ? 'bg-white/5 border border-white/10 text-white' : 'bg-[#4D78FF]/10 border border-[#4D78FF]/20 text-[#4D78FF]'}`}>{ws}-{ls}{s.hasPens ? ` (${wp}-${lp} p)` : ''}</span>
                                    {draw && <div className="text-[9px] text-content-muted font-black uppercase tracking-widest mt-1">Draw</div>}
                                </td>
                                <td className="px-6 py-4 font-medium text-xs text-gray-400 truncate max-w-[160px]">{nameOf(teams, matches, m, loseSide)}</td>
                                <td className="px-6 py-4 text-center"><span className="bg-white/5 text-gray-300 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-white/5">{m.pitch || '-'}</span></td>
                                <td className="px-6 py-4 text-right"><div className="text-gray-400 text-xs font-medium">{fmtDate(m.startAt)}</div><div className="text-[9px] text-content-muted mt-0.5">{fmtTime(m.startAt)}</div></td>
                            </tr>
                        );
                    })}
                </TableShell>
            ))}
        </>
    );
};

const Standings: React.FC<{ cat: FutsalCategory; teams: FutsalTeam[]; matches: FutsalMatch[] }> = ({ cat, teams, matches }) => {
    const accepted = teams.filter(x => x.categoryId === cat.id && x.status === 'ACCEPTED');
    const groups = isLeagueFormat(cat.format) ? [{ name: 'League', ids: accepted.map(x => x.id), ms: matches.filter(m => m.stage === 'LEAGUE') }]
        : [...new Set(accepted.map(x => x.groupId).filter(Boolean) as string[])].sort().map(g => ({ name: `Group ${g}`, ids: accepted.filter(x => x.groupId === g).map(x => x.id), ms: matches.filter(m => m.stage === 'GROUP' && m.group === g) }));
    const scorers = [...playerStats(accepted, matches).values()].filter(l => l.goals > 0).sort((a, b) => b.goals - a.goals || b.assists - a.assists).slice(0, 8);
    const qualify = cat.format === 'GROUPS_KNOCKOUT' ? cat.advancePerGroup : isLeagueFormat(cat.format) ? leagueQualifiers(cat) || 1 : 0;
    if (!groups.length || cat.format === 'KNOCKOUT') return <Empty icon={<Trophy size={48} />} title={cat.format === 'KNOCKOUT' ? 'Straight knockout' : 'Groups not drawn yet'} sub={cat.format === 'KNOCKOUT' ? 'See results for the bracket' : undefined} />;
    return (
        <div className="space-y-8">
            <div className={`grid gap-6 ${groups.length > 1 ? 'lg:grid-cols-2' : ''}`}>
                {groups.map(g => {
                    const rows = computeStandings(g.ids, g.ms, cat.rules, { includeLive: true, seedOf: id => accepted.find(x => x.id === id)?.seed ?? 99 });
                    return (
                        <div key={g.name} className="bg-[#0A0A0A] rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
                            <div className="px-5 py-3 bg-[#111111] border-b border-white/10 flex items-center justify-between">
                                <h4 className="text-sm font-black text-white uppercase tracking-widest">{g.name}</h4>
                                {rows.some(r => r.live) && <span className="text-[10px] font-black uppercase tracking-widest text-[#E65C31]">As it stands</span>}
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left font-mono">
                                    <thead className="text-[10px] text-content-muted font-black uppercase tracking-widest border-b border-white/10">
                                        <tr><th className="px-4 py-3">#</th><th className="px-2 py-3">Team</th>{['P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts'].map(h => <th key={h} className={`px-2 py-3 text-center ${['W', 'D', 'L', 'GF', 'GA'].includes(h) ? 'hidden sm:table-cell' : ''}`}>{h}</th>)}</tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 text-xs text-white">
                                        {rows.map((r, i) => {
                                            const team = accepted.find(x => x.id === r.teamId);
                                            return (
                                                <tr key={r.teamId} className={`hover:bg-white/[0.02] ${i < qualify ? 'bg-[#4D78FF]/[0.06]' : ''}`}>
                                                    <td className={`px-4 py-3 font-black ${i < qualify ? 'text-[#4D78FF]' : 'text-content-muted'}`}>{i + 1}</td>
                                                    <td className="px-2 py-3"><div className="flex items-center gap-2"><span className="w-1.5 h-5 rounded-full shrink-0" style={{ background: NEUTRAL }} /><span className="font-black text-sm truncate max-w-[170px]">{team?.name}</span></div></td>
                                                    <td className="px-2 py-3 text-center">{r.p}</td>
                                                    <td className="px-2 py-3 text-center hidden sm:table-cell">{r.w}</td>
                                                    <td className="px-2 py-3 text-center hidden sm:table-cell">{r.d}</td>
                                                    <td className="px-2 py-3 text-center hidden sm:table-cell">{r.l}</td>
                                                    <td className="px-2 py-3 text-center hidden sm:table-cell">{r.gf}</td>
                                                    <td className="px-2 py-3 text-center hidden sm:table-cell">{r.ga}</td>
                                                    <td className="px-2 py-3 text-center">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                                                    <td className="px-2 py-3 text-center font-black text-sm text-white">{r.pts}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })}
            </div>
            {scorers.length > 0 && (
                <div className="bg-[#0A0A0A] rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
                    <div className="px-5 py-3 bg-[#111111] border-b border-white/10"><h4 className="text-sm font-black text-white uppercase tracking-widest">Top scorers</h4></div>
                    <div className="divide-y divide-white/5">
                        {scorers.map((l, i) => (
                            <div key={l.playerId} className="flex items-center gap-4 px-5 py-3 text-xs">
                                <span className={`w-6 font-black font-mono ${i === 0 ? 'text-[#E65C31]' : 'text-content-muted'}`}>{i + 1}</span>
                                <span className="flex-1 min-w-0"><span className="block text-white font-black text-sm truncate">{playerName(teams, l.playerId)}</span><span className="text-[10px] text-content-muted uppercase tracking-widest font-bold">{teams.find(x => x.id === l.teamId)?.name}</span></span>
                                <span className="text-content-muted font-mono">{l.assists} A</span>
                                <span className="text-white font-black text-lg font-mono w-8 text-right">{l.goals}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const Feed: React.FC<{ list: FutsalMatch[]; teams: FutsalTeam[]; matches: FutsalMatch[]; cat: FutsalCategory }> = ({ list, teams, matches, cat }) => {
    const items = list.flatMap(m => m.events.filter(e => ['GOAL', 'OWN_GOAL', 'YELLOW', 'RED'].includes(e.type) && !e.auto).map(e => ({ m, e })))
        .sort((a, b) => b.e.at - a.e.at).slice(0, 60);
    if (!items.length) return <Empty icon={<History size={48} />} title="No action log" />;
    return (
        <div className="bg-[#0A0A0A] rounded-2xl border border-white/5 overflow-hidden shadow-2xl divide-y divide-white/5">
            {items.map(({ m, e }) => {
                const goal = e.type === 'GOAL' || e.type === 'OWN_GOAL';
                const forSide = e.type === 'OWN_GOAL' ? (e.side === 'home' ? 'away' : 'home') : e.side;
                return (
                    <div key={e.id} className="flex items-center gap-4 px-5 py-3">
                        <span className="w-12 text-[#E65C31] font-black font-mono text-sm">{eventMinute(cat.rules, e)}</span>
                        <span className={`shrink-0 ${goal ? '' : e.type === 'YELLOW' ? 'w-3 h-4 rounded-sm bg-yellow-400' : 'w-3 h-4 rounded-sm bg-red-500'}`}>{goal ? '⚽' : ''}</span>
                        <span className="flex-1 min-w-0">
                            <span className="block text-white font-black text-sm truncate">{goal ? 'Goal' : e.type === 'YELLOW' ? 'Yellow card' : 'Red card'} · {playerName(teams, e.playerId) || nameOf(teams, matches, m, forSide)}{e.type === 'OWN_GOAL' ? ' (og)' : ''}{e.goalType ? ` · ${goalTypeLabel(e.goalType)}` : ''}</span>
                            <span className="text-[10px] text-content-muted uppercase tracking-widest font-bold">{nameOf(teams, matches, m, 'home')} v {nameOf(teams, matches, m, 'away')} · {stageText(m)}</span>
                        </span>
                        {goal && <span className="text-white font-black font-mono text-sm">{scoreAt(m, e.id)}</span>}
                    </div>
                );
            })}
        </div>
    );
};

/** The score right after a given goal. */
const scoreAt = (m: FutsalMatch, eventId: string) => {
    const i = m.events.findIndex(e => e.id === eventId);
    const s = scoreOf({ events: m.events.slice(0, i + 1) });
    return `${s.home}-${s.away}`;
};

export default FutsalSpectatorDetail;
