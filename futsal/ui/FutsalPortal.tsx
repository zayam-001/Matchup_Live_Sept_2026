// The player portal (padel, futsal, football): the same shell as the organiser portal (sidebar, top
// bar, bento cards) for a signed-in player. Every number explains itself, and the
// charts are built from the referee's match logs.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, BarChart3, Goal, Play, Plus, MapPin, Gauge, History, Swords, Volleyball, CalendarDays, ChevronRight, Info, LayoutGrid, LogOut, Shirt, Star, Trophy, Tv, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import '../../components/admin.css';
import './portal.css';
import { Logo } from '../../components/ui/Logo';
import { PadelHistoryRows, PadelPartners, PadelRankings, usePadelData, chartTip, type PadelData } from './PortalPadel';
import { normalizeEmail, normalizePhone } from '../../lib/playerIdentity';
import { computeStandings, isKnockout, placements, playerStats, scoreOf, STAGE_NAMES, type PlayerLine } from '../engine';
import { goalTypeLabel } from '../presets';
import { computeFutsalRankings } from '../rankings';
import type { FutsalCategory, FutsalMatch, FutsalTeam, FutsalTournament, SquadPlayer } from '../types';
import { FORMATIONS, overall, savedLineup } from './SquadBuilder';
import { type PlayerAccount } from './PlayerProfileModal';
import { ProfileScreen } from './ProfileScreen';
import { FriendsPage, QuickHub, QuickMatchList, useQuickCount, useQuickMatches } from './QuickPlay';
import { PadelSquads, TeamManagement } from './TeamManagement';
import { playerGames, scoreText, sideOf, type QuickMatch } from '../quick';
import { publicPath, SPORT_LABEL, sportOf } from '../sport';
import { useAllFutsal, useNow } from './shared';
import { RotateGate } from './RotateGate';

interface Account { id?: string; uid?: string; email?: string; phone?: string; fullName?: string; name?: string; photoUrl?: string }
type TeamPage = 'overview' | 'squad' | 'quick' | 'register' | 'matches' | 'stats';
type FootballPage = 'football' | 'football-squad' | 'football-quick' | 'football-register' | 'football-matches' | 'football-stats';
type PadelPage = 'padel' | 'padel-quick' | 'padel-stats' | 'padel-register' | 'padel-history' | 'padel-rankings' | 'padel-partners' | 'padel-squad';
export type Page = 'home' | 'season' | 'events' | 'play' | 'friends' | 'profile' | TeamPage | FootballPage | PadelPage;
const ALL_PAGES: Page[] = ['home', 'season', 'events', 'play', 'friends', 'profile',
    'padel', 'padel-quick', 'padel-stats', 'padel-register', 'padel-history', 'padel-rankings', 'padel-partners', 'padel-squad',
    'overview', 'squad', 'quick', 'register', 'matches', 'stats',
    'football', 'football-squad', 'football-quick', 'football-register', 'football-matches', 'football-stats'];

const isMe = (p: SquadPlayer, a: Account) => {
    const uid = a.id || a.uid;
    if (uid && p.uid === uid) return true;
    const em = normalizeEmail(a.email);
    if (em && normalizeEmail(p.email) === em) return true;
    const ph = normalizePhone(a.phone);
    return !!ph && normalizePhone(p.phone) === ph;
};
const onTeam = (t: FutsalTeam, a: Account) => t.players.some(p => isMe(p, a)) || (!!normalizeEmail(a.email) && normalizeEmail(t.captainEmail) === normalizeEmail(a.email));

const BLUE = '#4D78FF', SKY = '#8EC5FF', LILAC = '#A5B4FC', MUTED = 'rgba(255,255,255,.35)';

/** One row per finished match: what the player did in it. */
interface MatchLine { m: FutsalMatch; label: string; opp: string; result: 'W' | 'D' | 'L'; score: string; goals: number; assists: number; rating?: number; motm: boolean; played: boolean }

type TeamSport = 'futsal' | 'football';
type Data = ReturnType<typeof useAllFutsal>;

/** Everything the portal shows for one team sport: the player's squads, the picked one, and its numbers. */
const useTeamSport = (sport: TeamSport, account: Account, { tournaments: allTournaments, teams, matches }: Data, pick: number) => {
    const tournaments = useMemo(() => allTournaments.filter(t => sportOf(t) === sport), [allTournaments, sport]);
    const mine = useMemo(() => teams.filter(t => t.status === 'ACCEPTED' && onTeam(t, account) && tournaments.some(x => x.id === t.tournamentId))
        .map(t => ({ team: t, tour: tournaments.find(x => x.id === t.tournamentId) as FutsalTournament }))
        .filter(x => x.tour && x.tour.status !== 'DRAFT')
        .sort((a, b) => String(b.tour.startDate).localeCompare(String(a.tour.startDate))), [teams, tournaments, account]);
    const sel = mine[Math.min(pick, Math.max(0, mine.length - 1))];
    const team = sel?.team, tour = sel?.tour;
    const cat = tour?.categories.find(c => c.id === team?.categoryId);
    const me = team?.players.find(p => isMe(p, account)) || team?.players[0];
    const teamMatches = useMemo(() => (team ? matches.filter(m => m.tournamentId === team.tournamentId && (m.homeId === team.id || m.awayId === team.id)) : []), [matches, team]);
    const catTeams = useMemo(() => (team ? teams.filter(t => t.tournamentId === team.tournamentId && t.categoryId === team.categoryId && t.status === 'ACCEPTED') : []), [teams, team]);
    const lines = useMemo(() => (team ? playerStats([team], teamMatches) : new Map<string, PlayerLine>()), [team, teamMatches]);
    const mineLine = me ? lines.get(me.id) : undefined;
    const rank = useMemo(() => {
        const { players } = computeFutsalRankings(tournaments, teams, matches);
        return players.find(r => r.results.some(x => team && x.tournamentId === team.tournamentId && x.teamName === team.name) && me && r.name === me.name);
    }, [tournaments, teams, matches, team, me]);

    const matchLog: MatchLine[] = useMemo(() => {
        if (!team || !me) return [];
        return teamMatches.filter(m => m.status === 'COMPLETED').sort((a, b) => String(a.startAt).localeCompare(String(b.startAt))).map(m => {
            const home = m.homeId === team.id;
            const s = scoreOf(m);
            const f = home ? s.home : s.away, a = home ? s.away : s.home;
            const opp = teams.find(x => x.id === (home ? m.awayId : m.homeId));
            const lu = m.lineups?.[home ? 'home' : 'away']?.players;
            return {
                m, opp: opp?.name || 'TBD', label: opp?.shortName || 'TBD', score: `${f}–${a}`,
                result: m.winnerId === team.id ? 'W' : m.winnerId ? 'L' : 'D',
                goals: m.events.filter(e => e.type === 'GOAL' && e.playerId === me.id).length,
                assists: m.events.filter(e => e.type === 'GOAL' && e.assistId === me.id).length,
                rating: m.ratings?.[me.id], motm: m.motm === me.id,
                played: !lu?.length || lu.includes(me.id) || m.events.some(e => e.playerId === me.id || e.assistId === me.id),
            };
        });
    }, [teamMatches, team, me, teams]);

    const goalTypes = useMemo(() => {
        const counts = new Map<string, number>();
        teamMatches.forEach(m => m.events.forEach(e => { if (e.type === 'GOAL' && me && e.playerId === me.id) counts.set(goalTypeLabel(e.goalType) || 'Other', (counts.get(goalTypeLabel(e.goalType) || 'Other') || 0) + 1); }));
        return [...counts.entries()].map(([name, value]) => ({ name, value }));
    }, [teamMatches, me]);

    const live = teamMatches.find(m => m.status === 'LIVE');
    const next = teamMatches.filter(m => m.status === 'SCHEDULED' && m.startAt).sort((a, b) => a.startAt!.localeCompare(b.startAt!))[0];
    const played = matchLog.filter(h => h.played);
    const wins = played.filter(h => h.result === 'W').length;
    const teamAvg = (f: (l: PlayerLine) => number) => { const all = [...lines.values()].filter(l => l.apps); return all.length ? all.reduce((n, l) => n + f(l), 0) / all.length : 0; };
    const ovr = (() => { const l = mineLine; if (!l || !l.apps) return 60; const form = 60 + Math.min(30, l.goals * 3 + l.assists * 2 + l.motm * 4 + l.cleanSheets * 3) - Math.min(8, l.yellows + l.reds * 3); return Math.max(45, Math.min(99, Math.round(l.ratedMatches ? form * 0.4 + l.rating * 20 * 0.6 : form))); })();

    // Career: every tournament team the player has been on in this sport, not just the one picked,
    // so stats, XP and badges include all their tournaments.
    const career = useMemo(() => {
        const c = { played: 0, wins: 0, goals: 0, assists: 0, motm: 0, ratingSum: 0, ratingN: 0, hatTrick: false, types: new Map<string, number>(), form: [] as { result: 'W' | 'D' | 'L'; at: string; label: string }[] };
        mine.forEach(({ team: t, tour: tr }) => {
            const p = t.players.find(x => isMe(x, account));
            if (!p) return;
            matches.filter(m => m.tournamentId === t.tournamentId && m.status === 'COMPLETED' && (m.homeId === t.id || m.awayId === t.id)).forEach(m => {
                const home = m.homeId === t.id;
                const lu = m.lineups?.[home ? 'home' : 'away']?.players;
                const inIt = !lu?.length || lu.includes(p.id) || m.events.some(e => e.playerId === p.id || e.assistId === p.id);
                if (!inIt) return;
                const s = scoreOf(m);
                const result: 'W' | 'D' | 'L' = m.winnerId === t.id ? 'W' : m.winnerId ? 'L' : 'D';
                const g = m.events.filter(e => e.type === 'GOAL' && e.playerId === p.id);
                c.played++; if (result === 'W') c.wins++;
                c.goals += g.length; c.assists += m.events.filter(e => e.type === 'GOAL' && e.assistId === p.id).length;
                if (m.motm === p.id) c.motm++;
                if (m.ratings?.[p.id]) { c.ratingSum += m.ratings[p.id]; c.ratingN++; }
                if (g.length >= 3) c.hatTrick = true;
                g.forEach(e => { const k = goalTypeLabel(e.goalType) || 'Other'; c.types.set(k, (c.types.get(k) || 0) + 1); });
                const opp = teams.find(x => x.id === (home ? m.awayId : m.homeId));
                c.form.push({ result, at: String(m.startAt || ''), label: `${result} ${home ? s.home : s.away}–${home ? s.away : s.home} v ${opp?.name || 'TBD'} · ${tr.name}` });
            });
        });
        return c;
    }, [mine, matches, teams, account]);

    return { mine, team, tour, cat, me, teamMatches, catTeams, lines, mineLine, rank, matchLog, goalTypes, live, next, played, wins, teamAvg, ovr, teams, career };
};
export type SportData = ReturnType<typeof useTeamSport>;

const FOOTBALL_PAGE: Record<TeamPage, Page> = { overview: 'football', squad: 'football-squad', quick: 'football-quick', register: 'football-register', matches: 'football-matches', stats: 'football-stats' };
/** The team-sport page a portal page shows ("football-squad" is the squad page for football). */
const subPage = (p: Page): TeamPage => (p === 'football' ? 'overview' : p.startsWith('football-') ? p.slice(9) as TeamPage : p as TeamPage);

/** The player portal for every sport: padel, futsal and football side by side in one shell. */
export const FutsalPortal: React.FC<{ account: Account; onNavigate: (tab: string) => void; onLogout: () => void; initialPage?: Page }> = ({ account: signedIn, onNavigate, onLogout, initialPage }) => {
    // Edits from the profile pop-up show at once, before the auth listener catches up.
    const [edits, setEdits] = useState<Partial<PlayerAccount>>({});
    const account = useMemo(() => ({ ...signedIn, ...edits }) as Account & PlayerAccount, [signedIn, edits]);
    const data = useAllFutsal();
    const { matches, loading } = data;
    const now = useNow(1000, matches.some(m => m.status === 'LIVE'));
    const [page, setPage] = useState<Page>(() => {
        const seg = location.hash.replace(/^#\/?/, '').split('/')[1] as Page;
        return ALL_PAGES.includes(seg) ? seg : initialPage || 'home';
    });
    const [picks, setPicks] = useState<Record<TeamSport, number>>({ futsal: 0, football: 0 });
    useEffect(() => { const h = `player/${page}`; if (location.hash.replace('#', '') !== h) window.history.replaceState(null, '', `#${h}`); }, [page]);

    const futsalData = useTeamSport('futsal', account, data, picks.futsal);
    const footballData = useTeamSport('football', account, data, picks.football);
    const isPadel = page.startsWith('padel');
    const sport: TeamSport = page.startsWith('football') ? 'football' : 'futsal';
    const sub = subPage(page);
    const sd = sport === 'football' ? footballData : futsalData;
    const { mine, team, tour, cat, me, teamMatches, catTeams, lines, mineLine, rank, matchLog, goalTypes, live, next, played, wins, teamAvg, ovr, teams } = sd;
    const pick = picks[sport];
    const setPick = (n: number) => setPicks(p => ({ ...p, [sport]: n }));
    const sportName = SPORT_LABEL[sport];
    const name = account.fullName || account.name || me?.name || futsalData.me?.name || footballData.me?.name || 'Player';
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

    const padel = usePadelData(account);
    const padelNav: { id: Page; label: string; icon: React.ReactNode; hint: string }[] = [
        { id: 'padel', label: 'Home', icon: <LayoutGrid size={18} />, hint: 'Everything padel' },
        { id: 'padel-quick', label: 'Quick play', icon: <Play size={18} />, hint: 'Casual padel matches with friends' },
        { id: 'padel-stats', label: 'Stats', icon: <BarChart3 size={18} />, hint: 'Your padel numbers' },
        { id: 'padel-register', label: 'Register', icon: <Trophy size={18} />, hint: 'Padel tournaments open for entries' },
        { id: 'padel-history', label: 'Previous matches', icon: <History size={18} />, hint: 'Tournaments and quick matches you played' },
        { id: 'padel-rankings', label: 'Rankings', icon: <Trophy size={18} />, hint: 'National padel rankings' },
        { id: 'padel-partners', label: 'Partners', icon: <Users size={18} />, hint: 'Who you have played with' },
        { id: 'padel-squad', label: 'Squad', icon: <Users size={18} />, hint: 'Your pair and reserves' },
    ];
    const homeNav = { id: 'home' as Page, label: 'Overview', icon: <Gauge size={18} />, hint: 'Padel, futsal and football together' };
    const groupOf = (p: Page) => (p.startsWith('padel') ? 'padel' : p.startsWith('football') ? 'football' : 'futsal');
    const nav: { id: Page; label: string; icon: React.ReactNode; hint: string }[] = [
        { id: 'overview', label: 'Home', icon: <LayoutGrid size={18} />, hint: 'Everything in one place' },
        { id: 'squad', label: 'Team management', icon: <Shirt size={18} />, hint: 'Formation and lineup' },
        { id: 'quick', label: 'Quick play', icon: <Play size={18} />, hint: 'Casual matches with friends' },
        { id: 'register', label: 'Register', icon: <Trophy size={18} />, hint: 'Tournaments open for teams' },
        { id: 'matches', label: 'Matches', icon: <CalendarDays size={18} />, hint: 'Fixtures, quick matches and the table' },
        { id: 'stats', label: 'Stats', icon: <BarChart3 size={18} />, hint: 'Your numbers' },
    ];
    const footballNav = nav.map(n => ({ ...n, id: FOOTBALL_PAGE[n.id as TeamPage] }));
    const go = (p: Page) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const current = [homeNav, ...padelNav, ...nav, ...footballNav].find(n => n.id === page)!;
    // Game-menu shell: top tabs per sport, a sub-menu row for the open sport, tiles on the home screen.
    const primary: { key: 'home' | 'season' | 'events' | 'friends' | 'padel' | 'futsal' | 'football'; label: string; page: Page; live?: boolean }[] = [
        { key: 'home', label: 'Home', page: 'home' },
        { key: 'season', label: 'Stats', page: 'season' },
        { key: 'events', label: 'Events', page: 'events' },
        { key: 'friends', label: 'Add Friend', page: 'friends' },
        { key: 'padel', label: 'Padel', page: 'padel' },
        { key: 'futsal', label: 'Futsal', page: 'overview', live: !!futsalData.live },
        { key: 'football', label: 'Football', page: 'football', live: !!footballData.live },
    ];
    const activeKey = (['home', 'season', 'events', 'play', 'friends', 'profile'] as const).find(k => k === page) || groupOf(page);
    const [badgesOpen, setBadgesOpen] = useState(false);
    const quick = useQuickMatches(account.email);
    const who = useMemo(() => ({ uid: account.id || account.uid, email: account.email }), [account.id, account.uid, account.email]);
    const [quickOpen, setQuickOpen] = useState<{ id?: string; nonce: number }>({ nonce: 0 });
    const sportOfPage: StatSport = page.startsWith('padel') ? 'padel' : page.startsWith('football') ? 'football' : 'futsal';
    const subOfPage = page === 'padel' ? 'overview' : page === 'padel-history' ? 'matches' : page.startsWith('padel-') ? page.slice(6) : subPage(page);
    const quickPage = (s: StatSport): Page => (s === 'padel' ? 'padel-quick' : s === 'football' ? 'football-quick' : 'quick');
    const inSport = !['home', 'season', 'events', 'play', 'friends', 'profile'].includes(page);
    const landingOf = (s: StatSport): Page => (s === 'padel' ? 'padel' : s === 'football' ? 'football' : 'overview');
    const openQuick = (s: StatSport, id?: string) => { setQuickOpen(q => ({ id, nonce: q.nonce + 1 })); go(quickPage(s)); };
    useEffect(() => {
        if (!badgesOpen) return;
        const close = (e: Event) => { if (e instanceof KeyboardEvent ? e.key === 'Escape' : !(e.target as Element)?.closest?.('.fxg-badges-wrap')) setBadgesOpen(false); };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', close);
        return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
    }, [badgesOpen]);
    const prog = useMemo(() => progression(padel, futsalData, footballData, quick, who), [padel, futsalData, footballData, quick, who]);
    // The club shown in the top-left card: the team sport you're in (futsal first), on its own sport's pages that sport.
    const homeTeam = (() => {
        const pickSport = activeKey === 'football' ? [footballData, futsalData] : [futsalData, footballData];
        const d = pickSport.find(x => x.team);
        return d ? { d } : null;
    })();

    return (
        <div className={`admx fxp fxg ${page === 'home' || page === 'season' || page === 'friends' || page === 'play' || subOfPage === 'quick' || (inSport && (subOfPage === 'overview' || subOfPage === 'stats' || subOfPage === 'matches' || subOfPage === 'squad')) ? 'is-home' : ''}`}>
            <div className="fxg__bg" aria-hidden="true" />
            <RotateGate />
            <header className="fxg-top">
                <button type="button" className="fxg-logo" onClick={() => go('home')} aria-label="Match Up home">
                    <Logo size={52} />
                    <span className="fxg-logo__word"><b>MATCH UP</b><small>Player portal</small></span>
                </button>
                <div className="fxg-top__right">
                    {!isPadel && page !== 'home' && page !== 'season' && mine.length > 1 && (
                        <select className="fxg-select" value={pick} onChange={e => setPick(Number(e.target.value))} aria-label="Competition">
                            {mine.map((x, i) => <option key={x.team.id} value={i}>{x.team.name} · {x.tour.name}</option>)}
                        </select>
                    )}
                    {homeTeam && (
                        <button type="button" className="fxg-chip-btn fxg-clubchip" onClick={() => go(homeTeam.d === footballData ? 'football' : 'overview')} title="Your team">
                            <span className="fxg-clubchip__crest">{homeTeam.d.team!.logoUrl ? <img src={homeTeam.d.team!.logoUrl} alt="" /> : homeTeam.d.team!.shortName}</span>
                            <span className="fxg-clubchip__id"><b>{homeTeam.d.team!.name}</b><small>{homeTeam.d.ovr} OVR</small></span>
                        </button>
                    )}
                    <span className="fxg-badges-wrap">
                        <button type="button" className="fxg-chip-btn fxg-badges" onClick={() => setBadgesOpen(o => !o)} aria-expanded={badgesOpen} title="Achievements">
                            <Trophy size={18} /><b>{prog.badges.filter(b => b.got).length}</b><small>/{prog.badges.length}</small>
                        </button>
                        {badgesOpen && (
                            <span className="fxg-badges__pop" role="dialog" aria-label="Achievements">
                                <b className="fxg-badges__title">Achievements</b>
                                {prog.badges.map(bd => (
                                    <span key={bd.id} className={`fxg-badge ${bd.got ? 'is-got' : ''}`}>
                                        <i>{bd.got ? <Star size={14} /> : <Info size={14} />}</i>
                                        <span><b>{bd.name}</b><small>{bd.how}</small></span>
                                    </span>
                                ))}
                            </span>
                        )}
                    </span>
                    <button type="button" className="fxg-player" onClick={() => go('profile')} aria-label="Edit your profile">
                        <span className="fxg-player__ring" style={{ '--p': prog.pct } as React.CSSProperties}>
                            <span className="fxg-player__avatar">{account.photoUrl ? <img src={account.photoUrl} alt="" /> : initials}</span>
                            <em>{prog.level}</em>
                        </span>
                        <span className="fxg-player__id">
                            <b>{name}</b>
                            <span className="fxg-player__lvl">LVL {prog.level} · {prog.into.toLocaleString()} / {prog.need.toLocaleString()} XP</span>
                            <span className="fxg-xp" aria-hidden="true"><i style={{ width: `${prog.pct}%` }} /></span>
                        </span>
                    </button>
                </div>
            </header>

            <nav className="fxg-nav" aria-label="Sports">
                {primary.map(p => (
                    <button key={p.key} type="button" className={`fxg-nav__tab ${activeKey === p.key ? 'is-on' : ''}`} aria-current={activeKey === p.key ? 'page' : undefined} onClick={() => go(p.page)}>
                        {p.label}{p.live && <i className="fxg-live" aria-label="live" />}
                    </button>
                ))}
            </nav>

            <main className="fxg-main">
                    {inSport && subOfPage !== 'overview' && (
                        <button type="button" className="qp-back fxg-crumb" onClick={() => go(landingOf(sportOfPage))}><ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} /> {SPORT_LABELS[sportOfPage]}</button>
                    )}
                    {page === 'home' ? (
                        <MenuHome name={name} padel={padel} futsal={futsalData} football={footballData} events={upcomingEvents(padel, data.tournaments, data.teams, true)} onGo={go} onNavigate={onNavigate} onProfile={() => go('profile')} />
                    ) : page === 'season' ? (
                        <SeasonStats padel={padel} futsal={futsalData} football={footballData} quick={quick} who={who} />
                    ) : page === 'events' ? (
                        <EventsPage padel={padel} tournaments={data.tournaments} teams={data.teams} onNavigate={onNavigate} />
                    ) : page === 'play' ? (
                        <QuickHub key={`all-${quickOpen.nonce}`} account={account} openId={quickOpen.id} />
                    ) : page === 'friends' ? (
                        <FriendsPage account={account} photo={TILE_PHOTOS.spectator} onQuickPlay={() => go('play')} />
                    ) : page === 'padel-squad' ? (
                        <PadelSquads account={account} />
                    ) : subOfPage === 'squad' && !isPadel ? (
                        <TeamManagement key={sport} account={account} sport={sport}
                            tournament={team && me ? { team, onPitch: cat?.rules.onPitch || 5, matches: teamMatches, meId: me.id, tour, squadMax: cat?.rules.squadMax } : undefined} />
                    ) : page === 'profile' ? (
                        <ProfileScreen account={account} onSaved={patch => setEdits(e => ({ ...e, ...patch }))} onLogout={onLogout} />
                    ) : subOfPage === 'overview' ? (
                        sportOfPage === 'padel'
                            ? <PadelLanding padel={padel} quick={quick.filter(m => m.sport === 'padel')} events={upcomingEvents(padel, data.tournaments, data.teams).filter(e => e.sport === 'padel')} who={who} onGo={go} />
                            : <SportLanding sport={sportOfPage} d={sportOfPage === 'football' ? footballData : futsalData} name={name} quick={quick.filter(m => m.sport === sportOfPage)} events={upcomingEvents(padel, data.tournaments, data.teams).filter(e => e.sport === sportOfPage)} who={who} onGo={go} />
                    ) : subOfPage === 'stats' ? (
                        <SeasonStats key={sportOfPage} padel={padel} futsal={futsalData} football={footballData} quick={quick} who={who} fixed={sportOfPage} />
                    ) : subOfPage === 'register' ? (
                        <EventsPage key={sportOfPage} padel={padel} tournaments={data.tournaments} teams={data.teams} onNavigate={onNavigate} only={sportOfPage} />
                    ) : subOfPage === 'quick' ? (
                        <QuickHub key={`${sportOfPage}-${quickOpen.nonce}`} account={account} sport={sportOfPage} openId={quickOpen.id} />
                    ) : isPadel ? (
                        <>
                            {page !== 'padel-history' && <PageHead eyebrow="Padel" title={current.label} hint={`${current.hint}.`} />}
                            {page === 'padel-rankings' && <PadelRankings data={padel} />}
                            {page === 'padel-history' && (
                                <div className="mx mx--two">
                                    <section className="mx-panel">
                                        <header className="mx-head"><div><span className="mx-kicker">Padel · Quick Play</span><h3>Friendly matches</h3></div><button type="button" className="qx-ghost" onClick={() => openQuick('padel')}><Plus size={14} /> New match</button></header>
                                        <div className="mx-scroll"><QuickMatchList bare account={account} sport="padel" onOpen={id => openQuick('padel', id)} onNew={() => openQuick('padel')} /></div>
                                    </section>
                                    <section className="mx-panel">
                                        <header className="mx-head"><div><span className="mx-kicker">Padel · Ranked</span><h3>Tournament history</h3></div>{padel.me && <span className="mx-stat"><b>{padel.me.wins}-{padel.me.losses}</b><small>W-L</small></span>}</header>
                                        <div className="mx-scroll"><PadelHistoryRows data={padel} /></div>
                                    </section>
                                </div>
                            )}
                            {page === 'padel-partners' && <PadelPartners data={padel} />}
                        </>
                    ) : subOfPage === 'matches' && (!team || !tour || !me) && !loading ? (
                        (
                        <>
                            <div className="mx mx--two">
                                <section className="mx-panel">
                                    <header className="mx-head"><div><span className="mx-kicker">{sportName} · Quick Play</span><h3>Your matches</h3></div><button type="button" className="qx-ghost" onClick={() => openQuick(sport)}><Plus size={14} /> New match</button></header>
                                    <div className="mx-scroll"><QuickMatchList bare account={account} sport={sport} onOpen={id => openQuick(sport, id)} onNew={() => openQuick(sport)} /></div>
                                </section>
                                <section className="mx-panel mx-panel--note">
                                    <header className="mx-head"><div><span className="mx-kicker">{sportName} · Tournaments</span><h3>Fixtures &amp; table</h3></div></header>
                                    <div className="qx-empty qx-empty--sm"><CalendarDays size={22} /><b>Not on a tournament squad yet</b><span>When an organiser adds you with your email, your fixtures, group table and squad stats appear here.</span></div>
                                </section>
                            </div>
                        </>
                        )
                    ) : loading ? <div className="fxp-empty">Loading your {sport}…</div> : !team || !tour || !me ? (
                        <div className="admx-card fxp-empty">
                            <h2>You're not on a {sport} squad yet</h2>
                            <p>When an organiser or captain adds you with <b>{account.email || 'your email'}</b>, your team, matches and stats appear here automatically.</p>
                        </div>
                    ) : (
                        <>
                            {sub !== 'matches' && <div className="fxp-head">
                                <div>
                                    <p className="fxp-eyebrow">{sportName} · {tour.name} · {cat?.name}</p>
                                    <h1>{sub === 'overview' ? `Welcome back, ${name.split(' ')[0]}` : current.label}</h1>
                                    <p className="fxp-sub">{current.hint}. {sub === 'overview' ? 'Numbers update the moment the referee records them.' : ''}</p>
                                </div>
                            </div>}


                            {sub === 'matches' && <TeamMatches sport={sport} sportName={sportName} account={account} team={team} me={me} tour={tour} cat={cat} teams={teams} catTeams={catTeams} matches={matches} teamMatches={teamMatches} matchLog={matchLog} lines={lines} onOpenQuick={id => openQuick(sport, id)} />}
                        </>
                    )}
            </main>
            <footer className="fxg-foot">
                <nav className="fxg-hints" aria-label="Shortcuts">
                    {page !== 'home' && <button type="button" onClick={() => go(inSport && subOfPage !== 'overview' ? landingOf(sportOfPage) : 'home')}>Back</button>}
                    <button type="button" onClick={() => go('season')}>Stats</button>
                    <button type="button" onClick={() => go('profile')}>Profile</button>
                    <button type="button" onClick={() => onNavigate('live')}>Spectator</button>
                    <button type="button" className="is-out" onClick={onLogout}><LogOut size={14} /> Log out</button>
                </nav>
                <span>Match Up · Player portal</span>
            </footer>
        </div>
    );
};

const PageHead: React.FC<{ eyebrow: string; title: string; hint: string }> = ({ eyebrow, title, hint }) => (
    <div className="fxp-head"><div><p className="fxp-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="fxp-sub">{hint}</p></div></div>
);

/**
 * Match Up XP: earned from real results in every sport, so a level means something.
 * Level n needs 100·n² XP in total (L2 at 100, L3 at 400, L4 at 900 …).
 */
const progression = (padel: PadelData, futsal: SportData, football: SportData, quick: QuickMatch[] = [], who: { uid?: string; email?: string } = {}) => {
    const team = [futsal, football];
    // Finished quick matches count like any other result (players are matched by email).
    const email = (who.email || '').toLowerCase();
    // Every game counts: a normal quick match is one, a winner-stays session is one per game played.
    const qGames = quick.flatMap(m => playerGames(m, who).map(g => ({ m, g })));
    const qDone = quick.filter(m => playerGames(m, who).length).map(m => ({ m }));
    const qWins = qGames.filter(x => x.g.result === 'W').length;
    const qGoals = qGames.reduce((n, x) => n + x.g.goals, 0);
    const played = (padel.me ? padel.me.wins + padel.me.losses : 0) + team.reduce((n, d) => n + d.career.played, 0) + qGames.length;
    const wins = (padel.me?.wins || 0) + team.reduce((n, d) => n + d.career.wins, 0) + qWins;
    const goals = team.reduce((n, d) => n + d.career.goals, 0) + qGoals;
    const assists = team.reduce((n, d) => n + d.career.assists, 0);
    const motm = team.reduce((n, d) => n + d.career.motm, 0);
    const baseXp = played * 50 + wins * 30 + goals * 20 + assists * 10 + motm * 40 + (padel.me?.points || 0);
    const qSports = new Set(qDone.map(x => x.m.sport));
    const sports = [(padel.me && padel.me.wins + padel.me.losses > 0) || qSports.has('padel'), futsal.career.played > 0 || qSports.has('futsal'), football.career.played > 0 || qSports.has('football')].filter(Boolean).length;
    const hatTrick = team.some(d => d.career.hatTrick) || qDone.some(({ m }) => !!email && m.events.filter(e => e.kind === 'goal' && (e.playerEmail || '').toLowerCase() === email).length >= 3);
    const badges = [
        { id: 'debut', name: 'Debut', how: 'Play your first match', got: played >= 1 },
        { id: 'win', name: 'First win', how: 'Win a match in any sport', got: wins >= 1 },
        { id: 'scorer', name: 'On the scoresheet', how: 'Score a goal in futsal or football', got: goals >= 1 },
        { id: 'hattrick', name: 'Hat-trick', how: 'Score 3 in one match', got: hatTrick },
        { id: 'playmaker', name: 'Playmaker', how: 'Make 5 assists', got: assists >= 5 },
        { id: 'potm', name: 'Player of the match', how: 'Be picked by the referee', got: motm >= 1 },
        { id: 'ranked', name: 'Ranked', how: 'Earn padel ranking points', got: (padel.me?.points || 0) > 0 },
        { id: 'multi', name: 'Multi-sport', how: 'Play two different sports', got: sports >= 2 },
    ];
    // Achievements pay too: +100 XP for every badge unlocked.
    const xp = baseXp + badges.filter(b => b.got).length * 100;
    const level = Math.floor(Math.sqrt(xp / 100)) + 1;
    const from = 100 * (level - 1) ** 2, to = 100 * level ** 2;
    return { xp, level, into: xp - from, need: to - from, pct: Math.round(((xp - from) / (to - from)) * 100), badges };
};

// Optional tile photos from assets/portal (padel.jpg, futsal.webp, …). Only files that exist are bundled.
const TILE_PHOTOS: Record<string, string> = Object.fromEntries(
    Object.entries(import.meta.glob('../../assets/portal/*.{jpg,jpeg,png,webp}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>)
        .map(([path, url]) => [path.split('/').pop()!.replace(/\.[^.]+$/, '').toLowerCase(), url]),
);

/** The home screen: your squad on a pitch on the left, menu tiles on the right, one highlighted. */
const MenuHome: React.FC<{
    name: string; padel: PadelData; futsal: SportData; football: SportData; events: EventItem[];
    onGo: (p: Page) => void; onNavigate: (t: string) => void; onProfile: () => void;
}> = ({ name, padel, futsal, football, events, onGo, onNavigate, onProfile }) => {
    const pm = padel.me;
    const featured = futsal.team ? 'futsal' : football.team ? 'football' : 'padel';
    // Every tile has art, so a new player sees the same screen as a regular: an empty card until there's a squad.
    const Card = ({ d }: { d: SportData }) => d.team && d.me ? (
        <span className="fxg-tile__card"><b>{d.ovr}</b><small>{d.me.position || 'OVR'}</small><em>{d.me.name.split(' ').slice(-1)[0]}</em></span>
    ) : <span className="fxg-tile__card is-empty"><b>–</b><small>OVR</small><em>No squad</em></span>;
    const Icon = ({ children }: { children: React.ReactNode }) => <span className="fxg-tile__icon">{children}</span>;
    const tiles: { key: string; title: string; sub: string; onClick: () => void; art?: React.ReactNode }[] = [
        { key: 'padel', title: 'Padel', sub: pm ? `${pm.points} ranking pts · #${pm.rank} of ${padel.total}` : 'Rankings, history and partners', onClick: () => onGo('padel'), art: <span className="fxg-tile__num">{pm?.points ?? 0}<small>pts</small></span> },
        { key: 'futsal', title: 'Futsal', sub: futsal.team ? `${futsal.team.name} · ${futsal.mineLine?.goals ?? 0} goals` : 'Join a squad to see your stats', onClick: () => onGo('overview'), art: <Card d={futsal} /> },
        { key: 'football', title: 'Football', sub: football.team ? `${football.team.name} · ${football.mineLine?.goals ?? 0} goals` : 'Join a squad to see your stats', onClick: () => onGo('football'), art: <Card d={football} /> },
        { key: 'quick', title: 'Quick Play', sub: 'Set up a match with friends, invite them and share a referee code', onClick: () => onGo('play'), art: <Icon><Play /></Icon> },
    ];
    return (
        <div className="fxg-home">
            <SquadSlider name={name} futsal={futsal} football={football} padel={padel} onGo={onGo} />
            <div className="fxg-tiles">
                {tiles.map(t => {
                    const photo = TILE_PHOTOS[t.key === 'quick' ? 'live' : t.key];
                    return (
                    <button key={t.key} type="button" className={`fxg-tile fxg-tile--${t.key} ${t.key === featured ? 'is-featured' : ''} ${photo ? 'has-photo' : ''}`}
                        style={photo ? { '--photo': `url("${photo}")` } as React.CSSProperties : undefined} onClick={t.onClick}>
                        <span className="fxg-tile__text"><b>{t.title}</b><small>{t.sub}</small></span>
                        {t.art && !photo && <span className="fxg-tile__art">{t.art}</span>}
                    </button>
                    );
                })}
                <EventCarousel events={events} onOpen={() => onGo('events')} />
            </div>
        </div>
    );
};

/** Your saved lineup as FIFA-style cards on a lit, tilted pitch (far end narrower, cards stay upright). */
/**
 * Home's squad slider: a labelled slide per sport (futsal squad, football squad, padel pair on a court),
 * sliding on its own. Sports the player has played come first; the rest show their empty state.
 */
const SquadSlider: React.FC<{ name: string; futsal: SportData; football: SportData; padel: PadelData; onGo: (p: Page) => void }> = ({ name, futsal, football, padel, onGo }) => {
    const hasPadel = !!padel.me || padel.events.length > 0;
    const slides = [
        { key: 'futsal', label: 'Futsal squad', has: !!(futsal.team && futsal.cat), el: (has: boolean) => has ? <PitchPanel d={futsal} label="Futsal squad" onOpen={() => onGo('squad')} /> : <PitchPanel name={name} label="Futsal squad" build="futsal" onOpen={() => onGo('squad')} /> },
        { key: 'football', label: 'Football squad', has: !!(football.team && football.cat), el: (has: boolean) => has ? <PitchPanel d={football} label="Football squad" onOpen={() => onGo('football-squad')} /> : <PitchPanel name={name} label="Football squad" build="football" onOpen={() => onGo('football-squad')} /> },
        { key: 'padel', label: 'Padel pair', has: hasPadel, el: () => <PadelCourtPanel name={name} padel={padel} onOpen={() => onGo('padel-squad')} /> },
    ].sort((a, b) => Number(b.has) - Number(a.has));
    const [i, setI] = useState(0);
    const [held, setHeld] = useState(false);
    const [tick, setTick] = useState(0);
    const touch = useRef<number | null>(null);
    useEffect(() => {
        if (held) return;
        const t = setInterval(() => setI(x => (x + 1) % slides.length), 6000);
        return () => clearInterval(t);
    }, [held, tick, slides.length]);
    const go = (d: number) => { setI(x => (x + d + slides.length) % slides.length); setTick(t => t + 1); };
    return (
        <div className="fxg-sq"
            onTouchStart={e => { setHeld(true); touch.current = e.touches[0].clientX; }}
            onTouchEnd={e => { const x0 = touch.current; touch.current = null; setHeld(false); if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); }}>
            <div className="fxg-sq__track" style={{ transform: `translateX(-${i * 100}%)` }}>
                {slides.map((sl, k) => <div key={sl.key} className="fxg-sq__slide" aria-hidden={k !== i}>{sl.el(sl.has)}</div>)}
            </div>
            <button type="button" className="fxg-events__arrow is-prev" onClick={() => go(-1)} aria-label="Previous sport"><ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} /></button>
            <button type="button" className="fxg-events__arrow is-next" onClick={() => go(1)} aria-label="Next sport"><ChevronRight size={20} /></button>
            <span className="fxg-sq__tabs">{slides.map((sl, k) => <button key={sl.key} type="button" className={k === i ? 'is-on' : ''} onClick={() => { setI(k); setTick(t => t + 1); }}>{sl.label}</button>)}</span>
        </div>
    );
};

/** A padel court in the same tilted, game-card style as the pitch, with the player and their partner. */
const PadelCourtPanel: React.FC<{ name: string; padel: PadelData; onOpen: () => void }> = ({ name, padel, onOpen }) => {
    const me = padel.me;
    const partner = padel.events[0]?.partner;
    const has = !!me || padel.events.length > 0;
    const proj = (x: number, y: number) => { const k = y / 100; return { x: 50 + (x - 50) * (0.6 + 0.4 * k), y: 6 + 88 * (0.1 + 0.9 * k) - 4, k }; };
    const P = (x: number, y: number) => { const p = proj(x, y); return `${p.x},${p.y}`; };
    const poly = (pts: [number, number][]) => pts.map(([x, y]) => P(x, y)).join(' ');
    const initialsOf = (n?: string) => (n || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const cards = [
        { x: 30, y: 74, nm: has ? name : 'You', tag: 'You', me: true },
        { x: 70, y: 74, nm: partner && partner !== 'Partner TBD' ? partner : '', tag: 'Partner', me: false },
    ];
    return (
        <button type="button" className="fxg-panel fxg-pitch fxg-court" onClick={onOpen} aria-label="Open padel">
            <span className="fxg-panel__head">
                <em className="fxg-panel__eyebrow">Padel pair</em>
                <b>{has ? `${name.split(' ')[0]}${partner && partner !== 'Partner TBD' ? ` & ${partner.split(' ')[0]}` : ''}` : 'Your padel pair'}</b>
                <small>{me ? `#${me.rank ?? '–'} · ${me.points} pts · ${me.wins}-${me.losses}` : has ? `${padel.events.length} event${padel.events.length > 1 ? 's' : ''} played` : 'Play a padel tournament to fill your court'}</small>
            </span>
            <span className="fxg-pitch__field is-small-side">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <defs>
                        <linearGradient id="fxg-court" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1E3FA8" /><stop offset="1" stopColor="#2F5BE0" /></linearGradient>
                        <linearGradient id="fxg-court-out" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#173385" /><stop offset="1" stopColor="#1F44B8" /></linearGradient>
                    </defs>
                    <polygon points={poly([[0, 100], [100, 100], [100, 104], [0, 104]])} fill="#0B1A4D" />
                    <polygon points={poly([[0, 0], [100, 0], [100, 100], [0, 100]])} fill="url(#fxg-court-out)" />
                    <polygon points={poly([[6, 4], [94, 4], [94, 96], [6, 96]])} fill="url(#fxg-court)" />
                    <g fill="none" stroke="rgba(255,255,255,.9)" strokeWidth=".45">
                        <polygon points={poly([[6, 4], [94, 4], [94, 96], [6, 96]])} />
                        <polyline points={poly([[6, 33], [94, 33]])} />
                        <polyline points={poly([[6, 67], [94, 67]])} />
                        <polyline points={poly([[50, 33], [50, 67]])} />
                    </g>
                    {/* Glass walls at each end, and the net across the middle */}
                    <polygon points={poly([[6, 4], [94, 4], [94, 1], [6, 1]])} fill="rgba(180,220,255,.25)" stroke="rgba(255,255,255,.5)" strokeWidth=".3" />
                    <polygon points={poly([[3, 50], [97, 50], [97, 47.5], [3, 47.5]])} fill="rgba(255,255,255,.35)" stroke="#fff" strokeWidth=".35" />
                    <polygon points={poly([[6, 96], [94, 96], [94, 99], [6, 99]])} fill="rgba(180,220,255,.2)" />
                </svg>
                {cards.map((c, i) => {
                    const p = proj(c.x, c.y);
                    return (
                        <span key={i} className={`fxg-pc ${c.me ? 'is-me' : ''} ${!c.nm ? 'is-open' : ''}`} style={{ left: `${p.x}%`, top: `${p.y}%`, zIndex: 90, '--s': (0.82 + 0.26 * p.k).toFixed(3) } as React.CSSProperties}>
                            {c.nm ? (
                                <>
                                    <span className="fxg-pc__top"><b>{c.me && me ? me.points : '–'}</b><small>{c.me ? 'PTS' : 'PRT'}</small></span>
                                    <span className="fxg-pc__face">{has || !c.me ? initialsOf(c.nm) : '?'}</span>
                                    <span className="fxg-pc__name">{c.me ? 'You' : c.nm.split(' ').slice(-1)[0]}</span>
                                </>
                            ) : <span className="fxg-pc__open">{c.tag}</span>}
                        </span>
                    );
                })}
            </span>
        </button>
    );
};

const PitchPanel: React.FC<{ d?: SportData; name?: string; onOpen: () => void; label?: string; build?: 'futsal' | 'football' }> = ({ d, name, onOpen, label, build }) => {
    // No squad yet: the same pitch in a default shape with the player in the middle, so first visits look like every other.
    const placeholder = !d?.team || !d.cat;
    const [ph, phShape, phMe] = build === 'futsal' ? [5, '1-2-1', 1] : [11, '4-3-3', 6];
    const { formation, players } = placeholder
        ? { formation: phShape, players: FORMATIONS[ph][phShape].map(([x, y], i) => ({ x, y, player: i === phMe ? { id: 'me', name: name || 'You' } as SquadPlayer : undefined })) }
        : savedLineup(d!.team!, d!.cat!.rules.onPitch);
    const roleOf = (y: number, i: number) => (i === 0 ? 'GK' : y >= 55 ? 'DEF' : y >= 35 ? 'MID' : 'FWD');
    // Perspective: far end at 64% width; depth also scales the cards a little.
    const proj = (x: number, y: number) => { const k = y / 100; return { x: 50 + (x - 50) * (0.64 + 0.36 * k), y: 5 + 90 * (0.1 + 0.9 * k) - 4, k }; };
    const P = (x: number, y: number) => { const p = proj(x, y); return `${p.x},${p.y}`; };
    const poly = (pts: [number, number][]) => pts.map(([x, y]) => P(x, y)).join(' ');
    const ellipse = (cx: number, cy: number, r: number, from = 0, to = 360) => {
        const pts: [number, number][] = [];
        for (let a = from; a <= to; a += 10) pts.push([cx + r * Math.cos((a * Math.PI) / 180), cy + r * 1.4 * Math.sin((a * Math.PI) / 180)]);
        return poly(pts);
    };
    const big = players.length <= 7;
    return (
        <button type="button" className="fxg-panel fxg-pitch" onClick={onOpen} aria-label="Open my squad">
            <span className="fxg-panel__head">
                {label && <em className="fxg-panel__eyebrow">{label}</em>}
                <b>{placeholder ? (build ? 'Build your squad' : 'Your squad') : d!.team!.name}</b>
                <small>{placeholder ? (build ? 'Add players, rate them, set the formation and subs' : 'Join a futsal or football squad to fill this pitch') : `${formation} · ${d!.cat!.rules.onPitch} a side`}</small>
            </span>
            <span className={`fxg-pitch__field ${big ? 'is-small-side' : ''}`}>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <defs>
                        <linearGradient id="fxg-grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1B6B35" /><stop offset=".55" stopColor="#24873F" /><stop offset="1" stopColor="#2FA34D" /></linearGradient>
                        <radialGradient id="fxg-light" cx=".5" cy=".55" r=".65"><stop offset="0" stopColor="rgba(255,255,255,.18)" /><stop offset="1" stopColor="rgba(0,0,0,.28)" /></radialGradient>
                        <linearGradient id="fxg-edge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1a3d24" /><stop offset="1" stopColor="#0b1d12" /></linearGradient>
                    </defs>
                    <polygon points={poly([[0, 100], [100, 100], [100, 104], [0, 104]])} fill="url(#fxg-edge)" />
                    <polygon points={poly([[0, 0], [100, 0], [100, 100], [0, 100]])} fill="url(#fxg-grass)" />
                    {Array.from({ length: 10 }, (_, i) => <polygon key={i} points={poly([[0, i * 10], [100, i * 10], [100, i * 10 + 5], [0, i * 10 + 5]])} fill="rgba(255,255,255,.055)" />)}
                    <polygon points={poly([[0, 0], [100, 0], [100, 100], [0, 100]])} fill="url(#fxg-light)" />
                    <g fill="none" stroke="rgba(255,255,255,.82)" strokeWidth=".45" strokeLinejoin="round">
                        <polygon points={poly([[3, 3], [97, 3], [97, 97], [3, 97]])} />
                        <polyline points={poly([[3, 50], [97, 50]])} />
                        <polyline points={ellipse(50, 50, 11)} />
                        <polygon points={poly([[26, 3], [74, 3], [74, 19], [26, 19]])} />
                        <polygon points={poly([[38, 3], [62, 3], [62, 9], [38, 9]])} />
                        <polygon points={poly([[26, 81], [74, 81], [74, 97], [26, 97]])} />
                        <polygon points={poly([[38, 91], [62, 91], [62, 97], [38, 97]])} />
                        <polyline points={ellipse(50, 19, 7, 20, 160)} />
                        <polyline points={ellipse(50, 81, 7, 200, 340)} />
                    </g>
                    <g fill="rgba(255,255,255,.9)">
                        <circle cx={proj(50, 50).x} cy={proj(50, 50).y} r=".7" />
                        <circle cx={proj(50, 14).x} cy={proj(50, 14).y} r=".55" />
                        <circle cx={proj(50, 86).x} cy={proj(50, 86).y} r=".7" />
                    </g>
                    {/* Goals */}
                    <polygon points={poly([[43, 3], [57, 3], [57, 0.6], [43, 0.6]])} fill="rgba(255,255,255,.18)" stroke="#fff" strokeWidth=".5" />
                    <polygon points={poly([[42, 97], [58, 97], [58, 100.5], [42, 100.5]])} fill="rgba(255,255,255,.18)" stroke="#fff" strokeWidth=".6" />
                </svg>
                {players.map(({ x, y, player }, i) => {
                    const p = proj(x, y);
                    const me = !!player && (placeholder || (!!d?.me && player.id === d.me.id));
                    const ovr = player && !placeholder ? overall(d!.lines.get(player.id)) : null;
                    // Like FIFA: the card shows the role of the spot on the pitch, not the registered position.
                    const pos = roleOf(y, i);
                    return (
                        <span key={i} className={`fxg-pc ${me ? 'is-me' : ''} ${!player ? 'is-open' : ''}`}
                            style={{ left: `${p.x}%`, top: `${p.y}%`, zIndex: Math.round(y), '--s': (0.82 + 0.26 * p.k).toFixed(3) } as React.CSSProperties}>
                            {player ? (
                                <>
                                    <span className="fxg-pc__top"><b>{ovr ?? '–'}</b><small>{pos}</small></span>
                                    <span className="fxg-pc__face">{player.number ?? (placeholder ? '?' : player.name.split(' ').map(w => w[0]).join('').slice(0, 2))}</span>
                                    <span className="fxg-pc__name">{placeholder ? 'You' : player.name.split(' ').slice(-1)[0]}</span>
                                </>
                            ) : <span className="fxg-pc__open">{pos}</span>}
                        </span>
                    );
                })}
            </span>
        </button>
    );
};

export interface EventItem { key: string; id: string; sport: 'padel' | 'futsal' | 'football'; name: string; banner?: string; start?: string; end?: string; venue?: string; open: boolean; live: boolean; past?: boolean; register: string; view: string; teams?: number }

/** Upcoming and ongoing tournaments in every sport, soonest first, with where to register and watch. */
/** A calendar day from a stored date that may or may not carry a time ("2026-11-17" or "2026-11-17T16:00"). */
const dayDate = (d: string) => { const v = new Date(`${String(d).slice(0, 10)}T00:00:00`); return Number.isNaN(v.getTime()) ? new Date(d) : v; };

export const upcomingEvents = (padel: PadelData, tournaments: FutsalTournament[], teams: FutsalTeam[] = [], includePast = false): EventItem[] => {
    const today = new Date().toISOString().slice(0, 10);
    const ended = (status?: string, end?: string) => ['COMPLETED', 'RETIRED'].includes(String(status).toUpperCase()) || (!!end && end < today);
    const padelItems: EventItem[] = padel.tournaments
        .filter(t => String(t.status).toUpperCase() !== 'DRAFT' && (includePast || !ended(t.status, t.endDate)))
        .map(t => ({
            key: `p-${t.id}`, id: t.id, sport: 'padel', name: t.name, banner: t.bannerUrl, start: t.startDate, end: t.endDate, venue: [t.venue, t.city].filter(Boolean).join(' · '),
            past: ended(t.status, t.endDate),
            open: !ended(t.status, t.endDate) && (t.registrationDeadline || t.startDate || today) >= today, live: !ended(t.status, t.endDate) && !!t.startDate && t.startDate <= today,
            register: `register/${t.slug || t.id}`, view: `live/${t.id}`,
        }));
    const teamItems: EventItem[] = tournaments
        .filter(t => t.status !== 'DRAFT' && (includePast || !ended(t.status, t.endDate)))
        .map(t => ({
            key: `f-${t.id}`, id: t.id, sport: sportOf(t), name: t.name, banner: t.bannerUrl, start: t.startDate, end: t.endDate, venue: [t.venue, t.city].filter(Boolean).join(' · '),
            past: ended(t.status, t.endDate),
            open: t.status === 'REGISTRATION', live: t.status === 'ACTIVE' && !!t.startDate && t.startDate <= today,
            register: `${publicPath(t)}/register`, view: `live/futsal:${t.id}`,
            teams: teams.filter(x => x.tournamentId === t.id && x.status === 'ACCEPTED').length,
        }));
    // Upcoming and live first (soonest first), then past events (most recent first).
    return [...padelItems, ...teamItems].sort((a, b) => Number(!!a.past) - Number(!!b.past)
        || (a.past ? String(b.start || '').localeCompare(String(a.start || '')) : String(a.start || '9').localeCompare(String(b.start || '9'))));
};

/** Home's Events strip: every event's banner, sliding to the next on its own; swipe, scroll or use the arrows. */
const EventCarousel: React.FC<{ events: EventItem[]; onOpen: () => void }> = ({ events, onOpen }) => {
    const [i, setI] = useState(0);
    const [held, setHeld] = useState(false);
    const [tick, setTick] = useState(0); // restarts the timer after a manual move
    const touch = useRef<number | null>(null);
    const n = events.length;
    useEffect(() => { if (i >= n) setI(0); }, [n, i]);
    // Slides itself every 4.5s; only a finger on it holds it still.
    useEffect(() => {
        if (n < 2 || held) return;
        const t = setInterval(() => setI(x => (x + 1) % n), 4500);
        return () => clearInterval(t);
    }, [n, held, tick]);
    const go = (d: number) => { setI(x => (x + d + n) % n); setTick(t => t + 1); };
    const to = (k: number) => { setI(k); setTick(t => t + 1); };
    // Dots: at most 12, a window that follows the current slide.
    const win = Math.min(12, n);
    const start = Math.max(0, Math.min(n - win, i - Math.floor(win / 2)));
    const range = (e: EventItem) => [e.start, e.end && e.end !== e.start ? e.end : ''].filter(Boolean).map(d => dayDate(d).toLocaleDateString([], { day: 'numeric', month: 'short', year: e.past ? 'numeric' : undefined })).join(' – ');
    if (!n) return (
        <button type="button" className="fxg-tile fxg-events fxg-events--empty" onClick={onOpen}><span className="fxg-tile__text"><b>Events</b><small>Tournaments appear here as organisers publish them.</small></span></button>
    );
    return (
        <div className="fxg-events"
            onTouchStart={e => { setHeld(true); touch.current = e.touches[0].clientX; }}
            onTouchEnd={e => { const x0 = touch.current; touch.current = null; setHeld(false); if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); }}>
            <div className="fxg-events__track" style={{ transform: `translateX(-${i * 100}%)` }}>
                {events.map((e, k) => (
                    <button key={e.key} type="button" className="fxg-events__slide" tabIndex={k === i ? 0 : -1} aria-hidden={k !== i} style={e.banner ? { backgroundImage: `url("${e.banner}")` } : undefined} onClick={onOpen} aria-label={`${e.name}, ${range(e)}`}>
                        <span className="fxg-events__label">
                            <em className={`qp-sport is-${e.sport}`}>{SPORT_LABELS[e.sport]}</em>
                            <b>{e.name}</b>
                            <small>{e.live ? 'Live now' : e.past ? 'Finished' : e.open ? 'Registration open' : 'Upcoming'}{range(e) ? ` · ${range(e)}` : ''}</small>
                        </span>
                    </button>
                ))}
            </div>
            <span className="fxg-events__title">Events</span>
            {n > 1 && (
                <>
                    <button type="button" className="fxg-events__arrow is-prev" onClick={() => go(-1)} aria-label="Previous event"><ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} /></button>
                    <button type="button" className="fxg-events__arrow is-next" onClick={() => go(1)} aria-label="Next event"><ChevronRight size={20} /></button>
                    <span className="fxg-events__count">{i + 1} / {n}</span>
                    <span className="fxg-dots fxg-events__dots">{events.slice(start, start + win).map((_, k) => <i key={start + k} className={start + k === i ? 'is-on' : ''} onClick={() => to(start + k)} />)}</span>
                </>
            )}
        </div>
    );
};

const EventsPage: React.FC<{ padel: PadelData; tournaments: FutsalTournament[]; teams: FutsalTeam[]; onNavigate: (t: string) => void; only?: StatSport }> = ({ padel, tournaments, teams, onNavigate, only }) => {
    const [pick, setPick] = useState<'all' | 'padel' | 'futsal' | 'football'>(only || 'all');
    // Past events too, under their own heading (registration pages only list what you can still enter).
    const all = useMemo(() => upcomingEvents(padel, tournaments, teams, !only), [padel, tournaments, teams, only]);
    const list = all.filter(e => pick === 'all' || e.sport === pick);
    const upcoming = list.filter(e => !e.past);
    const past = list.filter(e => e.past);
    const card = (e: EventItem) => (
        <article key={e.key} className={`fxe-card ${e.past ? 'is-past' : ''}`}>
            <div className="fxe-card__img" style={e.banner ? { backgroundImage: `url("${e.banner}")` } : undefined}>
                <span className={`qp-sport is-${e.sport}`}>{SPORT_LABELS[e.sport]}</span>
                {e.past ? <span className="fxe-badge is-past">Ended</span> : e.live ? <span className="fxe-badge is-live">Live</span> : e.open ? <span className="fxe-badge is-open">Registration open</span> : null}
            </div>
            <div className="fxe-card__body">
                <b>{e.name}</b>
                <small><CalendarDays size={13} /> {range(e) || 'Dates to be announced'}</small>
                {e.venue && <small><MapPin size={13} /> {e.venue}</small>}
                <div className="fxe-card__btns">
                    {e.open && <button type="button" className="qp-btn qp-btn--primary" onClick={() => { window.location.hash = e.register; }}>{e.sport === 'padel' ? 'Register your pair' : 'Register your team'}</button>}
                    <button type="button" className="qp-btn" onClick={() => onNavigate(e.view)}><Tv size={15} /> {e.past ? 'Results' : e.live ? 'Watch live' : 'View'}</button>
                </div>
            </div>
        </article>
    );
    const range = (e: EventItem) => [e.start, e.end && e.end !== e.start ? e.end : ''].filter(Boolean).map(d => dayDate(d).toLocaleDateString([], { day: 'numeric', month: 'short' })).join(' – ');
    return (
        <div className="fxe">
            <div className="fxe-head">
                <div><span className="fxs-label">{only ? `Register · ${SPORT_LABELS[only]}` : 'Events'}</span><p className="qp-muted">{only ? `${SPORT_LABELS[only]} tournaments you can enter${only === 'padel' ? ' with your partner' : ' with your team'}, plus what's on now.` : 'Live, upcoming and past tournaments. Register your team, watch live, or look back at results.'}</p></div>
                {!only && <div className="fxs-filter">
                    {(['all', 'padel', 'futsal', 'football'] as const).map(k => <button key={k} type="button" className={pick === k ? 'is-on' : ''} onClick={() => setPick(k)}>{k === 'all' ? 'All sports' : SPORT_LABELS[k]} <small>{k === 'all' ? all.length : all.filter(e => e.sport === k).length}</small></button>)}
                </div>}
            </div>
            {upcoming.length ? <div className="fxe-grid">{upcoming.map(card)}</div>
                : <div className="qp-empty fxs-card"><b>No upcoming events</b><span>New tournaments appear here as organisers publish them.</span></div>}
            {past.length > 0 && <>
                <h3 className="fxe-sub">Past events <small>{past.length}</small></h3>
                <div className="fxe-grid">{past.map(card)}</div>
            </>}
        </div>
    );
};

/** Futsal / football home: Team Management on the pitch, Quick Play up front, Register, Matches and Stats tiles. */
const SportLanding: React.FC<{ sport: 'futsal' | 'football'; d: SportData; name: string; quick: QuickMatch[]; events: EventItem[]; who: { uid?: string; email?: string }; onGo: (p: Page) => void }> = ({ sport, d, name, quick, events, who, onGo }) => {
    const P = (x: TeamPage): Page => (sport === 'football' ? FOOTBALL_PAGE[x] : x);
    const label = sport === 'football' ? 'Football' : 'Futsal';
    const upcomingQuick = quick.filter(m => m.status !== 'COMPLETED').sort((a, b) => a.startAt.localeCompare(b.startAt))[0];
    const finishedQuick = quick.filter(m => m.status === 'COMPLETED' && sideOf(m, who));
    const open = events.filter(e => e.open);
    const banner = (open.find(e => e.banner) || events.find(e => e.banner))?.banner;
    const record = (() => {
        const res = [...d.played.map(h => h.result), ...finishedQuick.map(m => (m.winner === 'draw' ? 'D' : m.winner === sideOf(m, who) ? 'W' : 'L'))];
        return `${res.filter(r => r === 'W').length}W ${res.filter(r => r === 'D').length}D ${res.filter(r => r === 'L').length}L`;
    })();
    return (
        <div className="fxl">
            <div className="fxl-left">
                <button type="button" className={`fxg-tile is-featured fxl-big ${TILE_PHOTOS[sport] ? 'has-photo' : ''}`} style={TILE_PHOTOS[sport] ? { '--photo': `url("${TILE_PHOTOS[sport]}")` } as React.CSSProperties : undefined} onClick={() => onGo(P('quick'))}>
                    <span className="fxg-tile__text">
                        <b>Quick Play</b>
                        <small>{upcomingQuick ? `Next: ${upcomingQuick.home.name} v ${upcomingQuick.away.name} · ${new Date(upcomingQuick.startAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}` : `Set up a ${label.toLowerCase()} match with friends, invite them by email and share a referee code.`}</small>
                    </span>
                    <span className="fxl-cta"><Play size={16} /> Kick off</span>
                </button>
                <div className="fxl-row">
                    <button type="button" className={`fxg-tile fxl-small ${banner ? 'has-banner' : ''}`} style={banner ? { backgroundImage: `url("${banner}")` } : undefined} onClick={() => onGo(P('register'))}>
                        <span className="fxg-tile__text"><b>Register</b><small>{open.length ? `${open.length} open` : 'No open events'}</small></span>
                        {!banner && <span className="fxg-tile__icon"><Trophy /></span>}
                    </button>
                    <button type="button" className={`fxg-tile fxl-small ${TILE_PHOTOS.live ? 'has-photo' : ''}`} style={TILE_PHOTOS.live ? { '--photo': `url("${TILE_PHOTOS.live}")` } as React.CSSProperties : undefined} onClick={() => onGo(P('matches'))}>
                        <span className="fxg-tile__text"><b>Matches</b><small>{record}</small></span>
                    </button>
                    <button type="button" className={`fxg-tile fxl-small ${TILE_PHOTOS.rankings ? 'has-photo' : ''}`} style={TILE_PHOTOS.rankings ? { '--photo': `url("${TILE_PHOTOS.rankings}")` } as React.CSSProperties : undefined} onClick={() => onGo(P('stats'))}>
                        <span className="fxg-tile__text"><b>Stats</b><small>{(d.mineLine?.goals || 0)} goals · {(d.mineLine?.assists || 0)} assists</small></span>
                    </button>
                </div>
            </div>
            <div className="fxl-right">
                {d.team && d.cat ? <PitchPanel d={d} label="Team management" onOpen={() => onGo(P('squad'))} /> : <PitchPanel name={name} label="Team management" build={sport} onOpen={() => onGo(P('squad'))} />}
            </div>
        </div>
    );
};

/** Padel home: four tall cards (Quick Play, Stats, Register Now, Previous Matches). */
const PadelLanding: React.FC<{ padel: PadelData; quick: QuickMatch[]; events: EventItem[]; who: { uid?: string; email?: string }; onGo: (p: Page) => void }> = ({ padel, quick, events, who, onGo }) => {
    const pm = padel.me;
    const open = events.filter(e => e.open);
    const next = open[0] || events[0];
    const lastQuick = quick.filter(m => m.status === 'COMPLETED' && sideOf(m, who)).sort((a, b) => b.startAt.localeCompare(a.startAt))[0];
    const lastEvent = padel.events.find(e => e.status === 'COMPLETED') || padel.events[0];
    const cards: { key: string; title: string; kicker: string; lines: React.ReactNode; img?: string; page: Page; tone: 'blue' | 'orange' }[] = [
        { key: 'quick', title: 'Quick Play', kicker: 'Kick off', lines: <><b>Your pair</b><i className="pdl-v">V</i><b>Their pair</b></>, img: TILE_PHOTOS.padel, page: 'padel-quick', tone: 'orange' },
        { key: 'stats', title: 'Stats', kicker: pm ? `#${pm.rank} in Pakistan` : 'Unranked', lines: <><b className="pdl-big">{pm?.points ?? 0}</b><small>ranking points</small><small>{pm ? `${pm.wins}W · ${pm.losses}L` : 'Play a ranked event to get on the board'}</small></>, img: TILE_PHOTOS.rankings, page: 'padel-stats', tone: 'blue' },
        { key: 'register', title: 'Register Now', kicker: open.length ? `${open.length} open` : 'Coming soon', lines: <>{next ? <><b>{next.name}</b><small>{next.start ? dayDate(next.start).toLocaleDateString([], { day: 'numeric', month: 'short' }) : ''}{next.venue ? ` · ${next.venue}` : ''}</small></> : <small>New padel events appear here.</small>}</>, img: next?.banner || TILE_PHOTOS.live, page: 'padel-register', tone: 'blue' },
        { key: 'squad', title: 'Squad', kicker: 'Your pair', lines: <><b>Pair &amp; reserves</b><small>Add your partner, set sides and ratings</small></>, img: TILE_PHOTOS.padel, page: 'padel-squad', tone: 'blue' },
        { key: 'history', title: 'Previous Matches', kicker: 'Your record', lines: <>{lastQuick ? <><b>{lastQuick.home.name} v {lastQuick.away.name}</b><small>{scoreText(lastQuick)} · Quick Play</small></> : lastEvent ? <><b>{lastEvent.name}</b><small>with {lastEvent.partner}</small></> : <small>No matches yet</small>}</>, img: TILE_PHOTOS.spectator, page: 'padel-history', tone: 'orange' },
    ];
    return (
        <div className="pdl">
            {cards.map(c => (
                <button key={c.key} type="button" className={`pdl-card is-${c.tone}`} onClick={() => onGo(c.page)}>
                    <span className="pdl-card__img" style={c.img ? { backgroundImage: `url("${c.img}")` } : undefined} aria-hidden="true" />
                    <span className="pdl-card__stripes" aria-hidden="true" />
                    <span className="pdl-card__top"><em>{c.kicker}</em></span>
                    <span className="pdl-card__body">
                        <b className="pdl-card__title">{c.title}</b>
                        <span className="pdl-card__lines">{c.lines}</span>
                    </span>
                </button>
            ))}
        </div>
    );
};

type StatSport = 'padel' | 'futsal' | 'football';
interface FormItem { result: 'W' | 'D' | 'L'; at: string; label: string }

/** One sport's (or every sport's) numbers: tournaments plus Quick Play matches the player was in. */
const statsFor = (only: StatSport | 'all', padel: PadelData, futsal: SportData, football: SportData, quick: QuickMatch[], who: { uid?: string; email?: string }) => {
    const on = (s: StatSport) => only === 'all' || only === s;
    const pm = padel.me;
    let played = 0, wins = 0, goals = 0, assists = 0, motm = 0, ratingSum = 0, ratingN = 0;
    const bySport: Record<StatSport, number> = { padel: 0, futsal: 0, football: 0 };
    const types = new Map<string, number>();
    const form: FormItem[] = [];
    if (on('padel') && pm) { played += pm.wins + pm.losses; wins += pm.wins; bySport.padel += pm.wins + pm.losses; }
    ([['futsal', futsal], ['football', football]] as const).forEach(([k, d]) => {
        if (!on(k)) return;
        const c = d.career;
        played += c.played; wins += c.wins; bySport[k] += c.played;
        goals += c.goals; assists += c.assists; motm += c.motm;
        if (c.ratingN) { ratingSum += c.ratingSum / c.ratingN; ratingN++; }
        c.types.forEach((v, name) => types.set(name, (types.get(name) || 0) + v));
        c.form.forEach(f => form.push(f));
    });
    quick.filter(m => m.status === 'COMPLETED' && on(m.sport)).forEach(m => playerGames(m, who).forEach(g => {
        played++; bySport[m.sport]++;
        if (g.result === 'W') wins++;
        goals += g.goals;
        if (g.goals) types.set('Quick Play', (types.get('Quick Play') || 0) + g.goals);
        form.push({ result: g.result, at: g.at, label: g.label });
    }));
    form.sort((x, y) => y.at.localeCompare(x.at));
    return { played, wins, goals, assists, motm, rating: ratingN ? ratingSum / ratingN : 0, bySport, types, form: form.slice(0, 5) };
};

/** Season stats on one screen: five counters with recent form, then a skill pentagon and how you score. */
const SeasonStats: React.FC<{ padel: PadelData; futsal: SportData; football: SportData; quick: QuickMatch[]; who: { uid?: string; email?: string }; fixed?: StatSport }> = ({ padel, futsal, football, quick, who, fixed }) => {
    const [pick, setPick] = useState<StatSport | 'all'>('all');
    const only = fixed || pick;
    const st = useMemo(() => statsFor(only, padel, futsal, football, quick, who), [only, padel, futsal, football, quick, who]);
    const { played, wins, goals, assists, motm, rating } = st;
    const teamPlayed = st.bySport.futsal + st.bySport.football;
    const winPct = played ? Math.round((wins / played) * 100) : 0;
    const per = (n: number) => (teamPlayed ? n / teamPlayed : 0);
    const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
    const isPadel = only === 'padel';
    const pm = padel.me;
    // Each axis is 0–100 from real numbers: 2 goals a match, 1.5 assists a match, 20 matches played … score full marks.
    const skills = isPadel
        ? [
            { k: 'Winning', v: winPct },
            { k: 'Activity', v: clamp(played * 5) },
            { k: 'Ranking', v: pm ? clamp(100 - (pm.rank / Math.max(1, padel.total)) * 100) : 0 },
            { k: 'Events', v: clamp((pm?.tournaments || 0) * 15) },
            { k: 'Titles', v: clamp((pm?.results.filter(r => r.stage === 'CHAMPION').length || 0) * 34) },
        ]
        : [
            { k: 'Attack', v: clamp(per(goals) * 50) },
            { k: 'Creativity', v: clamp(per(assists) * 66) },
            { k: 'Winning', v: winPct },
            { k: 'Impact', v: clamp(rating ? rating * 20 : per(motm) * 200) },
            { k: 'Activity', v: clamp(played * 5) },
        ];
    const showGoals = !isPadel && goals > 0;
    const pie = showGoals
        ? [...st.types.entries()].map(([name, value]) => ({ name, value }))
        : isPadel
            ? [{ name: 'Won', value: wins }, { name: 'Lost', value: Math.max(0, played - wins) }].filter(x => x.value)
            : (['padel', 'futsal', 'football'] as const).map(k => ({ name: SPORT_LABELS[k], value: st.bySport[k] })).filter(x => x.value);
    const PIE_C = ['#4F6EF7', '#FF8A5B', '#F6EDDC', '#9DB8FF', '#E55C30', '#2F4FD9'];
    const rings = [
        { k: 'Played', v: played, of: Math.max(20, played), c: '#4F6EF7' },
        { k: 'Wins', v: wins, of: Math.max(1, played), c: '#4F6EF7' },
        { k: 'Win rate', v: winPct, of: 100, suffix: '%', c: '#FF8A5B' },
        ...(isPadel
            ? [{ k: 'Ranking pts', v: pm?.points || 0, of: Math.max(500, pm?.points || 0), c: '#4F6EF7' }, { k: 'Rank', v: pm?.rank || 0, of: Math.max(1, padel.total), c: '#4F6EF7', prefix: '#' }]
            : [{ k: 'Goals', v: goals, of: Math.max(20, goals), c: '#4F6EF7' }, { k: 'Assists', v: assists, of: Math.max(20, assists), c: '#4F6EF7' }]),
    ];
    const Ring = ({ v, of, suffix, prefix, c }: { v: number; of: number; suffix?: string; prefix?: string; c: string }) => {
        const r = 32, len = 2 * Math.PI * r, f = of ? Math.min(1, v / of) : 0;
        return (
            <svg viewBox="0 0 76 76" className="fxs-ring" aria-hidden="true">
                <circle cx="38" cy="38" r={r} fill="rgba(1, 8, 46, .55)" stroke="rgba(255,255,255,.12)" strokeWidth="5" />
                <circle cx="38" cy="38" r={r} fill="none" stroke={c} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${len * f} ${len}`} transform="rotate(-90 38 38)" style={{ filter: `drop-shadow(0 0 6px ${c})` }} />
                <text x="38" y="45" textAnchor="middle">{prefix && v ? <tspan fontSize="14">{prefix}</tspan> : null}{v ? (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v) : prefix ? '–' : 0}{suffix && <tspan fontSize="12">{suffix}</tspan>}</text>
            </svg>
        );
    };
    return (
        <section className="fxs" aria-label="Stats">
            {!fixed && (
                <div className="fxs-filter" role="tablist" aria-label="Sport">
                    {(['all', 'padel', 'futsal', 'football'] as const).map(k => (
                        <button key={k} type="button" role="tab" aria-selected={pick === k} className={pick === k ? 'is-on' : ''} onClick={() => setPick(k)}>{k === 'all' ? 'All sports' : SPORT_LABELS[k]}</button>
                    ))}
                </div>
            )}
            <div className="fxs-top fxs-card">
                <div className="fxs-rings">
                    {rings.map(r => <div key={r.k} className="fxs-ring-wrap"><Ring {...r} /><span>{r.k}</span></div>)}
                </div>
                <div className="fxs-form">
                    <span className="fxs-label">Recent form</span>
                    <div className="fxs-form__row">
                        {st.form.length ? st.form.map((h, i) => <b key={i} className={`fxs-chip is-${h.result}`} title={h.label}>{h.result}</b>) : <small>No matches yet</small>}
                    </div>
                    <small>{isPadel ? 'Quick Play padel results' : 'Tournaments and Quick Play'}</small>
                </div>
            </div>
            <div className="fxs-mid">
                <div className="fxs-card fxs-block">
                    <span className="fxs-label">Skill profile</span>
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={skills} outerRadius="74%">
                            <PolarGrid stroke="rgba(255,255,255,.18)" />
                            <PolarAngleAxis dataKey="k" tick={{ fill: '#C9D4FF', fontSize: 13, fontWeight: 700 }} />
                            <Radar dataKey="v" stroke="#6F8BFF" strokeWidth={2.5} fill="#4F6EF7" fillOpacity={0.35} dot={{ r: 4, fill: '#FF8A5B', stroke: '#fff', strokeWidth: 1.5 }} isAnimationActive={false} />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
                <div className="fxs-card fxs-block">
                    <span className="fxs-label">{showGoals ? 'How you score' : isPadel ? 'Won and lost' : 'Matches by sport'}</span>
                    {pie.length ? (
                        <div className="fxs-pie">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={pie} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="86%" paddingAngle={pie.length > 1 ? 3 : 0} stroke="none" isAnimationActive={false}>
                                        {pie.map((_, i) => <Cell key={i} fill={PIE_C[i % PIE_C.length]} />)}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <span className="fxs-pie__mid"><b>{pie.reduce((n, x) => n + x.value, 0)}</b><small>{showGoals ? 'goals' : 'matches'}</small></span>
                            <ul className="fxs-legend">
                                {pie.map((x, i) => <li key={x.name}><i style={{ background: PIE_C[i % PIE_C.length] }} />{x.name}<b>{x.value}</b></li>)}
                            </ul>
                        </div>
                    ) : <p className="fxs-empty">Play your first {fixed ? SPORT_LABELS[fixed].toLowerCase() + ' ' : ''}match and your breakdown appears here.</p>}
                </div>
            </div>
        </section>
    );
};
const SPORT_LABELS: Record<StatSport, string> = { padel: 'Padel', futsal: 'Futsal', football: 'Football' };

/** The portal's front page: each sport side by side, then all of them combined. */
const CombinedOverview: React.FC<{
    padel: PadelData; futsal: SportData; football: SportData;
    now: number; onGo: (p: Page) => void; onNavigate: (t: string) => void;
}> = ({ padel, futsal, football, onGo, onNavigate }) => {
    const pm = padel.me;
    const padelPlayed = pm ? pm.wins + pm.losses : 0;
    const team = ([['Futsal', futsal], ['Football', football]] as const).map(([label, d]) => {
        const played = d.matchLog.filter(h => h.played);
        return { label, d, played, wins: played.filter(h => h.result === 'W').length };
    });
    const [fs, fb] = team;
    const totalPlayed = padelPlayed + fs.played.length + fb.played.length;
    const totalWins = (pm?.wins || 0) + fs.wins + fb.wins;
    const titles = (pm?.results.filter(r => r.stage === 'CHAMPION').length || 0);
    // Matches per month across every sport (padel results are per tournament, dated by its start).
    type Key = 'Padel' | 'Futsal' | 'Football';
    const months = new Map<string, Record<Key, number> & { month: string; sort: string }>();
    const bump = (iso: string | undefined, key: Key, n: number) => {
        if (!iso || !n) return;
        const d = new Date(iso);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!months.has(k)) months.set(k, { month: d.toLocaleDateString([], { month: 'short', year: '2-digit' }), Padel: 0, Futsal: 0, Football: 0, sort: k });
        months.get(k)![key] += n;
    };
    pm?.results.forEach(r => bump(r.date, 'Padel', r.wins + r.losses));
    team.forEach(x => x.played.forEach(h => bump(h.m.startAt, x.label, 1)));
    const activity = [...months.values()].sort((a, b) => a.sort.localeCompare(b.sort)).slice(-8);
    const split = [{ name: 'Padel', value: padelPlayed }, { name: 'Futsal', value: fs.played.length }, { name: 'Football', value: fb.played.length }].filter(x => x.value);
    const vs = (d: SportData, m: FutsalMatch) => `${d.teams.find(t => t.id === m.homeId)?.name} v ${d.teams.find(t => t.id === m.awayId)?.name}`;
    const upcoming = [
        ...team.flatMap(({ label, d }) => [
            ...(d.live ? [{ k: `${label}-live`, sport: label, title: vs(d, d.live), when: 'Live now', go: () => onNavigate(`live/futsal:${d.tour?.id}`) }] : []),
            ...(d.next ? [{ k: `${label}-next`, sport: label, title: vs(d, d.next), when: new Date(d.next.startAt!).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), go: () => onGo(label === 'Football' ? 'football-matches' : 'matches') }] : []),
        ]),
        ...padel.events.filter(e => e.status !== 'COMPLETED' && (!e.endDate || new Date(e.endDate).getTime() >= Date.now() - 86400000)).slice(0, 3)
            .map(e => ({ k: `p-${e.id}`, sport: 'Padel', title: e.name, when: e.startDate ? new Date(e.startDate).toLocaleDateString([], { day: 'numeric', month: 'short' }) : 'Date TBC', go: () => onNavigate(`live/${e.id}`) })),
    ];
    const per = (pick: (x: typeof fs) => number, padelN: number) => `${padelN} padel · ${pick(fs)} futsal · ${pick(fb)} football.`;

    return (
        <>
            <div className="fxp-sports fxp-sports--3">
                <button type="button" className="admx-card fxp-sport" onClick={() => onGo('padel')}>
                    <span className="fxp-sport__tag"><Swords size={14} /> Padel</span>
                    <b className="fxp-sport__big">{pm?.points ?? 0}<small>ranking pts</small></b>
                    <span className="fxp-sport__row"><span>{pm ? `#${pm.rank} of ${padel.total}` : 'Unranked'}</span><span>{pm ? `${pm.wins}-${pm.losses}` : '0-0'} W-L</span><span>{pm?.tournaments ?? 0} events</span></span>
                    <span className="fxp-sport__go">Padel dashboard <ChevronRight size={14} /></span>
                </button>
                {team.map(({ label, d }) => (
                    <button key={label} type="button" className="admx-card fxp-sport" onClick={() => onGo(label === 'Football' ? 'football' : 'overview')}>
                        <span className="fxp-sport__tag">{label === 'Football' ? <Goal size={14} /> : <Volleyball size={14} />} {label}{d.team ? ` · ${d.team.name}` : ''}</span>
                        <b className="fxp-sport__big">{d.team ? d.ovr : '–'}<small>overall</small></b>
                        <span className="fxp-sport__row"><span>{d.mineLine?.goals ?? 0} goals</span><span>{d.mineLine?.assists ?? 0} assists</span><span>{d.mineLine?.ratedMatches ? `★ ${d.mineLine.rating.toFixed(1)}` : 'No ratings'}</span></span>
                        <span className="fxp-sport__go">{label} dashboard <ChevronRight size={14} /></span>
                    </button>
                ))}
            </div>
            <div className="fxp-kpis fxp-kpis--4">
                {[
                    { k: 'Matches played', v: totalPlayed, d: per(x => x.played.length, padelPlayed), icon: <Activity size={16} /> },
                    { k: 'Wins', v: totalWins, d: per(x => x.wins, pm?.wins || 0), icon: <Trophy size={16} /> },
                    { k: 'Win rate', v: totalPlayed ? `${Math.round((totalWins / totalPlayed) * 100)}%` : '–', d: 'All finished matches, every sport.', icon: <BarChart3 size={16} /> },
                    { k: 'Titles', v: titles, d: 'Tournaments won outright.', icon: <Star size={16} /> },
                ].map(x => (
                    <section key={x.k} className="admx-card fxp-kpi">
                        <div className="admx-card__head"><h4>{x.k}</h4><span className="admx-chip-ic">{x.icon}</span></div>
                        <b className="fxp-kpi__v">{x.v}</b>
                        <p className="fxp-explain">{x.d}</p>
                    </section>
                ))}
            </div>
            <div className="fxp-grid">
                <section className="admx-card fxp-span2">
                    <div className="admx-card__head"><div><h4>Matches per month</h4><p>How much you've played, split by sport.</p></div></div>
                    {activity.length ? (
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={activity}>
                                <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
                                <XAxis dataKey="month" stroke={MUTED} tickLine={false} axisLine={false} fontSize={12} />
                                <YAxis allowDecimals={false} stroke={MUTED} tickLine={false} axisLine={false} fontSize={12} width={24} />
                                <Tooltip {...chartTip} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Bar isAnimationActive={false} dataKey="Padel" stackId="a" fill={BLUE} />
                                <Bar isAnimationActive={false} dataKey="Futsal" stackId="a" fill={SKY} />
                                <Bar isAnimationActive={false} dataKey="Football" stackId="a" fill={LILAC} radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <p className="fxp-explain">Your activity chart starts with your first finished match.</p>}
                </section>
                <section className="admx-card">
                    <div className="admx-card__head"><div><h4>Sport split</h4><p>Share of your matches by sport.</p></div></div>
                    {split.length ? (
                        <ResponsiveContainer width="100%" height={240}>
                            <PieChart>
                                <Pie isAnimationActive={false} data={split} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="none">
                                    {split.map(x => <Cell key={x.name} fill={x.name === 'Padel' ? BLUE : x.name === 'Futsal' ? SKY : LILAC} />)}
                                </Pie>
                                <Tooltip {...chartTip} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <p className="fxp-explain">No matches yet.</p>}
                </section>
                <section className="admx-card fxp-span3">
                    <div className="admx-card__head"><div><h4>Coming up</h4><p>Live and upcoming across every sport.</p></div></div>
                    {upcoming.length ? (
                        <div className="fxp-list">
                            {upcoming.map(u => (
                                <button key={u.k} type="button" className="fxp-row fxp-row--btn" onClick={u.go}>
                                    <span className={`fxp-res ${u.when === 'Live now' ? 'is-live' : ''}`}>{u.sport}</span>
                                    <span className="fxp-row__main"><b>{u.title}</b><small>{u.when}</small></span>
                                    <ChevronRight size={16} />
                                </button>
                            ))}
                        </div>
                    ) : <p className="fxp-explain">Nothing scheduled. Find a tournament from Spectator mode.</p>}
                </section>
            </div>
        </>
    );
};

/**
 * A team sport's Matches screen on one fold: fixtures or quick matches on the left (tabs, scrolling),
 * the group table and the squad's numbers on the right, each scrolling on its own.
 */
const TeamMatches: React.FC<{
    sport: TeamSport; sportName: string; account: Account; team: FutsalTeam; me: SquadPlayer; tour: FutsalTournament; cat?: FutsalCategory;
    teams: FutsalTeam[]; catTeams: FutsalTeam[]; matches: FutsalMatch[]; teamMatches: FutsalMatch[]; matchLog: MatchLine[]; lines: Map<string, PlayerLine>; onOpenQuick: (id?: string) => void;
}> = ({ sport, sportName, account, team, me, tour, cat, teams, catTeams, matches, teamMatches, matchLog, lines, onOpenQuick }) => {
    const [tab, setTab] = useState<'fixtures' | 'quick'>('fixtures');
    const quickCount = useQuickCount(account.email, sport);
    const fixtures = [...teamMatches].sort((a, b) => String(a.startAt || '9').localeCompare(String(b.startAt || '9')));
    const upcoming = fixtures.filter(m => m.status !== 'COMPLETED');
    const done = fixtures.filter(m => m.status === 'COMPLETED').reverse();
    const record = matchLog.filter(h => h.played).reduce((r, h) => ({ ...r, [h.result]: r[h.result] + 1 }), { W: 0, D: 0, L: 0 });
    const table = cat ? computeStandings(catTeams.filter(t => !team.groupId || t.groupId === team.groupId).map(t => t.id), matches.filter(m => m.tournamentId === team.tournamentId && m.categoryId === cat.id && !isKnockout(m.stage) && (!team.groupId || m.group === team.groupId)), cat.rules, { includeLive: true }) : [];
    const finish = cat ? placements(cat, catTeams, matches.filter(m => m.tournamentId === team.tournamentId)).get(team.id) : undefined;
    const row = (m: FutsalMatch) => {
        const home = m.homeId === team.id;
        const opp = teams.find(x => x.id === (home ? m.awayId : m.homeId));
        const s = scoreOf(m);
        const h = matchLog.find(x => x.m.id === m.id);
        const d = m.startAt ? new Date(m.startAt) : null;
        return (
            <div key={m.id} className={`mx-row ${m.status === 'LIVE' ? 'is-live' : ''}`}>
                <span className="mx-row__date"><b>{d ? d.getDate() : '–'}</b><small>{d ? d.toLocaleDateString([], { month: 'short' }) : 'TBA'}{d ? ` · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</small></span>
                <span className="mx-row__main"><b>{home ? 'vs' : '@'} {opp?.name || 'TBD'}</b><small>{m.stage === 'GROUP' ? `Group ${m.group}` : STAGE_NAMES[m.stage]}{m.pitch ? ` · ${m.pitch}` : ''}</small></span>
                {m.status === 'COMPLETED' ? <span className={`mx-chip is-${h?.result}`}>{h?.result} {h?.score}{s.hasPens ? ` (${home ? s.pensHome : s.pensAway}-${home ? s.pensAway : s.pensHome}p)` : ''}</span>
                    : m.status === 'LIVE' ? <span className="mx-chip is-live">Live {home ? s.home : s.away}–{home ? s.away : s.home}</span>
                        : <span className="mx-chip">Upcoming</span>}
                <span className="mx-row__me">{h?.played ? <>{h.goals}G {h.assists}A<small>{h.rating ? `★ ${h.rating}` : ''}{h.motm ? ' · POTM' : ''}</small></> : '—'}</span>
            </div>
        );
    };
    return (
        <div className="mx mx--three">
            <section className="mx-panel mx-main">
                <header className="mx-head">
                    <div><span className="mx-kicker">{sportName} · {tour.name}{cat ? ` · ${cat.name}` : ''}</span><h3>Matches</h3></div>
                    <span className="mx-tabs" role="tablist">
                        <button type="button" role="tab" aria-selected={tab === 'fixtures'} className={tab === 'fixtures' ? 'is-on' : ''} onClick={() => setTab('fixtures')}>Fixtures <small>{fixtures.length}</small></button>
                        <button type="button" role="tab" aria-selected={tab === 'quick'} className={tab === 'quick' ? 'is-on' : ''} onClick={() => setTab('quick')}>Quick Play <small>{quickCount}</small></button>
                    </span>
                    {tab === 'quick' ? <button type="button" className="qx-ghost" onClick={() => onOpenQuick()}><Plus size={14} /> New match</button>
                        : <span className="mx-stat"><b>{record.W}-{record.D}-{record.L}</b><small>W-D-L</small></span>}
                </header>
                <div className="mx-scroll">
                    {tab === 'quick' ? <QuickMatchList bare account={account} sport={sport} onOpen={id => onOpenQuick(id)} onNew={() => onOpenQuick()} />
                        : fixtures.length ? <>
                            {upcoming.length > 0 && <><h5 className="mx-sub">Coming up</h5><div className="mx-rows">{upcoming.map(row)}</div></>}
                            {done.length > 0 && <><h5 className="mx-sub">Results</h5><div className="mx-rows">{done.map(row)}</div></>}
                        </> : <div className="qx-empty qx-empty--sm"><b>No fixtures yet</b><span>The organiser hasn’t scheduled your matches.</span></div>}
                </div>
            </section>
            <section className="mx-panel">
                <header className="mx-head"><div><span className="mx-kicker">{team.groupId ? `Group ${team.groupId}` : 'League'}</span><h3>Table</h3></div>{finish && <span className="mx-stat"><b>{finish.replace(/_/g, ' ').toLowerCase()}</b><small>Finish</small></span>}</header>
                <div className="mx-scroll">
                    <table className="mx-table">
                        <thead><tr><th>#</th><th>Team</th><th>P</th><th>GD</th><th>Pts</th></tr></thead>
                        <tbody>{table.map((r, i) => { const t = catTeams.find(x => x.id === r.teamId); return <tr key={r.teamId} className={r.teamId === team.id ? 'is-me' : ''}><td>{i + 1}</td><td>{t?.name}</td><td>{r.p}</td><td>{r.gd > 0 ? `+${r.gd}` : r.gd}</td><td><b>{r.pts}</b></td></tr>; })}</tbody>
                    </table>
                    <p className="mx-foot">Win {cat?.rules.points.win ?? 3} · draw {cat?.rules.points.draw ?? 1}. Top {cat?.advancePerGroup || 2} go through.</p>
                </div>
            </section>
            <section className="mx-panel">
                <header className="mx-head"><div><span className="mx-kicker">{team.name}</span><h3>Squad</h3></div></header>
                <div className="mx-scroll">
                    <table className="mx-table">
                        <thead><tr><th>#</th><th>Player</th><th>Apps</th><th>G</th><th>A</th><th>Rtg</th></tr></thead>
                        <tbody>{team.players.map((p, i) => { const l = lines.get(p.id); return <tr key={p.id} className={p.id === me.id ? 'is-me' : ''}><td>{p.number ?? '–'}</td><td>{p.name}{i === 0 && <span className="mx-tag">C</span>}{p.id === me.id && <span className="mx-tag is-you">You</span>}</td><td>{l?.apps || 0}</td><td>{l?.goals || 0}</td><td>{l?.assists || 0}</td><td>{l?.ratedMatches ? l.rating.toFixed(1) : '–'}</td></tr>; })}</tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};

export default FutsalPortal;
