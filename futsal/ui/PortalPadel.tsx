// Padel pages of the player portal, in the same shell and style as the futsal ones.
// Built from the live padel rankings (points, results per tournament) and the
// tournaments the player is registered in.
import React, { useMemo } from 'react';
import { Award, CalendarDays, Medal, Percent, Swords, Trophy, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useGlobalRankings } from '../../hooks/useGlobalRankings';
import { STAGE_LABELS, STAGE_WEIGHT, type KnockoutStage } from '../../lib/pointsSystems';
import { normalizeEmail, normalizeName, normalizePhone, personName } from '../../lib/playerIdentity';
import type { RankedPlayer } from '../../lib/globalLeaderboard';

interface Account { id?: string; uid?: string; email?: string; phone?: string; fullName?: string; name?: string }

const BLUE = '#4D78FF', SKY = '#8EC5FF', MUTED = 'rgba(255,255,255,.35)';
const PIE = ['#4D78FF', '#8EC5FF', '#A5B4FC', '#DCE3F7', '#2F59E5', '#6366F1'];
export const chartTip = { contentStyle: { background: '#17171b', border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, color: '#fff', fontSize: 12 }, labelStyle: { color: 'rgba(255,255,255,.6)' }, cursor: { fill: 'rgba(255,255,255,.04)' } };

const isMe = (p: any, a: Account) => {
    if (!p) return false;
    const uid = a.id || a.uid;
    if (uid && p.id === uid) return true;
    const em = normalizeEmail(a.email);
    if (em && normalizeEmail(p.email) === em) return true;
    const ph = normalizePhone(a.phone);
    return !!ph && normalizePhone(p.phone) === ph;
};

export interface PadelData {
    loading: boolean;
    me?: RankedPlayer;
    rankings: RankedPlayer[];
    total: number;
    events: { id: string; name: string; startDate?: string; endDate?: string; status?: string; partner: string; category?: string }[];
    partners: { name: string; events: number; last: string }[];
    /** Every padel tournament (for the Events page), lightest fields only. */
    tournaments: { id: string; slug?: string; name: string; bannerUrl?: string; startDate?: string; endDate?: string; status?: string; venue?: string; city?: string; registrationDeadline?: string }[];
}

/** Everything the portal needs about the player's padel, from live data. */
export const usePadelData = (account: Account): PadelData => {
    const { rankings, tournaments, loading } = useGlobalRankings();
    return useMemo(() => {
        const uid = account.id || account.uid;
        let me = rankings.find(r => uid && r.uid === uid);
        const events: PadelData['events'] = [];
        const myNames = new Set<string>();
        const partners = new Map<string, { name: string; events: number; last: string }>();
        tournaments.forEach((t: any) => (t.teams || []).forEach((team: any) => {
            if (team.status && !['ACCEPTED', 'APPROVED'].includes(String(team.status).toUpperCase())) return;
            const mine = isMe(team.player1, account) ? team.player2 : isMe(team.player2, account) ? team.player1 : null;
            if (!mine && !isMe(team.player1, account) && !isMe(team.player2, account)) return;
            const self = isMe(team.player1, account) ? team.player1 : team.player2;
            if (personName(self)) myNames.add(normalizeName(personName(self)));
            const partner = personName(mine) || 'Partner TBD';
            events.push({ id: t.id, name: t.name, startDate: t.startDate, endDate: t.endDate, status: t.status, partner, category: t.categories?.find((c: any) => c.id === team.categoryId)?.name });
            const k = partner.toLowerCase();
            const prev = partners.get(k);
            if (!prev || String(t.startDate) > prev.last) partners.set(k, { name: partner, events: (prev?.events || 0) + 1, last: String(t.startDate || '') });
            else prev.events++;
        }));
        events.sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
        // Results typed in by name aren't linked to the account: match the ranking row with
        // the name used in those entries that shares at least one of the same tournaments.
        if (!me && myNames.size) {
            const mine = new Set(events.map(e => e.id));
            me = rankings.find(r => myNames.has(normalizeName(r.name)) && r.results.some(x => mine.has(x.tournamentId)));
        }
        const list = tournaments.map((t: any) => ({ id: t.id, slug: t.slug, name: t.name, bannerUrl: t.bannerUrl, startDate: t.startDate, endDate: t.endDate, status: t.status, venue: t.venue, city: t.city, registrationDeadline: t.registrationDeadline }));
        return { loading, me, rankings, total: rankings.length, events, partners: [...partners.values()].sort((a, b) => b.events - a.events), tournaments: list };
    }, [rankings, tournaments, loading, account]);
};

const stageLabel = (s?: string) => (s ? STAGE_LABELS[s as KnockoutStage] || s : 'Group stage');
const bestStage = (r?: RankedPlayer) => r?.results.map(x => x.stage || '').sort((a, b) => (STAGE_WEIGHT[b as KnockoutStage] || 0) - (STAGE_WEIGHT[a as KnockoutStage] || 0))[0] || '';

const Kpi: React.FC<{ k: string; v: React.ReactNode; d: string; icon: React.ReactNode }> = ({ k, v, d, icon }) => (
    <section className="admx-card fxp-kpi">
        <div className="admx-card__head"><h4>{k}</h4><span className="admx-chip-ic">{icon}</span></div>
        <b className="fxp-kpi__v">{v}</b>
        <p className="fxp-explain">{d}</p>
    </section>
);

const NoPadel: React.FC<{ onNavigate: (t: string) => void }> = ({ onNavigate }) => (
    <section className="admx-card fxp-empty">
        <h2>No padel results yet</h2>
        <p>Your padel ranking, results and partners appear here after your first tournament. If you've played under a different email, link it from Profile &amp; invites.</p>
        <button type="button" className="fxp-link" onClick={() => onNavigate('register')}>Find a padel tournament</button>
    </section>
);

export const PadelDashboard: React.FC<{ data: PadelData; onNavigate: (t: string) => void }> = ({ data, onNavigate }) => {
    const { me } = data;
    const played = me ? me.wins + me.losses : 0;
    const titles = me ? me.results.filter(r => r.stage === 'CHAMPION').length : 0;
    const perEvent = (me?.results || []).slice().reverse().map(r => ({ name: r.tournamentName.length > 14 ? `${r.tournamentName.slice(0, 13)}…` : r.tournamentName, Points: r.points, Won: r.wins, Lost: r.losses }));
    const tiers = Object.entries(me?.tierCounts || {}).map(([name, value]) => ({ name, value }));
    return (
        <>
            <div className="admx-bento">
                <section className="admx-card fxp-pass-wrap">
                    <div className="admx-passcard fxp-pass">
                        <div className="admx-passcard__top"><span className="fxp-pass__team">Padel ranking</span><span className="fxp-pass__badge">{me ? (me.results[0]?.division || 'Men') : 'Unranked'}</span></div>
                        <span className="admx-passcard__label">Ranking points</span>
                        <span className="admx-passcard__value">{me?.points ?? 0}</span>
                        <span className="admx-passcard__label">{me ? `#${me.rank} of ${data.total} ranked players` : 'Play a tournament to get on the board.'}</span>
                        <p className="fxp-explain light">Points come from how far you go in each tournament, weighted by its tier (Local, Bronze, Silver, Gold).</p>
                    </div>
                </section>
                <div className="fxp-kpis">
                    <Kpi k="Matches" v={played} d="Padel matches played in ranked tournaments." icon={<Swords size={16} />} />
                    <Kpi k="Wins" v={me?.wins ?? 0} d={`${me?.losses ?? 0} lost.`} icon={<Trophy size={16} />} />
                    <Kpi k="Win rate" v={played ? `${Math.round(((me?.wins || 0) / played) * 100)}%` : '–'} d="Share of padel matches you won." icon={<Percent size={16} />} />
                    <Kpi k="Tournaments" v={me?.tournaments ?? 0} d="Ranked events you've played in." icon={<CalendarDays size={16} />} />
                    <Kpi k="Titles" v={titles} d="Tournaments you won outright." icon={<Medal size={16} />} />
                    <Kpi k="Best finish" v={me ? stageLabel(bestStage(me)) : '–'} d="Furthest you've gone in any event." icon={<Award size={16} />} />
                </div>
            </div>
            {!me ? <NoPadel onNavigate={onNavigate} /> : (
                <div className="fxp-grid">
                    <section className="admx-card fxp-span2">
                        <div className="admx-card__head"><div><h4>Points and record per tournament</h4><p>Ranking points earned and matches won or lost at each event, oldest first.</p></div></div>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={perEvent}>
                                <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
                                <XAxis dataKey="name" stroke={MUTED} tickLine={false} axisLine={false} fontSize={11} />
                                <YAxis allowDecimals={false} stroke={MUTED} tickLine={false} axisLine={false} fontSize={12} width={28} />
                                <Tooltip {...chartTip} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Bar isAnimationActive={false} dataKey="Points" fill={BLUE} radius={[6, 6, 0, 0]} />
                                <Bar isAnimationActive={false} dataKey="Won" fill={SKY} radius={[6, 6, 0, 0]} />
                                <Bar isAnimationActive={false} dataKey="Lost" fill={MUTED} radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </section>
                    <section className="admx-card">
                        <div className="admx-card__head"><div><h4>Events by tier</h4><p>How many of your tournaments were Local, Bronze, Silver or higher.</p></div></div>
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie isAnimationActive={false} data={tiers} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="none">
                                    {tiers.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                                </Pie>
                                <Tooltip {...chartTip} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </section>
                </div>
            )}
        </>
    );
};

export const PadelRankings: React.FC<{ data: PadelData }> = ({ data }) => {
    const top = data.rankings.slice(0, 50);
    const showMe = data.me && data.me.rank > 50;
    return (
        <section className="admx-card">
            <div className="admx-card__head"><div><h4>National padel rankings</h4><p>Top 50 by ranking points. Your row is highlighted.</p></div></div>
            <div className="fxp-table-wrap">
                <table className="fxp-table">
                    <thead><tr><th>#</th><th>Player</th><th>Events</th><th>W-L</th><th>Points</th></tr></thead>
                    <tbody>
                        {[...top, ...(showMe ? [data.me!] : [])].map(r => (
                            <tr key={r.key} className={r.key === data.me?.key ? 'is-me' : ''}>
                                <td>{r.rank}</td><td><b>{r.name}</b>{r.key === data.me?.key && <span className="fxp-you">You</span>}</td><td>{r.tournaments}</td><td>{r.wins}-{r.losses}</td><td><b>{r.points}</b></td>
                            </tr>
                        ))}
                        {data.loading && <tr><td colSpan={5} className="fxp-explain">Loading rankings…</td></tr>}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

/** Ranked padel events the player has played, newest first, as rows (no card around them). */
export const PadelHistoryRows: React.FC<{ data: PadelData }> = ({ data }) => (
    data.me?.results.length ? (
        <div className="mx-rows">
            {data.me.results.map((r, i) => (
                <div key={`${r.tournamentId}${r.category}${i}`} className="mx-row">
                    <span className="mx-row__date"><b>{r.date ? new Date(r.date).toLocaleDateString([], { day: 'numeric' }) : '–'}</b><small>{r.date ? new Date(r.date).toLocaleDateString([], { month: 'short', year: '2-digit' }) : ''}</small></span>
                    <span className="mx-row__main"><b>{r.tournamentName}</b><small>{[r.category, r.tier].filter(Boolean).join(' · ')}</small></span>
                    <span className={`mx-chip ${r.stage === 'CHAMPION' ? 'is-W' : ''}`}>{stageLabel(r.stage)}</span>
                    <span className="mx-row__me">{r.wins}-{r.losses}<small>+{r.points} pts</small></span>
                </div>
            ))}
        </div>
    ) : <div className="qx-empty qx-empty--sm"><b>No ranked events yet</b><span>Play a padel tournament and your finishes and points appear here.</span></div>
);

export const PadelHistory: React.FC<{ data: PadelData; onNavigate: (t: string) => void }> = ({ data, onNavigate }) => (
    !data.me ? <NoPadel onNavigate={onNavigate} /> : (
        <section className="admx-card">
            <div className="admx-card__head"><div><h4>Tournament history</h4><p>Each ranked event: where you finished, your record and the points it gave you.</p></div></div>
            <div className="fxp-list">
                {data.me.results.map((r, i) => (
                    <div key={`${r.tournamentId}${r.category}${i}`} className="fxp-row">
                        <span className="fxp-row__when">{r.date ? new Date(r.date).toLocaleDateString([], { day: 'numeric', month: 'short' }) : '–'}<small>{r.date ? new Date(r.date).getFullYear() : ''}</small></span>
                        <span className="fxp-row__main"><b>{r.tournamentName}</b><small>{[r.category, r.tier].filter(Boolean).join(' · ')}</small></span>
                        <span className={`fxp-res ${r.stage === 'CHAMPION' ? 'is-W' : ''}`}>{stageLabel(r.stage)}</span>
                        <span className="fxp-row__me">{r.wins}-{r.losses} · +{r.points} pts</span>
                    </div>
                ))}
            </div>
        </section>
    )
);

export const PadelPartners: React.FC<{ data: PadelData }> = ({ data }) => (
    <div className="fxp-grid">
        <section className="admx-card fxp-span2">
            <div className="admx-card__head"><div><h4>Your padel partners</h4><p>Who you've teamed up with, most frequent first.</p></div></div>
            {data.partners.length ? (
                <div className="fxp-list">
                    {data.partners.map(p => (
                        <div key={p.name} className="fxp-row fxp-row--partner">
                            <span className="fxp-avatar">{p.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                            <span className="fxp-row__main"><b>{p.name}</b><small>{p.events} {p.events === 1 ? 'event' : 'events'} together{p.last ? ` · last ${new Date(p.last).toLocaleDateString([], { month: 'short', year: 'numeric' })}` : ''}</small></span>
                        </div>
                    ))}
                </div>
            ) : <p className="fxp-explain">Partners appear once you're registered in a padel tournament.</p>}
        </section>
        <section className="admx-card">
            <div className="admx-card__head"><div><h4>Registered events</h4><p>Padel tournaments you're entered in.</p></div><Users size={16} /></div>
            <div className="fxp-list">
                {data.events.slice(0, 6).map(e => (
                    <div key={`${e.id}${e.partner}`} className="fxp-row fxp-row--partner"><span className="fxp-row__main"><b>{e.name}</b><small>With {e.partner}{e.category ? ` · ${e.category}` : ''}</small></span></div>
                ))}
                {!data.events.length && <p className="fxp-explain">None yet.</p>}
            </div>
        </section>
    </div>
);
