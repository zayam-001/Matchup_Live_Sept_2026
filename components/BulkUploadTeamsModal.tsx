import React, { useState } from 'react';
import { X, Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { Tournament, Team } from '../types';

interface BulkUploadTeamsModalProps {
    isOpen: boolean;
    onClose: () => void;
    tournament: Tournament;
    categoryId: string | null;
    onUpload: (teams: any[]) => Promise<void>;
}

export const BulkUploadTeamsModal: React.FC<BulkUploadTeamsModalProps> = ({
    isOpen,
    onClose,
    tournament,
    categoryId,
    onUpload
}) => {
    const [csvText, setCsvText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');
    const [preview, setPreview] = useState<any[]>([]);

    const category = categoryId ? tournament.categories?.find(c => c.id === categoryId) : null;
    const isAmericanoMode = tournament.format === 'AMERICANO' || category?.format === 'AMERICANO';

    const parseCSVLine = (text: string) => {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (c === '"') {
                if (inQuotes && text[i+1] === '"') {
                    cur += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c === ',' && !inQuotes) {
                result.push(cur);
                cur = '';
            } else {
                cur += c;
            }
        }
        result.push(cur);
        return result.map(s => s.trim());
    };

    const handleParse = () => {
        setError('');
        try {
            const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
            if (lines.length < 2) {
                throw new Error("CSV must contain a header row and at least one data row.");
            }
            const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
            const catMap = new Map();
            if (tournament.categories) {
                tournament.categories.forEach(c => {
                    catMap.set(c.name.toLowerCase().trim(), c.id);
                });
            }
            
            const parsedTeams = lines.slice(1).map((line, idx) => {
                const values = parseCSVLine(line);
                const row: any = {};
                headers.forEach((h, i) => {
                    row[h] = values[i] || '';
                });

                // Robust category mapping
                let rowCatId = categoryId;
                const catValue = (row.category || row.categoryname || row.categoryid || '').toString().toLowerCase().trim();
                
                if (catValue) {
                    // Try to match by name
                    const matchedId = catMap.get(catValue);
                    if (matchedId) {
                        rowCatId = matchedId;
                    } else {
                        // If not found in map, check if it's already a valid category ID
                        const isValidId = tournament.categories?.some(c => c.id === catValue);
                        if (isValidId) {
                            rowCatId = catValue;
                        }
                    }
                }

                if (isAmericanoMode) {
                    if (!row.playername) throw new Error(`Row ${idx + 1}: Missing Player Name`);
                    return {
                        id: 'pending_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                        name: row.playername,
                        player1: {
                            name: row.playername,
                            phone: row.playerphone || '',
                            email: row.playeremail || '',
                            cnic: row.playercnic || ''
                        },
                        player2: { name: '', phone: '', email: '' }, // not used
                        status: 'PENDING',
                        registeredAt: new Date().toISOString(),
                        categoryId: rowCatId || undefined,
                        matchesPlayed: 0,
                        wins: 0,
                        losses: 0,
                        points: 0,
                        setsWon: 0,
                        setsLost: 0,
                        gamesWon: 0,
                        gamesLost: 0,
                        gamesPlayed: 0,
                        gd: 0
                    };
                } else {
                    if (!row.teamname) throw new Error(`Row ${idx + 1}: Missing Team Name`);
                    if (!row.player1name) throw new Error(`Row ${idx + 1}: Missing Player 1 Name`);
                    if (!row.player2name) throw new Error(`Row ${idx + 1}: Missing Player 2 Name`);
                    
                    return {
                        id: 'pending_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                        name: row.teamname,
                        player1: {
                            name: row.player1name,
                            phone: row.player1phone || '',
                            email: row.player1email || '',
                            cnic: row.player1cnic || ''
                        },
                        player2: {
                            name: row.player2name,
                            phone: row.player2phone || '',
                            email: row.player2email || '',
                            cnic: row.player2cnic || ''
                        },
                        status: 'PENDING',
                        registeredAt: new Date().toISOString(),
                        categoryId: rowCatId || undefined,
                        matchesPlayed: 0,
                        wins: 0,
                        losses: 0,
                        points: 0,
                        setsWon: 0,
                        setsLost: 0,
                        gamesWon: 0,
                        gamesLost: 0,
                        gamesPlayed: 0,
                        gd: 0
                    };
                }
            });

            setPreview(parsedTeams);
        } catch (err: any) {
            setError(err.message || "Failed to parse CSV. Please check the format.");
            setPreview([]);
        }
    };

    const handleUpload = async () => {
        if (preview.length === 0) return;
        setIsProcessing(true);
        setError('');
        try {
            await onUpload(preview);
            onClose();
        } catch (err: any) {
            setError(err.message || "Upload failed. Please try again.");
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-center pt-10 sm:pt-20 bg-black/80 backdrop-blur-sm overflow-y-auto pb-20">
            <div className="bg-[#0f1115] w-full max-w-4xl rounded-2xl border border-white/10 shadow-2xl relative flex flex-col h-fit">
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#15181e] rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Upload size={20} className="text-[#4D78FF]" />
                            Bulk Upload {isAmericanoMode ? "Players" : "Teams"}
                        </h2>
                        <p className="text-sm text-content-secondary mt-1">
                            Upload multiple {isAmericanoMode ? "players" : "teams"} at once via CSV. They will be added as PENDING requests for review.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors duration-200">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 space-y-6">
                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                            <AlertCircle size={20} className="text-red-400 mt-0.5 shrink-0" />
                            <p className="text-sm text-red-200">{error}</p>
                        </div>
                    )}

                    <div className="space-y-3">
                        <div className="flex justify-between items-end">
                            <label className="text-sm font-bold text-white">Paste CSV Data</label>
                            <span className="text-xs text-content-muted">
                                Required Columns: {isAmericanoMode ? 
                                    "Player Name, Player Phone, Player Email" : 
                                    "Team Name, Player 1 Name, Player 1 Phone, Player 2 Name, Player 2 Phone"}
                            </span>
                        </div>
                        <textarea 
                            value={csvText}
                            onChange={(e) => setCsvText(e.target.value)}
                            placeholder={isAmericanoMode ? 
                                "Player Name, Player Phone, Player Email, Player CNIC\nJohn Doe, 03001234567, john@example.com," :
                                "Team Name, Player 1 Name, Player 1 Phone, Player 1 Email, Player 2 Name, Player 2 Phone, Player 2 Email\nSmashers, Ali, 0300..., ali@..., Bilal, 0321..., bilal@..."}
                            className="w-full h-48 bg-[#0a0a0c] border border-white/10 rounded-xl p-4 text-sm font-mono text-white focus:outline-none focus:border-[#4D78FF] placeholder-white/20"
                        />
                        <button 
                            onClick={handleParse}
                            disabled={!csvText.trim()}
                            className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 border border-white/10 disabled:opacity-50"
                        >
                            <FileText size={16} />
                            Parse & Preview Data
                        </button>
                    </div>

                    {preview.length > 0 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                            <div className="flex justify-between items-center">
                                <h3 className="font-bold text-white flex items-center gap-2">
                                    <CheckCircle size={16} className="text-[#10B981]" />
                                    Preview ({preview.length} {isAmericanoMode ? "players" : "teams"})
                                </h3>
                            </div>
                            <div className="overflow-x-auto border border-white/5 rounded-xl bg-[#0a0a0c]">
                                <table className="w-full text-sm text-left whitespace-nowrap">
                                    <thead className="text-xs uppercase bg-white/5 text-content-secondary">
                                        <tr>
                                            {!isAmericanoMode && <th className="px-4 py-3 font-semibold border-b border-white/5">Team Name</th>}
                                            <th className="px-4 py-3 font-semibold border-b border-white/5">{isAmericanoMode ? "Player" : "Player 1"}</th>
                                            {!isAmericanoMode && <th className="px-4 py-3 font-semibold border-b border-white/5">Player 2</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 text-content-primary">
                                        {preview.slice(0, 5).map((t, i) => (
                                            <tr key={i} className="hover:bg-white/[0.02]">
                                                {!isAmericanoMode && <td className="px-4 py-3 font-medium text-white">{t.name}</td>}
                                                <td className="px-4 py-3">
                                                    <div>{t.player1.name}</div>
                                                    <div className="text-xs text-content-muted">{t.player1.phone}</div>
                                                </td>
                                                {!isAmericanoMode && (
                                                    <td className="px-4 py-3">
                                                        <div>{t.player2.name}</div>
                                                        <div className="text-xs text-content-muted">{t.player2.phone}</div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {preview.length > 5 && (
                                    <div className="text-center py-3 text-xs text-content-muted bg-white/5 border-t border-white/5">
                                        + {preview.length - 5} more
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={handleUpload}
                                disabled={isProcessing}
                                className="w-full py-4 bg-[#4D78FF] hover:bg-[#3A5BCC] text-white rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(77,120,255,0.3)] hover:shadow-[0_0_30px_rgba(77,120,255,0.5)] flex items-center justify-center gap-2"
                            >
                                {isProcessing ? (
                                    <span className="animate-pulse">Uploading...</span>
                                ) : (
                                    <>
                                        <Upload size={18} />
                                        Upload as PENDING Requests
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
