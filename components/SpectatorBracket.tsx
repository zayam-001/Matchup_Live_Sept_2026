// Spectator knockout bracket: one column per round, each match lined up with the two matches that feed it,
// winners highlighted, set scores shown, and "Winner Quarter-Final 2"-style labels for slots not decided yet.
import React, { useMemo } from 'react';
import type { Match, Team } from '../types';
import { isDone, isKnockoutMatch } from '../lib/padelBracket';
import { CountryFlag, TeamFlags } from './CountrySelect';

const isLive = (m: Match) => ['IN_PROGRESS', 'LIVE'].includes(String(m.status).toUpperCase());

/** The matches that make up the bracket: knockout-stage matches, or every match for a pure elimination event. */
export const bracketMatches = (matches: Match[], format?: string) => {
    const ko = matches.filter(isKnockoutMatch);
    if (ko.length) return ko;
    return /ELIMINATION|KNOCKOUT/i.test(String(format || '')) ? matches : [];
};

/** Rounds in play order; each earlier round sorted so the two feeders of a match sit next to each other. */
const orderRounds = (matches: Match[]) => {
    const byRound = new Map<number, Match[]>();
    matches.forEach(m => { const r = Number(m.round) || 1; byRound.set(r, [...(byRound.get(r) || []), m]); });
    const keys = [...byRound.keys()].sort((a, b) => a - b);
    const byId = (a: Match, b: Match) => a.id.localeCompare(b.id, undefined, { numeric: true });
    const ordered: Match[][] = [];
    for (let i = keys.length - 1; i >= 0; i--) {
        const list = byRound.get(keys[i])!;
        const next = ordered[0];
        if (!next) { ordered.unshift([...list].sort(byId)); continue; }
        const feeds = (m: Match, target: Match) => m.nextMatchId === target.id
            || [target.team1Dependency, target.team2Dependency].some(d => d?.sourceType === 'MATCH_WINNER' && d.sourceId === m.id);
        const placed: Match[] = [];
        next.forEach(t => {
            const slot = (d?: Match['team1Dependency']) => list.find(m => !placed.includes(m) && d?.sourceType === 'MATCH_WINNER' && d.sourceId === m.id);
            [slot(t.team1Dependency), slot(t.team2Dependency), ...list.filter(m => !placed.includes(m) && feeds(m, t)).sort(byId)]
                .forEach(m => { if (m && !placed.includes(m)) placed.push(m); });
        });
        ordered.unshift([...placed, ...list.filter(m => !placed.includes(m)).sort(byId)]);
    }
    return ordered;
};

const slotLabel = (m: Match, side: 1 | 2, all: Match[]) => {
    const d = side === 1 ? m.team1Dependency : m.team2Dependency;
    if (!d) return 'TBD';
    if (d.sourceType === 'GROUP_RANK') return `Group ${d.sourceId} #${d.rank || 1}`;
    const src = all.find(x => x.id === d.sourceId);
    return `${d.sourceType === 'MATCH_LOSER' ? 'Loser' : 'Winner'} ${src?.roundName || 'previous match'}`;
};

type Slot = { matchId: string; side: 1 | 2 };

/** FIP draw style: "Surname" then first name ("MELERO BERNAL Miguel"), using the official lastName when stored. */
const surnameFirst = (p?: { name?: string; lastName?: string }) => {
    const name = String(p?.name || '').trim();
    if (!name || name.toUpperCase() === 'TBD') return null;
    const last = String(p?.lastName || '').trim() || (name.includes(',') ? name.split(',')[0].trim() : name.split(/\s+/).pop()!);
    const first = name.includes(',') ? name.split(',').slice(1).join(' ').trim()
        : name.toLowerCase().endsWith(last.toLowerCase()) ? name.slice(0, name.length - last.length).trim() : name.split(/\s+/).slice(0, -1).join(' ');
    return { last: last.toUpperCase(), first };
};

/** `onSwap` turns on organiser editing: each slot of a match not started yet becomes a picker of the round's slots. */
export const SpectatorBracket: React.FC<{ matches: Match[]; teams: Team[]; format?: string; flags?: boolean; fip?: boolean; onSwap?: (a: Slot, b: Slot) => void }> = ({ matches, teams, format, flags, fip, onSwap }) => {
    const rounds = useMemo(() => orderRounds(bracketMatches(matches, format)), [matches, format]);
    const all = rounds.flat();
    if (!rounds.length) return <p className="spx-bracket__empty">The bracket appears here once the knockout matches are drawn.</p>;
    const teamName = (id?: string, fallback?: string) => teams.find(t => t.id === id)?.name || fallback;
    // Third-place play-offs sit outside the tree: show them under the final.
    const scheduled = (m: Match) => String(m.status || 'SCHEDULED').toUpperCase() === 'SCHEDULED';
    // What fills a slot, in words: "Winner Round of 16 - Match 2 (Ali & Usman)" or just the team.
    const slotText = (m: Match, side: 1 | 2) => {
        const id = side === 1 ? m.team1Id : m.team2Id;
        const team = id ? teamName(id, side === 1 ? m.team1Name : m.team2Name) : '';
        const dep = side === 1 ? m.team1Dependency : m.team2Dependency;
        return dep ? `${slotLabel(m, side, all)}${team ? ` (${team})` : ''}` : team || 'TBD';
    };
    const champion = (() => { const f = rounds[rounds.length - 1]?.find(m => !/3rd|third/i.test(m.roundName || '')); return f && isDone(f) ? teamName(f.winnerTeamId) : null; })();

    return (
        <div className="spx-bracket">
            {champion && <div className="spx-bracket__champ">Champion · <strong>{champion}</strong></div>}
            <div className="spx-bracket__scroll">
                {rounds.map((list, ri) => (
                    <div key={ri} className="spx-bracket__round">
                        <h4>{list.find(m => !/3rd|third/i.test(m.roundName || ''))?.roundName?.replace(/\s*[-–·]?\s*(Match\s*)?\d+$/i, '') || `Round ${ri + 1}`}</h4>
                        <div className="spx-bracket__col">
                            {list.map(m => {
                                const done = isDone(m), live = isLive(m);
                                const s1 = m.score?.p1SetScores || [], s2 = m.score?.p2SetScores || [];
                                const row = (side: 1 | 2) => {
                                    const id = side === 1 ? m.team1Id : m.team2Id;
                                    const name = teamName(id, side === 1 ? m.team1Name : m.team2Name);
                                    const sets = side === 1 ? s1 : s2;
                                    const won = done && !!id && m.winnerTeamId === id;
                                    if (onSwap && scheduled(m)) {
                                        const others = list.filter(scheduled).flatMap(x => ([1, 2] as const).map(sd => ({ x, sd })));
                                        return (
                                            <div className="spx-bracket__team is-edit">
                                                <select value={`${m.id}:${side}`} aria-label={`${m.roundName}, slot ${side}`}
                                                    onChange={e => { const [mid, sd] = e.target.value.split(':'); onSwap({ matchId: m.id, side }, { matchId: mid, side: Number(sd) as 1 | 2 }); }}>
                                                    {others.map(({ x, sd }) => <option key={`${x.id}:${sd}`} value={`${x.id}:${sd}`}>{slotText(x, sd)}</option>)}
                                                </select>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div className={`spx-bracket__team${won ? ' is-win' : ''}${done && !won ? ' is-out' : ''}`}>
                                            <span className={`spx-bracket__name${id ? '' : ' is-tbd'}`}>
                                                {(() => {
                                                    const team = teams.find(t => t.id === id) as any;
                                                    // FIP: one line per player, each with their own flag.
                                                    const pair = fip && team && team.name !== 'Bye'
                                                        ? [team.player1, team.player2].map(pl => ({ pl, n: surnameFirst(pl) })).filter(x => x.n) as { pl: any; n: { last: string; first: string } }[] : [];
                                                    return pair.length ? (
                                                        <span className="spx-bracket__fip">
                                                            {pair.map(({ pl, n }, i) => (
                                                                <span key={i}>
                                                                    {flags && pl?.country && <CountryFlag code={pl.country} className="w-4 h-3 rounded-[1px] mr-1.5 align-[-1px]" />}
                                                                    <b>{n.last}</b> {n.first}
                                                                </span>
                                                            ))}
                                                        </span>
                                                    ) : <><TeamFlags team={team} show={flags} /><span>{name || slotLabel(m, side, all)}</span></>;
                                                })()}
                                            </span>
                                            <span className="spx-bracket__sets">
                                                {sets.map((g, i) => <b key={i}>{g}</b>)}
                                                {live && <b className="is-now">{side === 1 ? m.score?.p1Games ?? 0 : m.score?.p2Games ?? 0}</b>}
                                            </span>
                                        </div>
                                    );
                                };
                                return (
                                    <div key={m.id} className={`spx-bracket__match${live ? ' is-live' : ''}`}>
                                        {/3rd|third/i.test(m.roundName || '') && <small>{m.roundName}</small>}
                                        {live && <small className="spx-bracket__live">Live{m.court ? ` · ${m.court}` : ''}</small>}
                                        {row(1)}{row(2)}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
