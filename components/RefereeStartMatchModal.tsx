import React, { useState, useEffect } from 'react';
import { Match, Tournament, MatchStatus } from '../types';
import { getCourtsByVenueIds } from '../services/storage';
import { MapPin, Copy, Check } from 'lucide-react';

interface StartMatchModalProps {
    tournament: Tournament;
    match: Match;
    team1Name: string;
    team2Name: string;
    onClose: () => void;
    onStart: (courtId: string | null, courtName: string | null, conflictAcknowledged?: boolean | null) => void;
}

export function RefereeStartMatchModal({ tournament, match, team1Name, team2Name, onClose, onStart }: StartMatchModalProps) {
    const [step, setStep] = useState<1 | 2>(1);
    const [courts, setCourts] = useState<any[]>([]);
    const [loadingCourts, setLoadingCourts] = useState(false);
    const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [conflictMatch, setConflictMatch] = useState<Match | null>(null);
    const [showConflictConfirm, setShowConflictConfirm] = useState(false);

    useEffect(() => {
        if (step === 2) {
            setLoadingCourts(true);
            const venueIds = tournament.venueIds?.length ? tournament.venueIds : [tournament.venueId];
            getCourtsByVenueIds(venueIds).then(res => {
                setCourts(res);
                setLoadingCourts(false);
            }).catch(() => setLoadingCourts(false));
        }
    }, [step, tournament]);

    const handleCopyObsUrl = () => {
        const url = `https://matchup.com.pk/#obs/${tournament.id}/${match.id}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const handleConfirmStart = (bypassConflict = false) => {
        const c = courts.find(c => c.id === selectedCourtId);
        if (!c) return;

        if (!bypassConflict) {
            // Run conflict detection
            const matchDuration = (tournament.slotDuration || 60) * 60 * 1000;
            const myStart = new Date(match.scheduledTime).getTime();
            const myEnd = myStart + matchDuration;

            const conflicting = (tournament.matches || []).find(other => {
                if (other.id === match.id) return false;
                const statusStr = String(other.status).toUpperCase();
                const isLive = statusStr === 'LIVE' || statusStr === 'IN_PROGRESS' || other.status === MatchStatus.IN_PROGRESS;
                const isScheduled = statusStr === 'SCHEDULED' || other.status === MatchStatus.SCHEDULED || !other.status;
                
                if (!isLive && !isScheduled) return false;

                const otherCourtId = other.actualCourtId ?? other.scheduledCourtId ?? other.courtId;
                const otherCourtName = other.court;

                const isSameCourt = (otherCourtId && otherCourtId === selectedCourtId) ||
                                    (otherCourtName && otherCourtName === c.courtName);

                if (!isSameCourt) return false;

                const otherStart = new Date(other.scheduledTime).getTime();
                const otherEnd = otherStart + matchDuration;

                return myStart < otherEnd && otherStart < myEnd;
            });

            if (conflicting) {
                setConflictMatch(conflicting);
                setShowConflictConfirm(true);
                return;
            }
        }

        onStart(selectedCourtId, c.courtName, bypassConflict);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            {showConflictConfirm && conflictMatch && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
                    <div className="bg-[#1A1A24] border border-[#ff4d4d]/30 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
                        <div className="w-12 h-12 rounded-full bg-[#ff4d4d]/10 flex items-center justify-center mx-auto text-[#ff4d4d]">
                            <span className="font-bold text-lg">⚠️</span>
                        </div>
                        <h4 className="text-white font-bold text-base">Court Conflict Detected</h4>
                        <p className="text-sm text-content-secondary">
                            Court <span className="text-white font-bold">{(courts.find(c => c.id === selectedCourtId))?.courtName || 'Selected Court'}</span> is already assigned to <span className="text-white font-semibold">{conflictMatch.team1Name || conflictMatch.team1PlayerNames || 'Team A'} vs {conflictMatch.team2Name || conflictMatch.team2PlayerNames || 'Team B'}</span> during this time slot.
                        </p>
                        <p className="text-xs text-content-muted">Continue anyway?</p>
                        <div className="flex gap-3 pt-2">
                            <button 
                                onClick={() => { setShowConflictConfirm(false); setConflictMatch(null); }}
                                className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg font-bold text-sm transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => handleConfirmStart(true)}
                                className="flex-1 py-2 bg-[#ff4d4d] hover:bg-[#e03a3a] text-white rounded-lg font-bold text-sm transition-colors shadow-lg shadow-[#ff4d4d]/20"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            <div className="bg-[#13131A] w-full max-w-sm rounded-[16px] border border-brand/15 shadow-2xl p-6">
                
                {step === 1 ? (
                    <div className="space-y-6">
                        <h3 className="text-white font-bold text-lg flex items-center gap-2">
                            <span className="text-brand">▶</span> Start Match?
                        </h3>
                        
                        <div className="bg-[#1A1A24] p-4 rounded-xl border border-[#2A2A38]">
                            <div className="font-bold text-white text-center text-lg">{team1Name}</div>
                            <div className="text-brand/50 text-center text-sm font-bold my-1">VS</div>
                            <div className="font-bold text-white text-center text-lg">{team2Name}</div>
                            <div className="mt-4 pt-4 border-t border-white/5 text-center text-xs text-content-muted">
                                {match.roundName || `Round ${match.round}`} &middot; Scheduled {new Date(match.scheduledTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                        </div>

                        <p className="text-sm text-content-secondary text-center px-4">
                            Starting this match will enable live scoring for this fixture.
                        </p>

                        <div className="flex gap-3 pt-2">
                            <button 
                                onClick={onClose}
                                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => setStep(2)}
                                className="flex-1 py-3 bg-brand hover:bg-brand-light text-content-inverse rounded-xl font-bold transition-colors shadow-lg shadow-brand/20"
                            >
                                Confirm &rarr;
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <h3 className="text-white font-bold text-lg flex items-center gap-2">
                            <MapPin size={20} className="text-brand" /> Assign Court
                        </h3>
                        
                        <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar">
                            {loadingCourts ? (
                                Array.from({length: 3}).map((_, i) => (
                                    <div key={i} className="h-14 bg-[#1A1A24] border border-[#2A2A38] rounded-xl flex items-center px-4 gap-3 animate-pulse">
                                        <div className="w-4 h-4 rounded-full bg-white/10"></div>
                                        <div className="h-4 bg-white/10 rounded w-24"></div>
                                    </div>
                                ))
                            ) : courts.length > 0 ? (
                                courts.map(c => (
                                    <button 
                                        key={c.id}
                                        onClick={() => setSelectedCourtId(c.id)}
                                        className={`w-full h-14 rounded-xl flex items-center px-4 gap-3 transition-colors ${
                                            selectedCourtId === c.id 
                                            ? 'bg-brand/12 border border-brand' 
                                            : 'bg-[#1A1A24] border border-[#2A2A38] hover:border-brand/50'
                                        }`}
                                    >
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                            selectedCourtId === c.id ? 'border-brand' : 'border-white/20'
                                        }`}>
                                            {selectedCourtId === c.id && <div className="w-2 h-2 rounded-full bg-brand" />}
                                        </div>
                                        <span className="text-white font-medium">{c.courtName}</span>
                                    </button>
                                ))
                            ) : (
                                <div className="text-center py-6 text-sm text-content-muted">
                                    No courts found for this venue. Contact your administrator.
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 pt-2 border-t border-white/5">
                            <button 
                                onClick={() => setStep(1)}
                                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-colors"
                            >
                                &larr; Back
                            </button>
                            <button 
                                disabled={!selectedCourtId}
                                onClick={() => handleConfirmStart(false)}
                                className={`flex-1 py-3 rounded-xl font-bold transition-colors ${
                                    selectedCourtId 
                                        ? 'bg-brand hover:bg-brand-light text-content-inverse shadow-lg shadow-brand/20' 
                                        : 'bg-surface-ground text-content-muted cursor-not-allowed'
                                }`}
                            >
                                Start Match
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
