import React, { useState } from 'react';
import { X, Copy, CheckSquare, Square } from 'lucide-react';
import { collection, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/storage';
import { useAuth } from '../hooks/useAuth';
import { Tournament } from '../types';
import { Card } from './ui/Card';

export const CloneTournamentModal = ({ 
    tournaments, 
    onClose, 
    onSuccess 
}: { 
    tournaments: Tournament[], 
    onClose: () => void, 
    onSuccess: (newTournamentId: string) => void 
}) => {
    const { user } = useAuth();
    const [selectedId, setSelectedId] = useState<string>('');
    const [newName, setNewName] = useState<string>('');
    const [cloneFormat, setCloneFormat] = useState(true);
    const [cloneTeams, setCloneTeams] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleClone = async () => {
        if (!selectedId || !newName.trim() || !user) return;
        setIsSubmitting(true);
        try {
            const sourceTournament = tournaments.find(t => t.id === selectedId);
            if (!sourceTournament) throw new Error("Source tournament not found");

            const newTournamentData: any = {
                name: newName.trim(),
                status: 'DRAFT',
                organizerId: user.id,
                organizerEmail: user.email || '',
                adminTag: user.email || '',
                createdAt: new Date().toISOString(),
                // Start empty
                teams: [],
                matches: [], // matches never cloned
            };

            if (cloneFormat) {
                newTournamentData.format = sourceTournament.format;
                newTournamentData.skillLevel = sourceTournament.skillLevel;
                newTournamentData.maxTeams = sourceTournament.maxTeams;
                newTournamentData.entryFee = sourceTournament.entryFee;
                newTournamentData.currency = sourceTournament.currency;
                newTournamentData.venueId = sourceTournament.venueId;
                newTournamentData.courtId = sourceTournament.courtId;
                newTournamentData.courts = sourceTournament.courts || [];
                newTournamentData.categories = sourceTournament.categories || [];
                newTournamentData.groupSize = sourceTournament.groupSize;
                newTournamentData.isMultiCategory = sourceTournament.isMultiCategory;
            } else {
                newTournamentData.format = 'KNOCKOUT';
                newTournamentData.skillLevel = 'BEGINNER';
                newTournamentData.maxTeams = 16;
                newTournamentData.entryFee = 0;
                newTournamentData.currency = 'PKR';
                newTournamentData.venueId = '';
                newTournamentData.courtId = '';
                newTournamentData.courts = [];
            }

            if (cloneTeams) {
                // Copy teams but reset their stats
                newTournamentData.teams = (sourceTournament.teams || []).map(t => ({
                    ...t,
                    status: 'ACCEPTED', // or pending? let's assume accepted if cloned
                    registeredAt: new Date().toISOString(),
                    matchesPlayed: 0,
                    wins: 0,
                    losses: 0,
                    points: 0,
                    setsWon: 0,
                    setsLost: 0,
                    gamesWon: 0,
                    gamesLost: 0,
                    gamesPlayed: 0,
                    gd: 0,
                    pointsScored: 0,
                    pointsConceded: 0,
                    pointDifferential: 0,
                    ties: 0
                }));
            }

            const docRef = await addDoc(collection(db, 'tournaments'), newTournamentData);
            
            // Also need to set a refereePasscode
            await updateDoc(docRef, {
                refereePasscode: Math.floor(100000 + Math.random() * 900000).toString()
            });

            onSuccess(docRef.id);
            onClose();
        } catch (e) {
            console.error("Error cloning tournament:", e);
            alert("Failed to clone tournament.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
            <Card variant="panel" className="w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2"><Copy size={24} className="text-brand"/> Clone Tournament</h2>
                    <button onClick={onClose} className="p-2 text-content-muted hover:text-white transition-colors"><X size={20}/></button>
                </div>

                <div className="space-y-4 mb-8">
                    <div>
                        <label className="block text-xs font-bold text-content-secondary uppercase tracking-wider mb-2">Select Source Tournament</label>
                        <select 
                            value={selectedId} 
                            onChange={e => setSelectedId(e.target.value)}
                            className="w-full bg-surface-ground text-white border border-white/10 p-3 rounded-xl focus:border-brand outline-none"
                        >
                            <option value="">-- Choose a tournament --</option>
                            {tournaments.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-content-secondary uppercase tracking-wider mb-2">New Tournament Name</label>
                        <input 
                            type="text" 
                            value={newName} 
                            onChange={e => setNewName(e.target.value)}
                            placeholder="e.g. Winter Cup 2027"
                            className="w-full bg-surface-ground text-white border border-white/10 p-3 rounded-xl focus:border-brand outline-none"
                        />
                    </div>

                    <div className="flex items-center gap-3 cursor-pointer mt-4" onClick={() => setCloneFormat(!cloneFormat)}>
                        {cloneFormat ? <CheckSquare className="text-brand" size={20}/> : <Square className="text-content-muted" size={20}/>}
                        <span className="text-sm text-white">Clone Format & Categories</span>
                    </div>
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCloneTeams(!cloneTeams)}>
                        {cloneTeams ? <CheckSquare className="text-brand" size={20}/> : <Square className="text-content-muted" size={20}/>}
                        <span className="text-sm text-white">Clone Teams</span>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 bg-surface-ground hover:bg-white/5 text-white font-bold py-3 rounded-xl transition-colors">Cancel</button>
                    <button 
                        onClick={handleClone} 
                        disabled={isSubmitting || !selectedId || !newName.trim()}
                        className="flex-1 bg-brand hover:bg-brand-light disabled:opacity-50 text-content-inverse font-bold py-3 rounded-xl shadow-lg shadow-brand/20 transition-colors"
                    >
                        {isSubmitting ? 'Cloning...' : 'Clone'}
                    </button>
                </div>
            </Card>
        </div>
    );
};
