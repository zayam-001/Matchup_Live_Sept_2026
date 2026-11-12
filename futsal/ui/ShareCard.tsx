// Shareable images for socials: a squad on a pitch and a Quick Play score, both 1080×1350 with the
// Match Up logo. On phones they go to the share sheet (Instagram, WhatsApp…); elsewhere they download.
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toPng } from 'html-to-image';
import { Share2 } from 'lucide-react';
import { MatchupLogo } from '../../components/MatchupLogo';
import { toast } from '../../components/Toast';
import { pensTally, playerGames, scoreText, setsOf, setsWon, SPORT_NAMES, type QuickMatch } from '../quick';
import './share.css';

/** Turn a rendered card into a PNG and share or download it. */
const shareNode = async (node: HTMLElement, filename: string, title: string) => {
    const url = await toPng(node, { pixelRatio: 1, cacheBust: true, width: 1080, height: 1350 });
    const blob = await (await fetch(url)).blob();
    const file = new File([blob], filename, { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
    if (nav.canShare?.({ files: [file] })) {
        try { await nav.share({ files: [file], title }); return; } catch (e: any) { if (e?.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    toast.success('Image saved', 'Post it on your socials.');
};

/** A button that renders `card` off screen, captures it, and shares it. */
export const ShareButton: React.FC<{ card: () => React.ReactNode; filename: string; title: string; label?: string; className?: string }> = ({ card, filename, title, label = 'Share', className = 'qx-ghost' }) => {
    const [busy, setBusy] = useState(false);
    const host = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!busy || !host.current) return;
        let gone = false;
        // Two frames so fonts and the SVG pitch are laid out before the capture.
        requestAnimationFrame(() => requestAnimationFrame(async () => {
            try { await document.fonts?.ready; if (!gone && host.current) await shareNode(host.current.firstElementChild as HTMLElement, filename, title); }
            catch (e) { console.error('Share image', e); toast.error('Couldn’t make the image', 'Try again in a moment.'); }
            finally { if (!gone) setBusy(false); }
        }));
        return () => { gone = true; };
    }, [busy, filename, title]);
    return (
        <>
            <button type="button" className={className} disabled={busy} onClick={() => setBusy(true)}><Share2 size={15} /> {busy ? 'Making image…' : label}</button>
            {busy && createPortal(<div ref={host} className="shc-host" aria-hidden="true">{card()}</div>, document.body)}
        </>
    );
};

const Brand: React.FC = () => (
    <div className="shc-brand"><MatchupLogo className="shc-brand__logo" /><span><b>MATCH UP</b><small>matchup.com.pk</small></span></div>
);

/** A squad on a flat pitch: name, sport, formation, every starter's card, and the subs. */
export const SquadShareCard: React.FC<{
    sportLabel: string; team: string; formation: string; onPitch: number;
    starters: { x: number; y: number; name: string; number?: number; rating?: number; role: string; captain?: boolean }[];
    subs: { name: string; number?: number; rating?: number }[];
}> = ({ sportLabel, team, formation, onPitch, starters, subs }) => (
    <div className="shc shc--squad">
        <div className="shc-top"><Brand /><span className="shc-tag">{sportLabel} squad</span></div>
        <h1 className="shc-title">{team}</h1>
        <p className="shc-sub">{formation} · {onPitch} a side</p>
        <div className="shc-pitch">
            <svg viewBox="0 0 100 130" preserveAspectRatio="none" aria-hidden="true">
                <rect width="100" height="130" fill="#1F7A3A" />
                {Array.from({ length: 13 }, (_, i) => <rect key={i} y={i * 10} width="100" height="5" fill="rgba(255,255,255,.05)" />)}
                <g fill="none" stroke="rgba(255,255,255,.85)" strokeWidth=".5">
                    <rect x="3" y="3" width="94" height="124" /><line x1="3" y1="65" x2="97" y2="65" /><circle cx="50" cy="65" r="11" />
                    <rect x="25" y="3" width="50" height="20" /><rect x="25" y="107" width="50" height="20" />
                    <rect x="38" y="3" width="24" height="8" /><rect x="38" y="119" width="24" height="8" />
                </g>
            </svg>
            {starters.map((p, i) => (
                <span key={i} className="shc-card" style={{ left: `${p.x}%`, top: `${8 + p.y * 0.86}%` }}>
                    <span className="shc-card__top"><b>{p.rating ?? '–'}</b><small>{p.role}</small></span>
                    <span className="shc-card__num">{p.number ?? ''}</span>
                    <span className="shc-card__name">{p.name.split(' ').slice(-1)[0]}{p.captain ? ' (C)' : ''}</span>
                </span>
            ))}
        </div>
        {subs.length > 0 && <div className="shc-subs"><span>Subs</span>{subs.map((s, i) => <b key={i}>{s.number != null ? `${s.number} ` : ''}{s.name.split(' ').slice(-1)[0]}</b>)}</div>}
    </div>
);

/** A Quick Play result: teams, score (sets for padel), scorers or set scores, date and venue. */
export const ScoreShareCard: React.FC<{ m: QuickMatch; me?: { uid?: string; email?: string } }> = ({ m, me }) => {
    const padel = m.sport === 'padel';
    const [h, a] = padel ? setsWon(m) : (m.score.goals || [0, 0]);
    const pens = (m.score.pens || []).length ? pensTally(m.score.pens) : null;
    const result = me ? playerGames(m, me)[0]?.result : undefined;
    const scorers = (side: 'home' | 'away') => m.events.filter(e => e.kind === 'goal' && e.side === side && e.playerName).map(e => `${e.playerName}${e.minute ? ` ${e.minute}′` : ''}${e.pen ? ' (p)' : ''}`);
    return (
        <div className="shc shc--score">
            <div className="shc-top"><Brand /><span className="shc-tag">{SPORT_NAMES[m.sport]} · {m.status === 'COMPLETED' ? 'Full time' : 'Live'}</span></div>
            {result && <span className={`shc-result is-${result}`}>{result === 'W' ? 'Victory' : result === 'D' ? 'Draw' : 'Defeat'}</span>}
            <div className="shc-score">
                {(['home', 'away'] as const).map((side, k) => {
                    const t = side === 'home' ? m.home : m.away;
                    return (
                        <React.Fragment key={side}>
                            {k === 1 && <span className="shc-score__mid"><b>{h}</b><i>–</i><b>{a}</b>{pens && <small>{pens.h}–{pens.a} on penalties</small>}{padel && <small>sets</small>}</span>}
                            <div className={`shc-team ${m.winner === side ? 'is-win' : ''}`}>
                                <b>{t.name}</b>
                                <small>{t.players.map(p => p.name.split(' ')[0]).join(' · ')}</small>
                            </div>
                        </React.Fragment>
                    );
                })}
            </div>
            {padel ? <div className="shc-sets">{setsOf(m).filter(s => s.h + s.a > 0).map((s, i) => <span key={i}><small>Set {i + 1}</small><b>{s.h}–{s.a}</b></span>)}</div>
                : (scorers('home').length > 0 || scorers('away').length > 0) && <div className="shc-scorers"><div>{scorers('home').map((s, i) => <span key={i}>⚽ {s}</span>)}</div><div>{scorers('away').map((s, i) => <span key={i}>⚽ {s}</span>)}</div></div>}
            <p className="shc-foot">{new Date(m.startAt).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}{m.venue ? ` · ${m.venue}` : ''} · {scoreText(m)}</p>
        </div>
    );
};
