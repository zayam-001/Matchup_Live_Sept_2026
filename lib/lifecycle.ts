// When a tournament counts as finished, for every sport and screen. The organiser's word wins: "Mark as
// finished" sets COMPLETED, "Reopen" sets it back to ACTIVE with `reopenedAt`. Without either, a
// tournament past its end date is finished only once no match is left to play (when the matches are known).

const DONE = ['COMPLETED', 'FINISHED', 'RETIRED'];
const OPEN_MATCH = ['', 'SCHEDULED', 'PENDING', 'IN_PROGRESS', 'LIVE'];

/** End of the last day for a plain YYYY-MM-DD date, else the exact time. */
const endOf = (d?: string | null) => {
    if (!d) return 0;
    const ts = new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T23:59:59` : d).getTime();
    return Number.isFinite(ts) ? ts : 0;
};

export const isTournamentFinished = (
    t: { status?: string | null; endDate?: string | null; reopenedAt?: string | number | null } | null | undefined,
    matches?: { status?: string | null }[],
) => {
    if (!t) return false;
    if (DONE.includes(String(t.status || '').toUpperCase())) return true;
    if (t.reopenedAt) return false;
    const end = endOf(t.endDate);
    if (!end || end > Date.now()) return false;
    return !matches || !matches.some(m => OPEN_MATCH.includes(String(m.status || '').toUpperCase()));
};
