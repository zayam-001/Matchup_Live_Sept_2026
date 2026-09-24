import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trophy, X, Medal, Zap, Activity, ArrowUpRight, Wind, ArrowDownToLine, Download } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import { SponsorTier } from '../types';
import { toPng } from 'html-to-image';
import { Logo } from './ui/Logo';
import { motion, AnimatePresence } from 'framer-motion';

export const WinnerBanner = ({ match, tournamentName, teams, sponsors, onClose, quickplayPlayers }: any) => {
    const bannerRef = useRef<HTMLDivElement>(null);
    const [bannerMode, setBannerMode] = useState<'WINNER' | 'RUNNER_UP'>('WINNER');

    const isFinal = match.roundName?.toLowerCase().includes('final') && 
                   !match.roundName?.toLowerCase().includes('semi') && 
                   !match.roundName?.toLowerCase().includes('quarter');

    const isTeam1Winner = (match.winner === 1) || (match.winnerTeamId === match.team1Id);

    let t1Name = quickplayPlayers 
        ? ((match.team1Players?.map((i:any) => quickplayPlayers[i]?.fullName).join(' & ')) || match.player1 || 'Team A') 
        : (teams?.find((t: any) => t.id === match.team1Id)?.name || match.team1Name || 'Team A');
    let t2Name = quickplayPlayers 
        ? ((match.team2Players?.map((i:any) => quickplayPlayers[i]?.fullName).join(' & ')) || match.player2 || 'Team B') 
        : (teams?.find((t: any) => t.id === match.team2Id)?.name || match.team2Name || 'Team B');

    // Extract players safely
    const t1P1 = quickplayPlayers ? quickplayPlayers[match.team1Players?.[0]] : teams?.find((t: any) => t.id === match.team1Id)?.player1;
    const t1P2 = quickplayPlayers ? quickplayPlayers[match.team1Players?.[1]] : teams?.find((t: any) => t.id === match.team1Id)?.player2;
    const t2P1 = quickplayPlayers ? quickplayPlayers[match.team2Players?.[0]] : teams?.find((t: any) => t.id === match.team2Id)?.player1;
    const t2P2 = quickplayPlayers ? quickplayPlayers[match.team2Players?.[1]] : teams?.find((t: any) => t.id === match.team2Id)?.player2;

    const winnerName = isTeam1Winner ? t1Name : t2Name;
    const runnerUpName = isTeam1Winner ? t2Name : t1Name;
    
    // Players for winner / runner up views
    const wp1 = isTeam1Winner ? t1P1 : t2P1;
    const wp2 = isTeam1Winner ? t1P2 : t2P2;
    const wpTeamTag = isTeam1Winner ? 'T1' : 'T2';

    const rp1 = isTeam1Winner ? t2P1 : t1P1;
    const rp2 = isTeam1Winner ? t2P2 : t1P2;
    const rpTeamTag = isTeam1Winner ? 'T2' : 'T1';

    const calculateMVP = () => {
        let stats = {
            'p1': { name: t1P1?.name || t1P1?.fullName || 'Player 1', P_W: 0, P_G: 0, P_S: 0, G_P: 0, I: 0 },
            'p2': { name: t1P2?.name || t1P2?.fullName || 'Player 2', P_W: 0, P_G: 0, P_S: 0, G_P: 0, I: 0 },
            'p3': { name: t2P1?.name || t2P1?.fullName || 'Player 3', P_W: 0, P_G: 0, P_S: 0, G_P: 0, I: 0 },
            'p4': { name: t2P2?.name || t2P2?.fullName || 'Player 4', P_W: 0, P_G: 0, P_S: 0, G_P: 0, I: 0 },
        };

        const t1Games = (match.score?.p1Games || 0) + (match.score?.p1SetScores || []).reduce((a:number,b:number)=>a+b, 0);
        const t2Games = (match.score?.p2Games || 0) + (match.score?.p2SetScores || []).reduce((a:number,b:number)=>a+b, 0);
        const t1Sets = match.score?.p1Sets || 0;
        const t2Sets = match.score?.p2Sets || 0;

        stats['p1'].P_G = t1Games; stats['p1'].P_S = t1Sets;
        stats['p2'].P_G = t1Games; stats['p2'].P_S = t1Sets;
        stats['p3'].P_G = t2Games; stats['p3'].P_S = t2Sets;
        stats['p4'].P_G = t2Games; stats['p4'].P_S = t2Sets;

        const history = match.score?.history || [];
        history.forEach((ev: string) => {
            const parts = ev.split('|');
            if (parts[0] === 'T1' || parts[0] === 'T2') {
                const team = parts[0];
                const pStr = parts[2];
                const tag = parts[3];
                if (tag === 'winner' || tag === 'point') {
                    const pId = team === 'T1' ? (pStr === '1' ? 'p1' : 'p2') : (pStr === '1' ? 'p3' : 'p4');
                    stats[pId as keyof typeof stats].P_W += 1;
                }
            }
        });

        (Object.keys(stats) as Array<keyof typeof stats>).forEach(k => {
            const s = stats[k];
            s.I = (s.P_W * 1.0) + (s.P_G * 2.0) + (s.P_S * 4.0) + (s.G_P * 1.5);
        });

        const wTeam = isTeam1Winner ? ['p1', 'p2'] as const : ['p3', 'p4'] as const;
        const p2Exists = isTeam1Winner ? !!t1P2 : !!t2P2;
        
        let mvp = stats[wTeam[0]];
        if (p2Exists) {
            if (stats[wTeam[1]].I > mvp.I) {
                mvp = stats[wTeam[1]];
            } else if (stats[wTeam[1]].I === mvp.I) {
                mvp = { ...mvp, name: `${mvp.name} & ${stats[wTeam[1]].name}` };
            }
        }
        return mvp.I > 0 ? mvp : null;
    };
    
    const mvp = calculateMVP();

    const displayTeam = bannerMode === 'WINNER' ? {
        name: winnerName, p1: wp1, p2: wp2, teamTag: wpTeamTag, title: isFinal ? 'CHAMPION' : 'MATCH WINNER', isChamp: isFinal
    } : {
        name: runnerUpName, p1: rp1, p2: rp2, teamTag: rpTeamTag, title: 'RUNNER UP', isChamp: false
    };

    const getBannerDate = () => {
        const rawDate = match.completedAt || match.scheduledTime || match.createdAt;
        const dateObj = rawDate ? new Date(rawDate) : new Date();
        const year = dateObj.getFullYear();
        const month = dateObj.toLocaleString('en-US', { month: 'long' });
        return `${month} ${year}`;
    };

    const displaySponsors = sponsors?.filter((s: any) => typeof s !== 'string' && s.tier !== SponsorTier.SILVER) || [];

    const handleShareOrDownload = async () => {
        if (!bannerRef.current) return;
        try {
            const dataUrl = await toPng(bannerRef.current, { 
                cacheBust: true, 
                style: { transform: 'none' }, 
                pixelRatio: 2,
                backgroundColor: '#0a0a0a'
            });
            const blob = await (await fetch(dataUrl)).blob();
            const file = new File([blob], `${displayTeam.title.toLowerCase().replace(' ', '-')}-${match.matchId || match.id}.png`, { type: 'image/png' });

            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: `${displayTeam.name} - ${displayTeam.title}!`,
                    text: `${displayTeam.title} of ${match.roundName || 'Match'} at ${tournamentName}!`,
                    files: [file]
                });
            } else {
                const link = document.createElement('a');
                link.download = `${displayTeam.title.toLowerCase().replace(' ', '-')}-${match.matchId || match.id}.png`;
                link.href = dataUrl;
                link.click();
            }
        } catch (err) {
            console.error('Failed to generate sharing image:', err);
        }
    };

    const calculateActualSets = (score: any) => {
        if (!score) return { p1: 0, p2: 0 };
        let p1 = 0; let p2 = 0;
        if (score.p1SetScores && score.p2SetScores && score.p1SetScores.length > 0) {
            score.p1SetScores.forEach((s: number, i: number) => {
                const os = score.p2SetScores[i] || 0;
                if (s > os) p1++; else if (os > s) p2++;
            });
            if (p1 + p2 > 0) return { p1, p2 };
        }
        if (score.p1Sets > 0 || score.p2Sets > 0) return { p1: score.p1Sets || 0, p2: score.p2Sets || 0 };
        if (score.p1Games > 0 || score.p2Games > 0) return { p1: score.p1Games || 0, p2: score.p2Games || 0 };
        return { p1: 0, p2: 0 };
    };

    const actualSets = calculateActualSets(match.score);
    const wSets = isTeam1Winner ? actualSets.p1 : actualSets.p2;
    const rSets = isTeam1Winner ? actualSets.p2 : actualSets.p1;

    const getRealtimePlayerStats = (playerId: string, teamTag: 'T1'|'T2', playerTag: '1'|'2') => {
        let winners = 0;
        const finishers: Record<string, number> = {};
        let hasData = false;
        
        if (match.score?.history && Array.isArray(match.score.history)) {
            match.score.history.forEach((h: string) => {
                const parts = h.split('|');
                if (parts.length >= 4) {
                    const evTeam = parts[0];
                    const playerIdx = parts[2];
                    const actionType = parts[3];
                    const finish = parts[4];
                    
                    if (evTeam === teamTag && playerIdx === playerTag && (actionType === 'W' || actionType === 'winner' || actionType === 'winner_forced')) {
                        winners++;
                        hasData = true;
                        if (finish && finish !== 'generic') finishers[finish] = (finishers[finish] || 0) + 1;
                    }
                }
            });
        }
        
        if (!hasData && match.playerStats?.[playerId]) {
            const fb = match.playerStats[playerId];
            if (fb.winners) winners = fb.winners;
            if (fb.finishers) Object.assign(finishers, fb.finishers);
            else if (fb.smashes) finishers['smash'] = fb.smashes;
        }
        
        return { winners, finishers };
    };

    const ALL_SKILLS = [
      { id: 'smash', label: 'Smash', icon: Zap },
      { id: 'bandeja', label: 'Bandeja', icon: Activity },
      { id: 'volley', label: 'Volley', icon: ArrowUpRight },
      { id: 'vibora', label: 'Vibora', icon: Wind },
      { id: 'drop shot', label: 'Drop', icon: ArrowDownToLine },
    ];

    const renderSkillsGrid = (playerId: string, teamTag: 'T1'|'T2', playerTag: '1'|'2', isChampStyle: boolean) => {
        if (!playerId && !match.score?.history?.length) return null;

        const stats = getRealtimePlayerStats(playerId, teamTag, playerTag);
        
        return (
            <div className="grid grid-cols-5 gap-2 mt-3">
                {ALL_SKILLS.map(skill => {
                    const count = Object.entries(stats.finishers).find(([k]) => k.toLowerCase() === skill.id)?.[1] || 0;
                    const hasSkill = count > 0;
                    const Icon = skill.icon;
                    return (
                        <div key={skill.id} className={`flex flex-col items-center justify-center py-2.5 px-1.5 rounded-xl border transition-all ${
                            hasSkill 
                                ? isChampStyle 
                                    ? 'bg-amber-500/10 border-amber-500/30' 
                                    : 'bg-brand/15 border-brand/40'
                                : 'bg-white/5 border-white/5'
                        }`}>
                            <Icon size={18} className={`mb-1.5 ${hasSkill ? (isChampStyle ? 'text-amber-400' : 'text-brand') : 'text-content-muted'}`} />
                            <div className={`text-[9px] font-bold uppercase tracking-wider mb-1 whitespace-nowrap ${hasSkill ? (isChampStyle ? 'text-amber-500/90' : 'text-brand-light') : 'text-content-muted/70'}`}>{skill.label}</div>
                            <div className={`text-base font-black font-mono leading-none ${hasSkill ? (isChampStyle ? 'text-amber-200' : 'text-white') : 'text-content-muted/30'}`}>{count}</div>
                        </div>
                    );
                })}
            </div>
        )
    };

    // Styling configurations mapped to state
    const styles = displayTeam.isChamp ? {
        bg: "from-[#F59E0B]/10 via-black to-[#111] border-[#F59E0B]/30",
        btn: "bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-amber-950 hover:from-amber-400 hover:to-amber-500"
    } : bannerMode === 'RUNNER_UP' ? {
        bg: "from-brand/10 via-black to-[#05070a] border-brand/35 shadow-brand/5",
        btn: "bg-brand text-white hover:bg-brand/90"
    } : { // REGULAR WINNER
        bg: "from-brand/10 via-black to-[#0A0A0A] border-brand/30",
        btn: "bg-brand text-white hover:bg-brand/95"
    };

    const content = (
        <div className="fixed inset-0 z-[20000] bg-black/95 overflow-y-auto backdrop-blur-md">
            <div className="min-h-[100dvh] flex flex-col items-center p-4 sm:p-8">
                <div className="m-auto w-full max-w-[540px] flex flex-col pt-12 pb-4 relative">
                    <button onClick={onClose} className="absolute -top-4 -right-2 sm:-right-4 text-white hover:text-white bg-black/60 hover:bg-black w-10 h-10 flex items-center justify-center rounded-full z-30 transition-colors border border-white/20"><X size={18}/></button>
                    {isFinal && (
                        <div data-html2canvas-ignore className="w-full flex bg-[#111111] rounded-xl p-1 mb-6 shrink-0 border border-white/10 shadow-lg">
                            <button 
                                onClick={() => setBannerMode('WINNER')} 
                                className={`flex-1 py-3 text-xs font-black uppercase tracking-[0.2em] rounded-lg transition-all ${bannerMode === 'WINNER' ? 'bg-[#F59E0B] text-black shadow-lg scale-100' : 'text-content-muted hover:text-white scale-[0.98]'}`}
                            >
                                Finals Winner
                            </button>
                            <button 
                                onClick={() => setBannerMode('RUNNER_UP')} 
                                className={`flex-1 py-3 text-xs font-black uppercase tracking-[0.2em] rounded-lg transition-all ${bannerMode === 'RUNNER_UP' ? 'bg-gray-200 text-black shadow-lg scale-100' : 'text-content-muted hover:text-white scale-[0.98]'}`}
                            >
                                Runner-Up
                            </button>
                        </div>
                    )}

                    <div className={`w-full relative mb-6 shadow-2xl ${
                        displayTeam.isChamp ? 'shadow-[#F59E0B]/20' : bannerMode === 'RUNNER_UP' ? 'shadow-white/10' : 'shadow-brand/20'
                    } rounded-[20px]`}>
                        <div ref={bannerRef} className={`w-full bg-black bg-gradient-to-br ${styles.bg} border rounded-[20px] p-6 md:p-8 overflow-hidden text-center transition-colors duration-500 relative`}>
                            <AnimatePresence mode='wait'>
                            <motion.div key={bannerMode} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.2 }}>
                    
                    {!isFinal ? (
                        <>
                            {/* MATCH WINNER LAYOUT */}
                            <div className="flex items-center justify-between w-full mb-5">
                                <div className="flex items-center gap-1.5 opacity-90">
                                    <Logo size={20} variant="white" />
                                    <span className="font-brand font-black uppercase tracking-widest text-base text-white">MATCHUP</span>
                                </div>
                                <span className="bg-brand/10 border border-brand/30 rounded-xl px-3.5 py-1.5 text-xs font-black tracking-[0.15em] text-brand uppercase">
                                    {tournamentName || 'QuickPlay'}
                                </span>
                            </div>
                            
                            <div className="w-full h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent my-2" />
                            
                            <div className="text-xs sm:text-sm font-black tracking-[0.2em] text-content-muted uppercase mt-3 mb-2">
                                {match.roundName || 'Match Result'} {match.court ? `· ${match.court}` : ''}
                            </div>
                            
                            <div className="text-[10px] sm:text-xs font-bold tracking-[0.2em] text-brand uppercase mb-0.5">Match Winner</div>
                            <h1 className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-brand-light italic tracking-tight mb-6 leading-none">
                                VICTORY
                            </h1>
                            
                            {/* VS Block */}
                            <div className="w-full bg-brand/10 border border-brand/20 rounded-xl p-4 flex items-center justify-between relative overflow-hidden mb-2">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand" />
                                <div className="flex flex-col text-left px-2">
                                    <span className="text-[10px] uppercase font-bold tracking-[0.15em] text-brand mb-1">Winner</span>
                                    <span className="text-lg sm:text-xl font-black text-white leading-tight">{winnerName}</span>
                                </div>
                                <span className="text-4xl sm:text-5xl font-brand font-black text-white mr-1">{wSets}</span>
                            </div>

                            <div className="flex items-center justify-center gap-2 my-2 opacity-60">
                                <div className="h-px w-8 bg-white/20" />
                                <span className="text-xs font-black tracking-widest bg-white/5 border border-white/10 px-2 py-0.5 rounded text-white">VS</span>
                                <div className="h-px w-8 bg-white/20" />
                            </div>

                            <div className="w-full bg-white/5 border border-content-muted/20 rounded-xl p-3 flex items-center justify-between relative overflow-hidden mb-5">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-content-muted/50" />
                                <div className="flex flex-col text-left px-2">
                                    <span className="text-[10px] uppercase font-bold tracking-[0.15em] text-content-secondary mb-1">Defeated</span>
                                    <span className="text-lg sm:text-xl font-black text-content-secondary leading-tight">{runnerUpName}</span>
                                </div>
                                <span className="text-4xl sm:text-5xl font-brand font-black text-content-muted mr-1">{rSets}</span>
                            </div>

                            {/* MVP Badge */}
                            {mvp && mvp.I > 0 && bannerMode === 'WINNER' && (
                                <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex flex-col items-center justify-center mb-6 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-3 opacity-20"><Trophy size={32} className="text-amber-500" /></div>
                                    <span className="text-[10px] uppercase font-bold tracking-[0.25em] text-amber-500 mb-1">Match MVP</span>
                                    <span className="text-xl sm:text-2xl font-black text-amber-400 leading-tight tracking-widest">{mvp.name}</span>
                                    <span className="text-[10px] text-amber-500/70 mt-1.5 font-mono bg-amber-500/10 px-2 py-0.5 rounded">
                                        Impact Score: {mvp.I.toFixed(1)}
                                    </span>
                                </div>
                            )}

                            {/* Sets */}
                            <div className="w-full text-left mb-6">
                                <div className="text-xs sm:text-sm font-black tracking-[0.2em] text-content-muted uppercase mb-3">Set Scores</div>
                                <div className="flex gap-1.5">
                                    {((match.score?.p1SetScores?.length || 0) > 0 ? match.score.p1SetScores : (match.score?.p1Games > 0 || match.score?.p2Games > 0 ? [match.score.p1Games] : [])).map((s1: number, i: number) => {
                                        const s2 = match.score.p2SetScores?.[i] ?? match.score?.p2Games ?? 0;
                                        const winScore = isTeam1Winner ? s1 : s2;
                                        const loseScore = isTeam1Winner ? s2 : s1;
                                        const winnerWonTheSet = winScore > loseScore;
                                        return (
                                            <div key={i} className="flex-1 bg-white/5 border border-white/10 rounded-lg py-2.5 text-center">
                                                <div className="text-[9px] font-bold tracking-[0.15em] text-content-muted uppercase mb-1">Set {i+1}</div>
                                                <div className="flex justify-center items-center gap-1.5 font-brand text-lg sm:text-xl leading-none">
                                                    <span className={winnerWonTheSet ? 'text-brand-light' : 'text-content-muted'}>{winScore}</span>
                                                    <span className="text-xs text-content-secondary">-</span>
                                                    <span className={!winnerWonTheSet ? 'text-brand-light' : 'text-content-muted'}>{loseScore}</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                            
                            <div className="w-full h-px bg-white/5 mb-5" />

                            {/* Skills Grid */}
                            <div className="w-full text-left">
                                <div className="text-xs sm:text-sm font-black tracking-[0.2em] text-content-muted uppercase mb-4 text-center">Player Skills This Match</div>
                                
                                {wp1 && (
                                    <div className="mb-5">
                                        <div className="text-xs sm:text-sm font-black uppercase tracking-widest text-brand mb-1.5 flex items-center gap-2">
                                            {wp1.name || wp1.fullName}
                                            <div className="flex-1 h-px bg-brand/30" />
                                        </div>
                                        {renderSkillsGrid(wp1.id, wpTeamTag, '1', false)}
                                    </div>
                                )}

                                {wp2 && (
                                    <div className="mb-2">
                                        <div className="text-xs sm:text-sm font-black uppercase tracking-widest text-brand mb-1.5 flex items-center gap-2">
                                            {wp2.name || wp2.fullName}
                                            <div className="flex-1 h-px bg-brand/30" />
                                        </div>
                                        {renderSkillsGrid(wp2.id, wpTeamTag, '2', false)}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : ( 
                        <>
                            {/* FINALS / RUNNER UP LAYOUT */}
                            <div className="flex items-center justify-between w-full mb-6">
                                <div className="flex items-center gap-2 opacity-90">
                                    <Logo size={20} variant="white" />
                                    <span className={`font-brand font-black uppercase tracking-widest text-base ${displayTeam.isChamp ? 'text-amber-400' : 'text-white'}`}>MATCHUP</span>
                                </div>
                                <span className={`${displayTeam.isChamp ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-white/10 border-white/20 text-gray-400'} rounded-xl px-3 py-1.5 text-xs font-extrabold tracking-[0.15em] uppercase`}>
                                    GRAND FINAL
                                </span>
                            </div>
                            
                            <div className={`w-full h-px bg-gradient-to-r from-transparent ${displayTeam.isChamp ? 'via-amber-500/50' : bannerMode === 'RUNNER_UP' ? 'via-[#4D78FF]/50' : 'via-white/30'} to-transparent my-2`} />
                            
                            <div className="text-center my-6">
                                <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center border-2 shadow-lg transition-transform duration-300 ${displayTeam.isChamp ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 shadow-amber-500/5' : bannerMode === 'RUNNER_UP' ? 'bg-[#4D78FF]/10 border-[#4D78FF]/40 text-[#4D78FF] shadow-[#4D78FF]/10 animate-pulse' : 'bg-white/5 border-white/30 text-gray-300 shadow-white/5'}`}>
                                    {displayTeam.isChamp ? <Trophy size={36} className="animate-bounce" /> : <Medal size={36} />}
                                </div>
                                
                                {/* Tournament name: Prominent & Highlighted */}
                                <div className={`text-xl sm:text-2xl font-black tracking-widest uppercase mb-1 drop-shadow-md ${displayTeam.isChamp ? 'text-amber-400' : 'text-[#4D78FF]'}`}>
                                    {tournamentName || 'QuickPlay'}
                                </div>

                                {/* Dynamic Date: Month + Year */}
                                <div className={`text-xs sm:text-sm uppercase tracking-[0.2em] font-black mb-6 ${displayTeam.isChamp ? 'text-amber-600' : 'text-content-muted/90'}`}>
                                    {getBannerDate()}
                                </div>

                                <div className={`text-xs sm:text-sm font-bold tracking-[0.25em] uppercase mb-1.5 ${displayTeam.isChamp ? 'text-amber-500/80' : bannerMode === 'RUNNER_UP' ? 'text-[#4D78FF]/90 font-black' : 'text-white/60'}`}>
                                    {displayTeam.isChamp ? 'Tournament Champion' : 'Runner-Up'}
                                </div>
                                
                                <h1 className={`text-5xl sm:text-6xl font-black italic tracking-tighter mb-4 leading-none uppercase drop-shadow-2xl ${displayTeam.isChamp ? 'text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500' : bannerMode === 'RUNNER_UP' ? 'text-transparent bg-clip-text bg-gradient-to-r from-brand-light via-brand to-[#7EA0FF]' : 'text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400'}`}>
                                    {displayTeam.isChamp ? 'CHAMPIONS' : bannerMode === 'RUNNER_UP' ? 'RUNNER-UP' : 'FINALIST'}
                                </h1>
                            </div>

                            {/* Final VS Cards */}
                            <div className={`w-full rounded-[14px] p-4 flex items-center gap-3 relative overflow-hidden mb-3 ${
                                displayTeam.isChamp 
                                    ? 'bg-amber-500/5 border border-amber-500/20 shadow-md shadow-amber-500/5' 
                                    : bannerMode === 'RUNNER_UP'
                                        ? 'bg-white/5 border border-white/10 opacity-75'
                                        : 'bg-brand/5 border border-brand/20'
                            }`}>
                                <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent ${
                                    displayTeam.isChamp 
                                        ? 'via-amber-500/40' 
                                        : bannerMode === 'RUNNER_UP'
                                            ? 'via-white/10'
                                            : 'via-brand/40'
                                } to-transparent`} />
                                <Avatar src={wp1?.photoUrl || wp1?.photoURL} fallback=" " size="lg" className={`w-14 h-14 shrink-0 border border-dashed ${
                                    displayTeam.isChamp 
                                        ? 'border-amber-500/50' 
                                        : bannerMode === 'RUNNER_UP'
                                            ? 'border-white/20'
                                            : 'border-brand/50'
                                }`} />
                                <div className="flex-1 text-left">
                                    <div className={`text-[10px] sm:text-xs font-bold tracking-[0.2em] uppercase mb-0.5 ${
                                        displayTeam.isChamp 
                                            ? 'text-amber-500' 
                                            : bannerMode === 'RUNNER_UP'
                                                ? 'text-gray-400'
                                                : 'text-brand'
                                    }`}>Champions</div>
                                    <div className="text-xl sm:text-2xl font-black leading-tight text-white">{winnerName}</div>
                                    <div className={`text-[10px] sm:text-xs font-bold mt-1.5 ${
                                        displayTeam.isChamp 
                                            ? 'text-amber-700/90' 
                                            : bannerMode === 'RUNNER_UP'
                                                ? 'text-content-muted/80'
                                                : 'text-brand/70'
                                    }`}>{wp1?.name || wp1?.fullName} • {wp2?.name || wp2?.fullName}</div>
                                </div>
                                <div className={`text-4xl sm:text-5xl font-brand font-black mr-2 ${
                                    displayTeam.isChamp 
                                        ? 'text-amber-400' 
                                        : bannerMode === 'RUNNER_UP'
                                            ? 'text-gray-450'
                                            : 'text-brand'
                                }`}>{wSets}</div>
                            </div>

                            <div className="flex items-center justify-center gap-2 my-2 opacity-60">
                                <div className="h-px w-8 bg-white/20" />
                                <span className={`text-[10px] sm:text-xs font-black tracking-widest px-1.5 rounded bg-transparent ${displayTeam.isChamp ? 'text-amber-700' : bannerMode === 'RUNNER_UP' ? 'text-brand' : 'text-content-muted'}`}>VS</span>
                                <div className="h-px w-8 bg-white/20" />
                            </div>

                            <div className={`w-full rounded-[14px] p-4 flex items-center gap-3 relative overflow-hidden mb-5 ${
                                bannerMode === 'RUNNER_UP' 
                                    ? 'bg-brand/10 border border-brand/40 shadow-lg shadow-brand/15' 
                                    : 'bg-white/5 border border-white/10'
                            }`}>
                                <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent ${
                                    bannerMode === 'RUNNER_UP' 
                                        ? 'via-brand' 
                                        : 'via-white/20'
                                } to-transparent`} />
                                <Avatar src={rp1?.photoUrl || rp1?.photoURL} fallback=" " size="lg" className={`w-14 h-14 shrink-0 border border-dashed ${
                                    bannerMode === 'RUNNER_UP' 
                                        ? 'border-brand' 
                                        : 'border-white/30'
                                }`} />
                                <div className="flex-1 text-left">
                                    <div className={`text-[10px] sm:text-xs font-bold tracking-[0.2em] uppercase mb-0.5 ${
                                        bannerMode === 'RUNNER_UP' 
                                            ? 'text-brand-light font-black animate-pulse' 
                                            : 'text-gray-400'
                                    }`}>Runner-Up</div>
                                    <div className={`text-xl sm:text-2xl font-black leading-tight ${
                                        bannerMode === 'RUNNER_UP' 
                                            ? 'text-white' 
                                            : 'text-content-secondary'
                                    }`}>{runnerUpName}</div>
                                    <div className={`text-[10px] sm:text-xs font-bold mt-1.5 ${
                                        bannerMode === 'RUNNER_UP' 
                                            ? 'text-brand-light/90' 
                                            : 'text-content-muted/80'
                                    }`}>{rp1?.name || rp1?.fullName} • {rp2?.name || rp2?.fullName}</div>
                                </div>
                                <div className={`text-4xl sm:text-5xl font-brand font-black mr-2 ${
                                    bannerMode === 'RUNNER_UP' 
                                        ? 'text-brand-light font-black' 
                                        : 'text-gray-450'
                                }`}>{rSets}</div>
                            </div>

                            {/* Sets */}
                            <div className="w-full text-left mb-6">
                                <div className={`text-[10px] sm:text-xs font-bold tracking-[0.2em] uppercase mb-3 ${displayTeam.isChamp ? 'text-amber-700' : 'text-content-muted'}`}>Final Score</div>
                                <div className="flex gap-1.5">
                                    {((match.score?.p1SetScores?.length || 0) > 0 ? match.score.p1SetScores : (match.score?.p1Games > 0 || match.score?.p2Games > 0 ? [match.score.p1Games] : [])).map((s1: number, i: number) => {
                                        const s2 = match.score.p2SetScores?.[i] ?? match.score?.p2Games ?? 0;
                                        const winScore = isTeam1Winner ? s1 : s2;
                                        const loseScore = isTeam1Winner ? s2 : s1;
                                        const isWinnerSet = winScore > loseScore;
                                        return (
                                            <div key={i} className={`flex-1 rounded-lg py-2 text-center border ${displayTeam.isChamp ? 'bg-amber-500/5 border-amber-500/20' : 'bg-white/5 border-white/10'}`}>
                                                <div className={`text-[9px] sm:text-[10px] font-bold tracking-[0.15em] uppercase mb-1 ${displayTeam.isChamp ? 'text-amber-700' : 'text-content-muted'}`}>Set {i+1}</div>
                                                <div className="flex justify-center items-center gap-1.5 font-brand text-base sm:text-lg leading-none">
                                                    <span className={isWinnerSet ? (displayTeam.isChamp ? 'text-amber-400' : 'text-brand-light') : 'text-content-muted'}>{winScore}</span>
                                                    <span className="text-[9px] text-content-secondary">-</span>
                                                    <span className={!isWinnerSet ? (displayTeam.isChamp ? 'text-amber-400' : 'text-brand-light') : 'text-content-muted'}>{loseScore}</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className={`w-full h-px ${displayTeam.isChamp ? 'bg-amber-500/20' : 'bg-white/10'} mb-5`} />

                            <div className="w-full text-left font-sans">
                                <div className={`text-xs sm:text-sm font-black tracking-[0.2em] uppercase mb-4 text-center ${
                                    displayTeam.isChamp 
                                        ? 'text-amber-700' 
                                        : bannerMode === 'RUNNER_UP'
                                            ? 'text-brand'
                                            : 'text-gray-400'
                                }`}>
                                    {displayTeam.isChamp ? 'Championship Skills' : 'Runner-Up Skills'}
                                </div>
                                
                                {displayTeam.p1 && (
                                    <div className="mb-5 font-sans">
                                        <div className={`text-xs sm:text-sm font-black uppercase tracking-widest flex items-center gap-2 mb-2 ${
                                            displayTeam.isChamp 
                                                ? 'text-amber-500' 
                                                : bannerMode === 'RUNNER_UP'
                                                    ? 'text-brand-light font-extrabold'
                                                    : 'text-gray-300'
                                        }`}>
                                            {displayTeam.p1.name || displayTeam.p1.fullName}
                                            <div className={`flex-1 h-px ${
                                                displayTeam.isChamp 
                                                    ? 'bg-amber-500/30' 
                                                    : bannerMode === 'RUNNER_UP'
                                                        ? 'bg-brand/35'
                                                        : 'bg-white/20'
                                            }`} />
                                        </div>
                                        {renderSkillsGrid(displayTeam.p1.id, displayTeam.teamTag as 'T1'|'T2', '1', displayTeam.isChamp)}
                                    </div>
                                )}

                                {displayTeam.p2 && (
                                    <div className="mb-2 font-sans">
                                        <div className={`text-xs sm:text-sm font-black uppercase tracking-widest flex items-center gap-2 mb-2 ${
                                            displayTeam.isChamp 
                                                ? 'text-amber-500' 
                                                : bannerMode === 'RUNNER_UP'
                                                    ? 'text-brand-light font-extrabold'
                                                    : 'text-gray-300'
                                        }`}>
                                            {displayTeam.p2.name || displayTeam.p2.fullName}
                                            <div className={`flex-1 h-px ${
                                                displayTeam.isChamp 
                                                    ? 'bg-amber-500/30' 
                                                    : bannerMode === 'RUNNER_UP'
                                                        ? 'bg-brand/35'
                                                        : 'bg-white/20'
                                            }`} />
                                        </div>
                                        {renderSkillsGrid(displayTeam.p2.id, displayTeam.teamTag as 'T1'|'T2', '2', displayTeam.isChamp)}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                    
                    {match.refereeNotes && match.refereeNotes.length > 0 && (
                        <div className="flex flex-wrap justify-center gap-1.5 mt-5">
                             {match.refereeNotes.map((tag: string) => (
                                 <span key={tag} className="px-2 py-1 bg-white/5 text-content-muted border border-white/10 text-[9px] font-black rounded uppercase tracking-widest">{tag}</span>
                             ))}
                        </div>
                    )}

                    {displaySponsors.length > 0 && (
                        <div className="border-t border-white/10 pt-5 w-full mt-6">
                            <p className="text-[9px] text-content-muted uppercase tracking-[0.4em] font-black mb-4 animate-pulse">Official Partners</p>
                            <div className="flex flex-wrap justify-center items-center gap-4">
                                {displaySponsors.map((s: any, i: number) => (
                                    <img key={i} src={s.logo} className="h-8 object-contain grayscale opacity-60 mix-blend-screen" />
                                ))}
                            </div>
                        </div>
                    )}
                    </motion.div>
                </AnimatePresence>
             </div>
            </div>
             
             <div data-html2canvas-ignore className="w-full flex flex-col gap-2 pt-2 pb-8 shrink-0">
                 <button onClick={handleShareOrDownload} className={`w-full font-black uppercase tracking-[0.15em] text-xs py-4 rounded-[12px] flex justify-center items-center gap-2 transition-transform active:scale-95 shadow-xl ${styles.btn}`}>
                     <Download size={14} className="mb-0.5" /> Export PNG
                 </button>
             </div>
                </div>
            </div>
        </div>
    );

    if (typeof document !== 'undefined') {
        return createPortal(content, document.body);
    }
    return null;
};
