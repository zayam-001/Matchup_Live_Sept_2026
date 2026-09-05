import React, { useMemo, useState, useRef } from 'react';
import { toJpeg } from 'html-to-image';
import gifshot from 'gifshot';
import { Tournament, Match, MatchStatus, Team } from '../types';
import { useTournamentMatches } from '../hooks/useTournamentMatches';
import { isMatchInCategory } from '../services/storage';
import { Trophy, Medal, Star, Hash, User, Activity, Flame, Crown, X, ChevronRight, Download, Image as ImageIcon, Film } from 'lucide-react';
import { Card } from './ui/Card';
import { Logo } from './ui/Logo';

export const TournamentLeaderboardTab = ({ tournament, categoryId }: { tournament: Tournament; categoryId: string | null }) => {
    const { matches: globalMatches } = useTournamentMatches(tournament.id);
    const [viewMode, setViewMode] = useState<"OVERALL" | "SKILLS">("OVERALL");
    const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
    const leaderboardRef = useRef<HTMLDivElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const exportBannerRef = useRef<HTMLDivElement>(null);
    const skillsBannerRef = useRef<HTMLDivElement>(null);
    const [isExporting, setIsExporting] = useState(false);

    const handleExportJPG = async (ref: React.RefObject<HTMLDivElement>, filename: string) => {
        if (!ref.current) return;
        setIsExporting(true);
        try {
            const dataUrl = await toJpeg(ref.current, { quality: 0.95, backgroundColor: '#0f1115' });
            const link = document.createElement('a');
            link.download = `${filename}.jpg`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('Failed to export JPG:', err);
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportGIF = async (ref: React.RefObject<HTMLDivElement>, filename: string) => {
        if (!ref.current) return;
        setIsExporting(true);
        try {
            const el = ref.current;
            const frames: string[] = [];
            
            // Elements
            const p3 = el.querySelector('.gif-p3') as HTMLElement;
            const p2 = el.querySelector('.gif-p2') as HTMLElement;
            const p1 = el.querySelector('.gif-p1') as HTMLElement;
            const listItems = Array.from(el.querySelectorAll('.gif-list-item')) as HTMLElement[];
            const bg1 = el.querySelector('.gif-bg1') as HTMLElement;
            const bg2 = el.querySelector('.gif-bg2') as HTMLElement;

            const hideAll = () => {
                if(p3) p3.style.opacity = '0';
                if(p2) p2.style.opacity = '0';
                if(p1) p1.style.opacity = '0';
                listItems.forEach(item => { item.style.opacity = '0'; });
                if(bg1) bg1.style.transform = 'scale(1)';
                if(bg2) bg2.style.transform = 'scale(1)';
            };

            const captureFrame = async () => {
                await new Promise(r => setTimeout(r, 50));
                return await toJpeg(el, { quality: 0.8, backgroundColor: '#0f1115' });
            };

            // Setup
            hideAll();
            frames.push(await captureFrame()); // Frame 0: Empty

            // Reveal 3rd
            if (p3) p3.style.opacity = '1';
            frames.push(await captureFrame());

            // Reveal 2nd
            if (p2) p2.style.opacity = '1';
            frames.push(await captureFrame());

            // Reveal 1st
            if (p1) p1.style.opacity = '1';
            frames.push(await captureFrame());

            // Reveal list items
            for (let i = 0; i < listItems.length; i++) {
                listItems[i].style.opacity = '1'; 
                if (i % 2 === 1 || i === listItems.length - 1) {
                    frames.push(await captureFrame());
                }
            }

            // Pulse backgrounds for extra juice
            for (let i = 1; i <= 3; i++) {
                if (bg1) bg1.style.transform = `scale(${1 + (i * 0.05)})`;
                if (bg2) bg2.style.transform = `scale(${1 + (i * 0.05)})`;
                frames.push(await captureFrame());
            }

            // Hold last frame
            frames.push(frames[frames.length - 1]);
            frames.push(frames[frames.length - 1]);

            // Reset
            if(p3) p3.style.opacity = '1';
            if(p2) p2.style.opacity = '1';
            if(p1) p1.style.opacity = '1';
            listItems.forEach(item => { item.style.opacity = '1'; });
            if(bg1) bg1.style.transform = 'scale(1)';
            if(bg2) bg2.style.transform = 'scale(1)';

            gifshot.createGIF({
                images: frames,
                gifWidth: el.offsetWidth,
                gifHeight: el.offsetHeight,
                interval: 0.25, // 4 frames per second
                numFrames: frames.length
            }, (obj: any) => {
                if (!obj.error) {
                    const link = document.createElement('a');
                    link.download = `${filename}.gif`;
                    link.href = obj.image;
                    link.click();
                }
                setIsExporting(false);
            });
        } catch (err) {
            console.error('Failed to export GIF:', err);
            setIsExporting(false);
        }
    };

    const leaderboardData = useMemo(() => {
        if (!globalMatches) return [];

        const filteredMatches = globalMatches.filter(m => 
            isMatchInCategory(m, categoryId, tournament) && 
            ((m.status === MatchStatus.COMPLETED || String(m.status).toUpperCase() === 'FINISHED') || String(m.status) === 'COMPLETED')
        );

        const teamMap = new Map<string, Team>();
        if (tournament.teams) {
            tournament.teams.forEach(t => teamMap.set(t.id, t));
        }

        const playerStats = new Map<string, {
            id: string;
            name: string;
            photoUrl?: string;
            matchesWon: number;
            placementBonus: number;
            skillPoints: number;
            skillCounts: Record<string, number>;
            highestPlacementName: string;
        }>();

        const initPlayer = (id: string | undefined, name: string, photoUrl?: string) => {
            const pid = id || name; // Fallback to name if id is missing
            if (!pid) return;
            if (!playerStats.has(pid)) {
                playerStats.set(pid, {
                    id: pid, name, photoUrl, matchesWon: 0, placementBonus: 15, highestPlacementName: 'Participation', skillPoints: 0, skillCounts: {}
                });
            }
            return pid;
        };

        if (tournament.teams) {
            tournament.teams.forEach(t => {
                if (isMatchInCategory(t as any, categoryId, tournament)) {
                    if (t.player1) initPlayer(t.player1.id, t.player1.name, t.player1.photoUrl);
                    if (t.player2) initPlayer(t.player2.id, t.player2.name, t.player2.photoUrl);
                }
            });
        }

        filteredMatches.forEach(m => {
            let p1Id = null, p2Id = null, p3Id = null, p4Id = null;
            if (m.team1Id) {
                const t = teamMap.get(m.team1Id);
                if (t?.player1) p1Id = initPlayer(t.player1.id, t.player1.name, t.player1.photoUrl);
                if (t?.player2) p2Id = initPlayer(t.player2.id, t.player2.name, t.player2.photoUrl);
            }
            if (m.team2Id) {
                const t = teamMap.get(m.team2Id);
                if (t?.player1) p3Id = initPlayer(t.player1.id, t.player1.name, t.player1.photoUrl);
                if (t?.player2) p4Id = initPlayer(t.player2.id, t.player2.name, t.player2.photoUrl);
            }

            const wId = m.winnerTeamId;
            const rName = m.roundName || '';
            const isFinal = rName.toLowerCase().includes('final') && !rName.toLowerCase().includes('quarter') && !rName.toLowerCase().includes('semi');
            const is3rd = rName.toLowerCase().includes('3rd');
            const isSemi = rName.toLowerCase().includes('semi');
            const isQuarter = rName.toLowerCase().includes('quarter') || rName.toLowerCase().includes('round of 8');
            const isR16 = rName.toLowerCase().includes('round of 16');

            let winnerPlacement = 15;
            let loserPlacement = 15;

            if (isFinal) {
                winnerPlacement = 200; loserPlacement = 150;
            } else if (is3rd) {
                winnerPlacement = 100; loserPlacement = 80;
            } else if (isSemi) {
                winnerPlacement = 150; loserPlacement = 100;
            } else if (isQuarter) {
                winnerPlacement = 100; loserPlacement = 30;
            } else if (isR16) {
                winnerPlacement = 30; loserPlacement = 15;
            }

            const processTeam = (teamId: string, isWinner: boolean) => {
                const t = teamMap.get(teamId);
                if (!t) return;
                const updatePlayer = (pId: string) => {
                    const ps = playerStats.get(pId);
                    if (!ps) return;
                    if (isWinner) ps.matchesWon++;
                    const placement = isWinner ? winnerPlacement : loserPlacement;
                    if (placement > ps.placementBonus) {
                        ps.placementBonus = placement;
                        ps.highestPlacementName = isWinner ? `Winner (${rName})` : `Reached ${rName}`;
                    }
                };
                if (t.player1) {
                   const pid = t.player1.id || t.player1.name;
                   updatePlayer(pid);
                }
                if (t.player2) {
                   const pid = t.player2.id || t.player2.name;
                   updatePlayer(pid);
                }
            };

            if (m.team1Id) processTeam(m.team1Id, wId === m.team1Id);
            if (m.team2Id) processTeam(m.team2Id, wId === m.team2Id);

            if (m.score?.history && Array.isArray(m.score.history)) {
                m.score.history.forEach((point: any) => {
                    // Check if it's new structure (point.action) or old string-based format
                    if (typeof point === 'string') {
                        // string-based history format e.g., 'T1|12345|1|winner|smash'
                        const parts = point.split('|');
                        if (parts.length >= 5) {
                            const type = parts[0];
                            const playerIdx = parseInt(parts[2] || "1");
                            const tag = parts[3];
                            const finisher = parts[4]?.toLowerCase();
                            
                            const isWinnerTag = tag === 'winner';
                            if (isWinnerTag && finisher && ['smash', 'vibora', 'bandeja', 'volley', 'drop shot', 'drop'].includes(finisher)) {
                                let actualPlayerId = null;
                                if (type === 'T1' && playerIdx === 1) actualPlayerId = p1Id;
                                else if (type === 'T1' && playerIdx === 2) actualPlayerId = p2Id;
                                else if (type === 'T2' && playerIdx === 1) actualPlayerId = p3Id;
                                else if (type === 'T2' && playerIdx === 2) actualPlayerId = p4Id;

                                if (actualPlayerId) {
                                    const ps = playerStats.get(actualPlayerId);
                                    if (ps) {
                                        ps.skillPoints += 5;
                                        ps.skillCounts[finisher] = (ps.skillCounts[finisher] || 0) + 1;
                                    }
                                }
                            }
                        }
                    } else if (point.action) {
                        const action = point.action;
                        const isWinnerTag = action.type === 'winner' || action.tag === 'winner';
                        const finisher = action.finisher?.toLowerCase() || '';
                        const localPId = action.playerId; // 'p1', 'p2', 'p3', 'p4' or actual DB ID
                        
                        let actualPlayerId = localPId;
                        if (localPId === 'p1') actualPlayerId = p1Id;
                        else if (localPId === 'p2') actualPlayerId = p2Id;
                        else if (localPId === 'p3') actualPlayerId = p3Id;
                        else if (localPId === 'p4') actualPlayerId = p4Id;

                        if (actualPlayerId && ['smash', 'vibora', 'bandeja', 'volley', 'drop shot', 'drop'].includes(finisher)) {
                            const ps = playerStats.get(actualPlayerId);
                            if (ps) {
                                ps.skillPoints += 5;
                                ps.skillCounts[finisher] = (ps.skillCounts[finisher] || 0) + 1;
                            }
                        }
                    }
                });
            }
        });

        const arr = Array.from(playerStats.values()).map(ps => ({
            ...ps,
            totalPoints: ps.placementBonus + (15 * ps.matchesWon) + ps.skillPoints
        }));

        arr.sort((a, b) => b.totalPoints - a.totalPoints || b.matchesWon - a.matchesWon || b.skillPoints - a.skillPoints);
        return arr;

    }, [globalMatches, tournament, categoryId]);

    
    const skillsChampionsData = useMemo(() => {
        return leaderboardData.filter(p => p.skillPoints > 0).sort((a, b) => b.skillPoints - a.skillPoints);
    }, [leaderboardData]);

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-10">
            
            {/* View Selector */}
            <div className="flex justify-end mb-4">
                <select 
                    value={viewMode}
                    onChange={(e) => setViewMode(e.target.value as "OVERALL" | "SKILLS")}
                    className="px-4 py-2 bg-surface-panel border border-white/10 rounded-xl text-white font-bold focus:outline-none focus:border-brand"
                >
                    <option value="OVERALL">Overall Leaderboard</option>
                    <option value="SKILLS">Skills Champions</option>
                </select>
            </div>

            {viewMode === 'OVERALL' && (
            <div ref={leaderboardRef} className="bg-[#0f1115] p-6 rounded-2xl">

            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-xl font-black text-white flex items-center gap-2 italic uppercase tracking-tight">
                        <Medal className="text-[#E65C31]" size={24} /> Tournament Leaderboard
                    </h3>
                    <p className="text-content-secondary text-sm mt-1">Individual player points based on placement, match wins, and skill shots.</p>
                </div>
                <div className="flex items-center gap-2" data-html2canvas-ignore>
                    <button 
                        onClick={() => handleExportJPG(exportBannerRef, `${tournament.name}-leaderboard`)}
                        disabled={isExporting}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors text-sm font-bold disabled:opacity-50"
                    >
                        <ImageIcon size={16} /> JPG
                    </button>
                    <button 
                        onClick={() => handleExportGIF(exportBannerRef, `${tournament.name}-leaderboard`)}
                        disabled={isExporting}
                        className="flex items-center gap-2 px-3 py-1.5 bg-brand/20 hover:bg-brand/30 text-brand rounded-lg transition-colors text-sm font-bold disabled:opacity-50"
                    >
                        <Film size={16} /> GIF
                    </button>
                </div>
            </div>

            {leaderboardData.length === 0 ? (
                <div className="text-center py-20 flex flex-col items-center justify-center bg-surface-panel rounded-2xl border border-white/5 border-dashed">
                    <Trophy size={48} className="text-white/10 mb-4" />
                    <div className="text-lg font-bold text-white uppercase italic tracking-tight">No Data Yet</div>
                    <div className="text-content-muted text-sm mt-1 max-w-sm mx-auto">
                        Leaderboard will populate once matches are completed and scored.
                    </div>
                </div>
            ) : (
                <Card className="overflow-hidden border-white/10 bg-[#0f1115]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wider text-content-muted">
                                    <th className="px-6 py-4 font-bold">Rank</th>
                                    <th className="px-6 py-4 font-bold">Player</th>
                                    <th className="px-6 py-4 font-bold text-center">Pts</th>
                                    <th className="px-6 py-4 font-bold text-center">Wins</th>
                                    <th className="px-6 py-4 font-bold text-center">Place</th>
                                    <th className="px-6 py-4 font-bold text-center">Skills</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {leaderboardData.map((player, idx) => (
                                    <tr key={player.id} onClick={() => setSelectedPlayer(player)} className="hover:bg-white/[0.05] transition-colors cursor-pointer">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                {idx === 0 ? <Crown size={18} className="text-yellow-500" /> :
                                                 idx === 1 ? <Medal size={18} className="text-gray-300" /> :
                                                 idx === 2 ? <Medal size={18} className="text-amber-600" /> :
                                                 <Hash size={16} className="text-white/20" />}
                                                <span className={`font-black ${idx < 3 ? 'text-white' : 'text-white/60'} italic`}>
                                                    {idx + 1}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[#4D78FF] font-bold text-xs shrink-0 overflow-hidden">
                                                    {player.photoUrl ? (
                                                        <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        player.name.substring(0, 2).toUpperCase()
                                                    )}
                                                </div>
                                                <span className="font-bold text-white">{player.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className="text-brand font-black text-lg">{player.totalPoints}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <div className="flex flex-col items-center justify-center">
                                                <span className="text-white font-bold">{player.matchesWon}</span>
                                                <span className="text-[10px] text-white/40 uppercase">+{player.matchesWon * 15}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <div className="flex flex-col items-center justify-center">
                                                <span className="text-white font-bold">{player.placementBonus}</span>
                                                <span className="text-[10px] text-white/40 uppercase">Bonus</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <div className="flex flex-col items-center justify-center">
                                                <span className="text-[#E65C31] font-bold">{player.skillPoints}</span>
                                                <span className="text-[10px] text-white/40 uppercase">
                                                    {Object.keys(player.skillCounts).length > 0 ? 
                                                        Object.entries(player.skillCounts).map(([k, v]) => `${v}${k.charAt(0).toUpperCase()}`).join(' ') 
                                                        : '-'}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            </div>
            
                        
                        )} 

            {/* Skills Champions Section */}
            {viewMode === 'SKILLS' && skillsChampionsData.length === 0 && (
                <div className="text-center py-20 flex flex-col items-center justify-center bg-surface-panel rounded-2xl border border-white/5 border-dashed">
                    <Flame size={48} className="text-white/10 mb-4" />
                    <div className="text-lg font-bold text-white uppercase italic tracking-tight">No Skill Data Yet</div>
                    <div className="text-content-muted text-sm mt-1 max-w-sm mx-auto">
                        Players need to earn skill points to appear here.
                    </div>
                </div>
            )}
            {viewMode === "SKILLS" && skillsChampionsData.length > 0 && (
                <div className="bg-[#0f1115] p-6 rounded-2xl mt-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-xl font-black text-white flex items-center gap-2 italic uppercase tracking-tight">
                                <Flame className="text-[#E65C31]" size={24} /> Skills Champions
                            </h3>
                            <p className="text-content-secondary text-sm mt-1">Players who earned skill points throughout the tournament.</p>
                        </div>
                        <div className="flex items-center gap-2" data-html2canvas-ignore>
                            <button 
                                onClick={() => handleExportJPG(skillsBannerRef, `${tournament.name}-skills-champions`)}
                                disabled={isExporting}
                                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors text-sm font-bold disabled:opacity-50"
                            >
                                <ImageIcon size={16} /> JPG
                            </button>
                        </div>
                    </div>
                    
                    <Card className="overflow-hidden border-white/10 bg-[#0f1115]">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wider text-content-muted">
                                        <th className="px-6 py-4 font-bold w-20">Rank</th>
                                        <th className="px-6 py-4 font-bold">Player</th>
                                        <th className="px-6 py-4 font-bold text-center">Skill Points</th>
                                        <th className="px-6 py-4 font-bold text-left">Skill Breakdown</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {skillsChampionsData.map((player, idx) => (
                                        <tr key={player.id} onClick={() => setSelectedPlayer(player)} className="hover:bg-white/[0.05] transition-colors cursor-pointer">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    {idx === 0 ? <Flame size={18} className="text-[#E65C31]" /> : <Hash size={16} className="text-white/20" />}
                                                    <span className={`font-black ${idx === 0 ? 'text-[#E65C31]' : 'text-white/60'} italic`}>
                                                        {idx + 1}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[#4D78FF] font-bold text-xs shrink-0 overflow-hidden border border-white/10">
                                                        {player.photoUrl ? (
                                                            <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            player.name.substring(0, 2).toUpperCase()
                                                        )}
                                                    </div>
                                                    <span className="font-bold text-white text-lg">{player.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span className="text-[#E65C31] font-black text-2xl">{player.skillPoints}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-2">
                                                    {Object.entries(player.skillCounts).map(([k, v]) => (
                                                        <span key={k} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-white/80">
                                                            <span className="text-[#E65C31] mr-1">{v}x</span> {k.charAt(0).toUpperCase() + k.slice(1)}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}


            {/* Skills Export Banner Container */}
            <div className="absolute top-[-9999px] left-[-9999px]">
                <div 
                    ref={skillsBannerRef} 
                    className="w-[1080px] h-[1080px] bg-[#0f1115] overflow-hidden flex flex-col relative"
                    style={{
                        backgroundSize: "40px 40px",
                        backgroundImage: 'radial-gradient(circle at top right, rgba(230,92,49,0.2), transparent 60%), radial-gradient(circle at 10px 10px, rgba(255,255,255,0.05) 2px, transparent 0)',
                    }}
                >
                    {/* Background Decorative Elements */}
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#E65C31]/15 rounded-full blur-[120px]"></div>
                    <div className="absolute bottom-[-100px] left-[-100px] w-[600px] h-[600px] bg-[#4D78FF]/15 rounded-full blur-[100px]"></div>
                    
                    <div className="relative z-10 flex flex-col h-full p-12">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-10">
                            <Logo size={100} variant="white" />
                            <div className="text-right max-w-[70%]">
                                <h2 className="text-4xl font-black text-[#E65C31] italic uppercase tracking-tight break-words leading-tight">{tournament.name}</h2>
                                <p className="text-2xl text-white font-bold mt-2 uppercase tracking-widest flex items-center justify-end gap-2">
                                    <Flame size={24} className="text-[#E65C31]" />
                                    {categoryId && tournament.categories?.find((c: any) => c.id === categoryId)?.name ? 
                                        `${tournament.categories.find((c: any) => c.id === categoryId)?.name} - ` : ''}
                                    Skills Champions
                                </p>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col gap-4">
                            {skillsChampionsData.slice(0, 8).map((player: any, idx: number) => (
                                <div key={player.id} className="flex items-center bg-[#15181e]/80 border border-white/10 rounded-2xl p-5 shadow-lg">
                                    <div className="w-16 text-center font-black text-4xl italic mr-4 flex justify-center">
                                        {idx === 0 ? <Flame size={40} className="text-[#E65C31]" /> : <span className="text-white/30">#{idx + 1}</span>}
                                    </div>
                                    
                                    <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center text-[#4D78FF] font-bold text-3xl shrink-0 overflow-hidden border-2 border-white/10 mr-6 shadow-inner">
                                        {player.photoUrl ? (
                                            <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover" />
                                        ) : (
                                            player.name.substring(0, 2).toUpperCase()
                                        )}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0 flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <h3 className={`text-3xl font-black truncate ${idx === 0 ? 'text-[#E65C31]' : 'text-white'}`}>{player.name}</h3>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {Object.entries(player.skillCounts).map(([k, v]: [string, any]) => (
                                                    <span key={k} className="px-3 py-1 bg-white/10 rounded text-sm font-bold text-white/90 uppercase tracking-wider">
                                                        <span className="text-[#E65C31] mr-1">{v}x</span> {k}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="text-right shrink-0 pl-8 border-l border-white/10 min-w-[150px] flex flex-col items-end">
                                        <div className="text-xs font-bold text-white/50 uppercase tracking-widest mb-1">Total SP</div>
                                        <div className="text-6xl font-black text-[#E65C31] tabular-nums leading-none tracking-tighter">
                                            {player.skillPoints}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <div className="mt-8 text-center border-t border-white/10 pt-6">
                            <p className="text-white/30 font-black uppercase tracking-[0.5em] text-xl">app.matchup.com.pk</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Export Banner Container - Hidden visually but used for HTML-to-Image */}
            <div className="absolute top-[-9999px] left-[-9999px]">
                <div 
                    ref={exportBannerRef} 
                    className="w-[1080px] h-[1080px] bg-[#0f1115] overflow-hidden flex flex-col relative"
                    style={{
                        backgroundSize: "40px 40px",
                        backgroundImage: 'radial-gradient(circle at top right, rgba(230,92,49,0.2), transparent 60%), radial-gradient(circle at 10px 10px, rgba(255,255,255,0.05) 2px, transparent 0)',
                    }}
                >
                    {/* Background Decorative Elements */}
                    <div className="gif-bg1 absolute top-0 right-0 w-[500px] h-[500px] bg-[#E65C31]/15 rounded-full blur-[120px]"></div>
                    <div className="gif-bg2 absolute bottom-[-100px] left-[-100px] w-[600px] h-[600px] bg-[#4D78FF]/15 rounded-full blur-[100px]"></div>
                    
                    <div className="relative z-10 flex flex-col h-full p-12">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-8">
                            <Logo size={100} variant="white" />
                            <div className="text-right max-w-[70%]">
                                <h2 className="text-4xl font-black text-[#E65C31] italic uppercase tracking-tight break-words leading-tight">{tournament.name}</h2>
                                <p className="text-2xl text-white font-bold mt-2 uppercase tracking-widest">
                                    {categoryId && tournament.categories?.find((c: any) => c.id === categoryId)?.name ? 
                                        `${tournament.categories.find((c: any) => c.id === categoryId)?.name} - ` : ''}
                                    Top 8 Leaderboard
                                </p>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col justify-between">
                            {/* Podium for Top 3 */}
                            <div className="flex items-end justify-center h-[360px] gap-6 mb-6 mt-4">
                                {/* 2nd Place */}
                                {leaderboardData[1] && (
                                    <div className="gif-p2 flex flex-col items-center w-[250px] relative">
                                        <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center text-[#4D78FF] font-bold text-3xl shrink-0 overflow-hidden border-4 border-gray-300 relative z-10 bg-[#15181e] shadow-[0_0_20px_rgba(209,213,219,0.3)]">
                                            {leaderboardData[1].photoUrl ? (
                                                <img src={leaderboardData[1].photoUrl} alt={leaderboardData[1].name} className="w-full h-full object-cover" />
                                            ) : (
                                                leaderboardData[1].name.substring(0, 2).toUpperCase()
                                            )}
                                        </div>
                                        <div className="bg-[#15181e]/80 bg-gradient-to-t from-gray-400/20 to-transparent border border-gray-300/30 rounded-t-2xl w-full pt-8 pb-4 px-4 flex flex-col items-center mt-[-30px] shadow-lg h-[200px] justify-between">
                                            <div className="flex flex-col items-center w-full">
                                                <h3 className="text-2xl font-black text-white text-center leading-tight line-clamp-2">{leaderboardData[1].name}</h3>
                                                <span className="text-sm font-bold text-white/50 uppercase tracking-widest mt-1">2nd Place</span>
                                            </div>
                                            <div className="text-5xl font-black text-gray-300 tabular-nums leading-none tracking-tighter mt-auto drop-shadow-md">
                                                {leaderboardData[1].totalPoints}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {/* 1st Place */}
                                {leaderboardData[0] && (
                                    <div className="gif-p1 flex flex-col items-center w-[280px] relative z-20">
                                        <Crown size={64} className="text-yellow-500 absolute -top-14 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)] z-20" />
                                        <div className="w-32 h-32 rounded-full bg-white/10 flex items-center justify-center text-[#4D78FF] font-bold text-4xl shrink-0 overflow-hidden border-4 border-yellow-500 relative z-10 bg-[#15181e] shadow-[0_0_30px_rgba(234,179,8,0.4)]">
                                            {leaderboardData[0].photoUrl ? (
                                                <img src={leaderboardData[0].photoUrl} alt={leaderboardData[0].name} className="w-full h-full object-cover" />
                                            ) : (
                                                leaderboardData[0].name.substring(0, 2).toUpperCase()
                                            )}
                                        </div>
                                        <div className="bg-[#15181e]/80 bg-gradient-to-t from-yellow-500/20 to-transparent border border-yellow-500/30 rounded-t-2xl w-full pt-10 pb-6 px-4 flex flex-col items-center mt-[-40px] shadow-2xl h-[250px] justify-between">
                                            <div className="flex flex-col items-center w-full">
                                                <h3 className="text-3xl font-black text-white text-center leading-tight line-clamp-2 drop-shadow-md">{leaderboardData[0].name}</h3>
                                                <span className="text-sm font-bold text-yellow-500 uppercase tracking-widest mt-1">1st Place</span>
                                            </div>
                                            <div className="text-7xl font-black text-yellow-500 tabular-nums leading-none tracking-tighter mt-auto drop-shadow-lg">
                                                {leaderboardData[0].totalPoints}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {/* 3rd Place */}
                                {leaderboardData[2] && (
                                    <div className="gif-p3 flex flex-col items-center w-[250px] relative">
                                        <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center text-[#4D78FF] font-bold text-3xl shrink-0 overflow-hidden border-4 border-amber-700 relative z-10 bg-[#15181e] shadow-[0_0_20px_rgba(180,83,9,0.3)]">
                                            {leaderboardData[2].photoUrl ? (
                                                <img src={leaderboardData[2].photoUrl} alt={leaderboardData[2].name} className="w-full h-full object-cover" />
                                            ) : (
                                                leaderboardData[2].name.substring(0, 2).toUpperCase()
                                            )}
                                        </div>
                                        <div className="bg-[#15181e]/80 bg-gradient-to-t from-amber-700/30 to-transparent border border-amber-700/30 rounded-t-2xl w-full pt-8 pb-4 px-4 flex flex-col items-center mt-[-30px] shadow-lg h-[180px] justify-between">
                                            <div className="flex flex-col items-center w-full">
                                                <h3 className="text-2xl font-black text-white text-center leading-tight line-clamp-2">{leaderboardData[2].name}</h3>
                                                <span className="text-sm font-bold text-white/50 uppercase tracking-widest mt-1">3rd Place</span>
                                            </div>
                                            <div className="text-5xl font-black text-amber-600 tabular-nums leading-none tracking-tighter mt-auto drop-shadow-md">
                                                {leaderboardData[2].totalPoints}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 4th to 8th Place List */}
                            <div className="flex flex-col gap-3">
                                {leaderboardData.slice(3, 8).map((player: any, idx: number) => (
                                    <div key={player.id} className="gif-list-item flex items-center bg-[#15181e]/60 border border-white/10 rounded-2xl p-4 ">
                                        <div className="w-12 text-center font-black text-3xl italic text-white/30 mr-4">
                                            #{idx + 4}
                                        </div>
                                        
                                        <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-[#4D78FF] font-bold text-xl shrink-0 overflow-hidden border border-white/10 mr-4">
                                            {player.photoUrl ? (
                                                <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover" />
                                            ) : (
                                                player.name.substring(0, 2).toUpperCase()
                                            )}
                                        </div>
                                        
                                        <div className="flex-1 min-w-0 flex items-center justify-between">
                                            <h3 className="text-2xl font-black text-white truncate pr-4">{player.name}</h3>
                                            <div className="flex items-center gap-6 pr-6">
                                                <div className="flex items-center gap-2">
                                                    <Trophy size={16} className="text-white/40" />
                                                    <span className="text-lg text-white/80 font-bold">{player.matchesWon} W</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Flame size={16} className="text-[#E65C31]/80" />
                                                    <span className="text-lg text-white/80 font-bold">{player.skillPoints} SP</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="text-right shrink-0 pl-6 border-l border-white/10 min-w-[120px]">
                                            <div className="text-4xl font-black text-[#E65C31] tabular-nums leading-none tracking-tighter">
                                                {player.totalPoints}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div className="mt-8 text-center border-t border-white/10 pt-4">
                            <p className="text-white/30 font-black uppercase tracking-[0.5em] text-lg">app.matchup.com.pk</p>
                        </div>
                    </div>
                </div>
            </div>

{selectedPlayer && (
                <div className="fixed inset-0 z-50 flex justify-center pt-10 sm:pt-20 bg-black/80  overflow-y-auto pb-20">
                    <div ref={modalRef} className="bg-[#0f1115] w-full max-w-md rounded-2xl border border-white/10 shadow-2xl relative flex flex-col mx-4 h-fit max-h-[85vh]">
                        <div className="p-6 border-b border-white/10 bg-[#15181e] rounded-t-2xl shrink-0 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-full bg-brand/10 blur-xl"></div>
                            
                            <div className="relative z-10 flex justify-between items-start mb-6">
                                <Logo size={60} variant="white" className="opacity-80" />
                                <div className="flex items-center gap-2" data-html2canvas-ignore>
                                    <button onClick={() => handleExportJPG(modalRef, `${selectedPlayer.name}-scorecard`)} disabled={isExporting} className="text-white/50 hover:text-white p-2 rounded-full hover:bg-white/5 transition-colors" title="Download Scorecard">
                                        <Download size={20} />
                                    </button>
                                    <button onClick={() => setSelectedPlayer(null)} className="text-white/50 hover:text-white p-2 rounded-full hover:bg-white/5 transition-colors">
                                        <X size={24} />
                                    </button>
                                </div>
                            </div>
                            
                            <div className="relative z-10 flex items-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-[#4D78FF] font-bold text-xl shrink-0 overflow-hidden border-2 border-white/10">
                                    {selectedPlayer.photoUrl ? (
                                        <img src={selectedPlayer.photoUrl} alt={selectedPlayer.name} className="w-full h-full object-cover" />
                                    ) : (
                                        selectedPlayer.name.substring(0, 2).toUpperCase()
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-white italic tracking-tight">{selectedPlayer.name}</h3>
                                    <p className="text-brand font-bold text-lg">{selectedPlayer.totalPoints} Total Points</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-6">
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold text-content-muted uppercase tracking-wider">Points Breakdown</h4>
                                
                                <div className="bg-white/5 rounded-xl p-4 flex items-center justify-between border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <Trophy size={20} className="text-yellow-500" />
                                        <div>
                                            <div className="text-sm font-bold text-white">Placement Bonus</div>
                                            <div className="text-xs text-content-secondary">{selectedPlayer.highestPlacementName}</div>
                                        </div>
                                    </div>
                                    <span className="text-lg font-black text-white">{selectedPlayer.placementBonus}</span>
                                </div>

                                <div className="bg-white/5 rounded-xl p-4 flex items-center justify-between border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <Medal size={20} className="text-blue-400" />
                                        <div>
                                            <div className="text-sm font-bold text-white">Match Wins</div>
                                            <div className="text-xs text-content-secondary">{selectedPlayer.matchesWon} wins × 15 pts</div>
                                        </div>
                                    </div>
                                    <span className="text-lg font-black text-white">{selectedPlayer.matchesWon * 15}</span>
                                </div>

                                <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Flame size={20} className="text-[#E65C31]" />
                                            <div>
                                                <div className="text-sm font-bold text-white">Skill Shots</div>
                                                <div className="text-xs text-content-secondary">5 pts per Winner</div>
                                            </div>
                                        </div>
                                        <span className="text-lg font-black text-[#E65C31]">{selectedPlayer.skillPoints}</span>
                                    </div>
                                    
                                    {Object.keys(selectedPlayer.skillCounts).length > 0 && (
                                        <div className="pt-3 border-t border-white/5 grid grid-cols-2 gap-2">
                                            {Object.entries(selectedPlayer.skillCounts).map(([shot, count]: [string, any]) => (
                                                <div key={shot} className="flex items-center justify-between bg-black/20 rounded border border-white/5 px-3 py-2">
                                                    <span className="text-xs text-white capitalize">{shot}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-white/50">{count}x</span>
                                                        <span className="text-xs font-bold text-[#E65C31]">+{count * 5}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
