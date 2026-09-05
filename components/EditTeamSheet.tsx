import React, { useState, useEffect } from 'react';
import { Team, Tournament } from '../types';
import { Sheet } from './ui/Sheet';
import { Edit3, Loader2 } from 'lucide-react';

function Input({ label, value, onChange, type="text", placeholder }: any) {
    return (
        <div className="space-y-1">
            {label && <label className="block text-[10px] font-black text-content-muted uppercase tracking-widest">{label}</label>}
            <input 
                type={type}
                className="w-full bg-surface-ground border border-white/10 rounded-xl p-3 text-white focus:border-brand outline-none transition-colors"
                value={value}
                placeholder={placeholder}
                onChange={e => onChange(e.target.value)}
            />
        </div>
    );
}

interface EditTeamSheetProps {
    isOpen: boolean;
    onClose: () => void;
    tournament: Tournament;
    team: Team | null;
    onConfirm: (name: string, player1Name: string, player2Name?: string) => Promise<void>;
}

export const EditTeamSheet: React.FC<EditTeamSheetProps> = ({ 
    isOpen, onClose, tournament, team, onConfirm 
}) => {
    const [teamName, setTeamName] = useState('');
    const [player1Name, setPlayer1Name] = useState('');
    const [player2Name, setPlayer2Name] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isAmericanoMode = tournament.format === 'AMERICANO';

    useEffect(() => {
        if (team) {
            setTeamName(team.name || '');
            setPlayer1Name(team.player1?.name || '');
            setPlayer2Name(team.player2?.name || '');
        }
    }, [team]);

    if (!team) return null;

    const handleSave = async () => {
        if (isAmericanoMode) {
            if (!player1Name.trim()) {
                alert("Player name cannot be empty.");
                return;
            }
        } else {
            if (!teamName.trim() || !player1Name.trim()) {
                alert("Team Name and Player 1 Name cannot be empty.");
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const finalTeamName = isAmericanoMode ? player1Name.trim() : teamName.trim();
            await onConfirm(
                finalTeamName,
                player1Name.trim(),
                isAmericanoMode ? undefined : player2Name.trim()
            );
            onClose();
        } catch (e) {
            console.error(e);
            alert("Failed to update team details.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Sheet 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Edit Player Names" 
            description="UPDATE NAMES AND REFLECT ACROSS ALL MATCHES" 
            size="sm"
        >
            <div className="space-y-6 pt-4">
                <div className="bg-[#1A1A24] border border-white/5 rounded-2xl p-4 flex items-start gap-3">
                    <div className="p-2 bg-brand/10 text-brand rounded-xl">
                        <Edit3 size={18} />
                    </div>
                    <div>
                        <h4 className="text-white font-bold text-sm">Overwriting Live Matches</h4>
                        <p className="text-xs text-content-secondary mt-1">
                            Saving changes here will immediately overwrite team & player names on any scheduled and in-progress matches.
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    {!isAmericanoMode && (
                        <Input 
                            label="Team Name" 
                            value={teamName} 
                            onChange={setTeamName} 
                            placeholder="Enter Team Name" 
                        />
                    )}

                    <Input 
                        label={isAmericanoMode ? "Player Name" : "Player 1 Name"} 
                        value={player1Name} 
                        onChange={setPlayer1Name} 
                        placeholder="Enter Player 1 Name" 
                    />

                    {!isAmericanoMode && (
                        <Input 
                            label="Player 2 Name" 
                            value={player2Name} 
                            onChange={setPlayer2Name} 
                            placeholder="Enter Player 2 Name" 
                        />
                    )}
                </div>

                <div className="flex gap-3 pt-4 border-t border-white/5">
                    <button 
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold text-sm transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={isSubmitting}
                        className="flex-1 py-3 bg-brand hover:bg-brand-light text-content-inverse rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand/20 disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Saving...
                            </>
                        ) : (
                            'Save Changes'
                        )}
                    </button>
                </div>
            </div>
        </Sheet>
    );
};
