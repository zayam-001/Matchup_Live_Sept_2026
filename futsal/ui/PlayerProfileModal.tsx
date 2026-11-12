// "Profile & account" for players, opened from the avatar in the player portal.
// Same sheet as the organiser's profile pop-up; saves to the player's profile,
// which every sport (padel rankings, futsal and football squads) reads.
import React, { useEffect, useRef, useState } from 'react';
import { Camera, Check, Loader2, Lock, LogOut, X } from 'lucide-react';
import { auth, updatePlayerProfile, uploadProfilePicture } from '../../services/storage';

export interface PlayerAccount {
    id?: string; uid?: string; email?: string; phone?: string; fullName?: string; name?: string; photoUrl?: string;
    gender?: string; birthday?: string; skillLevel?: string; homeTeam?: string; city?: string;
}

const SKILLS = [['', 'Not set'], ['NEWCOMER', 'Newcomer'], ['BEGINNER', 'Beginner'], ['INTERMEDIATE', 'Intermediate'], ['ADVANCED', 'Advanced'], ['PROFESSIONAL', 'Professional']];
const CITIES = ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta', 'Sialkot', 'Hyderabad'];

export const PlayerProfileModal: React.FC<{ account: PlayerAccount; onClose: () => void; onSaved: (next: PlayerAccount) => void; onLogout?: () => void }> = ({ account, onClose, onSaved, onLogout }) => {
    const id = account.id || account.uid || auth?.currentUser?.uid;
    const [form, setForm] = useState({
        fullName: account.fullName || account.name || '',
        phone: account.phone || '',
        city: account.city || '',
        gender: account.gender || '',
        birthday: account.birthday || '',
        skillLevel: account.skillLevel || '',
        homeTeam: account.homeTeam || '',
        photoUrl: account.photoUrl || '',
    });
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [onClose]);
    const set = (patch: Partial<typeof form>) => { setForm(f => ({ ...f, ...patch })); setMsg(null); };
    // Only email/password accounts have a password to reset (not Google sign-ins).
    const hasPassword = !!auth?.currentUser?.providerData?.some((p: any) => p.providerId === 'password');
    const initials = (form.fullName || account.email || 'P').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

    const pickPhoto = async (file?: File) => {
        if (!file || !id) return;
        if (!file.type.startsWith('image/')) { setMsg({ tone: 'err', text: 'Choose an image file (JPG, PNG or WebP).' }); return; }
        if (file.size > 15 * 1024 * 1024) { setMsg({ tone: 'err', text: 'That photo is over 15 MB.' }); return; }
        setUploading(true); setMsg(null);
        try { set({ photoUrl: await uploadProfilePicture(id, file) }); }
        catch { setMsg({ tone: 'err', text: 'Couldn’t upload the photo. Try again.' }); }
        finally { setUploading(false); }
    };

    const save = async () => {
        if (!id) return;
        const fullName = form.fullName.trim().replace(/\s+/g, ' ');
        if (!fullName) { setMsg({ tone: 'err', text: 'Enter your name.' }); return; }
        const phone = form.phone.replace(/[^\d+]/g, '');
        if (phone && phone.replace(/\D/g, '').length < 10) { setMsg({ tone: 'err', text: 'Enter a full phone number, e.g. 03001234567.' }); return; }
        setSaving(true); setMsg(null);
        try {
            const updates = { ...form, fullName, phone };
            await updatePlayerProfile(id, updates);
            onSaved({ ...account, ...updates });
            setMsg({ tone: 'ok', text: 'Profile saved.' });
        } catch (e: any) {
            setMsg({ tone: 'err', text: e?.code === 'permission-denied' ? 'You can only edit your own profile.' : 'Couldn’t save. Check your connection and try again.' });
        } finally { setSaving(false); }
    };

    const resetPassword = async () => {
        if (!account.email) return;
        try {
            const { sendPasswordResetEmail } = await import('firebase/auth');
            await sendPasswordResetEmail(auth, account.email);
            setMsg({ tone: 'ok', text: `Password reset link sent to ${account.email}.` });
        } catch { setMsg({ tone: 'err', text: 'Couldn’t send the email. Try again.' }); }
    };

    return (
        <div className="adm-modal admx-profile" onClick={onClose}>
            <div className="adm-modal__sheet admx-profile__sheet fxp-profile" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="fxp-profile-title">
                <div className="adm-modal__head">
                    <div>
                        <h2 id="fxp-profile-title">Profile &amp; account</h2>
                        <p className="adm-sub">How you appear on teams, rankings and broadcasts in every sport.</p>
                    </div>
                    <button onClick={onClose} className="adm-icon-btn" aria-label="Close"><X size={18} /></button>
                </div>
                <div className="adm-modal__body admx-profile__body">
                    <div className="fxp-profile__photo">
                        <button type="button" className="fxp-profile__avatar" onClick={() => fileRef.current?.click()} aria-label="Change photo" disabled={uploading}>
                            {form.photoUrl ? <img src={form.photoUrl} alt="" /> : <span>{initials}</span>}
                            <i>{uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}</i>
                        </button>
                        <div>
                            <b>{form.fullName || 'Your name'}</b>
                            <p className="admx-profile__hint">Tap the photo to change it. It's resized automatically.</p>
                            {form.photoUrl && <button type="button" className="fxp-profile__link" onClick={() => set({ photoUrl: '' })}>Remove photo</button>}
                        </div>
                        <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { pickPhoto(e.target.files?.[0]); e.target.value = ''; }} />
                    </div>

                    <div className="fxp-profile__grid">
                        <div className="fxp-profile__full">
                            <label className="adm-label" htmlFor="pp-name">Full name</label>
                            <input id="pp-name" className="adm-input" value={form.fullName} maxLength={60} onChange={e => set({ fullName: e.target.value })} />
                        </div>
                        <div>
                            <label className="adm-label" htmlFor="pp-phone">Phone</label>
                            <input id="pp-phone" className="adm-input" inputMode="tel" placeholder="03001234567" value={form.phone} onChange={e => set({ phone: e.target.value })} />
                        </div>
                        <div>
                            <label className="adm-label" htmlFor="pp-city">City</label>
                            <select id="pp-city" className="adm-input" value={form.city} onChange={e => set({ city: e.target.value })}>
                                <option value="">Not set</option>
                                {CITIES.map(c => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="adm-label" htmlFor="pp-gender">Gender</label>
                            <select id="pp-gender" className="adm-input" value={form.gender} onChange={e => set({ gender: e.target.value })}>
                                <option value="">Not set</option><option value="male">Male</option><option value="female">Female</option>
                            </select>
                        </div>
                        <div>
                            <label className="adm-label" htmlFor="pp-dob">Date of birth</label>
                            <input id="pp-dob" className="adm-input" type="date" value={form.birthday} max={new Date().toISOString().slice(0, 10)} onChange={e => set({ birthday: e.target.value })} />
                        </div>
                        <div>
                            <label className="adm-label" htmlFor="pp-skill">Padel level</label>
                            <select id="pp-skill" className="adm-input" value={form.skillLevel} onChange={e => set({ skillLevel: e.target.value })}>
                                {SKILLS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="adm-label" htmlFor="pp-club">Home club</label>
                            <input id="pp-club" className="adm-input" placeholder="e.g. Legends Arena" value={form.homeTeam} maxLength={60} onChange={e => set({ homeTeam: e.target.value })} />
                        </div>
                    </div>

                    <div>
                        <span className="adm-label">Email</span>
                        <div className="admx-profile__static">{account.email || '—'}</div>
                        <p className="admx-profile__hint">Organisers add you to teams with this email.</p>
                    </div>
                    {hasPassword && (
                        <div className="admx-profile__row">
                            <div>
                                <span className="adm-label">Password</span>
                                <p className="admx-profile__hint">We'll email you a secure link to set a new one.</p>
                            </div>
                            <button type="button" className="adm-btn adm-btn--ghost" onClick={resetPassword}><Lock size={15} /> Send reset link</button>
                        </div>
                    )}
                    {msg && <div className={`admx-profile__msg is-${msg.tone}`} role="status">{msg.text}</div>}
                    <div className="admx-profile__actions">
                        {onLogout && <button type="button" className="adm-btn adm-btn--ghost admx-profile__logout" onClick={onLogout}><LogOut size={15} /> Log out</button>}
                        <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose}>Close</button>
                        <button type="button" className="adm-btn adm-btn--primary" onClick={save} disabled={saving || uploading}>
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save profile
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlayerProfileModal;
