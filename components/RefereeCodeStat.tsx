import React, { useEffect, useState } from 'react';
import { Check, Copy, Edit3, X } from 'lucide-react';
import { toast } from './Toast';

/** The referee passcode in the workspace header: visible to the organiser, editable in place. */
export const RefereeCodeStat = ({ value, onSave }: { value?: string; onSave: (code: string) => Promise<void> }) => {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value || '');
    const [show, setShow] = useState(false);
    const [busy, setBusy] = useState(false);
    useEffect(() => { if (!editing) setDraft(value || ''); }, [value, editing]);
    const save = async () => {
        const code = draft.trim();
        if (code.length < 4) { toast.error('Referee code too short', 'Use at least 4 characters.'); return; }
        setBusy(true);
        try { await onSave(code); toast.success('Referee code updated', 'Referees signed in with the old code stay signed in; new sign-ins need this one.'); setEditing(false); }
        catch (e: any) { toast.error('Couldn’t update the referee code', e?.message); }
        finally { setBusy(false); }
    };
    return (
        <div className="adm-ws__code">
            {editing ? (
                <span className="adm-ws__code-edit">
                    <input autoFocus value={draft} maxLength={12} onChange={e => setDraft(e.target.value.replace(/\s/g, ''))} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }} aria-label="Referee code" />
                    <button type="button" onClick={save} disabled={busy} title="Save"><Check size={14} /></button>
                    <button type="button" onClick={() => setEditing(false)} title="Cancel"><X size={14} /></button>
                </span>
            ) : (
                <strong className="adm-ws__code-val">
                    <button type="button" className="adm-ws__code-reveal" onClick={() => setShow(s => !s)} title={show ? 'Hide' : 'Show'}>{show ? (value || '—') : '••••••'}</button>
                    <button type="button" className="adm-ws__code-btn" onClick={() => { if (value) { navigator.clipboard.writeText(value); toast.success('Referee code copied'); } }} title="Copy"><Copy size={13} /></button>
                    <button type="button" className="adm-ws__code-btn" onClick={() => { setEditing(true); setShow(true); }} title="Change"><Edit3 size={13} /></button>
                </strong>
            )}
            <span>Referee code</span>
        </div>
    );
};
