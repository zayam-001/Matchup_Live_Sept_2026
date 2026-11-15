// Padel schedule from Excel: download every generated match with its date, time and court, fill them in
// (or change them), upload it back, check the preview, apply. Live and finished matches aren't changed.
import React, { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import type { Match, Tournament } from '../types';
import { updateMatchDetails } from '../services/storage';
import { readXlsx, writeXlsx } from '../futsal/xlsx';
import { parseCsv } from '../futsal/ui/BulkTeams';
import { dateOf, timeOf } from '../futsal/ui/ScheduleSheet';
import { toast } from './Toast';

const HEAD = ['Match ID', 'Round', 'Team 1', 'Team 2', 'Date (YYYY-MM-DD)', 'Time (HH:MM, 24h)', 'Court'];
const pad = (n: number) => String(n).padStart(2, '0');
const key = (s?: string) => String(s || '').trim().toLowerCase();
const playable = (m: Match) => ['SCHEDULED', 'PENDING', ''].includes(String(m.status || '').toUpperCase());

interface Change { m: Match; at?: string; court?: string; courtId?: string | null }

export const PadelScheduleSheet: React.FC<{ tournament: Tournament; matches: Match[] }> = ({ tournament, matches }) => {
    const [plan, setPlan] = useState<{ changes: Change[]; errors: string[]; skipped: number; file: string } | null>(null);
    const [busy, setBusy] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const courts: string[] = (tournament as any).courts || [];
    // Court name -> id, from matches that already have both (the scheduler and live courts use the id).
    const courtIds = new Map<string, string>();
    matches.forEach(m => { const id = (m as any).scheduledCourtId || (m as any).courtId; if (m.court && id) courtIds.set(key(m.court), id); });

    const download = async () => {
        const rows = [...matches].sort((a, b) => String(a.scheduledTime || '9').localeCompare(String(b.scheduledTime || '9'))).map(m => {
            const d = m.scheduledTime ? new Date(m.scheduledTime) : null;
            return [m.id, m.roundName || (m as any).stage || '', m.team1Name || 'TBD', m.team2Name || 'TBD', d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '', d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '', m.court || ''];
        });
        const blob = await writeXlsx([HEAD, ...rows], 'Schedule');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${tournament.name.replace(/[^\w]+/g, '-')}-schedule.xlsx`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const read = async (f: File) => {
        let raw: string[][];
        try { raw = /\.xlsx$/i.test(f.name) ? await readXlsx(f) : parseCsv(await f.text()); }
        catch { setPlan({ changes: [], errors: ['Couldn’t read that file. Start from the downloaded sheet and save it as .xlsx or .csv.'], skipped: 0, file: f.name }); return; }
        const head = (raw[0] || []).map(h => key(h));
        const col = (re: RegExp) => head.findIndex(h => re.test(h));
        const c = { id: col(/id/), date: col(/date|day/), time: col(/time/), court: col(/court/) };
        const errors: string[] = [];
        if (c.id < 0) errors.push('Missing the "Match ID" column. Download the sheet from here and keep that column.');
        const byId = new Map(matches.map(m => [m.id, m]));
        const changes: Change[] = []; let skipped = 0;
        raw.slice(1).forEach((r, i) => {
            const line = i + 2, cell = (k: number) => (k >= 0 ? (r[k] || '').trim() : '');
            if (!r.some(x => (x || '').trim())) return;
            const m = byId.get(cell(c.id));
            if (!m) { errors.push(`Row ${line}: no match with ID "${cell(c.id)}" in this tournament.`); return; }
            if (!playable(m)) { skipped++; return; }
            const ds = cell(c.date), ts = cell(c.time), court = cell(c.court);
            let at: string | undefined;
            if (ds || ts) {
                const d = dateOf(ds), t = timeOf(ts);
                if (!d) { errors.push(`Row ${line}: "${ds}" isn’t a date. Use YYYY-MM-DD.`); return; }
                if (!t) { errors.push(`Row ${line}: "${ts}" isn’t a time. Use 24-hour HH:MM.`); return; }
                at = new Date(`${d}T${t}:00`).toISOString();
            }
            if (court && courts.length && !courts.some(x => key(x) === key(court))) { errors.push(`Row ${line}: "${court}" isn’t one of this tournament’s courts (${courts.join(', ')}).`); return; }
            const courtName = court ? courts.find(x => key(x) === key(court)) || court : undefined;
            const same = (!at || at === m.scheduledTime) && (!courtName || courtName === m.court);
            if (!same) changes.push({ m, at, court: courtName, courtId: courtName ? courtIds.get(key(courtName)) ?? null : undefined });
        });
        // Two matches on the same court at the same time.
        const slot = new Map<string, string>();
        changes.forEach(ch => {
            const at = ch.at || ch.m.scheduledTime, court = ch.court || ch.m.court; if (!at || !court) return;
            const k = `${at}|${key(court)}`;
            if (slot.has(k)) errors.push(`${ch.m.team1Name} v ${ch.m.team2Name} is on ${court} at the same time as ${slot.get(k)}.`);
            slot.set(k, `${ch.m.team1Name} v ${ch.m.team2Name}`);
        });
        setPlan({ changes, errors, skipped, file: f.name });
    };

    const apply = async () => {
        if (!plan || plan.errors.length) return;
        setBusy(true);
        try {
            for (const ch of plan.changes) {
                const updates: Record<string, unknown> = {};
                if (ch.at) Object.assign(updates, { scheduledTime: ch.at, scheduledStartTime: ch.at });
                if (ch.court) Object.assign(updates, { court: ch.court, courtId: ch.courtId ?? null, scheduledCourtId: ch.courtId ?? null });
                await updateMatchDetails(tournament.id, ch.m.id, updates);
            }
            toast.success('Schedule updated', `${plan.changes.length} match${plan.changes.length === 1 ? '' : 'es'} changed${plan.skipped ? ` · ${plan.skipped} live or finished left as they were` : ''}.`);
            setPlan(null);
        } catch (e: any) {
            toast.error('Couldn’t save the schedule', e?.code === 'permission-denied' ? 'Sign in with the organiser account for this tournament.' : 'Check your connection and try again.');
        } finally { setBusy(false); }
    };

    return (
        <>
            <button onClick={download} disabled={!matches.length} title={matches.length ? 'Download the schedule as Excel' : 'Generate matches first'} className="bg-surface-elevated hover:bg-white/10 disabled:opacity-40 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors border border-white/5"><Download size={16} /> Excel</button>
            <button onClick={() => input.current?.click()} disabled={!matches.length} className="bg-surface-elevated hover:bg-white/10 disabled:opacity-40 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors border border-white/5"><Upload size={16} /> Upload Excel</button>
            <input ref={input} type="file" hidden accept=".xlsx,.csv" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) read(f); }} />
            {plan && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" onClick={() => setPlan(null)}>
                    <div className="w-full max-w-xl max-h-[85vh] overflow-auto rounded-2xl border border-white/10 bg-surface p-5 text-white" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold">Upload schedule · {plan.file}</h3>
                        <p className="mt-1 text-sm text-white/60">{plan.changes.length} match{plan.changes.length === 1 ? '' : 'es'} will change{plan.skipped ? ` · ${plan.skipped} live or finished will be skipped` : ''}.</p>
                        {plan.errors.length > 0 && <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm"><b>Fix these and upload again:</b><ul className="mt-1 list-disc pl-5">{plan.errors.slice(0, 10).map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
                        {!plan.errors.length && (
                            <ul className="mt-3 divide-y divide-white/5 text-sm">
                                {plan.changes.slice(0, 60).map(ch => <li key={ch.m.id} className="flex justify-between gap-3 py-2"><span className="truncate">{ch.m.team1Name} v {ch.m.team2Name}</span><span className="shrink-0 text-white/70">{(ch.at || ch.m.scheduledTime) ? new Date(ch.at || ch.m.scheduledTime!).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'} · {ch.court || ch.m.court || '—'}</span></li>)}
                                {!plan.changes.length && <li className="py-2 text-white/60">Nothing to change: the sheet matches the current schedule.</li>}
                            </ul>
                        )}
                        <div className="mt-4 flex justify-end gap-2">
                            <button onClick={() => setPlan(null)} className="rounded-lg border border-white/10 px-4 py-2 font-bold">Cancel</button>
                            <button onClick={apply} disabled={busy || plan.errors.length > 0 || !plan.changes.length} className="rounded-lg bg-brand px-4 py-2 font-bold disabled:opacity-40">{busy ? 'Saving…' : 'Apply'}</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default PadelScheduleSheet;
