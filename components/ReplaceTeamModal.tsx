import React, { useState } from 'react';
import { Match, Team, Tournament, MatchStatus } from '../types';
import { Sheet } from './ui/Sheet';
import { toast } from './Toast';
import { ChevronRight, ChevronLeft, AlertTriangle, Replace, RefreshCw, Plus, Users } from 'lucide-react';

function Input({ label, value, onChange, type="text", placeholder }: any) {
    return (
        <div className="space-y-1">
            {label && <label className="block text-xs font-bold text-content-muted uppercase tracking-widest">{label}</label>}
            <input 
                type={type}
                className="w-full bg-surface-ground border border-white/10 rounded-xl p-3 text-white focus:border-brand outline-none"
                value={value}
                placeholder={placeholder}
                onChange={e => onChange(e.target.value)}
            />
        </div>
    );
}

interface ReplaceTeamModalProps {
    isOpen: boolean;
    onClose: () => void;
    tournament: Tournament;
    outgoingTeam: Team;
    onConfirm: (incomingTeamData: any) => Promise<void>;
}

export const ReplaceTeamModal: React.FC<ReplaceTeamModalProps> = ({ 
    isOpen, onClose, tournament, outgoingTeam, onConfirm 
}) => {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    
    // Step 2 State
    const [selectionMode, setSelectionMode] = useState<'existing' | 'new'>('new');
    const [selectedExistingTeamId, setSelectedExistingTeamId] = useState('');
    const [newTeamName, setNewTeamName] = useState('');
    const [newPlayer1Name, setNewPlayer1Name] = useState('');
    const [newPlayer2Name, setNewPlayer2Name] = useState('');
    
    // Step 3 State
    const [confirmText, setConfirmText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const affectedMatches = (tournament.matches || []).filter(
        m => m.team1Id === outgoingTeam.id || m.team2Id === outgoingTeam.id
    );

    const handleNext = () => {
        if (step === 2) {
            if (selectionMode === 'new' && (!newTeamName || !newPlayer1Name || !newPlayer2Name)) {
                alert("Please fill in all team details.");
                return;
            }
            if (selectionMode === 'existing' && !selectedExistingTeamId) {
                alert("Please select a team.");
                return;
            }
        }
        setStep(Math.min(3, step + 1) as any);
    };

    const handleBack = () => {
        setStep(Math.max(1, step - 1) as any);
    };

    const handleConfirm = async () => {
        if (confirmText !== 'REPLACE') return;
        setIsSubmitting(true);
        try {
            const incomingTeamData = selectionMode === 'new' ? {
                teamName: newTeamName,
                player1Name: newPlayer1Name,
                player2Name: newPlayer2Name,
            } : {
                teamId: selectedExistingTeamId,
                teamName: tournament.teams?.find(t => t.id === selectedExistingTeamId)?.name || 'Unknown',
                player1Name: tournament.teams?.find(t => t.id === selectedExistingTeamId)?.player1.name || 'P1',
                player2Name: tournament.teams?.find(t => t.id === selectedExistingTeamId)?.player2.name || 'P2',
            };
            await onConfirm(incomingTeamData);
            toast.success("Team replaced", `${outgoingTeam.name} has been replaced across the schedule and standings.`);
            onClose();
        } catch (e) {
            console.error(e);
            toast.error("Couldn't replace this team", "Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Filter available teams (pending or withdrawn)
    const availableWaitlistTeams = (tournament.teams || []).filter(
        t => t.status === 'PENDING' || t.status === 'REJECTED'
    );

    return (
        <Sheet isOpen={isOpen} onClose={onClose} title="Replace Team" description={step === 1 ? 'TEAM BEING REPLACED' : step === 2 ? 'SELECT REPLACEMENT TEAM' : 'CONFIRM REPLACEMENT'} size="md">
            {step === 1 && (
                <div className="space-y-6 animate-in slide-in-from-right-4">
                    <div className="bg-surface-panel border border-white/10 rounded-xl p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-xl font-bold text-white">{outgoingTeam.name}</span>
                            <span className="text-xs bg-white/10 px-2 py-1 rounded text-content-secondary uppercase tracking-wider font-bold">Group {outgoingTeam.groupId || 'Unassigned'}</span>
                        </div>
                        <div className="text-content-secondary text-sm mb-4">
                            Players: {outgoingTeam.player1.name} {outgoingTeam.player2 ? `/ ${outgoingTeam.player2.name}` : ''}
                        </div>
                        <div className="text-brand text-sm font-bold bg-brand/10 p-3 rounded-lg flex items-center gap-2">
                            <RefreshCw size={16} /> {affectedMatches.length} matches scheduled
                        </div>
                    </div>
                    
                    <div className="bg-accent-warning/10 border border-accent-warning/30 rounded-xl p-4 flex gap-3 text-accent-warning">
                        <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                        <div className="text-sm">
                            <p className="font-bold mb-1">Warning Information</p>
                            <p className="opacity-90 leading-relaxed">
                                This team has {affectedMatches.length} scheduled matches. All records will be transferred to the replacement team.
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-4">
                        <button onClick={onClose} className="px-6 py-3 rounded-xl border border-white/10 text-white font-bold hover:bg-white/5 transition-colors">Cancel</button>
                        <button onClick={handleNext} className="px-6 py-3 rounded-xl bg-brand text-white font-bold hover:bg-brand-light flex items-center gap-2 shadow-lg shadow-brand/20">
                            Next <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="space-y-6 animate-in slide-in-from-right-4">
                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={() => setSelectionMode('new')}
                            className={`p-4 rounded-xl border-2 text-left transition-all ${selectionMode === 'new' ? 'border-brand bg-brand/5' : 'border-white/5 bg-surface-panel hover:border-white/20'}`}
                        >
                            <Plus size={24} className={selectionMode === 'new' ? 'text-brand mb-2' : 'text-content-muted mb-2'} />
                            <div className={`font-bold ${selectionMode === 'new' ? 'text-white' : 'text-content-secondary'}`}>Create new team</div>
                        </button>
                        <button 
                            onClick={() => setSelectionMode('existing')}
                            className={`p-4 rounded-xl border-2 text-left transition-all ${selectionMode === 'existing' ? 'border-brand bg-brand/5' : 'border-white/5 bg-surface-panel hover:border-white/20'}`}
                        >
                            <Users size={24} className={selectionMode === 'existing' ? 'text-brand mb-2' : 'text-content-muted mb-2'} />
                            <div className={`font-bold ${selectionMode === 'existing' ? 'text-white' : 'text-content-secondary'}`}>Choose from waitlist</div>
                        </button>
                    </div>

                    <div className="bg-surface-panel border border-white/5 p-5 rounded-xl">
                        {selectionMode === 'new' ? (
                            <div className="space-y-4">
                                <Input label="Team Name" placeholder="e.g. Dream Team" value={newTeamName} onChange={setNewTeamName} />
                                <div className="grid grid-cols-2 gap-4">
                                    <Input label="Player 1 Name" placeholder="Full name" value={newPlayer1Name} onChange={setNewPlayer1Name} />
                                    <Input label="Player 2 Name" placeholder="Full name" value={newPlayer2Name} onChange={setNewPlayer2Name} />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-content-muted uppercase tracking-widest">Select Team</label>
                                {availableWaitlistTeams.length === 0 ? (
                                    <div className="text-sm text-content-secondary py-4 text-center">No available teams on waitlist.</div>
                                ) : (
                                    <select 
                                        className="w-full bg-surface-ground border border-white/10 rounded-xl p-3 text-white focus:border-brand outline-none"
                                        value={selectedExistingTeamId}
                                        onChange={(e) => setSelectedExistingTeamId(e.target.value)}
                                    >
                                        <option value="" disabled>Select a team...</option>
                                        {availableWaitlistTeams.map(t => (
                                            <option key={t.id} value={t.id}>{t.name} ({t.player1.name} & {t.player2?.name})</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-between items-center pt-4">
                        <button onClick={handleBack} className="px-6 py-3 rounded-xl hover:bg-white/5 text-content-secondary hover:text-white font-bold flex items-center gap-2 transition-colors">
                            <ChevronLeft size={18} /> Back
                        </button>
                        <button onClick={handleNext} className="px-6 py-3 rounded-xl bg-brand text-white font-bold hover:bg-brand-light flex items-center gap-2 shadow-lg shadow-brand/20">
                            Next <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="space-y-6 animate-in slide-in-from-right-4">
                    <div className="bg-surface-panel border border-brand/20 rounded-xl p-5 text-center">
                        <div className="flex items-center justify-center gap-4 text-lg">
                            <span className="font-bold text-content-secondary line-through">{outgoingTeam.name}</span>
                            <ChevronRight size={24} className="text-brand" />
                            <span className="font-bold text-brand">{selectionMode === 'new' ? newTeamName : (tournament.teams?.find(t => t.id === selectedExistingTeamId)?.name)}</span>
                        </div>
                    </div>

                    <div className="p-4 bg-surface-ground rounded-xl text-sm space-y-2 text-content-secondary border border-white/5">
                        <p className="font-bold text-white mb-2 uppercase tracking-wide text-xs">This will update:</p>
                        <p>✓ Group {outgoingTeam.groupId || 'stage'} assignment</p>
                        <p>✓ {affectedMatches.length} scheduled matches</p>
                        <p>✓ Standings document ({outgoingTeam.name} removed)</p>
                        <p>✓ Referee dashboard match cards</p>
                        <p>✓ Spectator mode schedule</p>
                        <p>✓ Team management records</p>
                    </div>

                    <div className="bg-accent-warning/10 border border-accent-warning/30 rounded-xl p-4 flex gap-3 text-accent-warning">
                        <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                        <div className="text-sm border-l-2 pl-3 border-accent-warning/50">
                            Completed matches involving {outgoingTeam.name} will have their scores preserved but attributed to the new team. Review these manually after replacement.
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-content-muted uppercase tracking-widest">Type "REPLACE" to confirm:</label>
                        <Input 
                            value={confirmText} 
                            onChange={setConfirmText} 
                            placeholder="REPLACE"
                        />
                    </div>

                    <div className="flex justify-between items-center pt-4">
                        <button onClick={handleBack} disabled={isSubmitting} className="px-6 py-3 rounded-xl hover:bg-white/5 text-content-secondary hover:text-white font-bold flex items-center gap-2 transition-colors">
                            <ChevronLeft size={18} /> Back
                        </button>
                        <button 
                            onClick={handleConfirm} 
                            disabled={confirmText !== 'REPLACE' || isSubmitting}
                            className="px-6 py-3 rounded-xl bg-transparent border border-brand text-brand font-bold hover:bg-brand/10 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {isSubmitting ? <RefreshCw className="animate-spin" size={18} /> : null}
                            Confirm Replace
                        </button>
                    </div>
                </div>
            )}
        </Sheet>
    );
};
