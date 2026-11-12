// In-app confirmation pop-up in place of the browser's confirm()/prompt().
// `await confirmDialog({ title, body })` resolves true on confirm, false on cancel.
// The host mounts itself the first time it's needed, so it works on every route
// (admin, referee, futsal pages, OBS) without wiring.
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertTriangle, HelpCircle } from 'lucide-react';

export interface ConfirmOptions {
    title: string;
    body?: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    /** Red confirm button, for deletes and resets. */
    danger?: boolean;
    /** The person must type this exact text before confirming (e.g. a name, for permanent deletes). */
    requireText?: string;
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };
let push: ((p: Pending) => void) | null = null;
const queue: Pending[] = [];

const ensureHost = () => {
    if (push || typeof document === 'undefined') return;
    const el = document.createElement('div');
    el.id = 'confirm-dialog-root';
    document.body.appendChild(el);
    createRoot(el).render(<Host />);
};

export const confirmDialog = (opts: ConfirmOptions): Promise<boolean> => new Promise(resolve => {
    const p = { ...opts, resolve };
    if (push) push(p); else { queue.push(p); ensureHost(); }
});

const Host: React.FC = () => {
    const [items, setItems] = useState<Pending[]>(() => queue.splice(0));
    useEffect(() => { push = p => setItems(list => [...list, p]); return () => { push = null; }; }, []);
    const current = items[0];
    if (!current) return null;
    const close = (ok: boolean) => { current.resolve(ok); setItems(list => list.slice(1)); };
    return <Dialog key={items.length + current.title} item={current} onClose={close} />;
};

const Dialog: React.FC<{ item: Pending; onClose: (ok: boolean) => void }> = ({ item, onClose }) => {
    const [typed, setTyped] = useState('');
    const okRef = useRef<HTMLButtonElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const blocked = !!item.requireText && typed.trim() !== item.requireText.trim();
    useEffect(() => {
        (item.requireText ? inputRef.current : okRef.current)?.focus();
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [item, onClose]);
    const accent = item.danger ? '#F05252' : '#4D78FF';
    return (
        <div onClick={() => onClose(false)} style={{ position: 'fixed', inset: 0, zIndex: 100000, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(4, 6, 20, .72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', animation: 'cd-fade .15s ease-out' }}>
            <style>{'@keyframes cd-fade{from{opacity:0}to{opacity:1}}@keyframes cd-pop{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}'}</style>
            <div role="alertdialog" aria-modal="true" aria-labelledby="cd-title" onClick={e => e.stopPropagation()}
                style={{ width: '100%', maxWidth: 440, borderRadius: 20, border: '1px solid rgba(255,255,255,.1)', background: 'linear-gradient(180deg, #17172a, #101020)', boxShadow: '0 24px 60px rgba(0,0,0,.55)', color: '#fff', padding: 24, fontFamily: 'inherit', animation: 'cd-pop .18s ease-out' }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <span style={{ flex: 'none', display: 'grid', placeItems: 'center', width: 40, height: 40, borderRadius: 12, background: `${accent}22`, color: accent }}>
                        {item.danger ? <AlertTriangle size={20} /> : <HelpCircle size={20} />}
                    </span>
                    <div style={{ minWidth: 0 }}>
                        <h2 id="cd-title" style={{ margin: 0, fontSize: 18, fontWeight: 800, lineHeight: 1.3 }}>{item.title}</h2>
                        {item.body && <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.55, color: 'rgba(255,255,255,.7)', whiteSpace: 'pre-line' }}>{item.body}</div>}
                    </div>
                </div>
                {item.requireText && (
                    <label style={{ display: 'block', marginTop: 18, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.6)' }}>
                        Type <b style={{ color: '#fff' }}>{item.requireText}</b> to confirm
                        <input ref={inputRef} value={typed} onChange={e => setTyped(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !blocked) onClose(true); }}
                            style={{ display: 'block', width: '100%', marginTop: 8, padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(0,0,0,.3)', color: '#fff', fontSize: 14, outline: 'none' }} />
                    </label>
                )}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
                    <button type="button" onClick={() => onClose(false)} style={{ padding: '10px 18px', borderRadius: 12, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.05)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>{item.cancelLabel || 'Cancel'}</button>
                    <button ref={okRef} type="button" disabled={blocked} onClick={() => onClose(true)} style={{ padding: '10px 18px', borderRadius: 12, border: 0, background: accent, color: '#fff', fontWeight: 800, fontSize: 14, cursor: blocked ? 'not-allowed' : 'pointer', opacity: blocked ? 0.45 : 1 }}>{item.confirmLabel || 'Confirm'}</button>
                </div>
            </div>
        </div>
    );
};
