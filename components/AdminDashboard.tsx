import { CloneTournamentModal } from "./CloneTournamentModal";
import { BulkUploadTeamsModal } from "./BulkUploadTeamsModal";
import { TournamentLiveBadge } from "./TournamentLiveBadge";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TournamentFormat, SkillLevel, Tournament, MatchStatus, RoundRobinType, Team, Match, SponsorTier, Sponsor, Venue } from '../types';
import { createTournament, deleteTournament, updateTournament, subscribeToTournaments, subscribeToTournament, updateTeamStatus, generateSchedule, assignTeamGroup, updateTournamentTeamsGroups, updateMatchDetails, addKnockoutMatch, subscribeToVenues, uploadSystemImage, getOrganiserCredits, deductOrganiserCredits, enrollTeamManually, subscribeToStandings, searchGlobalTeams, refundOrganiserCredits, retireTournament, appendNewMexicanoRound, deleteMatch, replaceTeamInTournament, editTeamInTournament, syncAllDataToGlobal, checkAndHealTournamentStats, bulkUploadPendingTeams, isTeamInCategory, isMatchInCategory } from '../services/storage';
import { Check, X, Calendar, Users, Trophy, PlayCircle, Lock, RefreshCcw, ChevronLeft, Plus, ChevronRight, Grid, ArrowRight, Settings, Edit3, ArrowUpRight, MapPin, DollarSign, Database, Trash2, Mail, Phone, Hash, AlertTriangle, Loader2, LogOut, Camera, Image as ImageIcon, Crown, Gem, Star, Medal, Activity, Clock, PlusCircle, Download, Share2, Copy, QrCode, ExternalLink, List, Archive, ChevronDown, History, RotateCcw } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useTournamentMatches } from '../hooks/useTournamentMatches';
import { QRCodeCanvas } from 'qrcode.react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Sheet } from './ui/Sheet';
import { Avatar } from './ui/Avatar';
import { ScrollableTabs } from './ui/ScrollableTabs';
import { ManualEnrollmentModal } from './ManualEnrollmentModal';
import { MatchResultCard } from './MatchResultCard';
import { TeamDetailsOverlay } from './TeamDetailsOverlay';
import { ReplaceTeamModal } from './ReplaceTeamModal';
import { toast } from './Toast';
import { TournamentLeaderboardTab } from './TournamentLeaderboardTab';
import { EditTeamSheet } from './EditTeamSheet';
import { StandingsOverlayExporter } from './StandingsOverlayExporter';
import { Tv } from 'lucide-react';

import { collection, doc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../services/storage';

import { deleteKnockoutMatchCascade, recalculateMatchResult, getAllRegisteredPlayers, mergePlayerProfiles } from '../services/storage';



export const DeleteMatchConfirmModal = ({ match, onDelete, onCancel }: any) => {
    const [confirmText, setConfirmText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm">
            <Card variant="panel" className="max-w-md w-full border-accent-error/30 shadow-[0_0_50px_rgba(225,29,72,0.15)]">
                <h3 className="text-xl font-bold flex items-center gap-2 mb-4 text-white"><Trash2 className="text-accent-error"/> Delete Match?</h3>
                <div className="bg-surface-dark p-3 rounded-lg mb-4 text-center border border-white/5">
                    <div className="text-white font-black text-lg">{match.team1Name || 'TBD'} <span className="text-content-muted text-sm mx-2">vs</span> {match.team2Name || 'TBD'}</div>
                    <div className="text-xs text-content-muted mt-1 uppercase tracking-widest text-[#E65C31] font-bold">Round {match.round} &bull; Knockout Stage</div>
                </div>
                <div className="text-sm text-content-secondary space-y-2 mb-6 bg-surface-ground p-4 rounded-xl border border-white/5">
                    <p className="font-bold text-white mb-3">Deleting this match will:</p>
                    <ul className="list-disc pl-5 space-y-2 text-content-muted">
                        <li>Remove the match record permanently</li>
                        <li>Reset the next round slot (team will show as TBD)</li>
                        <li>Recalculate all affected standings</li>
                    </ul>
                    <p className="text-accent-error font-bold mt-4 flex items-center gap-1.5"><AlertTriangle size={16}/> This cannot be undone.</p>
                </div>
                <div className="mb-6">
                    <label className="block text-xs font-bold text-content-muted mb-2 uppercase tracking-widest">Type "DELETE" to confirm:</label>
                    <input 
                        type="text" 
                        value={confirmText} 
                        onChange={(e) => setConfirmText(e.target.value.toUpperCase())} 
                        className="w-full bg-surface-dark border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-accent-error transition-colors font-mono tracking-widest"
                        placeholder="DELETE"
                    />
                </div>
                <div className="flex gap-3">
                    <button onClick={onCancel} disabled={submitting} className="flex-1 py-3 rounded-xl font-bold bg-white/5 hover:bg-white/10 text-white transition-colors disabled:opacity-50">Cancel</button>
                    <button 
                        onClick={async () => {
                            if (confirmText !== 'DELETE') return;
                            setSubmitting(true);
                            await onDelete();
                            setSubmitting(false);
                        }} 
                        disabled={confirmText !== 'DELETE' || submitting}
                        className="flex-1 py-3 flex justify-center items-center rounded-xl font-bold bg-accent-error hover:bg-accent-error/80 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all shadow-lg shadow-accent-error/20 relative"
                    >
                        {submitting ? <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"/> : 'Delete Match'}
                    </button>
                </div>
            </Card>
        </div>
    );
};

export const DownstreamActiveModal = ({ nextMatchId, onCancel }: any) => {
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm">
            <Card variant="panel" className="max-w-md w-full border-[#E65C31]/40 shadow-[0_0_50px_rgba(230,92,49,0.15)]">
                <h3 className="text-xl font-bold flex items-center gap-2 mb-4 text-white"><AlertTriangle className="text-[#E65C31]"/> Cannot Edit: Downstream Match Affected</h3>
                <div className="text-sm text-content-secondary space-y-4 mb-6">
                    <p>The winner of this match has already played their next round match.</p>
                    <p>To correct this, you must first edit or delete the downstream match, then return here.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="flex-1 py-3 rounded-xl font-bold bg-white/5 hover:bg-white/10 text-white transition-colors">Okay, Close</button>
                </div>
            </Card>
        </div>
    );
};

export const ScoreCorrectionModal = ({ match, tournamentId, onCancel, onComplete }: any) => {
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sets, setSets] = useState<{team1: number, team2: number}[]>(
        match.score?.sets?.length ? match.score.sets : (match.score?.p1SetScores?.length ? match.score.p1SetScores.map((_:any,i:number) => ({team1: match.score.p1SetScores[i], team2: match.score.p2SetScores[i]})) : [{team1: match.score?.p1Games || (match.winnerTeamId === match.team1Id ? 1 : 0), team2: match.score?.p2Games || (match.winnerTeamId === match.team2Id ? 1 : 0)}])
    );

    const team1SetsWon = sets.filter(s => s.team1 > s.team2).length;
    const team2SetsWon = sets.filter(s => s.team2 > s.team1).length;

    const handleSave = async () => {
        try {
            setSubmitting(true);
            setError(null);
            await recalculateMatchResult(tournamentId, match.id, sets, auth.currentUser?.uid || 'admin', auth.currentUser?.email || 'Admin');
            onComplete && onComplete();
        } catch (err: any) {
            console.error("Score correction error", err);
            if (String(err.message).includes("DOWNSTREAM_MATCH_ACTIVE")) {
                setError(err.message);
            } else {
                setError("Update failed. Please try again.");
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (error && String(error).includes("DOWNSTREAM_MATCH_ACTIVE")) {
        return <DownstreamActiveModal nextMatchId={String(error).split(':')[1]} onCancel={() => setError(null)} />;
    }

    if (submitting) {
        return (
            <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center p-4 z-[9999] backdrop-blur-md">
                <div className="w-16 h-16 border-4 border-brand/20 border-t-brand rounded-full animate-spin mb-6"></div>
                <h2 className="text-2xl font-black text-white tracking-widest uppercase shadow-sm">Updating Match Data</h2>
                <p className="text-content-muted mt-2">Recalculating standings and bracket paths...</p>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm">
            <Card variant="panel" className="max-w-[500px] w-full border-brand/30 shadow-[0_0_50px_rgba(77,120,255,0.15)] overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-white/5 shrink-0">
                    <h3 className="text-xl font-bold flex items-center gap-2 text-white"><Edit3 className="text-brand"/> Edit Match Score</h3>
                    <div className="text-xs text-content-muted mt-1 uppercase tracking-widest">{match.court || 'Court TBD'} &bull; Completed</div>
                </div>
                
                <div className="p-5 overflow-y-auto flex-1">
                    <div className="flex bg-surface-dark border border-white/5 rounded-xl overflow-hidden mb-6">
                        <div className="flex-1 p-4 text-center border-r border-white/5">
                            <div className="text-white font-black truncate mb-2">{match.team1Name || 'TBD'}</div>
                            <div className="text-3xl font-display text-brand">{team1SetsWon}</div>
                            <div className="text-[10px] text-content-muted uppercase tracking-widest mt-1">Sets Won</div>
                        </div>
                        <div className="flex-1 p-4 text-center">
                            <div className="text-white font-black truncate mb-2">{match.team2Name || 'TBD'}</div>
                            <div className="text-3xl font-display text-brand">{team2SetsWon}</div>
                            <div className="text-[10px] text-content-muted uppercase tracking-widest mt-1">Sets Won</div>
                        </div>
                    </div>

                    <div className="space-y-3 mb-6">
                        <label className="block text-xs font-bold text-content-muted uppercase tracking-widest">Set Scores</label>
                        {sets.map((set, i) => (
                            <div key={i} className="flex items-center gap-3 bg-white/5 p-3 rounded-lg border border-white/5">
                                <span className="text-content-muted font-bold w-12 shrink-0 text-sm">SET {i+1}</span>
                                <div className="flex-1 flex gap-2">
                                    <input type="number" min="0" value={set.team1} onChange={(e) => {
                                        const newSets = [...sets];
                                        newSets[i].team1 = parseInt(e.target.value) || 0;
                                        setSets(newSets);
                                    }} className="w-full bg-black/50 border border-white/10 rounded-md p-2 text-white text-center font-bold focus:border-brand" />
                                </div>
                                <span className="text-content-muted">-</span>
                                <div className="flex-1 flex gap-2">
                                    <input type="number" min="0" value={set.team2} onChange={(e) => {
                                        const newSets = [...sets];
                                        newSets[i].team2 = parseInt(e.target.value) || 0;
                                        setSets(newSets);
                                    }} className="w-full bg-black/50 border border-white/10 rounded-md p-2 text-white text-center font-bold focus:border-brand" />
                                </div>
                                <button onClick={() => {
                                    if(sets.length <= 1) return;
                                    setSets(sets.filter((_, idx) => idx !== i));
                                }} disabled={sets.length <= 1} className="p-2 text-content-muted hover:text-accent-error disabled:opacity-30 transition-colors">
                                    <X size={16}/>
                                </button>
                            </div>
                        ))}
                        {sets.length < 5 && (
                            <button onClick={() => setSets([...sets, {team1:0, team2:0}])} className="w-full py-3 bg-surface-elevated hover:bg-surface-dark border border-white/5 border-dashed rounded-lg text-sm font-bold text-brand transition-colors flex items-center justify-center gap-2">
                                <Plus size={16}/> Add Set
                            </button>
                        )}
                    </div>

                    <div className="bg-[#E65C31]/10 border border-[#E65C31]/30 p-3 rounded-lg flex items-start gap-3">
                        <AlertTriangle className="text-[#E65C31] shrink-0 w-5 h-5"/>
                        <p className="text-xs text-[#E65C31] font-medium leading-relaxed">This will recalculate standings and all match records for both teams instantly.</p>
                    </div>

                    {error && <div className="mt-4 text-center text-accent-error text-sm font-bold">{error}</div>}
                </div>
                
                <div className="p-4 border-t border-white/5 flex gap-3 shrink-0">
                    <button onClick={onCancel} className="flex-1 py-3 rounded-xl font-bold bg-white/5 hover:bg-white/10 text-white transition-colors">Cancel</button>
                    <button onClick={handleSave} className="flex-1 py-3 flex justify-center items-center rounded-xl font-bold bg-brand hover:bg-brand-light text-white transition-all shadow-lg shadow-brand/20">Save Changes</button>
                </div>
            </Card>
        </div>
    );
};


// Helper to get all courts assigned to a tournament or its categories
const getAllTournamentCourts = (tournament: Tournament): string[] => {
    const allCourts = new Set<string>();
    if (tournament.courts) {
        if (typeof tournament.courts === 'string') {
            allCourts.add(tournament.courts);
        } else if (Array.isArray(tournament.courts)) {
            tournament.courts.forEach(c => allCourts.add(c));
        }
    }
    if (tournament.categories) {
        tournament.categories.forEach(cat => {
            if (cat.courts) {
                if (typeof cat.courts === 'string') {
                    allCourts.add(cat.courts as string);
                } else if (Array.isArray(cat.courts)) {
                    cat.courts.forEach(c => allCourts.add(c));
                }
            }
        });
    }
    return Array.from(allCourts);
};

export const AdminDashboard: React.FC<{ initialAuthenticated?: boolean, onLogout?: () => void }> = ({ initialAuthenticated, onLogout }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(initialAuthenticated || false);
  const [currentUser, setCurrentUser] = useState<any>(auth?.currentUser || null);
  const [adminData, setAdminData] = useState<any>(null);
  const [mainTab, setMainTab] = useState<'tournaments' | 'analytics' | 'merges'>('tournaments');
  const [tournamentStatusFilter, setTournamentStatusFilter] = useState<string>('All');

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tournament | null>(null);
  
  const [venuesCount, setVenuesCount] = useState<number>(0);
  const [allVenues, setAllVenues] = useState<Venue[]>([]);
  const [dashboardCredits, setDashboardCredits] = useState<any>(null);

  // Profile merge states
  const [registeredPlayers, setRegisteredPlayers] = useState<any[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState<boolean>(false);
  const [mergingId, setMergingId] = useState<string | null>(null);

  const fetchRegisteredPlayers = async () => {
      setLoadingPlayers(true);
      try {
          const players = await getAllRegisteredPlayers();
          setRegisteredPlayers(players);
      } catch (err) {
          console.error("Failed to load registered players:", err);
      } finally {
          setLoadingPlayers(false);
      }
  };

  useEffect(() => {
      if (isAuthenticated) {
          fetchRegisteredPlayers();
      }
  }, [isAuthenticated]);

  const pendingMerges = useMemo(() => {
      if (!tournaments || tournaments.length === 0 || !registeredPlayers || registeredPlayers.length === 0) {
          return [];
      }

      const unauthPlayersMap = new Map<string, { player: any; occurrences: { tournament: Tournament; team: Team; playerIndex: 1 | 2 }[] }>();

      tournaments.forEach(t => {
          (t.teams || []).forEach(team => {
              const checkPlayer = (p: any, playerIndex: 1 | 2) => {
                  if (!p) return;
                  const isUnauth = !p.id || p.verified === false;
                  if (isUnauth && p.name) {
                      const key = `${p.name.toLowerCase().trim()}|${(p.email || '').toLowerCase().trim()}|${(p.phone || '').replace(/[^0-9]/g, '')}`;
                      
                      if (!unauthPlayersMap.has(key)) {
                          unauthPlayersMap.set(key, {
                              player: p,
                              occurrences: []
                          });
                      }
                      unauthPlayersMap.get(key)!.occurrences.push({
                          tournament: t,
                          team,
                          playerIndex
                      });
                  }
              };
              checkPlayer(team.player1, 1);
              checkPlayer(team.player2, 2);
          });
      });

      const merges: {
          id: string;
          unauthPlayer: any;
          authPlayer: any;
          reasons: string[];
          occurrences: { tournament: Tournament; team: Team; playerIndex: 1 | 2 }[];
      }[] = [];

      unauthPlayersMap.forEach((val, key) => {
          const unauth = val.player;
          
          registeredPlayers.forEach(authP => {
              const normalizeName = (name: string) => (name || '').toLowerCase().trim().replace(/\s+/g, ' ');
              const normalizeEmail = (e: string) => (e || '').toLowerCase().trim();
              const normalizePhone = (ph: string) => (ph || '').replace(/[^0-9]/g, '');
              const normalizeCnic = (cn: string) => (cn || '').replace(/[^0-9xX]/g, '');
              
              const nameMatches = normalizeName(unauth.name) === normalizeName(authP.fullName || authP.name);
              
              if (!nameMatches) return;
              
              const emailMatches = unauth.email && authP.email && normalizeEmail(unauth.email) === normalizeEmail(authP.email);
              const phoneMatches = unauth.phone && authP.phone && normalizePhone(unauth.phone) === normalizePhone(authP.phone);
              const cnicMatches = unauth.cnic && authP.cnic && normalizeCnic(unauth.cnic) === normalizeCnic(authP.cnic);
              
              if (emailMatches || phoneMatches || cnicMatches) {
                  const reasons: string[] = ['Name matches (mandatory)'];
                  if (emailMatches) reasons.push(`Email matches: ${unauth.email}`);
                  if (phoneMatches) reasons.push(`Phone matches: ${unauth.phone}`);
                  if (cnicMatches) reasons.push(`CNIC matches: ${unauth.cnic}`);
                  
                  merges.push({
                      id: `${key}|${authP.id}`,
                      unauthPlayer: unauth,
                      authPlayer: authP,
                      reasons,
                      occurrences: val.occurrences
                  });
              }
          });
      });

      return merges;
  }, [tournaments, registeredPlayers]);

  const mergeAlertCount = pendingMerges.length;

  // Wizard States
  const [isCreating, setIsCreating] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [view, setView] = useState<'OVERVIEW' | 'TEAMS' | 'GROUPS' | 'SCHEDULE' | 'KNOCKOUT' | 'STANDINGS' | 'RESULTS' | 'LEADERBOARD'>('OVERVIEW');

  const closeWizard = () => {
      setIsCreating(false);
      setEditingId(null);
  };

  // Sync auth state reactively
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        setCurrentUser(user);
        if (user) {
            getOrganiserCredits(user.uid).then(data => {
                if (data) setDashboardCredits(data);
            });
        }
    });
    return unsubscribe;
  }, []);

  // Session Check on Mount
  useEffect(() => {
    const handleNavDashboard = () => {
        setSelectedTournamentId(null);
        
    };
    window.addEventListener('navigate-dashboard', handleNavDashboard);
    return () => window.removeEventListener('navigate-dashboard', handleNavDashboard);
  }, []);

  useEffect(() => {
    const session = localStorage.getItem('admin_session');
    if (session) {
        const { timestamp } = JSON.parse(session);
        // 30 Minutes Expiry
        if (Date.now() - timestamp < 30 * 60 * 1000) {
            setIsAuthenticated(true);
        } else {
            localStorage.removeItem('admin_session');
        }
    }
  }, []);

  useEffect(() => {
     if (isAuthenticated && currentUser && db) {
         // Re-fetch logic mirroring loginOrganiser's fallbacks
         const fetchAdminData = async () => {
             try {
                 const uid = currentUser.uid;
                 const email = currentUser.email;
                 
                 // 0. Immediate hardcoded admin profile resolution
                 if (email && (email.toLowerCase() === 'zayam@test.com' || email.toLowerCase() === 'zayam.anjum@gmail.com' || email.toLowerCase() === 'taha.nadeem@maidan.pk' || email.toLowerCase() === 'taha.nadeem@maidan')) {
                     setAdminData({
                         email: email,
                         role: 'admin',
                         name: email.split('@')[0]
                     });
                     return;
                 }

                 // 1. Check adminUsers by UID
                 const adminSnap = await getDoc(doc(db, 'adminUsers', uid));
                 if (adminSnap.exists()) {
                     setAdminData(adminSnap.data());
                     return;
                 }
                 
                 // 2. Check users by UID
                 const userSnap = await getDoc(doc(db, 'users', uid));
                 if (userSnap.exists()) {
                     const userData = userSnap.data();
                     if (userData.role === 'admin' || userData.role === 'organiser') {
                         setAdminData(userData);
                         return;
                     }
                 }
                 
                 // 3. Fallback to check by email
                 if (email) {
                     const emailQuery = query(collection(db, 'adminUsers'), where('email', '==', email));
                     const eqSnap = await getDocs(emailQuery);
                     if (!eqSnap.empty) {
                         setAdminData(eqSnap.docs[0].data());
                         return;
                     }
                     
                     const userEq = query(collection(db, 'users'), where('email', '==', email));
                     const userEqSnap = await getDocs(userEq);
                     if (!userEqSnap.empty) {
                         const userData = userEqSnap.docs[0].data();
                         if (userData.role === 'admin' || userData.role === 'organiser') {
                             setAdminData(userData);
                             return;
                         }
                     }
                 }
             } catch (err) {
                 console.error(err);
             }
         };
         fetchAdminData();
     }
  }, [isAuthenticated, currentUser]);

  useEffect(() => {
    if (isAuthenticated && adminData !== null && currentUser) {
        // Temporary fix for missing tournament (only reclaim if the current admin is taha.nadeem to prevent other admins from taking ownership)
        const isTaha = currentUser.email === 'taha.nadeem@maidan.pk' || currentUser.email === 'taha.nadeem@maidan';
        if (isTaha) {
            import('firebase/firestore').then(({ doc, updateDoc, getDoc }) => {
                const fixRef = doc(db, 'tournaments', '8epSjX38LI0eFbxBo2hF');
                getDoc(fixRef).then(snap => {
                    if (snap.exists()) {
                        const data = snap.data();
                        // Reclaim ownership back to Taha Nadeem
                        if (data.organizerId !== currentUser.uid || data.organizerEmail !== currentUser.email) {
                            console.log("Reclaiming tournament ownership for Taha Nadeem...");
                            updateDoc(fixRef, { 
                                organizerId: currentUser.uid,
                                organizerEmail: currentUser.email,
                                adminTag: currentUser.email,
                                status: data.status || 'draft'
                            }).catch(console.error);
                        }
                    }
                }).catch(console.error);
            });
        }

        // Restrict tournaments strictly to the current admin's UID/email to prevent cross-admin visibility.
        // We fetch tournaments securely from the backend matching either UID or Email for cross-provider logins,
        // and apply secondary client filtering for Defense-in-Depth.
        const isGlobalAdmin = currentUser.email?.toLowerCase() === 'eventletics.business@gmail.com' || currentUser.email?.toLowerCase() === 'zayam.anjum@gmail.com';
        
        const unsubscribe = subscribeToTournaments((data: Tournament[]) => {
            console.log("Tournaments fetched for", currentUser.email, "UID:", currentUser.uid, data);
            // Apply strict secondary security filter based on admin tagging (UID and Email)
            const filtered = isGlobalAdmin ? data : data.filter(t => {
                const matchesUid = currentUser.uid && (
                    t.organizerId === currentUser.uid ||
                    (currentUser.email?.toLowerCase() === 'eventletics.business@gmail.com' && (t.organizerId === 'e3r8tmcuksen0mkeiroktnuzl1a2' || t.organizerId === 'E3r8tMCukSeN0mKEiRokTNuzL1a2' || t.organizerId === 'l7Uwo7VDdVhzVz4mtEhEpg9XcTP2'))
                );
                const matchesEmail = (t.organizerEmail && t.organizerEmail.toLowerCase() === currentUser.email?.toLowerCase()) || 
                                     (t.adminTag && t.adminTag.toLowerCase() === currentUser.email?.toLowerCase());
                const res = matchesUid || matchesEmail;
                console.log("Checking tournament", t.id, t.name, "matchesUid:", matchesUid, "matchesEmail:", matchesEmail, "res:", res);
                return res;
            });
            setTournaments(filtered);
        }, isGlobalAdmin ? undefined : (currentUser?.uid || undefined), isGlobalAdmin ? undefined : (currentUser?.email || undefined));
        const unsubVenues = subscribeToVenues((data: Venue[]) => {
            setAllVenues(data);
            setVenuesCount(data.length);
        });
        return () => {
            unsubscribe();
            unsubVenues();
        };
    }
  }, [isAuthenticated, adminData, currentUser]);

  const selectedCatIdRef = useRef(selectedCategoryId);
  selectedCatIdRef.current = selectedCategoryId;

  useEffect(() => {
    if (selectedTournamentId) {
        const unsubscribe = subscribeToTournament(selectedTournamentId, (data: Tournament | null) => {
            setActiveTournament(data);
            if (data?.isMultiCategory && data.categories && data.categories.length > 0) {
                // Determine if current selection is still valid
                const stillValid = data.categories.some(c => c.id === selectedCatIdRef.current);
                if (!selectedCatIdRef.current || !stillValid) {
                    setSelectedCategoryId(data.categories[0].id);
                }
            } else {
                setSelectedCategoryId(null);
            }
        });
        return () => unsubscribe();
    } else {
        setActiveTournament(null);
        setSelectedCategoryId(null);
    }
  }, [selectedTournamentId]);

const getTournamentCredits = (t: any) => {
    const calc = (format: string, teams: number, rrType?: string, groupSize?: number) => {
        if (!teams || teams < 2) return 0;
        if (format === 'SINGLE_ELIMINATION') return teams - 1;
        if (format === 'DOUBLE_ELIMINATION') return 2 * (teams - 1) + 1;
        if (format === 'ROUND_ROBIN') {
            if (rrType === 'SINGLE') return (teams * (teams - 1)) / 2;
            if (rrType === 'DOUBLE') return teams * (teams - 1);
            if (rrType === 'GROUP_SINGLE' || rrType === 'GROUP_DOUBLE') {
                 const actualGroupSize = groupSize || 4;
                 const groups = Math.ceil(teams / actualGroupSize);
                 let gMatches = 0;
                 for (let i=0; i<groups; i++) {
                     const size = i === groups - 1 ? teams - actualGroupSize * i : actualGroupSize;
                     if (size > 1) gMatches += (size * (size - 1)) / 2;
                 }
                 return gMatches;
            }
        }
        if (format === 'GROUP_TO_KNOCKOUT') {
             const actualGroupSize = groupSize || 4;
             const groups = Math.ceil(teams / actualGroupSize);
             let gMatches = 0;
             for (let i=0; i<groups; i++) {
                 const size = i === groups - 1 ? teams - actualGroupSize * i : actualGroupSize;
                 if (size > 1) gMatches += (size * (size - 1)) / 2;
             }
             const knockout = Math.max(0, groups * 2 - 1);
             return gMatches + knockout;
        }
        return teams - 1;
    };
    
    if (t.isMultiCategory && t.categories?.length > 0) {
        return t.categories.reduce((acc: number, cat: any) => {
            return acc + calc(cat.format || t.format, cat.maxTeams || 0, cat.rrType || t.rrType, cat.groupSize || t.groupSize);
        }, 0);
    }
    return calc(t.format, t.maxTeams || 0, t.rrType, t.groupSize);
};

  const handleDeleteTournament = (e: React.MouseEvent, t: Tournament) => {
      e.stopPropagation();
      setDeleteTarget(t);
  };

  const confirmDelete = async () => {
      if (!deleteTarget) return;
      try {
          const creditsToRefund = getTournamentCredits(deleteTarget);
          if (creditsToRefund > 0 && auth.currentUser) {
              await refundOrganiserCredits(auth.currentUser.uid, creditsToRefund);
          }
          await deleteTournament(deleteTarget.id);
          if (selectedTournamentId === deleteTarget.id) {
             setSelectedTournamentId(null);
          }
          setDeleteTarget(null);
      } catch (err) {
          console.error("Delete failed:", err);
          toast.error("Couldn't delete this tournament", "Please try again.");
      }
  };

  const [retireTarget, setRetireTarget] = useState<Tournament | null>(null);

  const handleRetireTournament = (e: React.MouseEvent, t: Tournament) => {
      e.stopPropagation();
      setRetireTarget(t);
  };

  const confirmRetire = async () => {
      if (!retireTarget) return;
      try {
          await retireTournament(retireTarget.id);
          setRetireTarget(null);
      } catch (err) {
          console.error("Retire failed:", err);
          toast.error("Couldn't retire this tournament", "Please try again.");
      }
  };

  const handleEditTournament = (e: React.MouseEvent, t: Tournament) => {
      if (e?.stopPropagation) e.stopPropagation();
      setEditingId(t.id);
      setActiveTournament(t);
      setIsCreating(true);
  };

  // Auto-sync once per session to ensure global data is up to date
  useEffect(() => {
      if (!sessionStorage.getItem('has_synced_global_data')) {
          sessionStorage.setItem('has_synced_global_data', 'true');
          syncAllDataToGlobal().catch(console.error);
      }
  }, []);

  if (!selectedTournamentId) {
      return (
          <div className="pb-20 pt-28 md:pt-36 space-y-6 px-4 md:px-8">
              <div className="flex justify-between items-center">
                  <div>
                    <h1 className="mb-0">Admin Dashboard</h1>
                    <p className="text-content-secondary text-sm mt-1">Manage your events and venues</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                        onClick={async () => {
                            try {
                                alert('Starting sync...');
                                await syncAllDataToGlobal();
                                alert('Sync complete!');
                            } catch (e: any) {
                                alert('Sync failed: ' + e.message);
                            }
                        }}
                        className="bg-[#4D78FF] hover:bg-[#3d60cc] text-white px-3 py-2.5 rounded-xl font-bold text-xs transition-colors shadow-lg"
                    >
                        Sync Global Data
                    </button>
                    <button 
                        onClick={async () => {
                            try {
                                const { sendPasswordResetEmail } = await import('firebase/auth');
                                await sendPasswordResetEmail(auth, auth.currentUser?.email || '');
                                alert('Password reset email sent. Please check your inbox to change your password.');
                            } catch(e:any) {
                                alert('Error: ' + e.message);
                            }
                        }} 
                        className="bg-surface-elevated hover:bg-white/10 text-white px-3 py-2.5 rounded-xl font-bold text-xs transition-all border border-white/5"
                    >
                        Change Password
                    </button>
                    {onLogout && (
                        <button onClick={onLogout} className="bg-surface-elevated hover:bg-red-500/20 text-red-500 px-3 py-2.5 rounded-xl font-bold text-xs transition-all border border-red-500/10"><LogOut size={16} /></button>
                    )}
                  </div>
              </div>
              <div className="flex flex-col lg:flex-row gap-6 mb-8 mt-4">
                  {/* The "Match Pass" Card */}
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand/20 via-surface-panel to-surface-ground border border-brand/20 shadow-2xl p-6 sm:p-8 flex-1 isolate group">
                      {/* Animated gradient background / glow */}
                      <div className="absolute inset-0 bg-brand/5 opacity-50 group-hover:opacity-100 transition-opacity duration-700"></div>
                      <div className="absolute -top-32 -right-32 w-64 h-64 bg-brand/20 blur-[100px] rounded-full group-hover:bg-brand/30 transition-colors duration-1000"></div>
                      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-brand/0 via-brand to-brand/0 opacity-30 group-hover:opacity-70 transition-opacity duration-700"></div>
                      
                      {/* Subtle Grid Pattern overlay */}
                      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-50"></div>

                      <div className="relative z-10 flex flex-col h-full justify-between gap-8">
                          <div className="flex justify-between items-start">
                              <div className="flex items-center gap-3">
                                  <div className="p-3 bg-brand/10 border border-brand/20 rounded-xl text-brand shadow-[0_0_15px_rgba(var(--brand),0.2)]">
                                      <Activity size={28} className="animate-pulse" />
                                  </div>
                                  <div>
                                      <h3 className="text-white font-black text-xl tracking-wider uppercase drop-shadow-md">Match Pass</h3>
                                      <p className="text-xs text-brand font-bold tracking-widest font-mono mt-0.5">ELITE ORGANIZER</p>
                                  </div>
                              </div>
                              <div className="text-right">
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-content-muted tracking-widest uppercase mb-1 justify-end">
                                      <Database size={12} />
                                      Available Points
                                  </div>
                                  <div className="text-5xl font-mono font-black text-white tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.2)] group-hover:text-brand-light transition-colors duration-500">
                                      {dashboardCredits ? dashboardCredits.matchCreditsRemaining : '...'}
                                  </div>
                              </div>
                          </div>
                          
                          <div className="flex items-end justify-between border-t border-white/10 pt-5">
                              <div className="flex flex-col gap-1.5">
                                  <span className="text-[10px] text-content-muted font-bold tracking-widest uppercase">Total Allotted Balance</span>
                                  <span className="text-content-secondary font-mono text-sm tracking-wide">
                                      {dashboardCredits ? ((dashboardCredits.matchCreditsRemaining || 0) + (dashboardCredits.matchCreditsUsed || 0)) : '...'} PTS
                                  </span>
                              </div>
                              
                              <button className="text-xs font-bold bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-all border border-white/10 group-hover:border-brand/30 shadow-sm active:scale-95">
                                  <ArrowUpRight size={16} className="text-brand" /> Top up (Coming soon)
                              </button>
                          </div>
                      </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row lg:flex-col gap-3 sm:gap-4 justify-center">
                      <button onClick={() => setIsCreating(true)} className="flex-1 lg:flex-none lg:w-64 bg-brand hover:bg-brand-light text-content-inverse px-4 py-3 sm:px-6 sm:py-5 rounded-xl sm:rounded-2xl font-bold flex items-center justify-center gap-3 sm:gap-4 transition-all shadow-[0_0_20px_rgba(var(--brand),0.3)] hover:scale-[1.02] active:scale-[0.98]">
                          <Plus className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                          <div className="flex flex-col items-start text-left">
                              <span className="leading-tight text-base sm:text-lg">Add Tournament</span>
                              <span className="text-[9px] sm:text-[11px] font-medium opacity-80 uppercase tracking-widest mt-0.5">Start from scratch</span>
                          </div>
                      </button>
                      <button onClick={() => setIsCloning(true)} className="flex-1 lg:flex-none lg:w-64 bg-surface-elevated hover:bg-white/10 text-white px-4 py-3 sm:px-6 sm:py-5 rounded-xl sm:rounded-2xl font-bold flex items-center justify-center gap-3 sm:gap-4 transition-all border border-white/10 hover:border-white/20 hover:scale-[1.02] active:scale-[0.98]">
                          <Copy className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 text-content-muted" />
                          <div className="flex flex-col items-start text-left">
                              <span className="leading-tight text-base sm:text-lg">Clone Tournament</span>
                              <span className="text-[9px] sm:text-[11px] text-content-muted font-medium uppercase tracking-widest mt-0.5">Duplicate format & teams</span>
                          </div>
                      </button>
                  </div>
              </div>

              {mergeAlertCount > 0 && mainTab !== 'merges' && (
                  <div className="bg-[#E65C31]/10 border border-amber-500/20 rounded-2xl p-4 mb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                          <div className="bg-[#E65C31]/20 p-2 rounded-xl text-[#E65C31] shrink-0">
                              <AlertTriangle size={20} />
                          </div>
                          <div>
                              <h4 className="text-white font-bold text-sm">Potential Player Profile Merges</h4>
                              <p className="text-content-secondary text-xs mt-0.5">Found {mergeAlertCount} manually onboarded players whose profiles can be merged with registered platform accounts.</p>
                          </div>
                      </div>
                      <button 
                          onClick={() => setMainTab('merges')}
                          className="bg-[#E65C31] hover:bg-[#E65C31] text-black px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0"
                      >
                          Review & Merge
                      </button>
                  </div>
              )}
              
              <div className="flex bg-surface-panel p-1 rounded-xl mb-6 gap-2">
                 <button onClick={() => { setMainTab('tournaments');  }} className={`flex-1 flex justify-center py-2 text-sm font-bold rounded-lg transition-all ${mainTab === 'tournaments' ? 'bg-brand text-content-inverse' : 'text-content-muted hover:text-white'}`}>Tournaments</button>
                 <button onClick={() => { setMainTab('merges'); setSelectedTournamentId(null);  }} className={`flex-1 flex justify-center py-2 text-sm font-bold rounded-lg transition-all relative ${mainTab === 'merges' ? 'bg-brand text-content-inverse' : 'text-content-muted hover:text-white'}`}>
                     Merge Profiles
                     {mergeAlertCount > 0 && (
                         <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                             {mergeAlertCount}
                         </span>
                     )}
                 </button>
              </div>

              {mainTab === 'merges' ? (
                  <div className="space-y-6">
                      <div className="bg-surface-panel p-6 rounded-2xl border border-white/5">
                          <h2 className="text-xl font-bold text-white mb-2">Profile Merge Center</h2>
                          <p className="text-content-muted text-sm max-w-3xl">
                              Review and merge manually onboarded (unauthenticated) players with self-registered platform players. 
                              The matching algorithm detects overlaps based on a mandatory exact name match plus matching phone numbers, email addresses, or CNICs.
                          </p>
                      </div>

                      {loadingPlayers ? (
                          <div className="flex flex-col items-center justify-center py-12 text-content-muted gap-2">
                              <Loader2 className="animate-spin text-brand" size={32} />
                              <div className="text-sm">Scanning profiles for potential merges...</div>
                          </div>
                      ) : pendingMerges.length === 0 ? (
                          <div className="bg-surface-panel p-12 text-center rounded-2xl border border-white/5 space-y-3">
                              <Check className="mx-auto text-accent-success" size={48} />
                              <h3 className="font-bold text-white text-lg">All Clean!</h3>
                              <p className="text-content-muted text-sm max-w-md mx-auto">No potential profile merges detected at the moment. All manually onboarded players are uniquely distinct or already successfully linked.</p>
                          </div>
                      ) : (
                          <div className="grid grid-cols-1 gap-6">
                              {pendingMerges.map((merge) => (
                                  <Card key={merge.id} variant="panel" className="border border-white/10 overflow-hidden relative">
                                      <div className="bg-surface-ground p-4 border-b border-white/5 flex flex-wrap items-center justify-between gap-4">
                                          <div className="flex items-center gap-2">
                                              <span className="bg-[#E65C31]/15 text-[#E65C31] text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Potential Duplicate Match</span>
                                          </div>
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                              {merge.reasons.map((reason, idx) => (
                                                  <span key={idx} className="bg-brand/10 text-brand text-[10px] font-bold px-2 py-0.5 rounded border border-brand/20">
                                                      {reason}
                                                  </span>
                                              ))}
                                          </div>
                                      </div>
                                      
                                      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/5">
                                          {/* Unauthenticated / Manual */}
                                          <div className="p-6 space-y-4">
                                              <div className="flex items-center gap-3">
                                                  <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center font-bold">
                                                      M
                                                  </div>
                                                  <div>
                                                      <h4 className="text-sm font-bold text-content-muted uppercase tracking-wider">Manually Onboarded Profile</h4>
                                                      <div className="text-white font-black text-lg">{merge.unauthPlayer.name}</div>
                                                  </div>
                                              </div>
                                              
                                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-surface-dark/40 p-4 rounded-xl border border-white/5">
                                                  <div>
                                                      <div className="text-content-muted text-xs font-bold uppercase">Phone Number</div>
                                                      <div className="text-white font-medium mt-0.5">{merge.unauthPlayer.phone || 'N/A'}</div>
                                                  </div>
                                                  <div>
                                                      <div className="text-content-muted text-xs font-bold uppercase">Email Address</div>
                                                      <div className="text-white font-medium mt-0.5 truncate">{merge.unauthPlayer.email || 'N/A'}</div>
                                                  </div>
                                                  <div>
                                                      <div className="text-content-muted text-xs font-bold uppercase">CNIC</div>
                                                      <div className="text-white font-medium mt-0.5">{merge.unauthPlayer.cnic || 'N/A'}</div>
                                                  </div>
                                                  <div>
                                                      <div className="text-content-muted text-xs font-bold uppercase">Enrollments</div>
                                                      <div className="text-white font-medium mt-0.5">
                                                          {merge.occurrences.length} tournament team(s)
                                                      </div>
                                                  </div>
                                              </div>

                                              <div className="space-y-1.5">
                                                  <div className="text-content-muted text-xs font-bold uppercase">Active Registrations To Update:</div>
                                                  <div className="space-y-1">
                                                      {merge.occurrences.map((occ, idx) => (
                                                          <div key={idx} className="bg-white/5 px-3 py-1.5 rounded text-xs flex items-center justify-between text-content-secondary">
                                                              <span>
                                                                  Tournament: <strong className="text-white">{occ.tournament.name}</strong> 
                                                                  <span className="mx-1 text-content-muted">&bull;</span> 
                                                                  Team: <strong className="text-white">{occ.team.name}</strong>
                                                              </span>
                                                              <span className="bg-white/5 text-content-muted px-1.5 py-0.5 rounded text-[10px]">
                                                                  Player {occ.playerIndex}
                                                              </span>
                                                          </div>
                                                      ))}
                                                  </div>
                                              </div>
                                          </div>

                                          {/* Authenticated / Self Registered */}
                                          <div className="p-6 space-y-4">
                                              <div className="flex items-center gap-3">
                                                  <div className="w-10 h-10 rounded-full bg-[#4D78FF]/10 text-[#4D78FF] flex items-center justify-center font-bold">
                                                      A
                                                  </div>
                                                  <div>
                                                      <h4 className="text-sm font-bold text-content-muted uppercase tracking-wider">Registered Platform Account</h4>
                                                      <div className="text-white font-black text-lg flex items-center gap-2">
                                                          {merge.authPlayer.fullName || merge.authPlayer.name}
                                                          <span className="bg-accent-success/20 text-accent-success text-[10px] font-bold px-1.5 py-0.5 rounded">Verified</span>
                                                      </div>
                                                  </div>
                                              </div>
                                              
                                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-surface-dark/40 p-4 rounded-xl border border-white/5">
                                                  <div>
                                                      <div className="text-content-muted text-xs font-bold uppercase">Phone Number</div>
                                                      <div className="text-white font-medium mt-0.5">{merge.authPlayer.phone || 'N/A'}</div>
                                                  </div>
                                                  <div>
                                                      <div className="text-content-muted text-xs font-bold uppercase">Email Address</div>
                                                      <div className="text-white font-medium mt-0.5 truncate">{merge.authPlayer.email || 'N/A'}</div>
                                                  </div>
                                                  <div>
                                                      <div className="text-content-muted text-xs font-bold uppercase">CNIC</div>
                                                      <div className="text-white font-medium mt-0.5">{merge.authPlayer.cnic || 'N/A'}</div>
                                                  </div>
                                                  <div>
                                                      <div className="text-content-muted text-xs font-bold uppercase">Elo Rating / Status</div>
                                                      <div className="text-white font-medium mt-0.5 flex items-center gap-1.5">
                                                          <span className="bg-brand/10 text-brand px-1.5 py-0.5 rounded text-xs font-bold">
                                                              {merge.authPlayer.stats?.eloRating || 1200}
                                                          </span>
                                                          <span className="text-content-muted">({merge.authPlayer.role || 'player'})</span>
                                                      </div>
                                                  </div>
                                              </div>

                                              
                                          </div>
                                      </div>
                                       {/* Full-width elegant merge action bar footer */}
                                       <div className="bg-white/[0.02] border-t border-white/5 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                           <div className="space-y-1 max-w-2xl">
                                               <h5 className="text-white font-bold text-sm flex items-center gap-2">
                                                   <RefreshCcw size={14} className="text-brand animate-spin-slow" />
                                                   Confirm Profile Association
                                               </h5>
                                               <p className="text-content-muted text-xs leading-relaxed">
                                                   Merging will permanently update the <strong>{merge.occurrences.length} active registration(s)</strong> and any matching historical match scores to reference <strong>{merge.authPlayer.fullName || merge.authPlayer.name}</strong> as the official participant. This action cannot be undone.
                                               </p>
                                           </div>
                                           <button
                                               disabled={mergingId !== null}
                                               onClick={async () => {
                                                   if (window.confirm(`Are you absolutely sure you want to merge "${merge.unauthPlayer.name}" (manual) into the registered account "${merge.authPlayer.fullName || merge.authPlayer.name}"?\n\nThis will link all existing team enrollments and matches to this official account.`)) {
                                                       setMergingId(merge.id);
                                                       try {
                                                           await mergePlayerProfiles(merge.unauthPlayer, merge.authPlayer);
                                                           alert("Profiles successfully merged! Team entries have been permanently updated.");
                                                           await fetchRegisteredPlayers();
                                                       } catch (err) {
                                                           console.error("Failed to merge:", err);
                                                           alert("An error occurred during merging. Please try again.");
                                                       } finally {
                                                           setMergingId(null);
                                                       }
                                                   }
                                               }}
                                               className="w-full md:w-auto bg-brand hover:bg-brand/90 disabled:opacity-50 text-content-inverse font-black py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand/20 active:scale-95 shrink-0 uppercase text-xs tracking-wider"
                                           >
                                               {mergingId === merge.id ? (
                                                   <>
                                                       <Loader2 size={16} className="animate-spin" />
                                                       Merging Profiles...
                                                   </>
                                               ) : (
                                                   <>
                                                       <RefreshCcw size={16} />
                                                       Authenticate & Merge Profiles
                                                   </>
                                               )}
                                           </button>
                                       </div>

                                  </Card>
                              ))}
                          </div>
                      )}
                  </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 flex-wrap pb-2">
                    {['All', 'Active', 'Upcoming', 'Completed', 'Draft', 'Archived'].map(filter => (
                        <button 
                          key={filter}
                          onClick={() => setTournamentStatusFilter(filter)}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${tournamentStatusFilter === filter ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'bg-white/5 text-content-muted hover:text-white hover:bg-white/10'}`}
                        >
                          {filter}
                        </button>
                    ))}
                  </div>
                <div className="grid gap-4">
                  {(!tournaments ? [] : tournaments.filter(t => {
                      const allowedRole = t.organizerId === currentUser?.uid || 
                                          (t.organizerEmail && t.organizerEmail.toLowerCase() === currentUser?.email?.toLowerCase()) || 
                                          (t.adminTag && t.adminTag.toLowerCase() === currentUser?.email?.toLowerCase()) ||
                                          (currentUser?.email?.toLowerCase() === 'eventletics.business@gmail.com' && (t.organizerId === 'e3r8tmcuksen0mkeiroktnuzl1a2' || t.organizerId === 'E3r8tMCukSeN0mKEiRokTNuzL1a2' || t.organizerId === 'l7Uwo7VDdVhzVz4mtEhEpg9XcTP2'));
                      if (!allowedRole) return false;
                      if (tournamentStatusFilter === 'All') return true;
                      const normStatus = (t.status || 'draft').toLowerCase();
                      if (tournamentStatusFilter === 'Active') return ['active', 'in_progress', 'live'].includes(normStatus);
                      if (tournamentStatusFilter === 'Upcoming') return normStatus.includes('upcoming') || normStatus === 'scheduled';
                      if (tournamentStatusFilter === 'Completed') return normStatus.includes('completed');
                      if (tournamentStatusFilter === 'Draft') return normStatus.includes('draft');
                      if (tournamentStatusFilter === 'Archived') return normStatus.includes('archived');
                      return true;
                  })).map(t => (
                      <Card key={t.id} variant="panel" className="p-0 overflow-hidden group hover:border-brand/50 transition-all cursor-pointer" onClick={() => setSelectedTournamentId(t.id)}>
                          {t.bannerUrl && (
                              <div className="w-full h-32 overflow-hidden relative border-b border-white/5">
                                  <img src={t.bannerUrl} alt="Tournament Banner" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                              </div>
                          )}
                          <div className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                              <div className="flex-1 w-full min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                                      <h3 className="text-lg sm:text-xl font-bold text-white group-hover:text-brand transition-colors truncate">{t.name}</h3>
                                      <TournamentLiveBadge tournamentId={t.id} defaultStatus={t.status} />
                                  </div>
                                  <div className="text-content-secondary text-xs sm:text-sm flex flex-wrap items-center gap-2 sm:gap-3">
                                      <Badge variant="neutral" className="font-mono text-[10px] sm:text-xs shrink-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap">{t.format.replace(/_/g, ' ')}</Badge>
                                      <span className="flex items-center gap-1 shrink-0"><Users size={14} className="w-3.5 h-3.5"/> {(t.teams || []).length} Teams</span>
                                      <span className="flex items-center gap-1 min-w-0"><MapPin size={14} className="w-3.5 h-3.5 shrink-0"/> <span className="truncate max-w-[150px] sm:max-w-none">{t.venue || 'TBD'} &bull; {t.city || 'Karachi'}</span></span>
                                  </div>
                              </div>
                              <div className="flex w-full sm:w-auto items-center justify-end gap-2 mt-2 sm:mt-0 pt-3 sm:pt-0 border-t border-white/5 sm:border-0">
                                   <button onClick={(e) => handleEditTournament(e, t)} className="p-2 text-content-muted hover:text-white transition-colors bg-surface-ground rounded-lg"><Edit3 size={18}/></button>
                                   {(t.teams || []).filter(x => x.status === 'ACCEPTED').length < 2 ? (
                                      <button onClick={(e) => handleDeleteTournament(e, t)} className="p-2 text-content-muted hover:text-accent-live transition-colors bg-surface-ground rounded-lg"><Trash2 size={18}/></button>
                                   ) : (t.status !== 'RETIRED' && (
                                       <button onClick={(e) => handleRetireTournament(e, t)} className="p-2 text-content-muted hover:text-orange-500 transition-colors bg-surface-ground rounded-lg" title="Retire Tournament"><Archive size={18}/></button>
                                   ))}
                                   <button onClick={() => setSelectedTournamentId(t.id)} className="p-2 bg-brand text-content-inverse rounded-lg"><ChevronRight size={18}/></button>
                              </div>
                          </div>
                      </Card>
                  ))}
                  {(!tournaments ? [] : tournaments.filter(t => {
                      const allowedRole = t.organizerId === currentUser?.uid || 
                                          (t.organizerEmail && t.organizerEmail.toLowerCase() === currentUser?.email?.toLowerCase()) || 
                                          (t.adminTag && t.adminTag.toLowerCase() === currentUser?.email?.toLowerCase()) ||
                                          (currentUser?.email?.toLowerCase() === 'eventletics.business@gmail.com' && (t.organizerId === 'e3r8tmcuksen0mkeiroktnuzl1a2' || t.organizerId === 'E3r8tMCukSeN0mKEiRokTNuzL1a2' || t.organizerId === 'l7Uwo7VDdVhzVz4mtEhEpg9XcTP2'));
                      if (!allowedRole) return false;
                      if (tournamentStatusFilter === 'All') return true;
                      const normStatus = (t.status || 'draft').toLowerCase();
                      if (tournamentStatusFilter === 'Active') return ['active', 'in_progress', 'live'].includes(normStatus);
                      if (tournamentStatusFilter === 'Upcoming') return normStatus.includes('upcoming') || normStatus === 'scheduled';
                      if (tournamentStatusFilter === 'Completed') return normStatus.includes('completed');
                      if (tournamentStatusFilter === 'Draft') return normStatus.includes('draft');
                      if (tournamentStatusFilter === 'Archived') return normStatus.includes('archived');
                      return true;
                  })).length === 0 && (
                      <div className="text-center py-20 border-2 border-dashed border-white/10 rounded-3xl">
                          <Trophy size={48} className="mx-auto text-content-muted mb-4 opacity-50" />
                          <h3 className="text-xl font-bold text-white mb-2">No Tournaments Yet</h3>
                          <p className="text-content-secondary mb-6">Create your first tournament to get started.</p>
                          <button onClick={() => setIsCreating(true)} className="bg-surface-elevated hover:bg-surface-card text-white px-6 py-3 rounded-xl font-bold transition-all">Create Tournament</button>
                      </div>
                  )}
                </div>
                </div>
              )}
              <DeleteConfirmationModal target={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
              <RetireConfirmationModal target={retireTarget} onCancel={() => setRetireTarget(null)} onConfirm={confirmRetire} />

          {isCloning && (
              <CloneTournamentModal 
                  tournaments={tournaments}
                  onClose={() => setIsCloning(false)}
                  onSuccess={(newId) => {
                      setIsCloning(false);
                      setEditingId(newId);
                      setIsCreating(true);
                  }}
              />
          )}
              
              {/* Tournament Wizard Modal */}
              {isCreating && (
                  <div className="fixed inset-0 z-50 flex justify-center pt-10 sm:pt-20 bg-black/80 backdrop-blur-sm overflow-y-auto pb-20">
                     <div className="bg-[#0f1115] w-full max-w-4xl rounded-2xl border border-white/10 shadow-2xl relative">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#15181e] rounded-t-2xl">
                            <div>
                                <h2 className="text-xl font-bold text-white">{editingId ? "Edit Tournament" : "Create Tournament"}</h2>
                                <p className="text-sm text-content-secondary mt-1">{editingId ? "Update tournament details and settings." : "Set up a new tournament."}</p>
                            </div>
                            <button onClick={closeWizard} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors duration-200">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-8">
                            <CreateTournamentWizardWrapper 
                                initialData={editingId ? activeTournament : null} 
                                tournamentId={editingId} 
                                onCancel={closeWizard} 
                                onCreate={(id: string) => {
                                    closeWizard();
                                    setSelectedTournamentId(id);
                                }} 
                            />
                        </div>
                     </div>
                  </div>
              )}
          </div>
      )
  }

  if (!activeTournament) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-brand" size={32} /></div>;

  return (
      <div className="pb-20 pt-28 md:pt-36 space-y-6 px-4 md:px-8">
          {/* Context Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-4">
                  <button onClick={() => setSelectedTournamentId(null)} className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-surface-panel border border-white/10 text-content-secondary hover:text-white hover:border-brand transition-all"><ChevronLeft size={20}/></button>
                  <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl md:text-3xl mb-0 truncate">{activeTournament.name}</h1>
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-content-muted mt-1">
                        <span className="text-brand shrink-0">{activeTournament.format.replace(/_/g, ' ')}</span>
                        <span className="shrink-0">•</span>
                        <span className="truncate max-w-[200px] sm:max-w-none min-w-0 break-words">{activeTournament.venue} &bull; {activeTournament.city || 'Karachi'}</span>
                    </div>
                  </div>
              </div>
              <div className="flex items-center gap-4 self-end sm:self-auto shrink-0">

                  <div className="flex gap-2">
                      <button onClick={(e) => handleEditTournament(e, activeTournament)} className="p-2.5 bg-surface-panel border border-white/10 rounded-xl text-content-secondary hover:text-white hover:border-brand transition-all"><Edit3 size={18}/></button>
                      {(activeTournament.teams || []).filter(x => x.status === 'ACCEPTED').length < 2 ? (
                           <button onClick={(e) => handleDeleteTournament(e, activeTournament)} className="p-2.5 bg-surface-panel border border-white/10 rounded-xl text-accent-error hover:bg-accent-error/10 transition-all"><Trash2 size={18}/></button>
                      ) : (activeTournament.status !== 'RETIRED' && (
                           <button onClick={(e) => handleRetireTournament(e, activeTournament)} className="p-2.5 bg-surface-panel border border-white/10 rounded-xl text-orange-500 hover:bg-orange-500/10 transition-all" title="Retire Tournament"><Archive size={18}/></button>
                      ))}
                  </div>
              </div>
          </div>
          
          {/* Tabs */}
          <div className="flex flex-wrap sm:flex-nowrap gap-1.5 sm:gap-2 pb-2 w-full">
              <TabButton active={view === 'OVERVIEW'} onClick={() => setView('OVERVIEW')} label="Overview" icon={<Activity size={16}/>} />
              <TabButton active={view === 'TEAMS'} onClick={() => setView('TEAMS')} label="Team Management" icon={<Users size={16}/>} />
              {(() => {
                  const cat = activeTournament.isMultiCategory && selectedCategoryId ? activeTournament.categories?.find(c => c.id === selectedCategoryId) : null;
                  const fmt = cat?.format || activeTournament.format;
                  const rr = cat?.rrType || activeTournament.rrType;
                  const hasGroups = (fmt === TournamentFormat.ROUND_ROBIN && (rr === RoundRobinType.GROUP_SINGLE || rr === RoundRobinType.GROUP_DOUBLE)) || fmt === TournamentFormat.GROUP_TO_KNOCKOUT;
                  return hasGroups && (
                      <TabButton active={view === 'GROUPS'} onClick={() => setView('GROUPS')} label="Groups" icon={<Grid size={16}/>} />
                  );
              })()}
              <TabButton active={view === 'SCHEDULE'} onClick={() => setView('SCHEDULE')} label="Schedule" icon={<Calendar size={16}/>} />
              <TabButton active={view === 'STANDINGS'} onClick={() => setView('STANDINGS')} label="Standings" icon={<List size={16}/>} />
              <TabButton active={view === 'KNOCKOUT'} onClick={() => setView('KNOCKOUT')} label="Knockouts" icon={<Trophy size={16}/>} />
              <TabButton active={view === 'RESULTS'} onClick={() => setView('RESULTS')} label="Results" icon={<Check size={16}/>} />
              <TabButton active={view === 'LEADERBOARD'} onClick={() => setView('LEADERBOARD')} label="Leaderboard" icon={<Medal size={16}/>} />
          </div>

          {activeTournament.isMultiCategory && activeTournament.categories && activeTournament.categories.length > 0 && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center p-3 sm:p-4 bg-surface-panel border border-white/5 rounded-2xl w-full min-w-0 gap-3">
                  <span className="text-[10px] text-content-muted font-bold uppercase tracking-widest flex-shrink-0">Category:</span>
                  <div className="flex-1 w-full min-w-0">
                      <div className="flex flex-wrap gap-2 w-full">
                          {activeTournament.categories.map(cat => (
                              <button 
                                key={cat.id} 
                                onClick={() => setSelectedCategoryId(cat.id)}
                                className={`flex-1 sm:flex-none justify-center flex-shrink-0 px-3 sm:px-4 py-2 sm:py-2 rounded-xl text-[10px] sm:text-xs font-bold border transition-all ${selectedCategoryId === cat.id ? 'bg-brand border-brand text-content-inverse' : 'bg-surface-ground border-white/10 text-white hover:border-brand/50'}`}
                              >
                                  {cat.name}
                              </button>
                          ))}
                      </div>
                  </div>
              </div>
          )}

          {view === 'OVERVIEW' && <OverviewTab tournament={activeTournament} categoryId={selectedCategoryId} venues={allVenues} onEdit={() => handleEditTournament({ stopPropagation: () => {} } as any, activeTournament)} />}
          {view === 'TEAMS' && <TeamsTab tournament={activeTournament} categoryId={selectedCategoryId} setView={setView} />}
          {view === 'GROUPS' && <GroupAssignmentTab tournament={activeTournament} categoryId={selectedCategoryId} />}
          {view === 'SCHEDULE' && <ScheduleTab tournament={activeTournament} categoryId={selectedCategoryId} />}
          {view === 'STANDINGS' && <StandingsTab tournament={activeTournament} categoryId={selectedCategoryId} />}
          {view === 'KNOCKOUT' && <KnockoutTab tournament={activeTournament} categoryId={selectedCategoryId} />}
          {view === 'RESULTS' && <ResultsTab tournament={activeTournament} categoryId={selectedCategoryId} />}
          {view === 'LEADERBOARD' && <TournamentLeaderboardTab tournament={activeTournament} categoryId={selectedCategoryId} />}
          
          <DeleteConfirmationModal target={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
          <RetireConfirmationModal target={retireTarget} onCancel={() => setRetireTarget(null)} onConfirm={confirmRetire} />

          {/* Tournament Wizard Modal */}
          {isCreating && (
              <div className="fixed inset-0 z-50 flex justify-center pt-10 sm:pt-20 bg-black/80 backdrop-blur-sm overflow-y-auto pb-20">
                 <div className="bg-[#0f1115] w-full max-w-4xl rounded-2xl border border-white/10 shadow-2xl relative">
                    <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#15181e] rounded-t-2xl">
                        <div>
                            <h2 className="text-xl font-bold text-white">{editingId ? "Edit Tournament" : "Create Tournament"}</h2>
                            <p className="text-sm text-content-secondary mt-1">{editingId ? "Update tournament details and settings." : "Set up a new tournament."}</p>
                        </div>
                        <button onClick={closeWizard} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors duration-200">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="p-8">
                        <CreateTournamentWizardWrapper 
                            initialData={editingId ? activeTournament : null} 
                            tournamentId={editingId} 
                            onCancel={closeWizard} 
                            onCreate={(id: string) => {
                                closeWizard();
                                setSelectedTournamentId(id);
                            }} 
                        />
                    </div>
                 </div>
              </div>
          )}
      </div>
  );
};


// --- SUB-COMPONENTS ---

// Wrapper to fetch detailed tournament data if editing (needed for sponsors)
function CreateTournamentWizardWrapper({ initialData, tournamentId, onCancel, onCreate }: any) {
    const [fullData, setFullData] = useState<Tournament | null>(initialData);
    const [loading, setLoading] = useState(!!tournamentId);

    useEffect(() => {
        if (tournamentId) {
            // Subscribe to get full data including sponsors subcollection
            const unsubscribe = subscribeToTournament(tournamentId, (data) => {
                setFullData(data);
                setLoading(false);
            });
            return () => unsubscribe();
        }
    }, [tournamentId]);

    if (loading) return <div className="p-8 text-white text-center">Loading tournament details...</div>;

    return <CreateTournamentWizard initialData={fullData} onCancel={onCancel} onCreate={onCreate} />;
};

function RetireConfirmationModal({ target, onCancel, onConfirm }: any) {
    if (!target) return null;
    return (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onCancel}>
            <Card variant="panel" className="w-full max-w-md border-orange-500/50 p-6 relative shadow-2xl" onClick={(e: any) => e.stopPropagation()}>
                <div className="flex flex-col items-center text-center">
                    <div className="h-14 w-14 bg-orange-500/10 rounded-full flex items-center justify-center text-orange-500 mb-4">
                        <Archive size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Retire Tournament?</h3>
                    <p className="text-content-secondary text-sm mb-6">
                        Are you sure you want to retire <span className="text-white font-bold">"{target.name}"</span>? 
                        This will mark the tournament as complete and it will no longer be active. Match credits will <strong className="text-white">not</strong> be refunded since the tournament has already started.
                    </p>
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={onCancel}
                            className="flex-1 bg-surface-elevated hover:bg-surface-elevated/80 text-white font-medium py-3 rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={onConfirm}
                            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-orange-500/20"
                        >
                            Retire Tournament
                        </button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

function DeleteConfirmationModal({ target, onCancel, onConfirm }: any) {
    if (!target) return null;
    return (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onCancel}>
            <Card variant="panel" className="w-full max-w-md border-accent-error/50 p-6 relative shadow-2xl" onClick={(e: any) => e.stopPropagation()}>
                <div className="flex flex-col items-center text-center">
                    <div className="h-14 w-14 bg-accent-error/10 rounded-full flex items-center justify-center text-accent-error mb-4">
                        <AlertTriangle size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Delete Tournament?</h3>
                    <p className="text-content-secondary text-sm mb-6">
                        Are you sure you want to delete <span className="text-white font-bold">"{target.name}"</span>? 
                        This action cannot be undone. <strong className="text-white">Your match credits will be refunded.</strong>
                    </p>
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={onCancel}
                            className="flex-1 bg-surface-elevated hover:bg-surface-elevated/80 text-white font-medium py-3 rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={onConfirm}
                            className="flex-1 bg-accent-error hover:bg-accent-error/80 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-accent-error/20"
                        >
                            Delete Forever
                        </button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

const TabButton = ({ active, onClick, label, icon }: any) => (
    <button onClick={onClick} className={`flex-1 sm:flex-none justify-center px-2 sm:px-4 py-2 sm:py-2.5 rounded-lg flex items-center gap-1.5 sm:gap-2 whitespace-nowrap text-[10px] sm:text-xs font-bold transition-all ${active ? 'bg-brand text-content-inverse' : 'bg-surface-panel text-content-muted border border-white/10 hover:text-white hover:bg-surface-elevated'}`}>
        {React.cloneElement(icon, { className: 'w-3 h-3 sm:w-4 sm:h-4 shrink-0' })} 
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{label.split(' ')[0]}</span>
    </button>
);

const CourtPicker = ({ venue, selectedCourts, onChange }: { venue: Venue | undefined, selectedCourts: string[], onChange: (courts: string[]) => void }) => {
    const [realCourts, setRealCourts] = useState<any[]>([]);

    useEffect(() => {
        if (!venue || !venue.id) return;
        let isMounted = true;
        import('../services/storage').then(({ getCourtsByVenueIds }) => {
            getCourtsByVenueIds([venue.id]).then(courts => {
                if (isMounted) setRealCourts(courts);
            });
        });
        return () => { isMounted = false; };
    }, [venue?.id]);

    if (!venue) return <p className="text-[10px] text-content-muted italic">Select a venue first</p>;
    
    // Only use system courts unless none exist, in which case we fall back to generic names
    const count = venue.courts || 1;
    const allCourtsObjects = realCourts.length > 0 
        ? realCourts.map(c => c.name || c.courtName || `System Court ${c.id}`) 
        : Array.from({ length: count }, (_, i) => `${venue.name || 'Venue'} - Court ${i + 1}`);
    
    const toggleCourt = (court: string) => {
        if (selectedCourts.includes(court)) {
            onChange(selectedCourts.filter(c => c !== court));
        } else {
            onChange([...selectedCourts, court]);
        }
    };

    return (
        <div className="flex flex-wrap gap-2">
            {allCourtsObjects.map((c: string) => (
                <button
                    key={c}
                    onClick={() => toggleCourt(c)}
                    type="button"
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border ${selectedCourts.includes(c) ? 'bg-brand border-brand text-content-inverse' : 'bg-surface-panel border-white/10 text-content-muted hover:border-white/20'}`}
                >
                    {c}
                </button>
            ))}
            {realCourts.length === 0 && (
                <div className="text-[10px] text-accent-warning mt-1 w-full italic">Warning: No courts defined under this venue in Control Tower. Using placeholders.</div>
            )}
        </div>
    );
};

function CreateTournamentWizard({ initialData, onCancel, onCreate }: any) {
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [venues, setVenues] = useState<Venue[]>([]);
    const [orgCredits, setOrgCredits] = useState<any>(null);
    const [loadingCredits, setLoadingCredits] = useState(true);
    
    // Popup state for Add Category
    const [showAddCategory, setShowAddCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('Intermediate');
    const [isCustomCategory, setIsCustomCategory] = useState(false);
    const [customCategoryValue, setCustomCategoryValue] = useState('');

    useEffect(() => {
        const unsubscribe = subscribeToVenues((data) => setVenues(data));
        if (auth.currentUser) {
            getOrganiserCredits(auth.currentUser.uid).then(data => {
                setOrgCredits(data);
                setLoadingCredits(false);
            });
        } else {
            setLoadingCredits(false);
        }
        return () => unsubscribe();
    }, []);
    
    // Sponsor Upload State
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [newSponsor, setNewSponsor] = useState<{logo: string, tier: SponsorTier}>({ logo: '', tier: SponsorTier.SILVER });

    // Handle legacy string[] sponsors vs new Sponsor[] object
    const initialSponsors = initialData?.sponsors?.map((s: any) => {
        if (typeof s === 'string') return { id: Math.random().toString(), name: 'Sponsor', logo: s, tier: SponsorTier.SILVER };
        return s;
    }) || [];

    const [data, setData] = useState(initialData ? {
        ...initialData,
        courts: (initialData.courts || []).join(', '),
        sponsors: initialSponsors,
        categories: initialData.categories || [],
        isMultiCategory: initialData.isMultiCategory || false,
        multipleVenues: initialData.multipleVenues || false,
        venueIds: initialData.venueIds || [],
        organizerLogo: initialData.organizerLogo || ''
    } : {
        name: '', 
        format: TournamentFormat.SINGLE_ELIMINATION, 
        rrType: RoundRobinType.SINGLE, 
        groupSize: 4,
        skillLevel: SkillLevel.INTERMEDIATE, 
        maxTeams: 8, 
        entryFee: 5000, 
        currency: 'PKR',
        venue: '',
        venueId: '',
        venueIds: [] as string[],
        city: '',
        organizer: '',
        organizerLogo: '',
        refereePasscode: '1234', 
        courts: [] as string[],
        startDate: '',
        endDate: '',
        registrationDeadline: '',
        prizeMoney: 1000,
        sponsors: [] as Sponsor[],
        categories: [] as any[],
        isMultiCategory: false,
        multipleVenues: false
    });

    const calculateCategoryMatches = (format: TournamentFormat, teams: number, rrType?: RoundRobinType, groupSize?: number) => {
        if (!teams || teams < 2) return 0;
        if (format === TournamentFormat.SINGLE_ELIMINATION) {
            return teams - 1;
        } else if (format === TournamentFormat.DOUBLE_ELIMINATION) {
            return 2 * (teams - 1) + 1;
        } else if (format === TournamentFormat.ROUND_ROBIN) {
            if (rrType === RoundRobinType.SINGLE) return (teams * (teams - 1)) / 2;
            if (rrType === RoundRobinType.DOUBLE) return teams * (teams - 1);
            if (rrType === RoundRobinType.GROUP_SINGLE || rrType === RoundRobinType.GROUP_DOUBLE) {
                 const actualGroupSize = groupSize || 4;
                 const groups = Math.ceil(teams / actualGroupSize);
                 let gMatches = 0;
                 for (let i=0; i<groups; i++) {
                     const size = i === groups - 1 ? teams - actualGroupSize * i : actualGroupSize;
                     if (size > 1) gMatches += (size * (size - 1)) / 2;
                 }
                 return gMatches;
            }
        } else if (format === TournamentFormat.GROUP_TO_KNOCKOUT) {
             const actualGroupSize = groupSize || 4;
             const groups = Math.ceil(teams / actualGroupSize);
             let gMatches = 0;
             for (let i=0; i<groups; i++) {
                 const size = i === groups - 1 ? teams - actualGroupSize * i : actualGroupSize;
                 if (size > 1) gMatches += (size * (size - 1)) / 2;
             }
             const knockout = Math.max(0, groups * 2 - 1);
             return gMatches + knockout;
        }
        return teams - 1;
    };

    const calculatedMatches = useMemo(() => {
        if (data.isMultiCategory && data.categories?.length > 0) {
            return data.categories.reduce((acc: number, cat: any) => {
                return acc + calculateCategoryMatches(
                    cat.format || data.format, 
                    cat.maxTeams || 0, 
                    cat.rrType || data.rrType, 
                    cat.groupSize || data.groupSize
                );
            }, 0);
        }
        return calculateCategoryMatches(data.format, data.maxTeams || 0, data.rrType, data.groupSize);
    }, [data.maxTeams, data.format, data.rrType, data.groupSize, data.isMultiCategory, data.categories]);

    const validateAmericanoMultipleOf4 = () => {
        if (data.isMultiCategory) {
            for (const cat of (data.categories || [])) {
                if ((cat.format === 'AMERICANO' || cat.format === 'MEXICANO') && (!cat.maxTeams || cat.maxTeams % 4 !== 0)) {
                    return { isValid: false, message: `Category "${cat.name}" is set to Americano/Mexicano, so Maximum Players must be a multiple of 4.` };
                }
            }
        } else {
            if ((data.format === 'AMERICANO' || data.format === 'MEXICANO') && (!data.maxTeams || data.maxTeams % 4 !== 0)) {
                return { isValid: false, message: "For Americano/Mexicano format, Maximum Players must be a multiple of 4." };
            }
        }
        return { isValid: true };
    };

    const handleCreateOrUpdate = async () => {
        if (isSubmitting) return;

        const validation = validateAmericanoMultipleOf4();
        if (!validation.isValid) {
            alert(validation.message);
            return;
        }

        // Check if adequate credits available before creating new tournament
        if (!initialData && auth.currentUser) {
             const creditsRequired = calculatedMatches;
             const remaining = orgCredits?.matchCreditsRemaining || 0;
             if (creditsRequired > remaining) {
                 toast.error("Not enough match credits", `This tournament needs ${creditsRequired} credits, but you only have ${remaining}. Reduce the team count or upgrade your package.`);
                 return;
             }
        }

        setIsSubmitting(true);
        try {
            // Safety check for courts input
            const courtsInput = data.courts || "";
            const courtsArray = typeof courtsInput === 'string' 
                ? courtsInput.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
                : Array.isArray(courtsInput) ? courtsInput : [];
                
            const finalCourts = courtsArray;

            let finalVenue = data.venue;
            if (data.multipleVenues && data.venueIds && data.venueIds.length > 0) {
                const selectedNames = venues
                    .filter(v => data.venueIds.includes(v.id))
                    .map(v => v.name);
                if (selectedNames.length > 1) {
                    finalVenue = `${selectedNames.length} Venues`;
                } else if (selectedNames.length === 1) {
                    finalVenue = selectedNames[0];
                }
            }

            const payload = { 
                ...data, 
                courts: finalCourts,
                venue: finalVenue,
                organizerId: auth.currentUser?.uid || '',
                organizerEmail: auth.currentUser?.email || '',
                adminTag: initialData?.adminTag || auth.currentUser?.email || ''
            };

            if (initialData) {
                await updateTournament(initialData.id, payload);
                onCreate(initialData.id);
            } else {
                 if (auth.currentUser) {
                     // Deduct credits if real database is connected
                     const deductionSuccess = await deductOrganiserCredits(auth.currentUser.uid, calculatedMatches);
                     if (deductionSuccess) {
                        const id = await createTournament(payload);
                        onCreate(id);
                     } else {
                         toast.error("Couldn't deduct match credits", "You may have run out of credits while creating this tournament.");
                     }
                 } else {
                    const id = await createTournament(payload);
                    onCreate(id);
                 }
            }
        } catch (err) {
            console.error("Failed to save tournament:", err);
            toast.error("Couldn't save this tournament", "Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSponsorUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const url = await uploadSystemImage('sponsors', e.target.files[0]);
                setNewSponsor(prev => ({ ...prev, logo: url }));
            } catch (error) {
                console.error("Upload error:", error);
                alert("Failed to upload sponsor image.");
            }
        }
    };

    const addSponsor = () => {
        if (!newSponsor.logo) return;
        setData((prev: any) => ({
            ...prev,
            sponsors: [...prev.sponsors, { 
                id: Math.random().toString(36).substr(2,9),
                name: 'Sponsor', // Can add name field if needed later
                logo: newSponsor.logo,
                tier: newSponsor.tier 
            }]
        }));
        setNewSponsor({ logo: '', tier: SponsorTier.SILVER }); // Reset
    };

    const removeSponsor = (index: number) => {
        setData((prev: any) => ({
            ...prev,
            sponsors: prev.sponsors.filter((_: any, i: number) => i !== index)
        }));
    };

    const getTierIcon = (tier: SponsorTier) => {
        switch(tier) {
            case SponsorTier.TITLE: return <Crown size={14} className="text-yellow-400" />;
            case SponsorTier.PLATINUM: return <Gem size={14} className="text-[#4D78FF]" />;
            case SponsorTier.GOLD: return <Star size={14} className="text-[#E65C31]" />;
            case SponsorTier.SILVER: return <Medal size={14} className="text-gray-400" />;
        }
    };

    return (
        <div className="space-y-6">
            {/* Step Indicator */}
            <div className="flex items-center gap-3 mb-8">
                {[1, 2, 3, 4].map((s) => (
                    <div key={s} className="flex-1 flex flex-col gap-2">
                        <div className={`h-1.5 rounded-full transition-all duration-500 ${step >= s ? 'bg-brand shadow-[0_0_8px_rgba(230,126,80,0.4)]' : 'bg-white/10'}`} />
                        <span className={`text-[10px] font-bold uppercase tracking-widest text-center ${step === s ? 'text-brand' : 'text-content-muted'}`}>
                            {s === 1 ? 'General' : s === 2 ? 'Format' : s === 3 ? 'Pricing' : 'Assets'}
                        </span>
                    </div>
                ))}
            </div>

            {step === 1 ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex gap-4 items-end">
                        <div className="flex-1">
                            <Input label="Tournament Name" value={data.name} onChange={(v: string) => setData({...data, name: v})} />
                        </div>
                        <div className="w-24">
                            <label className="block text-content-secondary text-sm mb-1 font-medium">Brand Logo</label>
                            <div 
                                onClick={() => document.getElementById('logoUpload')?.click()}
                                className="w-20 h-20 bg-surface-ground border border-dashed border-white/20 rounded-xl flex items-center justify-center cursor-pointer hover:border-brand transition-all overflow-hidden"
                            >
                                {data.organizerLogo ? <img src={data.organizerLogo} className="w-full h-full object-cover" /> : <ImageIcon size={20} className="text-content-muted" />}
                            </div>
                            <input type="file" id="logoUpload" className="hidden" accept="image/*" onChange={async (e) => {
                                if (e.target.files && e.target.files[0]) {
                                    const url = await uploadSystemImage('logos', e.target.files[0]);
                                    setData({...data, organizerLogo: url});
                                }
                            }} />
                        </div>
                    </div>

                    <div className="bg-surface-ground p-5 rounded-2xl border border-white/10 space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-white font-bold text-sm uppercase tracking-wider">Venue Configuration</label>
                            <div className="flex bg-surface-panel p-1 rounded-lg">
                                <button 
                                    onClick={() => setData({...data, multipleVenues: false})}
                                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${!data.multipleVenues ? 'bg-brand text-content-inverse' : 'text-content-muted hover:text-white'}`}
                                >
                                    Single
                                </button>
                                <button 
                                    onClick={() => setData({...data, multipleVenues: true})}
                                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${data.multipleVenues ? 'bg-brand text-content-inverse' : 'text-content-muted hover:text-white'}`}
                                >
                                    Multiple
                                </button>
                            </div>
                        </div>

                        {!data.multipleVenues && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
                                <div>
                                    <label className="block text-content-secondary text-sm mb-1 font-medium">Main Venue</label>
                                    <select 
                                        className="w-full bg-surface-panel p-3 rounded-xl text-white border border-white/10 focus:border-brand outline-none transition-all focus:ring-1 focus:ring-brand shadow-inner" 
                                        value={data.venue} 
                                        onChange={(e) => {
                                            const selectedVenue = venues.find(v => v.name === e.target.value);
                                            setData({...data, venue: e.target.value, city: selectedVenue?.city || data.city, venueId: selectedVenue?.id || ''});
                                        }}
                                    >
                                        <option value="">Select a Venue</option>
                                        {venues.map(v => (
                                            <option key={v.id} value={v.name}>{v.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-content-secondary text-sm mb-1 font-medium">City</label>
                                    <select 
                                        className="w-full bg-surface-panel p-3 rounded-xl text-white border border-white/10 focus:border-brand outline-none transition-all focus:ring-1 focus:ring-brand shadow-inner" 
                                        value={data.city || ''} 
                                        onChange={(e) => setData({...data, city: e.target.value})}
                                    >
                                        <option value="">Select City</option>
                                        <option value="Karachi">Karachi</option>
                                        <option value="Islamabad">Islamabad</option>
                                        <option value="Karachi">Karachi</option>
                                        <option value="Faisalabad">Faisalabad</option>
                                        <option value="Multan">Multan</option>
                                        <option value="Sialkot">Sialkot</option>
                                        <option value="Peshawar">Peshawar</option>
                                        <option value="Quetta">Quetta</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {data.multipleVenues && (
                            <div className="space-y-3 animate-in fade-in duration-300">
                                <label className="block text-content-secondary text-sm font-bold uppercase tracking-wider">Tournament Venues</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {venues.map(v => {
                                        const isSelected = (data.venueIds || []).includes(v.id);
                                        return (
                                            <div 
                                                key={v.id}
                                                onClick={() => {
                                                    const currentVenues = data.venueIds || [];
                                                    const isSelected = currentVenues.includes(v.id);
                                                    const nextVenues = isSelected 
                                                        ? currentVenues.filter((id: string) => id !== v.id)
                                                        : [...currentVenues, v.id];
                                                    setData({...data, venueIds: nextVenues});
                                                }}
                                                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                                                    isSelected 
                                                    ? 'border-brand bg-brand/10 text-white shadow-lg shadow-brand/10' 
                                                    : 'border-white/10 text-content-muted hover:border-white/20 hover:bg-white/5'
                                                }`}
                                            >
                                                <span className="text-sm font-medium">{v.name}</span>
                                                {isSelected && <Check size={16} className="text-brand" />}
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="text-[10px] text-content-muted font-bold tracking-widest uppercase">{(data.venueIds || []).length} Venues Selected</p>
                            </div>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input 
                            label="Start Date & Time" 
                            type="datetime-local" 
                            value={data.startDate || ''} 
                            onChange={(v: string) => setData({...data, startDate: v})}
                        />
                        <Input 
                            label="End Date & Time" 
                            type="datetime-local" 
                            value={data.endDate || ''} 
                            onChange={(v: string) => setData({...data, endDate: v})}
                        />
                    </div>
                    
                    <button onClick={() => setStep(2)} className="w-full bg-brand hover:bg-brand-light text-content-inverse py-4 rounded-xl mt-4 font-bold transition-all shadow-lg shadow-brand/20 active:scale-[0.98]">Next: Setup Formats</button>
                </div>
            ) : step === 2 ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="flex items-center justify-between p-5 bg-surface-elevated/50 rounded-2xl border border-white/10">
                        <div>
                            <h3 className="text-white font-bold">Multi-Category Tournament</h3>
                            <p className="text-xs text-content-secondary">Create separate tiers (e.g. Pro, Intermediate)</p>
                        </div>
                        <button 
                            onClick={() => setData({...data, isMultiCategory: !data.isMultiCategory})}
                            className={`w-12 h-6 rounded-full transition-all relative ${data.isMultiCategory ? 'bg-brand' : 'bg-white/10'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${data.isMultiCategory ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>

                    {data.isMultiCategory ? (
                        <div className="space-y-3 bg-surface-ground p-5 rounded-2xl border border-white/10">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-brand font-bold text-[10px] uppercase tracking-widest">Categories List</label>
                                <button 
                                    onClick={() => setShowAddCategory(true)}
                                    className="p-1.5 px-3 bg-brand/10 text-brand text-xs font-bold rounded-lg hover:bg-brand/20 transition-all flex items-center gap-1 border border-brand/20"
                                >
                                    <Plus size={14}/> Add Category
                                </button>
                            </div>

                            {showAddCategory && (
                                <div className="fixed inset-0 z-[60] flex justify-center pt-20 bg-black/80 backdrop-blur-sm">
                                    <div className="bg-[#15181e] w-full max-w-sm rounded-2xl border border-white/10 shadow-2xl p-6 h-fit">
                                        <h3 className="text-white font-bold text-lg mb-4">Add Category</h3>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-content-secondary text-sm mb-1 font-medium">Select Skill Level or Custom</label>
                                                <select 
                                                    autoFocus
                                                    className="w-full bg-[#0a0a0a] p-3 rounded-xl text-white border border-white/10 focus:border-brand outline-none" 
                                                    value={isCustomCategory ? 'CUSTOM' : newCategoryName} 
                                                    onChange={(e) => {
                                                        if (e.target.value === 'CUSTOM') {
                                                            setIsCustomCategory(true);
                                                        } else {
                                                            setIsCustomCategory(false);
                                                            setNewCategoryName(e.target.value);
                                                        }
                                                    }} 
                                                >
                                                    {Object.values(SkillLevel).map(v => <option key={v} value={v}>{v}</option>)}
                                                    <option value="CUSTOM">Custom Category...</option>
                                                </select>
                                                
                                                {isCustomCategory && (
                                                    <div className="mt-4">
                                                        <label className="block text-content-secondary text-sm mb-1 font-medium">Custom Category Name</label>
                                                        <input 
                                                            autoFocus
                                                            type="text" 
                                                            className="w-full bg-[#0a0a0a] p-3 rounded-xl text-white border border-white/10 focus:border-brand outline-none" 
                                                            placeholder="e.g. Mixed Doubles" 
                                                            value={customCategoryValue} 
                                                            onChange={(e) => setCustomCategoryValue(e.target.value)} 
                                                        />
                                                    </div>
                                                )}
                                                
                                                <p className="text-xs text-content-muted mt-2">This will become the name of the new category.</p>
                                            </div>
                                            <div className="flex gap-3 pt-2">
                                                <button onClick={() => setShowAddCategory(false)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-colors">Cancel</button>
                                                <button 
                                                    onClick={() => {
                                                        const finalName = isCustomCategory ? (customCategoryValue || 'Custom') : newCategoryName;
                                                        const finalSkillLevel = isCustomCategory ? SkillLevel.OPEN : newCategoryName;
                                                        const newCat = {
                                                            id: Math.random().toString(36).substr(2, 9),
                                                            name: finalName,
                                                            skillLevel: finalSkillLevel,
                                                            maxTeams: 8,
                                                            entryFee: data.entryFee || 5000,
                                                            prizeMoney: data.prizeMoney || 1000,
                                                            format: data.format || TournamentFormat.SINGLE_ELIMINATION,
                                                            rrType: data.rrType || RoundRobinType.SINGLE,
                                                            groupSize: data.groupSize || 4,
                                                            venue: data.venue,
                                                            venueId: data.venueId || (data.venueIds?.[0] || ''),
                                                            courts: []
                                                        };
                                                        setData({...data, categories: [...(data.categories || []), newCat]});
                                                        setShowAddCategory(false);
                                                        setIsCustomCategory(false);
                                                        setCustomCategoryValue('');
                                                    }}
                                                    className="flex-1 py-3 bg-brand hover:bg-brand-light text-content-inverse rounded-xl font-bold transition-colors shadow-lg shadow-brand/20"
                                                >
                                                    Add Category
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {(data.categories || []).map((cat: any, idx: number) => (
                                <div key={cat.id} className="bg-surface-panel p-4 rounded-xl border border-white/5 flex items-center justify-between group">
                                    <div className="flex-1">
                                        <input 
                                            className="bg-transparent text-white font-bold outline-none focus:text-brand transition-colors w-full" 
                                            value={cat.name} 
                                            onChange={(e) => {
                                                const newCats = [...data.categories];
                                                newCats[idx].name = e.target.value;
                                                setData({...data, categories: newCats});
                                            }}
                                        />
                                        <p className="text-[10px] text-content-muted font-bold uppercase tracking-widest mt-1">Tier {idx + 1}</p>
                                    </div>
                                    <button onClick={() => setData({...data, categories: data.categories.filter((_: any, i: number) => i !== idx)})} className="p-2 text-content-muted hover:text-accent-error transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={18}/></button>
                                </div>
                            ))}
                            {(!data.categories || data.categories.length === 0) && (
                                <div className="py-8 text-center border border-dashed border-white/10 rounded-xl">
                                    <p className="text-content-muted text-sm italic">Add at least one category to proceed</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <Input label="Organized By (Optional)" value={data.organizer} onChange={(v: string) => setData({...data, organizer: v})} />
                            
                            <div>
                                <label className="block text-content-secondary text-sm mb-1 font-medium">Format</label>
                                <select className="w-full bg-surface-ground p-3 rounded-xl text-white border border-white/10 focus:border-brand outline-none transition-all focus:ring-1 focus:ring-brand shadow-inner" value={data.format} onChange={(e) => {
                                    const newFmt = e.target.value as any;
                                    setData({...data, format: newFmt, rrType: newFmt === 'GROUP_TO_KNOCKOUT' ? RoundRobinType.GROUP_SINGLE : (data.rrType || RoundRobinType.SINGLE)});
                                }}>
                                    <option value="SINGLE_ELIMINATION">Single Elimination</option>
                                    <option value="DOUBLE_ELIMINATION">Double Elimination</option>
                                    <option value="ROUND_ROBIN">Round Robin</option>
                                    <option value="GROUP_TO_KNOCKOUT">Group Stage + Knockout</option>
                                    <option value="AMERICANO">Americano</option>
                                    <option value="MEXICANO">Mexicano</option>
                                </select>
                            </div>
                            {(data.format === 'ROUND_ROBIN' || data.format === 'GROUP_TO_KNOCKOUT') && (
                                <div className="grid grid-cols-2 gap-4 bg-surface-ground p-4 rounded-xl border border-white/5">
                                    <div>
                                        <label className="block text-content-secondary text-sm mb-1 font-medium">Type</label>
                                        <select className="w-full bg-surface-panel p-3 rounded-xl text-white border border-white/10 outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all" value={data.rrType} onChange={(e) => setData({...data, rrType: e.target.value as any})}>
                                            {data.format === 'ROUND_ROBIN' && (
                                                <>
                                                    <option value="SINGLE">Single RR (Play once)</option>
                                                    <option value="DOUBLE">Double RR (Play twice)</option>
                                                </>
                                            )}
                                            <option value="GROUP_SINGLE">Group RR (Play once)</option>
                                            <option value="GROUP_DOUBLE">Group RR (Play twice)</option>
                                        </select>
                                    </div>
                                    {(data.rrType === 'GROUP_SINGLE' || data.rrType === 'GROUP_DOUBLE') && (
                                        <Input label="Teams per Group" type="number" value={data.groupSize} onChange={(v: string) => setData({...data, groupSize: parseInt(v)})} />
                                    )}
                                </div>
                            )}
                            
                            <div>
                                <label className="block text-content-secondary text-sm mb-1 font-medium">Skill Level</label>
                                <select className="w-full bg-surface-ground p-3 rounded-xl text-white border border-white/10 focus:border-brand outline-none transition-all focus:ring-1 focus:ring-brand" value={data.skillLevel} onChange={(e) => setData({...data, skillLevel: e.target.value as any})}>
                                    {Object.values(SkillLevel).map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-4">
                        <button onClick={() => setStep(1)} className="flex-1 bg-white/5 hover:bg-white/10 text-white py-4 rounded-xl font-bold transition-all border border-white/10">Back</button>
                        <button 
                            disabled={data.isMultiCategory && (!data.categories || data.categories.length === 0)}
                            onClick={() => setStep(3)} 
                            className="flex-[2] bg-brand hover:bg-brand-light disabled:opacity-50 text-content-inverse py-4 rounded-xl font-bold transition-all shadow-lg shadow-brand/20"
                        >
                            Next: Configure Pricing
                        </button>
                    </div>
                </div>
            ) : step === 3 ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    {!initialData && (
                        <div className="bg-brand/10 border border-brand/20 p-5 rounded-2xl flex flex-col gap-3">
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-brand/20 rounded-lg shrink-0">
                                    <Database className="text-brand" size={24} />
                                </div>
                                <div className="w-full">
                                    <h4 className="text-white font-bold text-sm mb-1">Total Match Credits Calculation</h4>
                                    <p className="text-content-secondary text-xs mb-4">
                                        Aggregated matches across {data.isMultiCategory ? (data.categories?.length || 0) : '1'} category: <strong className="text-brand font-bold text-lg">{calculatedMatches}</strong>
                                    </p>
                                    <div className="w-full bg-black/40 rounded-full h-2.5 overflow-hidden border border-white/5 flex">
                                        <div 
                                           className="h-full bg-white/30 transition-all duration-300"
                                           style={{ width: `${Math.min(100, ((orgCredits?.matchCreditsUsed || 0) / Math.max(1, (orgCredits?.matchCreditsRemaining || 0) + (orgCredits?.matchCreditsUsed || 0))) * 100)}%` }}
                                        />
                                        <div 
                                           className={`h-full transition-all duration-300 ${calculatedMatches > (orgCredits?.matchCreditsRemaining || 0) ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse' : 'bg-brand rounded-r-sm'}`} 
                                           style={{ width: `${Math.min(100, (calculatedMatches / Math.max(1, (orgCredits?.matchCreditsRemaining || 0) + (orgCredits?.matchCreditsUsed || 0))) * 100)}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between mt-2 text-[10px] text-content-muted font-bold tracking-widest uppercase">
                                        <span>{(orgCredits?.matchCreditsUsed || 0) + calculatedMatches} ESTIMATED TOTAL</span>
                                        <span>{(orgCredits?.matchCreditsRemaining || 0) + (orgCredits?.matchCreditsUsed || 0)} OWNER LIMIT</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {data.isMultiCategory ? (
                        <div className="space-y-4">
                            <label className="text-white font-bold text-sm uppercase tracking-wider block">Category Details</label>
                            {(data.categories || []).map((cat: any, idx: number) => (
                                <div key={cat.id} className="bg-surface-elevated/40 p-5 rounded-2xl border border-white/10 space-y-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center text-brand font-bold text-sm">
                                            {idx + 1}
                                        </div>
                                        <h4 className="text-white font-bold">{cat.name}</h4>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Input 
                                                label={(cat.format === 'AMERICANO' || cat.format === 'MEXICANO') ? "Max Players (Multiple of 4)" : "Max Teams"} 
                                                type="number" 
                                                value={cat.maxTeams} 
                                                onChange={(v: string) => {
                                                    const newCats = [...data.categories];
                                                    newCats[idx].maxTeams = parseInt(v);
                                                    setData({...data, categories: newCats});
                                                }} 
                                                className={((cat.format === 'AMERICANO' || cat.format === 'MEXICANO') && (!cat.maxTeams || cat.maxTeams % 4 !== 0)) ? "border-red-500 focus:border-red-500 focus:ring-red-500 text-red-500 bg-red-500/10" : ""}
                                            />
                                            {(cat.format === 'AMERICANO' || cat.format === 'MEXICANO') && (!cat.maxTeams || cat.maxTeams % 4 !== 0) && (
                                                <p className="text-red-500 text-[10px] font-bold mt-1">Must be multiple of 4.</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-content-secondary text-sm mb-1 font-medium">Level</label>
                                            <select className="w-full bg-surface-ground text-sm text-white p-3 rounded-xl border border-white/10" value={cat.skillLevel} onChange={(e) => {
                                                const newCats = [...data.categories];
                                                newCats[idx].skillLevel = e.target.value;
                                                setData({...data, categories: newCats});
                                            }}>
                                                {Object.values(SkillLevel).map(v => <option key={v} value={v}>{v}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <Input label="Entry Fee" type="number" value={cat.entryFee} onChange={(v: string) => {
                                            const newCats = [...data.categories];
                                            newCats[idx].entryFee = parseInt(v);
                                            setData({...data, categories: newCats});
                                        }} icon={data.currency === 'USD' ? <DollarSign size={14}/> : 'Rs'} />
                                        <Input label="Prize Pool" type="number" value={cat.prizeMoney} onChange={(v: string) => {
                                            const newCats = [...data.categories];
                                            newCats[idx].prizeMoney = parseInt(v);
                                            setData({...data, categories: newCats});
                                        }} icon={data.currency === 'USD' ? <DollarSign size={14}/> : 'Rs'} />
                                    </div>
                                    
                                    <div className="space-y-4 pt-2 border-t border-white/5">
                                        <label className="text-white font-bold text-xs uppercase tracking-wider block">Scheduling & Advanced</label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <Input 
                                                label="Slot Duration (min)" 
                                                type="number" 
                                                value={cat.slotDuration || 60} 
                                                onChange={(v: string) => {
                                                    const newCats = [...data.categories];
                                                    newCats[idx].slotDuration = parseInt(v);
                                                    setData({...data, categories: newCats});
                                                }} 
                                            />
                                            <Input 
                                                label="Buffer Time (min)" 
                                                type="number" 
                                                value={cat.bufferTime || 10} 
                                                onChange={(v: string) => {
                                                    const newCats = [...data.categories];
                                                    newCats[idx].bufferTime = parseInt(v);
                                                    setData({...data, categories: newCats});
                                                }} 
                                            />
                                        </div>
                                        {cat.format === 'ROUND_ROBIN' && (cat.rrType === 'GROUP_SINGLE' || cat.rrType === 'GROUP_DOUBLE') && (
                                            <Input 
                                                label="Advance to Knockout (Teams per group)" 
                                                type="number" 
                                                value={cat.advanceCount || 2} 
                                                onChange={(v: string) => {
                                                    const newCats = [...data.categories];
                                                    newCats[idx].advanceCount = parseInt(v);
                                                    setData({...data, categories: newCats});
                                                }} 
                                            />
                                        )}
                                        <label className="text-white font-bold text-xs uppercase tracking-wider block">Format Configuration</label>
                                        <div>
                                            <label className="block text-content-secondary text-sm mb-1 font-medium">Format</label>
                                            <select className="w-full bg-surface-ground text-sm text-white p-3 rounded-xl border border-white/10" value={cat.format} onChange={(e) => {
                                                const newCats = [...data.categories];
                                                newCats[idx].format = e.target.value;
                                                if (e.target.value === 'GROUP_TO_KNOCKOUT') {
                                                    newCats[idx].rrType = RoundRobinType.GROUP_SINGLE;
                                                }
                                                setData({...data, categories: newCats});
                                            }}>
                                                <option value="SINGLE_ELIMINATION">Single Elimination</option>
                                                <option value="DOUBLE_ELIMINATION">Double Elimination</option>
                                                <option value="ROUND_ROBIN">Round Robin</option>
                                                <option value="GROUP_TO_KNOCKOUT">Group Stage + Knockout</option>
                                                <option value="AMERICANO">Americano</option>
                                                <option value="MEXICANO">Mexicano</option>
                                            </select>
                                        </div>
                                        {(cat.format === 'ROUND_ROBIN' || cat.format === 'GROUP_TO_KNOCKOUT') && (
                                            <div className="space-y-4 bg-surface-ground p-4 rounded-xl border border-white/5">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-content-secondary text-sm mb-1 font-medium">Type</label>
                                                        <select className="w-full bg-surface-panel p-2 rounded-xl text-white border border-white/10 outline-none focus:border-brand" value={cat.rrType} onChange={(e) => {
                                                            const newCats = [...data.categories];
                                                            newCats[idx].rrType = e.target.value;
                                                            setData({...data, categories: newCats});
                                                        }}>
                                                            {cat.format === 'ROUND_ROBIN' && (
                                                                <>
                                                                    <option value="SINGLE">Single RR</option>
                                                                    <option value="DOUBLE">Double RR</option>
                                                                </>
                                                            )}
                                                            <option value="GROUP_SINGLE">Group Single RR</option>
                                                            <option value="GROUP_DOUBLE">Group Double RR</option>
                                                        </select>
                                                    </div>
                                                    {(cat.rrType === 'GROUP_SINGLE' || cat.rrType === 'GROUP_DOUBLE') && (
                                                        <Input label="Teams per Group" type="number" value={cat.groupSize} onChange={(v: string) => {
                                                            const newCats = [...data.categories];
                                                            newCats[idx].groupSize = parseInt(v);
                                                            setData({...data, categories: newCats});
                                                        }} />
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/5 pt-4">
                                                    <div>
                                                        <Input label="Group Points (Win)" type="number" value={cat.pointsForWin || 2} onChange={(v: string) => {
                                                            const newCats = [...data.categories];
                                                            newCats[idx].pointsForWin = parseInt(v) || 0;
                                                            setData({...data, categories: newCats});
                                                        }}/>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {data.multipleVenues && (
                                        <div>
                                            <label className="block text-content-secondary text-sm mb-1 font-medium">Venue</label>
                                            <select 
                                                className="w-full bg-surface-ground text-sm text-white p-3 rounded-xl border border-white/10 outline-none focus:border-brand" 
                                                value={cat.venueId} 
                                                onChange={(e) => {
                                                    const v = venues.find(vn => vn.id === e.target.value);
                                                    const newCats = [...data.categories];
                                                    newCats[idx].venueId = e.target.value;
                                                    newCats[idx].venue = v?.name;
                                                    setData({...data, categories: newCats});
                                                }}
                                            >
                                                <option value="">Select Venue</option>
                                                {venues.filter(v => (data.venueIds || []).includes(v.id)).map(v => (
                                                    <option key={v.id} value={v.id}>{v.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                       <label className="text-[10px] text-content-muted font-bold uppercase block tracking-widest">Available Courts</label>
                                       <CourtPicker 
                                          venue={venues.find(v => v.id === (cat.venueId || (data.multipleVenues ? data.venueIds?.[0] : data.venueId)))}
                                          selectedCourts={cat.courts || []}
                                          onChange={(courts) => {
                                              const newCats = [...data.categories];
                                              newCats[idx].courts = courts;
                                              setData({...data, categories: newCats});
                                          }}
                                       />
                                       <div 
                                          onClick={() => document.getElementById(`catBannerDetail_${cat.id}`)?.click()}
                                          className="w-full h-24 bg-black/30 border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center cursor-pointer overflow-hidden group hover:border-brand transition-all"
                                       >
                                          {cat.bannerUrl ? <img src={cat.bannerUrl} className="w-full h-full object-cover" /> : <><ImageIcon size={20} className="text-content-muted group-hover:text-brand mb-1"/><span className="text-[10px] text-content-muted font-bold uppercase tracking-tighter">Category Banner</span></>}
                                       </div>
                                       <input type="file" id={`catBannerDetail_${cat.id}`} className="hidden" accept="image/*" onChange={async (e) => {
                                            if (e.target.files && e.target.files[0]) {
                                                const url = await uploadSystemImage('categories', e.target.files[0]);
                                                const newCats = [...data.categories];
                                                newCats[idx].bannerUrl = url;
                                                setData({...data, categories: newCats});
                                            }
                                       }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-5 animate-in fade-in duration-300">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div>
                                     <Input 
                                         label={(data.format === 'AMERICANO' || data.format === 'MEXICANO') ? "Maximum Players (Must be multiple of 4)" : "Max Teams"} 
                                         type="number" 
                                         value={data.maxTeams} 
                                         onChange={(v: string) => setData({...data, maxTeams: parseInt(v)})}
                                         className={((data.format === 'AMERICANO' || data.format === 'MEXICANO') && (!data.maxTeams || data.maxTeams % 4 !== 0)) ? "border-red-500 focus:border-red-500 focus:ring-red-500 text-red-500 bg-red-500/10 placeholder-red-400" : ""}
                                     />
                                     {(data.format === 'AMERICANO' || data.format === 'MEXICANO') && (!data.maxTeams || data.maxTeams % 4 !== 0) && (
                                         <p className="text-red-500 text-xs font-bold mt-1">Error: Maximum Players must be a multiple of 4 for perfect partner rotation.</p>
                                     )}
                                 </div>
                                 <div>
                                     <label className="block text-content-secondary text-sm mb-1 font-medium">Currency</label>
                                     <select className="w-full bg-surface-ground p-3 rounded-xl text-white border border-white/10 focus:border-brand outline-none transition-all" value={data.currency} onChange={(e) => setData({...data, currency: e.target.value})}>
                                         <option value="PKR">PKR (Rs)</option>
                                         <option value="USD">USD ($)</option>
                                     </select>
                                 </div>
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input 
                                    label="Entry Fee" 
                                    type="number" 
                                    value={data.entryFee} 
                                    onChange={(v: string) => setData({...data, entryFee: parseInt(v)})} 
                                    icon={data.currency === 'USD' ? <DollarSign size={16}/> : <span className="text-xs font-bold text-content-muted uppercase">Rs</span>} 
                                />
                                <Input 
                                    label="Prize Pool" 
                                    type="number" 
                                    value={data.prizeMoney} 
                                    onChange={(v: string) => setData({...data, prizeMoney: parseInt(v)})} 
                                    icon={data.currency === 'USD' ? <DollarSign size={16}/> : <span className="text-xs font-bold text-content-muted uppercase">Rs</span>} 
                                />
                             </div>
                             <div className="bg-surface-elevated/40 p-5 rounded-2xl border border-white/10 space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="block text-content-secondary text-sm font-bold uppercase tracking-wider">Court Selection</label>
                                    {data.multipleVenues && data.venueIds && data.venueIds.length > 0 && (
                                        <select 
                                            className="bg-surface-panel text-xs text-brand font-bold py-1 px-2 rounded border border-brand/20 outline-none"
                                            value={data.activeVenueForCourts || data.venueIds[0]}
                                            onChange={(e) => setData({...data, activeVenueForCourts: e.target.value})}
                                        >
                                            {venues.filter(v => (data.venueIds || []).includes(v.id)).map(v => (
                                                <option key={v.id} value={v.id}>{v.name}</option>
                                            ))}
                                        </select>
                                    )}
                                 </div>
                                <CourtPicker 
                                    venue={venues.find(v => v.id === (data.activeVenueForCourts || (data.multipleVenues ? data.venueIds?.[0] : data.venueId)))}
                                    selectedCourts={typeof data.courts === 'string' ? data.courts.split(',').map((s: any) => s.trim()).filter(Boolean) : (data.courts || [])}
                                    onChange={(courts) => setData({...data, courts: courts})}
                                />
                                <p className="text-[10px] text-content-muted font-bold tracking-widest uppercase">Selected: {(Array.isArray(data.courts) ? data.courts : (data.courts || '').split(',')).filter(Boolean).join(', ') || 'None'}</p>
                             </div>
                             
                             <div className="border-t border-white/5 pt-4">
                                <label className="block text-content-secondary text-sm font-bold uppercase tracking-wider mb-4">Scheduling & Advanced Config</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <Input label="Slot Duration (min)" type="number" value={data.slotDuration || 30} onChange={(v: string) => setData({...data, slotDuration: parseInt(v)})} />
                                    <Input label="Buffer Time (min)" type="number" value={data.bufferTime || 10} onChange={(v: string) => setData({...data, bufferTime: parseInt(v)})} />
                                </div>
                                {(data.format === 'ROUND_ROBIN' || data.format === 'GROUP_TO_KNOCKOUT') && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                        <Input label="Group Points (Win)" type="number" value={data.pointsForWin || 2} onChange={(v: string) => setData({...data, pointsForWin: parseInt(v)})} />
                                    </div>
                                )}
                             </div>
                        </div>
                    )}

                    <div className="flex gap-4">
                        <button onClick={() => setStep(2)} className="flex-1 bg-white/5 hover:bg-white/10 text-white py-4 rounded-xl font-bold transition-all border border-white/10">Back</button>
                        <button 
                            onClick={() => {
                                const validation = validateAmericanoMultipleOf4();
                                if (!validation.isValid) {
                                    alert(validation.message);
                                    return;
                                }
                                setStep(4);
                            }} 
                            className="flex-[2] bg-brand hover:bg-brand-light text-content-inverse py-4 rounded-xl font-bold transition-all shadow-lg shadow-brand/20"
                        >
                            Next: Finalize Assets
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="bg-surface-ground p-5 rounded-2xl border border-white/10 space-y-6">
                        <Input label="Referee Passcode" placeholder="Used by referees to score matches" value={data.refereePasscode} onChange={(v: string) => setData({...data, refereePasscode: v})} />
                        
                        <div>
                            <label className="block text-content-secondary text-sm mb-3 font-bold uppercase tracking-wider">Tournament Main Banner</label>
                            <div 
                                onClick={() => document.getElementById('finalBannerUpload')?.click()}
                                className="w-full h-40 border border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center text-content-muted hover:text-white hover:border-brand cursor-pointer bg-black/20 transition-all hover:bg-black/40 overflow-hidden relative"
                            >
                                {data.bannerUrl ? <img src={data.bannerUrl} className="w-full h-full object-cover" /> : <><ImageIcon size={32} className="mb-2"/><span className="text-xs font-medium">Upload Banner Image (16:9)</span></>}
                                {data.bannerUrl && <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity"><ImageIcon size={24} className="text-white"/></div>}
                            </div>
                            <input type="file" id="finalBannerUpload" className="hidden" accept="image/*" onChange={async (e) => {
                                if (e.target.files && e.target.files[0]) {
                                    const url = await uploadSystemImage('banners', e.target.files[0]);
                                    setData({...data, bannerUrl: url});
                                }
                            }} />
                        </div>

                        <div>
                            <label className="block text-content-secondary text-sm mb-3 font-bold uppercase tracking-wider">Configure Sponsors</label>
                            <div className="flex gap-4 mb-4">
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-24 h-24 border border-dashed border-white/20 rounded-2xl flex items-center justify-center text-content-muted hover:text-white hover:border-brand cursor-pointer bg-black/20 transition-all hover:bg-black/40 overflow-hidden"
                                >
                                    {newSponsor.logo ? <img src={newSponsor.logo} className="w-full h-full object-contain p-2" /> : <Plus size={32}/>}
                                </div>
                                <div className="flex-1 space-y-3">
                                    <select 
                                        className="w-full bg-surface-panel text-white border border-white/10 rounded-xl p-3 text-sm focus:border-brand outline-none transition-all shadow-inner"
                                        value={newSponsor.tier}
                                        onChange={(e) => setNewSponsor({...newSponsor, tier: e.target.value as SponsorTier})}
                                    >
                                        <option value={SponsorTier.SILVER}>Silver Tier (80k Credit)</option>
                                        <option value={SponsorTier.GOLD}>Gold Tier (150k Credit)</option>
                                        <option value={SponsorTier.PLATINUM}>Platinum Tier (300k Credit)</option>
                                        <option value={SponsorTier.TITLE}>Title Sponsor (750k Credit)</option>
                                    </select>
                                    <button 
                                        onClick={addSponsor}
                                        disabled={!newSponsor.logo}
                                        className="w-full bg-brand disabled:opacity-50 text-content-inverse text-xs font-bold py-3 rounded-xl hover:bg-brand-light transition-all shadow-md active:translate-y-px"
                                    >
                                        Register Sponsor
                                    </button>
                                </div>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleSponsorUpload} />
                            </div>

                            {data.sponsors?.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-2">
                                    {data.sponsors.map((s: Sponsor, i: number) => (
                                        <div key={s.id} className="relative group bg-surface-panel p-2 rounded-xl border border-white/10 min-w-[60px] h-16 flex items-center justify-center">
                                            <img src={s.logo} className="max-w-full max-h-full object-contain" />
                                            <div className="absolute -top-1 -right-1 bg-brand rounded-full p-0.5 shadow-sm">{getTierIcon(s.tier)}</div>
                                            <button onClick={() => removeSponsor(i)} className="absolute -top-1 -left-1 bg-accent-error text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X size={10}/></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={() => setStep(3)} className="flex-1 bg-white/5 hover:bg-white/10 text-white py-4 rounded-xl font-bold transition-all border border-white/10">Back</button>
                        <button 
                           onClick={handleCreateOrUpdate} 
                           disabled={isSubmitting}
                           className="flex-[2] bg-brand hover:bg-brand-light disabled:opacity-50 text-content-inverse py-4 rounded-xl font-bold transition-all shadow-lg shadow-brand/20 flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? <><Loader2 className="animate-spin" size={20}/> Processing...</> : <><Check size={20}/> {initialData ? 'Update Tournament' : 'Launch Tournament'}</>}
                        </button>
                    </div>
                </div>
            )}
            <button onClick={onCancel} className="w-full py-2 text-content-muted text-xs font-bold uppercase tracking-widest hover:text-white transition-colors">Cancel Tournament Generation</button>
        </div>
    );
};

function Input({ label, value, onChange, type="text", icon, className }: any) {
    return (
        <div>
        <label className="block text-content-secondary text-sm mb-1 font-medium">{label}</label>
        <div className="relative">
            {icon && (
                <div className="absolute left-3 top-0 bottom-0 flex items-center justify-center text-content-muted pointer-events-none min-w-[20px]">
                    {icon}
                </div>
            )}
            <input 
                type={type} 
                className={`w-full bg-surface-ground border border-white/10 rounded-xl p-3 text-white focus:border-brand outline-none transition-all focus:ring-1 focus:ring-brand ${icon ? 'pl-10' : ''} ${className || ''}`} 
                value={value} 
                onChange={e => onChange(e.target.value)} 
            />
        </div>
    </div>
    );
}

const PlayerEditModal = ({ player, playerIndex, team, tId, onClose }: { player: any; playerIndex: 1 | 2; team: Team; tId: string; onClose: () => void }) => {
    const [name, setName] = useState(player.name || '');
    const [isUploading, setIsUploading] = useState(false);
    const [photoUrl, setPhotoUrl] = useState(player.photoUrl || '');
    const [isSaving, setIsSaving] = useState(false);
    
    const hiddenFileInput = useRef<HTMLInputElement>(null);

    const handleUploadClick = () => {
        hiddenFileInput.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validation
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            alert('Images must be smaller than 2MB');
            return;
        }

        setIsUploading(true);
        try {
            const url = await uploadSystemImage('players', file);
            setPhotoUrl(url);
        } catch (error) {
            console.error('Failed to upload image:', error);
            alert('Upload failed');
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemoveImage = () => {
        setPhotoUrl('');
    };

    const handleSave = async () => {
        if (!name.trim()) return;
        setIsSaving(true);
        try {
            const updatedPlayer = { ...player, name: name.trim(), photoUrl };
            const p1 = playerIndex === 1 ? updatedPlayer : team.player1;
            const p2 = playerIndex === 2 ? updatedPlayer : team.player2;
            
            import('../services/storage').then(module => {

               module.updateTeamPlayers(tId, team.id, p1, p2).then(() => {
                   onClose();
               }).catch(e => {
                   console.error(e);
                   toast.error("Couldn't save player changes", "Please try again.");
                   setIsSaving(false);
               })
            });
        } catch (error) {
            console.error('Failed to update player:', error);
            toast.error("Couldn't save player changes", "Please try again.");
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-[#020617]/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface-dark border border-white/10 rounded-2xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl">
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#111]">
                    <h3 className="font-bold text-white uppercase tracking-widest text-sm">Edit Player {playerIndex}</h3>
                    <button onClick={onClose} className="p-2 text-content-muted hover:text-white transition-colors bg-white/5 rounded-lg"><X size={16} /></button>
                </div>
                <div className="p-6 space-y-6">
                    <div>
                        <label className="block text-content-secondary text-xs uppercase font-bold tracking-wider mb-2">Profile Picture</label>
                        <div className="flex items-center gap-6">
                            <div className="w-20 h-20 rounded-full bg-[#1A1A1A] border-2 border-white/10 flex items-center justify-center overflow-hidden shrink-0 relative">
                                {isUploading ? (
                                    <Loader2 className="w-6 h-6 text-brand animate-spin" />
                                ) : photoUrl ? (
                                    <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
                                ) : (
                                    <Users className="w-8 h-8 text-white/20" />
                                )}
                            </div>
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={handleUploadClick}
                                    disabled={isUploading}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-brand/20 text-brand rounded-lg text-xs font-bold hover:bg-brand/30 transition-colors w-full sm:w-auto"
                                >
                                    <Camera size={14} /> {isUploading ? 'Uploading...' : (photoUrl ? 'Change Image' : 'Upload Image')}
                                </button>
                                {photoUrl && !isUploading && (
                                    <button
                                        onClick={handleRemoveImage}
                                        className="text-xs text-accent-error hover:text-accent-error/80 transition-colors text-left"
                                    >
                                        Remove Image
                                    </button>
                                )}
                                <p className="text-[10px] text-content-muted">Max 2MB. JPG, PNG</p>
                                <input
                                    type="file"
                                    accept="image/*"
                                    ref={hiddenFileInput}
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-content-secondary text-xs uppercase font-bold tracking-wider mb-2">Player Name</label>
                        <input 
                            type="text" 
                            className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl p-3 text-white focus:border-brand outline-none" 
                            value={name} 
                            placeholder="Full Name"
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                </div>
                <div className="p-4 border-t border-white/10 bg-[#111] flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg font-bold text-sm transition-colors border border-white/10">Cancel</button>
                    <button disabled={isSaving || isUploading || !name.trim()} onClick={handleSave} className="flex items-center gap-2 bg-[#4D78FF] hover:bg-[#4D78FF] text-white px-6 py-2 rounded-lg font-bold text-sm disabled:opacity-50">
                        {isSaving && <Loader2 size={16} className="animate-spin" />}
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const TeamDetailCard: React.FC<{ tournamentId: string, team: Team, actions?: React.ReactNode }> = ({ tournamentId, team, actions }) => {
    const [expanded, setExpanded] = useState(false);
    const [editingPlayerIndex, setEditingPlayerIndex] = useState<1 | 2 | null>(null);

    return (
        <>
            {editingPlayerIndex !== null && (
                <PlayerEditModal
                    player={editingPlayerIndex === 1 ? team.player1 : team.player2}
                    playerIndex={editingPlayerIndex}
                    team={team}
                    tId={tournamentId}
                    onClose={() => setEditingPlayerIndex(null)}
                />
            )}
            <Card variant="default" className="mb-2 overflow-hidden hover:border-brand/50 transition-colors p-0">
                <div className="flex justify-between items-center p-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
                    <span className="text-white font-medium flex items-center gap-3">
                        <Avatar fallback={team.name} size="sm" />
                        {team.name}
                    </span>
                    <div className="flex items-center gap-3">
                        {actions}
                        <ChevronRight size={16} className={`text-content-muted transition-transform duration-300 ${expanded ? 'rotate-90' : ''}`} />
                    </div>
                </div>
                {expanded && (
                    <div className="p-4 bg-surface-panel border-t border-white/10 text-sm space-y-3 animate-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1 relative group">
                                <div className="flex items-center justify-between">
                                    <div className="text-content-muted text-xs uppercase font-bold tracking-wider">Player 1</div>
                                    <button onClick={() => setEditingPlayerIndex(1)} className="p-1.5 hover:bg-white/10 rounded-lg text-content-muted transition-colors opacity-0 group-hover:opacity-100 flex items-center justify-center">
                                        <Edit3 size={14} />
                                    </button>
                                </div>
                                <div className="flex items-center gap-3 text-white">
                                    <div className="w-8 h-8 rounded-full bg-[#1A1A1A] flex items-center justify-center overflow-hidden shrink-0 border border-white/10">
                                        {(team.player1 as any).photoUrl ? <img src={(team.player1 as any).photoUrl} className="w-full h-full object-cover" /> : <Users size={12} className="text-brand"/>}
                                    </div>
                                    <span className="font-bold">{team.player1.name}</span>
                                </div>
                                <div className="flex items-center gap-2 text-content-secondary mt-2"><Phone size={14}/> {team.player1.phone}</div>
                                <div className="flex items-center gap-2 text-content-secondary"><Mail size={14}/> {team.player1.email}</div>
                                {(team.player1 as any).cnic && <div className="flex items-center gap-2 text-content-secondary"><span className="text-[10px] font-bold">CNIC</span> {(team.player1 as any).cnic}</div>}
                            </div>
                            <div className="space-y-1 relative group md:pl-4 md:border-l md:border-white/10">
                                <div className="flex items-center justify-between">
                                    <div className="text-content-muted text-xs uppercase font-bold tracking-wider">Player 2</div>
                                    <button onClick={() => setEditingPlayerIndex(2)} className="p-1.5 hover:bg-white/10 rounded-lg text-content-muted transition-colors opacity-0 group-hover:opacity-100 flex items-center justify-center">
                                        <Edit3 size={14} />
                                    </button>
                                </div>
                                <div className="flex items-center gap-3 text-white">
                                    <div className="w-8 h-8 rounded-full bg-[#1A1A1A] flex items-center justify-center overflow-hidden shrink-0 border border-white/10">
                                        {(team.player2 as any).photoUrl ? <img src={(team.player2 as any).photoUrl} className="w-full h-full object-cover" /> : <Users size={12} className="text-brand"/>}
                                    </div>
                                    <span className="font-bold">{team.player2.name}</span>
                                </div>
                                <div className="flex items-center gap-2 text-content-secondary mt-2"><Phone size={14}/> {team.player2.phone}</div>
                                <div className="flex items-center gap-2 text-content-secondary"><Mail size={14}/> {team.player2.email}</div>
                                {(team.player2 as any).cnic && <div className="flex items-center gap-2 text-content-secondary"><span className="text-[10px] font-bold">CNIC</span> {(team.player2 as any).cnic}</div>}
                            </div>
                        </div>
                    </div>
                )}
            </Card>
        </>
    );
};

const TeamsTab = ({ tournament, categoryId, setView }: { tournament: Tournament; categoryId: string | null; setView: (view: any) => void }) => {
    const teams = (tournament.teams || []).filter(t => isTeamInCategory(t, categoryId, tournament));
    const pending = teams.filter(t => t.status === 'PENDING');
    // Include ACCEPTED, WITHDRAWN, and REPLACED in the list for replacing
    const registeredTeams = teams.filter(t => t.status === 'ACCEPTED' || t.status === 'WITHDRAWN' || t.status === 'REPLACED' || String(t.status) === 'replaced');
    const acceptedOnly = teams.filter(t => t.status === 'ACCEPTED');
    
    const [showManualEnrollment, setShowManualEnrollment] = useState(false);
    const [showBulkUpload, setShowBulkUpload] = useState(false);
    const [replaceTeamModal, setReplaceTeamModal] = useState<Team | null>(null);
    const [editingTeam, setEditingTeam] = useState<Team | null>(null);
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const { matches: globalMatches } = useTournamentMatches(tournament.id);
    
    const category = categoryId ? tournament.categories?.find(c => c.id === categoryId) : null;
    const maxTeams = category ? category.maxTeams : tournament.maxTeams;
    const isAmericanoMode = tournament.format === 'AMERICANO' || category?.format === 'AMERICANO';

    const handleAcceptTeam = async (tId: string) => {
        if (acceptedOnly.length >= (maxTeams || 0)) {
            alert(`Maximum limit of ${maxTeams} ${isAmericanoMode ? 'players' : 'teams'} reached.`);
            return;
        }
        await updateTeamStatus(tournament.id, tId, 'ACCEPTED');
    };

    const handleDeleteAcceptedTeam = async (tId: string) => {
        if (window.confirm(`Are you sure you want to remove this ${isAmericanoMode ? 'player' : 'team'}?`)) {
            await updateTeamStatus(tournament.id, tId, 'REJECTED');
        }
    };
    
    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card variant="panel">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-white">{isAmericanoMode ? "Pending Players" : "Pending Requests"}</h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowBulkUpload(true)}
                                className="bg-surface-ground hover:bg-white/10 text-white px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-colors flex items-center gap-1 border border-white/10"
                            >
                                <Plus size={12} /> Bulk Upload
                            </button>
                            <Badge variant="warning">{pending.length}</Badge>
                        </div>
                    </div>
                    {pending.map(t => (
                        <TeamDetailCard 
                            key={t.id}
                            tournamentId={tournament.id}
                            team={t} 
                            actions={
                                <>
                                    <button onClick={(e) => { e.stopPropagation(); handleAcceptTeam(t.id); }} className="p-1.5 bg-accent-success/20 text-accent-success rounded-lg hover:bg-accent-success/30 transition-colors"><Check size={16}/></button>
                                    <button onClick={(e) => { e.stopPropagation(); updateTeamStatus(tournament.id, t.id, 'REJECTED'); }} className="p-1.5 bg-accent-error/20 text-accent-error rounded-lg hover:bg-accent-error/30 transition-colors"><X size={16}/></button>
                                </>
                            } 
                        />
                    ))}
                    {pending.length === 0 && <p className="text-content-muted text-sm text-center py-4">No pending registrations.</p>}
                </Card>
                <div className="space-y-4">
                    <Card variant="panel">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-white uppercase tracking-wider text-sm flex items-center gap-2">
                                <List size={16} className="text-brand"/> {isAmericanoMode ? "Registered Players" : "Registered Teams"}
                            </h3>
                            <div className="flex items-center gap-2">
                                <button 
                                    disabled={acceptedOnly.length >= (maxTeams || 0)}
                                    onClick={() => setShowManualEnrollment(true)} 
                                    className="bg-brand hover:bg-brand-light disabled:opacity-50 text-white px-3 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-lg shadow-brand/20"
                                >
                                    <Plus size={14} /> Add
                                </button>
                                <Badge variant="success">{acceptedOnly.length} / {maxTeams || '?'}</Badge>
                            </div>
                        </div>
                        {registeredTeams.length > 0 ? (
                            <div className="overflow-x-auto border border-white/5 rounded-xl">
                                <table className="w-full text-sm text-left whitespace-nowrap">
                                    <thead className="text-xs uppercase bg-surface-ground text-content-secondary">
                                        <tr>
                                            <th className="px-3 py-3 w-10 text-center border-b border-white/5">#</th>
                                            {isAmericanoMode ? (
                                                <th className="px-3 py-3 font-semibold border-b border-white/5">Player Name</th>
                                            ) : (
                                                <>
                                                    <th className="px-3 py-3 font-semibold border-b border-white/5">Team Name</th>
                                                    <th className="px-3 py-3 font-semibold border-b border-white/5">Players</th>
                                                </>
                                            )}
                                            <th className="px-3 py-3 font-semibold text-center border-b border-white/5">Group</th>
                                            <th className="px-3 py-3 font-semibold text-center border-b border-white/5">Status</th>
                                            <th className="px-3 py-3 text-right border-b border-white/5"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {registeredTeams.map((t, idx) => {
                                            const isWithdrawn = String(t.status).toLowerCase() === 'withdrawn' || String(t.status).toLowerCase() === 'replaced';
                                            return (
                                                <tr key={t.id} className={`hover:bg-white/5 transition-colors cursor-pointer ${isWithdrawn ? 'opacity-60' : ''}`} onClick={() => setSelectedTeam(t)}>
                                                    <td className="px-3 py-4 text-center font-mono text-content-muted">{idx + 1}</td>
                                                    {isAmericanoMode ? (
                                                        <td className="px-3 py-4 font-bold text-white">{t.name || t.player1?.name}</td>
                                                    ) : (
                                                        <>
                                                            <td className="px-3 py-4 font-bold text-white">{t.name}</td>
                                                            <td className="px-3 py-4 text-content-secondary truncate max-w-[150px]">
                                                                {t.player1.name} {t.player2?.name ? `/ ${t.player2.name}` : ''}
                                                            </td>
                                                        </>
                                                    )}
                                                    <td className="px-3 py-4 text-center font-bold text-brand">{t.groupId || '-'}</td>
                                                    <td className="px-3 py-4 text-center">
                                                        {isWithdrawn ? (
                                                            <span className="flex items-center justify-center gap-1 text-accent-warning text-xs font-bold bg-accent-warning/10 px-2 py-1 rounded">
                                                                <AlertTriangle size={12}/> Withdrawn
                                                            </span>
                                                        ) : (
                                                            <span className="flex items-center justify-center gap-1 text-accent-success text-xs font-bold bg-accent-success/10 px-2 py-1 rounded">
                                                                Active
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-4 text-right flex items-center justify-end gap-2">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); setEditingTeam(t); }} 
                                                            className="text-[10px] font-bold text-[#4D78FF] border border-emerald-500/40 hover:bg-[#4D78FF]/10 transition-colors uppercase tracking-widest px-2 py-1 rounded"
                                                        >
                                                            Edit
                                                        </button>
                                                        {!isWithdrawn && (
                                                            <button title="Remove" onClick={(e) => { e.stopPropagation(); handleDeleteAcceptedTeam(t.id); }} className="text-accent-error hover:text-red-400 p-1">
                                                                <Trash2 size={14}/>
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-content-muted text-sm text-center py-4">No registered teams yet.</p>
                        )}
                    </Card>

                    {acceptedOnly.length > 0 && ((category?.format || tournament.format) === TournamentFormat.ROUND_ROBIN || (category?.format || tournament.format) === TournamentFormat.GROUP_TO_KNOCKOUT) && (
                        <button 
                            onClick={() => setView('GROUPS')}
                            className="w-full bg-surface-elevated hover:bg-white/10 text-white p-4 rounded-2xl flex items-center justify-between border border-white/5 transition-all group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="bg-brand/20 p-2 rounded-lg text-brand"><Grid size={20} /></div>
                                <div className="text-left">
                                    <div className="font-bold">Assign Groups</div>
                                    <div className="text-xs text-content-muted">Assign teams into groups for round robin stages</div>
                                </div>
                            </div>
                            <ChevronRight size={20} className="text-content-muted group-hover:text-brand transition-colors" />
                        </button>
                    )}
                </div>
            </div>
            {showBulkUpload && (
                <BulkUploadTeamsModal
                    isOpen={showBulkUpload}
                    onClose={() => setShowBulkUpload(false)}
                    tournament={tournament}
                    categoryId={categoryId}
                    onUpload={async (teams) => {
                        await bulkUploadPendingTeams(tournament.id, teams);
                    }}
                />
            )}
            {showManualEnrollment && (
                <ManualEnrollmentModal 
                    isOpen={showManualEnrollment} 
                    onClose={() => setShowManualEnrollment(false)} 
                    tournament={tournament} 
                    categoryId={categoryId}
                    onEnroll={(team) => enrollTeamManually(tournament.id, categoryId ? { ...team, categoryId } : team)} 
                />
            )}
            {replaceTeamModal && (
                <ReplaceTeamModal
                    isOpen={!!replaceTeamModal}
                    onClose={() => setReplaceTeamModal(null)}
                    tournament={tournament}
                    outgoingTeam={replaceTeamModal}
                    onConfirm={async (incomingTeamData) => {
                        await replaceTeamInTournament(tournament.id, replaceTeamModal.id, incomingTeamData);
                    }}
                />
            )}
            {editingTeam && (
                <EditTeamSheet
                    isOpen={!!editingTeam}
                    onClose={() => setEditingTeam(null)}
                    tournament={tournament}
                    team={editingTeam}
                    onConfirm={async (name, p1Name, p2Name) => {
                        await editTeamInTournament(tournament.id, editingTeam.id, name, p1Name, p2Name);
                    }}
                />
            )}
            {selectedTeam && (
                <TeamDetailsOverlay 
                    team={selectedTeam} 
                    matches={globalMatches || []} 
                    teams={tournament.teams || []} 
                    tournament={tournament}
                    onClose={() => setSelectedTeam(null)} 
                    showContactInfo={true}
                />
            )}
        </div>
    );
};

const OverviewTab = ({ tournament, categoryId, onEdit, venues = [] }: { tournament: Tournament; categoryId: string | null; onEdit: () => void; venues?: Venue[] }) => {
    const { matches: globalMatches } = useTournamentMatches(tournament.id);
    const teams = (tournament.teams || []).filter(t => isTeamInCategory(t, categoryId, tournament));
    const accepted = teams.filter(t => t.status === 'ACCEPTED');
    
    // Get category details if selected
    const category = categoryId ? tournament.categories?.find(c => c.id === categoryId) : null;
    const currentBanner = (categoryId && category?.bannerUrl) ? category.bannerUrl : tournament.bannerUrl;

    const maxTeams = category ? category.maxTeams : tournament.maxTeams;
    
    const tournamentDisplayId = tournament.slug || tournament.id;
    const registrationUrl = `${window.location.origin}${window.location.pathname}#/tournament/${tournamentDisplayId}`;
    const refereeUrl = `${window.location.origin}${window.location.pathname}#/referee/${tournamentDisplayId}`;

    // Resolve venue name correctly
    let displayVenueName = '';
    if (category) {
        const cat = category as any;
        const resolvedVenue = venues.find(v => v.id === cat.venueId || v.id === cat.venue);
        displayVenueName = resolvedVenue ? resolvedVenue.name : (cat.venue || cat.venueId || tournament.venue || 'Karachi Padel');
    } else {
        const resolvedVenue = venues.find(v => v.id === tournament.venueId || v.id === (tournament as any).venue);
        displayVenueName = resolvedVenue ? resolvedVenue.name : (tournament.venue || 'Karachi Padel');
    }

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        alert("Link copied to clipboard!");
    };

    const downloadQRCode = () => {
        const canvas = document.getElementById('tournament-qr') as HTMLCanvasElement;
        if (canvas) {
            const pngUrl = canvas.toDataURL("image/png");
            const downloadLink = document.createElement("a");
            downloadLink.href = pngUrl;
            downloadLink.download = `${tournament.name}-qr.png`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        }
    };

    const handleAcceptTeam = async (tId: string) => {
        if (accepted.length >= (maxTeams || 0)) {
            alert(`Maximum limit of ${maxTeams} teams reached for this ${category ? 'category' : 'tournament'}.`);
            return;
        }
        await updateTeamStatus(tournament.id, tId, 'ACCEPTED');
    };

    const handleDeleteAcceptedTeam = async (tId: string) => {
        if (window.confirm("Are you sure you want to remove this team? This will open up a slot.")) {
            // we remove the team by setting status to REJECTED or CANCELLED, or we can use updateTeamStatus
            await updateTeamStatus(tournament.id, tId, 'REJECTED');
        }
    };
    
    return (
        <div className="space-y-8">
            {currentBanner && (
                <div className="w-full h-48 md:h-64 rounded-2xl overflow-hidden relative border border-white/10 shadow-lg">
                    <img src={currentBanner} alt="Tournament Banner" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-6">
                        <div className="flex items-center gap-4">
                            {tournament.organizerLogo && (
                                <div className="w-12 h-12 rounded-xl bg-white p-1 shadow-xl flex-shrink-0">
                                    <img src={tournament.organizerLogo} alt="Organizer" className="w-full h-full object-contain" />
                                </div>
                            )}
                            <div>
                                <h2 className="text-2xl md:text-3xl font-bold text-white shadow-sm">
                                    {tournament.name} {category && `• ${category.name}`}
                                </h2>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Tournament Details Card */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card variant="default" className="p-4 flex flex-col gap-2">
                    <div className="text-content-muted text-xs font-bold uppercase tracking-widest flex items-center gap-2"><MapPin size={14}/> Location</div>
                    <div className="font-medium text-white">{displayVenueName}</div>
                    <div className="text-sm text-content-secondary">{tournament.city || 'Karachi'}</div>
                </Card>
                <Card variant="default" className="p-4 flex flex-col gap-2 min-w-0">
                    <div className="text-content-muted text-xs font-bold uppercase tracking-widest flex items-center gap-2 shrink-0"><Trophy size={14} className="shrink-0"/> Format</div>
                    <div className="font-medium text-white truncate w-full" title={category?.format || tournament.format}>{(category?.format || tournament.format).replace(/_/g, ' ')}</div>
                    <div className="text-sm text-content-secondary capitalize truncate w-full">{(category?.rrType || tournament.rrType || '').replace(/_/g, ' ').toLowerCase()}</div>
                </Card>
                <Card variant="default" className="p-4 flex flex-col gap-2 min-w-0">
                    <div className="text-content-muted text-xs font-bold uppercase tracking-widest flex items-center gap-2 shrink-0"><DollarSign size={14} className="shrink-0"/> Prize Pool</div>
                    <div className="font-medium text-brand text-lg truncate w-full">{(category?.prizeMoney || tournament.prizeMoney) ? `${tournament.currency === 'USD' ? '$' : 'Rs. '}${category?.prizeMoney || tournament.prizeMoney}` : 'None'}</div>
                    <div className="text-sm text-content-secondary truncate w-full">Entry: {category?.entryFee || tournament.entryFee}</div>
                </Card>
                <Card variant="default" className="p-4 flex flex-col gap-2 relative min-w-0 pr-14">
                    <div className="text-content-muted text-xs font-bold uppercase tracking-widest flex items-center gap-2 shrink-0"><Users size={14} className="shrink-0"/> Teams / Groups</div>
                    <div className="font-medium text-white truncate w-full">{accepted.length} Teams</div>
                    <div className="text-sm text-content-secondary truncate w-full">
                        {Math.max(1, Math.ceil((maxTeams || accepted.length) / (category?.groupSize || tournament.groupSize || 4)))} Groups
                    </div>
                    <button onClick={onEdit} className="absolute inset-y-0 right-0 h-full px-4 border-l border-white/5 hover:bg-white/5 transition-colors flex items-center justify-center text-white rounded-r-2xl shrink-0" title="Edit Details">
                        <Edit3 size={16}/>
                    </button>
                </Card>
            </div>

            {/* Share & QR Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card variant="panel" className="lg:col-span-2 flex flex-col justify-center p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-brand/10 p-2 rounded-lg text-brand">
                            <Share2 size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-lg">Share Tournament</h3>
                            <p className="text-content-muted text-sm">Direct links for player registration and referee access.</p>
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-content-muted mb-2">Player Registration Link</label>
                            <div className="flex gap-2">
                                <div className="flex-1 bg-surface-ground border border-white/10 rounded-xl px-4 py-3 text-content-secondary text-sm truncate font-mono">
                                    {registrationUrl}
                                </div>
                                <button onClick={() => handleCopy(registrationUrl)} className="bg-surface-elevated hover:bg-white/10 text-white p-3 rounded-xl transition-all border border-white/5" title="Copy Link">
                                    <Copy size={18} />
                                </button>
                                <a href={registrationUrl} target="_blank" rel="noreferrer" className="bg-surface-elevated hover:bg-white/10 text-white p-3 rounded-xl transition-all border border-white/5" title="Open Link">
                                    <ExternalLink size={18} />
                                </a>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-content-muted mb-2">Referee Control Link</label>
                            <div className="flex gap-2">
                                <div className="flex-1 bg-surface-ground border border-white/10 rounded-xl px-4 py-3 text-content-secondary text-sm truncate font-mono">
                                    {refereeUrl}
                                </div>
                                <button onClick={() => handleCopy(refereeUrl)} className="bg-surface-elevated hover:bg-white/10 text-white p-3 rounded-xl transition-all border border-white/5" title="Copy Link">
                                    <Copy size={18} />
                                </button>
                                <a href={refereeUrl} target="_blank" rel="noreferrer" className="bg-surface-elevated hover:bg-white/10 text-white p-3 rounded-xl transition-all border border-white/5" title="Open Link">
                                    <ExternalLink size={18} />
                                </a>
                            </div>
                        </div>
                    </div>
                </Card>

                <Card variant="panel" className="flex flex-col items-center justify-center p-6 text-center">
                    <div className="bg-white p-4 rounded-2xl mb-4 shadow-xl">
                        <QRCodeCanvas 
                            id="tournament-qr"
                            value={registrationUrl} 
                            size={160}
                            level="H"
                            includeMargin={false}
                        />
                    </div>
                    <h3 className="font-bold text-white mb-1">Registration QR Code</h3>
                    <p className="text-content-muted text-xs mb-6 px-4">Download and print this QR for players to register instantly at the venue.</p>
                    
                    <button 
                        onClick={downloadQRCode}
                        className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-light text-content-inverse font-bold py-3 rounded-xl transition-all shadow-lg shadow-brand/20"
                    >
                        <Download size={18} />
                        Download QR
                    </button>
                </Card>
            </div>

            {/* Visual Bracket for Elimination Formats */}
            {((category?.format || tournament.format) === TournamentFormat.SINGLE_ELIMINATION || (category?.format || tournament.format) === TournamentFormat.DOUBLE_ELIMINATION) && (
                <div>
                    <h3 className="text-xl font-bold text-white mb-4">Tournament Bracket</h3>
                    <BracketView matches={(globalMatches || []).filter(m => isMatchInCategory(m, categoryId, tournament))} teams={accepted} />
                </div>
            )}
        </div>
    )
}

const BracketView = ({ matches, teams }: any) => {
    // Basic Bracket Visualization
    // Group matches by round
    const rounds: Record<string, Match[]> = {};
    matches.forEach((m: Match) => {
        if (!rounds[m.round]) rounds[m.round] = [];
        rounds[m.round].push(m);
    });

    const roundKeys = Object.keys(rounds).sort((a,b) => parseInt(a) - parseInt(b));
    if (roundKeys.length === 0) return <p className="text-content-muted text-center py-8">No bracket generated yet.</p>;

    return (
        <Card variant="panel" className="overflow-x-auto pb-4">
            <div className="flex gap-8 min-w-max p-4">
                {roundKeys.map(r => (
                    <div key={r} className="flex flex-col justify-around gap-4 min-w-[200px]">
                        <h4 className="text-center text-brand font-bold text-sm mb-2 uppercase tracking-wider">{rounds[r][0].roundName}</h4>
                        {rounds[r].map(m => {
                             const t1 = teams.find((t: any) => t.id === m.team1Id);
                             const t2 = teams.find((t: any) => t.id === m.team2Id);
                             const isMatchDone = m.status === 'COMPLETED' || String(m.status).toUpperCase() === 'FINISHED';
                             
                             let p1Sets = m.score?.p1Sets || 0;
                             let p2Sets = m.score?.p2Sets || 0;
                             if (m.score?.p1SetScores && m.score?.p2SetScores && (m.score.p1SetScores.length > 0)) {
                                 let p1 = 0, p2 = 0;
                                 m.score.p1SetScores.forEach((s: number, i: number) => {
                                     const os = m.score.p2SetScores[i] || 0;
                                     if (s > os) p1++; else if (os > s) p2++;
                                 });
                                 if (p1 + p2 > 0) {
                                     p1Sets = p1;
                                     p2Sets = p2;
                                 }
                             }
                             if (isMatchDone && p1Sets === 0 && p2Sets === 0 && (!m.score?.p1Games && !m.score?.p2Games)) {
                                 if (m.winnerTeamId === m.team1Id) p1Sets = 1;
                                 else if (m.winnerTeamId === m.team2Id) p2Sets = 1;
                             }

                             return (
                                 <div key={m.id} className="bg-surface-ground border border-white/10 rounded-lg p-3 text-xs relative shadow-sm">
                                     <div className={`p-2 mb-1 rounded flex justify-between items-center ${m.winnerTeamId === m.team1Id ? 'bg-accent-success/20 text-accent-success font-bold' : 'text-content-secondary'}`}>
                                         <span className="truncate max-w-[120px]">{t1?.name || 'TBD'}</span>
                                         {(m.status === 'COMPLETED' || String(m.status).toUpperCase() === 'FINISHED') && <span className="font-bold">{p1Sets}</span>}
                                     </div>
                                     <div className={`p-2 rounded flex justify-between items-center ${m.winnerTeamId === m.team2Id ? 'bg-accent-success/20 text-accent-success font-bold' : 'text-content-secondary'}`}>
                                         <span className="truncate max-w-[120px]">{t2?.name || 'TBD'}</span>
                                         {(m.status === 'COMPLETED' || String(m.status).toUpperCase() === 'FINISHED') && <span className="font-bold">{p2Sets}</span>}
                                     </div>
                                 </div>
                             )
                        })}
                    </div>
                ))}
            </div>
        </Card>
    )
};

const StandingsTab = ({ tournament, categoryId }: any) => {
    const acceptedTeams = useMemo(() => {
        return (tournament.teams || []).filter((t: any) => 
            t.status === 'ACCEPTED' && 
            isTeamInCategory(t, categoryId, tournament)
        );
    }, [tournament.teams, categoryId]);

    const isAmericano = tournament?.format === 'AMERICANO' || tournament?.format === 'MEXICANO';
    const [standings, setStandings] = useState<Team[]>(acceptedTeams);
    const [selectedGroup, setSelectedGroup] = useState<string>('All');
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const { matches: globalMatches } = useTournamentMatches(tournament?.id);
    const [isRecalculating, setIsRecalculating] = useState(false);

    const [exporterOpen, setExporterOpen] = useState(false);
    const [exporterGroup, setExporterGroup] = useState('A');
    const [exporterTeams, setExporterTeams] = useState<any[]>([]);
    const [exporterInitialFormat, setExporterInitialFormat] = useState<'group' | 'knockout'>('group');

    const activeCategoryObj = tournament?.categories?.find((c: any) => c.id === categoryId);
    const categoryName = activeCategoryObj?.name || '';

    const categoryMatches = useMemo(() => {
        if (!globalMatches) return [];
        if (!categoryId) return globalMatches;
        return globalMatches.filter((m: any) => isMatchInCategory(m, categoryId, tournament));
    }, [globalMatches, categoryId, tournament]);

    useEffect(() => {
        if (!tournament?.id) return;
        const unsub = subscribeToStandings(tournament.id, categoryId || null, (data) => {
            const source = (data && data.length > 0) ? data : (tournament?.teams || acceptedTeams);
            const filtered = source.filter((t: any) => 
                (t.status === 'ACCEPTED' || t.status === 'accepted' || !t.status) && 
                isTeamInCategory(t, categoryId, tournament)
            );
            if (filtered && filtered.length > 0) {
                setStandings(filtered);
            } else {
                setStandings(acceptedTeams);
            }
        }, tournament);
        return () => unsub();
    }, [tournament?.id, categoryId, acceptedTeams, tournament]);

    // Auto-update standings in background whenever matches or category changes
    useEffect(() => {
        if (!tournament?.id) return;
        const matchesToPass = (categoryMatches && categoryMatches.length > 0) ? categoryMatches : (globalMatches || []);
        checkAndHealTournamentStats(tournament, matchesToPass, categoryId);
    }, [tournament?.id, categoryMatches, globalMatches, categoryId]);

    // Check if groups exist
    const groups = standings.reduce((acc: any, team: any) => {
        const gid = team.groupId || 'A';
        if (!acc[gid]) acc[gid] = [];
        acc[gid].push(team);
        return acc;
    }, {});

    const groupKeys = Object.keys(groups).sort();

    useEffect(() => {
        if (groupKeys.length > 0) {
            if (selectedGroup !== 'All' && !groupKeys.includes(selectedGroup)) {
                setSelectedGroup(groupKeys[0]);
            }
        }
    }, [groupKeys, selectedGroup]);

    const displayGroups = selectedGroup === 'All' ? groupKeys : [selectedGroup];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <List size={24} className="text-brand"/> {isAmericano ? "Tournament Leaderboard" : "Tournament Standings"}
                </h3>
                
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider py-2.5 px-4 rounded-xl shadow-sm">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <span>Auto-Synced Standings</span>
                        <button
                            disabled={isRecalculating}
                            title="Force Refresh Standings"
                            onClick={async () => {
                                if (!tournament?.id) return;
                                setIsRecalculating(true);
                                try {
                                    const matchesToPass = (categoryMatches && categoryMatches.length > 0) ? categoryMatches : (globalMatches || []);
                                    await checkAndHealTournamentStats(tournament, matchesToPass, categoryId, true);
                                    toast.success("Standings refreshed");
                                } catch (err) {
                                    console.error("Error force syncing standings:", err);
                                    toast.error("Couldn't refresh standings", "Please try again.");
                                } finally {
                                    setIsRecalculating(false);
                                }
                            }}
                            className="ml-1 hover:text-white p-0.5 rounded transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            <RotateCcw size={14} className={isRecalculating ? 'animate-spin text-brand' : ''} />
                        </button>
                    </div>
                    <button
                        onClick={() => {
                            setExporterTeams(standings);
                            setExporterOpen(true);
                        }}
                        className="bg-brand hover:bg-brand/90 text-white text-xs font-black uppercase tracking-wider py-2.5 px-5 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-brand/20"
                    >
                        <Tv size={14} className="animate-pulse" /> Export Standings
                    </button>

                    {groupKeys.length > 1 && !isAmericano && (
                        <div className="flex items-center gap-3">
                            <label className="text-sm font-bold text-content-muted uppercase tracking-wider">Select Group</label>
                            <select 
                                value={selectedGroup}
                                onChange={(e) => setSelectedGroup(e.target.value)}
                                className="bg-surface-elevated border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand transition-colors"
                            >
                                <option value="All">All Groups</option>
                                {groupKeys.map(g => (
                                    <option key={g} value={g}>Group {g}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            <Card variant="panel" className="p-0 overflow-hidden mb-6">
                <div className="space-y-0">
                    {groupKeys.length === 0 && (
                        <div className="p-12 text-center text-content-muted text-sm border-t border-white/5">
                            <Grid size={48} className="mx-auto text-white/5 mb-4" />
                            No standings available yet. Schedules might not be created.
                        </div>
                    )}
                    
                    {displayGroups.map((gId, index) => (
                        <div key={gId} className={index !== displayGroups.length - 1 ? "border-b border-white/5 pb-4" : "pb-4"}>
                            <div className="px-6 py-4 bg-surface-ground/50 border-b border-white/5 font-bold text-brand flex items-center justify-between gap-4 text-sm uppercase tracking-wider">
                                <span className="flex items-center gap-2">
                                    <Grid size={14} /> {isAmericano ? "LEADERBOARD" : `Group ${gId}`}
                                </span>
                            </div>
                            <div className="w-full mt-2">
                                <table className="w-full text-sm text-left min-w-[600px]">
                                    <thead className="text-content-secondary text-xs uppercase tracking-wider">
                                        {isAmericano ? (
                                            <tr>
                                                <th className="px-6 py-3 font-bold">Player</th>
                                                <th className="px-6 py-3 text-center font-bold" title="Matches Played">M.P</th>
                                                <th className="px-6 py-3 text-center font-bold text-brand" title="Wins - Losses - Ties">W - L - T</th>
                                                <th className="px-6 py-3 text-center font-bold text-[#E65C31]" title="Total Points scored including missed matches bonus">P</th>
                                                <th className="px-6 py-3 text-center font-bold" title="Missed Match Compensation Points">M+</th>
                                                <th className="px-6 py-3 text-center font-bold" title="Points Conceded">Conceded</th>
                                                <th className="px-6 py-3 text-right font-bold text-brand" title="Point Differential">DIFF</th>
                                            </tr>
                                        ) : (
                                            <tr>
                                                <th className="px-6 py-3 font-bold">Team</th>
                                                <th className="px-6 py-3 text-center font-bold" title="Matches Won">M.W</th>
                                                <th className="px-6 py-3 text-center font-bold" title="Matches Lost">M.L</th>
                                                <th className="px-6 py-3 text-center font-bold" title="Games Won">G.W</th>
                                                <th className="px-6 py-3 text-center font-bold" title="Games Lost">G.L</th>
                                                <th className="px-6 py-3 text-center font-bold text-brand" title="Game Difference">GD</th>
                                                <th className="px-6 py-3 text-center font-bold text-brand">Pts</th>
                                            </tr>
                                        )}
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {(groups[gId] || []).sort((a: any, b: any) => {
                                            if (isAmericano) {
                                                if ((b.points || 0) !== (a.points || 0)) return (b.points || 0) - (a.points || 0);
                                                if ((b.pointDifferential || 0) !== (a.pointDifferential || 0)) return (b.pointDifferential || 0) - (a.pointDifferential || 0);
                                                if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
                                                return 0;
                                            }
                                            // 1st rule: Points (PTS) descending (highest first)
                                            const ptsA = a.points || 0;
                                            const ptsB = b.points || 0;
                                            if (ptsB !== ptsA) {
                                                return ptsB - ptsA;
                                            }
                                            
                                            // 2nd rule: Game Difference (GD) descending (highest first)
                                            const gdA = (a.gamesWon || 0) - (a.gamesLost || 0);
                                            const gdB = (b.gamesWon || 0) - (b.gamesLost || 0);
                                            if (gdB !== gdA) {
                                                return gdB - gdA;
                                            }
                                            
                                            // 3rd rule: Games Won (G.W) descending
                                            const gwA = a.gamesWon || 0;
                                            const gwB = b.gamesWon || 0;
                                            if (gwB !== gwA) {
                                                return gwB - gwA;
                                            }

                                            // Fallback: Games Lost (GL) ascending (fewer games lost is better)
                                            const glA = a.gamesLost || 0;
                                            const glB = b.gamesLost || 0;
                                            return glA - glB;
                                        }).map((t: any, i: number) => (
                                            <tr key={t.id} className="hover:bg-white/5 transition-colors cursor-pointer" onClick={() => setSelectedTeam(t)}>
                                                <td className="px-6 py-4 text-white flex items-center gap-3">
                                                    {i === 0 ? (<span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-[#FFD700] text-[#8B6508] shadow-[0_0_10px_rgba(255,215,0,0.5)]">1</span>) : i === 1 ? (<span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-[#C0C0C0] text-[#4A4A4A] shadow-[0_0_10px_rgba(192,192,192,0.4)]">2</span>) : i === 2 ? (<span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-[#CD7F32] text-[#5C3A16] shadow-[0_0_10px_rgba(205,127,50,0.4)]">3</span>) : (<span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-surface-elevated text-content-muted">{i+1}</span>)}
                                                    <span className="font-medium">{isAmericano ? (t.player1?.name || t.name) : t.name}</span>
                                                </td>
                                                {isAmericano ? (
                                                    <>
                                                        <td className="px-6 py-4 text-center font-bold text-white">{t.matchesPlayed || 0}</td>
                                                        <td className="px-6 py-4 text-center font-bold font-mono text-content-secondary">
                                                            {t.wins || 0}-{t.losses || 0}-{t.ties || 0}
                                                        </td>
                                                        <td className="px-6 py-4 text-center font-black text-brand text-lg text-[#E65C31]">{t.points || 0}</td>
                                                        <td className="px-6 py-4 text-center font-bold text-accent-success">{t.missedMatchPoints ? `+${t.missedMatchPoints}` : '-'}</td>
                                                        <td className="px-6 py-4 text-center text-content-secondary">{t.pointsConceded || t.gamesLost || 0}</td>
                                                        <td className="px-6 py-4 text-right font-black text-lg text-brand">
                                                            {t.pointDifferential > 0 ? `+${t.pointDifferential}` : t.pointDifferential || 0}
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="px-6 py-4 text-center text-accent-success font-bold">{t.wins || 0}</td>
                                                        <td className="px-6 py-4 text-center text-accent-error font-bold">{t.losses || 0}</td>
                                                        <td className="px-6 py-4 text-center text-content-secondary">{t.gamesWon || 0}</td>
                                                        <td className="px-6 py-4 text-center text-content-secondary">{t.gamesLost || 0}</td>
                                                        <td className="px-6 py-4 text-center font-bold text-content-muted">{(t.gamesWon || 0) - (t.gamesLost || 0)}</td>
                                                        <td className="px-6 py-4 text-center font-black text-brand text-base">{t.points || 0}</td>
                                                    </>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            {selectedTeam && (
                <TeamDetailsOverlay 
                    team={selectedTeam} 
                    matches={globalMatches || []} 
                    teams={standings} 
                    onClose={() => setSelectedTeam(null)} 
                    showContactInfo={true}
                />
            )}

            {exporterOpen && (
                <StandingsOverlayExporter
                    isOpen={exporterOpen}
                    onClose={() => setExporterOpen(false)}
                    tournament={tournament}
                    categoryName={categoryName}
                    teams={standings}
                    matches={categoryMatches}
                />
            )}
        </div>
    );
};

const GroupAssignmentTab = ({ tournament, categoryId }: { tournament: Tournament; categoryId: string | null }) => {
    const teams = (tournament.teams || []).filter(t => 
        t.status === 'ACCEPTED' && 
        isTeamInCategory(t, categoryId, tournament)
    );
    const category = categoryId ? tournament.categories?.find(c => c.id === categoryId) : null;
    const groupSize = category?.groupSize || tournament.groupSize || 4;
    const maxTeams = category?.maxTeams || tournament.maxTeams || teams.length;
    let numGroups = Math.max(1, Math.ceil(maxTeams / groupSize));

    // Fallback just in case teams exceed maxTeams
    if (Math.ceil(teams.length / groupSize) > numGroups) {
        numGroups = Math.ceil(teams.length / groupSize);
    }
    
    // Hold local assignment state
    const [localGroups, setLocalGroups] = useState<Record<string, string>>({});
    const [isDirty, setIsDirty] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const initial: Record<string, string> = {};
        
        // Find existing assigned teams
        const assignedTeams = teams.filter(t => t.groupId);
        // Find unassigned teams
        const unassignedTeams = teams.filter(t => !t.groupId);
        
        assignedTeams.forEach(t => {
            initial[t.id] = t.groupId!;
        });
        
        let currentGroupIndex = 0;
        let currentGroupCount = 0;
        
        // Distribution of unassigned teams evenly
        unassignedTeams.forEach(t => {
            // Find next group letter that isn't full based on current initial block
            while (currentGroupIndex < numGroups) {
                const groupLetter = String.fromCharCode(65 + currentGroupIndex);
                const teamsInGroup = Object.values(initial).filter(g => g === groupLetter).length;
                if (teamsInGroup < groupSize) {
                    initial[t.id] = groupLetter;
                    break;
                }
                currentGroupIndex++;
            }
            // If all groups are "full" but we still have teams (e.g. over capacity), just put them in the last group or distribute
            if (!initial[t.id]) {
                const fallbackLetter = String.fromCharCode(65 + (currentGroupIndex % numGroups));
                initial[t.id] = fallbackLetter;
                currentGroupIndex++;
            }
        });
        
        setLocalGroups(initial);
        if (unassignedTeams.length > 0) {
            setIsDirty(true);
        } else {
            setIsDirty(false);
        }
    }, [tournament.teams, categoryId, groupSize, numGroups]);

    const handleGroupChange = (teamId: string, newGroupId: string) => {
        setLocalGroups(prev => {
            const next = { ...prev, [teamId]: newGroupId };
            
            // Check if dirty
            let dirty = false;
            teams.forEach(t => {
                const currentGroup = t.groupId;
                // If it wasn't assigned, but initial gave it a value and we haven't saved it yet, it is considered dirty!
                // Actually t.groupId is undefined if not saved.
                if (currentGroup !== next[t.id]) {
                    dirty = true;
                }
            });
            setIsDirty(dirty);
            
            return next;
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const updates: Record<string, string> = {};
            teams.forEach(t => {
                const currentGroup = t.groupId || 'A';
                const nextGroup = localGroups[t.id];
                if (currentGroup !== nextGroup || !t.groupId) {
                    updates[t.id] = nextGroup;
                }
            });
            
            if (Object.keys(updates).length > 0) {
                await updateTournamentTeamsGroups(tournament.id, updates);
            }

            setIsDirty(false);
            alert('Group assignments saved successfully.');
        } catch (err) {
            console.error(err);
            alert('Failed to save group assignments.');
        } finally {
            setSaving(false);
        }
    };

    const handleAutoAssign = () => {
        const initial: Record<string, string> = {};
        const shuffledTeams = [...teams].sort(() => 0.5 - Math.random());
        let currentGroupIndex = 0;
        
        shuffledTeams.forEach(t => {
            while (currentGroupIndex < numGroups) {
                const groupLetter = String.fromCharCode(65 + currentGroupIndex);
                const teamsInGroup = Object.values(initial).filter(g => g === groupLetter).length;
                if (teamsInGroup < groupSize) {
                    initial[t.id] = groupLetter;
                    break;
                }
                currentGroupIndex++;
            }
            if (!initial[t.id]) {
                const fallbackLetter = String.fromCharCode(65 + (currentGroupIndex % numGroups));
                initial[t.id] = fallbackLetter;
                currentGroupIndex++;
            }
        });
        
        setLocalGroups(initial);
        setIsDirty(true);
    };

    const isValid = teams.length > 0 && teams.length % numGroups === 0;

    return (
        <Card variant="panel" className="p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h3 className="font-bold text-white">Group Assignments</h3>
                    {!isValid && <div className="text-accent-warning text-xs mt-1 flex items-center gap-1"><AlertTriangle size={14}/> Teams cannot be divided equally. {teams.length} teams / {groupSize} per group.</div>}
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                        onClick={handleAutoAssign} 
                        className="bg-surface-elevated hover:bg-white/10 text-white px-4 py-2 rounded-xl font-bold transition-all border border-white/10 flex items-center gap-2 flex-1 sm:flex-none justify-center"
                    >
                        <RefreshCcw size={16}/>
                        Auto-Assign
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={!isDirty || saving}
                        className="bg-brand hover:bg-brand-light disabled:opacity-50 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-brand/20 flex items-center gap-2 flex-1 sm:flex-none justify-center"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Database size={16}/>}
                        Save Choices
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {teams.map(team => (
                    <div key={team.id} className="flex items-center justify-between bg-surface-ground p-4 rounded-xl border border-white/5 hover:border-brand/30 transition-colors">
                        <span className="text-white font-medium flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-brand"></span>
                            {team.name}
                        </span>
                        <select 
                            className="bg-surface-panel text-white border border-white/10 rounded-lg px-3 py-1.5 focus:border-brand outline-none transition-all cursor-pointer hover:bg-surface-elevated"
                            value={localGroups[team.id] || 'A'}
                            onChange={(e) => handleGroupChange(team.id, e.target.value)}
                        >
                            {Array.from({length: numGroups}).map((_, i) => {
                                const gId = String.fromCharCode(65 + i); 
                                return <option key={gId} value={gId}>Group {gId}</option>;
                            })}
                        </select>
                    </div>
                ))}
            </div>
            
            {teams.length === 0 && <p className="text-content-muted text-sm text-center py-8">No accepted teams to group yet.</p>}
        </Card>
    )
}

const AutoScheduleWizard = ({ 
    onCancel, 
    onGenerate, 
    generating,
    tournament,
    categoryId
}: { 
    onCancel: () => void, 
    onGenerate: (config: any) => void,
    generating: boolean,
    tournament: Tournament,
    categoryId?: string | null
}) => {
    const [slots, setSlots] = useState<any[]>([{ date: new Date().toISOString().split('T')[0], startTime: '09:00', endTime: '18:00' }]);
    const [matchDuration, setMatchDuration] = useState(60);
    
    // Determine the pool of courts based on category or tournament
    let availablePool = ['Court 1'];
    if (categoryId && tournament.categories) {
        const cat = tournament.categories.find(c => c.id === categoryId);
        if (cat && cat.courts && cat.courts.length > 0) {
            availablePool = cat.courts;
        }
    } else {
        if (tournament.isMultiCategory && tournament.categories) {
            const allCourts = new Set<string>();
            tournament.categories.forEach(c => {
                (c.courts || []).forEach(crt => allCourts.add(crt));
            });
            if (allCourts.size > 0) {
                availablePool = Array.from(allCourts);
            } else if (tournament.courts && tournament.courts.length > 0) {
                availablePool = typeof tournament.courts === 'string' ? [tournament.courts] : tournament.courts;
            }
        } else if (tournament.courts && tournament.courts.length > 0) {
            availablePool = typeof tournament.courts === 'string' ? [tournament.courts] : tournament.courts;
        }
    }

    const [selectedCourts, setSelectedCourts] = useState<string[]>(availablePool);
    const [useSeeding, setUseSeeding] = useState(true);

    const category = categoryId ? tournament.categories?.find(c => c.id === categoryId) : null;

    const addSlot = () => setSlots([...slots, { date: new Date().toISOString().split('T')[0], startTime: '09:00', endTime: '18:00' }]);
    const removeSlot = (index: number) => setSlots(slots.filter((_, i) => i !== index));
    const updateSlot = (index: number, field: string, value: string) => {
        const newSlots = [...slots];
        newSlots[index][field] = value;
        setSlots(newSlots);
    };

    const toggleCourt = (court: string) => {
        if (selectedCourts.includes(court)) {
            setSelectedCourts(selectedCourts.filter(c => c !== court));
        } else {
            setSelectedCourts([...selectedCourts, court]);
        }
    };

    const handleGenerate = () => {
        onGenerate({
            slots,
            matchDuration,
            bufferTime: 0,
            courts: selectedCourts,
            useSeeding
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-surface-card rounded-2xl w-full max-w-2xl border border-white/10 shadow-2xl my-auto">
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-white">Automated Scheduler</h3>
                        <p className="text-content-secondary text-sm">Configure multi-day time slots and court availability.</p>
                    </div>
                    <button onClick={onCancel} className="p-2 text-content-muted hover:text-white transition-colors"><X size={20}/></button>
                </div>

                <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto">
                    {/* Time Slots */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-bold text-brand uppercase tracking-wider">Tournament Time Slots</label>
                            <button onClick={addSlot} className="text-xs bg-brand/10 hover:bg-brand/20 text-brand-light px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all">
                                <PlusCircle size={14}/> Add Day
                            </button>
                        </div>
                        <div className="space-y-3">
                            {slots.map((slot, index) => (
                                <div key={index} className="flex flex-col md:flex-row gap-3 bg-surface-ground p-4 rounded-xl border border-white/5">
                                    <div className="flex-1">
                                        <label className="text-[10px] text-content-muted uppercase font-bold block mb-1">Date</label>
                                        <input 
                                            type="date" 
                                            value={slot.date} 
                                            onChange={(e) => updateSlot(index, 'date', e.target.value)}
                                            className="w-full bg-surface-panel text-white border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-brand outline-none transition-all"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-[10px] text-content-muted uppercase font-bold block mb-1">Start Time</label>
                                        <input 
                                            type="time" 
                                            value={slot.startTime} 
                                            onChange={(e) => updateSlot(index, 'startTime', e.target.value)}
                                            className="w-full bg-surface-panel text-white border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-brand outline-none transition-all"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-[10px] text-content-muted uppercase font-bold block mb-1">End Time</label>
                                        <input 
                                            type="time" 
                                            value={slot.endTime} 
                                            onChange={(e) => updateSlot(index, 'endTime', e.target.value)}
                                            className="w-full bg-surface-panel text-white border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-brand outline-none transition-all"
                                        />
                                    </div>
                                    {slots.length > 1 && (
                                        <button onClick={() => removeSlot(index)} className="mt-5 p-2 text-accent-live hover:bg-red-500/10 rounded-lg transition-all self-end md:self-center">
                                            <Trash2 size={16}/>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Court Selection */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-brand uppercase tracking-wider block">Available Courts</label>
                        <div className="flex flex-wrap gap-2">
                            {availablePool.map(court => (
                                <button 
                                    key={court}
                                    onClick={() => toggleCourt(court)}
                                    className={`px-4 py-2 rounded-xl border transition-all text-sm font-medium ${selectedCourts.includes(court) ? 'bg-brand/20 border-brand text-brand-light' : 'bg-surface-ground border-white/5 text-content-muted hover:border-white/20'}`}
                                >
                                    {court}
                                </button>
                            ))}
                        </div>
                        {category && <p className="text-[10px] text-brand/60 italic">Showing courts assigned to {category.name}</p>}
                    </div>

                    {/* Match Settings */}
                    <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-3">
                            <label className="text-sm font-bold text-brand uppercase tracking-wider block">Est. Match Duration (For Scheduling)</label>
                            <div className="flex items-center gap-3 bg-surface-ground p-3 rounded-xl border border-white/5">
                                <Clock className="text-content-muted" size={18}/>
                                <input 
                                    type="number" 
                                    value={matchDuration} 
                                    onChange={(e) => setMatchDuration(parseInt(e.target.value))}
                                    className="bg-transparent text-white w-20 outline-none font-bold"
                                />
                                <span className="text-content-secondary text-sm">minutes</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-surface-ground rounded-xl border border-white/5">
                        <input 
                            type="checkbox" 
                            id="useSeeding" 
                            checked={useSeeding} 
                            onChange={(e) => setUseSeeding(e.target.checked)}
                            className="w-5 h-5 rounded border-white/10 bg-surface-panel text-brand focus:ring-brand"
                        />
                        <div>
                            <label htmlFor="useSeeding" className="text-white font-bold block">Smart Seeding</label>
                            <p className="text-content-secondary text-xs">Spread out top teams across the bracket automatically.</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-white/5 flex gap-4">
                    <button 
                        onClick={onCancel}
                        className="flex-1 py-3 rounded-xl font-bold text-white bg-surface-ground hover:bg-surface-elevated transition-all"
                    >
                        Back
                    </button>
                    <button 
                        onClick={handleGenerate}
                        disabled={generating || selectedCourts.length === 0}
                        className="flex-2 py-3 px-8 rounded-xl font-bold text-content-inverse bg-brand hover:bg-brand-light transition-all disabled:opacity-50 shadow-lg shadow-brand/20 flex items-center justify-center gap-2"
                    >
                        {generating ? <Loader2 size={20} className="animate-spin"/> : <RefreshCcw size={20}/>}
                        {generating ? 'Calculating Bracket...' : 'Generate Advanced Schedule'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AutoMatchSuggestions = ({ tournament, matches, categoryId }: { tournament: Tournament, matches: Match[], categoryId: string | null }) => {
    const [suggestions, setSuggestions] = useState<any[]>([]);

    useEffect(() => {
        // Find QF, Play-In, SF, Final matches
        const qfMatches = matches.filter(m => m.roundName?.toLowerCase().includes('quarter') && m.stage !== 'GROUP');
        const playInMatches = matches.filter(m => m.roundName?.toLowerCase().includes('play-in') && m.stage !== 'GROUP');
        const sfMatches = matches.filter(m => m.roundName?.toLowerCase().includes('semi') && m.stage !== 'GROUP');
        const fMatches = matches.filter(m => m.roundName?.toLowerCase() === 'final' || m.roundName?.toLowerCase() === 'finals');

        let newSuggestions: any[] = [];
        
        const prereqMatches = [...qfMatches, ...playInMatches];
        if (prereqMatches.length > 0 && prereqMatches.every(m => (m.status === 'COMPLETED' || String(m.status).toUpperCase() === 'FINISHED') && m.winnerTeamId) && sfMatches.length === 0) {
            const winners = prereqMatches.map(m => m.winnerTeamId).filter(Boolean) as string[];
            const winnerTeams = winners.map(id => tournament.teams?.find(t => t.id === id)).filter(Boolean) as Team[];
            
            // Check cross-group allowance (default to within group)
            const groups = [...new Set(winnerTeams.map(t => t.groupId || 'A'))];
            if (groups.length > 1) {
                groups.forEach((g) => {
                    const groupWinners = winnerTeams.filter(t => (t.groupId || 'A') === g);
                    for (let i = 0; i < groupWinners.length - 1; i += 2) {
                        newSuggestions.push({
                            id: `sf-${g}-${i}`,
                            type: 'Semi-Final',
                            team1Id: groupWinners[i].id,
                            team2Id: groupWinners[i+1].id,
                            team1Name: groupWinners[i].name,
                            team2Name: groupWinners[i+1].name,
                            roundName: `Semi-Final (Group ${g})`,
                            court: tournament.courts?.[0] || 'TBD',
                            scheduledTime: new Date(Date.now() + 3600*1000).toISOString().slice(0, 16)
                        });
                    }
                });
            } else {
                for (let i = 0; i < winnerTeams.length - 1; i += 2) {
                    newSuggestions.push({
                        id: `sf-${i}`,
                        type: 'Semi-Final',
                        team1Id: winnerTeams[i].id,
                        team2Id: winnerTeams[i+1].id,
                        team1Name: winnerTeams[i].name,
                        team2Name: winnerTeams[i+1].name,
                        roundName: `Semi-Final ${newSuggestions.length + 1}`,
                        court: tournament.courts?.[0] || 'TBD',
                        scheduledTime: new Date(Date.now() + 3600*1000).toISOString().slice(0, 16)
                    });
                }
            }
        }

        if (sfMatches.length > 0 && sfMatches.every(m => (m.status === 'COMPLETED' || String(m.status).toUpperCase() === 'FINISHED') && m.winnerTeamId) && fMatches.length === 0) {
            const sfWinners = sfMatches.map(m => m.winnerTeamId).filter(Boolean) as string[];
            const winnerTeams = sfWinners.map(id => tournament.teams?.find(t => t.id === id)).filter(Boolean) as Team[];
            
            const groups = [...new Set(winnerTeams.map(t => t.groupId || 'A'))];
            if (groups.length > 1) {
                groups.forEach((g) => {
                    const groupWinners = winnerTeams.filter(t => (t.groupId || 'A') === g);
                    if (groupWinners.length >= 2) {
                        newSuggestions.push({
                            id: `f-${g}`,
                            type: 'Final',
                            team1Id: groupWinners[0].id,
                            team2Id: groupWinners[1].id,
                            team1Name: groupWinners[0].name,
                            team2Name: groupWinners[1].name,
                            roundName: `Final (Group ${g})`,
                            court: tournament.courts?.[0] || 'TBD',
                            scheduledTime: new Date(Date.now() + 3600*1000 * 2).toISOString().slice(0, 16)
                        });
                    }
                });
            } else {
                 if (winnerTeams.length >= 2) {
                     newSuggestions.push({
                        id: `f-0`,
                        type: 'Final',
                        team1Id: winnerTeams[0].id,
                        team2Id: winnerTeams[1].id,
                        team1Name: winnerTeams[0].name,
                        team2Name: winnerTeams[1].name,
                        roundName: 'Final',
                        court: tournament.courts?.[0] || 'TBD',
                        scheduledTime: new Date(Date.now() + 3600*1000 * 2).toISOString().slice(0, 16)
                     });
                 }
            }
        }
        
        setSuggestions(newSuggestions);
    }, [matches, tournament, categoryId]);

    const handleAccept = async (suggestion: any) => {
        try {
            let actualCat = categoryId;
            if (!actualCat && suggestion.team1Id) {
                const t1 = tournament.teams?.find(t => t.id === suggestion.team1Id);
                if (t1 && t1.categoryId) actualCat = t1.categoryId;
            }
            await addKnockoutMatch(
                tournament.id,
                actualCat,
                suggestion.roundName,
                suggestion.team1Id,
                suggestion.team2Id,
                new Date(suggestion.scheduledTime).toISOString(),
                suggestion.court
            );
            setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
        } catch (e) {
            console.error("Failed to accept suggestion:", e);
            toast.error("Couldn't create this match", "Please try again.");
        }
    };

    const handleDismiss = (id: string) => {
        setSuggestions(prev => prev.filter(s => s.id !== id));
    };

    const updateSuggestion = (id: string, field: string, value: string) => {
        setSuggestions(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    if (suggestions.length === 0) return null;

    return (
        <div className="bg-[#1e293b] border border-[#4D78FF]/30 rounded-xl p-6 mb-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#4D78FF] animate-pulse rounded"></span>
                Intelligent Suggestions
            </h3>
            <p className="text-sm text-gray-400 mb-6">Based on completed matches, the following slots are suggested.</p>
            
            <div className="space-y-4">
                {suggestions.map((s, idx) => (
                    <div key={s.id} className="bg-[#0f172a] rounded-lg p-4 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1">
                            <div className="font-bold text-[#4D78FF] uppercase tracking-widest text-xs mb-1">{s.roundName}</div>
                            <div className="text-lg font-black text-white">{s.team1Name} <span className="text-gray-500 text-sm mx-2">vs</span> {s.team2Name}</div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                             <div>
                                 <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Date & Time</label>
                                 <input 
                                     type="datetime-local" 
                                     value={s.scheduledTime} 
                                     onChange={(e) => updateSuggestion(s.id, 'scheduledTime', e.target.value)}
                                     className="bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-2 text-white text-sm w-full sm:w-auto"
                                 />
                             </div>
                             <div>
                                 <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Court</label>
                                 <select 
                                     value={s.court} 
                                     onChange={(e) => updateSuggestion(s.id, 'court', e.target.value)}
                                     className="bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-2 text-white text-sm w-full sm:w-auto min-w-[120px]"
                                 >
                                     {tournament.courts?.map(c => <option key={c} value={c}>{c}</option>) || <option value="TBD">TBD</option>}
                                 </select>
                             </div>
                        </div>
                        <div className="flex items-center gap-2 mt-4 md:mt-0">
                            <button onClick={() => handleDismiss(s.id)} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg font-bold text-sm transition-colors border border-white/10">Dismiss</button>
                            <button onClick={() => handleAccept(s)} className="px-4 py-2 bg-[#4D78FF] hover:bg-[#4D78FF] text-white rounded-lg font-bold text-sm transition-colors shadow-lg shadow-[#4D78FF]/20">Accept</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ScheduleTab = ({ tournament, categoryId }: { tournament: Tournament; categoryId: string | null }) => {
    const { matches: globalMatches } = useTournamentMatches(tournament.id);
    const [editingMatch, setEditingMatch] = useState<Match | null>(null);
    const [isSavingMatch, setIsSavingMatch] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
    const [showAutoSchedule, setShowAutoSchedule] = useState(false);
    const [generateConfig, setGenerateConfig] = useState<any>(null);
    const [generateError, setGenerateError] = useState('');

    const filteredMatches = (globalMatches || []).filter(m => isMatchInCategory(m, categoryId, tournament));
  const missingMatches = (globalMatches || []).filter(m => m.roundName && m.roundName.includes('Round of'));

    const handleGenerateClick = () => {
        setShowAutoSchedule(true);
    };

    const handleAutoGenerate = (config: any) => {
        setGenerateConfig(config);
        if (filteredMatches.length > 0) {
            setShowGenerateConfirm(true);
        } else {
            setShowGenerateConfirm(true);
        }
    };

    const executeGenerate = async () => {
        setGenerating(true);
        setGenerateError('');
        try {
            await generateSchedule(tournament.id, undefined, { ...generateConfig, categoryId });
            setShowGenerateConfirm(false);
            setShowAutoSchedule(false);
            setGenerateConfig(null);
        } catch(e: any) {
            console.error(e);
            setGenerateError(e.message || "Failed to generate schedule. Ensure you have accepted teams.");
        } finally {
            setGenerating(false);
        }
    };

    const handleNextMexicanoRound = async () => {
        setGenerating(true);
        try {
            await appendNewMexicanoRound(tournament.id);
        } catch(e) {
            console.error(e);
            alert("Failed to generate next Mexicano round.");
        } finally {
            setGenerating(false);
        }
    };

    const handleConfirmGenerate = () => {
        executeGenerate();
    };

    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        
        let yOffset = 20;

        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text(`${tournament.name} - Official Schedule`, 14, yOffset);
        yOffset += 10;
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, yOffset);
        yOffset += 15;

        const catsToRender = categoryId 
            ? [tournament.categories?.find(c => c.id === categoryId)].filter(Boolean)
            : (tournament.categories || []);

        if (catsToRender.length > 0) {
            catsToRender.forEach((cat, index) => {
                if (!cat) return;
                const matches = filteredMatches.filter(m => m.categoryId === cat.id).sort((a,b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || ''));
                if (matches.length === 0) return;

                if (index > 0) {
                    yOffset += 10; // Extra spacing between categories
                }

                doc.setFontSize(14);
                doc.setFont("helvetica", "bold");
                doc.text(cat.name.toUpperCase(), 14, yOffset);
                yOffset += 5;

                const tableData = matches.map(m => {
                    const t1 = (tournament.teams || []).find(t => t.id === m.team1Id)?.name || m.team1Name || 'TBD';
                    const t2 = (tournament.teams || []).find(t => t.id === m.team2Id)?.name || m.team2Name || 'TBD';
                    const time = m.scheduledTime ? new Date(m.scheduledTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'TBD';
                    return [time, m.roundName || '-', m.court || 'TBD', `${t1} vs ${t2}`];
                });

                autoTable(doc, {
                    startY: yOffset,
                    head: [['Time', 'Round', 'Court', 'Matchup']],
                    body: tableData,
                    theme: 'grid',
                    headStyles: { fillColor: [77, 120, 255] },
                    margin: { top: 10 },
                });
                
                yOffset = (doc as any).lastAutoTable.finalY + 15;
            });
        } else {
            const matches = [...filteredMatches].sort((a,b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || ''));
            const tableData = matches.map(m => {
                const t1 = (tournament.teams || []).find(t => t.id === m.team1Id)?.name || m.team1Name || 'TBD';
                const t2 = (tournament.teams || []).find(t => t.id === m.team2Id)?.name || m.team2Name || 'TBD';
                const time = m.scheduledTime ? new Date(m.scheduledTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'TBD';
                return [time, m.roundName || '-', m.court || 'TBD', `${t1} vs ${t2}`];
            });

            autoTable(doc, {
                startY: yOffset,
                head: [['Time', 'Round', 'Court', 'Matchup']],
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: [77, 120, 255] },
            });
        }

        doc.save(`${tournament.name.replace(/\s+/g, '_')}_Schedule.pdf`);
    };

    const handleSaveEdit = async () => {
        if (!editingMatch) return;
        
        setIsSavingMatch(true);
        try {
            const currentCategoryForEdit = (editingMatch.categoryId || categoryId) ? tournament.categories?.find(c => c.id === (editingMatch.categoryId || categoryId)) : null;
            const isAmericanoMatch = tournament.format === 'AMERICANO' || 
                                   tournament.format === 'MEXICANO' || 
                                   currentCategoryForEdit?.format === 'AMERICANO' || 
                                   currentCategoryForEdit?.format === 'MEXICANO' ||
                                   (editingMatch.team1PlayerIds && editingMatch.team1PlayerIds.length > 0);

            if (isAmericanoMatch) {
                await updateMatchDetails(tournament.id, editingMatch.id, {
                    scheduledTime: editingMatch.scheduledTime,
                    scheduledStartTime: editingMatch.scheduledTime,
                    court: editingMatch.court,
                    team1PlayerIds: editingMatch.team1PlayerIds || [],
                    team2PlayerIds: editingMatch.team2PlayerIds || [],
                    team1Name: editingMatch.team1Name || 'TBD',
                    team2Name: editingMatch.team2Name || 'TBD'
                });
            } else {
                const t1 = tournament.teams?.find((t: any) => t.id === editingMatch.team1Id);
                const t2 = tournament.teams?.find((t: any) => t.id === editingMatch.team2Id);
                await updateMatchDetails(tournament.id, editingMatch.id, { 
                    scheduledTime: editingMatch.scheduledTime,
                    scheduledStartTime: editingMatch.scheduledTime,
                    court: editingMatch.court,
                    team1Id: editingMatch.team1Id,
                    team2Id: editingMatch.team2Id,
                    team1Name: t1 ? t1.name : (editingMatch.team1Name || ''),
                    team2Name: t2 ? t2.name : (editingMatch.team2Name || ''),
                    team1PlayerNames: t1 ? [t1.player1?.name, t1.player2?.name].filter(Boolean).join(' & ') : (editingMatch.team1PlayerNames || ''),
                    team2PlayerNames: t2 ? [t2.player1?.name, t2.player2?.name].filter(Boolean).join(' & ') : (editingMatch.team2PlayerNames || '')
                });
            }
            setEditingMatch(null);
        } catch (error) {
            console.error("Failed to save match edit:", error);
            alert("Failed to save changes. Please try again.");
        } finally {
            setIsSavingMatch(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between gap-4 print:hidden">
                <h3 className="text-xl font-bold text-white">Match Schedule</h3>
                <div className="flex gap-2">
                    <button onClick={handleDownloadPDF} className="bg-surface-elevated hover:bg-white/10 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors border border-white/5">
                        <Download size={16}/> PDF
                    </button>
                    {tournament.format === TournamentFormat.MEXICANO && (
                        <button onClick={handleNextMexicanoRound} disabled={generating} className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg shadow-purple-600/20">
                            {generating ? <Loader2 size={16} className="animate-spin"/> : <Plus size={16}/>} 
                            Next Round
                        </button>
                    )}
                    <button onClick={handleGenerateClick} disabled={generating} className="bg-brand hover:bg-brand-light disabled:opacity-50 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg shadow-brand/20">
                        {generating ? <Loader2 size={16} className="animate-spin"/> : <RefreshCcw size={16}/>} 
                        {generating ? 'Generating...' : 'Auto-Schedule'}
                    </button>
                </div>
            </div>
            
            <AutoMatchSuggestions tournament={tournament} matches={filteredMatches} categoryId={categoryId} />

            {/* Print Only Layout */}
            <div className="hidden print:block w-full text-black bg-white p-8">
                <h1 className="text-2xl md:text-3xl font-bold mb-6 text-center">{tournament.name} - Official Schedule</h1>
                {(() => {
                    // Group by Categories if required
                    const catsToRender = categoryId 
                        ? [tournament.categories?.find(c => c.id === categoryId)].filter(Boolean)
                        : (tournament.categories || []);
                    
                    if (catsToRender.length > 0) {
                        return catsToRender.map(cat => {
                            if (!cat) return null;
                            const matches = filteredMatches.filter(m => m.categoryId === cat.id).sort((a,b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || ''));
                            if (matches.length === 0) return null;
                            
                            return (
                                <div key={cat.id} className="mb-8 p-4 border-2 border-black rounded-lg">
                                    <h2 className="text-2xl font-bold mb-4 uppercase">{cat.name}</h2>
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b-2 border-black">
                                                <th className="py-2">Time</th>
                                                <th className="py-2">Round</th>
                                                <th className="py-2">Court</th>
                                                <th className="py-2">Matchup</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {matches.map(m => {
                                                const t1 = (tournament.teams || []).find(t => t.id === m.team1Id)?.name || m.team1Name || 'TBD';
                                                const t2 = (tournament.teams || []).find(t => t.id === m.team2Id)?.name || m.team2Name || 'TBD';
                                                return (
                                                    <tr key={m.id} className="border-b border-gray-300">
                                                        <td className="py-2 pr-4">{new Date(m.scheduledTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                                                        <td className="py-2 pr-4 font-bold">{m.roundName}</td>
                                                        <td className="py-2 pr-4">{m.court}</td>
                                                        <td className="py-2">{t1} <span className="text-gray-500 text-sm mx-1">vs</span> {t2}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        });
                    } else {
                        // Uncategorized
                        const sorted = [...filteredMatches].sort((a,b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || ''));
                        return (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-black">
                                        <th className="py-2">Time</th>
                                        <th className="py-2">Round</th>
                                        <th className="py-2">Court</th>
                                        <th className="py-2">Matchup</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.map(m => {
                                        const t1 = (tournament.teams || []).find(t => t.id === m.team1Id)?.name || m.team1Name || 'TBD';
                                        const t2 = (tournament.teams || []).find(t => t.id === m.team2Id)?.name || m.team2Name || 'TBD';
                                        return (
                                            <tr key={m.id} className="border-b border-gray-300">
                                                <td className="py-2 pr-4">{new Date(m.scheduledTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                                                <td className="py-2 pr-4 font-bold">{m.roundName}</td>
                                                <td className="py-2 pr-4">{m.court}</td>
                                                <td className="py-2">{t1} <span className="text-gray-500 text-sm mx-1">vs</span> {t2}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        );
                    }
                })()}
            </div>

            {showGenerateConfirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-surface-card rounded-2xl p-6 max-w-md w-full border border-white/10 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-2">Generate Brackets?</h3>
                        <p className="text-content-secondary mb-6">
                            This will overwrite the existing schedule and delete previous brackets. This action cannot be undone.
                        </p>
                        {generateError && <p className="text-accent-live text-sm mb-4">{generateError}</p>}
                        <div className="flex gap-3">
                            <button 
                                onClick={() => { setShowGenerateConfirm(false); setGenerateError(''); }}
                                className="flex-1 py-3 rounded-xl font-bold text-white bg-surface-elevated hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleConfirmGenerate}
                                disabled={generating}
                                className="flex-1 py-3 rounded-xl font-bold text-white bg-accent-live hover:bg-red-600 transition-colors disabled:opacity-50"
                            >
                                {generating ? 'Generating...' : 'Confirm & Generate'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid gap-3 print:hidden">
                {showAutoSchedule && (
                    <AutoScheduleWizard 
                        tournament={tournament}
                        generating={generating}
                        onCancel={() => setShowAutoSchedule(false)}
                        onGenerate={handleAutoGenerate}
                        categoryId={categoryId}
                    />
                )}
                {(() => {
                    const sortedAll = [...filteredMatches].sort((a,b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || ''));
                    
                    const hasGroups = sortedAll.some(m => !!m.group || (m.roundName && m.roundName.startsWith('Group ')));
                    
                    if (!hasGroups) {
                        return sortedAll.map(m => {
                            const t1 = (tournament.teams || []).find(t => t.id === m.team1Id)?.name || m.team1Name || 'TBD';
                            const t2 = (tournament.teams || []).find(t => t.id === m.team2Id)?.name || m.team2Name || 'TBD';
                            return (
                                <Card key={m.id} variant="panel" className="p-4 flex flex-col md:flex-row justify-between items-center gap-4 hover:border-brand/30 transition-colors group cursor-pointer" onClick={() => setEditingMatch(m)}>
                                    <div className="flex-1 w-full text-center md:text-left">
                                        <div className="text-brand text-xs font-bold uppercase tracking-wider mb-1">{m.roundName}</div>
                                        <div className="text-white font-medium text-lg flex items-center justify-center md:justify-start gap-3">
                                            <span className={m.winnerTeamId === m.team1Id ? 'text-accent-success' : ''}>{t1}</span>
                                            <span className="text-content-muted text-sm">vs</span>
                                            <span className={m.winnerTeamId === m.team2Id ? 'text-accent-success' : ''}>{t2}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between w-full md:w-auto gap-4 text-sm text-content-secondary">
                                        <div className="flex items-center gap-2 flex-1 md:flex-initial justify-center md:justify-start"><Calendar size={14}/> {new Date(m.scheduledTime).toLocaleString([], { year: '2-digit', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                                        <Badge variant="neutral" className="font-mono">{m.court}</Badge>
                                        <button onClick={(e) => { e.stopPropagation(); setEditingMatch(m); }} className="p-2 bg-surface-ground rounded-lg text-content-muted hover:text-white hover:bg-surface-elevated transition-all"><Edit3 size={16}/></button>
                                    </div>
                                </Card>
                            );
                        });
                    }

                    const grouped = sortedAll.reduce((acc, m) => {
                        let g = m.group;
                        if (!g && m.roundName && m.roundName.startsWith('Group ')) {
                            g = m.roundName.replace('Group ', '');
                            g = g.replace(' (Reverse)', '');
                        }
                        g = g || 'Knockouts';
                        if (!acc[g]) acc[g] = [];
                        acc[g].push(m);
                        return acc;
                    }, {} as Record<string, Match[]>);

                    const groupKeys = Object.keys(grouped).sort((a,b) => {
                        if (a === 'Knockouts') return 1;
                        if (b === 'Knockouts') return -1;
                        return a.localeCompare(b);
                    });

                    return groupKeys.map(k => (
                        <div key={k} className="mb-6">
                            <h4 className="text-sm font-bold text-content-secondary uppercase tracking-widest mb-3 border-b border-white/10 pb-2">{k === 'Knockouts' ? 'Knockout Phase' : `Group ${k}`}</h4>
                            <div className="grid gap-3">
                                {grouped[k].map(m => {
                                    const t1 = (tournament.teams || []).find(t => t.id === m.team1Id)?.name || m.team1Name || 'TBD';
                                    const t2 = (tournament.teams || []).find(t => t.id === m.team2Id)?.name || m.team2Name || 'TBD';
                                    return (
                                        <Card key={m.id} variant="panel" className="p-4 flex flex-col md:flex-row justify-between items-center gap-4 hover:border-brand/30 transition-colors group cursor-pointer" onClick={() => setEditingMatch(m)}>
                                            <div className="flex-1 w-full text-center md:text-left">
                                                <div className="text-brand text-xs font-bold uppercase tracking-wider mb-1">{m.roundName}</div>
                                                <div className="text-white font-medium text-lg flex items-center justify-center md:justify-start gap-3">
                                                    <span className={m.winnerTeamId === m.team1Id ? 'text-accent-success' : ''}>{t1}</span>
                                                    <span className="text-content-muted text-sm">vs</span>
                                                    <span className={m.winnerTeamId === m.team2Id ? 'text-accent-success' : ''}>{t2}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between w-full md:w-auto gap-4 text-sm text-content-secondary">
                                                <div className="flex items-center gap-2 flex-1 md:flex-initial justify-center md:justify-start"><Calendar size={14}/> {new Date(m.scheduledTime).toLocaleString([], { year: '2-digit', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                                                <Badge variant="neutral" className="font-mono">{m.court}</Badge>
                                                <button onClick={(e) => { e.stopPropagation(); setEditingMatch(m); }} className="p-2 bg-surface-ground rounded-lg text-content-muted hover:text-white hover:bg-surface-elevated transition-all"><Edit3 size={16}/></button>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    ));
                })()}
                {filteredMatches.length === 0 && (
                    <div className="text-center py-10 text-content-muted border border-dashed border-white/10 rounded-xl">
                        No matches scheduled yet. Use Auto-Schedule to generate.
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {editingMatch && (
                <Sheet
                    isOpen={true}
                    onClose={() => setEditingMatch(null)}
                    title="Edit Match"
                    description="Update match details, schedule, and court."
                    size="sm"
                    footer={
                        <button onClick={handleSaveEdit} disabled={isSavingMatch} className="w-full bg-brand text-content-inverse py-3 rounded-lg font-bold hover:bg-brand-light transition-colors shadow-lg shadow-brand/20 disabled:opacity-50 flex items-center justify-center">
                            {isSavingMatch ? <Loader2 size={20} className="animate-spin" /> : "Save Details"}
                        </button>
                    }
                >
                    <div className="space-y-4">
                        <div className="bg-surface-ground p-3 rounded-lg mb-4 space-y-3">
                            <div>
                                <div className="text-xs text-content-muted uppercase font-bold mb-1">Match ID</div>
                                <div className="text-content-secondary text-xs font-mono">{editingMatch.id}</div>
                            </div>
                            <div>
                                <div className="text-xs text-content-muted uppercase font-bold mb-1 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-accent-live animate-pulse"></span>
                                    OBS Broadcast Link
                                </div>
                                <div className="flex gap-2">
                                    <input readOnly value={`https://matchup.com.pk/#obs/${tournament.id}/${editingMatch.id}`} className="flex-1 bg-surface-dark border border-white/10 rounded-lg p-2 text-xs text-content-secondary font-mono outline-none" />
                                    <button onClick={() => {
                                        navigator.clipboard.writeText(`https://matchup.com.pk/#obs/${tournament.id}/${editingMatch.id}`);
                                        alert('OBS Link copied!');
                                    }} className="p-2 bg-brand/20 text-brand rounded-lg hover:bg-brand/30 transition-colors" title="Copy OBS Link">
                                        <Copy size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {(() => {
                            const currentCategoryForEdit = (editingMatch.categoryId || categoryId) ? tournament.categories?.find(c => c.id === (editingMatch.categoryId || categoryId)) : null;
                            const isAmericanoMatch = tournament.format === 'AMERICANO' || 
                                                   tournament.format === 'MEXICANO' || 
                                                   currentCategoryForEdit?.format === 'AMERICANO' || 
                                                   currentCategoryForEdit?.format === 'MEXICANO' ||
                                                   (editingMatch.team1PlayerIds && editingMatch.team1PlayerIds.length > 0);

                            if (isAmericanoMatch) {
                                const targetCatId = editingMatch.categoryId || categoryId;
                                let americanoPlayers = (tournament.teams || []).filter(
                                    (t: any) => t.status === 'ACCEPTED' && isTeamInCategory(t, targetCatId, tournament)
                                );
                                if (americanoPlayers.length === 0) {
                                    americanoPlayers = (tournament.teams || []).filter((t: any) => t.status === 'ACCEPTED');
                                }

                                const player1a = editingMatch.team1PlayerIds?.[0] || '';
                                const player1b = editingMatch.team1PlayerIds?.[1] || '';
                                const player2a = editingMatch.team2PlayerIds?.[0] || '';
                                const player2b = editingMatch.team2PlayerIds?.[1] || '';

                                const updatePlayer = (teamIndex: 1 | 2, playerIndex: 0 | 1, val: string) => {
                                    const listKey = teamIndex === 1 ? 'team1PlayerIds' : 'team2PlayerIds';
                                    const currentList = [...(editingMatch[listKey] || [])];
                                    while (currentList.length < 2) currentList.push('');
                                    currentList[playerIndex] = val;

                                    const updatedMatch = { ...editingMatch, [listKey]: currentList };

                                    const t1Ids = teamIndex === 1 ? currentList : (editingMatch.team1PlayerIds || []);
                                    const t2Ids = teamIndex === 2 ? currentList : (editingMatch.team2PlayerIds || []);

                                    const name1 = t1Ids.map(id => id === 'BYE' ? 'BYE' : (tournament.teams?.find(t => t.id === id)?.name || 'BYE')).filter(n => n !== 'BYE').join(' & ') || 'BYE';
                                    const name2 = t2Ids.map(id => id === 'BYE' ? 'BYE' : (tournament.teams?.find(t => t.id === id)?.name || 'BYE')).filter(n => n !== 'BYE').join(' & ') || 'BYE';

                                    updatedMatch.team1Name = name1;
                                    updatedMatch.team2Name = name2;

                                    setEditingMatch(updatedMatch);
                                };

                                return (
                                    <div className="space-y-4">
                                        <div className="bg-surface-panel/40 p-4 rounded-xl border border-white/5 space-y-4">
                                            <h4 className="text-xs font-black text-brand uppercase tracking-wider">TEAM 1 PLAYERS</h4>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-content-muted uppercase tracking-widest mb-1.5">Player 1</label>
                                                    <select
                                                        value={player1a}
                                                        onChange={e => updatePlayer(1, 0, e.target.value)}
                                                        className="w-full bg-surface-dark border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-brand/50 cursor-pointer"
                                                    >
                                                        <option value="">-- Select Player --</option>
                                                        <option value="BYE">BYE (Rest Player)</option>
                                                        {americanoPlayers.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-content-muted uppercase tracking-widest mb-1.5">Player 2</label>
                                                    <select
                                                        value={player1b}
                                                        onChange={e => updatePlayer(1, 1, e.target.value)}
                                                        className="w-full bg-surface-dark border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-brand/50 cursor-pointer"
                                                    >
                                                        <option value="">-- Select Player --</option>
                                                        <option value="BYE">BYE (Rest Player)</option>
                                                        {americanoPlayers.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-surface-panel/40 p-4 rounded-xl border border-white/5 space-y-4">
                                            <h4 className="text-xs font-black text-brand uppercase tracking-wider">TEAM 2 PLAYERS</h4>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-content-muted uppercase tracking-widest mb-1.5">Player 1</label>
                                                    <select
                                                        value={player2a}
                                                        onChange={e => updatePlayer(2, 0, e.target.value)}
                                                        className="w-full bg-surface-dark border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-brand/50 cursor-pointer"
                                                    >
                                                        <option value="">-- Select Player --</option>
                                                        <option value="BYE">BYE (Rest Player)</option>
                                                        {americanoPlayers.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-content-muted uppercase tracking-widest mb-1.5">Player 2</label>
                                                    <select
                                                        value={player2b}
                                                        onChange={e => updatePlayer(2, 1, e.target.value)}
                                                        className="w-full bg-surface-dark border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-brand/50 cursor-pointer"
                                                    >
                                                        <option value="">-- Select Player --</option>
                                                        <option value="BYE">BYE (Rest Player)</option>
                                                        {americanoPlayers.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div className="grid md:grid-cols-2 gap-4 relative">
                                    <div className="relative z-[60]">
                                        <TeamSelector 
                                            tournament={tournament}
                                            categoryId={categoryId}
                                            value={editingMatch.team1Id || ''} 
                                            onChange={(id: string) => setEditingMatch({...editingMatch, team1Id: id})}
                                            label="TEAM 1"
                                            className="bg-surface-dark p-3 rounded-xl"
                                        />
                                    </div>
                                    <div className="relative z-[50]">
                                        <TeamSelector 
                                            tournament={tournament}
                                            categoryId={categoryId}
                                            value={editingMatch.team2Id || ''} 
                                            onChange={(id: string) => setEditingMatch({...editingMatch, team2Id: id})}
                                            label="TEAM 2"
                                            className="bg-surface-dark p-3 rounded-xl"
                                        />
                                    </div>
                                </div>
                            );
                        })()}
                        <Input label="Date & Time" type="datetime-local" value={editingMatch.scheduledTime ? editingMatch.scheduledTime.slice(0, 16) : ''} onChange={(v: string) => setEditingMatch({...editingMatch, scheduledTime: v, scheduledStartTime: v})} />
                        
                        <div className="relative">
                            <label className="block text-xs font-bold text-content-muted uppercase tracking-widest mb-2">Court</label>
                            <select
                                className="w-full bg-surface-dark border border-white/5 rounded-xl p-3 text-white focus:border-brand outline-none appearance-none"
                                style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
                                value={editingMatch.court || ''}
                                onChange={(e) => setEditingMatch({...editingMatch, court: e.target.value})}
                            >
                                <option value="" className="bg-[#1a1d24] text-white">Select Court</option>
                                {getAllTournamentCourts(tournament).map((c: string, i: number) => (
                                    <option key={i} value={c} className="bg-[#1a1d24] text-white">{c}</option>
                                ))}
                            </select>
                            <div className="absolute right-4 top-[38px] pointer-events-none text-content-muted">
                                <ChevronDown size={16} />
                            </div>
                        </div>

                        {editingMatch.auditLogs && editingMatch.auditLogs.length > 0 && (
                            <div className="mt-4 p-4 bg-surface-panel rounded-xl border border-white/5 space-y-3">
                                <h5 className="text-[10px] font-black text-brand uppercase tracking-widest flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse"></span>
                                    Court Override History
                                </h5>
                                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                    {editingMatch.auditLogs.map((log: any, idx: number) => (
                                        <div key={idx} className="bg-surface-dark p-2.5 rounded-lg border border-white/5 text-xs space-y-1">
                                            <div className="flex justify-between text-content-secondary font-medium">
                                                <span>{log.actor || 'Referee'} Override</span>
                                                <span className="text-[10px] text-content-muted">{new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                                            </div>
                                            <div className="text-white">
                                                Shifted: <span className="font-semibold text-content-secondary">{log.oldValue}</span> &rarr; <span className="font-bold text-brand-light">{log.newValue}</span>
                                            </div>
                                            {log.conflictAcknowledged && (
                                                <div className="text-[10px] font-semibold text-[#ff4d4d] bg-[#ff4d4d]/10 px-1.5 py-0.5 rounded inline-block mt-1">
                                                    ⚠️ Confirmed Conflict
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </Sheet>
            )}
        </div>
    )
}

const KnockoutTab = ({ tournament, categoryId }: { tournament: Tournament; categoryId: string | null }) => {
    const { matches: globalMatches } = useTournamentMatches(tournament.id);
    const [editingMatch, setEditingMatch] = useState<Match | null>(null);
    const [isSavingMatch, setIsSavingMatch] = useState(false);
    const [deletingMatch, setDeletingMatch] = useState<Match | null>(null);
    const [correctingScoreMatch, setCorrectingScoreMatch] = useState<Match | null>(null);
    const [showAddMatch, setShowAddMatch] = useState(false);
    const [selectedColKey, setSelectedColKey] = useState<string>('ALL');

    const filteredMatches = (globalMatches || []).filter(m => isMatchInCategory(m, categoryId, tournament));

    const columns: { key: string, title: string, order: number, matches: Match[] }[] = [];
    const columnMap = new Map<string, { key: string, title: string, order: number, matches: Match[] }>();

    filteredMatches.forEach((m: Match) => {
        let colKey = '';
        let title = '';
        let order = 0;

        if (m.stage === 'GROUP') {
            const g = m.group || 'A';
            colKey = `GROUP_${g}`;
            title = `Group ${g}`;
            order = 100 + g.charCodeAt(0);
        } else {
            // It's a knockout round
            // m.round is usually sequential: 1 = group, 2 = QF, 3 = SF, 4 = Final...
            const baseRound = m.round || 999;
            order = 1000 + baseRound;
            
            if (m.roundName?.includes('Quarter-Final')) {
                order = m.round ? 1000 + m.round : 1005; // QF usually round 5
                colKey = `ROUND_${baseRound}_QF`;
                title = 'Quarter-Finals';
            } else if (m.roundName?.includes('Semi-Final')) {
                order = m.round ? 1000 + m.round : 1006;
                colKey = `ROUND_${baseRound}_SF`;
                title = 'Semi-Finals';
            } else if (m.roundName?.includes('Round of 16')) {
                order = m.round ? 1000 + m.round : 1004;
                colKey = `ROUND_${baseRound}_R16`;
                title = 'Round of 16';
            } else if (m.roundName?.includes('Final')) {
                order = m.round ? 1000 + m.round : 1007;
                colKey = `ROUND_${baseRound}_F`;
                title = 'Final';
            } else if (m.roundName?.toLowerCase().includes('round of 8')) {
                colKey = `ROUND_${baseRound}_R8`;
                title = 'Round of 8 / QF';
                order = m.round ? 1000 + m.round : 1005;
            } else if (m.roundName?.toLowerCase().includes('round of 32')) {
                colKey = `ROUND_${baseRound}_R32`;
                title = 'Round of 32';
                order = m.round ? 1000 + m.round : 1003;
            } else {
                colKey = `ROUND_${baseRound}_${m.roundName || 'Match'}`;
                title = m.roundName || `Round ${baseRound}`;
            }
        }

        if (!columnMap.has(colKey)) {
            columnMap.set(colKey, { key: colKey, title, order, matches: [] });
        }
        columnMap.get(colKey)!.matches.push(m);
    });

    const sortedColumns = Array.from(columnMap.values()).sort((a, b) => a.order - b.order);
    const displayColumns = selectedColKey === 'ALL'
        ? sortedColumns
        : sortedColumns.filter(col => col.key === selectedColKey);

    const handleSaveEdit = async () => {
        if (!editingMatch) return;
        
        setIsSavingMatch(true);
        try {
            const currentCategoryForEdit = (editingMatch.categoryId || categoryId) ? tournament.categories?.find(c => c.id === (editingMatch.categoryId || categoryId)) : null;
            const isAmericanoMatch = tournament.format === 'AMERICANO' || 
                                   tournament.format === 'MEXICANO' || 
                                   currentCategoryForEdit?.format === 'AMERICANO' || 
                                   currentCategoryForEdit?.format === 'MEXICANO' ||
                                   (editingMatch.team1PlayerIds && editingMatch.team1PlayerIds.length > 0);

            if (isAmericanoMatch) {
                await updateMatchDetails(tournament.id, editingMatch.id, {
                    scheduledTime: editingMatch.scheduledTime,
                    scheduledStartTime: editingMatch.scheduledTime,
                    court: editingMatch.court,
                    team1PlayerIds: editingMatch.team1PlayerIds || [],
                    team2PlayerIds: editingMatch.team2PlayerIds || [],
                    team1Name: editingMatch.team1Name || 'TBD',
                    team2Name: editingMatch.team2Name || 'TBD'
                });
            } else {
                const t1 = tournament.teams?.find((t: any) => t.id === editingMatch.team1Id);
                const t2 = tournament.teams?.find((t: any) => t.id === editingMatch.team2Id);
                await updateMatchDetails(tournament.id, editingMatch.id, { 
                    scheduledTime: editingMatch.scheduledTime,
                    scheduledStartTime: editingMatch.scheduledTime,
                    court: editingMatch.court,
                    team1Id: editingMatch.team1Id,
                    team2Id: editingMatch.team2Id,
                    team1Name: t1 ? t1.name : (editingMatch.team1Name || ''),
                    team2Name: t2 ? t2.name : (editingMatch.team2Name || ''),
                    team1PlayerNames: t1 ? [t1.player1?.name, t1.player2?.name].filter(Boolean).join(' & ') : (editingMatch.team1PlayerNames || ''),
                    team2PlayerNames: t2 ? [t2.player1?.name, t2.player2?.name].filter(Boolean).join(' & ') : (editingMatch.team2PlayerNames || '')
                });
            }
            setEditingMatch(null);
        } catch (error) {
            console.error("Failed to save match edit:", error);
            alert("Failed to save changes. Please try again.");
        } finally {
            setIsSavingMatch(false);
        }
    };

    const handleDeleteMatch = async () => {
        if (!editingMatch) return;
        setDeletingMatch(editingMatch);
        setEditingMatch(null);
    };

    return (
        <div className="space-y-6 relative">
             <Card variant="panel" className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                 <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Activity className="text-accent-live" /> Live Bracket Console
                    </h3>
                    <p className="text-content-secondary text-sm mt-1">Monitor active matches and manage schedule.</p>
                 </div>
                 <div className="flex flex-wrap gap-4 items-center justify-between md:justify-end w-full md:w-auto text-sm">
                     <div className="flex gap-4 items-center">
                         <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-accent-live animate-pulse"></div> Live</div>
                         <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-content-muted"></div> Finished</div>
                         <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-brand"></div> Scheduled</div>
                     </div>
                     
                     <div className="hidden md:block h-8 w-px bg-white/10 mx-2"></div>
                     
                     <button 
                        onClick={() => setShowAddMatch(true)}
                        className="bg-brand hover:bg-brand-light text-content-inverse px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg shadow-brand/20 ml-auto md:ml-0"
                     >
                         <Plus size={18} /> Add Match
                     </button>
                 </div>
             </Card>

             {sortedColumns.length > 0 && (
                 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111111]/60 border border-white/5 rounded-2xl p-4">
                     <div>
                         <h4 className="text-xs font-black text-brand uppercase tracking-[0.2em]">Select Phase / Group</h4>
                         <p className="text-content-secondary text-[11px] mt-0.5">Filter the list of matches below by group or stage.</p>
                     </div>
                     <div className="relative w-full sm:w-72 shrink-0">
                         <select
                             value={selectedColKey}
                             onChange={(e) => setSelectedColKey(e.target.value)}
                             className="w-full appearance-none bg-[#141414] border border-white/10 hover:border-white/20 text-white text-[11px] font-black uppercase tracking-wider py-3.5 pr-10 pl-4 rounded-xl outline-none focus:border-brand focus:ring-1 focus:ring-brand cursor-pointer shadow-lg transition-all"
                         >
                             <option value="ALL">All Phases & Groups</option>
                             {sortedColumns.map(col => (
                                 <option key={col.key} value={col.key}>
                                     {col.title}
                                 </option>
                             ))}
                         </select>
                         <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                     </div>
                 </div>
             )}

             {sortedColumns.length === 0 ? (
                 <div className="text-center py-20 text-content-muted bg-surface-panel rounded-2xl border border-dashed border-white/10">
                     No matches generated yet. Use the <b>Schedule</b> tab to generate the bracket.
                 </div>
             ) : (
                 <div className="overflow-x-auto pb-6">
                     <div className="flex gap-8 min-w-max px-2">
                         {displayColumns.map(col => (
                             <div key={col.key} className="flex flex-col gap-4 min-w-[280px] w-[320px]">
                                 <div className="text-center bg-surface-ground py-2 rounded-lg border border-white/10 font-bold text-brand-light uppercase tracking-wider text-sm sticky top-0 z-10 shadow-lg">
                                     {col.title}
                                 </div>
                                 <div className="space-y-3">
                                     {col.matches.sort((a,b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()).map(m => {
                                         const t1 = (tournament.teams || []).find(t => t.id === m.team1Id);
                                         const t2 = (tournament.teams || []).find(t => t.id === m.team2Id);
                                         const isLive = m.status === 'IN_PROGRESS';
                                         const isFinished = (m.status === 'COMPLETED' || String(m.status).toUpperCase() === 'FINISHED');
                                         
                                         let p1Sets = m.score?.p1Sets || 0;
                                         let p2Sets = m.score?.p2Sets || 0;
                                         if (m.score?.p1SetScores && m.score?.p2SetScores && (m.score.p1SetScores.length > 0)) {
                                             let p1 = 0, p2 = 0;
                                             m.score.p1SetScores.forEach((s: number, i: number) => {
                                                 const os = m.score.p2SetScores[i] || 0;
                                                 if (s > os) p1++; else if (os > s) p2++;
                                             });
                                             if (p1 + p2 > 0) {
                                                 p1Sets = p1;
                                                 p2Sets = p2;
                                             }
                                         }
                                         if (isFinished && p1Sets === 0 && p2Sets === 0 && (!m.score?.p1Games && !m.score?.p2Games)) {
                                             if (m.winnerTeamId === m.team1Id) p1Sets = 1;
                                             else if (m.winnerTeamId === m.team2Id) p2Sets = 1;
                                         }
                                         
                                         return (
                                             <Card key={m.id} variant={isLive ? 'elevated' : 'panel'} className={`relative transition-all hover:border-brand/50 group cursor-pointer ${isLive ? 'border-accent-live shadow-[0_0_15px_rgba(225,29,72,0.1)]' : 'border-white/10'}`} onClick={() => setEditingMatch(m)}>
                                                 {/* Status Bar */}
                                                 <div className={`h-1 w-full rounded-t-xl ${isLive ? 'bg-accent-live' : isFinished ? 'bg-surface-elevated' : 'bg-brand-dark'}`}></div>
                                                 
                                                 <div className="p-4">
                                                     <div className="flex justify-between items-start mb-3">
                                                         <div className="flex flex-col">
                                                             {m.stage !== 'GROUP' && m.roundName && (
                                                                 <span className="text-[10px] font-bold uppercase tracking-wider text-brand">{m.roundName}</span>
                                                             )}
                                                             <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted">{m.court}</span>
                                                             <span className="text-xs text-content-secondary">{new Date(m.scheduledTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                                         </div>
                                                         {isLive && <Badge variant="live" className="animate-pulse">LIVE</Badge>}
                                                         {isFinished && <Badge variant="neutral">FINAL</Badge>}
                                                     </div>

                                                     {/* Teams */}
                                                     <div className="space-y-2">
                                                         {/* Team 1 */}
                                                         <div className={`flex justify-between items-center p-2 rounded ${m.winnerTeamId === m.team1Id ? 'bg-accent-success/20' : 'bg-surface-ground'}`}>
                                                             <div className="flex items-center gap-2 overflow-hidden">
                                                                 <div className={`w-1 h-8 rounded-full ${m.winnerTeamId === m.team1Id ? 'bg-accent-success' : 'bg-surface-elevated'}`}></div>
                                                                 <span className={`font-bold truncate ${m.winnerTeamId === m.team1Id ? 'text-white' : 'text-content-secondary'}`}>
                                                                     {t1?.name || m.team1Name || 'TBD'}
                                                                 </span>
                                                             </div>
                                                             {(isLive || isFinished) && (
                                                                 <div className="flex gap-2 text-sm font-mono font-bold items-center">
                                                                     {m.score?.p1SetScores?.map((s, i) => (
                                                                         <span key={i} className="text-content-muted">{s}</span>
                                                                     ))}
                                                                     <span className="text-white bg-white/10 px-1.5 py-0.5 rounded text-xs ml-1">{p1Sets}</span>
                                                                     {(isLive || (isFinished && !m.score?.p1SetScores?.length)) && <span className={m.winnerTeamId === m.team1Id ? 'text-accent-live' : 'text-white'}>{m.score?.p1Games ?? 0}</span>}
                                                                 </div>
                                                             )}
                                                         </div>

                                                         {/* Team 2 */}
                                                         <div className={`flex justify-between items-center p-2 rounded ${m.winnerTeamId === m.team2Id ? 'bg-accent-success/20' : 'bg-surface-ground'}`}>
                                                             <div className="flex items-center gap-2 overflow-hidden">
                                                                 <div className={`w-1 h-8 rounded-full ${m.winnerTeamId === m.team2Id ? 'bg-accent-success' : 'bg-surface-elevated'}`}></div>
                                                                 <span className={`font-bold truncate ${m.winnerTeamId === m.team2Id ? 'text-white' : 'text-content-secondary'}`}>
                                                                     {t2?.name || m.team2Name || 'TBD'}
                                                                 </span>
                                                             </div>
                                                             {(isLive || isFinished) && (
                                                                 <div className="flex gap-2 text-sm font-mono font-bold items-center">
                                                                     {m.score?.p2SetScores?.map((s, i) => (
                                                                         <span key={i} className="text-content-muted">{s}</span>
                                                                     ))}
                                                                     <span className="text-white bg-white/10 px-1.5 py-0.5 rounded text-xs ml-1">{p2Sets}</span>
                                                                     {(isLive || (isFinished && !m.score?.p2SetScores?.length)) && <span className={m.winnerTeamId === m.team2Id ? 'text-accent-live' : 'text-white'}>{m.score?.p2Games ?? 0}</span>}
                                                                 </div>
                                                             )}
                                                         </div>
                                                     </div>

                                                     {/* Actions */}
                                                     <div className="mt-4 pt-3 border-t border-white/10 flex justify-end">
                                                         <button 
                                                            onClick={() => setEditingMatch(m)}
                                                            className="text-xs font-bold text-brand-light hover:text-white flex items-center gap-1 bg-brand/10 hover:bg-brand/20 px-3 py-1.5 rounded-lg transition-colors"
                                                         >
                                                             <Edit3 size={12} /> Manage
                                                         </button>
                                                     </div>
                                                 </div>
                                             </Card>
                                         )
                                     })}
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>
             )}

            {deletingMatch && (
                <DeleteMatchConfirmModal 
                    match={deletingMatch}
                    onCancel={() => setDeletingMatch(null)}
                    onDelete={async () => {
                        try {
                            const stageUpper = deletingMatch.stage?.toUpperCase();
                            const isKnockout = stageUpper === "KNOCKOUT" || 
                                              stageUpper === "PLAYOFF" ||
                                              stageUpper === "BRACKET" ||
                                              deletingMatch.stage === "knockout" || 
                                              deletingMatch.stage === "brackets" ||
                                              deletingMatch.roundName?.toLowerCase().includes("final") || 
                                              deletingMatch.roundName?.toLowerCase().includes("semi") || 
                                              deletingMatch.roundName?.toLowerCase().includes("quarter") ||
                                              deletingMatch.roundName?.toLowerCase().includes("playoff") ||
                                              deletingMatch.roundName?.toLowerCase().includes("knockout") ||
                                              deletingMatch.roundName?.toLowerCase().includes("bracket") ||
                                              deletingMatch.roundName?.toLowerCase().includes("round of");
                            if (isKnockout) {
                                await deleteKnockoutMatchCascade(tournament.id, deletingMatch.id);
                            } else {
                                await deleteMatch(tournament.id, deletingMatch.id);
                            }
                            setDeletingMatch(null);
                        } catch (e) {
                            console.error("Failed to delete match:", e);
                            toast.error("Couldn't delete this match", "Please try again.");
                        }
                    }}
                />
            )}

            {correctingScoreMatch && (
                <ScoreCorrectionModal 
                    match={correctingScoreMatch}
                    tournamentId={tournament.id}
                    onCancel={() => setCorrectingScoreMatch(null)}
                    onComplete={() => setCorrectingScoreMatch(null)}
                />
            )}

             {/* Edit Modal (Reused) */}
            {editingMatch && (
                <Sheet
                    isOpen={true}
                    onClose={() => setEditingMatch(null)}
                    title="Manage Match"
                    description="Update match details, teams, and schedule."
                    size="sm"
                    footer={
                        <div className="flex flex-col gap-2 w-full">
                            {editingMatch.status === 'COMPLETED' && (
                                <button onClick={() => { setCorrectingScoreMatch(editingMatch); setEditingMatch(null); }} className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 border border-[#E65C31]/50 border-dashed text-[#E65C31] transition-colors shadow-[0_0_15px_rgba(230,92,49,0.1)] hover:shadow-[0_0_25px_rgba(230,92,49,0.2)]">
                                    <Edit3 size={16}/> Correct Final Score
                                </button>
                            )}
                            <button onClick={handleSaveEdit} disabled={isSavingMatch} className="w-full bg-brand text-content-inverse py-3 rounded-lg font-bold hover:bg-brand-light transition-colors shadow-lg shadow-brand/20 disabled:opacity-50 flex items-center justify-center">
                                {isSavingMatch ? <Loader2 size={20} className="animate-spin" /> : "Save Details"}
                            </button>
                            <button onClick={handleDeleteMatch} className="w-full bg-transparent text-accent-error border border-accent-error/30 py-3 rounded-lg font-bold hover:bg-accent-error/10 transition-colors">Delete Match</button>
                        </div>
                    }
                >
                    <div className="space-y-4">
                        <div className="bg-surface-ground p-3 rounded-lg mb-4 space-y-3">
                            <div>
                                <div className="text-xs text-content-muted uppercase font-bold mb-1">Match ID</div>
                                <div className="text-content-secondary text-xs font-mono">{editingMatch.id}</div>
                            </div>
                            <div>
                                <div className="text-xs text-content-muted uppercase font-bold mb-1 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-accent-live animate-pulse"></span>
                                    OBS Broadcast Link
                                </div>
                                <div className="flex gap-2">
                                    <input readOnly value={`https://matchup.com.pk/#obs/${tournament.id}/${editingMatch.id}`} className="flex-1 bg-surface-dark border border-white/10 rounded-lg p-2 text-xs text-content-secondary font-mono outline-none" />
                                    <button onClick={() => {
                                        navigator.clipboard.writeText(`https://matchup.com.pk/#obs/${tournament.id}/${editingMatch.id}`);
                                        alert('OBS Link copied!');
                                    }} className="p-2 bg-brand/20 text-brand rounded-lg hover:bg-brand/30 transition-colors" title="Copy OBS Link">
                                        <Copy size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {(() => {
                            const currentCategoryForEdit = (editingMatch.categoryId || categoryId) ? tournament.categories?.find(c => c.id === (editingMatch.categoryId || categoryId)) : null;
                            const isAmericanoMatch = tournament.format === 'AMERICANO' || 
                                                   tournament.format === 'MEXICANO' || 
                                                   currentCategoryForEdit?.format === 'AMERICANO' || 
                                                   currentCategoryForEdit?.format === 'MEXICANO' ||
                                                   (editingMatch.team1PlayerIds && editingMatch.team1PlayerIds.length > 0);

                            if (isAmericanoMatch) {
                                const targetCatId = editingMatch.categoryId || categoryId;
                                let americanoPlayers = (tournament.teams || []).filter(
                                    (t: any) => t.status === 'ACCEPTED' && isTeamInCategory(t, targetCatId, tournament)
                                );
                                if (americanoPlayers.length === 0) {
                                    americanoPlayers = (tournament.teams || []).filter((t: any) => t.status === 'ACCEPTED');
                                }

                                const player1a = editingMatch.team1PlayerIds?.[0] || '';
                                const player1b = editingMatch.team1PlayerIds?.[1] || '';
                                const player2a = editingMatch.team2PlayerIds?.[0] || '';
                                const player2b = editingMatch.team2PlayerIds?.[1] || '';

                                const updatePlayer = (teamIndex: 1 | 2, playerIndex: 0 | 1, val: string) => {
                                    const listKey = teamIndex === 1 ? 'team1PlayerIds' : 'team2PlayerIds';
                                    const currentList = [...(editingMatch[listKey] || [])];
                                    while (currentList.length < 2) currentList.push('');
                                    currentList[playerIndex] = val;

                                    const updatedMatch = { ...editingMatch, [listKey]: currentList };

                                    const t1Ids = teamIndex === 1 ? currentList : (editingMatch.team1PlayerIds || []);
                                    const t2Ids = teamIndex === 2 ? currentList : (editingMatch.team2PlayerIds || []);

                                    const name1 = t1Ids.map(id => id === 'BYE' ? 'BYE' : (tournament.teams?.find(t => t.id === id)?.name || 'BYE')).filter(n => n !== 'BYE').join(' & ') || 'BYE';
                                    const name2 = t2Ids.map(id => id === 'BYE' ? 'BYE' : (tournament.teams?.find(t => t.id === id)?.name || 'BYE')).filter(n => n !== 'BYE').join(' & ') || 'BYE';

                                    updatedMatch.team1Name = name1;
                                    updatedMatch.team2Name = name2;

                                    setEditingMatch(updatedMatch);
                                };

                                return (
                                    <div className="space-y-4">
                                        <div className="bg-surface-panel/40 p-4 rounded-xl border border-white/5 space-y-4">
                                            <h4 className="text-xs font-black text-brand uppercase tracking-wider">TEAM 1 PLAYERS</h4>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-content-muted uppercase tracking-widest mb-1.5">Player 1</label>
                                                    <select
                                                        value={player1a}
                                                        onChange={e => updatePlayer(1, 0, e.target.value)}
                                                        className="w-full bg-surface-dark border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-brand/50 cursor-pointer"
                                                    >
                                                        <option value="">-- Select Player --</option>
                                                        <option value="BYE">BYE (Rest Player)</option>
                                                        {americanoPlayers.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-content-muted uppercase tracking-widest mb-1.5">Player 2</label>
                                                    <select
                                                        value={player1b}
                                                        onChange={e => updatePlayer(1, 1, e.target.value)}
                                                        className="w-full bg-surface-dark border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-brand/50 cursor-pointer"
                                                    >
                                                        <option value="">-- Select Player --</option>
                                                        <option value="BYE">BYE (Rest Player)</option>
                                                        {americanoPlayers.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-surface-panel/40 p-4 rounded-xl border border-white/5 space-y-4">
                                            <h4 className="text-xs font-black text-brand uppercase tracking-wider">TEAM 2 PLAYERS</h4>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-content-muted uppercase tracking-widest mb-1.5">Player 1</label>
                                                    <select
                                                        value={player2a}
                                                        onChange={e => updatePlayer(2, 0, e.target.value)}
                                                        className="w-full bg-surface-dark border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-brand/50 cursor-pointer"
                                                    >
                                                        <option value="">-- Select Player --</option>
                                                        <option value="BYE">BYE (Rest Player)</option>
                                                        {americanoPlayers.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-content-muted uppercase tracking-widest mb-1.5">Player 2</label>
                                                    <select
                                                        value={player2b}
                                                        onChange={e => updatePlayer(2, 1, e.target.value)}
                                                        className="w-full bg-surface-dark border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-brand/50 cursor-pointer"
                                                    >
                                                        <option value="">-- Select Player --</option>
                                                        <option value="BYE">BYE (Rest Player)</option>
                                                        {americanoPlayers.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div className="grid md:grid-cols-2 gap-4 relative">
                                    <div className="relative z-[60]">
                                        <TeamSelector 
                                            tournament={tournament}
                                            categoryId={categoryId}
                                            value={editingMatch.team1Id || ''} 
                                            onChange={(id: string) => setEditingMatch({...editingMatch, team1Id: id})}
                                            label="TEAM 1"
                                            className="bg-surface-dark p-3 rounded-xl"
                                        />
                                    </div>
                                    <div className="relative z-[50]">
                                        <TeamSelector 
                                            tournament={tournament}
                                            categoryId={categoryId}
                                            value={editingMatch.team2Id || ''} 
                                            onChange={(id: string) => setEditingMatch({...editingMatch, team2Id: id})}
                                            label="TEAM 2"
                                            className="bg-surface-dark p-3 rounded-xl"
                                        />
                                    </div>
                                </div>
                            );
                        })()}

                        <Input label="Date & Time" type="datetime-local" value={editingMatch.scheduledTime ? editingMatch.scheduledTime.slice(0, 16) : ''} onChange={(v: string) => setEditingMatch({...editingMatch, scheduledTime: v, scheduledStartTime: v})} />
                        
                        <div className="relative">
                            <label className="block text-xs font-bold text-content-muted uppercase tracking-widest mb-2">Court</label>
                            <select
                                className="w-full bg-surface-dark border border-white/5 rounded-xl p-3 text-white focus:border-brand outline-none appearance-none"
                                style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
                                value={editingMatch.court || ''}
                                onChange={(e) => setEditingMatch({...editingMatch, court: e.target.value})}
                            >
                                <option value="" className="bg-[#1a1d24] text-white">Select Court</option>
                                {getAllTournamentCourts(tournament).map((c: string, i: number) => (
                                    <option key={i} value={c} className="bg-[#1a1d24] text-white">{c}</option>
                                ))}
                            </select>
                            <div className="absolute right-4 top-[38px] pointer-events-none text-content-muted">
                                <ChevronDown size={16} />
                            </div>
                        </div>
                    </div>
                </Sheet>
            )}

            {/* Add Match Side Panel */}
            {showAddMatch && (
                <AddMatchPanel 
                    tournament={tournament} 
                    categoryId={categoryId}
                    onClose={() => setShowAddMatch(false)} 
                />
            )}
        </div>
    )
}

const TeamSelector = ({ tournament, categoryId, value, onChange, label, className }: any) => {
    const [tab, setTab] = useState<'pool' | 'others'>('pool');
    const [searchQuery, setSearchQuery] = useState('');
    const [externalTeams, setExternalTeams] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    
    // For handling ad-hoc saving explicitly
    const [adHocName, setAdHocName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const tournamentTeams = (tournament.teams || []).filter((t: any) => t.status === 'ACCEPTED' && isTeamInCategory(t, categoryId, tournament));
    
    useEffect(() => {
        if (tab === 'others' && searchQuery.trim().length > 2) {
            setIsSearching(true);
            const debounce = setTimeout(async () => {
                try {
                    const results = await searchGlobalTeams(searchQuery);
                    setExternalTeams(results.filter(r => !tournament.teams?.some((t: any) => t.id === r.id)));
                } catch (e) {
                    console.error(e);
                } finally {
                    setIsSearching(false);
                }
            }, 500);
            return () => clearTimeout(debounce);
        } else {
            setExternalTeams([]);
        }
    }, [searchQuery, tab, tournament.teams]);

    const handleImportExternal = async (externalTeam: Team) => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            const newId = await enrollTeamManually(tournament.id, {
                name: externalTeam.name,
                player1: externalTeam.player1,
                player2: externalTeam.player2,
                categoryId: categoryId || undefined,
                registeredAt: new Date().toISOString()
            });
            onChange(newId);
            setShowDropdown(false);
        } catch (e) {
            console.error(e);
            toast.error("Couldn't add this team", "Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAdHoc = async () => {
        if (isSaving || !adHocName.trim()) return;
        setIsSaving(true);
        try {
            const newId = await enrollTeamManually(tournament.id, {
                name: adHocName.trim(),
                player1: { name: 'TBD', email: '', phone: '', verified: false },
                player2: { name: 'TBD', email: '', phone: '', verified: false },
                categoryId: categoryId || undefined,
                registeredAt: new Date().toISOString()
            });
            onChange(newId);
            setShowDropdown(false);
            setAdHocName('');
        } catch (e) {
            console.error(e);
            toast.error("Couldn't add this team", "Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const currentSelected = value === 'BYE' ? { name: 'BYE', id: 'BYE' } : tournament.teams?.find((t: any) => t.id === value);
    const displayName = currentSelected ? currentSelected.name : '-- Auto-Resolve / TBD --';

    return (
        <div className="relative">
            <label className="block text-content-secondary text-sm mb-1">{label}</label>
            <div 
                className={`w-full bg-surface-ground border border-white/10 rounded-xl p-3 text-white cursor-pointer hover:border-brand transition-all flex justify-between items-center ${showDropdown ? 'border-brand ring-1 ring-brand' : ''} ${className}`}
                onClick={() => setShowDropdown(!showDropdown)}
            >
                <span className="truncate">{displayName}</span>
                <ChevronDown size={16} className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
            </div>

            {showDropdown && (
                <div className="absolute z-50 mt-2 w-[120%] sm:w-[350px] bg-surface-dark border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[400px]">
                    <div className="flex bg-[#111] p-1 gap-1 border-b border-white/10 shrink-0">
                        <button 
                            className={`flex-1 text-xs font-bold py-2 rounded-lg transition-colors ${tab === 'pool' ? 'bg-[#4D78FF] text-white' : 'text-gray-400 hover:text-white'}`}
                            onClick={(e) => { e.stopPropagation(); setTab('pool'); }}
                        >
                            Tournament Pool
                        </button>
                        <button 
                            className={`flex-1 text-xs font-bold py-2 rounded-lg transition-colors ${tab === 'others' ? 'bg-[#4D78FF] text-white' : 'text-gray-400 hover:text-white'}`}
                            onClick={(e) => { e.stopPropagation(); setTab('others'); }}
                        >
                            Others / Global
                        </button>
                    </div>

                    <div className="overflow-y-auto p-2 flex-1">
                        {tab === 'pool' && (
                            <div className="space-y-1">
                                <div 
                                    className="p-3 hover:bg-white/5 rounded-lg cursor-pointer text-sm text-gray-400 italic"
                                    onClick={() => { onChange(''); setShowDropdown(false); }}
                                >
                                    -- Auto-Resolve / TBD --
                                </div>
                                <div 
                                    className="p-3 hover:bg-white/5 rounded-lg cursor-pointer text-sm text-gray-400 italic"
                                    onClick={() => { onChange('BYE'); setShowDropdown(false); }}
                                >
                                    BYE
                                </div>
                                {tournamentTeams.map((t: any) => (
                                    <div 
                                        key={t.id} 
                                        className={`p-3 hover:bg-white/5 rounded-lg cursor-pointer text-sm flex justify-between items-center ${value === t.id ? 'bg-[#4D78FF]/20 text-white' : 'text-gray-300'}`}
                                        onClick={() => { onChange(t.id); setShowDropdown(false); }}
                                    >
                                        <span>{t.name}</span>
                                        {value === t.id && <Check size={14} className="text-[#4D78FF]" />}
                                    </div>
                                ))}
                                {tournamentTeams.length === 0 && <div className="text-center text-xs text-gray-500 py-4">No teams accepted in this pool yet.</div>}
                            </div>
                        )}

                        {tab === 'others' && (
                            <div className="space-y-4 pt-2">
                                <div className="px-2">
                                    <input 
                                        type="text" 
                                        placeholder="Search global database..." 
                                        className="w-full bg-[#111] border border-white/10 rounded-lg p-2 text-sm text-white focus:border-brand outline-none"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onClick={e => e.stopPropagation()}
                                    />
                                    {isSearching && <div className="text-[10px] text-gray-400 mt-2 text-center">Searching database...</div>}
                                </div>
                                
                                {externalTeams.length > 0 && (
                                    <div className="space-y-1">
                                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest px-3">Found Teams</div>
                                        {externalTeams.map((et) => (
                                            <div key={et.id} className="p-2 hover:bg-white/5 rounded-lg flex items-center justify-between group">
                                                <div>
                                                    <div className="text-sm text-white font-bold">{et.name}</div>
                                                    <div className="text-[10px] text-gray-500">From another tournament</div>
                                                </div>
                                                <button 
                                                    disabled={isSaving}
                                                    onClick={(e) => { e.stopPropagation(); handleImportExternal(et); }}
                                                    className="px-3 py-1.5 bg-brand/20 text-brand rounded shadow opacity-0 group-hover:opacity-100 transition-all text-xs font-bold"
                                                >
                                                    Select
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="px-2 pb-2">
                                    <div className="bg-[#111] p-3 rounded-lg border border-white/10 mt-4">
                                        <div className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-2">Manually Add Team</div>
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                placeholder="Enter Ad-hoc Team Name" 
                                                className="flex-1 bg-[#222] border border-white/10 rounded-lg p-2 text-sm text-white focus:border-brand outline-none"
                                                value={adHocName}
                                                onChange={(e) => setAdHocName(e.target.value)}
                                                onClick={e => e.stopPropagation()}
                                            />
                                            <button 
                                                disabled={isSaving || !adHocName.trim()}
                                                onClick={(e) => { e.stopPropagation(); handleAdHoc(); }}
                                                className="px-3 py-2 bg-brand text-white rounded-lg font-bold text-xs disabled:opacity-50"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const AddMatchPanel = ({ tournament, categoryId, onClose }: { tournament: Tournament, categoryId: string | null, onClose: () => void }) => {
    const [name, setName] = useState('');
    const [team1Id, setTeam1Id] = useState('');
    const [team2Id, setTeam2Id] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            let actualCat = categoryId;
            if (!actualCat && team1Id) {
                const t1 = tournament.teams?.find(t => t.id === team1Id);
                if (t1 && t1.categoryId) actualCat = t1.categoryId;
            }
            await addKnockoutMatch(tournament.id, actualCat, name, team1Id, team2Id);
            onClose();
        } catch (e) {
            console.error(e);
            alert("Failed to add match.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Sheet
            isOpen={true}
            onClose={onClose}
            title="Add Match"
            description={tournament.name}
            size="md"
            footer={
                <button 
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full bg-brand hover:bg-brand-light text-content-inverse font-bold py-4 rounded-xl shadow-lg shadow-brand/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
                    Confirm & Add to Bracket
                </button>
            }
        >
            <div className="space-y-6">
                <div className="bg-accent-info/10 border border-accent-info/30 rounded-lg p-4 flex gap-3 items-start">
                    <div className="bg-accent-info/20 p-2 rounded text-accent-info shrink-0">
                        <Activity size={18} />
                    </div>
                    <div className="text-sm text-accent-info/90">
                        <p className="font-bold mb-1">Live Operational Mode</p>
                        <p className="opacity-80 text-xs leading-relaxed">
                            This action injects a new match directly into the live bracket. 
                            Position, round, and dependencies will be auto-resolved by the system.
                        </p>
                    </div>
                </div>

                <Input 
                    label="Match Display Name (Optional)" 
                    value={name} 
                    onChange={setName} 
                    placeholder="e.g. Exhibition Match"
                />

                <div className="space-y-4 pt-2 relative">
                    <h3 className="text-sm font-bold text-content-secondary uppercase tracking-wider border-b border-white/10 pb-2">Participating Teams</h3>
                    
                    <div className="relative z-[60]">
                        <TeamSelector 
                            tournament={tournament}
                            categoryId={categoryId}
                            value={team1Id}
                            onChange={setTeam1Id}
                            label="Team 1"
                        />
                    </div>

                    <div className="relative z-[50]">
                        <TeamSelector 
                            tournament={tournament}
                            categoryId={categoryId}
                            value={team2Id}
                            onChange={setTeam2Id}
                            label="Team 2"
                        />
                    </div>
                </div>
            </div>
        </Sheet>
    );
};

const AdminScoreEditor = ({ tournament, match, onClose }: { tournament: Tournament; match: Match; onClose: () => void }) => {
    return <ScoreCorrectionModal match={match} tournamentId={tournament.id} onCancel={onClose} onComplete={onClose} />;
};

const ExpandableSection = ({ title, matches, defaultExpanded = false, tournament, onEdit }: { title: string, matches: Match[], defaultExpanded?: boolean, tournament: Tournament, onEdit: (match: Match) => void }) => {
    const [expanded, setExpanded] = useState(defaultExpanded);
    
    return (
        <div className="mb-4 overflow-hidden rounded-2xl shadow-xl">
           <button onClick={() => setExpanded(prev => !prev)} className="w-full flex items-center justify-between p-4 md:px-6 bg-[#4D78FF] font-black text-xl text-white transition-colors hover:bg-blue-600">
               <div className="flex items-center gap-3">
                   <span className="tracking-tight italic uppercase">{title}</span>
                   <span className="text-[10px] sm:text-xs font-bold text-[#4D78FF] bg-white px-2 py-0.5 rounded-full shadow">{matches.length} matches</span>
               </div>
               <ChevronDown size={24} className={`transform transition-transform text-white ${expanded ? 'rotate-180' : ''}`} />
           </button>
           {expanded && (
               <div className="p-3 sm:p-5 bg-black/40 border-x border-b border-[#4D78FF]/20 rounded-b-2xl">
                   {matches.length === 0 ? (
                       <div className="text-content-muted text-sm italic py-4 text-center font-medium">No matches found for this stage.</div>
                   ) : (
                       <div className="space-y-4">
                           {matches.map((m: Match) => (
                               <MatchResultCard key={m.id} match={m} teams={tournament.teams || []} tournament={tournament} onEdit={() => onEdit(m)} />
                           ))}
                       </div>
                   )}
               </div>
           )}
        </div>
    );
};

const ResultsTab = ({ tournament, categoryId }: { tournament: Tournament; categoryId: string | null }) => {
    const { matches: globalMatches } = useTournamentMatches(tournament.id);
    const [editingScoreMatch, setEditingScoreMatch] = useState<Match | null>(null);

    const filteredMatches = (globalMatches || []).filter(m => isMatchInCategory(m, categoryId, tournament) && ((m.status === MatchStatus.COMPLETED || String(m.status).toUpperCase() === 'FINISHED') || String(m.status) === 'COMPLETED'));

    const groupMatches = filteredMatches.filter(m => m.stage === 'GROUP');
    const playoffMatches = filteredMatches.filter(m => m.stage === 'PLAYOFF' || m.stage === 'KNOCKOUT');
    
    const playoffByRound: Record<string, Match[]> = {};
    playoffMatches.forEach(m => {
        const key = m.roundName || `Round ${m.round}`;
        if (!playoffByRound[key]) playoffByRound[key] = [];
        playoffByRound[key].push(m);
    });
    
    // Sort descending by round
    const playoffRounds = Object.entries(playoffByRound).sort((a, b) => {
        const roundA = a[1][0]?.round || 0;
        const roundB = b[1][0]?.round || 0;
        return roundB - roundA; 
    });

    const getGroupIdentifier = (m: Match) => {
        let g = m.group;
        if (!g && m.roundName && m.roundName.startsWith('Group ')) {
            g = m.roundName.replace('Group ', '');
            g = g.replace(' (Reverse)', '').trim();
        }
        return g || 'A';
    };

    const groupMatchesByGroup: Record<string, Match[]> = {};
    groupMatches.forEach(m => {
        const key = `Group ${getGroupIdentifier(m)}`;
        if (!groupMatchesByGroup[key]) groupMatchesByGroup[key] = [];
        groupMatchesByGroup[key].push(m);
    });

    const groupRounds = Object.entries(groupMatchesByGroup)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, matches]) => [key, matches.sort((ma, mb) => new Date(mb.scheduledTime).getTime() - new Date(ma.scheduledTime).getTime())] as const);

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-10">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-xl font-black text-white flex items-center gap-2 italic uppercase tracking-tight">
                        <Trophy className="text-[#4D78FF]" size={24} /> Results Archive
                    </h3>
                    <p className="text-content-secondary text-sm mt-1">View completed match records and scores.</p>
                </div>
            </div>

            {playoffRounds.map(([roundName, matches], idx) => (
                <ExpandableSection key={roundName} title={roundName} matches={matches.sort((a, b) => new Date(b.scheduledTime).getTime() - new Date(a.scheduledTime).getTime())} defaultExpanded={idx === 0} tournament={tournament} onEdit={(m) => setEditingScoreMatch(m)} />
            ))}

            {groupRounds.map(([groupName, matches], idx) => (
                <ExpandableSection key={groupName} title={groupName} matches={matches} defaultExpanded={playoffRounds.length === 0 && idx === 0} tournament={tournament} onEdit={(m) => setEditingScoreMatch(m)} />
            ))}

            {filteredMatches.length === 0 && (
                <div className="text-center py-20 flex flex-col items-center justify-center bg-surface-panel rounded-2xl border border-white/5 border-dashed">
                    <History size={48} className="text-white/10 mb-4" />
                    <div className="text-lg font-bold text-white uppercase italic tracking-tight">No Results Yet</div>
                    <div className="text-content-muted text-sm mt-1 max-w-sm mx-auto">
                        Once matches are completed and scored, they will appear here grouped by stage.
                    </div>
                </div>
            )}
            
            {editingScoreMatch && (
                <AdminScoreEditor tournament={tournament} match={editingScoreMatch} onClose={() => setEditingScoreMatch(null)} />
            )}
        </div>
    );
};
