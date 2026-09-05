import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Trophy, Award, Tv, Shield, Calendar, MapPin, Sparkles, Film, Archive } from 'lucide-react';
import { toPng } from 'html-to-image';
// @ts-ignore
import gifshot from 'gifshot';
import JSZip from 'jszip';
import { Card } from './ui/Card';
import { Match, Team, Tournament } from '../types';

interface StandingsOverlayExporterProps {
    isOpen: boolean;
    onClose: () => void;
    tournament: Tournament;
    categoryName?: string | null;
    teams: Team[];
    matches: Match[];
}

export const StandingsOverlayExporter: React.FC<StandingsOverlayExporterProps> = ({
    isOpen,
    onClose,
    tournament,
    categoryName = '',
    teams,
    matches
}) => {
    const overlayRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [previewScale, setPreviewScale] = useState(1);
    const [generating, setGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [selectedPageIndex, setSelectedPageIndex] = useState<number>(0);
    const [exportMode, setExportMode] = useState<'GIF' | 'ZIP'>('GIF');

    // Filter accepted teams
    const acceptedTeams = [...teams].filter(
        t => String(t.status) === 'ACCEPTED' || String(t.status) === 'accepted'
    );

    // Group teams
    const groups = acceptedTeams.reduce((acc: Record<string, Team[]>, team: any) => {
        const gid = team.groupId || 'A';
        if (!acc[gid]) acc[gid] = [];
        acc[gid].push(team);
        return acc;
    }, {});

    const groupKeys = Object.keys(groups).sort();

    const sortTeams = (teamList: Team[]) => {
        return [...teamList].sort((a: any, b: any) => {
            const ptsA = a.points || 0;
            const ptsB = b.points || 0;
            if (ptsB !== ptsA) return ptsB - ptsA;

            const gdA = (a.gamesWon || 0) - (a.gamesLost || 0);
            const gdB = (b.gamesWon || 0) - (b.gamesLost || 0);
            if (gdB !== gdA) return gdB - gdA;

            const winsA = a.wins || 0;
            const winsB = b.wins || 0;
            if (winsB !== winsA) return winsB - winsA;

            const gwA = a.gamesWon || 0;
            const gwB = b.gamesWon || 0;
            if (gwB !== gwA) return gwB - gwA;

            const glA = a.gamesLost || 0;
            const glB = b.gamesLost || 0;
            return glA - glB;
        });
    };

    // Extract knockout matches
    const isGroupMatch = (m: Match) => {
        const stage = m.stage?.toUpperCase();
        if (stage === 'GROUP') return true;
        if (m.roundName && m.roundName.toUpperCase().includes('GROUP')) return true;
        return false;
    };
    const knockoutMatches = matches.filter(m => !isGroupMatch(m));
    const hasKnockouts = knockoutMatches.length > 0;

    interface ExportPage {
        type: 'group' | 'knockout';
        groupId?: string;
        title: string;
        teams: Team[];
    }

    const exportPages: ExportPage[] = [];

    groupKeys.forEach(gId => {
        const sortedGroupTeams = sortTeams(groups[gId] || []);
        exportPages.push({
            type: 'group',
            groupId: gId,
            title: `GROUP ${gId} STANDINGS`,
            teams: sortedGroupTeams
        });
    });

    if (hasKnockouts) {
        exportPages.push({
            type: 'knockout',
            title: 'PLAYOFF BRACKET',
            teams: sortTeams(acceptedTeams)
        });
    }

    // Fallback if empty
    if (exportPages.length === 0) {
        exportPages.push({
            type: 'group',
            groupId: 'A',
            title: 'GROUP A STANDINGS',
            teams: []
        });
    }

    const activePage = exportPages[selectedPageIndex] || exportPages[0];

    // Teams to render on the active slide (limit to top 5)
    const teamsToRender = (activePage.teams || []).slice(0, 5);
    const knockoutsToRender = knockoutMatches.slice(-8); // Get up to 4 latest knockout matches

    useEffect(() => {
        if (!isOpen || !containerRef.current) return;
        
        const handleResize = () => {
            if (containerRef.current) {
                const containerWidth = containerRef.current.clientWidth;
                // Target layout designed at 1024px width
                const scaleFactor = Math.min(1, containerWidth / 1024);
                setPreviewScale(scaleFactor);
            }
        };

        const observer = new ResizeObserver(() => {
            handleResize();
        });
        observer.observe(containerRef.current);
        handleResize();

        const timer = setTimeout(handleResize, 100);

        return () => {
            observer.disconnect();
            clearTimeout(timer);
        };
    }, [isOpen]);

    const handleGenerateGif = async () => {
        if (!overlayRef.current || generating) return;
        setGenerating(true);
        setExportMode('GIF');
        setProgress(0);

        const frames: string[] = [];
        const totalPages = exportPages.length;

        try {
            const exportWidth = 1024;
            const exportHeight = 576;

            // Render each slide page sequentially and capture the frame
            for (let i = 0; i < totalPages; i++) {
                setSelectedPageIndex(i);
                
                // Keep progress calculation bounded between 0% and 80%
                const currentPercentage = Math.round(((i + 1) / totalPages) * 80);
                setProgress(currentPercentage);

                // Wait 600ms to ensure the React render and stylesheet apply completely
                await new Promise(resolve => setTimeout(resolve, 600));

                const dataUrl = await toPng(overlayRef.current, {
                    cacheBust: true,
                    style: {
                        transform: 'none',
                        position: 'relative',
                        top: '0',
                        left: '0',
                        width: '1024px',
                        height: '576px',
                        display: 'flex',
                        flexDirection: 'row',
                        padding: '32px'
                    },
                    pixelRatio: 1.5,
                    backgroundColor: '#030712',
                    width: exportWidth,
                    height: exportHeight
                });

                frames.push(dataUrl);
            }

            setProgress(85);
            await new Promise(resolve => setTimeout(resolve, 200));

            // Compile the captured slides into an animated slideshow GIF
            setProgress(90);
            gifshot.createGIF({
                images: frames,
                gifWidth: exportWidth,
                gifHeight: exportHeight,
                interval: 2.5, // Display each group page / slide for 2.5 seconds
                numFrames: frames.length,
                sampleInterval: 5,
                numWorkers: 2,
            }, function (obj: any) {
                if (!obj.error) {
                    const link = document.createElement('a');
                    const cleanName = tournament.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                    link.download = `standings-${cleanName}-${Date.now()}.gif`;
                    link.href = obj.image;
                    link.click();
                    setProgress(100);
                } else {
                    console.error('GIF compilation error:', obj.error);
                    alert('Could not compile animated GIF: ' + obj.error);
                }
                setGenerating(false);
                setSelectedPageIndex(0);
                setTimeout(() => setProgress(0), 1000);
            });

        } catch (err) {
            console.error('Failed to capture overlay broadcast frames:', err);
            alert('Frame capture failed. Please try again.');
            setGenerating(false);
            setSelectedPageIndex(0);
            setProgress(0);
        }
    };

    const handleGenerateZip = async () => {
        if (!overlayRef.current || generating) return;
        setGenerating(true);
        setExportMode('ZIP');
        setProgress(0);

        const zip = new JSZip();
        const totalPages = exportPages.length;

        try {
            const exportWidth = 1024;
            const exportHeight = 576;

            // Render each slide page sequentially and capture the frame
            for (let i = 0; i < totalPages; i++) {
                setSelectedPageIndex(i);
                
                // Keep progress calculation bounded between 0% and 80%
                const currentPercentage = Math.round(((i + 1) / totalPages) * 80);
                setProgress(currentPercentage);

                // Wait 600ms to ensure the React render and stylesheet apply completely
                await new Promise(resolve => setTimeout(resolve, 600));

                const dataUrl = await toPng(overlayRef.current, {
                    cacheBust: true,
                    style: {
                        transform: 'none',
                        position: 'relative',
                        top: '0',
                        left: '0',
                        width: '1024px',
                        height: '576px',
                        display: 'flex',
                        flexDirection: 'row',
                        padding: '32px'
                    },
                    pixelRatio: 1.5,
                    backgroundColor: '#030712',
                    width: exportWidth,
                    height: exportHeight
                });

                const base64Data = dataUrl.split(',')[1];
                const page = exportPages[i];
                const filename = page.type === 'group' 
                    ? `group-${(page.groupId || '').toLowerCase()}-standings.png`
                    : `playoffs-bracket.png`;
                
                zip.file(filename, base64Data, { base64: true });
            }

            setProgress(90);
            await new Promise(resolve => setTimeout(resolve, 300));

            const content = await zip.generateAsync({ type: 'blob' });
            
            const link = document.createElement('a');
            const cleanName = tournament.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            link.download = `standings-${cleanName}-pngs.zip`;
            link.href = URL.createObjectURL(content);
            link.click();
            
            setProgress(100);
            setGenerating(false);
            setSelectedPageIndex(0);
            setTimeout(() => setProgress(0), 1000);

        } catch (err) {
            console.error('Failed to capture overlay broadcast frames for ZIP:', err);
            alert('Frame capture failed. Please try again.');
            setGenerating(false);
            setSelectedPageIndex(0);
            setProgress(0);
        }
    };

    if (!isOpen) return null;

    const formattedDate = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    return createPortal(
        <div className="fixed inset-0 bg-black/95 z-[99999] backdrop-blur-md overflow-y-auto py-6 px-4 md:py-10 flex justify-center items-start">
            <div className="max-w-5xl w-full flex flex-col min-h-full justify-center">
                
                {/* Control Header */}
                <div className="w-full flex items-center justify-between mb-6 border-b border-white/10 pb-4">
                    <div>
                        <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2 uppercase tracking-tight">
                            <Tv className="text-[#4D78FF] animate-pulse" /> Broadcast Overlay Exporter
                        </h2>
                        <p className="text-xs text-content-muted mt-0.5 uppercase tracking-wider">
                            Export beautiful animated television-style graphics for social media & streams
                        </p>
                    </div>
                    <button 
                        onClick={onClose} 
                        disabled={generating}
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="w-full grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                    
                    {/* Configurations Menu */}
                    <div className="lg:col-span-1 space-y-4">
                        <Card variant="panel" className="p-4 border-white/5 bg-white/[0.01]">
                            <h3 className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-3">Export Slides</h3>
                            
                            <div className="space-y-2">
                                {exportPages.map((page, index) => (
                                    <button
                                        key={index}
                                        onClick={() => { if (!generating) setSelectedPageIndex(index); }}
                                        disabled={generating}
                                        className={`w-full p-3 rounded-xl flex items-center justify-between font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                                            selectedPageIndex === index 
                                                ? 'bg-[#4D78FF] text-white shadow-lg shadow-[#4D78FF]/20' 
                                                : 'bg-white/5 text-[#9CA3AF] hover:bg-white/10'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            {page.type === 'group' ? <Award size={14} /> : <Trophy size={14} />}
                                            <span>{page.type === 'group' ? `Group ${page.groupId}` : 'Playoffs'}</span>
                                        </div>
                                        <span className="text-[9px] opacity-60">Slide {index + 1}</span>
                                    </button>
                                ))}
                            </div>
                        </Card>

                        <Card variant="panel" className="p-4 border-white/5 space-y-4 bg-white/[0.01]">
                            <div>
                                <h3 className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-1">Export Formats</h3>
                                <p className="text-[10px] text-content-muted leading-relaxed">
                                    Export as an animated broadcast-style GIF slideshow or a ZIP archive of individual PNG slides.
                                </p>
                            </div>

                            {generating ? (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-bold text-[#4D78FF]">
                                        <span>GENERATING OVERLAY...</span>
                                        <span>{progress}%</span>
                                    </div>
                                    <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-[#4D78FF] to-[#00F0FF] transition-all duration-300" 
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-center text-content-muted uppercase tracking-wider animate-pulse">
                                        {progress < 80 
                                            ? `Capturing Slide ${selectedPageIndex + 1} of ${exportPages.length}...` 
                                            : `Assembling high-res ${exportMode} file...`}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <button
                                        onClick={handleGenerateGif}
                                        className="w-full bg-[#10B981] text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-[#059669] transition-all shadow-lg shadow-[#10B981]/20 uppercase text-xs tracking-wider cursor-pointer"
                                    >
                                        <Film size={16} className="animate-bounce" /> Export Standings GIF
                                    </button>

                                    <button
                                        onClick={handleGenerateZip}
                                        className="w-full bg-[#4D78FF] text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-[#3d68ef] transition-all shadow-lg shadow-[#4D78FF]/20 uppercase text-xs tracking-wider cursor-pointer"
                                    >
                                        <Archive size={16} /> Export PNGs (ZIP)
                                    </button>
                                </div>
                            )}
                        </Card>

                        <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5 text-[10px] text-white/60 space-y-2 leading-relaxed font-mono">
                            <div className="text-white/80 font-bold uppercase mb-1 flex items-center gap-1.5 text-xs">
                                <Sparkles size={14} className="text-[#4D78FF] animate-pulse" /> Broadcast Info
                            </div>
                            <div className="flex items-center gap-1.5">&bull; Compiles all groups into different pages</div>
                            <div className="flex items-center gap-1.5">&bull; High-contrast broadcast HUD cards</div>
                            <div className="flex items-center gap-1.5">&bull; Real-time tournament indicators</div>
                            <div className="flex items-center gap-1.5">&bull; Export format optimized for streams</div>
                        </div>
                    </div>

                    {/* Exporter Preview Screen */}
                    <div className="lg:col-span-3 flex flex-col items-center">
                        
                        {/* Live Screen Header Indicator */}
                        <div className="w-full flex justify-between items-center bg-[#0d0d12] border border-white/10 border-b-0 px-4 py-2.5 rounded-t-2xl text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest">
                            <span className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-[#10B981] animate-ping" />
                                Live HD Signal Output [1024x576]
                            </span>
                            <span>Slide Preview: {selectedPageIndex + 1} of {exportPages.length}</span>
                        </div>

                        {/* Capturable TV Overlay Wrapper */}
                        <div 
                            ref={containerRef}
                            className="w-full overflow-hidden border border-white/10 rounded-b-2xl aspect-[16/9] shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative bg-slate-950 flex items-center justify-center"
                        >
                            <div
                                style={{
                                    width: `${1024 * previewScale}px`,
                                    height: `${576 * previewScale}px`,
                                    position: 'relative',
                                    overflow: 'hidden',
                                    flexShrink: 0
                                }}
                            >
                                <div 
                                    ref={overlayRef}
                                    id="broadcast-standings-tv-graphic"
                                    className="bg-slate-950 p-8 flex flex-row gap-6 relative select-none box-border shrink-0"
                                    style={{ 
                                        width: '1024px', 
                                        height: '576px',
                                        backgroundImage: 'radial-gradient(circle at 10% 20%, #0d1321 0%, #030712 100%)',
                                        fontFamily: 'sans-serif',
                                        transform: `scale(${previewScale})`,
                                        transformOrigin: 'top left',
                                        position: 'absolute',
                                        top: 0,
                                        left: 0
                                    }}
                                >
                                {/* Accent Neon Borders/Lines */}
                                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#4D78FF] via-[#00F0FF] to-[#FF6B00]" />
                                <div className="absolute bottom-0 left-0 w-full h-1 bg-[#111]" />

                                {/* Left Info/Branding Section */}
                                <div className="w-1/3 flex flex-col justify-between relative z-10 text-left border-r border-white/5 pr-6">
                                    <div className="space-y-4">
                                        {/* App Brand Tag */}
                                        <div className="flex items-center gap-2">
                                            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#4D78FF] to-[#00F0FF] flex items-center justify-center shadow-lg shadow-[#4D78FF]/20">
                                                <Trophy size={14} className="text-white" />
                                            </div>
                                            <span className="text-[10px] font-black tracking-[0.25em] text-white font-mono uppercase">
                                                MATCH-UP TV
                                            </span>
                                        </div>

                                        {/* Main Graphic Title */}
                                        <div className="space-y-1">
                                            <div className="text-[10px] font-black tracking-widest text-[#00F0FF] font-mono uppercase">
                                                {activePage.type === 'group' ? 'LIVE TOURNAMENT STANDINGS' : 'PLAYOFF GRAPHIC'}
                                            </div>
                                            <h1 className="text-2xl font-black text-white leading-tight tracking-tight uppercase line-clamp-2">
                                                {tournament.name}
                                            </h1>
                                            {categoryName && (
                                                <div className="inline-block bg-[#4D78FF]/20 text-[#4D78FF] px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase font-mono border border-[#4D78FF]/30">
                                                    {categoryName}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bottom Overlay Metadata - TV Graphics Style */}
                                    <div className="space-y-3 pt-6 border-t border-white/5">
                                        <div className="space-y-1 text-content-muted font-mono text-[9px] tracking-wider uppercase">
                                            <div className="flex items-center gap-1.5 text-white/90">
                                                <MapPin size={10} className="text-[#FF6B00]" />
                                                <span>{tournament.venue || 'VIP Arena'}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-white/70">
                                                <Calendar size={10} className="text-white/50" />
                                                <span>{formattedDate}</span>
                                            </div>
                                        </div>

                                        <div className="text-[8px] font-mono tracking-[0.2em] text-[#9CA3AF] border-t border-white/5 pt-2 flex justify-between uppercase">
                                            <span>SYSTEM: HD STREAM</span>
                                            <span className="text-[#10B981] animate-pulse">● FEED SECURE</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Dynamic Graphics Table Panel */}
                                <div className="w-2/3 flex flex-col justify-between relative z-10 text-left pl-2">
                                    <div className="flex justify-between items-end mb-4">
                                        <h2 className={`font-black text-lg tracking-wider uppercase flex items-center gap-2 ${
                                            activePage.type === 'group' ? 'text-[#4D78FF]' : 'text-[#FF6B00]'
                                        }`}>
                                            <span className="h-1.5 w-6 rounded bg-current inline-block" />
                                            {activePage.title}
                                        </h2>
                                        <span className="text-[9px] font-mono text-[#00F0FF] tracking-widest bg-white/5 px-2.5 py-1 rounded-full uppercase border border-white/5">
                                            STANDINGS FEED
                                        </span>
                                    </div>

                                    {activePage.type === 'group' ? (
                                        /* Group Leaderboard Table Overlay */
                                        <div className="flex-1 flex flex-col justify-center space-y-2">
                                            {/* Header Row */}
                                            <div className="grid grid-cols-12 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase text-[#9CA3AF] tracking-wider font-mono">
                                                <div className="col-span-1 text-center font-bold">RK</div>
                                                <div className="col-span-5 text-left font-bold">TEAM</div>
                                                <div className="col-span-1.5 text-center font-bold">W</div>
                                                <div className="col-span-1.5 text-center font-bold">L</div>
                                                <div className="col-span-1.5 text-center font-bold">GD</div>
                                                <div className="col-span-1.5 text-right font-bold">PTS</div>
                                            </div>

                                            {/* Standing Rows */}
                                            {teamsToRender.length === 0 ? (
                                                <div className="text-center py-10 text-xs font-mono text-content-muted">
                                                    No accepted teams found in this group
                                                </div>
                                            ) : (
                                                teamsToRender.map((team, index) => {
                                                    return (
                                                        <div 
                                                            key={team.id}
                                                            className="grid grid-cols-12 items-center px-4 py-3 rounded-xl font-mono transition-all duration-300 relative bg-[#11131a]/80 border border-white/5 hover:border-[#4D78FF]/50"
                                                        >
                                                            {/* Rank badge */}
                                                            <div className="col-span-1 flex justify-center">
                                                                {index === 0 ? (
    <span className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black bg-[#FFD700] text-[#8B6508] shadow-[0_0_10px_rgba(255,215,0,0.5)]">{index + 1}</span>
) : index === 1 ? (
    <span className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black bg-[#C0C0C0] text-[#4A4A4A] shadow-[0_0_10px_rgba(192,192,192,0.4)]">{index + 1}</span>
) : index === 2 ? (
    <span className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black bg-[#CD7F32] text-[#5C3A16] shadow-[0_0_10px_rgba(205,127,50,0.4)]">{index + 1}</span>
) : (
    <span className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black bg-white/10 text-white">{index + 1}</span>
)}
                                                            </div>

                                                            {/* Team Name */}
                                                            <div className="col-span-5 text-left truncate pr-2">
                                                                <span className="text-[12px] font-black tracking-tight text-white">
                                                                    {team.name}
                                                                </span>
                                                            </div>

                                                            {/* Stats */}
                                                            <div className="col-span-1.5 text-center text-[11px] font-bold text-[#10B981]">
                                                                {team.wins || 0}
                                                            </div>
                                                            <div className="col-span-1.5 text-center text-[11px] font-bold text-[#EF4444]">
                                                                {team.losses || 0}
                                                            </div>
                                                            <div className="col-span-1.5 text-center text-[11px] text-[#9CA3AF]">
                                                                {(team.gamesWon || 0) - (team.gamesLost || 0)}
                                                            </div>
                                                            <div className="col-span-1.5 text-right text-[12px] font-black text-[#4D78FF]">
                                                                {team.points || 0}
                                                            </div>

                                                            {/* Qualified Indicator Bubble */}
                                                            {index < 2 && (
                                                                <span className="absolute -top-1.5 -right-1.5 bg-[#10B981] text-white text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow">
                                                                    QUALIFIED
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    ) : (
                                        /* Playoff Matches Display Overlay */
                                        <div className="flex-1 flex flex-col justify-center space-y-2.5">
                                            {knockoutsToRender.length === 0 ? (
                                                <div className="text-center py-10 text-xs font-mono text-content-muted">
                                                    No completed playoff matches found in this tournament
                                                </div>
                                            ) : (
                                                knockoutsToRender.map((match) => {
                                                    const t1Winner = match.winnerTeamId === match.team1Id;
                                                    const t2Winner = match.winnerTeamId === match.team2Id;

                                                    return (
                                                        <div 
                                                            key={match.id}
                                                            className="flex flex-col p-3 rounded-xl font-mono transition-all duration-300 relative bg-[#11131a]/80 border border-white/5"
                                                        >
                                                            {/* Stage Title / Court metadata */}
                                                            <div className="flex justify-between items-center text-[8px] font-black text-content-muted uppercase tracking-wider border-b border-white/5 pb-1 mb-1.5">
                                                                <span className="text-[#FF6B00]">
                                                                    {match.roundName || `ROUND ${match.round}`}
                                                                </span>
                                                                <span>{match.court} &bull; COMPLETED</span>
                                                            </div>

                                                            {/* Match Teams Grid */}
                                                            <div className="grid grid-cols-12 items-center">
                                                                <div className="col-span-5 text-left truncate flex items-center gap-1.5">
                                                                    <span className={`text-[11px] font-black ${t1Winner ? 'text-white' : 'text-[#8A9AB0]'}`}>
                                                                        {match.team1Id ? acceptedTeams.find(t => t.id === match.team1Id)?.name || 'Team 1' : 'TBD'}
                                                                    </span>
                                                                    {t1Winner && <Trophy size={10} className="text-yellow-500 inline shrink-0" />}
                                                                </div>
                                                                <div className="col-span-2 text-center text-[9px] font-bold text-content-muted">
                                                                    VS
                                                                </div>
                                                                <div className="col-span-5 text-right truncate flex items-center justify-end gap-1.5">
                                                                    {t2Winner && <Trophy size={10} className="text-yellow-500 inline shrink-0" />}
                                                                    <span className={`text-[11px] font-black ${t2Winner ? 'text-white' : 'text-[#8A9AB0]'}`}>
                                                                        {match.team2Id ? acceptedTeams.find(t => t.id === match.team2Id)?.name || 'Team 2' : 'TBD'}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Score overlay bar */}
                                                            <div className="text-center text-[10px] font-black text-[#00F0FF] tracking-wider mt-1.5 bg-black/45 py-1 rounded-lg">
                                                                SET SCORES: {match.score?.p1Sets || 0} - {match.score?.p2Sets || 0} 
                                                                <span className="text-content-muted ml-1.5 text-[8px] font-normal">
                                                                    ({(match.score?.p1SetScores || []).map((s, idx) => `${s}-${match.score?.p2SetScores?.[idx] || 0}`).join(', ')})
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )}

                                    {/* Sponsorship/Credit bar in broadcast graphics style */}
                                    <div className="text-right border-t border-white/5 pt-3 mt-4 text-[7px] font-mono text-content-muted tracking-[0.25em] uppercase flex justify-between items-center">
                                        <span className="flex items-center gap-1">
                                            <Shield size={8} className="text-[#00F0FF]" />
                                            <span>OFFICIAL TELECAST SOURCE GRAPHICS</span>
                                        </span>
                                        <span>&copy; {new Date().getFullYear()} INTERNATIONAL GRAPHICS GROUP</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                        {/* Exporter Preview Helper */}
                        <div className="mt-3 flex items-center gap-2 text-[11px] text-content-muted font-mono uppercase bg-white/5 px-4 py-1.5 rounded-full border border-white/5">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-ping" />
                            <span>Select slides on the left sidebar to preview different layout screens</span>
                        </div>
                    </div>

                </div>
            </div>
        </div>,
        document.body
    );
};
