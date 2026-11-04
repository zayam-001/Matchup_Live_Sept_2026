import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { STAGE_LABELS, type KnockoutStage } from '../../lib/pointsSystems';
import type { RankedPlayer } from '../../lib/globalLeaderboard';

const TIER_ORDER = ['Platinum', 'Gold', 'Silver', 'Bronze', 'Local'];

export const TierCounts: React.FC<{ counts: Record<string, number> }> = ({ counts }) => (
    <span className="pp-tiers">
        {TIER_ORDER.filter(t => counts[t]).map(t => (
            <span key={t} className={`pp-tier pp-tier--${t.toLowerCase()}`} title={`${counts[t]} ${t}`}>{counts[t]} {t}</span>
        ))}
    </span>
);

export const ResultsList: React.FC<{ player: RankedPlayer }> = ({ player }) => (
    <ul className="pp-results">
        {player.results.map((r, i) => (
            <li key={`${r.tournamentId}-${i}`}>
                <span className="pp-results__name">
                    <b>{r.tournamentName}</b>
                    <small>{[r.tier, r.category].filter(Boolean).join(' · ')}{r.stage ? ` · ${STAGE_LABELS[r.stage as KnockoutStage] || ''}` : ''}</small>
                </span>
                <span className="pp-results__wl">{r.wins}W {r.losses}L</span>
                <span className="pp-results__pts">{r.points}</span>
            </li>
        ))}
    </ul>
);

export const RankingsTable: React.FC<{ rows: RankedPlayer[]; meKey?: string; limit?: number }> = ({ rows, meKey, limit = 20 }) => {
    const [open, setOpen] = useState<string | null>(null);
    if (!rows.length) return <div className="pp-empty">No ranked players found.</div>;
    // Top of the table, plus the player's own row if they're further down.
    const mine = meKey ? rows.find(r => r.key === meKey) : undefined;
    const visible = mine && mine.rank > limit ? [...rows.slice(0, limit), mine] : rows.slice(0, limit);
    return (
        <div className="pp-rank">
            <div className="pp-rank__head"><span>#</span><span>Player</span><span className="pp-hide-sm">W-L</span><span className="pp-hide-sm">Events</span><span>Points</span></div>
            {visible.map(r => (
                <div key={r.key} className={`pp-rank__row ${r.key === meKey ? 'is-me' : ''} ${open === r.key ? 'is-open' : ''}`}>
                    <button type="button" className="pp-rank__main" aria-expanded={open === r.key} onClick={() => setOpen(open === r.key ? null : r.key)}>
                        <span className={`pp-rank__pos ${r.rank <= 3 ? `is-top is-top${r.rank}` : ''}`}>{r.rank}</span>
                        <span className="pp-rank__who">
                            <Avatar src={r.photoUrl} fallback={r.name} size="sm" className="w-9 h-9 shrink-0" />
                            <span className="min-w-0">
                                <b>{r.name}{r.key === meKey && <em>You</em>}</b>
                                <TierCounts counts={r.tierCounts} />
                            </span>
                        </span>
                        <span className="pp-hide-sm pp-rank__num">{r.wins}-{r.losses}</span>
                        <span className="pp-hide-sm pp-rank__num">{r.tournaments}</span>
                        <span className="pp-rank__pts">{r.points}<ChevronDown size={14} /></span>
                    </button>
                    {open === r.key && <ResultsList player={r} />}
                </div>
            ))}
        </div>
    );
};
