import React, { useEffect, useMemo, useState } from 'react';
import { Award, CalendarClock, Copy, LayoutDashboard, ListChecks, Plus, Settings, Shuffle, Trash2, Trophy as TrophyIcon, Upload, Users } from 'lucide-react';
import { BulkTeams } from './BulkTeams';
import { ScheduleSheet } from './ScheduleSheet';
import { uploadSystemImage } from '../../services/storage';
import { blankMatch, computeAwards, computeStandings, drawGroups, finishMatch, generateFixtures, GROUP_NAMES, hasKnockoutStage, isKnockout, playerStats, resetMatch, resolveSlots, scoreOf, teamInitials } from '../engine';
import { FORMAT_LABELS, matchMinutes, newCategory, newId, PRESETS, TIEBREAKER_LABELS } from '../presets';
import { scheduleMatches } from '../scheduler';
import { deleteFutsalMatches, deleteFutsalTeam, deleteFutsalTournament, saveFutsalMatch, saveFutsalMatches, saveFutsalTeam, saveFutsalTeams } from '../store';
import type { CompetitionFormat, FutsalCategory, FutsalEvent, FutsalMatch, FutsalRules, FutsalTeam, FutsalTournament, PresetId, Tiebreaker, TournamentStatus } from '../types';
import { COLORS, SquadEditor } from './Register';
import { plural } from './views';
import { catOf, Crest, dateRange, Empty, fmtTime, playerName, stageText, teamName } from './shared';
import { CUSTOM_PRESET, DEFAULT_PRESET, PITCH_WORD, pitchObsPath, PRESETS_BY_SPORT, publicPath, scorePath, sportOf } from '../sport';
import { confirmDialog } from '../../components/ui/ConfirmDialog';
import { toast as appToast } from '../../components/Toast';

export const GLOBAL_ADMINS = ['eventletics.business@gmail.com', 'zayam.anjum@gmail.com'];
const STATUS_FLOW: TournamentStatus[] = ['DRAFT', 'REGISTRATION', 'ACTIVE', 'COMPLETED'];
export const STATUS_LABEL: Record<TournamentStatus, string> = { DRAFT: 'Draft (hidden)', REGISTRATION: 'Registration open', ACTIVE: 'In progress', COMPLETED: 'Finished' };
export const SECTIONS = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'categories', label: 'Categories & rules', icon: ListChecks },
    { id: 'teams', label: 'Teams', icon: Users },
    { id: 'fixtures', label: 'Draw & fixtures', icon: CalendarClock },
    { id: 'results', label: 'Results', icon: TrophyIcon },
    { id: 'awards', label: 'Awards', icon: Award },
    { id: 'settings', label: 'Settings', icon: Settings },
] as const;

export const errText = (e: any) => (e?.code === 'permission-denied' ? 'You don’t have permission for that. Sign in with the organiser account that owns this competition.' : e?.message || 'Something went wrong. Try again.');

export const applyPreset = (c: FutsalCategory, p: PresetId): FutsalCategory => ({ ...c, rules: { ...structuredClone(PRESETS[p].rules), points: { ...c.rules.points }, tiebreakers: c.rules.tiebreakers } });

// ---------------------------------------------------------------- manage

export interface Ctx { t: FutsalTournament; teams: FutsalTeam[]; matches: FutsalMatch[]; toast: (s: string) => void; saveT: (t: FutsalTournament, msg?: string) => Promise<void>; go: (section: string) => void; onDeleted: () => void }

const CopyField: React.FC<{ label: string; value: string; toast: (s: string) => void }> = ({ label, value, toast }) => (
    <div className="fx-field">
        <label>{label}</label>
        <div className="fx-copy">
            <input className="fx-input" readOnly value={value} onFocus={e => e.currentTarget.select()} aria-label={label} />
            <button type="button" className="fx-btn" onClick={async () => { try { await navigator.clipboard.writeText(value); toast('Copied'); } catch { toast('Select the text and copy it'); } }}><Copy />Copy</button>
        </div>
    </div>
);

export const Overview: React.FC<Ctx> = ({ t, teams, matches, toast, saveT, go }) => {
    const origin = window.location.origin;
    const accepted = teams.filter(x => x.status === 'ACCEPTED').length;
    const pending = teams.filter(x => x.status === 'PENDING').length;
    const played = matches.filter(m => m.status === 'COMPLETED').length;
    const live = matches.filter(m => m.status === 'LIVE').length;
    const unscheduled = matches.filter(m => !m.startAt).length;
    const steps = [
        { done: t.categories.length > 0, text: 'Set up categories and rules', go: 'categories' },
        { done: t.status !== 'DRAFT', text: 'Open registration', go: 'overview' },
        { done: accepted >= 2 && !pending, text: pending ? `Review ${pending} pending ${pending === 1 ? 'team' : 'teams'}` : 'Approve teams', go: 'teams' },
        { done: matches.length > 0, text: 'Make the draw and generate fixtures', go: 'fixtures' },
        { done: matches.length > 0 && !unscheduled, text: 'Schedule fixtures on pitches', go: 'fixtures' },
        { done: played > 0, text: 'Score matches live (share the referee link)', go: 'overview' },
        { done: t.status === 'COMPLETED', text: 'Confirm awards and finish', go: 'awards' },
    ];
    return (
        <>
            <div className="fx-row fx-row--between">
                <h1 className="fx-silver" style={{ fontSize: 'clamp(30px,5vw,48px)' }}>{t.name}</h1>
                <a className="fx-btn" href={`#${publicPath(t)}`} target="_blank" rel="noopener noreferrer">Public page ↗</a>
            </div>
            <div className="fx-kpis">
                <div className="fx-card fx-kpi"><small>Teams</small><b>{accepted}</b>{pending > 0 && <span className="fx-pill fx-pill--gold">{pending} pending</span>}</div>
                <div className="fx-card fx-kpi"><small>Matches played</small><b>{played}<span className="fx-muted" style={{ fontSize: 18 }}> / {matches.length}</span></b></div>
                <div className="fx-card fx-kpi"><small>Live now</small><b>{live}</b></div>
                <div className="fx-card fx-kpi"><small>Categories</small><b>{t.categories.length}</b></div>
            </div>
            <div className="fx-card fx-card--pad fx-stack">
                <h2 style={{ fontSize: 24 }}>Status</h2>
                <div className="fx-chips">
                    {STATUS_FLOW.map(s => <button key={s} type="button" className={`fx-chip ${t.status === s ? 'is-on' : ''}`} aria-pressed={t.status === s} onClick={() => saveT({ ...t, status: s }, `Status: ${STATUS_LABEL[s]}`)}>{STATUS_LABEL[s]}</button>)}
                </div>
                <p className="fx-muted" style={{ margin: 0, fontSize: 13 }}>Drafts are hidden from the public. Teams can register only while registration is open.</p>
            </div>
            <div className="fx-card fx-card--pad">
                <h2 style={{ fontSize: 24, marginBottom: 12 }}>Next steps</h2>
                <div className="fx-list">
                    {steps.map(s => (
                        <button key={s.text} type="button" className="fx-li" style={{ color: '#fff', textAlign: 'left' }} onClick={() => go(s.go)}>
                            <span className={`fx-pill ${s.done ? 'fx-pill--ok' : ''}`}>{s.done ? 'Done' : 'To do'}</span>
                            <span className="fx-li__main"><b style={{ fontWeight: 600 }}>{s.text}</b></span>
                        </button>
                    ))}
                </div>
            </div>
            <div className="fx-card fx-card--pad fx-stack">
                <h2 style={{ fontSize: 24 }}>Share</h2>
                <CopyField label="Public page" value={`${origin}/#${publicPath(t)}`} toast={toast} />
                <CopyField label="Team registration" value={`${origin}/#${publicPath(t)}/register`} toast={toast} />
                <CopyField label="Referee mode" value={`${origin}/#${scorePath(t)}`} toast={toast} />
                <CopyField label="Referee passcode" value={t.scorerPasscode} toast={toast} />
                <p className="fx-muted" style={{ margin: 0, fontSize: 13 }}>Give referees the referee mode link and passcode.</p>
            </div>
            <div className="fx-card fx-card--pad fx-stack">
                <h2 style={{ fontSize: 24 }}>OBS overlays</h2>
                <p className="fx-muted" style={{ margin: 0, fontSize: 13 }}>One browser source per {PITCH_WORD[sportOf(t)].toLowerCase()}. It shows the live match there and switches by itself when the referee starts the next one.</p>
                {t.pitches.map(p => <CopyField key={p} label={p} value={`${origin}/#${pitchObsPath(t, p)}`} toast={toast} />)}
            </div>
        </>
    );
};

// ---------------------------------------------------------------- categories

const NumField: React.FC<{ id: string; label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; hint?: string }> = ({ id, label, value, onChange, min = 0, max = 999, hint }) => (
    <div className="fx-field">
        <label htmlFor={id}>{label}</label>
        <input id={id} className="fx-input" type="number" inputMode="numeric" min={min} max={max} value={Number.isFinite(value) ? value : ''} onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))} />
        {hint && <small className="fx-muted" style={{ fontSize: 11 }}>{hint}</small>}
    </div>
);

export const Categories: React.FC<Ctx> = ({ t, teams, matches, saveT }) => {
    const [openId, setOpenId] = useState<string>(t.categories[0]?.id || '');
    const [draft, setDraft] = useState<FutsalCategory | null>(null);
    const current = t.categories.find(c => c.id === openId);
    useEffect(() => { setDraft(current ? structuredClone(current) : null); }, [openId, current]);
    const locked = (c: FutsalCategory) => matches.some(m => m.categoryId === c.id);
    const setRules = (patch: Partial<FutsalRules>) => draft && setDraft({ ...draft, rules: { ...draft.rules, ...patch, preset: patch.preset || (Object.keys(patch).length ? CUSTOM_PRESET[sportOf(t)] : draft.rules.preset) } });
    const save = () => draft && saveT({ ...t, categories: t.categories.map(c => (c.id === draft.id ? draft : c)) }, 'Category saved');
    const moveTb = (i: number, d: number) => {
        if (!draft) return;
        const list = [...draft.rules.tiebreakers];
        const j = i + d;
        if (j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]];
        setDraft({ ...draft, rules: { ...draft.rules, tiebreakers: list } });
    };
    return (
        <>
            <div className="fx-row fx-row--between">
                <h1 className="fx-silver" style={{ fontSize: 40 }}>Categories & rules</h1>
                <button type="button" className="fx-btn" onClick={() => { const c = newCategory(`Category ${t.categories.length + 1}`, DEFAULT_PRESET[sportOf(t)]); saveT({ ...t, categories: [...t.categories, c] }, 'Category added'); setOpenId(c.id); }}><Plus />Add category</button>
            </div>
            <div className="fx-chips">{t.categories.map(c => <button key={c.id} type="button" className={`fx-chip ${c.id === openId ? 'is-on' : ''}`} onClick={() => setOpenId(c.id)}>{c.name}</button>)}</div>
            {draft && (
                <>
                    {locked(draft) && <div className="fx-note fx-note--warn">Fixtures exist for this category. Rule changes apply to matches from now on; changing the format or groups means regenerating fixtures.</div>}
                    <div className="fx-card fx-card--pad fx-stack">
                        <div className="fx-grid3">
                            <div className="fx-field"><label htmlFor="c-name">Name</label><input id="c-name" className="fx-input" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></div>
                            <div className="fx-field"><label htmlFor="c-div">Division</label>
                                <select id="c-div" className="fx-select" value={draft.division} onChange={e => setDraft({ ...draft, division: e.target.value as FutsalCategory['division'] })}>{['Men', 'Women', 'Kids', 'Mixed'].map(d => <option key={d}>{d}</option>)}</select>
                            </div>
                            <NumField id="c-fee" label={`Entry fee (${t.currency})`} value={draft.entryFee} onChange={n => setDraft({ ...draft, entryFee: n })} max={10000000} />
                        </div>
                        <div>
                            <label>Format preset</label>
                            <div className="fx-presets" style={{ marginTop: 8 }}>
                                {PRESETS_BY_SPORT[sportOf(t)].map(p => (
                                    <button key={p} type="button" className={`fx-preset ${draft.rules.preset === p ? 'is-on' : ''}`} aria-pressed={draft.rules.preset === p} onClick={() => setDraft(applyPreset(draft, p))}>
                                        <b>{PRESETS[p].label}</b><small>{PRESETS[p].blurb}</small>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="fx-grid3">
                            <div className="fx-field"><label htmlFor="c-format">Competition format</label>
                                <select id="c-format" className="fx-select" value={draft.format} onChange={e => setDraft({ ...draft, format: e.target.value as CompetitionFormat })}>{Object.entries(FORMAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                            </div>
                            <NumField id="c-max" label="Max teams" value={draft.maxTeams} min={2} max={64} onChange={n => setDraft({ ...draft, maxTeams: n })} />
                            {(draft.format === 'GROUPS' || draft.format === 'GROUPS_KNOCKOUT') && <NumField id="c-groups" label="Groups" value={draft.groupCount} min={1} max={16} onChange={n => setDraft({ ...draft, groupCount: n })} />}
                            {draft.format === 'LEAGUE_KNOCKOUT' && <NumField id="c-ko" label="Teams in the knockout" value={draft.advancePerGroup} min={2} max={16} onChange={n => setDraft({ ...draft, advancePerGroup: n })} hint="The top teams of the league table go through" />}
                            {draft.format === 'LEAGUE_PLAYOFFS' && <p className="fx-muted" style={{ margin: 0, fontSize: 13, alignSelf: 'end' }}>Top 4: Qualifier (1st v 2nd) and Eliminator 1 (3rd v 4th); the Qualifier loser meets the Eliminator 1 winner in Eliminator 2; then the Final.</p>}
                            {draft.format === 'GROUPS_KNOCKOUT' && <NumField id="c-adv" label="Qualify per group" value={draft.advancePerGroup} min={1} max={8} onChange={n => setDraft({ ...draft, advancePerGroup: n })} hint={`${draft.groupCount * draft.advancePerGroup} teams reach the knockouts`} />}
                        </div>
                    </div>
                    <div className="fx-card fx-card--pad fx-stack">
                        <h2 style={{ fontSize: 24 }}>Match rules</h2>
                        <div className="fx-grid4">
                            <NumField id="r-on" label="Players on pitch" value={draft.rules.onPitch} min={3} max={11} onChange={n => setRules({ onPitch: n })} />
                            <NumField id="r-smin" label="Squad minimum" value={draft.rules.squadMin} min={1} max={30} onChange={n => setRules({ squadMin: n })} />
                            <NumField id="r-smax" label="Squad maximum" value={draft.rules.squadMax} min={draft.rules.squadMin} max={30} onChange={n => setRules({ squadMax: n })} />
                            <NumField id="r-per" label="Halves / periods" value={draft.rules.periods} min={1} max={4} onChange={n => setRules({ periods: n })} hint="1 = one single period, 2 = two halves" />
                            <NumField id="r-len" label="Minutes per period" value={draft.rules.periodMinutes} min={1} max={60} onChange={n => setRules({ periodMinutes: n })} />
                            <NumField id="r-ht" label="Break (min)" value={draft.rules.halftimeMinutes} min={0} max={30} onChange={n => setRules({ halftimeMinutes: n })} />
                            <div className="fx-field"><label htmlFor="r-clock">Clock</label><select id="r-clock" className="fx-select" value={draft.rules.clock} onChange={e => setRules({ clock: e.target.value as FutsalRules['clock'] })}><option value="running">Running</option><option value="stopped">Stopped (ball out = clock stops)</option></select></div>
                            <NumField id="r-to" label="Timeouts per period" value={draft.rules.timeoutsPerPeriod} max={3} onChange={n => setRules({ timeoutsPerPeriod: n })} />
                            <NumField id="r-foul" label="Foul limit (0 = off)" value={draft.rules.foulLimit} max={10} onChange={n => setRules({ foulLimit: n })} hint="After this many, every foul is a 10 m kick" />
                            <NumField id="r-red" label="Red card: minutes short" value={draft.rules.redCardMinutes} max={10} onChange={n => setRules({ redCardMinutes: n })} hint="0 = sent off, no replacement" />
                            <NumField id="r-mercy" label="Mercy rule (goal lead, 0 = off)" value={draft.rules.mercyGoals} max={30} onChange={n => setRules({ mercyGoals: n })} />
                            <NumField id="r-forfeit" label="Walkover score" value={draft.rules.forfeitScore} min={1} max={10} onChange={n => setRules({ forfeitScore: n })} />
                        </div>
                        <div className="fx-grid3">
                            <div className="fx-field"><label htmlFor="r-ko">Knockout draws</label>
                                <select id="r-ko" className="fx-select" value={draft.rules.knockoutTiebreak} onChange={e => setRules({ knockoutTiebreak: e.target.value as FutsalRules['knockoutTiebreak'] })}>
                                    <option value="penalties">Straight to penalties</option><option value="extra_time_penalties">Extra time, then penalties</option><option value="golden_goal">Golden goal extra time, then penalties</option>
                                </select>
                            </div>
                            {draft.rules.knockoutTiebreak !== 'penalties' && <NumField id="r-et" label="Extra time per half (min)" value={draft.rules.extraTimeMinutes} min={1} max={15} onChange={n => setRules({ extraTimeMinutes: n })} />}
                            <div className="fx-field"><label>Points</label><div className="fx-row">
                                {(['win', 'draw', 'loss'] as const).map(k => <input key={k} className="fx-input" style={{ width: 70 }} type="number" aria-label={`Points for a ${k}`} value={draft.rules.points[k]} onChange={e => setDraft({ ...draft, rules: { ...draft.rules, points: { ...draft.rules.points, [k]: Number(e.target.value) || 0 } } })} />)}
                                <small className="fx-muted">W / D / L</small>
                            </div></div>
                        </div>
                        <div className="fx-row">
                            <label className="fx-check"><input type="checkbox" checked={draft.rules.thirdPlace} onChange={e => setRules({ thirdPlace: e.target.checked })} />Third-place match</label>
                            <label className="fx-check"><input type="checkbox" checked={draft.rules.kickIn} onChange={e => setRules({ kickIn: e.target.checked })} />Kick-ins (not throw-ins)</label>
                        </div>
                        <p className="fx-muted" style={{ margin: 0, fontSize: 13 }}>About {matchMinutes(draft.rules, t.schedule.bufferMinutes)} minutes per match slot, changeover included.</p>
                    </div>
                    <div className="fx-card fx-card--pad">
                        <h2 style={{ fontSize: 24, marginBottom: 6 }}>Tiebreakers</h2>
                        <p className="fx-muted" style={{ margin: '0 0 10px', fontSize: 13 }}>Teams level on points are split in this order.</p>
                        <div className="fx-list">
                            {draft.rules.tiebreakers.map((tb: Tiebreaker, i) => (
                                <div key={tb} className="fx-li">
                                    <span className="fx-num">{i + 1}</span><span className="fx-li__main"><b style={{ fontWeight: 600 }}>{TIEBREAKER_LABELS[tb]}</b></span>
                                    <button type="button" className="fx-btn fx-btn--sm" aria-label="Move up" disabled={!i} onClick={() => moveTb(i, -1)}>↑</button>
                                    <button type="button" className="fx-btn fx-btn--sm" aria-label="Move down" disabled={i === draft.rules.tiebreakers.length - 1} onClick={() => moveTb(i, 1)}>↓</button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="fx-row">
                        <button type="button" className="fx-btn fx-btn--primary" onClick={save}>Save category</button>
                        <button type="button" className="fx-btn fx-btn--danger" disabled={teams.some(x => x.categoryId === draft.id) || t.categories.length < 2}
                            title={teams.some(x => x.categoryId === draft.id) ? 'Remove its teams first' : undefined}
                            onClick={async () => { if (await confirmDialog({ title: `Delete ${draft.name}?`, body: 'The category and its settings are removed.', confirmLabel: 'Delete category', danger: true })) { saveT({ ...t, categories: t.categories.filter(c => c.id !== draft.id) }, 'Category deleted'); setOpenId(t.categories.find(c => c.id !== draft.id)?.id || ''); } }}><Trash2 />Delete category</button>
                    </div>
                </>
            )}
        </>
    );
};

// ---------------------------------------------------------------- teams

export const TeamsAdmin: React.FC<Ctx> = ({ t, teams, toast }) => {
    const [catId, setCatId] = useState(t.categories[0]?.id || '');
    const [edit, setEdit] = useState<FutsalTeam | null>(null);
    const [bulk, setBulk] = useState(false);
    const [err, setErr] = useState('');
    const cat = catOf(t, catId);
    const list = teams.filter(x => x.categoryId === cat.id);
    const groups: Record<string, FutsalTeam[]> = { PENDING: [], ACCEPTED: [], REJECTED: [], WITHDRAWN: [] };
    list.forEach(x => (groups[x.status] || groups.PENDING).push(x));
    const setStatus = async (team: FutsalTeam, status: FutsalTeam['status']) => {
        if (status === 'ACCEPTED' && groups.ACCEPTED.length >= cat.maxTeams) { toast(`${cat.name} already has ${cat.maxTeams} teams`); return; }
        try { await saveFutsalTeam({ ...team, status }); toast(`${team.name}: ${status.toLowerCase()}`); } catch (e) { toast(errText(e)); }
    };
    const newTeam = (): FutsalTeam => ({ id: newId('t_'), tournamentId: t.id, categoryId: cat.id, name: '', shortName: '', color: COLORS[list.length % COLORS.length], captainName: '', players: [], status: 'ACCEPTED', registeredAt: new Date().toISOString() });
    const saveEdit = async () => {
        if (!edit) return;
        if (!edit.name.trim()) return setErr('Team name is required.');
        const players = edit.players.filter(p => p.name.trim());
        try {
            await saveFutsalTeam({ ...edit, name: edit.name.trim(), shortName: (edit.shortName || teamInitials(edit.name)).toUpperCase().slice(0, 3), captainName: edit.captainName || players[0]?.name || '', players });
            setEdit(null); setErr(''); toast('Team saved');
        } catch (e) { setErr(errText(e)); }
    };
    const Row = ({ team }: { team: FutsalTeam }) => (
        <div className="fx-li" style={{ flexWrap: 'wrap' }}>
            <Crest team={team} size={34} />
            <div className="fx-li__main" style={{ minWidth: 160 }}><b>{team.name}</b><small>{team.players.length} players · {team.captainName}{team.captainPhone ? ` · ${team.captainPhone}` : ''}{team.groupId ? ` · Group ${team.groupId}` : ''}</small></div>
            <input className="fx-input" style={{ width: 70, minHeight: 34 }} type="number" min={1} aria-label={`Seed for ${team.name}`} placeholder="Seed" value={team.seed ?? ''} onChange={e => saveFutsalTeam({ ...team, seed: e.target.value ? Number(e.target.value) : undefined })} />
            {team.status !== 'ACCEPTED' && <button type="button" className="fx-btn fx-btn--sm fx-btn--primary" onClick={() => setStatus(team, 'ACCEPTED')}>Approve</button>}
            {team.status === 'PENDING' && <button type="button" className="fx-btn fx-btn--sm fx-btn--danger" onClick={() => setStatus(team, 'REJECTED')}>Reject</button>}
            {team.status === 'ACCEPTED' && <button type="button" className="fx-btn fx-btn--sm" onClick={() => setStatus(team, 'WITHDRAWN')}>Withdraw</button>}
            <button type="button" className="fx-btn fx-btn--sm" onClick={() => { setEdit(structuredClone(team)); setErr(''); }}>Edit</button>
        </div>
    );
    return (
        <>
            <div className="fx-row fx-row--between">
                <h1 className="fx-silver" style={{ fontSize: 40 }}>Teams</h1>
                <div className="fx-row">
                    <button type="button" className="fx-btn" onClick={() => { setBulk(true); setEdit(null); }}><Upload />Bulk upload</button>
                    <button type="button" className="fx-btn" onClick={() => { setEdit(newTeam()); setBulk(false); setErr(''); }}><Plus />Add team</button>
                </div>
            </div>
            {bulk && <BulkTeams t={t} cat={cat} existing={teams} onClose={() => setBulk(false)} onDone={msg => { setBulk(false); toast(msg); }} />}
            {t.categories.length > 1 && <div className="fx-chips">{t.categories.map(c => <button key={c.id} type="button" className={`fx-chip ${c.id === cat.id ? 'is-on' : ''}`} onClick={() => setCatId(c.id)}>{c.name} ({teams.filter(x => x.categoryId === c.id && x.status === 'ACCEPTED').length}/{c.maxTeams})</button>)}</div>}
            {edit && (
                <div className="fx-card fx-card--pad fx-stack">
                    <h2 style={{ fontSize: 24 }}>{edit.name || 'New team'}</h2>
                    <div className="fx-grid3">
                        <div className="fx-field"><label htmlFor="e-name">Team name</label><input id="e-name" className="fx-input" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} /></div>
                        <div className="fx-field"><label htmlFor="e-short">Short name</label><input id="e-short" className="fx-input" maxLength={3} value={edit.shortName} placeholder={teamInitials(edit.name || 'Team')} onChange={e => setEdit({ ...edit, shortName: e.target.value.toUpperCase() })} /></div>
                        <div className="fx-field"><label>Colour</label><div className="fx-chips">{COLORS.map(c => <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => setEdit({ ...edit, color: c })} style={{ width: 26, height: 26, borderRadius: 999, background: c, border: edit.color === c ? '3px solid #fff' : '1px solid rgba(255,255,255,.3)' }} />)}</div></div>
                        <div className="fx-field"><label htmlFor="e-cap">Captain</label><input id="e-cap" className="fx-input" value={edit.captainName} onChange={e => setEdit({ ...edit, captainName: e.target.value })} /></div>
                        <div className="fx-field"><label htmlFor="e-ce">Captain email</label><input id="e-ce" className="fx-input" type="email" value={edit.captainEmail || ''} onChange={e => setEdit({ ...edit, captainEmail: e.target.value.trim().toLowerCase() })} /></div>
                        <div className="fx-field"><label htmlFor="e-cp">Captain phone</label><input id="e-cp" className="fx-input" value={edit.captainPhone || ''} onChange={e => setEdit({ ...edit, captainPhone: e.target.value })} /></div>
                        <div className="fx-field"><label htmlFor="e-cat">Category</label><select id="e-cat" className="fx-select" value={edit.categoryId} onChange={e => setEdit({ ...edit, categoryId: e.target.value })}>{t.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                        {(catOf(t, edit.categoryId).format === 'GROUPS' || catOf(t, edit.categoryId).format === 'GROUPS_KNOCKOUT') && (
                            <div className="fx-field"><label htmlFor="e-grp">Group</label>
                                <select id="e-grp" className="fx-select" value={edit.groupId || ''} onChange={e => setEdit({ ...edit, groupId: e.target.value || undefined })}>
                                    <option value="">Not drawn yet</option>
                                    {GROUP_NAMES.slice(0, catOf(t, edit.categoryId).groupCount).map(g => <option key={g} value={g}>Group {g}</option>)}
                                </select></div>
                        )}
                        <div className="fx-field"><label>Team logo</label>
                            <div className="fx-row" style={{ gap: 10 }}>
                                <Crest team={edit} size={44} />
                                <label className="fx-btn fx-btn--sm" style={{ cursor: 'pointer' }}><Upload />{edit.logoUrl ? 'Change' : 'Upload'}
                                    <input type="file" accept="image/*" hidden onChange={async e => {
                                        const f = e.target.files?.[0];
                                        if (!f) return;
                                        if (f.size > 15 * 1024 * 1024) { setErr('Logo must be under 15 MB.'); return; }
                                        try { setEdit({ ...edit, logoUrl: await uploadSystemImage('logos', f) }); setErr(''); } catch { setErr('Couldn’t upload that image. Try a smaller PNG or JPG.'); }
                                    }} /></label>
                                {edit.logoUrl && <button type="button" className="fx-btn fx-btn--sm" onClick={() => setEdit({ ...edit, logoUrl: undefined })}>Remove</button>}
                            </div></div>
                    </div>
                    <SquadEditor players={edit.players} max={catOf(t, edit.categoryId).rules.squadMax + 6} onChange={players => setEdit({ ...edit, players })} />
                    {err && <div className="fx-note fx-note--err">{err}</div>}
                    <div className="fx-row">
                        <button type="button" className="fx-btn fx-btn--primary" onClick={saveEdit}>Save team</button>
                        <button type="button" className="fx-btn" onClick={() => setEdit(null)}>Cancel</button>
                        {teams.some(x => x.id === edit.id) && <button type="button" className="fx-btn fx-btn--danger" style={{ marginLeft: 'auto' }} onClick={async () => { if (await confirmDialog({ title: `Delete ${edit.name}?`, body: 'Its fixtures will show “TBD”.', confirmLabel: 'Delete team', danger: true })) { try { await deleteFutsalTeam(edit.id); setEdit(null); toast('Team deleted'); } catch (e) { setErr(errText(e)); } } }}><Trash2 />Delete</button>}
                    </div>
                </div>
            )}
            {(['PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'] as const).map(st => groups[st].length > 0 && (
                <div key={st} className="fx-card fx-card--pad">
                    <h3 style={{ fontSize: 20, marginBottom: 10 }}>{st === 'PENDING' ? 'Waiting for approval' : st === 'ACCEPTED' ? `Approved (${groups[st].length}/${cat.maxTeams})` : st === 'REJECTED' ? 'Rejected' : 'Withdrawn'}</h3>
                    <div className="fx-list">{groups[st].sort((a, b) => (a.seed || 99) - (b.seed || 99) || a.name.localeCompare(b.name)).map(x => <Row key={x.id} team={x} />)}</div>
                </div>
            ))}
            {!list.length && !edit && <Empty title="No teams yet">Share the registration link from Overview, or add teams yourself.</Empty>}
        </>
    );
};

// ---------------------------------------------------------------- draw & fixtures

export const Fixtures: React.FC<Ctx> = ({ t, teams, matches, toast, saveT }) => {
    const [catId, setCatId] = useState(t.categories[0]?.id || '');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);
    const cat = catOf(t, catId);
    const accepted = teams.filter(x => x.categoryId === cat.id && x.status === 'ACCEPTED');
    const catMatches = matches.filter(m => m.categoryId === cat.id);
    const started = catMatches.some(m => m.status !== 'SCHEDULED');
    const usesGroups = cat.format === 'GROUPS' || cat.format === 'GROUPS_KNOCKOUT';
    const groupNames = GROUP_NAMES.slice(0, cat.groupCount);
    const undrawn = usesGroups && accepted.some(x => !x.groupId || !groupNames.includes(x.groupId));

    const run = async (fn: () => Promise<void>) => { setBusy(true); setMsg(null); try { await fn(); } catch (e) { setMsg({ kind: 'err', text: errText(e) }); } finally { setBusy(false); } };

    const draw = (mode: 'seeded' | 'random') => run(async () => {
        if (started) throw new Error('Matches have started; the draw can’t change now.');
        const map = drawGroups(accepted, cat.groupCount, mode);
        await saveFutsalTeams(accepted.map(x => ({ ...x, groupId: map[x.id] })));
        setMsg({ kind: 'ok', text: `Drawn into ${cat.groupCount} groups. Generate fixtures next.` });
    });
    const generate = () => run(async () => {
        if (accepted.length < 2) throw new Error('Approve at least two teams first.');
        if (undrawn) throw new Error('Some teams have no group. Make the draw first.');
        if (started) throw new Error('Matches in this category have started. Reset them under Results before regenerating.');
        if (catMatches.length && !(await confirmDialog({ title: `Replace ${catMatches.length} fixtures?`, body: `Every existing fixture for ${cat.name} is replaced with a fresh set.`, confirmLabel: 'Replace fixtures', danger: true }))) return;
        await deleteFutsalMatches(catMatches.map(m => m.id));
        const fresh = generateFixtures(t.id, cat, teams);
        await saveFutsalMatches(fresh);
        setMsg({ kind: 'ok', text: `${fresh.length} fixtures created. Schedule them on pitches below.` });
    });
    const schedule = (keepExisting: boolean) => run(async () => {
        const res = scheduleMatches(t, matches, { keepExisting });
        await saveFutsalMatches(res.matches);
        setMsg(res.unplaced.length
            ? { kind: 'warn', text: `${res.matches.length} matches scheduled; ${res.unplaced.length} didn’t fit. Add a day, a pitch or longer hours in Settings, then schedule again.` }
            : { kind: 'ok', text: `${res.matches.length} matches scheduled across ${t.pitches.length} ${t.pitches.length === 1 ? 'pitch' : 'pitches'}.` });
    });
    const moveTeam = (team: FutsalTeam, g: string) => saveFutsalTeam({ ...team, groupId: g || undefined }).catch(e => toast(errText(e)));
    const sched = (patch: Partial<FutsalTournament['schedule']>) => saveT({ ...t, schedule: { ...t.schedule, ...patch } });
    const [newDate, setNewDate] = useState('');
    // Hand-made fixtures: a league or group match between any two approved teams.
    const addMatch = () => run(async () => {
        if (accepted.length < 2) throw new Error('Approve at least two teams first.');
        const [h, a] = accepted;
        const m = blankMatch({
            tournamentId: t.id, categoryId: cat.id, round: 1, homeId: h.id, awayId: a.id,
            stage: usesGroups ? 'GROUP' : 'LEAGUE', group: usesGroups ? h.groupId : undefined,
            matchNo: Math.max(0, ...catMatches.map(x => x.matchNo)) + 1,
        });
        await saveFutsalMatch(m);
        setMsg({ kind: 'ok', text: `Match ${m.matchNo} added. Pick the teams, time and ${PITCH_WORD[sportOf(t)].toLowerCase()} in the table.` });
    });
    // For hand-made league/group fixtures: add just the knockout or playoff matches, which then fill themselves.
    const needsKo = hasKnockoutStage(cat.format) && cat.format !== 'KNOCKOUT' && catMatches.length > 0 && !catMatches.some(m => isKnockout(m.stage));
    const addKnockouts = () => run(async () => {
        const ko = generateFixtures(t.id, cat, teams).filter(m => isKnockout(m.stage));
        if (!ko.length) throw new Error(cat.format === 'LEAGUE_PLAYOFFS' ? 'Playoffs need at least four approved teams.' : 'Not enough teams for a knockout yet.');
        const start = Math.max(0, ...catMatches.map(x => x.matchNo));
        const round = Math.max(0, ...catMatches.map(x => x.round)) + 1;
        const base = Math.min(...ko.map(m => m.round));
        await saveFutsalMatches(ko.map((m, i) => ({ ...m, matchNo: start + i + 1, round: round + (m.round - base) })));
        setMsg({ kind: 'ok', text: `${ko.length} ${cat.format === 'LEAGUE_PLAYOFFS' ? 'playoff' : 'knockout'} matches added. Teams fill in when the ${cat.format.startsWith('LEAGUE') ? 'league' : 'groups'} finish.` });
    });
    const setSide = (m: FutsalMatch, side: 'homeId' | 'awayId', id: string) => {
        const team = accepted.find(x => x.id === id);
        saveFutsalMatch({ ...m, [side]: id, ...(m.stage === 'GROUP' && side === 'homeId' && team?.groupId ? { group: team.groupId } : {}) }).catch(e => toast(errText(e)));
    };
    const sorted = [...catMatches].sort((a, b) => String(a.startAt || '9').localeCompare(String(b.startAt || '9')) || a.matchNo - b.matchNo);

    return (
        <>
            <h1 className="fx-silver" style={{ fontSize: 40 }}>Draw & fixtures</h1>
            {t.categories.length > 1 && <div className="fx-chips">{t.categories.map(c => <button key={c.id} type="button" className={`fx-chip ${c.id === cat.id ? 'is-on' : ''}`} onClick={() => { setCatId(c.id); setMsg(null); }}>{c.name}</button>)}</div>}
            {msg && <div className={`fx-note ${msg.kind === 'warn' ? 'fx-note--warn' : msg.kind === 'err' ? 'fx-note--err' : ''}`} role="status">{msg.text}</div>}

            {usesGroups && (
                <div className="fx-card fx-card--pad fx-stack">
                    <div className="fx-row fx-row--between">
                        <h2 style={{ fontSize: 24 }}>1 · Group draw</h2>
                        <div className="fx-row">
                            <button type="button" className="fx-btn" disabled={busy || started || accepted.length < cat.groupCount} onClick={() => draw('seeded')}>Seeded draw</button>
                            <button type="button" className="fx-btn" disabled={busy || started || accepted.length < cat.groupCount} onClick={() => draw('random')}><Shuffle />Random draw</button>
                        </div>
                    </div>
                    <p className="fx-muted" style={{ margin: 0, fontSize: 13 }}>Seeded snakes teams by the seed numbers set under Teams. Or place teams by hand.</p>
                    <div className="fx-grid2">
                        {groupNames.map(g => (
                            <div key={g} className="fx-li" style={{ display: 'block' }}>
                                <b style={{ fontFamily: 'var(--fx-head)', fontSize: 20 }}>Group {g}</b>
                                {accepted.filter(x => x.groupId === g).map(x => (
                                    <div key={x.id} className="fx-row" style={{ marginTop: 8 }}>
                                        <Crest team={x} size={24} /><span style={{ flex: 1 }}>{x.name}</span>
                                        <select className="fx-select" style={{ width: 90, minHeight: 32, padding: '4px 8px' }} aria-label={`Group for ${x.name}`} disabled={started} value={x.groupId} onChange={e => moveTeam(x, e.target.value)}>{groupNames.map(n => <option key={n} value={n}>{n}</option>)}</select>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                    {accepted.some(x => !x.groupId || !groupNames.includes(x.groupId)) && (
                        <div className="fx-li" style={{ display: 'block' }}>
                            <b>Not in a group</b>
                            {accepted.filter(x => !x.groupId || !groupNames.includes(x.groupId)).map(x => (
                                <div key={x.id} className="fx-row" style={{ marginTop: 8 }}>
                                    <Crest team={x} size={24} /><span style={{ flex: 1 }}>{x.name}</span>
                                    <select className="fx-select" style={{ width: 110, minHeight: 32, padding: '4px 8px' }} aria-label={`Group for ${x.name}`} value="" onChange={e => moveTeam(x, e.target.value)}><option value="">Choose</option>{groupNames.map(n => <option key={n} value={n}>Group {n}</option>)}</select>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="fx-card fx-card--pad fx-stack">
                <div className="fx-row fx-row--between">
                    <h2 style={{ fontSize: 24 }}>{usesGroups ? '2' : '1'} · Fixtures</h2>
                    <div className="fx-row">
                        <button type="button" className="fx-btn" disabled={busy || cat.format === 'KNOCKOUT'} onClick={addMatch}><Plus />Add match</button>
                        {needsKo && <button type="button" className="fx-btn" disabled={busy} onClick={addKnockouts}><TrophyIcon />Create {cat.format === 'LEAGUE_PLAYOFFS' ? 'playoff' : 'knockout'} matches</button>}
                        <button type="button" className="fx-btn fx-btn--primary" disabled={busy} onClick={generate}>{catMatches.length ? 'Regenerate fixtures' : 'Generate fixtures'}</button>
                    </div>
                </div>
                <p className="fx-muted" style={{ margin: 0, fontSize: 13 }}>{FORMAT_LABELS[cat.format]} · {accepted.length} approved teams{cat.format === 'GROUPS_KNOCKOUT' ? ` · top ${cat.advancePerGroup} per group go through` : cat.format === 'LEAGUE_PLAYOFFS' ? ' · top 4 go to the playoffs' : cat.format === 'LEAGUE_KNOCKOUT' ? ` · top ${cat.advancePerGroup} go to the knockout` : ''}. Generate the full set, or add matches one by one. Teams, time and {PITCH_WORD[sportOf(t)].toLowerCase()} of any match that hasn’t started can be changed in the table below; knockout matches fill in automatically.</p>
            </div>

            <ScheduleSheet t={t} cat={cat} teams={teams} matches={matches} onDone={text => setMsg({ kind: 'ok', text })} />

            <div className="fx-card fx-card--pad fx-stack">
                <div className="fx-row fx-row--between">
                    <h2 style={{ fontSize: 24 }}>{usesGroups ? '3' : '2'} · Schedule</h2>
                    <div className="fx-row">
                        <button type="button" className="fx-btn" disabled={busy || !matches.length} onClick={() => schedule(true)}>Fill gaps only</button>
                        <button type="button" className="fx-btn fx-btn--primary" disabled={busy || !matches.length} onClick={async () => { if (await confirmDialog({ title: 'Reschedule every match?', body: 'Every match that hasn’t started, in every category, gets a new time and pitch.', confirmLabel: 'Auto-schedule all' })) schedule(false); }}>Auto-schedule all</button>
                    </div>
                </div>
                <div className="fx-grid4">
                    <div className="fx-field"><label htmlFor="s-start">Day starts</label><input id="s-start" className="fx-input" type="time" value={t.schedule.dayStart} onChange={e => saveT({ ...t, schedule: { ...t.schedule, dayStart: e.target.value } })} /></div>
                    <div className="fx-field"><label htmlFor="s-end">Day ends</label><input id="s-end" className="fx-input" type="time" value={t.schedule.dayEnd} onChange={e => saveT({ ...t, schedule: { ...t.schedule, dayEnd: e.target.value } })} /></div>
                    <NumField id="s-rest" label="Rest between matches (min)" value={t.schedule.minRestMinutes} max={240} onChange={n => saveT({ ...t, schedule: { ...t.schedule, minRestMinutes: n } })} />
                    <NumField id="s-max" label="Max matches per team per day" value={t.schedule.maxPerDay} min={1} max={10} onChange={n => saveT({ ...t, schedule: { ...t.schedule, maxPerDay: n } })} />
                    <NumField id="s-gap" label="Gap between matches (min)" value={t.schedule.bufferMinutes} max={120} onChange={n => sched({ bufferMinutes: n })} />
                    <NumField id="s-venue" label="Max matches per day (0 = no limit)" value={t.schedule.maxMatchesPerDay || 0} max={50} onChange={n => sched({ maxMatchesPerDay: n })} />
                    <div className="fx-field" style={{ gridColumn: 'span 2' }}><label htmlFor="s-slots">Fixed kick-off times (optional)</label>
                        <input id="s-slots" className="fx-input" placeholder="e.g. 17:30, 19:10, 20:50" defaultValue={(t.schedule.slotTimes || []).join(', ')} key={(t.schedule.slotTimes || []).join(',')}
                            onBlur={e => { const v = e.target.value.split(/[,\s]+/).map(x => x.trim()).filter(x => /^\d{1,2}:\d{2}$/.test(x)).map(x => x.padStart(5, '0')); sched({ slotTimes: [...new Set(v)].sort() }); }} />
                        <small className="fx-muted" style={{ fontSize: 11 }}>When set, every match starts at one of these times. Leave empty to fill the day from “Day starts”.</small></div>
                </div>
                <div className="fx-field">
                    <label htmlFor="s-date">Exact match dates (optional)</label>
                    <div className="fx-row">
                        <input id="s-date" className="fx-input" type="date" style={{ width: 180 }} value={newDate} min={t.startDate} max={t.endDate} onChange={e => setNewDate(e.target.value)} />
                        <button type="button" className="fx-btn fx-btn--sm" disabled={!newDate} onClick={() => { sched({ matchDates: [...new Set([...(t.schedule.matchDates || []), newDate])].sort() }); setNewDate(''); }}><Plus />Add date</button>
                        {(t.schedule.matchDates || []).length > 0 && <button type="button" className="fx-btn fx-btn--sm" onClick={() => sched({ matchDates: [] })}>Clear</button>}
                    </div>
                    {(t.schedule.matchDates || []).length > 0 && (
                        <div className="fx-chips">{t.schedule.matchDates!.map(d => (
                            <button key={d} type="button" className="fx-chip is-on" title="Remove" onClick={() => sched({ matchDates: t.schedule.matchDates!.filter(x => x !== d) })}>
                                {new Date(`${d}T00:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} ×
                            </button>
                        ))}</div>
                    )}
                    <small className="fx-muted" style={{ fontSize: 11 }}>When dates are listed, matches are only scheduled on those days and the weekday picker below is ignored.</small>
                </div>
                <div className="fx-field">
                    <label>Match days</label>
                    <div className="fx-chips">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => {
                            const on = !t.schedule.weekdays?.length || t.schedule.weekdays.includes(i);
                            return <button key={d} type="button" className={`fx-chip ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => {
                                const cur = t.schedule.weekdays?.length ? t.schedule.weekdays : [0, 1, 2, 3, 4, 5, 6];
                                const next = on ? cur.filter(x => x !== i) : [...cur, i].sort();
                                if (next.length) saveT({ ...t, schedule: { ...t.schedule, weekdays: next.length === 7 ? [] : next } });
                            }}>{d}</button>;
                        })}
                    </div>
                    <small className="fx-muted" style={{ fontSize: 11 }}>For a league over several weeks, set the end date weeks ahead and pick only the days you play, e.g. Friday and Saturday.</small>
                </div>
                <p className="fx-muted" style={{ margin: 0, fontSize: 13 }}>{dateRange(t)} · {t.pitches.join(', ')} · {matchMinutes(cat.rules, t.schedule.bufferMinutes)} min slots for {cat.name}. Knockouts are booked after the groups they depend on.</p>
                {sorted.length > 0 && (
                    <div className="fx-table-wrap">
                        <table className="fx-table">
                            <thead><tr><th>#</th><th>Match</th><th>Stage</th><th>Start</th><th>Pitch</th><th></th></tr></thead>
                            <tbody>
                                {sorted.map(m => (
                                    <tr key={m.id}>
                                        <td className="fx-pos">{m.matchNo}</td>
                                        <td style={{ textAlign: 'left' }}>
                                            {m.status === 'SCHEDULED' && !isKnockout(m.stage) ? (
                                                <span className="fx-row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                                                    {(['homeId', 'awayId'] as const).map((side, k) => (
                                                        <React.Fragment key={side}>
                                                            {k === 1 && <span className="fx-muted">v</span>}
                                                            <select className="fx-select" style={{ minHeight: 34, padding: '4px 8px', width: 150 }} aria-label={`${k ? 'Away' : 'Home'} team of match ${m.matchNo}`} value={m[side] || ''} onChange={e => setSide(m, side, e.target.value)}>
                                                                {accepted.map(x => <option key={x.id} value={x.id} disabled={x.id === (k ? m.homeId : m.awayId)}>{x.name}</option>)}
                                                            </select>
                                                        </React.Fragment>
                                                    ))}
                                                </span>
                                            ) : <>{teamName(teams, m.homeId, m.homeFrom, matches)} v {teamName(teams, m.awayId, m.awayFrom, matches)}</>}
                                        </td>
                                        <td className="fx-muted">{stageText(m)}</td>
                                        <td><input className="fx-input" style={{ minHeight: 34, padding: '4px 8px', width: 200 }} type="datetime-local" aria-label={`Start time of match ${m.matchNo}`} disabled={m.status !== 'SCHEDULED'} value={m.startAt ? toLocalInput(m.startAt) : ''} onChange={e => saveFutsalMatch({ ...m, startAt: e.target.value ? new Date(e.target.value).toISOString() : undefined }).catch(er => toast(errText(er)))} /></td>
                                        <td><select className="fx-select" style={{ minHeight: 34, padding: '4px 8px', width: 120 }} aria-label={`Pitch of match ${m.matchNo}`} disabled={m.status !== 'SCHEDULED'} value={m.pitch || ''} onChange={e => saveFutsalMatch({ ...m, pitch: e.target.value || undefined }).catch(er => toast(errText(er)))}><option value="">—</option>{t.pitches.map(p => <option key={p}>{p}</option>)}</select></td>
                                        <td>{m.status === 'SCHEDULED' && !isKnockout(m.stage) && <button type="button" className="fx-btn fx-btn--sm fx-btn--danger" aria-label={`Delete match ${m.matchNo}`} onClick={async () => { if (await confirmDialog({ title: `Delete match ${m.matchNo}?`, confirmLabel: 'Delete match', danger: true })) deleteFutsalMatches([m.id]).catch(e => toast(errText(e))); }}><Trash2 /></button>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
};

const toLocalInput = (iso: string) => {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

// ---------------------------------------------------------------- results

export const Results: React.FC<Ctx> = ({ t, teams, matches, toast }) => {
    const [catId, setCatId] = useState(t.categories[0]?.id || '');
    const [entry, setEntry] = useState<{ id: string; h: string; a: string; ph: string; pa: string } | null>(null);
    const cat = catOf(t, catId);
    const list = matches.filter(m => m.categoryId === cat.id).sort((a, b) => String(a.startAt || '9').localeCompare(String(b.startAt || '9')) || a.matchNo - b.matchNo);
    const origin = window.location.origin;

    const afterSave = async (m: FutsalMatch) => {
        const all = matches.map(x => (x.id === m.id ? m : x));
        const changed = resolveSlots(cat, teams, all);
        if (changed.length) await saveFutsalMatches(changed);
    };
    const saveQuick = async (m: FutsalMatch) => {
        if (!entry) return;
        const h = Number(entry.h), a = Number(entry.a);
        if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0) { toast('Enter both scores'); return; }
        const level = h === a;
        const ph = Number(entry.ph), pa = Number(entry.pa);
        if (isKnockout(m.stage) && level && (!(entry.ph && entry.pa) || ph === pa)) { toast('A knockout draw needs a penalty winner'); return; }
        const mk = (type: FutsalEvent['type'], side: 'home' | 'away'): FutsalEvent => ({ id: newId('e'), type, side, period: 1, ms: 0, at: Date.now() });
        const events: FutsalEvent[] = [
            ...Array.from({ length: h }, () => mk('GOAL', 'home')), ...Array.from({ length: a }, () => mk('GOAL', 'away')),
            ...(isKnockout(m.stage) && level ? [...Array.from({ length: ph }, () => mk('PEN_SCORED', 'home')), ...Array.from({ length: pa }, () => mk('PEN_SCORED', 'away'))] : []),
        ];
        // Keep a live-scored log when the score still matches it; otherwise replace it.
        const s = scoreOf(m);
        const base = s.home === h && s.away === a && m.events.length ? m : { ...m, events };
        const done = finishMatch({ ...base, status: 'LIVE', periodState: 'ENDED', period: base.period || 1 }, isKnockout(m.stage) && level ? 'penalties' : 'regular');
        try { await saveFutsalMatch(done); await afterSave(done); setEntry(null); toast('Result saved'); } catch (e) { toast(errText(e)); }
    };

    return (
        <>
            <div className="fx-row fx-row--between">
                <h1 className="fx-silver" style={{ fontSize: 40 }}>Results</h1>
                <button type="button" className="fx-btn" disabled={!matches.length} onClick={() => downloadCsv(t, teams, matches)}>Download fixtures (CSV)</button>
            </div>
            <p className="fx-muted" style={{ margin: 0 }}>Live scoring happens in the scorer console. Here you can enter or correct a final score, and copy each match’s OBS overlay link.</p>
            {t.categories.length > 1 && <div className="fx-chips">{t.categories.map(c => <button key={c.id} type="button" className={`fx-chip ${c.id === cat.id ? 'is-on' : ''}`} onClick={() => setCatId(c.id)}>{c.name}</button>)}</div>}
            {!list.length ? <Empty title="No fixtures yet">Generate them under Draw & fixtures.</Empty> : (
                <div className="fx-list">
                    {list.map(m => {
                        const s = scoreOf(m);
                        const ready = !!m.homeId && !!m.awayId;
                        const open = entry?.id === m.id;
                        return (
                            <div key={m.id} className="fx-li" style={{ flexWrap: 'wrap' }}>
                                <div className="fx-li__main" style={{ minWidth: 200 }}>
                                    <b>{teamName(teams, m.homeId, m.homeFrom, matches)} {m.status === 'SCHEDULED' ? 'v' : `${s.home}–${s.away}`} {teamName(teams, m.awayId, m.awayFrom, matches)}{s.hasPens ? ` (${s.pensHome}–${s.pensAway} p)` : ''}</b>
                                    <small>M{m.matchNo} · {stageText(m)} · {m.startAt ? `${new Date(m.startAt).toLocaleDateString([], { day: 'numeric', month: 'short' })} ${fmtTime(m.startAt)}` : 'Unscheduled'}{m.pitch ? ` · ${m.pitch}` : ''}</small>
                                </div>
                                {m.status === 'LIVE' && <span className="fx-pill fx-pill--live">Live</span>}
                                {m.status === 'COMPLETED' && <span className="fx-pill fx-pill--ok">{m.decidedBy === 'forfeit' ? 'Walkover' : 'Final'}</span>}
                                {open ? (
                                    <span className="fx-row">
                                        <input className="fx-input" style={{ width: 60 }} inputMode="numeric" aria-label="Home goals" value={entry.h} onChange={e => setEntry({ ...entry, h: e.target.value.replace(/\D/g, '') })} />
                                        <span>–</span>
                                        <input className="fx-input" style={{ width: 60 }} inputMode="numeric" aria-label="Away goals" value={entry.a} onChange={e => setEntry({ ...entry, a: e.target.value.replace(/\D/g, '') })} />
                                        {isKnockout(m.stage) && entry.h !== '' && entry.h === entry.a && <>
                                            <small className="fx-muted">Pens</small>
                                            <input className="fx-input" style={{ width: 54 }} inputMode="numeric" aria-label="Home penalties" value={entry.ph} onChange={e => setEntry({ ...entry, ph: e.target.value.replace(/\D/g, '') })} />
                                            <input className="fx-input" style={{ width: 54 }} inputMode="numeric" aria-label="Away penalties" value={entry.pa} onChange={e => setEntry({ ...entry, pa: e.target.value.replace(/\D/g, '') })} />
                                        </>}
                                        <button type="button" className="fx-btn fx-btn--sm fx-btn--primary" onClick={() => saveQuick(m)}>Save</button>
                                        <button type="button" className="fx-btn fx-btn--sm" onClick={() => setEntry(null)}>Cancel</button>
                                    </span>
                                ) : (
                                    <span className="fx-row">
                                        <button type="button" className="fx-btn fx-btn--sm" disabled={!ready} onClick={() => setEntry({ id: m.id, h: m.status === 'SCHEDULED' ? '' : String(s.home), a: m.status === 'SCHEDULED' ? '' : String(s.away), ph: s.hasPens ? String(s.pensHome) : '', pa: s.hasPens ? String(s.pensAway) : '' })}>{m.status === 'COMPLETED' ? 'Correct' : 'Enter result'}</button>
                                        <a className="fx-btn fx-btn--sm" href={`#${scorePath(t, m.id)}`} target="_blank" rel="noopener noreferrer">Referee mode</a>
                                        {m.pitch && <button type="button" className="fx-btn fx-btn--sm" onClick={async () => { const url = `${origin}/#${pitchObsPath(t, m.pitch!)}`; try { await navigator.clipboard.writeText(url); toast(`${m.pitch} OBS link copied`); } catch { toast(url); } }}>{m.pitch} OBS</button>}
                                        {m.status !== 'SCHEDULED' && <button type="button" className="fx-btn fx-btn--sm fx-btn--danger" onClick={async () => { if (await confirmDialog({ title: 'Reset this match to not started?', body: 'Its goals, cards and clock are cleared.', confirmLabel: 'Reset match', danger: true })) { try { const r = resetMatch(m); await saveFutsalMatch(r); await afterSave(r); toast('Match reset'); } catch (e) { toast(errText(e)); } } }}>Reset</button>}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
};

/** Every fixture and result as a spreadsheet, for printing or sharing on WhatsApp groups. */
const downloadCsv = (t: FutsalTournament, teams: FutsalTeam[], matches: FutsalMatch[]) => {
    const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['Match', 'Category', 'Stage', 'Date', 'Time', 'Pitch', 'Home', 'Away', 'Score', 'Penalties', 'Status'];
    const rows = [...matches].sort((a, b) => String(a.startAt || '9').localeCompare(String(b.startAt || '9')) || a.matchNo - b.matchNo).map(m => {
        const s = scoreOf(m);
        return [m.matchNo, catOf(t, m.categoryId).name, stageText(m), m.startAt ? new Date(m.startAt).toLocaleDateString() : '', m.startAt ? fmtTime(m.startAt) : '', m.pitch || '',
            teamName(teams, m.homeId, m.homeFrom, matches), teamName(teams, m.awayId, m.awayFrom, matches),
            m.status === 'SCHEDULED' ? '' : `${s.home}-${s.away}`, s.hasPens ? `${s.pensHome}-${s.pensAway}` : '', m.status === 'COMPLETED' ? (m.decidedBy === 'forfeit' ? 'Walkover' : 'Final') : m.status === 'LIVE' ? 'Live' : 'Scheduled'];
    });
    const csv = [head, ...rows].map(r => r.map(q).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${t.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-fixtures.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// ---------------------------------------------------------------- awards

export const Awards: React.FC<Ctx> = ({ t, teams, matches, saveT }) => {
    const [catId, setCatId] = useState(t.categories[0]?.id || '');
    const cat = catOf(t, catId);
    const catTeams = teams.filter(x => x.categoryId === cat.id && x.status === 'ACCEPTED');
    const catMatches = matches.filter(m => m.categoryId === cat.id);
    const lines = useMemo(() => [...playerStats(catTeams, catMatches).values()], [catTeams, catMatches]);
    const table = computeStandings(catTeams.map(x => x.id), catMatches.filter(m => m.stage === 'GROUP' || m.stage === 'LEAGUE'), cat.rules);
    const awards = computeAwards(lines, table, t.bestPlayer?.[cat.id]);
    const done = catMatches.length > 0 && catMatches.every(m => m.status === 'COMPLETED');
    const allDone = matches.length > 0 && matches.every(m => m.status === 'COMPLETED');
    const players = catTeams.flatMap(x => x.players.map(p => ({ ...p, team: x.name })));
    return (
        <>
            <h1 className="fx-silver" style={{ fontSize: 40 }}>Awards</h1>
            {t.categories.length > 1 && <div className="fx-chips">{t.categories.map(c => <button key={c.id} type="button" className={`fx-chip ${c.id === cat.id ? 'is-on' : ''}`} onClick={() => setCatId(c.id)}>{c.name}</button>)}</div>}
            {!done && <div className="fx-note fx-note--warn">{catMatches.length - catMatches.filter(m => m.status === 'COMPLETED').length} matches still to finish in {cat.name}. Awards below are provisional.</div>}
            <div className="fx-grid2">
                {[
                    ['Golden Boot', awards.goldenBoot, awards.goldenBoot && plural(awards.goldenBoot.goals, 'goal')],
                    ['Top assists', awards.topAssists, awards.topAssists && plural(awards.topAssists.assists, 'assist')],
                    ['Golden Glove', awards.goldenGlove, awards.goldenGlove && `${plural(awards.goldenGlove.cleanSheets, 'clean sheet')} in ${plural(awards.goldenGlove.gkApps, 'match').replace('matchs', 'matches')}`],
                ].map(([k, l, v]: any) => (
                    <div key={k} className="fx-card fx-award"><span className="fx-award__icon"><Award /></span><div><small>{k}</small><b>{l ? playerName(teams, l.playerId) : '—'}</b><span className="fx-muted" style={{ fontSize: 12 }}>{v || 'Nobody yet'}</span></div></div>
                ))}
                <div className="fx-card fx-award"><span className="fx-award__icon"><Award /></span><div><small>Fair play</small><b>{teams.find(x => x.id === awards.fairPlayTeamId)?.name || '—'}</b></div></div>
            </div>
            <div className="fx-card fx-card--pad fx-stack">
                <h2 style={{ fontSize: 24 }}>Best player</h2>
                <p className="fx-muted" style={{ margin: 0, fontSize: 13 }}>Defaults to the most Player of the Match awards{awards.bestPlayer ? ` (now ${playerName(teams, awards.bestPlayer.playerId)})` : ''}. Pick someone to override.</p>
                <select className="fx-select" aria-label="Best player" value={t.bestPlayer?.[cat.id] || ''} onChange={e => saveT({ ...t, bestPlayer: { ...(t.bestPlayer || {}), [cat.id]: e.target.value } }, 'Best player saved')}>
                    <option value="">Automatic</option>
                    {players.map(p => <option key={p.id} value={p.id}>{p.name} · {p.team}</option>)}
                </select>
            </div>
            <div className="fx-card fx-card--pad fx-row fx-row--between">
                <div><h2 style={{ fontSize: 24 }}>Finish the competition</h2><p className="fx-muted" style={{ margin: '6px 0 0', fontSize: 13 }}>Marks it finished; results count towards the rankings.</p></div>
                <button type="button" className="fx-btn fx-btn--primary" disabled={t.status === 'COMPLETED'} onClick={async () => { if (allDone || await confirmDialog({ title: 'Mark the competition finished?', body: 'Some matches aren’t finished yet.', confirmLabel: 'Mark finished' })) saveT({ ...t, status: 'COMPLETED' }, 'Competition finished'); }}>{t.status === 'COMPLETED' ? 'Finished' : 'Mark as finished'}</button>
            </div>
        </>
    );
};

// ---------------------------------------------------------------- settings

export const SettingsAdmin: React.FC<Ctx> = ({ t, teams, matches, saveT, onDeleted }) => {
    const [d, setD] = useState(t);
    useEffect(() => setD(t), [t]);
    return (
        <>
            <h1 className="fx-silver" style={{ fontSize: 40 }}>Settings</h1>
            <p className="fx-muted" style={{ margin: 0, fontSize: 13 }}>Name, venue, dates, pitches and banner are changed with Edit at the top.</p>
            <div className="fx-card fx-card--pad fx-stack">
                <h2 style={{ fontSize: 24 }}>Registration and scoring</h2>
                <div className="fx-grid2">
                    <div className="fx-field"><label htmlFor="st-lock">Squads lock at</label><input id="st-lock" className="fx-input" type="datetime-local" value={d.squadLockAt ? toLocalInput(d.squadLockAt) : ''} onChange={e => setD({ ...d, squadLockAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} /></div>
                    <div className="fx-field"><label htmlFor="st-pass">Referee passcode</label><input id="st-pass" className="fx-input" value={d.scorerPasscode} onChange={e => setD({ ...d, scorerPasscode: e.target.value.replace(/\s/g, '') })} /></div>
                    <NumField id="st-buf" label="Changeover between matches (min)" value={d.schedule.bufferMinutes} max={60} onChange={n => setD({ ...d, schedule: { ...d.schedule, bufferMinutes: n } })} />
                    <div className="fx-field"><label htmlFor="st-cur">Currency</label><input id="st-cur" className="fx-input" value={d.currency} maxLength={4} onChange={e => setD({ ...d, currency: e.target.value.toUpperCase() })} /></div>
                </div>
            </div>
            <div className="fx-row">
                <button type="button" className="fx-btn fx-btn--primary" disabled={!d.name.trim() || d.endDate < d.startDate || d.scorerPasscode.length < 4} onClick={() => saveT(d, 'Settings saved')}>Save settings</button>
                {d.scorerPasscode.length < 4 && <small className="fx-muted">Passcode needs at least 4 characters.</small>}
            </div>
            <div className="fx-card fx-card--pad fx-row fx-row--between" style={{ borderColor: 'rgba(255,59,107,.35)' }}>
                <div><h2 style={{ fontSize: 22 }}>Delete competition</h2><p className="fx-muted" style={{ margin: '6px 0 0', fontSize: 13 }}>Removes it with its {teams.length} teams and {matches.length} matches. This can’t be undone.</p></div>
                <button type="button" className="fx-btn fx-btn--danger" onClick={async () => {
                    if (!(await confirmDialog({ title: `Delete ${t.name}?`, body: 'Every team, fixture and result is deleted permanently. This can’t be undone.', confirmLabel: 'Delete permanently', danger: true, requireText: t.name }))) return;
                    try { await deleteFutsalTournament(t, teams.map(x => x.id), matches.map(m => m.id)); onDeleted(); } catch (e) { appToast.error('Couldn’t delete the competition', errText(e)); }
                }}><Trash2 />Delete</button>
            </div>
        </>
    );
};
