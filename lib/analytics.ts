// Google Analytics (via Firebase) for the whole platform: visitors, page views and signed-in users.
// The site switches screens by the address after "#", which Analytics doesn't count by itself, so every
// screen change is logged as a page view. Only the live site reports; local testing is left out.
// Signed-in users are linked by their anonymous account id (never name, email or phone).
import { getApp } from 'firebase/app';
import { initializeAnalytics, isSupported, logEvent, setUserId, type Analytics } from 'firebase/analytics';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/storage';

const isLocal = typeof window === 'undefined' || /^(localhost|127\.|\[::1\]|0\.0\.0\.0)/.test(window.location.hostname);
let ready: Promise<Analytics | null> | null = null;

const start = () => (ready ??= isLocal
    ? Promise.resolve(null)
    // Our own page views only: Analytics' automatic one ignores everything after "#", so a visit straight
    // to "#live/iba-champions-league" would be counted as the home page.
    : isSupported().then(ok => (ok ? initializeAnalytics(getApp(), { config: { send_page_view: false } }) : null)).catch(() => null));

/** The screen being viewed, e.g. "/live/iba-champions-league" (the query, which may hold codes, is left out). */
const pagePath = () => `/${window.location.hash.replace(/^#\/?/, '').split('?')[0]}`;

const trackPage = (path = pagePath(), title = document.title) => start().then(a => {
    if (a) logEvent(a, 'page_view', { page_location: `${window.location.origin}${path}`, page_path: path, page_title: title });
});

/** Call once when the app starts. */
export const initAnalytics = () => {
    start().then(a => {
        if (!a) return;
        trackPage();
        window.addEventListener('hashchange', () => { trackPage(); });
        if (auth) onAuthStateChanged(auth, (u: any) => setUserId(a, u && !u.isAnonymous ? u.uid : null));
    });
};

/** A named action worth counting (e.g. "sign_up", "quick_match_created"). Never pass personal details. */
export const track = (name: string, params?: Record<string, string | number | boolean>) =>
    start().then(a => { if (a) logEvent(a, name, params); });

/**
 * Broadcast mode opens over the spectator page without changing the address, so it's logged as its own
 * screen ("/live/iba-champions-league/broadcast") plus a broadcast_open event with the tournament and sport.
 */
export const trackBroadcast = (tournament: string, sport: string) => {
    trackPage(`${pagePath().replace(/\/$/, '')}/broadcast`, `${tournament} · Broadcast`);
    track('broadcast_open', { tournament, sport });
};
