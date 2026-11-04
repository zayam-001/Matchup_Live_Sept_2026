// Bonus points wallet. New players start with SIGNUP_BONUS_POINTS and redeem them
// as a one-time code that Maidan staff apply to a court booking.
export const SIGNUP_BONUS_POINTS = 500;
/** Rupees of Maidan credit per point. */
export const PKR_PER_POINT = 1;
export const MIN_REDEEM_POINTS = 50;

export interface Redemption {
    code: string;
    uid: string;
    playerName?: string;
    playerPhone?: string;
    amount: number;
    status: 'issued' | 'used';
    createdAt: string;
    usedAt?: string;
    usedBy?: string;
    bookingRef?: string;
}

// No 0/O/1/I so codes are easy to read out at a counter.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const generateRedeemCode = () => {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const body = Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('');
    return `MU-${body.slice(0, 4)}-${body.slice(4)}`;
};
export const normalizeRedeemCode = (s: string) => {
    const c = s.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^MU/, '');
    return c.length === 8 ? `MU-${c.slice(0, 4)}-${c.slice(4)}` : s.trim().toUpperCase();
};
