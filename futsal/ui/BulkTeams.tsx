// Organiser bulk upload: download a spreadsheet template (one row per player),
// fill it in Excel, upload it back (.xlsx or .csv), check the preview, import every team at once.
import React, { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { teamInitials } from '../engine';
import { newId } from '../presets';
import { saveFutsalTeams } from '../store';
import type { FutsalCategory, FutsalTeam, FutsalTournament, Position } from '../types';
import { readXlsx, writeXlsx } from '../xlsx';

const HEAD = ['Team Name', 'Player Name', 'Player Email', 'Player Phone', 'Captain (Y/N)', 'Shirt Number', 'Position (GK/DEF/MID/FWD)'];
const COLORS = ['#E4202C', '#2563EB', '#16A34A', '#F28C28', '#7C3AED', '#0EA5E9', '#E0A800', '#EC4899', '#111827', '#84CC16', '#14B8A6', '#A855F7'];
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const SAMPLE = [
    HEAD,
    ['Code Strikers', 'Hamza Siddiqui', 'hamza@example.com', '03001234567', 'Y', '1', 'GK'],
    ['Code Strikers', 'Ali Raza', 'ali@example.com', '', '', '7', 'FWD'],
    ['Code Strikers', 'Usman Tariq', '', '', '', '8', 'MID'],
    ['Bug Busters', 'Omer Farooq', 'omer@example.com', '', 'Y', '10', 'MID'],
    ['Bug Busters', 'Talha Iqbal', '', '', '', '1', 'GK'],
];
const save = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};
/** The squad template as an Excel workbook (or CSV for anyone without Excel). */
export const downloadTemplate = async (kind: 'xlsx' | 'csv' = 'xlsx') => {
    if (kind === 'xlsx') { save(await writeXlsx(SAMPLE, 'Squads'), 'MatchUp_Squads_Template.xlsx'); return; }
    const csv = SAMPLE.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    save(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), 'MatchUp_Squads_Template.csv');
};
/** Excel drops a phone's leading zero when the cell is a number: put it back. */
const phoneOf = (v: string) => { const d = v.replace(/[^\d+]/g, ''); return /^3\d{9}$/.test(d) ? `0${d}` : d; };

/** CSV with quotes, commas inside quotes and Excel's BOM. */
export const parseCsv = (text: string): string[][] => {
    const out: string[][] = [];
    let row: string[] = [], cell = '', q = false;
    const src = text.replace(/^﻿/, '');
    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (q) {
            if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
            else if (c === '"') q = false;
            else cell += c;
        } else if (c === '"') q = true;
        else if (c === ',' || c === ';' || c === '\t') { row.push(cell); cell = ''; }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && src[i + 1] === '\n') i++;
            row.push(cell); cell = '';
            if (row.some(x => x.trim())) out.push(row);
            row = [];
        } else cell += c;
    }
    row.push(cell);
    if (row.some(x => x.trim())) out.push(row);
    return out;
};

interface Parsed { teams: FutsalTeam[]; errors: string[]; warnings: string[] }

const build = (rows: string[][], t: FutsalTournament, cat: FutsalCategory, existing: FutsalTeam[]): Parsed => {
    const errors: string[] = [], warnings: string[] = [];
    if (rows.length < 2) return { teams: [], errors: ['The file has no player rows under the header.'], warnings };
    const head = rows[0].map(h => h.toLowerCase());
    const col = (re: RegExp) => head.findIndex(h => re.test(h));
    const c = { team: col(/team/), player: col(/player\s*name|^name/), email: col(/mail/), phone: col(/phone|mobile|whatsapp/), cap: col(/captain/), num: col(/shirt|number|no\b/), pos: col(/pos/) };
    if (c.team < 0 || c.player < 0) return { teams: [], errors: ['Missing the "Team Name" or "Player Name" column. Start from the template.'], warnings };
    const byTeam = new Map<string, { name: string; rows: { line: number; name: string; email: string; phone: string; cap: boolean; num?: number; pos: Position }[] }>();
    rows.slice(1).forEach((r, i) => {
        const line = i + 2;
        const team = (r[c.team] || '').trim(), name = (r[c.player] || '').trim();
        if (!team && !name) return;
        if (!team) { errors.push(`Row ${line}: team name is empty.`); return; }
        if (!name) { errors.push(`Row ${line}: player name is empty.`); return; }
        const email = c.email >= 0 ? (r[c.email] || '').trim().toLowerCase() : '';
        if (email && !EMAIL.test(email)) errors.push(`Row ${line}: "${email}" isn't a valid email.`);
        const pos = (c.pos >= 0 ? (r[c.pos] || '').trim().toUpperCase() : '') as Position;
        const num = c.num >= 0 && /^\d{1,2}$/.test((r[c.num] || '').trim()) ? Number(r[c.num].trim()) : undefined;
        const key = team.toLowerCase();
        if (!byTeam.has(key)) byTeam.set(key, { name: team, rows: [] });
        const phone = c.phone >= 0 ? phoneOf(r[c.phone] || '') : '';
        byTeam.get(key)!.rows.push({ line, name, email, phone, cap: /^(y|yes|true|1|c|captain)$/i.test((c.cap >= 0 ? r[c.cap] : '').trim()), num, pos: ['GK', 'DEF', 'MID', 'FWD'].includes(pos) ? pos : '' });
    });
    const teams: FutsalTeam[] = [];
    let colour = existing.length;
    byTeam.forEach(({ name, rows: ps }) => {
        const caps = ps.filter(p => p.cap);
        if (caps.length === 0) errors.push(`${name}: mark one player as captain (Y).`);
        if (caps.length > 1) errors.push(`${name}: ${caps.length} captains; mark just one.`);
        if (caps.length === 1 && !caps[0].email) errors.push(`${name}: the captain's email is required (row ${caps[0].line}).`);
        if (ps.length < cat.rules.squadMin) warnings.push(`${name}: ${ps.length} players, below the ${cat.rules.squadMin}-player minimum.`);
        if (ps.length > cat.rules.squadMax) warnings.push(`${name}: ${ps.length} players, above the ${cat.rules.squadMax}-player maximum.`);
        const nums = ps.map(p => p.num).filter(n => n != null);
        if (new Set(nums).size !== nums.length) warnings.push(`${name}: two players share a shirt number.`);
        if (existing.some(x => x.categoryId === cat.id && x.name.trim().toLowerCase() === name.toLowerCase())) warnings.push(`${name}: already registered; its squad will be replaced.`);
        const cap = caps[0];
        const prior = existing.find(x => x.categoryId === cat.id && x.name.trim().toLowerCase() === name.toLowerCase());
        teams.push({
            id: prior?.id || newId('t_'), tournamentId: t.id, categoryId: cat.id, name, shortName: prior?.shortName || teamInitials(name),
            color: prior?.color || COLORS[colour++ % COLORS.length], captainName: cap?.name || ps[0].name, captainEmail: cap?.email || '', captainPhone: cap?.phone || prior?.captainPhone, logoUrl: prior?.logoUrl,
            status: 'ACCEPTED', seed: prior?.seed, groupId: prior?.groupId, registeredAt: prior?.registeredAt || new Date().toISOString(),
            // Captain first, so they lead the squad list.
            players: [...ps].sort((a, b) => Number(b.cap) - Number(a.cap)).map(p => ({ id: prior?.players.find(x => x.name.trim().toLowerCase() === p.name.toLowerCase())?.id || newId('p_'), name: p.name, email: p.email || undefined, phone: p.phone || undefined, number: p.num, position: p.pos })),
        });
    });
    const full = existing.filter(x => x.categoryId === cat.id && x.status === 'ACCEPTED' && !teams.some(n => n.id === x.id)).length + teams.length;
    if (full > cat.maxTeams) warnings.push(`${cat.name} would have ${full} teams; the limit is ${cat.maxTeams}. Raise it under Categories if that's intended.`);
    return { teams, errors, warnings };
};

export const BulkTeams: React.FC<{ t: FutsalTournament; cat: FutsalCategory; existing: FutsalTeam[]; onDone: (msg: string) => void; onClose: () => void }> = ({ t, cat, existing, onDone, onClose }) => {
    const [parsed, setParsed] = useState<Parsed | null>(null);
    const [file, setFile] = useState('');
    const [busy, setBusy] = useState(false);
    const input = useRef<HTMLInputElement>(null);

    const read = async (f: File) => {
        setFile(f.name);
        if (/\.xls$/i.test(f.name)) {
            setParsed({ teams: [], errors: ['That’s the old .xls format. In Excel choose File → Save As → Excel Workbook (.xlsx), then upload again.'], warnings: [] });
            return;
        }
        try {
            const rows = /\.xlsx$/i.test(f.name) ? await readXlsx(f) : parseCsv(await f.text());
            setParsed(build(rows, t, cat, existing));
        } catch {
            setParsed({ teams: [], errors: ['Couldn’t read that file. Start from the template and save it as .xlsx or .csv.'], warnings: [] });
        }
    };
    const importAll = async () => {
        if (!parsed || parsed.errors.length) return;
        setBusy(true);
        try {
            await saveFutsalTeams(parsed.teams);
            onDone(`${parsed.teams.length} teams imported into ${cat.name}`);
        } catch (e: any) {
            setParsed({ ...parsed, errors: [e?.code === 'permission-denied' ? 'You don’t have permission to add teams to this competition.' : 'Import failed. Check your connection and try again.'] });
        } finally { setBusy(false); }
    };

    return (
        <div className="fx-card fx-card--pad fx-stack">
            <div className="fx-row fx-row--between">
                <h2 style={{ fontSize: 24 }}>Bulk upload · {cat.name}</h2>
                <button type="button" className="fx-btn fx-btn--sm" onClick={onClose}>Close</button>
            </div>
            <ol className="fx-muted" style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.7 }}>
                <li>Download the Excel template and open it in Excel or Google Sheets.</li>
                <li>One row per player: team name, player name, email, phone, shirt number, position, and <b>Y</b> in the captain column for each team's captain.</li>
                <li>The captain's email is required (they sign in with it). Other columns are optional.</li>
                <li>Upload the .xlsx (or a CSV). You'll see a preview before anything is saved. A team that already exists gets its squad replaced, so you can re-upload corrected lists.</li>
            </ol>
            <div className="fx-row">
                <button type="button" className="fx-btn" onClick={() => downloadTemplate('xlsx')}><Download />Excel template</button>
                <button type="button" className="fx-btn fx-btn--sm" onClick={() => downloadTemplate('csv')}>CSV</button>
                <button type="button" className="fx-btn fx-btn--primary" onClick={() => input.current?.click()}><Upload />Upload file</button>
                <input ref={input} type="file" accept=".xlsx,.csv,.txt,.xls" hidden onChange={e => { const f = e.target.files?.[0]; if (f) read(f); e.target.value = ''; }} />
                {file && <span className="fx-muted" style={{ fontSize: 13 }}>{file}</span>}
            </div>
            {parsed && (
                <>
                    {parsed.errors.length > 0 && <div className="fx-note fx-note--err" role="alert"><b>Fix these and upload again:</b><ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{parsed.errors.slice(0, 12).map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
                    {parsed.warnings.length > 0 && <div className="fx-note fx-note--warn"><ul style={{ margin: 0, paddingLeft: 18 }}>{parsed.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></div>}
                    {parsed.teams.length > 0 && (
                        <div className="fx-table-wrap">
                            <table className="fx-table">
                                <thead><tr><th>#</th><th>Team</th><th>Captain</th><th className="fx-hide-sm">Captain email</th><th>Players</th></tr></thead>
                                <tbody>
                                    {parsed.teams.map((x, i) => (
                                        <tr key={x.id}><td className="fx-pos">{i + 1}</td><td style={{ textAlign: 'left' }}><b>{x.name}</b></td><td>{x.captainName}</td><td className="fx-hide-sm">{x.captainEmail || '—'}</td><td title={x.players.map(p => p.name).join(', ')}>{x.players.length}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <div className="fx-row">
                        <button type="button" className="fx-btn fx-btn--primary" disabled={busy || !!parsed.errors.length || !parsed.teams.length} onClick={importAll}>{busy ? 'Importing…' : `Import ${parsed.teams.length} teams`}</button>
                    </div>
                </>
            )}
        </div>
    );
};
