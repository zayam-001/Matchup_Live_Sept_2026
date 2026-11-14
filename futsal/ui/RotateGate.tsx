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

/** A splash while the phone is upright: the phone turning sideways and "Rotate your phone". */
export const RotateGate: React.FC = () => {
    const portrait = useLandscapeOnly();
    if (!portrait) return null;
    return (
        <div className="rg" role="dialog" aria-modal="true" aria-label="Rotate your phone">
            <div className="rg__in">
                <span className="rg__phone" aria-hidden="true"><i /></span>
                <b className="rg__title">Rotate<br />your<br />phone</b>
            </div>
        </div>
    );
};

export default RotateGate;
