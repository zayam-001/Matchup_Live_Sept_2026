import React, { useState } from 'react';
import { Link2, Loader2 } from 'lucide-react';
import { dismissMergeSuggestion, mergePlayerProfiles, type MergeCandidate } from '../../services/storage';
import { toast } from '../Toast';

/** "Is this you?" - entries with your first name and no details that rule you out. */
export const MergePrompt: React.FC<{ candidates: MergeCandidate[]; account: any }> = ({ candidates, account }) => {
    const [busy, setBusy] = useState<string | null>(null);
    const [hidden, setHidden] = useState<Set<string>>(new Set());
    const shown = candidates.filter(c => !hidden.has(c.linkId));
    if (!shown.length) return null;

    const act = async (c: MergeCandidate, yes: boolean) => {
        setBusy(c.linkId);
        try {
            if (yes) {
                await mergePlayerProfiles(c.slot, account, { method: 'player', by: account.email });
                toast.success('Added to your profile', 'These results now count towards your ranking.');
            } else {
                await dismissMergeSuggestion(account.id, c.slot);
            }
            setHidden(prev => new Set(prev).add(c.linkId));
        } catch (err) {
            console.error(err);
            toast.error("Couldn't save that", 'Please try again.');
        } finally {
            setBusy(null);
        }
    };

    return (
        <section className="pp-card pp-merge">
            <h3><Link2 size={16} /> Is this you?</h3>
            <p className="pp-muted">These tournament entries might be yours. Confirm them to add the results to your ranking.</p>
            <ul>
                {shown.map(c => (
                    <li key={c.linkId}>
                        <span className="min-w-0">
                            <b>{c.slot.name}</b>
                            <small>{c.tournaments.map(t => t.name).filter((n, i, a) => a.indexOf(n) === i).join(', ')}</small>
                        </span>
                        <span className="pp-merge__act">
                            <button type="button" className="pp-btn pp-btn--ghost" disabled={!!busy} onClick={() => act(c, false)}>Not me</button>
                            <button type="button" className="pp-btn pp-btn--primary" disabled={!!busy} onClick={() => act(c, true)}>{busy === c.linkId ? <Loader2 size={14} className="animate-spin" /> : null} That's me</button>
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
};
