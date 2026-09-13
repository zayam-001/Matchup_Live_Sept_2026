import React, { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Avatar } from './ui/Avatar';
import { Badge } from './ui/Badge';
import { Sheet } from './ui/Sheet';
import { PlayerProfile, Tournament, Squad } from '../types';
import { toast } from './Toast';
import { subscribeToTournaments, getPlayerSquads, createSquad, deleteSquad, updatePlayerProfile, rateMatchOpponent, getPlayerById, subscribeToPlayerQuickplaySessions, subscribeToPlayer, subscribeToVenues, uploadProfilePicture } from '../services/storage';
import { GoogleGenAI } from '@google/genai';
import { Trophy, Calendar, Users, Activity, Settings, LogOut, ChevronRight, MapPin, Plus, Trash2, User, Phone, Mail, Search, Star, Share2, Play, Loader2, Download } from 'lucide-react';
import { ScorecardTemplate } from './ScorecardTemplate';
import { toPng } from 'html-to-image';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useAuth } from '../hooks/useAuth';

const performanceData = [
  { month: 'Jan', matches: 2, wins: 1, winRate: 50 },
  { month: 'Feb', matches: 4, wins: 3, winRate: 75 },
  { month: 'Mar', matches: 3, wins: 2, winRate: 66 },
  { month: 'Apr', matches: 6, wins: 5, winRate: 83 },
  { month: 'May', matches: 5, wins: 3, winRate: 60 },
  { month: 'Jun', matches: 8, wins: 6, winRate: 75 },
];

export const PlayerDashboard: React.FC<{ onLogout: () => void, onNavigate: (tab: string) => void }> = ({ onLogout, onNavigate }) => {
    const { user: authUser } = useAuth();
    const [player, setPlayer] = useState<any>(authUser);

    // Update player if authUser changes and player is null
    useEffect(() => {
        if (authUser && !player) {
            setPlayer(authUser);
        }
    }, [authUser]);
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [quickplaySessions, setQuickplaySessions] = useState<any[]>([]);
    const [squads, setSquads] = useState<Squad[]>([]);
    const [venues, setVenues] = useState<any[]>([]);
    const [selectedCity, setSelectedCity] = useState("Karachi");
    const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
    const [aiVenues, setAiVenues] = useState<any[]>([]);
    const [isLoadingAiVenues, setIsLoadingAiVenues] = useState(false);
    const CITIES = ['Karachi', 'Lahore', 'Islamabad', 'Faisalabad'];
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'TEAMS' | 'HISTORY'>('OVERVIEW');

    useEffect(() => {
        const handleNavDashboard = () => {
            setActiveTab('OVERVIEW');
        };
        window.addEventListener('navigate-dashboard', handleNavDashboard);
        return () => window.removeEventListener('navigate-dashboard', handleNavDashboard);
    }, []);
    const [showCreateSquad, setShowCreateSquad] = useState(false);
    const [showProfileEdit, setShowProfileEdit] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // New Squad Form State
    const [squadName, setSquadName] = useState('');
    const [p2Name, setP2Name] = useState('');
    const [p2Phone, setP2Phone] = useState('');
    const [p2Email, setP2Email] = useState('');

    // Profile Edit State
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editSkillLevel, setEditSkillLevel] = useState('');
    const [editBirthday, setEditBirthday] = useState('');
    const [editCnic, setEditCnic] = useState('');
    const [editHomeTeam, setEditHomeTeam] = useState('');
    const [editPhotoUrl, setEditPhotoUrl] = useState('');
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    
    // Download logic
    const scorecardRef = React.useRef<HTMLDivElement>(null);
    const [downloadingSessionId, setDownloadingSessionId] = useState<string | null>(null);
    const [activeDownloadSession, setActiveDownloadSession] = useState<any>(null);

    const handleDownloadScorecard = async (session: any) => {
        setDownloadingSessionId(session.id);
        setActiveDownloadSession(session);
        // Wait for state to update and template to render
        setTimeout(async () => {
            if (scorecardRef.current) {
                try {
                    const dataUrl = await toPng(scorecardRef.current, {
                        cacheBust: true,
                        pixelRatio: 3,
                        skipFonts: false,
                        style: { transform: 'none' }
                    });
                    const link = document.createElement('a');
                    link.download = `MUP-Scorecard-${session.id}.png`;
                    link.href = dataUrl;
                    link.click();
                } catch (err) {
                    console.error('Failed to generate scorecard image', err);
                    toast.error("Couldn't generate the scorecard image", "Please try again.");
                } finally {
                    setDownloadingSessionId(null);
                    // Keep the session active for a moment in case it takes time to clean up
                    setTimeout(() => setActiveDownloadSession(null), 500);
                }
            }
        }, 100);
    };

    // Rating State
    const [showRatingModal, setShowRatingModal] = useState(false);
    const [ratingMatch, setRatingMatch] = useState<any>(null);
    const [ratingOpponent, setRatingOpponent] = useState<any>(null);
    const [ratingStars, setRatingStars] = useState(0);
    const [ratingTags, setRatingTags] = useState<string[]>([]);
    const SKILL_TAGS = ['smash', 'defense', 'positioning', 'teamwork', 'serve'];

    // Analytics State
    const [playerAnalytics, setPlayerAnalytics] = useState<any[]>([]);

    useEffect(() => {
        if (authUser?.id) {
            const unsub = subscribeToPlayer(authUser.id, (data) => {
                setPlayer(data);
                setEditName(data.fullName || data.name || '');
                setEditPhone(data.phone || '');
                setEditSkillLevel(data.stats?.eloRating?.toString() || '1000');
                setEditBirthday(data.birthday || '');
                setEditCnic(data.cnic || '');
                setEditHomeTeam(data.homeTeam || '');
                setEditPhotoUrl(data.photoUrl || '');
            });
            
            // Fetch analytics
            import('firebase/firestore').then(({ collection, query, where, getDocs }) => {
                import('../services/storage').then(async ({ db }) => {
                    try {
                        const q = query(collection(db, 'player_analytics'), where('player_id', '==', authUser.id));
                        const snap = await getDocs(q);
                        const analyticsData = snap.docs.map(d => d.data());
                        setPlayerAnalytics(analyticsData);
                    } catch (err) {
                        console.error('Failed to load player analytics:', err);
                    }
                });
            });

            return () => unsub();
        }
    }, [authUser?.id]);

    useEffect(() => {
        const unsub = subscribeToTournaments((data) => {
            setTournaments(data);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const unsub = subscribeToVenues((data) => {
            setVenues(data);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        if (player?.id) {
            const unsub = subscribeToPlayerQuickplaySessions(player.id, player.email, (data) => {
                setQuickplaySessions(data);
            });
            return () => unsub();
        }
    }, [player?.id, player?.email]);

    const filteredVenues = venues.filter(v => (v.city || 'Karachi').toLowerCase() === selectedCity.toLowerCase());

    useEffect(() => {
        setAiVenues([]);
        if (filteredVenues.length === 0) {
            let isActive = true;
            const fetchAiVenues = async () => {
                setIsLoadingAiVenues(true);
                try {
                    // Make sure Vite defines process.env.GEMINI_API_KEY
                    const apiKey = process.env.GEMINI_API_KEY;
                    if (!apiKey) {
                        setIsLoadingAiVenues(false);
                        return;
                    }
                    const ai = new GoogleGenAI({ apiKey });
                    const response = await ai.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents: `Provide a list of 5 popular real-world sports venues (especially Padel, Tennis, or Futsal) in ${selectedCity}, Pakistan. Just return a JSON array of objects with "name" and "courts" (make up a reasonable integer for courts). No markdown backticks, just raw JSON. Example: [{"name": "Karachi Padel", "courts": 4}]`,
                    });
                    
                    if (isActive) {
                        try {
                           const text = response.text || "";
                           const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
                           const parsed = JSON.parse(cleanJson);
                           setAiVenues(parsed);
                        } catch (e) {
                           console.error("Failed to parse Gemini response for venues", e);
                        }
                        setIsLoadingAiVenues(false);
                    }
                } catch (err: any) {
                     if (err?.status === 429 || err?.message?.includes("quota") || err?.status === "RESOURCE_EXHAUSTED" || err?.error?.status === "RESOURCE_EXHAUSTED") {
                         console.info("Gemini API quota exceeded. Falling back to local venue suggestions.");
                     } else {
                         console.warn("Gemini API unavailable. Using fallback venues.");
                     }
                     if (isActive) {
                         setAiVenues([
                             { name: `${selectedCity} Padel Club`, courts: 4 },
                             { name: `Elite Sports ${selectedCity}`, courts: 3 },
                             { name: `${selectedCity} Tennis Arena`, courts: 6 }
                         ]);
                         setIsLoadingAiVenues(false);
                     }
                }
            };
            fetchAiVenues();
            return () => { isActive = false; };
        }
    }, [selectedCity, filteredVenues.length]);

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!player) return;
        try {
            const updated = await updatePlayerProfile(player.id, {
                fullName: editName,
                phone: editPhone,
                skillLevel: editSkillLevel,
                birthday: editBirthday,
                photoUrl: editPhotoUrl,
                cnic: editCnic,
                homeTeam: editHomeTeam
            });
            if (updated) {
                setPlayer(updated);
                setShowProfileEdit(false);
            }
        } catch (err) {
            // updatePlayerProfile already shows a toast on failure - just
            // keep the edit sheet open here so the user can retry.
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !player) return;
        const file = e.target.files[0];
        
        if (file.size > 2 * 1024 * 1024) {
            toast.warning("Photo too large", "Please choose a photo smaller than 2MB.");
            return;
        }

        setIsUploadingPhoto(true);
        try {
            const url = await uploadProfilePicture(player.id, file);
            setEditPhotoUrl(url);
        } catch (error) {
            console.error("Error uploading photo to object storage, falling back to Base64:", error);
            // Default to base64 if Firebase storage rules block the upload
            const reader = new FileReader();
            reader.onloadend = () => {
                setEditPhotoUrl(reader.result as string);
                setIsUploadingPhoto(false);
            };
            reader.onerror = () => {
                setIsUploadingPhoto(false);
            };
            reader.readAsDataURL(file);
            return; // Exit early since FileReader will handle the state update
        }
        setIsUploadingPhoto(false);
    };

    const handleCreateSquad = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!player) return;
        
        const newSquad = await createSquad({
            ownerId: player.id,
            name: squadName,
            partner: {
                name: p2Name,
                phone: p2Phone,
                email: p2Email,
                verified: false
            }
        });
        
        setSquads([...squads, newSquad]);
        setShowCreateSquad(false);
        setSquadName('');
        setP2Name('');
        setP2Phone('');
        setP2Email('');
    };

    const handleDeleteSquad = async (squadId: string) => {
        if (!player) return;
        await deleteSquad(squadId);
        setSquads(squads.filter(s => s.id !== squadId));
    };

    const handleSaveRating = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!player || !ratingMatch || !ratingOpponent) return;
        
        await rateMatchOpponent(ratingMatch.tournamentId, ratingMatch.id, {
            raterPlayerId: player.id,
            ratedPlayerId: ratingOpponent.id || ratingOpponent.email, // fallback to email if no id
            stars: ratingStars,
            tags: ratingTags
        });
        
        setShowRatingModal(false);
        setRatingMatch(null);
        setRatingOpponent(null);
        setRatingStars(0);
        setRatingTags([]);
    };

    // Filter tournaments where the player is registered
    const myTournaments = tournaments.filter(t => 
        (t.teams || []).some(team => 
            team?.player1?.email === player?.email || team?.player2?.email === player?.email
        )
    );

    const activeTournaments = myTournaments.filter(t => (t.status !== 'COMPLETED' && String(t.status).toUpperCase() !== 'FINISHED'));
    const pastTournaments = myTournaments.filter(t => (t.status === 'COMPLETED' || String(t.status).toUpperCase() === 'FINISHED'));

    // Compute recent partners
    const recentPartners = pastTournaments.flatMap(t => {
        const myTeam = t.teams?.find(team => team?.player1?.email === player?.email || team?.player2?.email === player?.email);
        if (!myTeam) return [];
        const partner = myTeam.player1?.email === player?.email ? myTeam.player2 : myTeam.player1;
        return partner;
    }).filter((partner, index, self) => 
        partner && index === self.findIndex((p) => p?.email === partner.email) // Unique by email
    );

    // Compute active matches across all active tournaments
    const activeMatches = activeTournaments.flatMap(t => {
        const myTeam = t.teams?.find(team => team?.player1?.email === player?.email || team?.player2?.email === player?.email);
        if (!myTeam || !t.matches) return [];
        return t.matches
            .filter(m => (m.team1Id === myTeam.id || m.team2Id === myTeam.id) && (m.status !== 'COMPLETED' && String(m.status).toUpperCase() !== 'FINISHED'))
            .map(m => ({ ...m, tournamentName: t.name, myTeamId: myTeam.id, allTeams: t.teams }));
    });

    // Compute past matches
    const pastMatches = pastTournaments.flatMap(t => {
        const myTeam = t.teams?.find(team => team?.player1?.email === player?.email || team?.player2?.email === player?.email);
        if (!myTeam || !t.matches) return [];
        return t.matches
            .filter(m => (m.team1Id === myTeam.id || m.team2Id === myTeam.id) && (m.status === 'COMPLETED' || String(m.status).toUpperCase() === 'FINISHED'))
            .map(m => ({ ...m, tournamentId: t.id, tournamentName: t.name, myTeamId: myTeam.id, allTeams: t.teams }));
    });

    const calculatedStats = React.useMemo(() => {
        let matchesPlayed = 0;
        let wins = 0;
        let setsWon = 0;
        let gamesWon = 0;
        let totalGamesPlayed = 0;
        let closeSetsPlayed = 0;
        let closeSetsWon = 0;

        // Add tournament matches
        pastMatches.forEach(m => {
            matchesPlayed++;
            if (m.winnerTeamId === m.myTeamId) wins++;
            
            if (m.score) {
                if (m.myTeamId === m.team1Id) {
                    setsWon += m.score.p1Sets || 0;
                    gamesWon += m.score.p1Games || 0;
                    totalGamesPlayed += (m.score.p1Games || 0) + (m.score.p2Games || 0);

                    if (Math.abs((m.score.p1Games || 0) - (m.score.p2Games || 0)) <= 2 && (m.score.p1Games || 0) + (m.score.p2Games || 0) >= 10) {
                        closeSetsPlayed++;
                        if ((m.score.p1Games || 0) > (m.score.p2Games || 0)) closeSetsWon++;
                    }
                } else if (m.myTeamId === m.team2Id) {
                    setsWon += m.score.p2Sets || 0;
                    gamesWon += m.score.p2Games || 0;
                    totalGamesPlayed += (m.score.p1Games || 0) + (m.score.p2Games || 0);

                    if (Math.abs((m.score.p1Games || 0) - (m.score.p2Games || 0)) <= 2 && (m.score.p1Games || 0) + (m.score.p2Games || 0) >= 10) {
                        closeSetsPlayed++;
                        if ((m.score.p2Games || 0) > (m.score.p1Games || 0)) closeSetsWon++;
                    }
                }
            }
        });

        // Add quickplay matches
        quickplaySessions.filter(s => s.status === 'completed').forEach(session => {
            const playerName = player?.fullName || player?.name;
            const playerIndex = session.players?.findIndex((p: any) => {
                if (typeof p === 'string') return p === playerName;
                return p.userId === player?.id || p.fullName === playerName || p.name === playerName;
            });
            
            (session.matches || []).forEach((m: any) => {
                if ((m.status === 'COMPLETED' || String(m.status).toUpperCase() === 'FINISHED')) {
                    const isTeam1 = m.team1Players?.includes(playerIndex) || (m.player1 && playerName && m.player1.includes(playerName)) || (m.team1Name && playerName && m.team1Name.includes(playerName));
                    const isTeam2 = m.team2Players?.includes(playerIndex) || (m.player2 && playerName && m.player2.includes(playerName)) || (m.team2Name && playerName && m.team2Name.includes(playerName));
                    
                    if (isTeam1 || isTeam2) {
                        matchesPlayed++;
                        if (isTeam1 && m.winner === 1) wins++;
                        if (isTeam2 && m.winner === 2) wins++;
                        
                        if (isTeam1) setsWon += parseInt(m.score?.p1Sets || '0');
                        if (isTeam2) setsWon += parseInt(m.score?.p2Sets || '0');
                        
                        const p1Score = parseInt(m.score?.p1Points || '0');
                        const p2Score = parseInt(m.score?.p2Points || '0');
                        
                        if (!isNaN(p1Score) && !isNaN(p2Score)) {
                            totalGamesPlayed += p1Score + p2Score;
                            if (isTeam1) gamesWon += p1Score;
                            if (isTeam2) gamesWon += p2Score;
                            
                            if (Math.abs(p1Score - p2Score) <= 2 && p1Score + p2Score >= 10) {
                                closeSetsPlayed++;
                                if (isTeam1 && p1Score > p2Score) closeSetsWon++;
                                if (isTeam2 && p2Score > p1Score) closeSetsWon++;
                            }
                        }
                    }
                }
            });
        });

        let dominanceScoreStr = totalGamesPlayed > 0 ? ((gamesWon / totalGamesPlayed) * 10).toFixed(1) : "0.0";
        let clutchScoreVal = closeSetsPlayed > 0 ? Math.round((closeSetsWon / closeSetsPlayed) * 100) : 0;
        let aggressionScore = 0;

        if (playerAnalytics && playerAnalytics.length > 0) {
            let totalClutch = 0;
            let totalDom = 0;
            let totalAggression = 0;
            playerAnalytics.forEach(pa => {
                totalClutch += Number(pa.clutch_rate || 0);
                totalDom += Number(pa.dominance_score || 0);
                totalAggression += Number(pa.aggression_index || 0);
            });
            clutchScoreVal = Math.round(totalClutch / playerAnalytics.length);
            dominanceScoreStr = (totalDom / playerAnalytics.length).toFixed(1);
            aggressionScore = Math.round(totalAggression / playerAnalytics.length);
        }

        return {
            matchesPlayed: Math.max(matchesPlayed, player?.stats?.matchesPlayed || 0),
            wins: Math.max(wins, player?.stats?.wins || 0),
            setsWon: Math.max(setsWon, player?.stats?.setsWon || 0),
            eloRating: player?.stats?.eloRating || 1000,
            dominanceScore: dominanceScoreStr,
            clutchScore: clutchScoreVal,
            aggressionScore
        };
    }, [pastMatches, quickplaySessions, player, playerAnalytics]);

    const dynamicPerformanceData = React.useMemo(() => {
        const monthStats: Record<string, { matches: number, wins: number }> = {};
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        // Initialize last 6 months
        const today = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            monthStats[`${months[d.getMonth()]} ${d.getFullYear()}`] = { matches: 0, wins: 0 };
        }

        // Process tournament matches
        pastMatches.forEach(m => {
            const timeVal = m.scheduledTime || (m as any).timestamp;
            if (timeVal) {
                const d = new Date(timeVal);
                const key = `${months[d.getMonth()]} ${d.getFullYear()}`;
                if (monthStats[key]) {
                    monthStats[key].matches++;
                    if (m.winnerTeamId === m.myTeamId) monthStats[key].wins++;
                }
            }
        });

        // Process quickplay matches
        quickplaySessions.filter(s => s.status === 'completed').forEach(session => {
            const playerName = player?.fullName || player?.name;
            const playerIndex = session.players?.findIndex((p: any) => {
                if (typeof p === 'string') return p === playerName;
                return p.userId === player?.id || p.fullName === playerName || p.name === playerName;
            });
            
            (session.matches || []).forEach((m: any) => {
                if ((m.status === 'COMPLETED' || String(m.status).toUpperCase() === 'FINISHED') && (m.timestamp || session.createdAt)) {
                    const d = new Date(m.timestamp || session.createdAt);
                    const key = `${months[d.getMonth()]} ${d.getFullYear()}`;
                    
                    if (monthStats[key]) {
                        const isTeam1 = m.team1Players?.includes(playerIndex) || (m.player1 && playerName && m.player1.includes(playerName)) || (m.team1Name && playerName && m.team1Name.includes(playerName));
                        const isTeam2 = m.team2Players?.includes(playerIndex) || (m.player2 && playerName && m.player2.includes(playerName)) || (m.team2Name && playerName && m.team2Name.includes(playerName));
                        
                        if (isTeam1 || isTeam2) {
                            monthStats[key].matches++;
                            if (isTeam1 && m.winner === 1) monthStats[key].wins++;
                            if (isTeam2 && m.winner === 2) monthStats[key].wins++;
                        }
                    }
                }
            });
        });

        return Object.entries(monthStats).map(([month, stats]) => ({
            month: month.split(' ')[0],
            matches: stats.matches,
            wins: stats.wins,
            winRate: stats.matches > 0 ? Math.round((stats.wins / stats.matches) * 100) : 0
        }));
    }, [pastMatches, quickplaySessions, player]);

    const suggestedTournaments = tournaments.filter(t => 
        (t.status !== 'COMPLETED' && String(t.status).toUpperCase() !== 'FINISHED') && 
        !(t.teams || []).some(team => team?.player1?.email === player?.email || team?.player2?.email === player?.email)
    ).slice(0, 3); // Show up to 3 suggestions

    const upcomingAlerts = activeMatches.map(m => {
        if (m.status === 'IN_PROGRESS') return null;
        
        // Court assigned alert
        if (m.court && m.court !== 'TBD') {
            return {
                id: m.id + '_court',
                type: 'COURT_ASSIGNED',
                title: 'Court Assigned',
                message: `Your match in ${m.tournamentName} has been assigned to ${m.court}. Please head to the court.`,
                match: m
            };
        }
        
        // Schedule reminder
        if (m.scheduledTime) {
            const diff = new Date(m.scheduledTime).getTime() - new Date().getTime();
            if (diff > 0 && diff < 60 * 60 * 1000) { // Within 1 hour
                const minutes = Math.round(diff / 60000);
                return {
                    id: m.id + '_time',
                    type: 'STARTING_SOON',
                    title: 'Match Starting Soon',
                    message: `Your match in ${m.tournamentName} is scheduled to start in ${minutes} minutes.`,
                    match: m
                };
            }
        }
        return null;
    }).filter(Boolean);

    const handleShareStats = () => {
        const text = `Check out my Matchup stats! Sets Won: ${calculatedStats.setsWon || 0}, Win Rate: ${
            calculatedStats.matchesPlayed ? Math.round((calculatedStats.wins / calculatedStats.matchesPlayed) * 100) : 0
        }%`;
        if (navigator.share) {
            navigator.share({
                title: 'My Match Up Stats',
                text: text,
                url: window.location.href,
            });
        } else {
            navigator.clipboard.writeText(text);
            toast.success('Stats copied to clipboard');
        }
    };

    const handleChangePassword = async () => {
        if (!player || !player.email) {
            toast.error("Can't reset password", "No email address is on file for this account.");
            return;
        }
        try {
            const { getAuth, sendPasswordResetEmail } = await import('firebase/auth');
            await sendPasswordResetEmail(getAuth(), player.email);
            toast.success("Password reset link sent", `Check ${player.email} for the link.`);
        } catch (err: any) {
            console.error(err);
            toast.error("Couldn't send reset email", err?.message);
        }
    };

    const handleLogout = () => {
        onLogout();
    };

    const handlePhotoClick = () => {
        fileInputRef.current?.click();
    };

    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        
        // Reset input value to allow selecting the same file again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }

        if (!file || !player) return;

        // Check file size (limit to 1MB for Firestore base64)
        if (file.size > 1024 * 1024) {
            toast.warning("Photo too large", "Please choose a photo smaller than 1MB.");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result as string;
            const updated = await updatePlayerProfile(player.id, { photoUrl: base64String });
            if (updated) setPlayer(updated);
        };
        reader.readAsDataURL(file);
    };

    return (
        <>
            {!player ? (
                <div className="min-h-screen flex items-center justify-center text-white"><Loader2 className="w-8 h-8 animate-spin" /></div>
            ) : (
                <div className="min-h-screen pb-20 pt-28 md:pt-36 space-y-8 px-4 md:px-8">
                    {/* Hidden File Input */}
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="absolute w-0 h-0 opacity-0 overflow-hidden" 
                        accept="image/*" 
                        onChange={handlePhotoChange} 
                    />
                    {/* Header Profile Section */}
                    <div className="relative rounded-3xl overflow-hidden bg-surface-panel border border-white/5 shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-brand/20 to-transparent opacity-50"></div>
                    <div className="absolute top-0 right-0 w-96 h-96 bg-brand/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/3"></div>
                    
                    <div className="relative z-10 p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
                        <Avatar src={player.photoUrl} fallback={player.fullName || player.name} size="xl" className="border-4 border-surface-ground shadow-xl" />
                        <div className="flex-1 text-center md:text-left">
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-3">
                                <Badge variant="live" className="animate-pulse">Verified Athlete</Badge>
                                <button 
                                    onClick={async () => {
                                        const updated = await updatePlayerProfile(player.id, { isAvailable: !player.isAvailable });
                                        if (updated) setPlayer(updated);
                                    }}
                                    className={`px-3 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider border transition-colors flex items-center gap-1.5 ${player.isAvailable ? 'bg-accent-success/10 text-accent-success border-accent-success/20' : 'bg-surface-elevated text-content-muted border-white/10 hover:border-white/20'}`}
                                >
                                    <div className={`w-2 h-2 rounded-full ${player.isAvailable ? 'bg-accent-success animate-pulse' : 'bg-content-muted'}`}></div>
                                    {player.isAvailable ? 'Available for Squads' : 'Not Looking'}
                                </button>
                            </div>
                            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter italic mb-2">{player.fullName || player.name}</h1>
                            <p className="text-content-secondary font-medium flex items-center justify-center md:justify-start gap-4">
                                <span>{player.email || 'No email'}</span>
                                <span className="hidden md:inline">•</span>
                                <span>{player.phone}</span>
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto mt-6 md:mt-0">
                            <button onClick={handleShareStats} className="w-full sm:w-auto bg-surface-elevated hover:bg-white/10 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 border border-white/5">
                                <Share2 size={18} /> Share Stats
                            </button>
                            <button onClick={() => setShowProfileEdit(true)} className="w-full sm:w-auto bg-surface-elevated hover:bg-white/10 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 border border-white/5">
                                <Settings size={18} /> Settings
                            </button>
                        </div>
                    </div>
                </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar border-b border-white/5">
                <TabButton active={activeTab === 'OVERVIEW'} onClick={() => setActiveTab('OVERVIEW')} label="Dashboard" icon={<Activity size={16}/>} />
                <TabButton active={activeTab === 'TEAMS'} onClick={() => setActiveTab('TEAMS')} label="Team Presets" icon={<Users size={16}/>} />
                <TabButton active={activeTab === 'HISTORY'} onClick={() => setActiveTab('HISTORY')} label="Tournament History" icon={<Trophy size={16}/>} />
            </div>

            {/* Tab Content */}
            {activeTab === 'OVERVIEW' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Active Events & Matches */}
                    <div className="lg:col-span-2 space-y-8">
                        
                        {/* V.A.S. Alerts Panel */}
                        {upcomingAlerts.length > 0 && (
                            <div className="space-y-3">
                                {upcomingAlerts.map((alert: any) => (
                                    <div key={alert.id} className="bg-brand/10 border border-brand/20 rounded-2xl p-4 flex items-center gap-4 animate-slide-up">
                                        <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center text-brand shrink-0">
                                            <Activity size={20} className="animate-pulse" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="text-brand font-bold text-sm uppercase tracking-widest mb-0.5">{alert.title}</h4>
                                            <p className="text-white text-sm">
                                                {alert.message}
                                            </p>
                                        </div>
                                        <button onClick={() => onNavigate('live')} className="px-4 py-2 bg-brand text-content-inverse text-xs font-bold rounded-xl uppercase tracking-wider hover:bg-brand-light transition-colors">
                                            View
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Active Matches Section */}
                        <div className="space-y-6">
                            <h2 className="text-2xl font-black text-white tracking-tight italic uppercase flex items-center gap-2">
                                <Activity className="text-brand" size={24} /> Live & Upcoming Matches
                            </h2>
                            {activeMatches.length > 0 ? (
                                <div className="grid gap-4">
                                    {activeMatches.map(m => {
                                        const isMyTeam1 = m.myTeamId === m.team1Id;
                                        const myTeam = m.allTeams.find((t: any) => t.id === m.myTeamId);
                                        const opponentTeam = m.allTeams.find((t: any) => t.id === (isMyTeam1 ? m.team2Id : m.team1Id));
                                        
                                        return (
                                            <Card key={m.id} variant="panel" className="p-0 overflow-hidden group hover:border-brand/50 transition-all cursor-pointer relative" onClick={() => onNavigate('live')}>
                                                {m.status === 'IN_PROGRESS' && (
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-brand animate-pulse"></div>
                                                )}
                                                <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                                                    <div className="flex-1 w-full">
                                                        <div className="flex items-center gap-2 mb-4">
                                                            <div className="text-[10px] font-bold uppercase tracking-widest text-brand">{m.tournamentName}</div>
                                                            <span className="text-content-muted">•</span>
                                                            <div className="text-[10px] font-bold uppercase tracking-widest text-content-muted">{m.stage}</div>
                                                            {m.status === 'IN_PROGRESS' && <Badge variant="live" className="ml-auto">LIVE</Badge>}
                                                        </div>
                                                        
                                                        <div className="flex items-center justify-between gap-4">
                                                            <div className={`flex-1 ${isMyTeam1 ? 'text-white' : 'text-content-secondary'}`}>
                                                                <div className="text-xl font-black italic tracking-tight">{myTeam?.name || 'TBD'}</div>
                                                                <div className="text-xs font-bold uppercase tracking-widest text-brand mt-1">You</div>
                                                            </div>
                                                            
                                                            <div className="px-4 py-2 bg-surface-ground rounded-xl border border-white/5 text-center min-w-[80px]">
                                                                <div className="text-xs font-bold text-content-muted uppercase tracking-widest mb-1">VS</div>
                                                                {m.status === 'IN_PROGRESS' ? (
                                                                    <div className="flex flex-col items-center">
                                                                        {m.score?.p1SetScores?.length > 0 && (
                                                                            <div className="flex gap-1 text-[10px] text-content-muted font-mono mb-1 bg-black/40 px-2 py-0.5 rounded">
                                                                                {m.score.p1SetScores.map((s1: number, i: number) => {
                                                                                    const s2 = m.score!.p2SetScores?.[i] ?? 0;
                                                                                    return <span key={i}>{isMyTeam1 ? s1 : s2}-{isMyTeam1 ? s2 : s1}</span>;
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                        <div className="text-xl font-black text-white">{isMyTeam1 ? `${m.score?.p1Sets || 0} - ${m.score?.p2Sets || 0}` : `${m.score?.p2Sets || 0} - ${m.score?.p1Sets || 0}`}</div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-sm font-bold text-content-secondary">{m.scheduledTime ? new Date(m.scheduledTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'TBD'}</div>
                                                                )}
                                                            </div>
                                                            
                                                            <div className={`flex-1 text-right ${!isMyTeam1 ? 'text-white' : 'text-content-secondary'}`}>
                                                                <div className="text-xl font-black italic tracking-tight">{opponentTeam?.name || 'TBD'}</div>
                                                                <div className="text-xs font-bold uppercase tracking-widest text-content-muted mt-1">Opponent</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </div>
                            ) : (
                                <Card variant="panel" className="p-8 text-center border-dashed border-white/10">
                                    <p className="text-content-secondary">No active matches at the moment. Check back when your tournament starts.</p>
                                </Card>
                            )}
                        </div>

                        {/* Active Tournaments Section */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-black text-white tracking-tight italic uppercase flex items-center gap-2">
                                    <Calendar className="text-brand" size={24} /> Active Events
                                </h2>
                                <button onClick={() => onNavigate('register')} className="text-brand hover:text-brand-light text-sm font-bold uppercase tracking-widest flex items-center gap-1 transition-colors">
                                    Find Tournaments <ChevronRight size={16} />
                                </button>
                            </div>

                            {activeTournaments.length > 0 ? (
                                <div className="grid gap-4">
                                    {activeTournaments.map(t => {
                                        const myTeam = t.teams.find(team => team?.player1?.email === player?.email || team?.player2?.email === player?.email);
                                        return (
                                            <Card key={t.id} variant="panel" className="p-0 overflow-hidden group hover:border-brand/50 transition-all cursor-pointer" onClick={() => onNavigate('live')}>
                                                {t.bannerUrl && (
                                                    <div className="w-full h-32 overflow-hidden relative border-b border-white/5">
                                                        <img src={t.bannerUrl} alt="Tournament Banner" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                    </div>
                                                )}
                                                <div className="p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-3">
                                                            <h3 className="text-2xl font-black text-white group-hover:text-brand transition-colors">{t.name}</h3>
                                                            {t.status === 'ACTIVE' && <Badge variant="live">LIVE</Badge>}
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-4 text-content-muted text-sm font-medium">
                                                            <span className="flex items-center gap-1.5"><MapPin size={16} /> {t.venue} &bull; {t.city || 'Karachi'}</span>
                                                            <span className="flex items-center gap-1.5"><Calendar size={16} /> {new Date(t.registrationDeadline).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                    <div className="w-full md:w-auto bg-surface-ground border border-white/5 rounded-2xl p-4 flex items-center justify-between md:justify-start gap-6">
                                                        <div>
                                                            <div className="text-[10px] font-bold uppercase tracking-widest text-content-muted mb-1">Playing As</div>
                                                            <div className="text-white font-bold">{myTeam?.name}</div>
                                                        </div>
                                                        <div className="h-10 w-10 bg-surface-elevated rounded-xl flex items-center justify-center group-hover:bg-brand group-hover:text-content-inverse transition-colors text-content-muted">
                                                            <ChevronRight size={20} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </div>
                            ) : (
                                <Card variant="panel" className="p-12 text-center border-dashed border-white/10 flex flex-col items-center justify-center">
                                    <div className="w-20 h-20 bg-surface-elevated rounded-full flex items-center justify-center text-content-muted mb-6">
                                        <Trophy size={32} />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2">No Active Tournaments</h3>
                                    <p className="text-content-secondary mb-8 max-w-md">You are not currently registered for any upcoming events. Browse the platform to find your next challenge.</p>
                                    <button onClick={() => onNavigate('register')} className="bg-brand hover:bg-brand-light text-content-inverse px-8 py-4 rounded-xl font-bold transition-all shadow-lg shadow-brand/20 uppercase tracking-wider text-sm">
                                        Explore Tournaments
                                    </button>
                                </Card>
                            )}
                        </div>

                        {/* Suggested Tournaments Section */}
                        {suggestedTournaments.length > 0 && (
                            <div className="space-y-6 pt-8 border-t border-white/5">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-2xl font-black text-white tracking-tight italic uppercase flex items-center gap-2">
                                        <Trophy className="text-brand" size={24} /> Suggested Events
                                    </h2>
                                </div>
                                <div className="grid gap-4">
                                    {suggestedTournaments.map(t => (
                                        <Card key={t.id} variant="panel" className="p-0 overflow-hidden group hover:border-brand/50 transition-all cursor-pointer" onClick={() => onNavigate('register')}>
                                            {t.bannerUrl && (
                                                <div className="w-full h-32 overflow-hidden relative border-b border-white/5">
                                                    <img src={t.bannerUrl} alt="Tournament Banner" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                </div>
                                            )}
                                            <div className="p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <h3 className="text-2xl font-black text-white group-hover:text-brand transition-colors">{t.name}</h3>
                                                        <Badge variant="neutral">{t.skillLevel}</Badge>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-4 text-content-muted text-sm font-medium">
                                                        <span className="flex items-center gap-1.5"><MapPin size={16} /> {t.venue} &bull; {t.city || 'Karachi'}</span>
                                                        <span className="flex items-center gap-1.5"><Calendar size={16} /> {new Date(t.registrationDeadline).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                                <div className="w-full md:w-auto">
                                                    <button onClick={(e) => { e.stopPropagation(); onNavigate('register'); }} className="w-full md:w-auto bg-brand hover:bg-brand-light text-content-inverse px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-brand/20 uppercase tracking-wider text-sm flex items-center justify-center gap-2">
                                                        Quick Register <ChevronRight size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Stats & Quick Actions */}
                    <div className="space-y-8">
                        
                        {/* Pending Invitations (Placeholder) */}
                        <div className="space-y-4">
                            <h2 className="text-sm font-bold text-content-muted tracking-widest uppercase">Action Required</h2>
                            <Card variant="panel" className="p-4 border-brand/30 bg-brand/5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-brand animate-pulse"></div>
                                    <span className="text-sm font-bold text-white">No pending invites</span>
                                </div>
                            </Card>
                        </div>

                        <div className="space-y-4">
                            <h2 className="text-sm font-bold text-content-muted tracking-widest uppercase">Performance History</h2>
                            <Card variant="panel" className="p-6 space-y-6">
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div className="bg-surface-ground border border-white/5 rounded-2xl p-4 text-center">
                                        <div className="text-3xl font-black text-white mb-1">{calculatedStats.matchesPlayed}</div>
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-content-muted">Matches Played</div>
                                    </div>
                                    <div className="bg-surface-ground border border-white/5 rounded-2xl p-4 text-center">
                                        <div className="text-3xl font-black text-brand mb-1">{calculatedStats.wins}</div>
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-content-muted">Matches Won</div>
                                    </div>
                                    <div className="bg-surface-ground border border-white/5 rounded-2xl p-4 text-center">
                                        <div className="text-3xl font-black text-accent-success mb-1">{calculatedStats.matchesPlayed ? Math.round((calculatedStats.wins / calculatedStats.matchesPlayed) * 100) : 0}%</div>
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-content-muted">Win Rate</div>
                                    </div>
                                    <div className="bg-surface-ground border border-white/5 rounded-2xl p-4 text-center">
                                        <div className="text-3xl font-black text-white mb-1">{calculatedStats.setsWon || 0}</div>
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-content-muted">Sets Won</div>
                                    </div>
                                    <div className="bg-surface-ground border border-white/5 rounded-2xl p-4 text-center">
                                        <div className="text-3xl font-black text-[#8B5CF6] mb-1">{calculatedStats.dominanceScore}</div>
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-content-muted">Dominance (Max 10)</div>
                                    </div>
                                    <div className="bg-surface-ground border border-white/5 rounded-2xl p-4 text-center">
                                        <div className="text-3xl font-black text-[#F59E0B] mb-1">{calculatedStats.aggressionScore}</div>
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-content-muted">Aggression Index</div>
                                    </div>
                                </div>

                                <div className="h-48 mt-6">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={dynamicPerformanceData}>
                                            <defs>
                                                <linearGradient id="colorWins" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#F27D26" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#F27D26" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                            <XAxis dataKey="month" stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} />
                                            <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} width={20} />
                                            <Tooltip 
                                                contentStyle={{ backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                                itemStyle={{ color: '#fff', fontSize: '12px' }}
                                                labelStyle={{ color: '#8E9299', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}
                                            />
                                            <Area type="monotone" dataKey="wins" stroke="#F27D26" strokeWidth={2} fillOpacity={1} fill="url(#colorWins)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between relative">
                                <h2 className="text-sm font-bold text-content-muted tracking-widest uppercase">Popular Venues</h2>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="text" 
                                        value={selectedCity}
                                        onChange={(e) => setSelectedCity(e.target.value)}
                                        className="bg-brand/5 border border-brand/20 text-brand text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded w-28 outline-none focus:border-brand"
                                        placeholder="City..."
                                    />
                                    <button 
                                        onClick={() => {
                                            if (navigator.geolocation) {
                                                navigator.geolocation.getCurrentPosition(async (pos) => {
                                                    try {
                                                        const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&localityLanguage=en`);
                                                        const data = await res.json();
                                                        setSelectedCity(data.city || data.locality || "Karachi");
                                                    } catch (e) {}
                                                });
                                            }
                                        }}
                                        className="p-1.5 bg-brand/10 text-brand rounded hover:bg-brand/20 transition-colors"
                                        title="Use my location"
                                    >
                                        <MapPin size={12} />
                                    </button>
                                </div>
                            </div>
                            <div className="grid gap-3">
                                {filteredVenues.length > 0 ? (
                                    filteredVenues.slice(0, 3).map((venue, idx) => (
                                        <Card key={idx} variant="panel" className="p-4 flex items-center justify-between group cursor-pointer hover:border-brand/50 transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-surface-ground border border-white/5 flex items-center justify-center text-brand">
                                                    <MapPin size={18} />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-white text-sm group-hover:text-brand transition-colors">{venue.name}</div>
                                                    <div className="text-xs text-content-muted">{venue.courts?.length || 0} Courts • Active</div>
                                                </div>
                                            </div>
                                            <ChevronRight size={16} className="text-content-muted group-hover:text-white transition-colors" />
                                        </Card>
                                    ))
                                ) : isLoadingAiVenues ? (
                                    <div className="text-center p-4">
                                        <Loader2 className="animate-spin text-brand mx-auto mb-2" size={24} />
                                        <p className="text-xs text-content-muted">Discovering venues...</p>
                                    </div>
                                ) : aiVenues.length > 0 ? (
                                    aiVenues.slice(0, 5).map((venue, idx) => (
                                        <Card key={idx} variant="panel" className="p-4 flex items-center justify-between group cursor-pointer hover:border-brand/50 transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-surface-ground border border-white/5 flex items-center justify-center text-brand">
                                                    <MapPin size={18} />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-white text-sm group-hover:text-brand transition-colors">{venue.name}</div>
                                                    <div className="text-xs text-content-muted">{venue.courts || 0} Courts • Recommended</div>
                                                </div>
                                            </div>
                                            <ChevronRight size={16} className="text-content-muted group-hover:text-white transition-colors" />
                                        </Card>
                                    ))
                                ) : (
                                     <div className="text-center p-4 text-xs text-content-muted bg-surface-panel rounded-xl">
                                         No venues found in {selectedCity}.
                                     </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'TEAMS' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-black text-white tracking-tight italic uppercase">My Squads</h2>
                        <button onClick={() => setShowCreateSquad(true)} className="bg-brand hover:bg-brand-light text-content-inverse px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 text-sm shadow-lg shadow-brand/20">
                            <Plus size={16} /> Create Squad
                        </button>
                    </div>

                    {squads.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {squads.map(squad => (
                                <Card key={squad.id} variant="panel" className="p-6 relative group overflow-hidden">
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleDeleteSquad(squad.id)} className="text-content-muted hover:text-accent-error p-2 bg-surface-ground rounded-full border border-white/5">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="flex -space-x-4">
                                            <Avatar fallback={player.fullName || player.name} src={player.photoUrl} size="md" className="border-2 border-surface-panel shadow-lg relative z-10" />
                                            <Avatar fallback={squad.partner?.name} src={squad.partner?.photoUrl} size="md" className="border-2 border-surface-panel shadow-lg" />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold uppercase tracking-widest text-brand mb-0.5">Squad</div>
                                            <h3 className="text-lg font-black text-white leading-tight">{squad.name}</h3>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3 bg-surface-ground border border-white/5 rounded-xl p-3">
                                            <Avatar fallback={player.fullName || player.name} src={player.photoUrl} size="sm" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-bold text-white truncate">{player.fullName || player.name}</div>
                                                <div className="text-xs text-content-muted truncate">You</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 bg-surface-ground border border-white/5 rounded-xl p-3">
                                            <Avatar fallback={squad.partner?.name} src={squad.partner?.photoUrl} size="sm" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-bold text-white truncate">{squad.partner?.name}</div>
                                                <div className="text-xs text-content-muted truncate">{squad.partner?.email}</div>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <Card variant="panel" className="p-12 text-center border-dashed border-white/10 flex flex-col items-center justify-center">
                            <div className="w-20 h-20 bg-surface-elevated rounded-full flex items-center justify-center text-content-muted mb-6">
                                <Users size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">No Squads Yet</h3>
                            <p className="text-content-secondary mb-8 max-w-md">Create a squad with your favorite partner to register for tournaments instantly.</p>
                            <button onClick={() => setShowCreateSquad(true)} className="bg-surface-elevated hover:bg-white/10 text-white px-8 py-4 rounded-xl font-bold transition-all border border-white/5 uppercase tracking-wider text-sm">
                                Create Your First Squad
                            </button>
                        </Card>
                    )}
                </div>
            )}

            {activeTab === 'HISTORY' && (
                <div className="space-y-6">
                    <h2 className="text-2xl font-black text-white tracking-tight italic uppercase">Match History</h2>
                    {pastMatches.length > 0 || quickplaySessions.filter(s => s.status === 'completed').length > 0 ? (
                        <div className="grid gap-4">
                            {pastMatches.map(m => {
                                const isMyTeam1 = m.myTeamId === m.team1Id;
                                const myTeam = m.allTeams.find((t: any) => t.id === m.myTeamId);
                                const opponentTeam = m.allTeams.find((t: any) => t.id === (isMyTeam1 ? m.team2Id : m.team1Id));
                                const isWinner = m.winnerTeamId === m.myTeamId;
                                
                                return (
                                    <Card key={m.id} variant="panel" className="p-6 flex flex-col gap-6">
                                        <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                            <div>
                                                <div className="text-[10px] font-bold uppercase tracking-widest text-brand mb-1">{m.tournamentName}</div>
                                                <div className="text-sm text-content-secondary">{m.stage} • {m.roundName}</div>
                                            </div>
                                            <Badge variant={isWinner ? 'live' : 'neutral'} className={isWinner ? 'bg-accent-success/20 text-accent-success' : ''}>
                                                {isWinner ? 'WON' : 'LOST'}
                                            </Badge>
                                        </div>
                                        
                                        <div className="flex items-center justify-between gap-4">
                                            <div className={`flex-1 ${isWinner ? 'text-white' : 'text-content-secondary'}`}>
                                                <div className="text-xl font-black italic tracking-tight">{myTeam?.name || 'TBD'}</div>
                                                <div className="text-xs font-bold uppercase tracking-widest text-brand mt-1">You</div>
                                            </div>
                                            
                                            <div className="px-4 py-2 bg-surface-ground rounded-xl border border-white/5 text-center min-w-[80px]">
                                                <div className="text-xs font-bold text-content-muted uppercase tracking-widest mb-1">VS</div>
                                                <div className="flex flex-col items-center">
                                                    {m.score?.p1SetScores?.length > 0 && (
                                                        <div className="flex gap-1 text-[10px] text-content-muted font-mono mb-1 bg-black/40 px-2 py-0.5 rounded">
                                                            {m.score.p1SetScores.map((s1: number, i: number) => {
                                                                const s2 = m.score!.p2SetScores?.[i] ?? 0;
                                                                return <span key={i}>{isMyTeam1 ? s1 : s2}-{isMyTeam1 ? s2 : s1}</span>;
                                                            })}
                                                        </div>
                                                    )}
                                                    <div className="text-xl font-black text-white">
                                                        {(() => {
                                                            const p1Sets = m.score?.p1Sets || 0;
                                                            const p2Sets = m.score?.p2Sets || 0;
                                                            if (p1Sets === 0 && p2Sets === 0 && (m.score?.p1Games > 0 || m.score?.p2Games > 0)) {
                                                                return isMyTeam1 ? `${m.score.p1Games} - ${m.score.p2Games}` : `${m.score.p2Games} - ${m.score.p1Games}`;
                                                            }
                                                            return isMyTeam1 ? `${p1Sets} - ${p2Sets}` : `${p2Sets} - ${p1Sets}`;
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className={`flex-1 text-right ${!isWinner ? 'text-white' : 'text-content-secondary'}`}>
                                                <div className="text-xl font-black italic tracking-tight">{opponentTeam?.name || 'TBD'}</div>
                                                <div className="text-xs font-bold uppercase tracking-widest text-content-muted mt-1">Opponent</div>
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                            {opponentTeam && (
                                                <div>
                                                    <div className="text-[10px] font-bold uppercase tracking-widest text-content-muted mb-3">Rate Opponents</div>
                                                    <div className="flex flex-wrap gap-3">
                                                        {[opponentTeam.player1, opponentTeam.player2].map((oppPlayer, idx) => {
                                                            if (!oppPlayer) return null;
                                                            // Check if already rated
                                                            const existingRating = m.ratings?.find((r: any) => r.raterPlayerId === player.id && r.ratedPlayerId === (oppPlayer.id || oppPlayer.email));
                                                            
                                                            return (
                                                                <button 
                                                                    key={idx}
                                                                    onClick={() => {
                                                                        setRatingMatch(m);
                                                                        setRatingOpponent(oppPlayer);
                                                                        setRatingStars(existingRating?.stars || 0);
                                                                        setRatingTags(existingRating?.tags || []);
                                                                        setShowRatingModal(true);
                                                                    }}
                                                                    className="flex items-center gap-2 bg-surface-ground hover:bg-white/5 border border-white/10 rounded-xl p-2 pr-4 transition-colors"
                                                                >
                                                                    <Avatar fallback={oppPlayer.name} src={oppPlayer.photoUrl} size="sm" />
                                                                    <div className="text-left">
                                                                        <div className="text-xs font-bold text-white">{oppPlayer.name}</div>
                                                                        {existingRating ? (
                                                                            <div className="flex text-brand">
                                                                                {[...Array(5)].map((_, i) => (
                                                                                    <Star key={i} size={10} fill={i < existingRating.stars ? 'currentColor' : 'none'} />
                                                                                ))}
                                                                            </div>
                                                                        ) : (
                                                                            <div className="text-[10px] text-content-muted">Tap to rate</div>
                                                                        )}
                                                                    </div>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                            
                                            <button onClick={() => onNavigate('register')} className="w-full md:w-auto bg-surface-elevated hover:bg-white/10 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors border border-white/5 self-end md:self-auto">
                                                Find Similar Events
                                            </button>
                                        </div>
                                    </Card>
                                );
                            })}
                            {quickplaySessions.filter(s => s.status === 'completed').map(session => {
                                const playerIdx = session.players?.findIndex((p: any) => p.userId === player?.id);
                                let wins = 0;
                                let gamesWon = 0;
                                let matchesPlayed = 0;
                                let points = 0;
                                if (playerIdx !== -1 && session.matches) {
                                    session.matches.forEach((match: any) => {
                                        const isT1 = match.team1Players?.includes(playerIdx);
                                        const isT2 = match.team2Players?.includes(playerIdx);
                                        if (isT1 || isT2) {
                                            matchesPlayed++;
                                            const t1Games = match.score?.p1Games || 0;
                                            const t2Games = match.score?.p2Games || 0;
                                            const t1Sets = match.score?.p1Sets || 0;
                                            const t2Sets = match.score?.p2Sets || 0;
                                            const p1Points = parseInt(match.score?.p1Points) || 0;
                                            const p2Points = parseInt(match.score?.p2Points) || 0;
                                            
                                            if (isT1) {
                                                if (t1Sets > t2Sets) wins++;
                                                gamesWon += t1Games;
                                                points += p1Points;
                                            } else {
                                                if (t2Sets > t1Sets) wins++;
                                                gamesWon += t2Games;
                                                points += p2Points;
                                            }
                                        }
                                    });
                                }

                                return (
                                    <Card key={session.id} variant="panel" className="p-6 flex flex-col gap-6">
                                        <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                            <div>
                                                <div className="text-[10px] font-bold uppercase tracking-widest text-brand mb-1">Quick Play</div>
                                                <div className="text-xl font-bold text-white capitalize">{session.type === 'casual' ? 'Americano' : session.type === 'regular' ? 'Regular Match' : 'Mini Tournament'}</div>
                                            </div>
                                            <Badge variant="neutral">COMPLETED</Badge>
                                        </div>
                                        <div className="flex items-center gap-6 pb-2">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-content-muted">Matches</span>
                                                <span className="text-2xl font-black text-white">{matchesPlayed}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-content-muted">Wins</span>
                                                <span className="text-2xl font-black text-brand">{wins}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-content-muted">Games Won</span>
                                                <span className="text-2xl font-black text-white">{gamesWon}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-content-muted">Total Points</span>
                                                <span className="text-2xl font-black text-white">{points}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-4 text-content-muted text-sm font-medium">
                                            <span className="flex items-center gap-1.5"><Users size={16} /> {session.players?.length || 0} Players</span>
                                            <span className="flex items-center gap-1.5"><Calendar size={16} /> {new Date(session.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        <div className="pt-4 border-t border-white/5 flex justify-end gap-3">
                                            <button 
                                                onClick={() => handleDownloadScorecard(session)} 
                                                disabled={downloadingSessionId === session.id}
                                                className="bg-brand/10 hover:bg-brand/20 text-brand px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors border border-brand/20 flex items-center gap-2"
                                            >
                                                {downloadingSessionId === session.id ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                                                {downloadingSessionId === session.id ? 'Generating...' : 'Download PNG'}
                                            </button>
                                            <button onClick={() => window.location.hash = `quick-play-session?session=${session.id}`} className="bg-surface-elevated hover:bg-white/10 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors border border-white/5">
                                                View Details
                                            </button>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-surface-panel rounded-3xl border border-dashed border-white/10">
                            <Trophy size={48} className="mx-auto text-content-muted mb-4 opacity-50" />
                            <h3 className="text-xl font-bold text-white mb-2">No Past Matches</h3>
                            <p className="text-content-secondary">Your completed matches will appear here.</p>
                        </div>
                    )}
                    
                    {/* Hidden Scorecard for Image Generation */}
                    {activeDownloadSession && (
                        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
                            <ScorecardTemplate session={activeDownloadSession} ref={scorecardRef} />
                        </div>
                    )}
                </div>
            )}
            </div>
            )}

            {/* Create Squad Sheet */}
            <Sheet
                isOpen={showCreateSquad}
                onClose={() => setShowCreateSquad(false)}
                title="Create Squad"
                description="Save a team preset for fast registration."
            >
                <form onSubmit={handleCreateSquad} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-content-muted mb-2">Squad Name</label>
                        <input 
                            required 
                            type="text" 
                            value={squadName}
                            onChange={(e) => setSquadName(e.target.value)}
                            className="w-full bg-surface-ground border border-white/10 rounded-xl p-4 text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all" 
                            placeholder="e.g. The Smashers" 
                        />
                    </div>

                    <div className="bg-surface-ground border border-white/5 rounded-2xl p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                <User size={16} className="text-brand" /> Partner Details
                            </h4>
                        </div>
                        
                        {recentPartners.length > 0 && (
                            <div className="mb-4">
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-content-muted mb-2">Recent Partners</label>
                                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                                    {recentPartners.map(p => (
                                        <button 
                                            key={p.email}
                                            type="button"
                                            onClick={() => {
                                                setP2Name(p.fullName || p.name);
                                                setP2Email(p.email);
                                                setP2Phone(p.phone);
                                            }}
                                            className="flex items-center gap-2 bg-surface-panel hover:bg-white/10 border border-white/5 rounded-full px-3 py-1.5 transition-colors shrink-0"
                                        >
                                            <Avatar fallback={p.fullName || p.name} src={p.photoUrl} size="sm" className="w-5 h-5" />
                                            <span className="text-xs font-bold text-white">{p.fullName || p.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-content-muted mb-2">Full Name</label>
                            <input 
                                required 
                                type="text" 
                                value={p2Name}
                                onChange={(e) => setP2Name(e.target.value)}
                                className="w-full bg-surface-panel border border-white/10 rounded-xl p-3 text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all" 
                                placeholder="Partner's Name" 
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-content-muted mb-2">Email Address</label>
                            <input 
                                required 
                                type="email" 
                                value={p2Email}
                                onChange={(e) => setP2Email(e.target.value)}
                                className="w-full bg-surface-panel border border-white/10 rounded-xl p-3 text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all" 
                                placeholder="partner@example.com" 
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-content-muted mb-2">Phone Number</label>
                            <input 
                                required 
                                type="tel" 
                                value={p2Phone}
                                onChange={(e) => setP2Phone(e.target.value)}
                                className="w-full bg-surface-panel border border-white/10 rounded-xl p-3 text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all" 
                                placeholder="0300 1234567" 
                            />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        className="w-full bg-brand hover:bg-brand-light text-content-inverse font-bold py-4 rounded-xl mt-4 transition-all shadow-lg shadow-brand/20"
                    >
                        Save Squad
                    </button>
                </form>
            </Sheet>

            {/* Edit Profile Sheet */}
            <Sheet
                isOpen={showProfileEdit}
                onClose={() => setShowProfileEdit(false)}
                title="Edit Profile"
                description="Update your personal details."
            >
                <form onSubmit={handleSaveProfile} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-content-muted mb-2">Full Name</label>
                        <input 
                            required 
                            type="text" 
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full bg-surface-ground border border-white/10 rounded-xl p-4 text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-content-muted mb-2">Phone Number</label>
                        <input 
                            required 
                            type="tel" 
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            className="w-full bg-surface-ground border border-white/10 rounded-xl p-4 text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-content-muted mb-2">Skill Level</label>
                        <select 
                            value={editSkillLevel}
                            onChange={(e) => setEditSkillLevel(e.target.value)}
                            className="w-full bg-surface-ground border border-white/10 rounded-xl p-4 text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all appearance-none"
                        >
                            <option value="NEWCOMER">Newcomer</option>
                            <option value="BEGINNER">Beginner</option>
                            <option value="INTERMEDIATE">Intermediate</option>
                            <option value="ADVANCED">Advanced</option>
                            <option value="PROFESSIONAL">Professional</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-content-muted mb-2">Birthday</label>
                        <input 
                            type="date" 
                            value={editBirthday}
                            onChange={(e) => setEditBirthday(e.target.value)}
                            className="w-full bg-surface-ground border border-white/10 rounded-xl p-4 text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-content-muted mb-2">CNIC</label>
                        <input 
                            type="text" 
                            placeholder="XXXXX-XXXXXXX-X"
                            value={editCnic}
                            onChange={(e) => setEditCnic(e.target.value)}
                            className="w-full bg-surface-ground border border-white/10 rounded-xl p-4 text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-content-muted mb-2">Home Team / Club</label>
                        <input 
                            type="text" 
                            placeholder="Your primary club"
                            value={editHomeTeam}
                            onChange={(e) => setEditHomeTeam(e.target.value)}
                            className="w-full bg-surface-ground border border-white/10 rounded-xl p-4 text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-content-muted mb-2">Profile Picture</label>
                        <div className="flex items-center gap-4">
                            <Avatar src={editPhotoUrl || player?.photoUrl} fallback={player?.fullName || player?.name || '?'} size="lg" />
                            <input 
                                type="file" 
                                accept="image/*"
                                onChange={handlePhotoUpload}
                                className="hidden"
                                id="profile-upload"
                            />
                            <label 
                                htmlFor="profile-upload"
                                className="bg-surface-elevated hover:bg-white/10 text-white px-4 py-2 rounded-lg font-bold transition-all border border-white/5 cursor-pointer text-sm flex items-center justify-center gap-2"
                            >
                                {isUploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                {isUploadingPhoto ? "Uploading..." : "Upload New Photo"}
                            </label>
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        className="w-full bg-brand hover:bg-brand-light text-content-inverse font-bold py-4 rounded-xl mt-4 transition-all shadow-lg shadow-brand/20"
                    >
                        Save Profile
                    </button>
                    <div className="flex gap-4 mt-4">
                        <button 
                            type="button" 
                            onClick={handleChangePassword}
                            className="flex-1 bg-surface-elevated hover:bg-white/10 text-white font-bold py-3 rounded-xl transition-all border border-white/5 text-sm"
                        >
                            Change Password
                        </button>
                        <button 
                            type="button" 
                            onClick={handleLogout}
                            className="flex-1 bg-surface-elevated hover:bg-red-500/20 text-red-400 font-bold py-3 rounded-xl transition-all border border-red-500/10 text-sm"
                        >
                            Sign Out
                        </button>
                    </div>
                </form>
            </Sheet>

            {/* Rating Modal */}
            {showRatingModal && ratingOpponent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <Card variant="panel" className="w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Rate Opponent</h3>
                            <button onClick={() => setShowRatingModal(false)} className="text-content-muted hover:text-white">
                                <LogOut size={20} className="rotate-180" />
                            </button>
                        </div>
                        
                        <div className="flex items-center gap-4 mb-8">
                            <Avatar fallback={ratingOpponent.name} src={ratingOpponent.photoUrl} size="lg" />
                            <div>
                                <div className="text-lg font-bold text-white">{ratingOpponent.name}</div>
                                <div className="text-sm text-content-secondary">{ratingOpponent.email}</div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-content-muted mb-4 text-center">Overall Rating</label>
                                <div className="flex justify-center gap-2">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setRatingStars(star)}
                                            className={`p-2 transition-colors ${ratingStars >= star ? 'text-brand' : 'text-surface-elevated hover:text-brand/50'}`}
                                        >
                                            <Star size={32} fill={ratingStars >= star ? 'currentColor' : 'none'} />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-content-muted mb-4">Skill Specialties</label>
                                <div className="flex flex-wrap gap-2">
                                    {SKILL_TAGS.map(tag => {
                                        const isSelected = ratingTags.includes(tag);
                                        return (
                                            <button
                                                key={tag}
                                                type="button"
                                                onClick={() => {
                                                    if (isSelected) {
                                                        setRatingTags(ratingTags.filter(t => t !== tag));
                                                    } else {
                                                        setRatingTags([...ratingTags, tag]);
                                                    }
                                                }}
                                                className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-colors border ${
                                                    isSelected 
                                                        ? 'bg-brand/20 text-brand border-brand/50' 
                                                        : 'bg-surface-ground text-content-muted border-white/5 hover:border-white/20 hover:text-white'
                                                }`}
                                            >
                                                {tag}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <button 
                                onClick={handleSaveRating}
                                disabled={ratingStars === 0}
                                className="w-full bg-brand hover:bg-brand-light disabled:opacity-50 disabled:cursor-not-allowed text-content-inverse font-bold py-4 rounded-xl mt-4 transition-all shadow-lg shadow-brand/20"
                            >
                                Submit Feedback
                            </button>
                        </div>
                    </Card>
                </div>
            )}
        </>
    );
};

const TabButton = ({ active, onClick, label, icon }: any) => (
    <button onClick={onClick} className={`px-6 py-3 rounded-xl flex items-center gap-2 whitespace-nowrap font-bold text-sm transition-all ${active ? 'bg-brand text-content-inverse shadow-lg shadow-brand/20' : 'bg-surface-panel text-content-muted border border-white/10 hover:text-white hover:border-white/20'}`}>
        {icon} {label}
    </button>
);
