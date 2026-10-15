// Scroll-driven storytelling for the homepage.
//
// Each chapter is a ScrollTrigger timeline. On desktop (wide enough and tall
// enough to fit a chapter on screen) chapters pin while the scroll scrubs
// through them; on phones the same beats play as simple reveals; with
// prefers-reduced-motion nothing animates at all. Markup is always the
// finished state: only the "from" states are set here, so if this never runs
// the page is still complete.

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export interface HomeStory {
    playHeroEntrance: () => void;
    refresh: () => void;
    destroy: () => void;
}

const fmt = (n: number) => Math.round(n).toLocaleString();

export const setupHomeStory = (root: HTMLElement, opts: { motion: boolean }): HomeStory => {
    const q = <T extends Element = HTMLElement>(sel: string) => root.querySelector(sel) as T | null;
    const qa = <T extends Element = HTMLElement>(sel: string) => Array.from(root.querySelectorAll(sel)) as T[];
    const cleanups: (() => void)[] = [];

    // The layout's <main id="main-scroll-container"> only scrolls on some
    // screens; on the homepage the window does. Use whichever actually scrolls.
    const container = document.getElementById('main-scroll-container');
    const scroller: Element | Window = container && container.scrollHeight > container.clientHeight + 1 ? container : window;
    const scrollTop = () => (scroller === window ? window.scrollY : (scroller as Element).scrollTop);
    const maxScroll = () => (scroller === window ? document.documentElement.scrollHeight - window.innerHeight : (scroller as Element).scrollHeight - (scroller as Element).clientHeight);

    // Nav state + reading progress (cheap, runs even without motion).
    const nav = q('.h-nav');
    const bar = q('.h-progress span');
    const onScroll = () => {
        const y = scrollTop();
        nav?.classList.toggle('is-scrolled', y > 24);
        if (bar) bar.style.transform = `scaleX(${Math.min(1, y / Math.max(1, maxScroll()))})`;
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    cleanups.push(() => scroller.removeEventListener('scroll', onScroll));

    if (!opts.motion) {
        return {
            playHeroEntrance: () => {},
            refresh: () => {},
            destroy: () => cleanups.forEach(fn => fn()),
        };
    }

    if (scroller !== window) ScrollTrigger.defaults({ scroller: scroller as Element });

    let entrance: gsap.core.Timeline | null = null;
    const ctx = gsap.context(() => {
        // ── Hero entrance (plays once, after the intro or on first frame) ──
        const heroRig = q('.h-hero .h-rig');
        entrance = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } })
            .from('.h-hero .h-kicker', { y: 24, opacity: 0, duration: 0.9 }, 0)
            .from('.h-hero__title .h-word__inner', { yPercent: 115, duration: 1.1, stagger: 0.06 }, 0.08)
            .from('.h-hero__lede', { y: 26, opacity: 0, duration: 0.9 }, 0.4)
            .from('.h-hero__actions > *', { y: 22, opacity: 0, duration: 0.8, stagger: 0.08 }, 0.5)
            .from('.h-hero__proof', { y: 18, opacity: 0, duration: 0.8 }, 0.62)
            .from('.h-hero__court-wrap', { opacity: 0, scale: 0.9, y: 60, duration: 1.4 }, 0.1)
            .from(heroRig, { opacity: 0, duration: 0.4, ease: 'none' }, 0.55)
            .from('.h-scroll-cue', { opacity: 0, duration: 0.8 }, 0.9);

        // ── Live band marquee: drifts on its own, surges with scroll speed ──
        const band = q('.h-band__track');
        if (band) {
            const loop = gsap.to(band, { xPercent: -50, duration: 38, ease: 'none', repeat: -1 });
            let settle: gsap.core.Tween | null = null;
            ScrollTrigger.create({
                trigger: '.h-band',
                start: 'top bottom',
                end: 'bottom top',
                onUpdate: self => {
                    const v = self.getVelocity();
                    const boost = gsap.utils.clamp(-6, 6, v / 300);
                    loop.timeScale(1 + Math.abs(boost));
                    settle?.kill();
                    settle = gsap.to(loop, { timeScale: 1, duration: 1.2, ease: 'power2.out' });
                },
            });
        }

        const mm = gsap.matchMedia();
        mm.add(
            {
                pinned: '(min-width: 821px) and (min-height: 720px)',
                flat: '(max-width: 820px), (max-height: 719px)',
            },
            context => {
                const pinned = !!context.conditions?.pinned;
                // Entrances play while a chapter scrolls up into view, so it's
                // never an empty screen on arrival; pins only hold the story beats.
                // Keyed to the text block itself: done by the time it reaches mid-screen.
                const approach = (trigger: string) => gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger, start: 'top 95%', end: 'top 50%', scrub: 0.4 } });

                // ── Chapter 1 · The serve: the camera dives into the court and
                //    the racket launches the ball out of frame. ──────────────
                const heroTl = gsap.timeline({
                    defaults: { ease: 'none' },
                    scrollTrigger: {
                        trigger: '.h-hero',
                        start: 'top top',
                        end: pinned ? '+=70%' : 'bottom top',
                        pin: pinned ? '.h-hero__stage' : false,
                        scrub: 0.6,
                        onUpdate: self => heroRig?.classList.toggle('is-launched', self.progress > 0.04),
                    },
                });
                heroTl
                    .to('.h-hero__copy', { y: -160, opacity: 0, duration: 0.3, ease: 'power1.in' }, 0)
                    .to('.h-scroll-cue', { opacity: 0, duration: 0.1 }, 0)
                    .fromTo('.h-court', { transformPerspective: 1000, rotationX: 58, rotationZ: -18, scale: 1 }, { rotationX: 16, rotationZ: -4, scale: pinned ? 1.45 : 1.15, duration: 1 }, 0)
                    .to('.h-hero__court-wrap', { xPercent: pinned ? -38 : 0, yPercent: pinned ? -30 : 0, duration: 1 }, 0)
                    .to('.h-hero__grid', { opacity: 0.04, duration: 0.8 }, 0)
                    .to('.h-hero .h-rig__racket', { rotation: 62, x: 240, y: -160, opacity: 0, duration: 0.35, ease: 'power2.in' }, 0.04)
                    .to('.h-hero .h-rig__ball', { x: () => window.innerWidth * 0.25, y: () => -window.innerHeight * 1.1, rotation: 900, duration: 0.42, ease: 'power2.in' }, 0.05);

                // ── Chapter 2 · The idea: the statement lights up word by word ──
                const manifestoTl = gsap.timeline({
                    defaults: { ease: 'none' },
                    scrollTrigger: {
                        trigger: '.h-manifesto',
                        start: pinned ? 'top top' : 'top 80%',
                        end: pinned ? '+=100%' : 'bottom 60%',
                        pin: pinned,
                        scrub: 0.5,
                    },
                });
                manifestoTl
                    .from('.h-manifesto .h-eyebrow', { opacity: 0, y: 20, duration: 0.1 }, 0)
                    .fromTo('.h-manifesto .h-scrub .h-word__inner', { opacity: 0.28 }, { opacity: 1, duration: 0.08, stagger: 0.06 }, 0)
                    .from('.h-manifesto__copy', { opacity: 0, y: 40, duration: 0.2 }, 0.4)
                    .fromTo('.h-manifesto__rings', { rotation: -30, scale: 0.8 }, { rotation: 60, scale: 1.1, duration: 1 }, 0);

                // ── Chapter 3 · The journey: horizontal ride through the features ──
                const track = q('.h-features__track');
                const stage = q('.h-features__stage');
                if (pinned && track && stage) {
                    const distance = () => Math.max(0, track.scrollWidth - stage.clientWidth);
                    const ride = gsap.to(track, {
                        x: () => -distance(),
                        ease: 'none',
                        scrollTrigger: {
                            trigger: '.h-features',
                            start: 'top top',
                            end: () => `+=${distance()}`,
                            pin: true,
                            scrub: 0.8,
                            invalidateOnRefresh: true,
                        },
                    });
                    gsap.fromTo('.h-features__rail-fill', { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: '.h-features', start: 'top top', end: () => `+=${distance()}`, scrub: 0.8, invalidateOnRefresh: true } });
                    gsap.fromTo('.h-features__rail-ball', { left: '0%' }, { left: '100%', ease: 'none', scrollTrigger: { trigger: '.h-features', start: 'top top', end: () => `+=${distance()}`, scrub: 0.8, invalidateOnRefresh: true } });
                    qa('.h-features .h-feature.h-card').forEach(card => {
                        gsap.fromTo(card, { scale: 0.88, opacity: 0.35, rotationY: -12 }, {
                            scale: 1, opacity: 1, rotationY: 0, ease: 'none',
                            scrollTrigger: { trigger: card, containerAnimation: ride, start: 'left 95%', end: 'left 50%', scrub: true },
                        });
                        const art = card.querySelector('.h-art');
                        if (art) gsap.from(art.children, { y: 24, opacity: 0, stagger: 0.06, ease: 'none', scrollTrigger: { trigger: card, containerAnimation: ride, start: 'left 80%', end: 'left 45%', scrub: true } });
                    });
                } else {
                    qa('.h-features .h-feature').forEach(card => {
                        gsap.from(card, { y: 50, opacity: 0, duration: 0.9, ease: 'expo.out', scrollTrigger: { trigger: card, start: 'top 88%', toggleActions: 'play none none reverse' } });
                    });
                }

                // ── Chapter 4 · The ranking ──────────────────────────────────
                gsap.timeline({ scrollTrigger: { trigger: '.h-rankings .h-heading', start: 'top 95%', end: 'top 45%', scrub: 0.4 } })
                    .from('.h-rankings .h-heading .h-line', { yPercent: 60, opacity: 0, stagger: 0.12, ease: 'none' }, 0)
                    .from('.h-rankings .h-heading > p', { opacity: 0, x: 40, ease: 'none' }, 0.1)
                    .from('.h-board', { y: 90, scale: 0.94, opacity: 0, rotationX: 8, transformPerspective: 1200, ease: 'none' }, 0.1);
                ScrollTrigger.create({ trigger: '.h-board', start: 'top 70%', onEnter: () => q('.h-board')?.classList.add('is-in') });

                // ── Chapter 5 · The tournament: the bracket plays out ─────────
                const steps = qa('.h-step');
                const setStep = (p: number) => {
                    const active = Math.min(steps.length - 1, Math.floor(p * steps.length));
                    steps.forEach((s, i) => {
                        s.classList.toggle('is-active', i === active);
                        s.classList.toggle('is-done', i < active);
                    });
                };
                const wires = qa<SVGPathElement>('.h-bracket__wires path');
                wires.forEach(w => {
                    const len = w.getTotalLength();
                    gsap.set(w, { strokeDasharray: len, strokeDashoffset: len });
                });
                const sf = q('.h-match[data-round="sf"]');
                const fin = q('.h-match[data-round="f"]');
                const tourTl = gsap.timeline({
                    defaults: { ease: 'none' },
                    scrollTrigger: {
                        trigger: '.h-tournament__stage',
                        start: pinned ? 'top top' : 'top 60%',
                        end: pinned ? '+=110%' : 'bottom 40%',
                        pin: pinned,
                        scrub: 0.6,
                        onUpdate: self => {
                            setStep(self.progress);
                            sf?.classList.toggle('is-on', self.progress > 0.3);
                            fin?.classList.toggle('is-on', self.progress > 0.68);
                        },
                    },
                });
                approach('.h-tournament__copy')
                    .from('.h-tournament__copy .h-line', { yPercent: 60, opacity: 0, stagger: 0.08 }, 0)
                    .from('.h-tournament__copy > p, .h-steps', { opacity: 0, y: 30 }, 0.15)
                    .from('.h-bracket', { x: 80, opacity: 0 }, 0)
                    .from('.h-match[data-round="qf"]', { x: -30, opacity: 0, stagger: 0.1 }, 0.25);
                tourTl
                    .to(wires.slice(0, 2), { strokeDashoffset: 0, duration: 0.22, stagger: 0.03 }, 0.05)
                    .from(sf, { scale: 0.9, opacity: 0.3, duration: 0.15 }, 0.25)
                    .to(wires.slice(2), { strokeDashoffset: 0, duration: 0.2 }, 0.45)
                    .from(fin, { scale: 0.9, opacity: 0.3, duration: 0.15 }, 0.62)
                    .to({}, { duration: 0.2 }, 0.8);
                ScrollTrigger.create({ trigger: '.h-upcoming__grid', start: 'top 88%', onEnter: () => q('.h-upcoming__grid')?.classList.add('is-in') });
                // Banner artwork drifts inside its frame (cards render once data arrives, so match lazily).
                gsap.fromTo('.h-upcoming__grid', { '--banner-shift': '-6%' } as gsap.TweenVars, {
                    '--banner-shift': '6%', ease: 'none',
                    scrollTrigger: { trigger: '.h-upcoming', start: 'top bottom', end: 'bottom top', scrub: true },
                } as gsap.TweenVars);

                // ── Chapter 6 · The momentum: numbers climb with the scroll ──
                const counters = qa('.h-count');
                const counterState = { p: 0 };
                const paintCounters = () => counters.forEach(el => {
                    const target = Number(el.dataset.count) || 0;
                    el.textContent = `${el.dataset.prefix || ''}${fmt(target * counterState.p)}${el.dataset.suffix || ''}`;
                });
                const momentumTl = gsap.timeline({
                    defaults: { ease: 'none' },
                    scrollTrigger: {
                        trigger: '.h-momentum',
                        start: pinned ? 'top top' : 'top 60%',
                        end: pinned ? '+=80%' : 'bottom 50%',
                        pin: pinned ? '.h-momentum__stage' : false,
                        scrub: 0.6,
                    },
                });
                approach('.h-momentum__grid')
                    .from('.h-momentum__copy .h-line', { yPercent: 60, opacity: 0, stagger: 0.08 }, 0)
                    .from('.h-momentum__copy > p, .h-momentum__copy .h-link', { opacity: 0, y: 30 }, 0.15)
                    .from('.h-metric', { y: 120, opacity: 0, rotationX: -20, transformPerspective: 900, stagger: 0.08 }, 0.05);
                momentumTl
                    .fromTo('.h-momentum__word', { xPercent: 5 }, { xPercent: -45, duration: 1 }, 0)
                    .to(counterState, { p: 1, duration: 0.6, onUpdate: paintCounters }, 0);
                paintCounters();
                ScrollTrigger.create({ trigger: '.h-metrics', start: 'top 80%', onEnter: () => q('.h-metrics')?.classList.add('is-in') });
                // Live numbers arrive after setup: repaint when the data attributes change.
                const counterObserver = new MutationObserver(paintCounters);
                counters.forEach(el => counterObserver.observe(el, { attributes: true, attributeFilter: ['data-count'] }));

                // ── Chapter 7 · The people: highlight opens, quotes stack up ──
                const community = q('.h-community');
                const quotes = qa('.h-quote');
                if (pinned) {
                    community?.classList.add('is-pinned');
                    approach('.h-community .h-heading')
                        .from('.h-community .h-heading .h-line', { yPercent: 60, opacity: 0, stagger: 0.08 }, 0)
                        .from('.h-community .h-heading > p', { opacity: 0, x: 40 }, 0.1)
                        .from('.h-reel', { y: 80, opacity: 0, rotation: (i: number) => (i ? 4 : -4), stagger: 0.12 }, 0.1)
                        .from(quotes[0], { yPercent: 40, opacity: 0 }, 0.25);
                    const peopleTl = gsap.timeline({
                        defaults: { ease: 'none' },
                        scrollTrigger: { trigger: '.h-community', start: 'top top', end: '+=120%', pin: '.h-community__stage', scrub: 0.6 },
                    });
                    // Each next card slides up onto the pile; the one beneath sinks back.
                    quotes.slice(1).forEach((card, k) => {
                        const at = 0.05 + k * 0.45;
                        peopleTl
                            .from(card, { yPercent: 140, rotation: 5, opacity: 0, duration: 0.24 }, at)
                            .to(quotes.slice(0, k + 1), { scale: (j: number) => 0.94 - (k - j) * 0.03, filter: 'brightness(.62)', duration: 0.24 }, at);
                    });
                } else {
                    gsap.timeline({ scrollTrigger: { trigger: '.h-community', start: 'top 80%', end: 'top 20%', scrub: 0.6 } })
                        .from('.h-community .h-heading .h-line', { yPercent: 60, opacity: 0, stagger: 0.1, ease: 'none' }, 0)
                        .from('.h-community .h-heading > p', { opacity: 0, x: 40, ease: 'none' }, 0.1)
                        .from('.h-reel', { y: 80, opacity: 0, stagger: 0.12, ease: 'none' }, 0.1);
                    quotes.forEach(card => gsap.from(card, { y: 60, opacity: 0, duration: 0.9, ease: 'expo.out', scrollTrigger: { trigger: card, start: 'top 92%', toggleActions: 'play none none reverse' } }));
                }

                // ── Chapter 8 · In your pocket: the phone rises, the screen builds ──
                gsap.timeline({
                    defaults: { ease: 'none' },
                    scrollTrigger: {
                        trigger: '.h-app',
                        start: 'top 85%',
                        end: pinned ? 'center 40%' : 'bottom 60%',
                        scrub: 0.6,
                    },
                })
                    .fromTo('.h-phone', { y: 260, rotationY: 28, rotationZ: -10, scale: 0.82, transformPerspective: 1200 }, { y: 0, rotationY: -6, rotationZ: -2, scale: 1, duration: 0.6 }, 0)
                    .from('.h-phone__screen > *', { y: 30, opacity: 0, stagger: 0.06, duration: 0.2 }, 0.3)
                    .from('.h-chip--rank', { x: -120, opacity: 0, duration: 0.25 }, 0.4)
                    .from('.h-chip--live', { x: 120, y: -40, opacity: 0, duration: 0.25 }, 0.48)
                    .from('.h-chip--next', { x: 120, opacity: 0, duration: 0.25 }, 0.56)
                    .from('.h-app__copy .h-line', { yPercent: 60, opacity: 0, stagger: 0.05, duration: 0.2 }, 0.1)
                    .from('.h-app__copy > p, .h-app__stores', { opacity: 0, y: 30, duration: 0.2 }, 0.25)
                    .to('.h-chip--rank', { y: -40, duration: 0.4 }, 0.6)
                    .to('.h-chip--next', { y: 40, duration: 0.4 }, 0.6);

                // ── Chapter 9 · Your move: the ball drops back onto the racket ──
                const finalRig = q('.h-rig--final');
                finalRig?.classList.add('is-launched');
                gsap.timeline({
                    defaults: { ease: 'none' },
                    scrollTrigger: {
                        trigger: '.h-final',
                        start: 'top 85%',
                        end: 'center 55%',
                        scrub: 0.6,
                        onUpdate: self => finalRig?.classList.toggle('is-launched', self.progress < 0.97),
                    },
                })
                    .from('.h-final__glow', { scale: 0.5, opacity: 0, duration: 1 }, 0)
                    .from('.h-final__logo, .h-final .h-eyebrow', { y: 30, opacity: 0, duration: 0.3 }, 0.1)
                    .from('.h-final .h-line', { yPercent: 70, opacity: 0, scale: 0.92, stagger: 0.08, duration: 0.4 }, 0.15)
                    .from('.h-final__content > p, .h-final__content .h-btn', { y: 30, opacity: 0, stagger: 0.06, duration: 0.3 }, 0.4)
                    .from('.h-rig--final .h-rig__racket', { x: 280, rotation: 70, opacity: 0, duration: 0.45, ease: 'power2.out' }, 0.25)
                    .from('.h-rig--final .h-rig__ball', { y: () => -window.innerHeight * 0.9, x: -120, rotation: -720, duration: 0.6, ease: 'bounce.out' }, 0.38);

                // ── Footer wordmark slides in ──
                gsap.fromTo('.h-footer__word', { yPercent: 40, opacity: 0.2 }, { yPercent: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: '.h-footer', start: 'top bottom', end: 'bottom bottom', scrub: 0.6 } });

                return () => {
                    community?.classList.remove('is-pinned');
                    counterObserver.disconnect();
                    heroRig?.classList.remove('is-launched');
                };
            },
        );

        // ── Pointer effects (desktop only) ───────────────────────────────
        if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
            const heroBg = q('.h-hero__bg');
            // The court itself (its wrapper is owned by the entrance + scroll timelines).
            const courtX = gsap.quickTo('.h-court', 'x', { duration: 1.2, ease: 'power3.out' });
            const courtY = gsap.quickTo('.h-court', 'y', { duration: 1.2, ease: 'power3.out' });
            const onMove = (e: PointerEvent) => {
                const nx = e.clientX / window.innerWidth - 0.5;
                const ny = e.clientY / window.innerHeight - 0.5;
                if (scrollTop() < window.innerHeight) {
                    courtX(nx * -30);
                    courtY(ny * -20);
                    heroBg?.style.setProperty('--px', `${(nx + 0.5) * 100}%`);
                    heroBg?.style.setProperty('--py', `${(ny + 0.5) * 100}%`);
                }
                // Spotlight follows the cursor inside cards.
                const card = (e.target as Element)?.closest?.('.h-card') as HTMLElement | null;
                if (card) {
                    const r = card.getBoundingClientRect();
                    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
                    card.style.setProperty('--my', `${e.clientY - r.top}px`);
                }
            };
            window.addEventListener('pointermove', onMove, { passive: true });
            cleanups.push(() => window.removeEventListener('pointermove', onMove));

            // Magnetic CTAs lean towards the cursor.
            qa('.h-magnetic').forEach(btn => {
                const mx = gsap.quickTo(btn, 'x', { duration: 0.5, ease: 'power3.out' });
                const my = gsap.quickTo(btn, 'y', { duration: 0.5, ease: 'power3.out' });
                const move = (e: PointerEvent) => {
                    const r = btn.getBoundingClientRect();
                    mx((e.clientX - (r.left + r.width / 2)) * 0.25);
                    my((e.clientY - (r.top + r.height / 2)) * 0.35);
                };
                const leave = () => { mx(0); my(0); };
                btn.addEventListener('pointermove', move);
                btn.addEventListener('pointerleave', leave);
                cleanups.push(() => { btn.removeEventListener('pointermove', move); btn.removeEventListener('pointerleave', leave); });
            });
        }
    }, root);

    // Fonts/images settling change heights; re-measure once things load.
    const onLoad = () => ScrollTrigger.refresh();
    window.addEventListener('load', onLoad);
    cleanups.push(() => window.removeEventListener('load', onLoad));
    let refreshTimer = 0;

    return {
        playHeroEntrance: () => entrance?.play(),
        refresh: () => {
            window.clearTimeout(refreshTimer);
            refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 120);
        },
        destroy: () => {
            window.clearTimeout(refreshTimer);
            cleanups.forEach(fn => fn());
            ctx.revert();
        },
    };
};
