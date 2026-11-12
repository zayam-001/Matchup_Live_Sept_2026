// Futsal referee mode inside the shared #referee route. Same flow and look as the
// padel RefereeInterface (passcode, dashboard by category and group, start-match
// dialog), then the futsal scoring console instead of padel's set/game scoring.
import React, { useMemo, useState } from 'react';
import { ChevronDown, Clock, Eye, EyeOff, Loader2, Lock, MapPin, Trophy, X } from 'lucide-react';
import { loginReferee } from '../../services/storage';
import { toast } from '../../components/Toast';
import { Card } from '../../components/ui/Card';
import { isKnockout, scoreOf, STAGE_NAMES, sourceLabel } from '../engine';
import { isDemo, saveFutsalMatch } from '../store';
import type { FutsalMatch, FutsalTeam, FutsalTournament } from '../types';
import { Console } from './Scorer';
import { useFutsalTournament } from './shared';
import { SIDE_LINE } from './palette';
import '../futsal.css';

const nameOf = (teams: FutsalTeam[], matches: FutsalMatch[], m: FutsalMatch, side: 'home' | 'away') => {
    const t = teams.find(x => x.id === (side === 'home' ? m.homeId : m.awayId));
    if (t) return t.name;
    const label = sourceLabel(side === 'home' ? m.homeFrom : m.awayFrom, matches);
    return label.split(' · ')[1] || label;
};

export const FutsalReferee: React.FC<{ tournamentId: string; initialAuthenticated?: boolean; onLogout?: () => void }> = ({ tournamentId, initialAuthenticated, onLogout }) => {
    const { t, teams, matches, loading } = useFutsalTournament(tournamentId);
    const [authenticated, setAuthenticated] = useState(!!initialAuthenticated);
    const [passcode, setPasscode] = useState('');
    const [showPasscode, setShowPasscode] = useState(false);
    const [catId, setCatId] = useState<string | null>(null);
    const [matchId, setMatchId] = useState<string | null>(null);

    if (loading) {
        return (
            <div className="pb-20 max-w-2xl mx-auto px-4 text-center mt-20 pt-28">
                <Loader2 className="animate-spin text-brand mx-auto mb-4" size={32} />
                <h1 className="text-xl font-bold text-white">Loading Details...</h1>
            </div>
        );
    }
    if (!t) {
        return (
            <div className="pb-20 max-w-2xl mx-auto px-4 text-center mt-20 pt-28">
                <div className="h-16 w-16 bg-surface-panel rounded-2xl flex items-center justify-center border border-white/10 shadow-inner mx-auto mb-6"><X className="text-accent-error" size={32} /></div>
                <h1 className="text-2xl font-bold text-white mb-2">Tournament Not Found</h1>
                <p className="text-content-secondary text-sm">This tournament link may be invalid or expired.</p>
                <button onClick={() => { window.location.hash = 'landing'; }} className="mt-6 text-brand hover:underline font-bold">Return Home</button>
            </div>
        );
    }

    if (!authenticated) {
        const login = async (e: React.FormEvent) => {
            e.preventDefault();
            if (passcode !== String(t.scorerPasscode)) { toast.error('Invalid passcode', 'Double-check the tournament passcode and try again.'); return; }
            try {
                if (!isDemo()) await loginReferee();
                localStorage.setItem('referee_session', JSON.stringify({ timestamp: Date.now(), tournamentId: `futsal:${t.id}` }));
                setAuthenticated(true);
            } catch {
                toast.error("Couldn't sign in", 'Please check your connection and try again.');
            }
        };
        return (
            <div className="pb-20 max-w-2xl mx-auto px-4 text-center mt-20 pt-28">
                <div className="h-16 w-16 bg-surface-panel rounded-2xl flex items-center justify-center border border-white/10 shadow-inner mx-auto mb-6"><Lock className="text-brand" size={32} /></div>
                <h1 className="text-2xl font-bold text-white mb-6">Referee Access</h1>
                <form onSubmit={login} className="max-w-sm mx-auto">
                    <div className="relative mb-4">
                        <input type={showPasscode ? 'text' : 'password'} placeholder="Enter Tournament Passcode" value={passcode} onChange={e => setPasscode(e.target.value)}
                            className="w-full bg-surface-ground border border-white/10 rounded-lg p-3 pr-12 text-white text-center tracking-widest text-lg focus:border-brand focus:outline-none transition-colors" />
                        <button type="button" onClick={() => setShowPasscode(!showPasscode)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white focus:outline-none">{showPasscode ? <EyeOff size={20} /> : <Eye size={20} />}</button>
                    </div>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => { window.location.hash = 'auth-admin'; }} className="px-4 py-3 bg-surface-panel border border-white/10 text-content-secondary hover:text-white font-bold rounded-xl hover:bg-surface-elevated flex-1 transition-all">Back</button>
                        <button type="submit" className="flex-[2] bg-brand text-white font-bold py-3 rounded-xl hover:bg-brand-hover transition-colors shadow-lg shadow-brand/20">Enter</button>
                    </div>
                </form>
            </div>
        );
    }

    const active = matchId ? matches.find(m => m.id === matchId) : undefined;
    if (active) {
        const cat = t.categories.find(c => c.id === active.categoryId) || t.categories[0];
        return (
            <div className="w-full relative flex flex-col min-h-screen pt-16 md:pt-24 bg-bg-dark pb-20">
                <Console key={active.id} t={t} cat={cat} teams={teams} matches={matches} m={active} onBack={() => setMatchId(null)} />
            </div>
        );
    }

    const cat = t.categories.find(c => c.id === catId) || t.categories[0];
    return (
        <div className="max-w-4xl mx-auto pb-20 px-4 pt-28 md:pt-36">
            <div className="flex justify-between items-center mb-6 pt-6">
                <h2 className="text-xl md:text-2xl font-bold text-white">{t.name} Dashboard</h2>
                <button onClick={() => { setAuthenticated(false); setPasscode(''); onLogout?.(); }} className="text-sm bg-surface-ground hover:bg-surface-elevated text-content-secondary hover:text-white px-4 py-2 rounded-lg border border-white/5 transition-all">Logout</button>
            </div>
            {t.categories.length > 1 && (
                <div className="flex flex-wrap gap-2 mb-6 border-b border-white/10 pb-4">
                    {t.categories.map(c => (
                        <button key={c.id} onClick={() => setCatId(c.id)}
                            className={`px-4 py-2.5 text-sm font-black rounded-xl transition-all uppercase tracking-wider ${cat.id === c.id ? 'bg-brand text-black shadow-lg shadow-brand/25 scale-[1.02]' : 'bg-surface-panel hover:bg-surface-elevated text-content-secondary hover:text-white border border-white/5'}`}>
                            {c.name}
                        </button>
                    ))}
                </div>
            )}
            <div className="border border-white/10 rounded-2xl p-6 bg-surface-dark mb-4">
                <h3 className="text-xl font-bold text-brand mb-4 flex items-center gap-2"><Trophy size={18} /> {cat.name} <span className="text-sm font-normal text-content-muted">Category Dashboard</span></h3>
                <CategoryView t={t} teams={teams} matches={matches} list={matches.filter(m => m.categoryId === cat.id)} onOpen={setMatchId} />
            </div>
        </div>
    );
};

const CategoryView: React.FC<{ t: FutsalTournament; teams: FutsalTeam[]; matches: FutsalMatch[]; list: FutsalMatch[]; onOpen: (id: string) => void }> = ({ t, teams, matches, list, onOpen }) => {
    const [open, setOpen] = useState<Record<string, boolean>>({});
    const [starting, setStarting] = useState<FutsalMatch | null>(null);
    const sorted = useMemo(() => [...list].sort((a, b) => String(a.startAt || '9').localeCompare(String(b.startAt || '9')) || a.matchNo - b.matchNo), [list]);
    const groups = useMemo(() => {
        const g: Record<string, FutsalMatch[]> = {};
        sorted.filter(m => !isKnockout(m.stage)).forEach(m => { const k = m.stage === 'LEAGUE' ? 'League' : m.group || '?'; (g[k] = g[k] || []).push(m); });
        return g;
    }, [sorted]);
    const rounds = useMemo(() => {
        const r: Record<string, FutsalMatch[]> = {};
        sorted.filter(m => isKnockout(m.stage)).forEach(m => { const k = STAGE_NAMES[m.stage]; (r[k] = r[k] || []).push(m); });
        return r;
    }, [sorted]);

    const tap = (m: FutsalMatch) => {
        if (!m.homeId || !m.awayId) { toast.warning("Can't start this match yet", 'One or both teams are still TBD - finish the earlier round first.'); return; }
        if (m.status === 'SCHEDULED') setStarting(m);
        else onOpen(m.id);
    };

    const renderList = (ms: FutsalMatch[]) => (
        <div className="grid md:grid-cols-2 gap-4">
            {ms.map(m => {
                const s = scoreOf(m);
                const live = m.status === 'LIVE', done = m.status === 'COMPLETED';
                const row = (side: 'home' | 'away') => {
                    const id = side === 'home' ? m.homeId : m.awayId;
                    const won = done && m.winnerId && m.winnerId === id;
                    const team = teams.find(x => x.id === id);
                    return (
                        <div className="flex justify-between items-center bg-surface-ground px-3 py-2 rounded-lg mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="w-1.5 h-6 rounded-full shrink-0" style={{ background: SIDE_LINE[side] }} />
                                <div className="flex flex-col min-w-0">
                                    <div className={`font-bold truncate ${won ? 'text-brand' : 'text-white'}`}>{nameOf(teams, matches, m, side)}</div>
                                    {team?.captainName && <div className="text-[10px] text-content-muted truncate">Captain {team.captainName}</div>}
                                </div>
                            </div>
                            {(live || done) && (
                                <span className={`px-2.5 py-1 rounded-lg text-sm font-mono font-black border ${won ? 'bg-[#4D78FF] text-white border-[#4D78FF]' : 'bg-white/10 text-white border-white/10'}`}>
                                    {side === 'home' ? s.home : s.away}{s.hasPens ? ` (${side === 'home' ? s.pensHome : s.pensAway})` : ''}
                                </span>
                            )}
                        </div>
                    );
                };
                return (
                    <Card key={m.id} variant="panel" onClick={() => tap(m)} className="p-4 cursor-pointer hover:border-brand transition-colors group mb-3">
                        <div className="flex justify-between items-center mb-2">
                            <span className={`text-xs font-medium text-brand px-2 py-1 bg-brand/10 rounded uppercase tracking-wider flex items-center gap-1 ${!m.pitch ? 'opacity-45' : ''}`}>{m.pitch && <MapPin size={12} />} {m.pitch || 'Pitch TBD'}</span>
                            <span className="text-xs text-content-muted flex items-center gap-1"><Clock size={12} /> {m.startAt ? `${new Date(m.startAt).toLocaleDateString([], { day: 'numeric', month: 'short' })} · ${new Date(m.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'TBA'}</span>
                        </div>
                        {row('home')}
                        {row('away')}
                        <div className="flex justify-between items-center mt-2 border-t border-white/5 pt-2">
                            <div className="text-sm text-content-muted">{m.stage === 'GROUP' ? `Group ${m.group}` : STAGE_NAMES[m.stage]} · Match {m.matchNo}</div>
                            {live && <div className="animate-pulse w-2 h-2 bg-accent-live rounded-full" />}
                            {done && <div className="text-xs bg-surface-elevated px-2 py-1 rounded text-content-secondary">Complete</div>}
                        </div>
                    </Card>
                );
            })}
        </div>
    );

    return (
        <div className="space-y-6 mb-8 mt-4">
            {starting && <StartDialog t={t} m={starting} home={nameOf(teams, matches, starting, 'home')} away={nameOf(teams, matches, starting, 'away')} onClose={() => setStarting(null)}
                onStart={async pitch => {
                    const m = starting;
                    setStarting(null);
                    onOpen(m.id);
                    if (pitch && pitch !== m.pitch) saveFutsalMatch({ ...m, pitch }).catch(() => toast.error("Couldn't assign the pitch", 'Scoring still works; set it again later.'));
                }} />}
            {!Object.keys(groups).length && !Object.keys(rounds).length && <div className="text-content-muted text-center py-8">No matches or standings available yet.</div>}
            {Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([g, ms]) => {
                const isOpen = open[g] ?? ms.some(m => m.status === 'LIVE');
                return (
                    <div key={g} className="border border-white/5 bg-[#0D0D0D] rounded-2xl overflow-hidden mb-4 shadow-xl">
                        <button onClick={() => setOpen(p => ({ ...p, [g]: !isOpen }))} className="w-full flex justify-between items-center px-6 py-4 bg-surface-panel hover:bg-surface-elevated transition-colors text-left">
                            <div className="flex items-center gap-3">
                                <Trophy size={20} className="text-brand" />
                                <div>
                                    <h4 className="text-base font-black text-white uppercase tracking-wider leading-none mb-1">{g === 'League' ? 'League' : `Group ${g}`}</h4>
                                    <span className="text-xs text-content-muted font-semibold">{ms.length} Scheduled Matches</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-brand font-bold uppercase tracking-widest hidden sm:inline">{isOpen ? 'Collapse' : 'Expand'}</span>
                                <div className={`p-1.5 rounded-lg bg-white/5 border border-white/5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-brand' : ''}`}><ChevronDown size={18} /></div>
                            </div>
                        </button>
                        {isOpen && (
                            <div className="p-6 bg-black/40 space-y-3 border-t border-white/5">
                                <h5 className="text-xs uppercase tracking-widest text-content-muted font-bold mb-1">Group Matches</h5>
                                {renderList(ms)}
                            </div>
                        )}
                    </div>
                );
            })}
            {Object.entries(rounds).map(([name, ms]) => (
                <div key={name} className="space-y-4 pt-4 border-t border-white/10">
                    <h4 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2"><Trophy size={18} className="text-brand" /> {name}</h4>
                    {renderList(ms)}
                </div>
            ))}
        </div>
    );
};

/** Same two steps as padel's start-match dialog: confirm the fixture, then pick the pitch. */
const StartDialog: React.FC<{ t: FutsalTournament; m: FutsalMatch; home: string; away: string; onClose: () => void; onStart: (pitch: string | undefined) => void }> = ({ t, m, home, away, onClose, onStart }) => {
    const [step, setStep] = useState(1);
    const [pitch, setPitch] = useState(m.pitch || t.pitches[0]);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#13131A] w-full max-w-sm rounded-[16px] border border-brand/15 shadow-2xl p-6">
                {step === 1 ? (
                    <div className="space-y-6">
                        <h3 className="text-white font-bold text-lg flex items-center gap-2"><span className="text-brand">▶</span> Start Match?</h3>
                        <div className="bg-[#1A1A24] p-4 rounded-xl border border-[#2A2A38]">
                            <div className="font-bold text-white text-center text-lg">{home}</div>
                            <div className="text-brand/50 text-center text-sm font-bold my-1">VS</div>
                            <div className="font-bold text-white text-center text-lg">{away}</div>
                            <div className="mt-4 pt-4 border-t border-white/5 text-center text-xs text-content-muted">
                                {m.stage === 'GROUP' ? `Group ${m.group}` : STAGE_NAMES[m.stage]} &middot; Scheduled {m.startAt ? new Date(m.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBA'}
                            </div>
                        </div>
                        <p className="text-sm text-content-secondary text-center px-4">You'll pick the lineups, then kick off the clock on the next screen.</p>
                        <div className="flex gap-3 pt-2">
                            <button onClick={onClose} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-colors">Cancel</button>
                            <button onClick={() => (t.pitches.length > 1 ? setStep(2) : onStart(pitch))} className="flex-1 py-3 bg-brand hover:bg-brand-light text-content-inverse rounded-xl font-bold transition-colors shadow-lg shadow-brand/20">Confirm &rarr;</button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <h3 className="text-white font-bold text-lg flex items-center gap-2"><MapPin size={20} className="text-brand" /> Assign Pitch</h3>
                        <div className="space-y-2">
                            {t.pitches.map(p => (
                                <button key={p} onClick={() => setPitch(p)} className={`w-full h-14 rounded-xl flex items-center px-4 gap-3 border font-bold transition-colors ${pitch === p ? 'bg-brand/15 border-brand text-white' : 'bg-[#1A1A24] border-[#2A2A38] text-content-secondary hover:text-white'}`}>
                                    <MapPin size={16} className="text-brand" /> {p}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setStep(1)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-colors">Back</button>
                            <button onClick={() => onStart(pitch)} className="flex-1 py-3 bg-brand hover:bg-brand-light text-content-inverse rounded-xl font-bold transition-colors shadow-lg shadow-brand/20">Start match</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FutsalReferee;
