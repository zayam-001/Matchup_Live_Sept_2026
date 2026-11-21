// "Watch Live": the courts' YouTube Live streams (e.g. Maidan TV), set by the organiser per court
// (Tournament.courtStreams), played in a full-screen player with a button per court to switch between them.
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Play, Volume2, VolumeX, X } from 'lucide-react';
import { MatchupLogo } from './MatchupLogo';
import type { Match, Tournament } from '../types';
import { youtubeEmbed } from '../lib/youtube';

/** The tournament's playable court streams, in court order ("Court 1" before "Court 3"). */
export const tournamentStreams = (t: Tournament) =>
    Object.entries(t.courtStreams || {})
        .filter(([, url]) => !!youtubeEmbed(url))
        .map(([court, url]) => ({ court, url }))
        .sort((a, b) => a.court.localeCompare(b.court, undefined, { numeric: true }));

const sameCourt = (m: Match, court: string) =>
    [m.court, (m as any).courtId, (m as any).actualCourtId].some(c => c && String(c).trim().toLowerCase() === court.trim().toLowerCase());

/** Short court name for the buttons: "NEO Padel Court 1" -> "Court 1". */
const shortCourt = (court: string) => court.match(/court\s*\d+/i)?.[0].replace(/^c/, 'C') || court;

export const WatchLivePlayer = ({ tournament, liveMatches, onClose }: { tournament: Tournament; liveMatches: Match[]; onClose: () => void }) => {
    const streams = tournamentStreams(tournament);
    // Start on a court that has a match on, else the first one.
    const [court, setCourt] = useState(() => (streams.find(s => liveMatches.some(m => sameCourt(m, s.court))) || streams[0])?.court);
    const active = streams.find(s => s.court === court) || streams[0];
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
    }, [onClose]);
    // YouTube's own controls are hidden; ours talk to the player. It starts muted (browsers only autoplay
    // muted video) and the sound button unmutes it.
    const frameRef = useRef<HTMLIFrameElement>(null);
    const [muted, setMuted] = useState(true);
    // Becomes true when YouTube reports "playing" (state 1). Until the stream first starts, our own screen
    // covers YouTube's title bar and links; short buffering after that leaves the video showing.
    const [playing, setPlaying] = useState(false);
    const command = (func: string) => frameRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*');
    useEffect(() => { setMuted(true); setPlaying(false); }, [court]);
    useEffect(() => {
        const onMessage = (e: MessageEvent) => {
            if (!/^https:\/\/www\.youtube(-nocookie)?\.com$/.test(e.origin) || e.source !== frameRef.current?.contentWindow) return;
            let d: any; try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
            const state = d?.event === 'onStateChange' ? d.info : d?.event === 'infoDelivery' ? d.info?.playerState : undefined;
            if (state === 1) setPlaying(true);
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, []);
    // Ask the player to report its state to us.
    const listen = () => {
        frameRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 'matchup-live', channel: 'widget' }), '*');
        if (!muted) command('unMute');
    };
    const play = () => { command('playVideo'); };
    // Our controls fade out 10 s after the last mouse move or tap, and at once when the mouse leaves.
    const [controlsOn, setControlsOn] = useState(true);
    const idleRef = useRef<number | undefined>(undefined);
    const wake = () => {
        setControlsOn(true);
        window.clearTimeout(idleRef.current);
        idleRef.current = window.setTimeout(() => setControlsOn(false), 10000);
    };
    useEffect(() => { wake(); return () => window.clearTimeout(idleRef.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    // Shown only while the controls are (or before the stream starts, when the cover is up).
    const fade = `transition-opacity duration-500 ${controlsOn || !playing ? 'opacity-100' : 'opacity-0 pointer-events-none'}`;
    const toggleSound = () => { if (muted) { command('unMute'); command('playVideo'); } else command('mute'); setMuted(m => !m); };
    if (!active) return null;
    const src = youtubeEmbed(active.url, { mute: true, bare: true });
    return createPortal(
        // Full screen: the video fills the screen (YouTube letterboxes it) under Match Up branding and our controls.
        <div className={`fixed inset-0 z-[11000] bg-black overflow-hidden ${controlsOn || !playing ? '' : 'cursor-none'}`} role="dialog" aria-label={`${tournament.name} live video`}
            onMouseMove={wake} onTouchStart={wake} onKeyDown={wake} onMouseLeave={() => { window.clearTimeout(idleRef.current); setControlsOn(false); }}>
            {/* Not clickable, so YouTube's hover bar and links never show. The player is 200px taller than the
                screen: YouTube draws its title bar and "More videos" strip on the player's top and bottom edges,
                which fall off screen, while the 16:9 picture (letterboxed inside) stays fully visible. */}
            {src && <iframe ref={frameRef} key={src} src={src} title={`${active.court} live video`} className="absolute inset-x-0 w-full border-0 pointer-events-none"
                style={{ top: -100, height: 'calc(100% + 200px)' }}
                allow="autoplay; encrypted-media; picture-in-picture" onLoad={listen} />}
            <MatchupLogo className={`absolute right-3 sm:right-5 bottom-3 sm:bottom-5 h-6 sm:h-8 w-auto opacity-40 pointer-events-none transition-opacity duration-500 ${controlsOn ? 'opacity-0' : ''}`} />
            {!playing && (
                <div className="absolute inset-0 bg-[#050b1f] flex flex-col items-center justify-center gap-5 text-center px-6">
                    <MatchupLogo className="h-14 sm:h-20 w-auto opacity-90" />
                    <button onClick={play} className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#DC2626] text-white font-black uppercase tracking-[0.12em] text-sm shadow-lg hover:opacity-90">
                        <Play size={18} fill="currentColor" /> Tap to play
                    </button>
                    <p className="text-white/50 text-xs max-w-xs">If it doesn't start, the stream on {shortCourt(active.court)} may not be live yet.</p>
                </div>
            )}
            <div className={`absolute top-0 inset-x-0 h-28 bg-gradient-to-b from-black/70 to-transparent pointer-events-none ${fade}`} />
            <div className={`absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-black/60 to-transparent pointer-events-none ${fade}`} />

            <div className={`absolute top-0 inset-x-0 flex items-start gap-3 px-3 sm:px-5 ${fade}`} style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
                <MatchupLogo className="h-8 sm:h-10 w-auto shrink-0 drop-shadow" />
                <div className="flex-1 min-w-0 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600 text-white text-xs font-black uppercase tracking-[0.12em]">
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> Live
                    </span>
                    {streams.length > 1 && streams.map(s => {
                        const on = s.court === active.court, live = liveMatches.some(m => sameCourt(m, s.court));
                        return (
                            <button key={s.court} onClick={() => setCourt(s.court)} aria-pressed={on}
                                className={`px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-bold uppercase tracking-wider border backdrop-blur transition-colors ${on ? 'bg-[#E65C31] border-[#E65C31] text-white' : 'bg-black/60 border-white/20 text-white/80 hover:text-white'}`}>
                                {live && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5 align-middle animate-pulse" />}{shortCourt(s.court)}
                            </button>
                        );
                    })}
                </div>
                <button onClick={onClose} className="p-2 rounded-full bg-black/60 text-white hover:bg-black/80 backdrop-blur shrink-0" aria-label="Close live video"><X size={18} /></button>
            </div>

            <div className={`absolute bottom-0 inset-x-0 flex items-end justify-between gap-3 px-3 sm:px-5 ${fade}`} style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}>
                <div className="min-w-0 text-white drop-shadow">
                    <div className="text-sm sm:text-base font-black uppercase tracking-[0.08em] truncate">{tournament.name}</div>
                    <div className="text-[11px] sm:text-xs text-white/70 font-bold uppercase tracking-[0.15em]">{active.court} · matchup.com.pk</div>
                </div>
                <button onClick={toggleSound} className={`shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold uppercase tracking-wider ${muted ? 'bg-white text-[#17253F] animate-pulse' : 'bg-black/60 text-white backdrop-blur'}`}
                    aria-label={muted ? 'Turn sound on' : 'Mute'}>
                    {muted ? <><VolumeX size={18} /> Tap for sound</> : <><Volume2 size={18} /> Sound on</>}
                </button>
            </div>
        </div>,
        document.body
    );
};
