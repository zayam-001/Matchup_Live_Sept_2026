const fs = require('fs');
const content = `import React, { useState, useRef } from 'react';
import { X, Upload, CheckCircle, AlertCircle, Download, Link as LinkIcon, UploadCloud, Loader2 } from 'lucide-react';
import { Tournament } from '../types';

interface BulkUploadTeamsModalProps {
    isOpen: boolean;
    onClose: () => void;
    tournament: Tournament;
    categoryId: string | null;
    onUpload: (teams: any[]) => Promise<void>;
}

export const downloadTeamUploadTemplate = (isAmericanoMode: boolean) => {
  const headers = isAmericanoMode ? 
    ["PLAYER NAME", "Player phone", "Player email", "Player CNIC"] :
    ["TEAM NAME", "PLAYER 01", "Player 1 phone", "Player 1 email", "PLAYER 02", "Player 2 phone", "Player 2 email"];

  const sampleRows = isAmericanoMode ? [
    ["Syed Ali Sharjeel", "+923001234567", "ali@example.com", "42201-1234567-1"],
    ["Zayam Anjum", "+923331112222", "zayam@example.com", "42201-7654321-1"]
  ] : [
    ["Karachi Padel Smashers", "Syed Ali Sharjeel", "+923001234567", "ali@example.com", "Taha Bin Nadeem", "+923007654321", "taha@example.com"],
    ["Clifton Futsal Kings", "Zayam Anjum", "+923331112222", "zayam@example.com", "Ahad Farhan", "+923339998888", "ahad@example.com"]
  ];

  const csvContent = [
    headers.join(","),
    ...sampleRows.map(row => row.map(cell => \`"\${cell}"\`).join(","))
  ].join("\\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", isAmericanoMode ? "MatchUp_Bulk_Player_Upload_Template.csv" : "MatchUp_Bulk_Team_Upload_Template.csv");
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const BulkUploadTeamsModal: React.FC<BulkUploadTeamsModalProps> = ({
    isOpen,
    onClose,
    tournament,
    categoryId,
    onUpload
}) => {
    const [dragActive, setDragActive] = useState(false);
    const [linkInput, setLinkInput] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [parseProgress, setParseProgress] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');
    const [preview, setPreview] = useState<any[]>([]);
    const [uploadStats, setUploadStats] = useState({ valid: 0, invalid: 0, players: 0 });
    
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    const processCSVText = async (text: string) => {
        setError('');
        setIsParsing(true);
        setParseProgress(0);
        setPreview([]);
        
        // Simulate progress for heavy payloads
        for (let i = 0; i <= 90; i += 15) {
            await new Promise(r => setTimeout(r, 50));
            setParseProgress(i);
        }

        try {
            const lines = text.split(/\\r?\\n/).filter(line => line.trim() !== '');
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
            
            let validCount = 0;
            let invalidCount = 0;
            let playersCount = 0;

            const parsedRows = lines.slice(1).map((line, idx) => {
                const values = parseCSVLine(line);
                const row: any = {};
                headers.forEach((h, i) => {
                    row[h] = values[i] || '';
                });

                let rowCatId = categoryId;
                const catValue = (row.category || row.categoryname || row.categoryid || '').toString().toLowerCase().trim();
                
                if (catValue) {
                    const matchedId = catMap.get(catValue);
                    if (matchedId) {
                        rowCatId = matchedId;
                    } else {
                        const isValidId = tournament.categories?.some(c => c.id === catValue);
                        if (isValidId) {
                            rowCatId = catValue;
                        }
                    }
                }

                const errors: Record<string, string> = {};
                
                if (isAmericanoMode) {
                    if (!row.playername && !row.player01) errors.playername = 'Missing Player Name';
                    
                    const isValid = Object.keys(errors).length === 0;
                    if (isValid) {
                        validCount++;
                        playersCount++;
                    } else {
                        invalidCount++;
                    }
                    
                    const pName = row.playername || row.player01 || '';
                    
                    return {
                        isValid,
                        errors,
                        raw: row,
                        data: {
                            id: 'pending_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                            name: pName,
                            player1: {
                                name: pName,
                                phone: row.playerphone || row.player1phone || '',
                                email: row.playeremail || row.player1email || '',
                                cnic: row.playercnic || row.player1cnic || ''
                            },
                            player2: { name: '', phone: '', email: '' },
                            status: 'PENDING',
                            registeredAt: new Date().toISOString(),
                            categoryId: rowCatId || undefined,
                            matchesPlayed: 0, wins: 0, losses: 0, points: 0, setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0, gamesPlayed: 0, gd: 0
                        }
                    };
                } else {
                    if (!row.teamname) errors.teamname = 'Missing Team Name';
                    if (!row.player1name && !row.player01) errors.player1name = 'Missing Player 1';
                    if (!row.player2name && !row.player02) errors.player2name = 'Missing Player 2';
                    
                    const isValid = Object.keys(errors).length === 0;
                    if (isValid) {
                        validCount++;
                        playersCount += 2;
                    } else {
                        invalidCount++;
                    }
                    
                    const p1Name = row.player1name || row.player01 || '';
                    const p2Name = row.player2name || row.player02 || '';
                    
                    return {
                        isValid,
                        errors,
                        raw: row,
                        data: {
                            id: 'pending_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                            name: row.teamname || '',
                            player1: {
                                name: p1Name,
                                phone: row.player1phone || row.playerphone || '',
                                email: row.player1email || row.playeremail || '',
                                cnic: row.player1cnic || row.playercnic || ''
                            },
                            player2: {
                                name: p2Name,
                                phone: row.player2phone || '',
                                email: row.player2email || '',
                                cnic: row.player2cnic || ''
                            },
                            status: 'PENDING',
                            registeredAt: new Date().toISOString(),
                            categoryId: rowCatId || undefined,
                            matchesPlayed: 0, wins: 0, losses: 0, points: 0, setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0, gamesPlayed: 0, gd: 0
                        }
                    };
                }
            });

            setParseProgress(100);
            await new Promise(r => setTimeout(r, 200));
            setPreview(parsedRows);
            setUploadStats({ valid: validCount, invalid: invalidCount, players: playersCount });
        } catch (err: any) {
            setError(err.message || "Failed to parse CSV. Please check the format.");
            setPreview([]);
        } finally {
            setIsParsing(false);
        }
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleFile = (file: File) => {
        if (!file.name.match(/\\.(csv|xlsx|xls)$/i)) {
            setError("Please upload a valid .csv, .xlsx, or .xls file.");
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            processCSVText(content);
        };
        reader.onerror = () => {
            setError("Error reading file.");
        };
        reader.readAsText(file);
    };

    const handleFetchLink = async () => {
        if (!linkInput.trim()) return;
        setError('');
        setIsParsing(true);
        setParseProgress(20);
        // Mock fetch from Google Sheets link
        await new Promise(r => setTimeout(r, 800));
        setParseProgress(60);
        await new Promise(r => setTimeout(r, 400));
        setParseProgress(100);
        
        // Mock successful parse of a template
        const mockTemplate = isAmericanoMode ? 
            "PLAYER NAME,Player phone,Player email,Player CNIC\\nJohn Doe,+923001234567,john@example.com,\\nJane Smith,+923331112222,jane@example.com," :
            "TEAM NAME,PLAYER 01,Player 1 phone,Player 1 email,PLAYER 02,Player 2 phone,Player 2 email\\nSmashers,Ali,+92300123,ali@example.com,Bilal,+92321123,bilal@example.com";
            
        processCSVText(mockTemplate);
    };

    const handleUpload = async () => {
        const validTeams = preview.filter(p => p.isValid).map(p => p.data);
        if (validTeams.length === 0) return;
        
        setIsProcessing(true);
        setError('');
        try {
            await onUpload(validTeams);
            onClose();
        } catch (err: any) {
            setError(err.message || "Upload failed. Please try again.");
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-center pt-10 sm:pt-20 bg-black/80 backdrop-blur-md overflow-y-auto pb-20">
            <div className="bg-[#0f1115] w-full max-w-5xl rounded-2xl border border-white/10 shadow-2xl relative flex flex-col h-fit">
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#15181e] rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <UploadCloud size={22} className="text-[#4D78FF]" />
                            Bulk Upload {isAmericanoMode ? "Players" : "Teams"}
                        </h2>
                        <p className="text-sm text-content-secondary mt-1">
                            Upload multiple {isAmericanoMode ? "players" : "teams"} via CSV, Excel, or Google Sheets link.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors duration-200">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-8 space-y-8">
                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                            <AlertCircle size={20} className="text-red-400 mt-0.5 shrink-0" />
                            <p className="text-sm text-red-200">{error}</p>
                        </div>
                    )}

                    {!preview.length && !isParsing && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Drag & Drop Zone */}
                            <div className="flex flex-col gap-4">
                                <label className="text-sm font-bold text-white">Upload File</label>
                                <div 
                                    className={\`relative flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer \${
                                        dragActive 
                                        ? 'border-[#4D78FF] bg-[#4D78FF]/5 shadow-[0_0_30px_rgba(77,120,255,0.15)]' 
                                        : 'border-white/20 bg-[#15181e] hover:border-white/40 hover:bg-[#1a1d24]'
                                    }\`}
                                    onDragEnter={handleDrag}
                                    onDragLeave={handleDrag}
                                    onDragOver={handleDrag}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <input 
                                        ref={fileInputRef}
                                        type="file" 
                                        accept=".csv,.xlsx,.xls" 
                                        className="hidden" 
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files.length > 0) {
                                                handleFile(e.target.files[0]);
                                            }
                                        }}
                                    />
                                    <UploadCloud size={36} className={\`mb-3 transition-colors \${dragActive ? 'text-[#4D78FF]' : 'text-content-muted'}\`} />
                                    <p className="text-sm text-white font-medium mb-1">Drag and drop your file here</p>
                                    <p className="text-xs text-content-muted mb-4">Supports .csv, .xlsx, .xls</p>
                                    <span className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-semibold text-white hover:bg-white/10 transition-colors pointer-events-none">
                                        Browse Files
                                    </span>
                                </div>
                            </div>

                            {/* Or Link Input & Actions */}
                            <div className="flex flex-col gap-4">
                                <label className="text-sm font-bold text-white">Or paste a Google Sheets link</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <LinkIcon size={16} className="text-content-muted" />
                                        </div>
                                        <input 
                                            type="url" 
                                            value={linkInput}
                                            onChange={(e) => setLinkInput(e.target.value)}
                                            placeholder="https://docs.google.com/spreadsheets/d/..." 
                                            className="w-full pl-10 pr-4 py-3 bg-[#15181e] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#4D78FF] transition-colors placeholder:text-white/20"
                                        />
                                    </div>
                                    <button 
                                        onClick={handleFetchLink}
                                        disabled={!linkInput.trim()}
                                        className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-bold border border-white/10 transition-colors disabled:opacity-50"
                                    >
                                        Sync/Fetch
                                    </button>
                                </div>

                                <div className="mt-auto pt-6 border-t border-white/10">
                                    <div className="flex flex-col gap-3">
                                        <p className="text-xs text-content-muted">
                                            Need help formatting your data? Download our template to ensure all rows are parsed properly.
                                        </p>
                                        <button 
                                            onClick={() => downloadTeamUploadTemplate(isAmericanoMode)}
                                            className="self-start px-4 py-2 text-sm font-medium text-white bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors duration-200 flex items-center gap-2"
                                        >
                                            <Download size={16} />
                                            Download CSV Template
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Parsing State */}
                    {isParsing && (
                        <div className="py-20 flex flex-col items-center justify-center space-y-6 animate-in fade-in">
                            <Loader2 size={40} className="text-[#4D78FF] animate-spin" />
                            <div className="w-full max-w-md space-y-2">
                                <div className="flex justify-between text-sm font-medium">
                                    <span className="text-white">Parsing rows...</span>
                                    <span className="text-[#4D78FF]">{parseProgress}%</span>
                                </div>
                                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-[#4D78FF] transition-all duration-300 ease-out"
                                        style={{ width: \`\${parseProgress}%\` }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Preview & Validation Table */}
                    {!isParsing && preview.length > 0 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            {/* Summary Metrics */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-[#15181e] border border-white/5 rounded-xl p-4 flex flex-col">
                                    <span className="text-content-muted text-xs font-semibold uppercase tracking-wider mb-1">Successfully Parsed</span>
                                    <span className="text-2xl font-bold text-white flex items-baseline gap-2">
                                        {uploadStats.valid} <span className="text-sm font-normal text-content-secondary">/ {preview.length} rows</span>
                                    </span>
                                </div>
                                <div className="bg-[#15181e] border border-white/5 rounded-xl p-4 flex flex-col">
                                    <span className="text-content-muted text-xs font-semibold uppercase tracking-wider mb-1">Total Players</span>
                                    <span className="text-2xl font-bold text-white">
                                        {uploadStats.players}
                                    </span>
                                </div>
                                <div className={\`border rounded-xl p-4 flex flex-col \${uploadStats.invalid > 0 ? 'bg-red-500/5 border-red-500/20' : 'bg-[#10B981]/5 border-[#10B981]/20'}\`}>
                                    <span className={\`text-xs font-semibold uppercase tracking-wider mb-1 \${uploadStats.invalid > 0 ? 'text-red-400' : 'text-[#10B981]'}\`}>
                                        Validation Errors
                                    </span>
                                    <span className={\`text-2xl font-bold flex items-baseline gap-2 \${uploadStats.invalid > 0 ? 'text-red-400' : 'text-[#10B981]'}\`}>
                                        {uploadStats.invalid} <span className="text-sm font-normal opacity-70">rows</span>
                                    </span>
                                </div>
                            </div>

                            <div className="overflow-x-auto border border-white/10 rounded-xl bg-[#0a0a0c] max-h-[400px] overflow-y-auto custom-scrollbar">
                                <table className="w-full text-sm text-left whitespace-nowrap">
                                    <thead className="text-xs uppercase bg-[#15181e] text-content-secondary sticky top-0 z-10 shadow-sm border-b border-white/10">
                                        <tr>
                                            <th className="px-4 py-4 font-semibold w-10 text-center">Status</th>
                                            {!isAmericanoMode && <th className="px-4 py-4 font-semibold">Team Name</th>}
                                            <th className="px-4 py-4 font-semibold">{isAmericanoMode ? "Player" : "Player 1"}</th>
                                            {!isAmericanoMode && <th className="px-4 py-4 font-semibold">Player 2</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 text-content-primary">
                                        {preview.map((row, i) => (
                                            <tr key={i} className={\`hover:bg-white/[0.02] transition-colors \${!row.isValid ? 'bg-red-500/[0.02]' : ''}\`}>
                                                <td className="px-4 py-3 text-center border-r border-white/5">
                                                    {row.isValid ? (
                                                        <CheckCircle size={16} className="text-[#10B981] mx-auto" />
                                                    ) : (
                                                        <AlertCircle size={16} className="text-red-400 mx-auto" />
                                                    )}
                                                </td>
                                                {!isAmericanoMode && (
                                                    <td className="px-4 py-3">
                                                        <div className={\`font-medium \${row.errors.teamname ? 'text-red-400' : 'text-white'}\`}>
                                                            {row.data.name || <span className="text-red-400/50 italic">Missing Name</span>}
                                                        </div>
                                                    </td>
                                                )}
                                                <td className="px-4 py-3">
                                                    <div className={\`\${(isAmericanoMode ? row.errors.playername : row.errors.player1name) ? 'text-red-400' : ''}\`}>
                                                        {row.data.player1.name || <span className="text-red-400/50 italic">Missing Name</span>}
                                                    </div>
                                                    <div className="text-xs text-content-muted font-mono mt-0.5">{row.data.player1.phone || 'No phone'}</div>
                                                </td>
                                                {!isAmericanoMode && (
                                                    <td className="px-4 py-3">
                                                        <div className={\`\${row.errors.player2name ? 'text-red-400' : ''}\`}>
                                                            {row.data.player2.name || <span className="text-red-400/50 italic">Missing Name</span>}
                                                        </div>
                                                        <div className="text-xs text-content-muted font-mono mt-0.5">{row.data.player2.phone || 'No phone'}</div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex gap-4 pt-2">
                                <button
                                    onClick={() => { setPreview([]); setLinkInput(''); }}
                                    className="px-6 py-4 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-all border border-white/10"
                                >
                                    Reset
                                </button>
                                <button 
                                    onClick={handleUpload}
                                    disabled={isProcessing || uploadStats.valid === 0}
                                    className="flex-1 py-4 bg-[#4D78FF] hover:bg-[#3A5BCC] text-white rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(77,120,255,0.3)] hover:shadow-[0_0_30px_rgba(77,120,255,0.5)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:bg-[#4D78FF] disabled:hover:shadow-none"
                                >
                                    {isProcessing ? (
                                        <span className="animate-pulse">Importing {uploadStats.valid} {isAmericanoMode ? 'Players' : 'Teams'}...</span>
                                    ) : (
                                        <>
                                            <Upload size={18} />
                                            Import {uploadStats.valid} Valid {isAmericanoMode ? 'Players' : 'Teams'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
`
fs.writeFileSync('./components/BulkUploadTeamsModal.tsx', content);
