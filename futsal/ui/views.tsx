// Read-only views shared by the public tournament page and the organiser screens.
import React, { useMemo } from 'react';
import { Footprints, Hand, Square } from 'lucide-react';
import { computeAwards, computeStandings, hasKnockoutStage, isKnockout, isLeagueFormat, leagueQualifiers, playerStats, scoreOf, STAGE_NAMES, type PlayerLine } from '../engine';
import type { FutsalCategory, FutsalMatch, FutsalTeam, FutsalTournament, Stage } from '../types';
import { Ball, Crest, Empty, playerName, teamName, Trophy } from './shared';
import { publicPath } from '../sport';

// ---------------------------------------------------------------- standings

export const StandingsTable: React.FC<{ title?: string; teamIds: string[]; matches: FutsalMatch[]; cat: FutsalCategory; teams: FutsalTeam[]; qualify?: number; compact?: boolean }> = ({ title, teamIds, matches, cat, teams, qualify = 0, compact }) => {
    const rows = useMemo(() => computeStandings(teamIds, matches, cat.rules, { includeLive: true, seedOf: id => teams.find(t => t.id === id)?.seed ?? 99 }), [teamIds, matches, cat, teams]);
    const anyLive = rows.some(r => r.live);
    return (
        <div className="fx-card fx-card--pad">
            {title && <div className="fx-row fx-row--between" style={{ marginBottom: 8 }}><h3 style={{ fontSize: 22 }}>{title}</h3>{anyLive && <span className="fx-pill fx-pill--live">As it stands</span>}</div>}
            <div className="fx-table-wrap">
                <table className="fx-table">
                    <thead>
                        <tr>
                            <th>#</th><th>Team</th><th>P</th>
                            {!compact && <><th className="fx-hide-sm">W</th><th className="fx-hide-sm">D</th><th className="fx-hide-sm">L</th><th className="fx-hide-sm">GF</th><th className="fx-hide-sm">GA</th></>}
                            <th>GD</th><th>Pts</th>{!compact && <th className="fx-hide-sm">Form</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r, i) => {
                            const team = teams.find(t => t.id === r.teamId);
                            return (
                                <tr key={r.teamId} className={`${i < qualify ? 'is-q' : ''} ${r.live ? 'is-live' : ''}`}>
                                    <td className="fx-pos">{i + 1}</td>
                                    <td><span className="fx-tname"><Crest team={team} size={26} />{team?.name || 'Team'}</span></td>
                                    <td>{r.p}</td>
                                    {!compact && <><td className="fx-hide-sm">{r.w}</td><td className="fx-hide-sm">{r.d}</td><td className="fx-hide-sm">{r.l}</td><td className="fx-hide-sm">{r.gf}</td><td className="fx-hide-sm">{r.ga}</td></>}
                                    <td>{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                                    <td className="fx-pts">{r.pts}</td>
                                    {!compact && <td className="fx-hide-sm"><span className="fx-form">{r.form.map((f, k) => <i key={k} className={f}>{f}</i>)}</span></td>}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export const CategoryStandings: React.FC<{ cat: FutsalCategory; teams: FutsalTeam[]; matches: FutsalMatch[]; compact?: boolean }> = ({ cat, teams, matches, compact }) => {
    const accepted = teams.filter(t => t.categoryId === cat.id && t.status === 'ACCEPTED');
    const inCat = matches.filter(m => m.categoryId === cat.id);
    if (cat.format === 'KNOCKOUT') return <Empty title="Straight knockout">This category has no table. See the bracket.</Empty>;
    if (isLeagueFormat(cat.format)) {
        return <StandingsTable teamIds={accepted.map(t => t.id)} matches={inCat.filter(m => m.stage === 'LEAGUE')} cat={cat} teams={teams} qualify={leagueQualifiers(cat) || 1} compact={compact} />;
    }
    const groups = [...new Set(accepted.map(t => t.groupId).filter(Boolean) as string[])].sort();
    if (!groups.length) return <Empty title="Groups not drawn yet">Tables appear after the organiser makes the draw.</Empty>;
    return (
        <div className={compact ? 'fx-stack' : 'fx-grid2'}>
            {groups.map(g => (
                <StandingsTable key={g} title={`Group ${g}`} teamIds={accepted.filter(t => t.groupId === g).map(t => t.id)} matches={inCat.filter(m => m.stage === 'GROUP' && m.group === g)} cat={cat} teams={teams} qualify={cat.format === 'GROUPS_KNOCKOUT' ? cat.advancePerGroup : 0} compact={compact} />
            ))}
        </div>
    );
};

// ---------------------------------------------------------------- bracket

const STAGE_ORDER: Stage[] = ['R64', 'R32', 'R16', 'QF', 'QUAL', 'EL1', 'SF', 'EL2', 'F'];

export const Bracket: React.FC<{ t: FutsalTournament; cat: FutsalCategory; teams: FutsalTeam[]; matches: FutsalMatch[] }> = ({ t, cat, teams, matches }) => {
    const ko = matches.filter(m => m.categoryId === cat.id && isKnockout(m.stage));
    if (!ko.length) return <Empty title="No knockout stage yet">{hasKnockoutStage(cat.format) ? `The ${cat.format === 'LEAGUE_PLAYOFFS' ? 'playoffs fill' : 'bracket fills'} in as the ${cat.format.startsWith('LEAGUE') ? 'league' : 'groups'} finish.` : 'This category has no knockout rounds.'}</Empty>;
    const rounds = STAGE_ORDER.map(s => ({ s, ms: ko.filter(m => m.stage === s).sort((a, b) => a.matchNo - b.matchNo) })).filter(r => r.ms.length);
    const final = ko.find(m => m.stage === 'F');
    const third = ko.find(m => m.stage === '3P');
    const champ = final?.status === 'COMPLETED' && final.winnerId ? teams.find(x => x.id === final.winnerId) : undefined;
    const Tie = ({ m }: { m: FutsalMatch }) => {
        const s = scoreOf(m);
        const done = m.status === 'COMPLETED';
        const row = (side: 'home' | 'away') => {
            const id = side === 'home' ? m.homeId : m.awayId;
            const team = teams.find(x => x.id === id);
            const win = done && m.winnerId === id;
            return (
                <div className={`fx-tie__row ${!team ? 'is-tbd' : done ? (win ? 'is-win' : 'is-lose') : ''}`}>
                    <Crest team={team} size={22} label="?" />
                    <span>{teamName(teams, id, side === 'home' ? m.homeFrom : m.awayFrom, matches)}</span>
                    {(done || m.status === 'LIVE') && <b>{side === 'home' ? s.home : s.away}</b>}
                    {s.hasPens && <small>({side === 'home' ? s.pensHome : s.pensAway})</small>}
                </div>
            );
        };
        return (
            <a className={`fx-tie ${m.stage === 'F' ? 'is-final' : ''}`} href={`#${publicPath(t)}/m/${m.id}`}>
                {row('home')}{row('away')}
                <div className="fx-tie__meta">{m.status === 'LIVE' ? <span style={{ color: '#FF7B9C' }}>● Live</span> : m.startAt ? new Date(m.startAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : `Match ${m.matchNo}`}</div>
            </a>
        );
    };
    return (
        <div>
            <div className="fx-bracket">
                {rounds.map(r => (
                    <div key={r.s} className="fx-round">
                        <h4>{STAGE_NAMES[r.s]}</h4>
                        {r.ms.map(m => <Tie key={m.id} m={m} />)}
                    </div>
                ))}
                <div className="fx-round fx-trophy">
                    <Trophy />
                    <h4 style={{ color: 'var(--fx-gold)' }}>Champion</h4>
                    {champ ? <><Crest team={champ} size={54} /><h3 className="fx-silver" style={{ fontSize: 26 }}>{champ.name}</h3></> : <span className="fx-muted">To be decided</span>}
                </div>
            </div>
            {third && <div style={{ maxWidth: 300, marginTop: 14 }}><h4 style={{ color: 'var(--fx-cyan)', fontSize: 15, letterSpacing: '.14em', marginBottom: 8 }}>Third place</h4><Tie m={third} /></div>}
        </div>
    );
};

// ---------------------------------------------------------------- stats

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const Leader: React.FC<{ title: string; icon: React.ReactNode; rows: PlayerLine[]; value: (l: PlayerLine) => number; teams: FutsalTeam[]; unit?: string }> = ({ title, icon, rows, value, teams, unit }) => (
    <div className="fx-card fx-leader">
        <h3>{icon}{title}</h3>
        {!rows.length ? <p className="fx-muted" style={{ margin: 0, fontSize: 14 }}>Nothing yet.</p> : rows.map((l, i) => {
            const team = teams.find(t => t.id === l.teamId);
            return (
                <div key={l.playerId} className={`fx-lrow ${i === 0 ? 'is-top' : ''}`}>
                    <span>{i + 1}</span>
                    <span className="fx-lrow__who"><b>{playerName(teams, l.playerId)}</b><small>{team?.name}</small></span>
                    <b>{value(l)}{unit}</b>
                </div>
            );
        })}
    </div>
);

export const StatsView: React.FC<{ t: FutsalTournament; cat: FutsalCategory; teams: FutsalTeam[]; matches: FutsalMatch[] }> = ({ t, cat, teams, matches }) => {
    const catTeams = teams.filter(x => x.categoryId === cat.id && x.status === 'ACCEPTED');
    const catMatches = matches.filter(m => m.categoryId === cat.id);
    const lines = useMemo(() => [...playerStats(catTeams, catMatches).values()], [catTeams, catMatches]);
    const table = useMemo(() => computeStandings(catTeams.map(x => x.id), catMatches.filter(m => m.stage === 'GROUP' || m.stage === 'LEAGUE'), cat.rules), [catTeams, catMatches, cat]);
    const done = catMatches.length > 0 && catMatches.every(m => m.status === 'COMPLETED');
    const awards = computeAwards(lines, table, t.bestPlayer?.[cat.id]);
    const top = (f: (l: PlayerLine) => number, sub?: (a: PlayerLine, b: PlayerLine) => number) => lines.filter(l => f(l) > 0).sort((a, b) => f(b) - f(a) || (sub ? sub(a, b) : 0)).slice(0, 5);
    const played = catMatches.filter(m => m.status === 'COMPLETED');
    const goals = played.reduce((n, m) => { const s = scoreOf(m); return n + s.home + s.away; }, 0);

    const teamRows = catTeams.map(team => {
        let gf = 0, ga = 0, cs = 0, p = 0, y = 0, r = 0;
        played.forEach(m => {
            const side = m.homeId === team.id ? 'home' : m.awayId === team.id ? 'away' : null;
            if (!side) return;
            const s = scoreOf(m); p++;
            const f = side === 'home' ? s.home : s.away, a = side === 'home' ? s.away : s.home;
            gf += f; ga += a; if (!a) cs++;
            m.events.forEach(e => { if (e.side === side && e.type === 'YELLOW') y++; if (e.side === side && e.type === 'RED' && !e.auto) r++; });
        });
        return { team, p, gf, ga, cs, y, r };
    }).sort((a, b) => b.gf - a.gf || a.ga - b.ga);

    return (
        <div className="fx-stack">
            <div className="fx-kpis">
                <div className="fx-card fx-kpi"><small>Matches played</small><b>{played.length}<span className="fx-muted" style={{ fontSize: 18 }}> / {catMatches.length}</span></b></div>
                <div className="fx-card fx-kpi"><small>Goals</small><b>{goals}</b></div>
                <div className="fx-card fx-kpi"><small>Goals per match</small><b>{played.length ? (goals / played.length).toFixed(1) : '0'}</b></div>
                <div className="fx-card fx-kpi"><small>Cards</small><b>{teamRows.reduce((n, x) => n + x.y + x.r, 0)}</b></div>
            </div>

            <div className="fx-leaders">
                <Leader title="Top scorers" icon={<Ball />} rows={top(l => l.goals, (a, b) => b.assists - a.assists)} value={l => l.goals} teams={teams} />
                <Leader title="Assists" icon={<Footprints />} rows={top(l => l.assists, (a, b) => b.goals - a.goals)} value={l => l.assists} teams={teams} />
                <Leader title="Clean sheets" icon={<Hand />} rows={top(l => l.cleanSheets)} value={l => l.cleanSheets} teams={teams} />
                <Leader title="Discipline" icon={<Square />} rows={top(l => l.yellows + l.reds * 3)} value={l => l.yellows + l.reds} teams={teams} unit=" cards" />
            </div>

            <div className="fx-card fx-card--pad">
                <h3 style={{ fontSize: 22, marginBottom: 8 }}>Team stats</h3>
                <div className="fx-table-wrap">
                    <table className="fx-table">
                        <thead><tr><th>#</th><th>Team</th><th>P</th><th>GF</th><th>GA</th><th className="fx-hide-sm">Clean sheets</th><th className="fx-hide-sm">Yellow</th><th className="fx-hide-sm">Red</th></tr></thead>
                        <tbody>
                            {teamRows.map((r, i) => (
                                <tr key={r.team.id}><td className="fx-pos">{i + 1}</td><td><span className="fx-tname"><Crest team={r.team} size={24} />{r.team.name}</span></td><td>{r.p}</td><td>{r.gf}</td><td>{r.ga}</td><td className="fx-hide-sm">{r.cs}</td><td className="fx-hide-sm">{r.y}</td><td className="fx-hide-sm">{r.r}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export const Squads: React.FC<{ teams: FutsalTeam[]; cat: FutsalCategory; matches: FutsalMatch[] }> = ({ teams, cat, matches }) => {
    const list = teams.filter(t => t.categoryId === cat.id && t.status === 'ACCEPTED');
    const lines = useMemo(() => playerStats(list, matches.filter(m => m.categoryId === cat.id)), [list, matches, cat]);
    if (!list.length) return <Empty title="No teams yet">Approved teams and their squads show here.</Empty>;
    return (
        <div className="fx-squads">
            {list.map(team => (
                <div key={team.id} className="fx-card fx-squad">
                    <div className="fx-squad__head">
                        <Crest team={team} size={44} />
                        <div style={{ minWidth: 0 }}><h3>{team.name}</h3><small className="fx-muted">{team.groupId ? `Group ${team.groupId} · ` : ''}{team.players.length} players · Captain {team.captainName}</small></div>
                    </div>
                    <ul>
                        {[...team.players].sort((a, b) => (a.number || 99) - (b.number || 99)).map(p => {
                            const l = lines.get(p.id);
                            return (
                                <li key={p.id}>
                                    <span className="fx-num">{p.number ?? '–'}</span>
                                    <span>{p.name}</span>
                                    {l && l.goals > 0 && <span className="fx-pill" title="Goals"><Ball className="" />{l.goals}</span>}
                                    <span className="fx-pos-tag">{p.position || ''}</span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </div>
    );
};
