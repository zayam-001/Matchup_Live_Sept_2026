// Phones play the player portal in landscape, like a console game: held upright they see a
// "rotate your phone" screen; turned sideways the page lays out at laptop width (the viewport is
// widened, so it looks exactly like the desktop dashboard, scaled to fit the screen).
import React, { useEffect, useState } from 'react';
import './rotate.css';

/** A phone (touch, small screen), not a tablet or laptop. */
const isPhone = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches && Math.min(window.screen.width, window.screen.height) < 600;
const portraitNow = () => window.matchMedia('(orientation: portrait)').matches;
/** Wide enough for the desktop layout and, on a sideways phone, tall enough for its one-screen mode. */
const LANDSCAPE_WIDTH = 1400;

/** While mounted on a phone: landscape lays out at laptop width; portrait shows the rotate screen. */
export const useLandscapeOnly = () => {
    const phone = isPhone();
    const [portrait, setPortrait] = useState(() => phone && portraitNow());
    useEffect(() => {
        if (!phone) return;
        const meta = document.querySelector('meta[name="viewport"]');
        const original = meta?.getAttribute('content') || 'width=device-width, initial-scale=1.0';
        const mq = window.matchMedia('(orientation: portrait)');
        const apply = () => {
            const p = mq.matches;
            setPortrait(p);
            meta?.setAttribute('content', p ? original : `width=${LANDSCAPE_WIDTH}, viewport-fit=cover`);
        };
        apply();
        mq.addEventListener('change', apply);
        return () => { mq.removeEventListener('change', apply); meta?.setAttribute('content', original); };
    }, [phone]);
    return portrait;
};

/** Full screen, then lock to landscape: Android only (iPhones can't lock from a web page). */
const canLock = () => !!(document.documentElement.requestFullscreen && (screen.orientation as any)?.lock);
const goLandscape = async () => {
    try { await document.documentElement.requestFullscreen(); await (screen.orientation as any).lock('landscape'); } catch { /* the user can still rotate by hand */ }
};

/** A splash while the phone is upright: the phone turning sideways, "Rotate your phone", and two ways on. */
export const RotateGate: React.FC = () => {
    const portrait = useLandscapeOnly();
    const [later, setLater] = useState(false);
    const [skip, setSkip] = useState(false);
    useEffect(() => { if (!portrait) return; const t = setTimeout(() => setLater(true), 4000); return () => clearTimeout(t); }, [portrait]);
    if (!portrait || skip) return null;
    return (
        <div className="rg" role="dialog" aria-modal="true" aria-label="Rotate your phone">
            <div className="rg__in">
                <span className="rg__phone" aria-hidden="true"><i /></span>
                <b className="rg__title">Rotate<br />your<br />phone</b>
            </div>
            {canLock() && <button type="button" className="rg__btn" onClick={goLandscape}>Play in full screen</button>}
            {later && <button type="button" className="rg__skip" onClick={() => setSkip(true)}>Continue in portrait</button>}
        </div>
    );
};

export default RotateGate;
