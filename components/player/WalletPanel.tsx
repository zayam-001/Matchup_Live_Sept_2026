import React, { useEffect, useState } from 'react';
import { Check, Copy, Loader2, Ticket, Wallet } from 'lucide-react';
import { redeemWalletPoints, subscribeToMyRedemptions } from '../../services/storage';
import { MIN_REDEEM_POINTS, PKR_PER_POINT, type Redemption } from '../../lib/wallet';
import { toast } from '../Toast';

/** Bonus points balance and one-time redeem codes for Maidan court bookings. */
export const WalletPanel: React.FC<{ uid: string; balance: number }> = ({ uid, balance }) => {
    const [rows, setRows] = useState<Redemption[]>([]);
    const [amount, setAmount] = useState('');
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);

    useEffect(() => subscribeToMyRedemptions(uid, setRows), [uid]);

    const value = parseInt(amount, 10) || 0;
    const canRedeem = value >= MIN_REDEEM_POINTS && value <= balance;

    const redeem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canRedeem || busy) return;
        setBusy(true);
        try {
            const r = await redeemWalletPoints(uid, value);
            setAmount('');
            toast.success('Code ready', `Show ${r.code} at Maidan when you book.`);
        } catch (err: any) {
            console.error(err);
            toast.error("Couldn't create your code", err?.message);
        } finally {
            setBusy(false);
        }
    };

    const copy = (code: string) => {
        navigator.clipboard?.writeText(code);
        setCopied(code);
        setTimeout(() => setCopied(null), 1500);
    };

    return (
        <div className="pp-wallet">
            <section className="pp-card pp-wallet__balance">
                <span className="pp-eyebrow"><Wallet size={14} /> Your points</span>
                <strong>{balance.toLocaleString()}</strong>
                <p>Worth Rs {(balance * PKR_PER_POINT).toLocaleString()} on Maidan court bookings, including discounted slots.</p>
                <form onSubmit={redeem} className="pp-wallet__form">
                    <label htmlFor="pp-redeem">Points to use</label>
                    <div>
                        <input id="pp-redeem" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ''))} placeholder={`${MIN_REDEEM_POINTS} or more`} />
                        <button type="button" className="pp-btn pp-btn--ghost" disabled={balance < MIN_REDEEM_POINTS} onClick={() => setAmount(String(balance))}>All</button>
                        <button type="submit" className="pp-btn pp-btn--primary" disabled={!canRedeem || busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Ticket size={16} />} Get code</button>
                    </div>
                    {value > balance && <small className="is-err">You only have {balance} points.</small>}
                    {value > 0 && value < MIN_REDEEM_POINTS && <small className="is-err">The minimum is {MIN_REDEEM_POINTS} points.</small>}
                </form>
            </section>

            <section className="pp-card">
                <h3>How it works</h3>
                <ol className="pp-steps">
                    <li>Choose how many points to use and tap <b>Get code</b>.</li>
                    <li>Show the code at Maidan when you book a court.</li>
                    <li>Staff apply it, and the value comes off your booking. Each code works once.</li>
                </ol>
            </section>

            <section className="pp-card pp-wallet__codes">
                <h3>Your codes</h3>
                {rows.length === 0 ? (
                    <p className="pp-muted">No codes yet.</p>
                ) : (
                    <ul>
                        {rows.map(r => (
                            <li key={r.code} className={r.status === 'used' ? 'is-used' : ''}>
                                <span className="pp-code">{r.code}</span>
                                <span className="pp-muted">{r.amount} pts · Rs {(r.amount * PKR_PER_POINT).toLocaleString()}</span>
                                {r.status === 'issued' ? (
                                    <button type="button" className="pp-btn pp-btn--ghost" onClick={() => copy(r.code)}>{copied === r.code ? <Check size={14} /> : <Copy size={14} />} {copied === r.code ? 'Copied' : 'Copy'}</button>
                                ) : <span className="pp-pill">Used</span>}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
};
