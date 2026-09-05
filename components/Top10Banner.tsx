import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trophy, X, Download, Share2, Award, Sparkles, Medal, Film } from 'lucide-react';
import { toPng } from 'html-to-image';
import { motion } from 'framer-motion';
import { Logo } from './ui/Logo';
// @ts-ignore
import gifshot from 'gifshot';

interface Top10BannerProps {
    players: any[];
    tournamentName: string;
    matches: any[];
    onClose: () => void;
    autoGenerateGif?: boolean;
    categoryName?: string | null;
}

export const Top10Banner: React.FC<Top10BannerProps> = ({ players, tournamentName, matches, onClose, autoGenerateGif = false, categoryName }) => {
    const bannerRef = useRef<HTMLDivElement>(null);
    const [exporting, setExporting] = useState(false);
    const [gifCaptureFrame, setGifCaptureFrame] = useState<number>(-1);
    const [generatingGif, setGeneratingGif] = useState(false);
    const [gifProgress, setGifProgress] = useState(0);

    // Get tournament's year and month dynamically based on matches played or current date
    const getBannerDate = () => {
        const completedMatch = matches.find(m => (m.status === 'COMPLETED' || String(m.status).toUpperCase() === 'FINISHED') || m.completedAt || m.scheduledTime);
        const rawDate = completedMatch?.completedAt || completedMatch?.scheduledTime || completedMatch?.createdAt;
        const dateObj = rawDate ? new Date(rawDate) : new Date();
        const year = dateObj.getFullYear();
        const month = dateObj.toLocaleString('en-US', { month: 'long' });
        return `${month} ${year}`;
    };

    const handleShareOrDownload = async () => {
        if (!bannerRef.current || exporting) return;
        setExporting(true);
        try {
            // Wait slightly for any styles
            await new Promise(resolve => setTimeout(resolve, 150));
            
            const exportWidth = 460;
            const exportHeight = 740;
            
            const dataUrl = await toPng(bannerRef.current, { 
                cacheBust: true, 
                style: { 
                    transform: 'none', 
                    width: '460px', 
                    height: '740px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '24px'
                }, 
                pixelRatio: 2,
                backgroundColor: '#050505',
                width: exportWidth,
                height: exportHeight
            });
            const blob = await (await fetch(dataUrl)).blob();
            const fileName = `top-5-${tournamentName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}.png`;
            const file = new File([blob], fileName, { type: 'image/png' });

            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: `Top 5 Players - ${tournamentName}`,
                    text: `Check out the Top 5 leaders of ${tournamentName}!`,
                    files: [file]
                });
            } else {
                const link = document.createElement('a');
                link.download = fileName;
                link.href = dataUrl;
                link.click();
            }
        } catch (err) {
            console.error('Failed to export Top 5 Banner:', err);
        } finally {
            setExporting(false);
        }
    };

    // Keep it up to 5 players
    const top5 = players.slice(0, 5);

    const handleGenerateGif = async () => {
        if (!bannerRef.current || generatingGif) return;
        setGeneratingGif(true);
        setGifProgress(0);
        
        const frames: string[] = [];
        const maxPlayers = Math.min(5, top5.length);
        
        try {
            const exportWidth = 460;
            const exportHeight = 740;

            // Generate frames sequentially by revealing rows one by one
            for (let step = 0; step <= maxPlayers; step++) {
                setGifProgress(Math.round((step / (maxPlayers + 1)) * 85));
                setGifCaptureFrame(step);
                
                // Yield to allow UI paint
                await new Promise(resolve => setTimeout(resolve, 250));
                
                const dataUrl = await toPng(bannerRef.current, {
                    cacheBust: true,
                    style: { 
                        transform: 'none', 
                        width: '460px', 
                        height: '740px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        padding: '24px'
                    },
                    pixelRatio: 1.5,
                    backgroundColor: '#050505',
                    width: exportWidth,
                    height: exportHeight
                });
                
                frames.push(dataUrl);
            }
            
            // Add duplicate final frames so the finished animation lingers/pauses at the end
            if (frames.length > 0) {
                frames.push(frames[frames.length - 1]);
                frames.push(frames[frames.length - 1]);
                frames.push(frames[frames.length - 1]);
                frames.push(frames[frames.length - 1]);
            }
            
            setGifProgress(90);
            await new Promise(resolve => setTimeout(resolve, 100));

            // Compile frames into animated GIF using gifshot
            gifshot.createGIF({
                images: frames,
                gifWidth: exportWidth,
                gifHeight: exportHeight,
                interval: 0.35, // transition interval
                numFrames: frames.length,
                frameDuration: 2,
                sampleInterval: 10,
            }, function (obj: any) {
                if (!obj.error) {
                    const link = document.createElement('a');
                    link.download = `top-5-${tournamentName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}.gif`;
                    link.href = obj.image;
                    link.click();
                } else {
                    console.error('GIF compiled fail:', obj.error);
                    alert('GIF creation error: ' + obj.error);
                }
                setGeneratingGif(false);
                setGifCaptureFrame(-1);
                setGifProgress(0);
            });
            
        } catch (err) {
            console.error('Failed to generate GIF:', err);
            alert('Failed to generate animated GIF. Fallback to normal download.');
            setGeneratingGif(false);
            setGifCaptureFrame(-1);
            setGifProgress(0);
        }
    };

    React.useEffect(() => {
        if (autoGenerateGif && top5.length > 0) {
            const timer = setTimeout(() => {
                handleGenerateGif();
            }, 600);
            return () => clearTimeout(timer);
        }
    }, [autoGenerateGif, players]);

    const content = (
        <div className="fixed inset-0 z-[20000] bg-black/95 overflow-y-auto backdrop-blur-md flex justify-center items-start p-4 py-8 md:py-16">
            {/* Fixed Close/Back Button */}
            <button 
                onClick={onClose} 
                className="fixed top-4 right-4 md:top-6 md:right-6 text-white bg-white/10 hover:bg-white/20 w-12 h-12 flex items-center justify-center rounded-full z-[20010] transition-colors border border-white/15 cursor-pointer shadow-lg backdrop-blur-md hover:scale-105 active:scale-95"
                title="Close and go back"
            >
                <X size={24}/>
            </button>

            <div className="w-full max-w-[500px] flex flex-col relative">
                {/* Back Link Navigation Header */}
                <button
                    onClick={onClose}
                    className="self-start mb-4 text-xs font-black uppercase tracking-wider text-white/70 hover:text-white flex items-center gap-2 cursor-pointer transition-colors bg-white/5 hover:bg-white/10 py-2 px-4 rounded-xl border border-white/10 shadow-sm"
                >
                    &larr; Back to Tournament Stats
                </button>

                {/* Banner Wrapper with shadow */}
                <div className="w-full bg-black/50 border border-white/10 rounded-3xl overflow-hidden shadow-2xl shadow-brand/10 mb-6">
                    {/* Capturable Container */}
                    <div 
                        ref={bannerRef} 
                        className="w-full bg-[#050505] bg-gradient-to-b from-[#0e0e11] via-[#050505] to-[#0a0514] p-6 sm:p-8 text-center relative flex flex-col items-center"
                        style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                    >
                        {/* Elegant background graphics */}
                        <div className="absolute top-0 left-1/4 right-1/4 h-48 bg-brand/15 blur-[60px] rounded-full pointer-events-none" />
                        <div className="absolute bottom-0 left-1/3 right-1/3 h-48 bg-amber-500/10 blur-[80px] rounded-full pointer-events-none" />
                        <div className="absolute inset-0 bg-[radial-gradient(#ffffff03_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

                        {/* Top Branding */}
                        <div className="flex items-center gap-2 mb-6">
                            <Logo size={20} variant="white" />
                            <span className="font-extrabold tracking-[0.3em] text-xs text-white">MATCHUP</span>
                        </div>

                        {/* Tournament and Subheading */}
                        <div className="mb-6 flex flex-col items-center">
                            <h2 className="text-sm font-black text-brand uppercase tracking-[0.2em] mb-1">
                                {tournamentName}
                            </h2>
                            {categoryName && (
                                <div className="inline-block bg-brand/15 text-brand px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase border border-brand/25 mb-2 mt-1">
                                    {categoryName}
                                </div>
                            )}
                            <p className="text-[10px] font-bold text-content-secondary uppercase tracking-[0.15em]">
                                LEADERBOARD • {getBannerDate()}
                            </p>
                        </div>

                        {/* Main Championship title */}
                        <div className="relative mb-8">
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-amber-400 animate-pulse">
                                <Trophy size={28} />
                            </div>
                            <h1 className="text-4xl font-extrabold italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-200 to-amber-400 uppercase mt-4">
                                TOP 5 PLAYERS
                            </h1>
                            <div className="h-0.5 w-24 bg-gradient-to-r from-transparent via-amber-400 to-transparent mx-auto mt-2" />
                        </div>

                        {/* Leaderboard Rows */}
                        <div className="w-full space-y-2 mb-6">
                            {top5.map((p, idx) => {
                                if (gifCaptureFrame !== -1 && idx >= gifCaptureFrame) {
                                    return null;
                                }
                                
                                const rank = idx + 1;
                                const isTop3 = rank <= 3;
                                const isNewAnimateRow = gifCaptureFrame !== -1 && idx === gifCaptureFrame - 1;

                                const bgStyle = isNewAnimateRow
                                    ? 'bg-amber-400/25 border-amber-400 shadow-xl shadow-amber-400/10 scale-102 font-bold'
                                    : isTop3 
                                        ? rank === 1 
                                            ? 'bg-amber-400/10 border-amber-400/30 shadow-md shadow-amber-400/5' 
                                            : rank === 2 
                                                ? 'bg-slate-300/10 border-slate-300/20' 
                                                : 'bg-amber-700/10 border-amber-700/20'
                                        : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]';

                                const rankColor = rank === 1 
                                    ? 'text-amber-400 font-extrabold' 
                                    : rank === 2 
                                        ? 'text-slate-300 font-extrabold' 
                                        : rank === 3 
                                            ? 'text-amber-600 font-extrabold' 
                                            : 'text-content-muted';

                                return (
                                    <div 
                                        key={idx} 
                                        className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${bgStyle}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            {/* Rank Indicator */}
                                            <div className="w-8 flex justify-center items-center">
                                                {rank === 1 ? (
                                                    <Trophy size={18} className="text-amber-400" />
                                                ) : rank === 2 ? (
                                                    <Award size={18} className="text-slate-300" />
                                                ) : rank === 3 ? (
                                                    <Medal size={18} className="text-amber-600" />
                                                ) : (
                                                    <span className={`text-[13px] font-mono font-black ${rankColor}`}>{rank}</span>
                                                )}
                                            </div>

                                            {/* Player Information */}
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-white tracking-tight">{p.name}</span>
                                                <span className="text-[9px] font-bold text-content-secondary uppercase tracking-wider">
                                                    Matched: {p.matchesPlayed || 0} Matches
                                                </span>
                                            </div>
                                        </div>

                                        {/* Score / Performance metric */}
                                        <div className="text-right flex flex-col justify-center items-end">
                                            <span className={`text-base font-black font-mono leading-none ${rank === 1 ? 'text-amber-400' : 'text-brand-light'}`}>
                                                {p.pointsScored || 0}
                                            </span>
                                            <span className="text-[8px] font-bold text-content-muted uppercase tracking-widest mt-0.5">PTS</span>
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {top5.length === 0 && (
                                <div className="text-center py-10 text-content-muted text-xs font-bold tracking-wider uppercase">
                                    No players recorded yet.
                                </div>
                            )}
                        </div>

                        {/* Footer Branding */}
                        <div className="w-full border-t border-white/5 pt-4 text-center">
                            <p className="text-[8px] tracking-[0.3em] text-content-muted font-black uppercase">
                                MatchUp Tournament Ecosystem • Platform Standard
                            </p>
                        </div>
                    </div>
                </div>

                {/* Export / Share Actions */}
                <div className="w-full flex flex-col gap-2.5">
                    <button 
                        onClick={handleShareOrDownload} 
                        disabled={exporting || generatingGif}
                        className="w-full bg-[#111111] hover:bg-[#1a1a1a] border border-white/10 text-white font-black uppercase tracking-[0.2em] text-[11px] py-4 rounded-xl flex justify-center items-center gap-2 transition-all active:scale-[0.98] shadow-md disabled:opacity-50 cursor-pointer"
                    >
                        <Download size={14} /> 
                        {exporting ? 'GENERATING IMAGE...' : 'DOWNLOAD PNG LEADERBOARD'}
                    </button>

                    <button 
                        onClick={handleGenerateGif} 
                        disabled={exporting || generatingGif}
                        className="w-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-amber-950 font-black uppercase tracking-[0.2em] text-[11px] py-4 rounded-xl flex justify-center items-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-amber-500/15 disabled:opacity-50 cursor-pointer"
                    >
                        <Film size={14} className={generatingGif ? 'animate-spin' : ''} /> 
                        {generatingGif ? `COMPILING GIF (${gifProgress}%)` : 'DOWNLOAD ANIMATED GIF'}
                    </button>

                    {generatingGif && (
                        <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden mt-1">
                            <div className="bg-amber-400 h-full transition-all duration-300" style={{ width: `${gifProgress}%` }} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    if (typeof document !== 'undefined') {
        return createPortal(content, document.body);
    }
    return null;
};
