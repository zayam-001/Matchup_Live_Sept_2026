// Every email the player side sends, in one place and one look. Each is queued in the `mail`
// collection, which the Firebase "Trigger Email" extension sends. Names and team names are escaped.
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../services/storage';

const FROM = 'Match Up <info@matchup.com.pk>';
const REPLY = 'info@matchup.com.pk';
const lower = (s?: string) => (s || '').trim().toLowerCase();
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const origin = () => (typeof window !== 'undefined' ? window.location.origin : 'https://matchup.com.pk');

/** The shared layout: navy header with the wordmark, a headline, a few lines, optional facts, one button. */
const layout = (o: { title: string; lines: string[]; facts?: [string, string][]; cta?: { label: string; href: string }; foot?: string }) => `
<div style="background:#01082E;padding:24px 12px;font-family:Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden">
    <div style="background:#020D45;padding:18px 24px;color:#fff;font-weight:900;font-style:italic;letter-spacing:.04em;font-size:20px">MATCH UP <span style="color:#FF8A5B;font-size:11px;letter-spacing:.2em;font-style:normal;margin-left:6px">PLAYER PORTAL</span></div>
    <div style="padding:26px 24px 8px;color:#0b1258">
      <h2 style="margin:0 0 12px;font-size:22px;line-height:1.25">${esc(o.title)}</h2>
      ${o.lines.map(l => `<p style="margin:0 0 12px;color:#3b4266;font-size:15px;line-height:1.5">${l}</p>`).join('')}
      ${o.facts?.length ? `<table style="width:100%;border-collapse:collapse;margin:6px 0 16px">${o.facts.map(([k, v]) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eceef6;color:#7a809c;font-size:12px;text-transform:uppercase;letter-spacing:.08em">${esc(k)}</td><td style="padding:8px 0;border-bottom:1px solid #eceef6;text-align:right;font-weight:700">${esc(v)}</td></tr>`).join('')}</table>` : ''}
      ${o.cta ? `<a href="${o.cta.href}" style="display:inline-block;margin:6px 0 18px;padding:12px 22px;background:#F26B3A;color:#fff;border-radius:8px;text-decoration:none;font-weight:800">${esc(o.cta.label)}</a>` : ''}
    </div>
    <div style="padding:14px 24px 22px;color:#9096b0;font-size:12px;line-height:1.5;border-top:1px solid #eceef6">${o.foot || 'You’re getting this because someone added you on Match Up.'}</div>
  </div>
</div>`;

const send = async (to: string | undefined, subject: string, html: string, replyTo = REPLY) => {
    const email = lower(to);
    if (!db || !email) return;
    await addDoc(collection(db, 'mail'), { to: email, replyTo, message: { subject, from: FROM, html } });
};
const signInNote = (email: string) => `Sign up or sign in with this email (${esc(lower(email))}) and it appears in your player portal automatically.`;

type Sport = 'futsal' | 'football' | 'padel';
const SPORT: Record<Sport, string> = { futsal: 'futsal', football: 'football', padel: 'padel' };
const squadLink = (sport: Sport) => `${origin()}/#player/${sport === 'football' ? 'football-squad' : sport === 'padel' ? 'padel-squad' : 'squad'}`;

// ---------------------------------------------------------------- squads (player-made and tournament)

interface SquadCtx { sport: Sport; squad: string; captain: string; tournament?: string }
interface Who { name: string; email?: string; position?: string; rating?: number; number?: number }

/** A captain added you to their squad (with an email): the invite. */
export const mailAddedToSquad = (c: SquadCtx, p: Who) => send(p.email,
    c.tournament ? `You’re in ${c.squad} for ${c.tournament}` : `${c.captain} added you to ${c.squad}`,
    layout({
        title: c.tournament ? `You’re in ${c.squad}` : `Welcome to ${c.squad}`,
        lines: [`<b>${esc(c.captain)}</b> added you to their ${SPORT[c.sport]} squad${c.tournament ? ` for <b>${esc(c.tournament)}</b>` : ''}.`, signInNote(p.email || '')],
        facts: [['Squad', c.squad], ...(c.tournament ? [['Tournament', c.tournament] as [string, string]] : []), ['Position', p.position || 'Not set'], ...(p.rating ? [['Rating', String(p.rating)] as [string, string]] : []), ...(p.number != null ? [['Shirt', `#${p.number}`] as [string, string]] : [])],
        cta: { label: 'See the squad', href: squadLink(c.sport) },
    }));

/** A captain took you off their squad. */
export const mailRemovedFromSquad = (c: SquadCtx, p: Who) => send(p.email,
    `You’ve been taken off ${c.squad}`,
    layout({
        title: `You’re no longer in ${c.squad}`,
        lines: [`<b>${esc(c.captain)}</b> removed you from their ${SPORT[c.sport]} squad${c.tournament ? ` for ${esc(c.tournament)}` : ''}.`, 'Your stats from matches you already played stay on your profile. If this looks like a mistake, reply to this email or talk to your captain.'],
        cta: { label: 'Open your player portal', href: `${origin()}/#player/home` },
    }));

/** A captain changed your rating, position or shirt number. */
export const mailSquadCardUpdated = (c: SquadCtx, p: Who, changes: [string, string, string][]) => send(p.email,
    `Your card in ${c.squad} was updated`,
    layout({
        title: 'Your player card changed',
        lines: [`<b>${esc(c.captain)}</b> updated your card in <b>${esc(c.squad)}</b>.`],
        facts: changes.map(([what, from, to]) => [what, `${from} → ${to}`] as [string, string]),
        cta: { label: 'See your card', href: squadLink(c.sport) },
    }));

// ---------------------------------------------------------------- friends and Quick Play

/** You were added as a friend. */
export const mailFriendAdded = (from: { name: string; email?: string }, friend: { name: string; email: string }) => send(friend.email,
    `${from.name} added you as a friend on Match Up`,
    layout({
        title: `Hi ${friend.name.split(' ')[0]}, let’s play`,
        lines: [`<b>${esc(from.name)}</b> added you as a friend, so they can pick you for padel, futsal and football matches and squads.`, signInNote(friend.email)],
        cta: { label: 'Join Match Up', href: `${origin()}/#auth-player` },
    }), lower(from.email) || REPLY);

/** You were invited to a Quick Play match. */
export const mailQuickInvite = (m: { hostName: string; sport: Sport; title: string; when: string; venue?: string; teams: string }, email: string) => send(email,
    `${m.hostName} invited you to a ${SPORT[m.sport]} match`,
    layout({
        title: m.title,
        lines: [`<b>${esc(m.hostName)}</b> added you to a Quick Play ${SPORT[m.sport]} match.`, signInNote(email)],
        facts: [['When', m.when], ...(m.venue ? [['Where', m.venue] as [string, string]] : []), ['Teams', m.teams]],
        cta: { label: 'See the match', href: `${origin()}/#player/play` },
    }));
