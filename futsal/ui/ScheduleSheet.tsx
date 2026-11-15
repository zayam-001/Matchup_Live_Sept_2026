// Schedule from Excel: download the fixtures as a sheet (or the fixtures the app would generate, with
// blank dates), fill in dates, times and pitches (or a whole schedule), upload it back, check the preview,
// apply. Matches already under way or finished are never changed.
import React, { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { blankMatch, generateFixtures, isKnockout, resolveSlots } from '../engine';
import { newId } from '../presets';
import { saveFutsalMatches } from '../store';
import type { FutsalCategory, FutsalMatch, FutsalTeam, FutsalTournament, SlotSource, Stage } from '../types';
import { readXlsx, writeXlsx } from '../xlsx';
import { parseCsv } from './BulkTeams';

const HEAD = ['Match No', 'Stage', 'Group', 'Date (YYYY-MM-DD)', 'Time (HH:MM, 24h)', 'Pitch', 'Home team', 'Away team'];
const STAGE_TEXT: Record<Stage, string> = { LEAGUE: 'League', GROUP: 'Group', R64: 'Round of 64', R32: 'Round of 32', R16: 'Round of 16', QF: 'Quarter-final', SF: 'Semi-final', F: 'Final', '3P': 'Third place', QUAL: 'Qualifier', EL1: 'Eliminator 1', EL2: 'Eliminator 2' };
const STAGE_ORDER: Stage[] = ['LEAGUE', 'GROUP', 'R64', 'R32', 'R16', 'QF', 'QUAL', 'EL1', 'SF', 'EL2', '3P', 'F'];
const ord = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;
const pad = (n: number) => String(n).padStart(2, '0');
const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

const stageOf = (raw: string): Stage | null => {
    const s = key(raw).replace(/[-_]/g, ' ');
    if (!s || s === 'league' || s === 'round robin') return 'LEAGUE';
    if (s.startsWith('group')) return 'GROUP';
    if (/^(qualifier|q1)$/.test(s)) return 'QUAL';
    if (/^(eliminator 1|eliminator|e1|el1)$/.test(s)) return 'EL1';
    if (/^(eliminator 2|e2|el2|qualifier 2|q2)$/.test(s)) return 'EL2';
    if (/^(final|f)$/.test(s)) return 'F';
    if (/^(semi ?finals?|sf)$/.test(s)) return 'SF';
    if (/^(quarter ?finals?|qf)$/.test(s)) return 'QF';
    if (/^(round of 16|r16|last 16)$/.test(s)) return 'R16';
    if (/^(round of 32|r32)$/.test(s)) return 'R32';
    if (/^(round of 64|r64)$/.test(s)) return 'R64';
    if (/^(third place|3rd place|3p|bronze)$/.test(s)) return '3P';
    return null;
};

/** Excel dates arrive as text or as a day count; times as text, AM/PM, or a fraction of a day. */
export const dateOf = (raw: string): string | null => {
    const s = raw.trim();
    if (/^\d{5}$/.test(s)) { const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/); if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/); if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`; // day/month/year
    return null;
};
export const timeOf = (raw: string): string | null => {
    const s = raw.trim().toLowerCase();
    if (/^0?\.\d+$/.test(s) || /^0$/.test(s)) { const mins = Math.round(Number(s) * 1440); return `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`; }
    const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
    if (!m) return null;
    let h = +m[1]; const min = +(m[2] || 0);
    if (m[3] === 'pm' && h < 12) h += 12;
    if (m[3] === 'am' && h === 12) h = 0;
    return h < 24 && min < 60 ? `${pad(h)}:${pad(min)}` : null;
};

/** What a cell in Home/Away means: a team, a table position, or the winner/loser of another match. */
type Side = { teamId?: string; from?: SlotSource; refNo?: number; refType?: 'winner' | 'loser' } | null;
const sideOf = (raw: string, teams: FutsalTeam[]): Side | 'tbd' | 'bad' => {
    const s = key(raw);
    if (!s || s === 'tbd' || s === 'tba' || s === '-') return 'tbd';
    const t = teams.find(x => key(x.name) === s || key(x.shortName || '') === s);
    if (t) return { teamId: t.id };
    let m = s.match(/^(\d+)(?:st|nd|rd|th)?\s*(?:in\s*)?(?:the\s*)?(?:league|table)$/); if (m) return { from: { type: 'league', pos: +m[1] } };
    m = s.match(/^(?:group\s*)?([a-p])\s*(\d+)(?:st|nd|rd|th)?$/) || s.match(/^(\d+)(?:st|nd|rd|th)?\s*(?:in\s*)?group\s*([a-p])$/);
    if (m) { const [g, p] = /^\d/.test(m[1]) ? [m[2], m[1]] : [m[1], m[2]]; return { from: { type: 'group', group: g.toUpperCase(), pos: +p } }; }
    m = s.match(/^(winner|loser)\s*(?:of\s*)?(?:m|match\s*)?#?\s*(\d+)$/); if (m) return { refType: m[1] as 'winner' | 'loser', refNo: +m[2] };
    m = s.match(/^seed\s*(\d+)$/); if (m) return { from: { type: 'seed', seed: +m[1] } };
    return 'bad';
};

interface Row { line: number; no: number; stage: Stage; group?: string; startAt?: string; pitch?: string; home: Side | 'tbd'; away: Side | 'tbd' }
interface Plan { rows: Row[]; errors: string[]; warnings: string[]; creates: number; updates: number; locked: number }

export const ScheduleSheet: React.FC<{ t: FutsalTournament; cat: FutsalCategory; teams: FutsalTeam[]; matches: FutsalMatch[]; onDone: (msg: string) => void }> = ({ t, cat, teams, matches, onDone }) => {
    const accepted = teams.filter(x => x.categoryId === cat.id && x.status === 'ACCEPTED');
    const catMatches = matches.filter(m => m.categoryId === cat.id);
    const [plan, setPlan] = useState<Plan | null>(null);
    const [file, setFile] = useState('');
    const [busy, setBusy] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const nameOf = (id?: string) => accepted.find(x => x.id === id)?.name || '';

    const download = async () => {
        // Existing fixtures, or the fixtures the app would generate (dates left for the organiser).
        const base = catMatches.length ? [...catMatches] : generateFixtures(t.id, cat, teams).map((m, i) => ({ ...m, matchNo: i + 1 }));
        const byId = new Map(base.map(m => [m.id, m]));
        const slot = (teamId?: string, from?: SlotSource) => teamId ? nameOf(teamId)
            : !from ? 'TBD' : from.type === 'league' ? `${ord(from.pos)} in league` : from.type === 'group' ? `Group ${from.group} ${ord(from.pos)}`
                : from.type === 'seed' ? `Seed ${from.seed}` : `${from.type === 'winner' ? 'Winner' : 'Loser'} M${byId.get(from.matchId)?.matchNo ?? '?'}`;
        const rows = base.sort((a, b) => a.matchNo - b.matchNo).map(m => {
            const d = m.startAt ? new Date(m.startAt) : null;
            return [String(m.matchNo), STAGE_TEXT[m.stage], m.group || '', d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '', d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '', m.pitch || t.pitches[0] || '', slot(m.homeId, m.homeFrom), slot(m.awayId, m.awayFrom)];
        });
        const blob = await writeXlsx([HEAD, ...rows], 'Schedule');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${t.name.replace(/[^\w]+/g, '-')}-${cat.name.replace(/[^\w]+/g, '-')}-schedule.xlsx`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const read = async (f: File) => {
        setFile(f.name); setPlan(null);
        let raw: string[][];
        try { raw = /\.xlsx$/i.test(f.name) ? await readXlsx(f) : parseCsv(await f.text()); }
        catch { setPlan({ rows: [], errors: ['Couldn’t read that file. Start from the downloaded template and save it as .xlsx or .csv.'], warnings: [], creates: 0, updates: 0, locked: 0 }); return; }
        const head = (raw[0] || []).map(h => key(h));
        const col = (re: RegExp) => head.findIndex(h => re.test(h));
        const c = { no: col(/match|no|#/), stage: col(/stage|round/), group: col(/group/), date: col(/date|day/), time: col(/time|kick/), pitch: col(/pitch|court|ground|venue/), home: col(/home|team 1|team a/), away: col(/away|team 2|team b/) };
        const errors: string[] = [], warnings: string[] = [];
        if (c.home < 0 || c.away < 0) errors.push('Missing the "Home team" or "Away team" column. Start from the downloaded template.');
        const rows: Row[] = [];
        const seen = new Set<number>();
        raw.slice(1).forEach((r, i) => {
            const line = i + 2, cell = (k: number) => (k >= 0 ? (r[k] || '').trim() : '');
            if (!r.some(x => (x || '').trim()) || cell(0).startsWith('#')) return;
            const no = Number(cell(c.no)) || (rows.length ? Math.max(...rows.map(x => x.no)) + 1 : 1);
            if (seen.has(no)) { errors.push(`Row ${line}: match ${no} appears twice.`); return; }
            seen.add(no);
            const stage = stageOf(cell(c.stage));
            if (!stage) { errors.push(`Row ${line}: "${cell(c.stage)}" isn’t a stage we know (League, Group, Quarter-final, Semi-final, Final, Qualifier, Eliminator 1/2…).`); return; }
            const group = stage === 'GROUP' ? (cell(c.group) || cell(c.stage).replace(/^group\s*/i, '')).toUpperCase().slice(0, 1) : undefined;
            if (stage === 'GROUP' && !group) errors.push(`Row ${line}: a group match needs its group letter.`);
            const ds = cell(c.date), ts = cell(c.time);
            let startAt: string | undefined;
            if (ds || ts) {
                const d = dateOf(ds), tm = timeOf(ts);
                if (!d) errors.push(`Row ${line}: "${ds}" isn’t a date. Use YYYY-MM-DD, e.g. 2026-11-17.`);
                else if (!tm) errors.push(`Row ${line}: "${ts}" isn’t a time. Use 24-hour HH:MM, e.g. 18:40.`);
                else startAt = new Date(`${d}T${tm}:00`).toISOString();
            }
            const pitch = cell(c.pitch);
            if (pitch && t.pitches.length && !t.pitches.some(p => key(p) === key(pitch))) warnings.push(`Row ${line}: "${pitch}" isn’t one of this tournament’s ${t.pitches.length > 1 ? 'pitches' : 'pitch'} (${t.pitches.join(', ')}). It will be saved as written.`);
            const home = sideOf(cell(c.home), accepted), away = sideOf(cell(c.away), accepted);
            for (const [lbl, v, txt] of [['Home', home, cell(c.home)], ['Away', away, cell(c.away)]] as const) {
                if (v === 'bad') errors.push(`Row ${line}: ${lbl} "${txt}" isn’t a team in ${cat.name}, or a slot like "1st in league", "Group A 2nd", "Winner M16".`);
                else if (!isKnockout(stage) && (v === 'tbd' || !v?.teamId)) errors.push(`Row ${line}: ${STAGE_TEXT[stage].toLowerCase()} matches need real teams on both sides.`);
            }
            if (home !== 'bad' && away !== 'bad' && home !== 'tbd' && away !== 'tbd' && home?.teamId && home.teamId === away?.teamId) errors.push(`Row ${line}: a team can’t play itself.`);
            if (home === 'bad' || away === 'bad') return;
            rows.push({ line, no, stage, group, startAt, pitch: pitch || undefined, home, away });
        });
        // Winner/loser references must point at a match in the sheet; league pairings shouldn't repeat.
        rows.forEach(r => [r.home, r.away].forEach(s => { if (s && s !== 'tbd' && s.refNo && !rows.some(x => x.no === s.refNo)) errors.push(`Row ${r.line}: refers to match ${s.refNo}, which isn’t in the sheet.`); }));
        const pairs = new Map<string, number>();
        rows.filter(r => !isKnockout(r.stage)).forEach(r => {
            const a = (r.home as Side)?.teamId, b = (r.away as Side)?.teamId; if (!a || !b) return;
            const k = [a, b].sort().join('|');
            if (pairs.has(k) && cat.format !== 'DOUBLE_LEAGUE') warnings.push(`Row ${r.line}: ${nameOf(a)} v ${nameOf(b)} is already match ${pairs.get(k)}.`);
            pairs.set(k, r.no);
        });
        const clash = new Map<string, number>();
        rows.forEach(r => { if (!r.startAt || !r.pitch) return; const k = `${r.startAt}|${key(r.pitch)}`; if (clash.has(k)) warnings.push(`Row ${r.line}: same time and pitch as match ${clash.get(k)}.`); clash.set(k, r.no); });
        const existing = new Map(catMatches.map(m => [m.matchNo, m]));
        const locked = rows.filter(r => existing.get(r.no) && existing.get(r.no)!.status !== 'SCHEDULED').length;
        if (locked) warnings.push(`${locked} match${locked > 1 ? 'es have' : ' has'} already started or finished and won’t be changed.`);
        setPlan({ rows, errors, warnings, creates: rows.filter(r => !existing.has(r.no)).length, updates: rows.filter(r => existing.get(r.no)?.status === 'SCHEDULED').length, locked });
    };

    const apply = async () => {
        if (!plan || plan.errors.length) return;
        setBusy(true);
        try {
            const existing = new Map(catMatches.map(m => [m.matchNo, m]));
            const idOf = new Map(plan.rows.map(r => [r.no, existing.get(r.no)?.id || newId('m_')]));
            const dates = [...new Set(plan.rows.filter(r => !isKnockout(r.stage) && r.startAt).map(r => r.startAt!.slice(0, 10)))].sort();
            const out: FutsalMatch[] = [];
            for (const r of plan.rows) {
                const prev = existing.get(r.no);
                if (prev && prev.status !== 'SCHEDULED') continue;
                const side = (s: Side | 'tbd'): Pick<FutsalMatch, 'homeId' | 'homeFrom'> => !s || s === 'tbd' ? {} : s.teamId ? { homeId: s.teamId } : s.refNo ? { homeFrom: { type: s.refType!, matchId: idOf.get(s.refNo)! } } : { homeFrom: s.from };
                const h = side(r.home), a = side(r.away);
                const round = isKnockout(r.stage) ? 100 + STAGE_ORDER.indexOf(r.stage) : r.startAt ? dates.indexOf(r.startAt.slice(0, 10)) + 1 : prev?.round || 1;
                const base = prev || blankMatch({ tournamentId: t.id, categoryId: cat.id, stage: r.stage, round, id: idOf.get(r.no)! });
                out.push({ ...base, id: idOf.get(r.no)!, matchNo: r.no, stage: r.stage, group: r.group, round, startAt: r.startAt, pitch: r.pitch,
                    homeId: h.homeId, homeFrom: h.homeFrom, awayId: a.homeId, awayFrom: a.homeFrom } as FutsalMatch);
            }
            // Fill any knockout slot that's already decided (e.g. the league has finished).
            const merged = [...catMatches.filter(m => !out.some(o => o.id === m.id)), ...out];
            const filled = new Map(resolveSlots(cat, teams, merged).map(m => [m.id, m]));
            await saveFutsalMatches(out.map(m => filled.get(m.id) || m));
            onDone(`Schedule uploaded: ${plan.creates} new, ${plan.updates} updated${plan.locked ? `, ${plan.locked} already played left as they were` : ''}.`);
            setPlan(null); setFile('');
        } catch (e: any) {
            setPlan(p => p && { ...p, errors: [e?.code === 'permission-denied' ? 'You don’t have permission for that. Sign in with the organiser account that owns this competition.' : 'Couldn’t save the schedule. Check your connection and try again.'] });
        } finally { setBusy(false); }
    };

    return (
        <div className="fx-card fx-card--pad fx-stack">
            <div className="fx-row fx-row--between">
                <div>
                    <h3 style={{ fontSize: 20 }}>Schedule from Excel</h3>
                    <p className="fx-muted" style={{ margin: '4px 0 0', fontSize: 13 }}>Already have a schedule? Download the sheet, fill in dates, times, {t.pitches.length > 1 ? 'pitches' : 'the pitch'} and teams, then upload it. Knockout slots can be written as “1st in league”, “Group A 2nd” or “Winner M16”.</p>
                </div>
                <div className="fx-row">
                    <button type="button" className="fx-btn" onClick={download}><Download />{catMatches.length ? 'Download schedule' : 'Download template'}</button>
                    <button type="button" className="fx-btn fx-btn--primary" disabled={busy} onClick={() => input.current?.click()}><Upload />Upload schedule</button>
                    <input ref={input} type="file" hidden accept=".xlsx,.csv" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) read(f); }} />
                </div>
            </div>
            {plan && (
                <div className="fx-stack">
                    <p className="fx-muted" style={{ margin: 0 }}><b>{file}</b> · {plan.rows.length} matches · {plan.creates} new · {plan.updates} to update{plan.locked ? ` · ${plan.locked} already played (skipped)` : ''}</p>
                    {plan.errors.length > 0 && <div className="fx-note fx-note--err"><b>Fix these and upload again:</b><ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{plan.errors.slice(0, 12).map((x, i) => <li key={i}>{x}</li>)}</ul>{plan.errors.length > 12 && <small>…and {plan.errors.length - 12} more.</small>}</div>}
                    {plan.warnings.length > 0 && <div className="fx-note fx-note--warn"><b>Check:</b><ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{plan.warnings.slice(0, 8).map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
                    {!plan.errors.length && (
                        <div className="fx-list" style={{ maxHeight: 260, overflow: 'auto' }}>
                            {plan.rows.slice(0, 60).map(r => {
                                const lbl = (s: Side | 'tbd') => !s || s === 'tbd' ? 'TBD' : s.teamId ? nameOf(s.teamId) : s.refNo ? `${s.refType === 'winner' ? 'Winner' : 'Loser'} M${s.refNo}` : s.from?.type === 'league' ? `${ord(s.from.pos)} in league` : s.from?.type === 'group' ? `Group ${s.from.group} ${ord(s.from.pos)}` : 'Seed';
                                return <div key={r.no} className="fx-li"><b style={{ width: 36 }}>{r.no}</b><span style={{ width: 110 }} className="fx-muted">{STAGE_TEXT[r.stage]}{r.group ? ` ${r.group}` : ''}</span><span className="fx-li__main"><b>{lbl(r.home)} v {lbl(r.away)}</b><small>{r.startAt ? new Date(r.startAt).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'No time yet'}{r.pitch ? ` · ${r.pitch}` : ''}</small></span></div>;
                            })}
                        </div>
                    )}
                    <div className="fx-row">
                        <button type="button" className="fx-btn fx-btn--primary" disabled={busy || plan.errors.length > 0} onClick={apply}>{busy ? 'Saving…' : `Apply schedule (${plan.creates + plan.updates})`}</button>
                        <button type="button" className="fx-btn" onClick={() => { setPlan(null); setFile(''); }}>Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScheduleSheet;
