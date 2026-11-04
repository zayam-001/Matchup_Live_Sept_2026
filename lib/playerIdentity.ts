// Who is who: matching the player names typed into tournaments (manual entries,
// bulk uploads) against registered Match Up accounts. Pure functions only.
//
// exact     = full name + phone + email all match -> merged automatically at login.
// suggested = first name matches and nothing contradicts it -> the player or an
//             organizer confirms.

/** "Faizan, Rayyan" (FIP-style exports) -> "Rayyan Faizan". */
export const displayName = (s?: string | null) => {
    // Strip invisible direction marks that come in with pasted names.
    const raw = String(s || '').replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
    const m = raw.match(/^([^,]+),\s*([^,]+)$/);
    const name = m ? `${m[2]} ${m[1]}` : raw;
    // AMMAD HASSAN -> Ammad Hassan
    return name === name.toUpperCase() && /[A-Z]/.test(name)
        ? name.toLowerCase().replace(/(^|[\s.'-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase())
        : name;
};

export const normalizeName = (s?: string | null) =>
    displayName(s).toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();

export const firstNameOf = (s?: string | null) => normalizeName(s).split(' ')[0] || '';

const PLACEHOLDER_EMAILS = /^(random|test|none|na|noemail|no-email|abc|xyz)@/i;

/** Lowercased email, or '' when missing or an obvious placeholder (random@gmail.com). */
export const normalizeEmail = (s?: string | null) => {
    const e = String(s || '').toLowerCase().trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) || PLACEHOLDER_EMAILS.test(e)) return '';
    return e;
};

/** Last 10 digits, or '' when too short or an obvious placeholder (0303030303). */
export const normalizePhone = (s?: string | null) => {
    const d = String(s || '').replace(/\D/g, '');
    if (d.length < 10) return '';
    const last = d.slice(-10);
    if (new Set(last).size <= 3) return ''; // 3030303030, 0000000000, 1212121212
    return last;
};

/** Slots that aren't a real person yet: "Partner", "TBD", "N/A", "TBD5". */
export const isPlaceholderName = (s?: string | null) => {
    const n = normalizeName(s);
    return !n || /^(partner|tbd|tba|n a|na|bye|player)( ?\d+)?$/.test(n);
};

export interface PersonLike {
    id?: string;
    name?: string;
    fullName?: string;
    email?: string;
    phone?: string;
    cnic?: string;
    photoUrl?: string;
    verified?: boolean;
}

export const personName = (p?: PersonLike | null) => displayName(p?.fullName || p?.name || '');

// Small stable hash so link documents don't carry phone numbers in their ids.
const cyrb53 = (str: string, seed = 0) => {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
};

/** Identity of a typed-in player: same name + email + phone = same entry. */
export const slotIdentity = (p?: PersonLike | null) =>
    `${normalizeName(personName(p))}|${normalizeEmail(p?.email)}|${normalizePhone(p?.phone)}`;

/** Document id for this identity in the playerLinks collection. */
export const linkIdFor = (p?: PersonLike | null) => cyrb53(slotIdentity(p));

export type MatchLevel = 'exact' | 'suggested' | null;

export interface MatchResult {
    level: MatchLevel;
    reasons: string[];
}

export const matchPlayer = (slot: PersonLike, account: PersonLike): MatchResult => {
    const none: MatchResult = { level: null, reasons: [] };
    const slotName = personName(slot);
    if (isPlaceholderName(slotName)) return none;

    const fullName = normalizeName(slotName) === normalizeName(personName(account));
    const sameFirst = firstNameOf(slotName) !== '' && firstNameOf(slotName) === firstNameOf(personName(account));
    if (!sameFirst) return none;

    const slotEmail = normalizeEmail(slot.email), accEmail = normalizeEmail(account.email);
    const slotPhone = normalizePhone(slot.phone), accPhone = normalizePhone(account.phone);
    const emailMatch = !!slotEmail && slotEmail === accEmail;
    const phoneMatch = !!slotPhone && slotPhone === accPhone;
    const emailConflict = !!slotEmail && !!accEmail && slotEmail !== accEmail;
    const phoneConflict = !!slotPhone && !!accPhone && slotPhone !== accPhone;

    if (fullName && emailMatch && phoneMatch) {
        return { level: 'exact', reasons: ['Full name matches', 'Phone matches', 'Email matches'] };
    }
    // A real detail that disagrees means a different person with the same first name.
    if (emailConflict || phoneConflict) return none;

    const reasons = [fullName ? 'Full name matches' : 'First name matches'];
    if (phoneMatch) reasons.push('Phone matches');
    if (emailMatch) reasons.push('Email matches');
    if (!slotPhone) reasons.push('No phone on this entry');
    if (!slotEmail) reasons.push('No email on this entry');
    return { level: 'suggested', reasons };
};

export interface PlayerLink {
    id: string;
    uid: string;
    name?: string;
    method?: 'auto-login' | 'organizer' | 'player' | 'migration';
    mergedBy?: string;
    mergedAt?: string;
}
