// Futsal and football inside the organiser portal: the same four-step create wizard and the
// same tournament workspace (header, tabs) as padel, so both sports feel like one product.
import React, { useEffect, useState } from 'react';
import { Archive, Check, ChevronLeft, ChevronRight, Edit3, Image as ImageIcon, Loader2, MapPin, Plus, Trash2 } from 'lucide-react';
import { subscribeToVenues, uploadSystemImage, auth } from '../../services/storage';
import { POINTS_SYSTEM_LIST, STAGE_LABELS, STAGE_ORDER, getPointsSystem } from '../../lib/pointsSystems';
import type { Venue } from '../../types';
import { DEFAULT_SCHEDULE, FORMAT_LABELS, matchMinutes, newCategory, newId, PRESETS } from '../presets';
import { CATEGORY_NAMES, CUSTOM_PRESET, DEFAULT_PRESET, PITCH_WORD, PRESETS_BY_SPORT, SPORT_LABEL, sportOf, type Sport } from '../sport';
import { saveFutsalTournament } from '../store';
import type { CompetitionFormat, FutsalCategory, FutsalTournament, PresetId } from '../types';
import { applyPreset, Awards, Categories, Fixtures, errText, Overview, Results, SECTIONS, SettingsAdmin, STATUS_LABEL, TeamsAdmin, type Ctx } from './Admin';
import { useFutsalTournament, useToast } from './shared';
import '../futsal.css';
import { RefereeCodeStat } from '../../components/RefereeCodeStat';

const CITIES = ['Karachi', 'Lahore', 'Islamabad', 'Faisalabad', 'Multan', 'Sialkot', 'Peshawar', 'Quetta'];
const STEPS = [
    { label: 'General', hint: 'Name, venue & dates' },
    { label: 'Format', hint: 'Match format & categories' },
    { label: 'Pricing', hint: 'Teams, fees & pitches' },
    { label: 'Assets', hint: 'Branding & display' },
];

const Input: React.FC<{ label: string; value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string; min?: number }> = ({ label, value, onChange, type = 'text', placeholder, min }) => (
    <div>
        <label className="adm-label">{label}</label>
        <input type={type} className="adm-input" value={value} min={min} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </div>
);
const selectCls = 'w-full bg-surface-panel p-3 rounded-xl text-white border border-white/10 focus:border-brand outline-none transition-all focus:ring-1 focus:ring-brand shadow-inner';
const nextCls = 'flex-[2] bg-brand hover:bg-brand-light disabled:opacity-50 text-content-inverse py-4 rounded-xl font-bold transition-all shadow-lg shadow-brand/20 flex items-center justify-center gap-2';
const backCls = 'flex-1 bg-white/5 hover:bg-white/10 text-white py-4 rounded-xl font-bold transition-all border border-white/10';
const usesGroups = (f: CompetitionFormat) => f === 'GROUPS' || f === 'GROUPS_KNOCKOUT';

/** Create or edit a futsal or football tournament with the padel wizard's steps and styling. */
export const FutsalCreateWizard: React.FC<{ initial?: FutsalTournament | null; sport?: Sport; onCancel: () => void; onCreate: (id: string) => void }> = ({ initial, sport: sportProp = 'futsal', onCancel, onCreate }) => {
    const sport: Sport = initial ? sportOf(initial) : sportProp;
    const pitch = PITCH_WORD[sport];
    const [step, setStep] = useState(1);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [venues, setVenues] = useState<Venue[]>([]);
    const [multi, setMulti] = useState((initial?.categories.length || 0) > 1);
    const [otherVenue, setOtherVenue] = useState(false);
    const [t, setT] = useState<FutsalTournament>(() => initial ? structuredClone(initial) : {
        id: newId('ft_'), name: '', sport, organizerId: auth.currentUser?.uid || '', organizerEmail: auth.currentUser?.email || '', organizerName: '',
        city: '', venue: '', pitches: [`${pitch} 1`], startDate: '', endDate: '', status: 'REGISTRATION',
        categories: [newCategory("Men's Open", DEFAULT_PRESET[sport])], scorerPasscode: String(Math.floor(100000 + Math.random() * 900000)),
        currency: 'PKR', tier: 'local', schedule: { ...DEFAULT_SCHEDULE }, createdAt: new Date().toISOString(),
    });
    useEffect(() => subscribeToVenues(setVenues), []);
    useEffect(() => { if (initial?.venue && venues.length && !venues.some(v => v.name === initial.venue)) setOtherVenue(true); }, [venues, initial]);

    const setCat = (i: number, patch: Partial<FutsalCategory>) => setT(prev => ({ ...prev, categories: prev.categories.map((c, k) => (k === i ? { ...c, ...patch } : c)) }));
    const setRules = (i: number, patch: Partial<FutsalCategory['rules']>) => setT(prev => ({ ...prev, categories: prev.categories.map((c, k) => (k === i ? { ...c, rules: { ...c.rules, ...patch, preset: CUSTOM_PRESET[sport] } } : c)) }));
    const startAt = t.startDate ? `${t.startDate}T${t.schedule.dayStart || '09:00'}` : '';
    const endAt = t.endDate ? `${t.endDate}T${t.schedule.dayEnd || '22:00'}` : '';
    const upload = async (folder: string, file: File | undefined, key: 'logoUrl' | 'bannerUrl') => {
        if (!file) return;
        try { const url = await uploadSystemImage(folder, file); setT(prev => ({ ...prev, [key]: url })); }
        catch { setErr('Couldn’t upload that image. Try a smaller file.'); }
    };

    const checkGeneral = () => {
        if (!t.name.trim()) return 'Give the tournament a name.';
        if (!t.venue.trim()) return 'Choose the venue.';
        if (!t.startDate || !t.endDate) return 'Set the start and end date.';
        if (t.endDate < t.startDate) return 'The end date is before the start date.';
        return '';
    };
    const go = (n: number) => {
        const e = n > 1 ? checkGeneral() : '';
        if (e) { setErr(e); setStep(1); return; }
        if (n > 2 && !t.categories.length) { setErr('Add at least one category.'); return; }
        setErr(''); setStep(n);
    };
    const save = async () => {
        const e = checkGeneral();
        if (e) { setErr(e); setStep(1); return; }
        setBusy(true); setErr('');
        try {
            await saveFutsalTournament({ ...t, name: t.name.trim(), pitches: t.pitches.map(p => p.trim()).filter(Boolean).length ? t.pitches.map(p => p.trim()).filter(Boolean) : [`${pitch} 1`] });
            onCreate(t.id);
        } catch (x) { setErr(errText(x)); setBusy(false); }
    };

    const CategoryFormat = ({ c, i }: { c: FutsalCategory; i: number }) => (
        <div className="space-y-4">
            <div>
                <label className="adm-label">Match format</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {PRESETS_BY_SPORT[sport].map(p => {
                        const on = c.rules.preset === p;
                        return (
                            <button key={p} type="button" onClick={() => setT(prev => ({ ...prev, categories: prev.categories.map((x, k) => (k === i ? applyPreset(x, p as PresetId) : x)) }))}
                                className={`text-left rounded-xl border px-3 py-2.5 transition-all ${on ? 'border-brand ring-2 ring-brand/40 bg-brand/5' : 'border-white/10 hover:border-white/30 bg-surface-panel'}`}>
                                <span className="block text-white text-sm font-bold">{PRESETS[p].label}</span>
                                <span className="block text-[11px] text-content-muted mt-0.5">{PRESETS[p].blurb}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="adm-label">Competition format</label>
                    <select className={selectCls} value={c.format} onChange={e => setCat(i, { format: e.target.value as CompetitionFormat })}>
                        {Object.entries(FORMAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                </div>
                <div>
                    <label className="adm-label">Division</label>
                    <select className={selectCls} value={c.division} onChange={e => setCat(i, { division: e.target.value as FutsalCategory['division'] })}>
                        {['Men', 'Women', 'Kids', 'Mixed'].map(d => <option key={d}>{d}</option>)}
                    </select>
                </div>
            </div>
            {usesGroups(c.format) && (
                <div className="grid grid-cols-2 gap-4 bg-surface-ground p-4 rounded-xl border border-white/5">
                    <Input label="Groups" type="number" min={1} value={c.groupCount} onChange={v => setCat(i, { groupCount: Math.max(1, Number(v) || 1) })} />
                    {c.format === 'GROUPS_KNOCKOUT' && <Input label="Qualify per group" type="number" min={1} value={c.advancePerGroup} onChange={v => setCat(i, { advancePerGroup: Math.max(1, Number(v) || 1) })} />}
                </div>
            )}
            {c.format === 'LEAGUE_KNOCKOUT' && (
                <div className="bg-surface-ground p-4 rounded-xl border border-white/5">
                    <Input label="Teams in the knockout (top of the league)" type="number" min={2} value={c.advancePerGroup} onChange={v => setCat(i, { advancePerGroup: Math.max(2, Number(v) || 2) })} />
                </div>
            )}
            {c.format === 'LEAGUE_PLAYOFFS' && <p className="text-[11px] text-content-muted">Everyone plays everyone, then the top 4: Qualifier (1st v 2nd), Eliminator 1 (3rd v 4th), Eliminator 2 (Qualifier loser v Eliminator 1 winner), Final.</p>}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Input label="Halves / periods" type="number" min={1} value={c.rules.periods} onChange={v => setRules(i, { periods: Math.max(1, Math.min(4, Number(v) || 1)) })} />
                <Input label="Minutes per period" type="number" min={1} value={c.rules.periodMinutes} onChange={v => setRules(i, { periodMinutes: Math.max(1, Number(v) || 1) })} />
                <Input label="Half-time (min)" type="number" min={0} value={c.rules.halftimeMinutes} onChange={v => setRules(i, { halftimeMinutes: Math.max(0, Number(v) || 0) })} />
                <Input label="Players on pitch" type="number" min={3} value={c.rules.onPitch} onChange={v => setRules(i, { onPitch: Math.max(3, Math.min(11, Number(v) || 5)) })} />
            </div>
        </div>
    );

    const plan = getPointsSystem(t.tier);
    const stages = STAGE_ORDER.filter(st => plan.placement[st] > 0);

    return (
        <div className="space-y-6">
            <div className="adm-stepper" style={{ '--progress': (step - 1) / 3 } as React.CSSProperties}>
                <span className="adm-stepper__track" aria-hidden="true"><i /></span>
                {STEPS.map((s, k) => (
                    <div key={s.label} className={`adm-step ${step === k + 1 ? 'is-on' : step > k + 1 ? 'is-done' : ''}`} onClick={() => go(k + 1)} role="button" tabIndex={0}>
                        <span className="adm-step__dot">{step > k + 1 ? <Check size={14} /> : k + 1}</span>
                        <span className="adm-step__label">{s.label}</span>
                        <span className="adm-step__hint">{s.hint}</span>
                    </div>
                ))}
            </div>

            {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-sm font-medium px-4 py-3" role="alert">{err}</div>}

            {step === 1 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex gap-4 items-end">
                        <div className="flex-1"><Input label="Tournament Name" value={t.name} placeholder="e.g. Folio3 Champions League 2026" onChange={v => setT({ ...t, name: v })} /></div>
                        <div className="w-24">
                            <label className="adm-label">Brand Logo</label>
                            <div onClick={() => document.getElementById('fxLogoUpload')?.click()} className="w-20 h-20 bg-surface-ground border border-dashed border-white/20 rounded-xl flex items-center justify-center cursor-pointer hover:border-brand transition-all overflow-hidden">
                                {t.logoUrl ? <img src={t.logoUrl} className="w-full h-full object-cover" alt="" /> : <ImageIcon size={20} className="text-content-muted" />}
                            </div>
                            <input type="file" id="fxLogoUpload" className="hidden" accept="image/*" onChange={e => upload('logos', e.target.files?.[0], 'logoUrl')} />
                        </div>
                    </div>

                    <div className="bg-surface-ground p-5 rounded-2xl border border-white/10 space-y-4">
                        <label className="text-white font-bold text-sm uppercase tracking-wider">Venue Configuration</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="adm-label">Main Venue</label>
                                <select className={selectCls} value={otherVenue ? '__other' : t.venue} onChange={e => {
                                    if (e.target.value === '__other') { setOtherVenue(true); setT({ ...t, venue: '' }); return; }
                                    const v = venues.find(x => x.name === e.target.value);
                                    setOtherVenue(false);
                                    setT({ ...t, venue: e.target.value, city: v?.city || t.city });
                                }}>
                                    <option value="">Select a Venue</option>
                                    {venues.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                                    <option value="__other">Other {sport} venue…</option>
                                </select>
                                {otherVenue && <input className="adm-input mt-2" placeholder={sport === 'football' ? 'Venue name, e.g. KMC Stadium' : 'Venue name, e.g. Arena 7, DHA'} value={t.venue} onChange={e => setT({ ...t, venue: e.target.value })} />}
                            </div>
                            <div>
                                <label className="adm-label">City</label>
                                <select className={selectCls} value={t.city} onChange={e => setT({ ...t, city: e.target.value })}>
                                    <option value="">Select City</option>
                                    {CITIES.map(c => <option key={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Start Date & Time" type="datetime-local" value={startAt} onChange={v => setT({ ...t, startDate: v.slice(0, 10), endDate: t.endDate && t.endDate >= v.slice(0, 10) ? t.endDate : v.slice(0, 10), schedule: { ...t.schedule, dayStart: v.slice(11, 16) || t.schedule.dayStart } })} />
                        <Input label="End Date & Time" type="datetime-local" value={endAt} onChange={v => setT({ ...t, endDate: v.slice(0, 10), schedule: { ...t.schedule, dayEnd: v.slice(11, 16) || t.schedule.dayEnd } })} />
                    </div>
                    <p className="text-xs text-content-muted -mt-2">The times are the daily window matches are scheduled in.</p>

                    <button onClick={() => go(2)} className="w-full bg-brand hover:bg-brand-light text-content-inverse py-4 rounded-xl mt-4 font-bold transition-all shadow-lg shadow-brand/20 active:scale-[0.98]">Next: Setup Formats</button>
                </div>
            )}

            {step === 2 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="flex items-center justify-between p-5 bg-surface-elevated/50 rounded-2xl border border-white/10">
                        <div>
                            <h3 className="text-white font-bold">Multi-Category Tournament</h3>
                            <p className="text-xs text-content-secondary">Run separate competitions (e.g. Men's Open, Kids U14)</p>
                        </div>
                        <button onClick={() => { setMulti(!multi); if (multi) setT({ ...t, categories: t.categories.slice(0, 1) }); }} className={`w-12 h-6 rounded-full transition-all relative ${multi ? 'bg-brand' : 'bg-white/10'}`} aria-pressed={multi} aria-label="Multi-category tournament">
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${multi ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>

                    {!multi && <Input label="Organized By (Optional)" value={t.organizerName || ''} onChange={v => setT({ ...t, organizerName: v })} />}

                    {(multi ? t.categories : t.categories.slice(0, 1)).map((c, i) => (
                        <div key={c.id} className={multi ? 'bg-surface-elevated/40 p-5 rounded-2xl border border-white/10 space-y-5' : ''}>
                            {multi && (
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center text-brand font-bold text-sm">{i + 1}</div>
                                    <input className="flex-1 bg-transparent text-white font-bold outline-none focus:text-brand transition-colors" value={c.name} aria-label="Category name" onChange={e => setCat(i, { name: e.target.value })} />
                                    {t.categories.length > 1 && <button onClick={() => setT({ ...t, categories: t.categories.filter((_, k) => k !== i) })} className="p-2 text-content-muted hover:text-accent-error transition-colors" aria-label={`Remove ${c.name}`}><Trash2 size={18} /></button>}
                                </div>
                            )}
                            {CategoryFormat({ c, i })}
                        </div>
                    ))}
                    {multi && (
                        <button onClick={() => setT({ ...t, categories: [...t.categories, newCategory(CATEGORY_NAMES[sport].find(n => !t.categories.some(c => c.name === n)) || `Category ${t.categories.length + 1}`, DEFAULT_PRESET[sport])] })}
                            className="w-full p-3 bg-brand/10 text-brand text-sm font-bold rounded-xl hover:bg-brand/20 transition-all flex items-center justify-center gap-1 border border-brand/20">
                            <Plus size={16} /> Add Category
                        </button>
                    )}

                    <div className="flex gap-4">
                        <button onClick={() => setStep(1)} className={backCls}>Back</button>
                        <button onClick={() => go(3)} className={nextCls}>Next: Configure Pricing</button>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    <label className="text-white font-bold text-sm uppercase tracking-wider block">{multi ? 'Category Details' : 'Teams & Fees'}</label>
                    {t.categories.map((c, i) => (
                        <div key={c.id} className="bg-surface-elevated/40 p-5 rounded-2xl border border-white/10 space-y-5">
                            {multi && <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center text-brand font-bold text-sm">{i + 1}</div><h4 className="text-white font-bold">{c.name}</h4></div>}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <Input label="Max Teams" type="number" min={2} value={c.maxTeams} onChange={v => setCat(i, { maxTeams: Math.max(2, Number(v) || 2) })} />
                                <Input label={`Entry Fee (${t.currency})`} type="number" min={0} value={c.entryFee} onChange={v => setCat(i, { entryFee: Math.max(0, Number(v) || 0) })} />
                                <Input label="Squad Min" type="number" min={1} value={c.rules.squadMin} onChange={v => setRules(i, { squadMin: Math.max(1, Number(v) || 1) })} />
                                <Input label="Squad Max" type="number" min={1} value={c.rules.squadMax} onChange={v => setRules(i, { squadMax: Math.max(c.rules.squadMin, Number(v) || c.rules.squadMin) })} />
                            </div>
                            <p className="text-[11px] text-content-muted">About {matchMinutes(c.rules, t.schedule.bufferMinutes)} minutes per match slot, changeover included. Match days, kick-off times and the gap between matches are set under Draw &amp; fixtures.</p>
                        </div>
                    ))}
                    <div className="bg-surface-ground p-5 rounded-2xl border border-white/10 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-4">
                            <Input label={`${pitch}s (comma separated)`} value={t.pitches.join(', ')} placeholder={`${pitch} 1, ${pitch} 2`} onChange={v => setT({ ...t, pitches: v.split(',').map(s => s.trimStart()) })} />
                            <div>
                                <label className="adm-label">Currency</label>
                                <select className={selectCls} value={t.currency} onChange={e => setT({ ...t, currency: e.target.value })}>{['PKR', 'USD', 'AED', 'SAR', 'GBP'].map(c => <option key={c}>{c}</option>)}</select>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => setStep(2)} className={backCls}>Back</button>
                        <button onClick={() => go(4)} className={nextCls}>Next: Finalize Assets</button>
                    </div>
                </div>
            )}

            {step === 4 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="bg-surface-ground p-5 rounded-2xl border border-white/10 space-y-6">
                        <Input label="Referee Passcode" value={t.scorerPasscode} onChange={v => setT({ ...t, scorerPasscode: v.trim() })} />

                        <div>
                            <label className="block text-content-secondary text-sm mb-3 font-bold uppercase tracking-wider">Tournament Main Banner</label>
                            <div onClick={() => document.getElementById('fxBannerUpload')?.click()} className="w-full h-40 border border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center text-content-muted hover:text-white hover:border-brand cursor-pointer bg-black/20 transition-all hover:bg-black/40 overflow-hidden relative">
                                {t.bannerUrl ? <img src={t.bannerUrl} className="w-full h-full object-cover" alt="" /> : <><ImageIcon size={32} className="mb-2" /><span className="text-xs font-medium">Upload Banner Image (16:9)</span></>}
                            </div>
                            <input type="file" id="fxBannerUpload" className="hidden" accept="image/*" onChange={e => upload('banners', e.target.files?.[0], 'bannerUrl')} />
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-end justify-between gap-3">
                                <label className="block text-content-secondary text-sm font-bold uppercase tracking-wider">Tournament Category</label>
                                <span className="text-[11px] text-content-muted text-right">How players earn ranking points in this tournament.</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {POINTS_SYSTEM_LIST.map(p => (
                                    <button key={p.id} type="button" onClick={() => setT({ ...t, tier: p.id })} className={`text-left rounded-xl border px-3 py-2.5 transition-all ${t.tier === p.id ? 'border-brand ring-2 ring-brand/40 bg-brand/5' : 'border-white/10 hover:border-white/30 bg-surface-panel'}`}>
                                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-black italic uppercase tracking-wide text-white" style={{ background: p.color }}>{p.label}</span>
                                        <span className="block text-[10px] text-content-muted mt-1.5">{`Winner ${p.placement.CHAMPION} pts`}</span>
                                    </button>
                                ))}
                            </div>
                            <div className="rounded-xl border border-white/10 overflow-x-auto">
                                <table className="w-full text-xs text-center">
                                    <thead className="bg-white/5 text-content-muted uppercase tracking-wider"><tr>{stages.map(st => <th key={st} className="px-2 py-2 font-bold whitespace-nowrap">{STAGE_LABELS[st]}</th>)}</tr></thead>
                                    <tbody><tr className="text-white font-bold text-sm">{stages.map(st => <td key={st} className="px-2 py-2">{plan.placement[st]}</td>)}</tr></tbody>
                                </table>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="block text-content-secondary text-sm font-bold uppercase tracking-wider">Visibility</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {(['REGISTRATION', 'DRAFT'] as const).map(s => (
                                    <button key={s} type="button" onClick={() => setT({ ...t, status: s })} className={`text-left rounded-xl border px-3 py-2.5 transition-all ${t.status === s ? 'border-brand ring-2 ring-brand/40 bg-brand/5' : 'border-white/10 hover:border-white/30 bg-surface-panel'}`}>
                                        <span className="block text-white text-sm font-bold">{STATUS_LABEL[s]}</span>
                                        <span className="block text-[11px] text-content-muted mt-0.5">{s === 'DRAFT' ? 'Hidden from spectators until you publish it.' : 'Listed in spectator mode; teams can register.'}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => setStep(3)} className={backCls}>Back</button>
                        <button onClick={save} disabled={busy} className={nextCls}>
                            {busy ? <><Loader2 className="animate-spin" size={20} /> Processing...</> : <><Check size={20} /> {initial ? 'Update Tournament' : 'Launch Tournament'}</>}
                        </button>
                    </div>
                </div>
            )}
            <button onClick={onCancel} className="w-full py-2 text-content-muted text-xs font-bold uppercase tracking-widest hover:text-white transition-colors">Cancel Tournament Generation</button>
        </div>
    );
};

export const FUTSAL_VIEWS = SECTIONS;
export type FutsalView = typeof SECTIONS[number]['id'];

/** A futsal tournament's workspace, laid out like the padel one: banner header, tabs, then the section. */
export const FutsalWorkspace: React.FC<{ id: string; view: FutsalView; setView: (v: FutsalView) => void; onBack: () => void; onEdit: (t: FutsalTournament) => void }> = ({ id, view, setView, onBack, onEdit }) => {
    const { t, teams, matches, loading } = useFutsalTournament(id);
    const { toast, node } = useToast();
    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-brand" size={32} /></div>;
    if (!t) return <div className="adm-empty"><h3>Tournament not found</h3><button className="adm-btn adm-btn--primary" onClick={onBack}>Back to dashboard</button></div>;
    const saveT = async (next: FutsalTournament, msg?: string) => { try { await saveFutsalTournament(next); if (msg) toast(msg); } catch (e) { toast(errText(e)); } };
    const ctx: Ctx = { t, teams, matches, toast, saveT, go: s => setView(s as FutsalView), onDeleted: onBack };
    const accepted = teams.filter(x => x.status === 'ACCEPTED').length;
    const pending = teams.filter(x => x.status === 'PENDING').length;
    const live = matches.filter(m => m.status === 'LIVE').length;
    return (
        <div className="adm">
            <div className="adm-ws">
                {t.bannerUrl && <img className="adm-ws__bg" src={t.bannerUrl} alt="" />}
                <div className="adm-ws__shade" aria-hidden="true" />
                <div className="adm-ws__row">
                    <button onClick={onBack} className="adm-back" title="All tournaments"><ChevronLeft size={18} /></button>
                    <div className="adm-ws__id">
                        <div className="adm-ws__crumbs"><span>Tournaments</span><ChevronRight size={12} /><span className="is-here">{SPORT_LABEL[sportOf(t)]} · {STATUS_LABEL[t.status]}</span></div>
                        <h1 className="adm-ws__title">{t.name}</h1>
                        <div className="adm-ws__meta"><MapPin size={13} /> {t.venue} · {t.city || 'Karachi'}</div>
                    </div>
                    <div className="adm-ws__actions">
                        <button onClick={() => onEdit(t)} className="adm-btn adm-btn--ghost"><Edit3 size={16} /> Edit</button>
                        <button onClick={() => setView('settings')} className="adm-mini adm-mini--warn" title="Status & delete"><Archive size={16} /></button>
                    </div>
                </div>
                <div className="adm-ws__stats">
                    <div><strong>{accepted}</strong><span>Confirmed teams</span></div>
                    <div><strong>{pending}</strong><span>Pending requests</span></div>
                    <div><strong>{matches.length ? `${matches.filter(m => m.status === 'COMPLETED').length}/${matches.length}` : '—'}</strong><span>Matches played</span></div>
                    <div><strong>{live || t.pitches.length}</strong><span>{live ? 'Live now' : `${PITCH_WORD[sportOf(t)]}s`}</span></div>
                    <RefereeCodeStat value={t.scorerPasscode} onSave={code => saveFutsalTournament({ ...t, scorerPasscode: code })} />
                </div>
            </div>

            <div className="adm-tabs">
                {SECTIONS.map(s => (
                    <button key={s.id} onClick={() => setView(s.id)} className={`adm-tab ${view === s.id ? 'is-on' : ''}`} aria-current={view === s.id ? 'page' : undefined}>
                        <s.icon className="w-4 h-4 shrink-0" />
                        <span className="hidden sm:inline">{s.label}</span>
                        <span className="sm:hidden">{s.label.split(' ')[0]}</span>
                    </button>
                ))}
            </div>

            <div className="fx fx--embed">
                <div className="fx-stack">
                    {view === 'overview' && <Overview {...ctx} />}
                    {view === 'categories' && <Categories {...ctx} />}
                    {view === 'teams' && <TeamsAdmin {...ctx} />}
                    {view === 'fixtures' && <Fixtures {...ctx} />}
                    {view === 'results' && <Results {...ctx} />}
                    {view === 'awards' && <Awards {...ctx} />}
                    {view === 'settings' && <SettingsAdmin {...ctx} />}
                </div>
            </div>
            {node}
        </div>
    );
};

