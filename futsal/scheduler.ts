// Puts fixtures on pitches across the event days. Greedy: always fill the pitch
// that frees up first with the earliest fixture that can legally be played then.
import { matchMinutes } from './presets';
import type { FutsalMatch, FutsalTournament, SlotSource } from './types';

const MIN = 60000;

const at = (date: string, hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date(`${date}T00:00:00`);
    d.setHours(h || 0, m || 0, 0, 0);
    return d.getTime();
};

/** Match days between start and end; a league over several weeks can play only on chosen weekdays or exact dates. */
const days = (start: string, end: string, weekdays?: number[], matchDates?: string[]) => {
    if (matchDates?.length) return [...matchDates].sort();
    const out: string[] = [];
    const d = new Date(`${start}T00:00:00`);
    const last = new Date(`${(end || start)}T00:00:00`);
    for (let i = 0; d <= last && i < 400; i++) {
        if (!weekdays?.length || weekdays.includes(d.getDay())) out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        d.setDate(d.getDate() + 1);
    }
    return out.length ? out : [start];
};

export interface ScheduleResult { matches: FutsalMatch[]; unplaced: FutsalMatch[] }

/**
 * Give every not-yet-played match a pitch and start time. With `keepExisting`,
 * matches that already have a slot stay put and their slots are blocked out.
 */
export const scheduleMatches = (t: FutsalTournament, all: FutsalMatch[], opts: { keepExisting?: boolean } = {}): ScheduleResult => {
    const s = t.schedule;
    const pitches = t.pitches.length ? t.pitches : ['Pitch 1'];
    const dayList = days(t.startDate, t.endDate, s.weekdays, s.matchDates);
    const slots = (s.slotTimes || []).filter(x => /^\d{1,2}:\d{2}$/.test(x)).sort();
    const venueDay = new Map<string, number>(); // day -> matches on the whole venue
    const durationOf = (m: FutsalMatch) => {
        const cat = t.categories.find(c => c.id === m.categoryId);
        return (cat ? matchMinutes(cat.rules, s.bufferMinutes) : 40) * MIN;
    };
    const catOrder = new Map(t.categories.map((c, i) => [c.id, i]));

    const fixed = all.filter(m => m.status !== 'SCHEDULED' || (opts.keepExisting && m.startAt && m.pitch));
    const queue = all.filter(m => !fixed.includes(m))
        .sort((a, b) => a.round - b.round || (catOrder.get(a.categoryId) ?? 0) - (catOrder.get(b.categoryId) ?? 0) || a.matchNo - b.matchNo);

    const end = new Map<string, number>();       // match id -> end time
    const teamFree = new Map<string, number>();  // team id -> next time it may start
    const teamDay = new Map<string, number>();   // `${team}|${day}` -> matches that day
    const pitchFree = new Map<string, number>(pitches.map(p => [p, at(dayList[0], s.dayStart)]));
    const rest = s.minRestMinutes * MIN;
    const dayOf = (ts: number) => { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };

    const book = (m: FutsalMatch, start: number) => {
        const e = start + durationOf(m);
        end.set(m.id, e);
        [m.homeId, m.awayId].forEach(id => {
            if (!id) return;
            teamFree.set(id, Math.max(teamFree.get(id) || 0, e + rest));
            const k = `${id}|${dayOf(start)}`;
            teamDay.set(k, (teamDay.get(k) || 0) + 1);
        });
        venueDay.set(dayOf(start), (venueDay.get(dayOf(start)) || 0) + 1);
    };
    fixed.forEach(m => {
        if (!m.startAt) return;
        const st = new Date(m.startAt).getTime();
        book(m, st);
        if (m.pitch && pitchFree.has(m.pitch)) pitchFree.set(m.pitch, Math.max(pitchFree.get(m.pitch)!, st + durationOf(m)));
    });

    const byId = new Map(all.map(m => [m.id, m]));
    // Earliest a slot's team can be known and rested.
    const sourceReady = (src: SlotSource | undefined, catId: string): number | null => {
        if (!src || src.type === 'seed') return 0;
        if (src.type === 'group' || src.type === 'league') {
            const ms = all.filter(x => x.categoryId === catId && (src.type === 'league' ? x.stage === 'LEAGUE' : x.stage === 'GROUP' && x.group === src.group));
            let latest = 0;
            for (const x of ms) { const e = end.get(x.id); if (e == null) return null; latest = Math.max(latest, e); }
            return latest + rest;
        }
        const e = end.get(src.matchId);
        return e == null ? null : e + rest;
    };
    const readyAt = (m: FutsalMatch): number | null => {
        let r = 0;
        for (const [id, src] of [[m.homeId, m.homeFrom], [m.awayId, m.awayFrom]] as const) {
            if (id) r = Math.max(r, teamFree.get(id) || 0);
            else {
                const sr = sourceReady(src, m.categoryId);
                if (sr == null) return null;
                r = Math.max(r, sr);
            }
            // A knockout slot also waits for the match that feeds it.
            if (id && src && src.type !== 'seed') { const sr = sourceReady(src, m.categoryId); if (sr == null) return null; r = Math.max(r, sr); }
        }
        return r;
    };
    const capped = (m: FutsalMatch, start: number) =>
        [m.homeId, m.awayId].some(id => id && (teamDay.get(`${id}|${dayOf(start)}`) || 0) >= s.maxPerDay)
        || (!!s.maxMatchesPerDay && (venueDay.get(dayOf(start)) || 0) >= s.maxMatchesPerDay);
    /** With fixed kick-off times, the first slot at or after `ts` that day (null when the day's slots are gone). */
    const slotFrom = (day: string, ts: number) => {
        if (!slots.length) return ts;
        const hit = slots.map(x => at(day, x)).find(x => x >= ts);
        return hit ?? null;
    };

    const dayIndex = (ts: number) => dayList.findIndex(d => ts < at(d, slots.length ? '23:59' : s.dayEnd) + 1);
    const placed: FutsalMatch[] = [];
    let guard = 0;
    while (queue.length && guard++ < 20000) {
        const [pitch, free] = [...pitchFree.entries()].sort((a, b) => a[1] - b[1])[0];
        const di = dayIndex(free);
        if (di < 0) break; // past the last day
        const day = dayList[di];
        const slotOpen = slotFrom(day, Math.max(free, slots.length ? 0 : at(day, s.dayStart)));
        if (slotOpen == null) {
            // No kick-off slots left today on this pitch: try the next match day.
            const nd = dayList[di + 1];
            if (!nd) { pitchFree.delete(pitch); if (!pitchFree.size) break; continue; }
            pitchFree.set(pitch, at(nd, '00:00'));
            continue;
        }
        const open = slotOpen;
        // With fixed slots a match only has to start by its slot; the day window still caps plain scheduling.
        const dayClose = slots.length ? Infinity : at(day, s.dayEnd);
        let chosen = -1, wait = Infinity;
        for (let i = 0; i < queue.length; i++) {
            const m = queue[i];
            const r = readyAt(m);
            if (r == null) continue;
            if (r > open) { wait = Math.min(wait, r); continue; }
            if (open + durationOf(m) > dayClose) continue;
            if (capped(m, open)) continue;
            chosen = i;
            break;
        }
        if (chosen >= 0) {
            const m = queue.splice(chosen, 1)[0];
            const next = { ...m, pitch, startAt: new Date(open).toISOString() };
            byId.set(m.id, next);
            placed.push(next);
            book(next, open);
            pitchFree.set(pitch, open + durationOf(m));
            continue;
        }
        // Nothing fits now: wait for the next team to be ready, or move to tomorrow.
        const nextDay = dayList[di + 1];
        const tomorrow = nextDay ? at(nextDay, slots.length ? '00:00' : s.dayStart) : Infinity;
        const target = Math.min(Number.isFinite(wait) ? Math.max(wait, open + (slots.length ? 1 : 5) * MIN) : Infinity, tomorrow);
        if (!Number.isFinite(target)) break;
        pitchFree.set(pitch, target > (slots.length ? at(day, '23:59') : at(day, s.dayEnd)) ? tomorrow : target);
        if (!Number.isFinite(pitchFree.get(pitch)!)) pitchFree.delete(pitch);
        if (!pitchFree.size) break;
    }
    return { matches: [...placed], unplaced: queue };
};
