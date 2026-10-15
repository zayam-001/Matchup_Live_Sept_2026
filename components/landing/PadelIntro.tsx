import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { SplashScene } from '../BootSplash';

/** Where the hero's ball rests, in viewport px (scale relative to a 56px ball). */
export interface Pose {
    ball: { x: number; y: number; scale: number };
    racket: unknown;
}

interface Props {
    /** Where the ball rests in the hero, so the strike lands it there. */
    getHeroPose: () => Pose | null;
    /** Called as the curtain starts to lift (start the hero entrance). */
    onReveal: () => void;
    /** Called once the overlay is gone. */
    onDone: () => void;
}

/**
 * Picks up exactly where the boot splash left off (same scene: the ball
 * bouncing on the racket), takes one more bounce, then the racket swings and
 * strikes the ball to its resting spot in the hero while the curtain opens.
 * The homepage renders underneath the whole time; a click or key press
 * fast-forwards it.
 */
export const PadelIntro: React.FC<Props> = ({ getHeroPose, onReveal, onDone }) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const callbacks = useRef({ onReveal, onDone, getHeroPose });
    callbacks.current = { onReveal, onDone, getHeroPose };

    useEffect(() => {
        const root = rootRef.current!;
        const scene = root.querySelector('.mu-boot') as HTMLElement;
        const ball = root.querySelector('.mu-boot__ball') as HTMLElement;
        const racket = root.querySelector('.mu-boot__racket') as HTMLElement;
        const logo = root.querySelector('.mu-boot__logo') as HTMLElement;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // Resolved at the moment of the strike (the page has laid itself out by then).
        let delta: { x: number; y: number; scale: number } | null = null;
        const strikeDelta = () => {
            if (delta) return delta;
            const r = ball.getBoundingClientRect();
            const from = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            const to = callbacks.current.getHeroPose()?.ball || { x: vw * 0.82, y: vh * 0.3, scale: 1.2 };
            delta = { x: to.x - from.x, y: to.y - from.y, scale: to.scale };
            return delta;
        };

        let revealed = false;
        const reveal = () => {
            if (revealed) return;
            revealed = true;
            callbacks.current.onReveal();
        };

        // One more bounce from the splash, then the strike (bounce period .92s, contact at 0).
        const tl = gsap.timeline({ onComplete: () => callbacks.current.onDone() });
        tl.add(() => scene.classList.add('is-striking'), 0.92)
            .to(racket, { rotation: 38, duration: 0.14, ease: 'power4.in', transformOrigin: '50% 27%' }, 0.86)
            .to(ball, { scaleX: 0.82, scaleY: 1.14, duration: 0.05, yoyo: true, repeat: 1, ease: 'none' }, 0.92)
            .to(ball, { x: () => strikeDelta().x, y: () => strikeDelta().y, scale: () => strikeDelta().scale, rotation: 900, duration: 0.6, ease: 'power3.out' }, 1.0)
            .add(reveal, 1.04)
            .to(root, { '--curtain': 0, duration: 0.55, ease: 'power2.inOut' } as gsap.TweenVars, 1.04)
            .to(logo, { opacity: 0, duration: 0.3 }, 1.0)
            .to(racket, { x: vw * 0.5, y: -vh * 0.08, rotation: 80, duration: 0.45, ease: 'power3.in' }, 1.0)
            .to(racket, { opacity: 0, duration: 0.25, ease: 'none' }, 1.1)
            .to(ball, { opacity: 0, duration: 0.12 }, 1.56);

        const skip = () => {
            reveal();
            tl.progress(1);
        };
        window.addEventListener('keydown', skip);
        root.addEventListener('pointerdown', skip);
        // Wall-clock safety net: if frames are throttled (background tab), never
        // leave the overlay up longer than this.
        const fallback = window.setTimeout(skip, 3500);
        return () => {
            window.removeEventListener('keydown', skip);
            root.removeEventListener('pointerdown', skip);
            window.clearTimeout(fallback);
            tl.kill();
        };
    }, []);

    return (
        <div ref={rootRef} className="mu-intro" role="presentation" aria-hidden="true">
            <div className="mu-intro__curtain" />
            <SplashScene clear />
        </div>
    );
};

export default PadelIntro;
