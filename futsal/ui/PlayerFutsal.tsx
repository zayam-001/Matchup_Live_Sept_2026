// The futsal tab on a player's Match Up profile. Uses the profile's own card styles.
import React, { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { STAGE_LABELS, type KnockoutStage } from '../../lib/pointsSystems';
import { firstNameOf, normalizeEmail, normalizePhone } from '../../lib/playerIdentity';
import { placements, playerStats } from '../engine';
import { computeFutsalRankings } from '../rankings';
import type { SquadPlayer } from '../types';
import { useAllFutsal } from './shared';

interface Account { id?: string; uid?: string; phone?: string; email?: string; fullName?: string; name?: string }

/** Is this squad entry the signed-in player? Account link first, then phone, then email with the same first name. */
const isMe = (p: SquadPlayer, a: Account) => {
    const uid = a.id || a.uid;
    if (uid && p.uid === uid) return true;
    const ph = normalizePhone(a.phone);
    if (ph && normalizePhone(p.phone) === ph) return true;
    const em = normalizeEmail(a.email);
    return !!em && normalizeEmail(p.email) === em && firstNameOf(p.name) === firstNameOf(a.fullName || a.name);
};

export const PlayerFutsal: React.FC<{ account: Account }> = ({ account }) => {
    const { tournaments, teams, matches, loading } = useAllFutsal();
    const rows = useMemo(() => {
        const out: { tId: string; tName: string; date: string; cat: string; team: string; stage: string; apps: number; goals: number; assists: number; motm: number }[] = [];
        for (const t of tournaments) {
            if (t.status === 'DRAFT') continue;
            for (const cat of t.categories) {
                const cTeams = teams.filter(x => x.tournamentId === t.id && x.categoryId === cat.id && x.status === 'ACCEPTED');
                const mine = cTeams.find(x => x.players.some(p => isMe(p, account)));
                if (!mine) continue;
                const me = mine.players.find(p => isMe(p, account))!;
                const cMatches = matches.filter(m => m.tournamentId === t.id && m.categoryId === cat.id);
                const line = playerStats(cTeams, cMatches).get(me.id);
                out.push({ tId: t.id, tName: t.name, date: t.startDate, cat: cat.name, team: mine.name, stage: placements(cat, cTeams, cMatches).get(mine.id) || '', apps: line?.apps || 0, goals: line?.goals || 0, assists: line?.assists || 0, motm: line?.motm || 0 });
            }
        }
        return out.sort((a, b) => b.date.localeCompare(a.date));
    }, [tournaments, teams, matches, account]);
    const rank = useMemo(() => {
        const { players } = computeFutsalRankings(tournaments, teams, matches);
        const uid = account.id || account.uid;
        return players.find(r => uid && r.uid === uid) || players.find(r => r.results.some(x => rows.some(y => y.tId === x.tournamentId && y.team === x.teamName)) && firstNameOf(r.name) === firstNameOf(account.fullName || account.name));
    }, [tournaments, teams, matches, account, rows]);

    if (loading) return <div className="pp-empty"><Loader2 className="animate-spin" size={22} /></div>;
    if (!rows.length) {
        return (
            <section className="pp-card">
                <h3>Futsal</h3>
                <p className="pp-muted">No futsal yet. When a captain adds you to a squad with your phone number, your matches and goals show up here.</p>
                <a className="pp-link" href="#futsal" style={{ display: 'inline-block', marginTop: 10, color: '#FF8A5B', fontWeight: 700 }}>Browse futsal competitions →</a>
            </section>
        );
    }
    const total = (k: 'apps' | 'goals' | 'assists' | 'motm') => rows.reduce((n, r) => n + r[k], 0);
    const kpis: [string, number | string][] = [['Rank points', rank?.points ?? 0], ['Apps', total('apps')], ['Goals', total('goals')], ['Assists', total('assists')], ['Player of the match', total('motm')], ['Titles', rows.filter(r => r.stage === 'CHAMPION').length]];
    return (
        <div className="space-y-4">
            <section className="pp-card">
                <h3>Futsal{rank ? ` · #${rank.rank} in ${rank.division}` : ''}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12, marginTop: 10 }}>
                    {kpis.map(([k, v]) => (
                        <div key={k} style={{ padding: 14, borderRadius: 14, background: 'rgba(0,0,0,.2)' }}>
                            <div className="pp-muted" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' }}>{k}</div>
                            <div style={{ fontFamily: "'Barlow Condensed', var(--font-display, Poppins), sans-serif", fontSize: 32, fontWeight: 800, fontStyle: 'italic' }}>{v}</div>
                        </div>
                    ))}
                </div>
            </section>
            <section className="pp-card">
                <h3>Futsal competitions</h3>
                <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                    {rows.map(r => (
                        <a key={`${r.tId}${r.cat}`} href={`#futsal/t/${r.tId}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, background: 'rgba(0,0,0,.2)', color: '#fff', textDecoration: 'none' }}>
                            <span style={{ flex: 1, minWidth: 0 }}>
                                <b style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.tName}</b>
                                <small className="pp-muted">{r.cat} · {r.team} · {r.stage ? STAGE_LABELS[r.stage as KnockoutStage] || r.stage : 'Group stage'}</small>
                            </span>
                            <span style={{ textAlign: 'right', fontSize: 13 }}><b>{r.goals}</b> G · <b>{r.assists}</b> A<br /><small className="pp-muted">{r.apps} apps</small></span>
                        </a>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default PlayerFutsal;
