// Profile & settings as a screen of tiles: each tile shows one detail and edits in place.
import React, { useRef, useState } from 'react';
import { Calendar, Camera, Check, ChevronDown, Flag, KeyRound, Loader2, Mail, MapPin, Phone, Shield, Shirt, Trophy, User, X } from 'lucide-react';
import { auth, updatePlayerProfile, uploadProfilePicture } from '../../services/storage';
import { toast } from '../../components/Toast';
import type { PlayerAccount } from './PlayerProfileModal';

type Field = 'fullName' | 'position' | 'skillLevel' | 'homeTeam' | 'phone' | 'city' | 'birthday' | 'gender';
const SKILLS: [string, string][] = [['', 'Not set'], ['NEWCOMER', 'Newcomer'], ['BEGINNER', 'Beginner'], ['INTERMEDIATE', 'Intermediate'], ['ADVANCED', 'Advanced'], ['PROFESSIONAL', 'Professional']];
const POSITIONS: [string, string][] = [['', 'Not set'], ['GK', 'Goalkeeper'], ['DEF', 'Defender'], ['MID', 'Midfielder'], ['FWD', 'Forward']];
const GENDERS: [string, string][] = [['', 'Not set'], ['male', 'Male'], ['female', 'Female']];
const CITIES = ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta', 'Sialkot', 'Hyderabad'];

interface TileDef { field: Field; label: string; icon: React.ReactNode; kind: 'text' | 'select' | 'date' | 'tel'; options?: [string, string][]; placeholder?: string }
/** The one detail on the main grid; the rest sit under "More details". */
const PHONE: TileDef = { field: 'phone', label: 'Phone', icon: <Phone />, kind: 'tel', placeholder: '03001234567' };
const TILES: TileDef[] = [
    { field: 'position', label: 'Position', icon: <Shirt />, kind: 'select', options: POSITIONS },
    { field: 'skillLevel', label: 'Padel level', icon: <Trophy />, kind: 'select', options: SKILLS },
    { field: 'homeTeam', label: 'Home club', icon: <Shield />, kind: 'text', placeholder: 'e.g. Legends Arena' },
    { field: 'city', label: 'City', icon: <MapPin />, kind: 'select', options: [['', 'Not set'], ...CITIES.map(c => [c, c] as [string, string])] },
    { field: 'birthday', label: 'Date of birth', icon: <Calendar />, kind: 'date' },
    { field: 'gender', label: 'Gender', icon: <Flag />, kind: 'select', options: GENDERS },
];

export const ProfileScreen: React.FC<{ account: PlayerAccount & { position?: string }; onSaved: (patch: Partial<PlayerAccount> & { position?: string }) => void; onLogout: () => void }> = ({ account, onSaved, onLogout }) => {
    const id = account.id || account.uid || auth?.currentUser?.uid;
    const [editing, setEditing] = useState<Field | null>(null);
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [more, setMore] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const name = account.fullName || account.name || '';
    const initials = (name || account.email || 'P').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const hasPassword = !!auth?.currentUser?.providerData?.some((p: any) => p.providerId === 'password');
    const valueOf = (f: Field) => String((account as any)[f] || '');
    const display = (t: TileDef) => {
        const v = valueOf(t.field);
        if (!v) return 'Not set';
        if (t.options) return t.options.find(([k]) => k === v)?.[1] || v;
        if (t.kind === 'date') return new Date(`${v}T00:00:00`).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
        return v;
    };

    const save = async (field: Field, raw: string) => {
        if (!id) return;
        let v = raw.trim();
        if (field === 'fullName') { v = v.replace(/\s+/g, ' '); if (!v) { toast.error('Enter your name'); return; } }
        if (field === 'phone') { v = v.replace(/[^\d+]/g, ''); if (v && v.replace(/\D/g, '').length < 10) { toast.error('Enter a full phone number', 'e.g. 03001234567'); return; } }
        setBusy(true);
        try { await updatePlayerProfile(id, { [field]: v }); onSaved({ [field]: v }); setEditing(null); toast.success('Saved'); }
        catch { toast.error('Couldn’t save', 'Check your connection and try again.'); }
        finally { setBusy(false); }
    };
    const pickPhoto = async (file?: File) => {
        if (!file || !id) return;
        if (!file.type.startsWith('image/') || file.size > 15 * 1024 * 1024) { toast.error('Choose an image under 15 MB'); return; }
        setUploading(true);
        try { const url = await uploadProfilePicture(id, file); await updatePlayerProfile(id, { photoUrl: url }); onSaved({ photoUrl: url }); toast.success('Photo updated'); }
        catch { toast.error('Couldn’t upload the photo'); }
        finally { setUploading(false); }
    };
    const reset = async () => {
        if (!account.email) return;
        try { const { sendPasswordResetEmail } = await import('firebase/auth'); await sendPasswordResetEmail(auth, account.email); toast.success('Reset link sent', account.email); }
        catch { toast.error('Couldn’t send the email'); }
    };
    const start = (f: Field) => { setEditing(f); setDraft(valueOf(f)); };

    // Called as a function (not <Editor/>) so the input isn't remounted, and keeps focus, on every keystroke.
    const Editor = ({ t }: { t: TileDef }) => (
        <span className="pf-edit" onClick={e => e.stopPropagation()}>
            {t.kind === 'select'
                ? <select className="qp-input" autoFocus value={draft} onChange={e => setDraft(e.target.value)}>{t.options!.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                : <input className="qp-input" autoFocus type={t.kind === 'date' ? 'date' : t.kind === 'tel' ? 'tel' : 'text'} placeholder={t.placeholder} value={draft} max={t.kind === 'date' ? new Date().toISOString().slice(0, 10) : undefined}
                    onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') save(t.field, draft); if (e.key === 'Escape') setEditing(null); }} />}
            <span className="pf-edit__btns">
                <button type="button" className="qp-btn qp-btn--primary" disabled={busy} onClick={() => save(t.field, draft)}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save</button>
                <button type="button" className="qp-btn" onClick={() => setEditing(null)}><X size={14} /></button>
            </span>
        </span>
    );

    const tile = (t: TileDef) => (
        <div key={t.field} className={`pf-tile ${editing === t.field ? 'is-editing' : ''} ${valueOf(t.field) ? '' : 'is-empty'}`} onClick={() => editing !== t.field && start(t.field)} role="button" tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' && editing !== t.field) start(t.field); }}>
            <span className="pf-tile__label">{t.label}</span>
            <span className="pf-tile__icon" aria-hidden="true">{t.icon}</span>
            {editing === t.field ? Editor({ t }) : <b className="pf-tile__value">{display(t)}</b>}
        </div>
    );
    return (
        <div className="pf">
            <div className="pf-head"><span className="fxs-label">Profile &amp; settings</span><small className="qp-muted">Tap any tile to change it.</small></div>
            <div className="pf-grid">
                {/* Name and photo: the big tile, like the player name slot */}
                <div className={`pf-tile pf-tile--hero ${editing === 'fullName' ? 'is-editing' : ''}`} onClick={() => editing !== 'fullName' && start('fullName')} role="button" tabIndex={0}>
                    <span className="pf-tile__label">Player name</span>
                    <button type="button" className="pf-photo" onClick={e => { e.stopPropagation(); fileRef.current?.click(); }} aria-label="Change photo">
                        {account.photoUrl ? <img src={account.photoUrl} alt="" /> : <span>{initials}</span>}
                        <i>{uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}</i>
                    </button>
                    {editing === 'fullName' ? Editor({ t: { field: 'fullName', label: 'Name', icon: <User />, kind: 'text' } }) : <b className="pf-tile__value pf-tile__value--big">{name || 'Add your name'}</b>}
                    <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { pickPhoto(e.target.files?.[0]); e.target.value = ''; }} />
                </div>
                {tile(PHONE)}
                <div className="pf-tile is-locked">
                    <span className="pf-tile__label">Email</span>
                    <span className="pf-tile__icon" aria-hidden="true"><Mail /></span>
                    <b className="pf-tile__value pf-tile__value--small">{account.email || '—'}</b>
                    <small className="pf-tile__note">Organisers add you to teams with this email.</small>
                </div>
                <div className="pf-tile is-locked">
                    <span className="pf-tile__label">Password</span>
                    <span className="pf-tile__icon" aria-hidden="true"><KeyRound /></span>
                    {hasPassword ? <button type="button" className="qp-btn" onClick={reset}>Send reset link</button> : <small className="pf-tile__note">You sign in with Google.</small>}
                    <button type="button" className="qp-btn qp-btn--danger pf-logout" onClick={onLogout}>Log out</button>
                </div>
            </div>
            <button type="button" className={`pf-more ${more ? 'is-open' : ''}`} onClick={() => setMore(v => !v)} aria-expanded={more}>
                <span>More details <small>{TILES.filter(t => valueOf(t.field)).length} of {TILES.length} filled · optional</small></span><ChevronDown size={18} />
            </button>
            {more && <div className="pf-grid pf-grid--more">{TILES.map(tile)}</div>}
        </div>
    );
};

export default ProfileScreen;
