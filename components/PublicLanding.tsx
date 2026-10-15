import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './landing/home.css';
import { usePlatformStats, AnimatedCounter } from './PublicLandingStats';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useTournaments } from '../hooks/useTournaments';
import { MatchupLogo } from './MatchupLogo';
import { MobilePillMenu } from './MobilePillMenu';
import { PadelIntro } from './landing/PadelIntro';
import { PadelBall, PadelRacket } from './landing/PadelGear';
import { setupHomeStory } from './landing/homeStory';

// Homepage, told as a story in chapters: each chapter pins while scrolling
// scrubs through it (see landing/homeStory.ts). Copy, links and live data are
// Match Up's own; markup here is the finished state, motion only adds the
// "before" states, so the page always reads correctly without animation.

const prefersReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// The splash → strike transition plays once per page load (every refresh),
// not when navigating back to the homepage inside the app.
let introPlayedThisLoad = false;

const Words: React.FC<{ text: string; className?: string }> = ({ text, className }) => (
  <>
    {text.split(' ').map((w, i, all) => (
      // The space sits outside the inline-block: trailing spaces inside one collapse.
      <React.Fragment key={i}><span className={`h-word ${className || ''}`}><span className="h-word__inner">{w}</span></span>{i < all.length - 1 ? ' ' : ''}</React.Fragment>
    ))}
  </>
);

const FEATURES = [
  { n: '01', icon: '◉', eyebrow: 'Live engine', title: 'Live scoring', copy: 'Broadcast-ready score updates engineered for courts, organizers, and fans.', href: '#platform', art: 'score' },
  { n: '02', icon: '♛', eyebrow: 'Competitive layer', title: 'Leaderboards', copy: 'A clear, dynamic view of player form, movement, points, and national standing.', href: '#rankings', art: 'bars' },
  { n: '03', icon: '▦', eyebrow: 'Operations', title: 'Tournament management', copy: 'Registration, scheduling, brackets, results, and communication in one flow.', href: '#tournaments', art: 'bracket' },
  { n: '04', icon: '◎', eyebrow: 'Identity', title: 'Player profiles', copy: 'Performance, achievements, history, and competitive identity in one place.', href: '#platform', art: 'profile' },
] as const;

const TESTIMONIALS = [
  { quote: '“MatchUp made the tournament feel professional from registration to the final point.”', name: 'Areeb Malik', role: 'Competitive player', initials: 'AM' },
  { quote: '“We spend less time managing spreadsheets and more time creating a great event.”', name: 'Maha Qazi', role: 'Tournament organizer', initials: 'MQ' },
  { quote: '“Seeing my ranking move after every match changes how seriously I approach the game.”', name: 'Omer Shah', role: 'Ranked player', initials: 'OS' },
];

type BannerTournament = ReturnType<typeof useTournaments>['upcomingTournaments'][number] & { state: string };

/** Big, poster-style tournament banner (the event's own artwork leads). */
const TournamentBanner: React.FC<{ t: BannerTournament; featured?: boolean; onOpen: () => void }> = ({ t, featured, onOpen }) => {
  const start = new Date(t.date);
  const end = t.endDate ? new Date(t.endDate) : null;
  const now = Date.now();
  const completed = t.state === 'Completed';
  const live = !completed && start.getTime() <= now && (!end || end.getTime() >= now);
  const status = completed ? 'Completed' : live ? 'Live now' : 'Open for registration';
  const fill = t.maxTeams ? Math.min(100, Math.round(((t.teamCount || 0) / t.maxTeams) * 100)) : 0;
  const initials = t.name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <button type="button" className={`h-banner h-card ${featured ? 'h-banner--featured' : ''}`} onClick={onOpen}>
      <span className="h-banner__media" aria-hidden="true">
        {t.bannerUrl
          ? <img className="h-banner__img" src={t.bannerUrl} alt="" loading="lazy" decoding="async" />
          : <span className="h-banner__art"><span className="h-banner__art-court" /><span className="h-banner__art-mono">{initials}</span></span>}
      </span>
      <span className="h-banner__shade" aria-hidden="true" />
      <span className="h-banner__top">
        <span className={`h-banner__status ${live ? 'is-live' : completed ? 'is-done' : ''}`}>{live && <span className="h-dot" />}{status}</span>
        <span className="h-banner__org">
          {t.organizerLogo ? <img src={t.organizerLogo} alt="" /> : <span className="h-banner__org-fallback">{(t.organizer || 'M')[0]}</span>}
          {t.organizer || 'Matchup'}
        </span>
      </span>
      <span className="h-banner__date"><strong>{start.getDate()}</strong><span>{start.toLocaleDateString('en-US', { month: 'short' })}</span></span>
      <span className="h-banner__body">
        <span className="h-banner__name">{t.name}</span>
        <span className="h-banner__meta">
          <span>⌖ {t.venue || 'TBA'}</span>
          {!!t.prizeMoney && <span className="h-banner__prize">🏆 {t.currency === 'USD' ? '$' : 'Rs'} {t.prizeMoney.toLocaleString()}</span>}
        </span>
        {!completed && !!t.maxTeams && (t.teamCount || 0) <= t.maxTeams && (
          <span className="h-banner__cap"><span className="h-banner__cap-bar"><i style={{ width: `${Math.max(fill, 4)}%` }} /></span><small>{t.teamCount || 0}/{t.maxTeams} teams</small></span>
        )}
      </span>
      <span className="h-banner__go" aria-hidden="true">→</span>
    </button>
  );
};

const INSTAGRAM_URL = 'https://www.instagram.com/matchupsport/';
const REELS = [
  { src: '/reels/karachi-vs-lahore.mp4', caption: 'It’s Karachi VS Lahore time at @maidan_pakistan… Matchup capturing each shot in Copa De Padel.', tag: 'Copa De Padel' },
  { src: '/reels/fip-promises-live.mp4', caption: 'FIP Promises, but make it LIVE. 🎾⚡️ Every point. Every game. Every moment, tracked live by Matchup.', tag: 'FIP Promises' },
];

/** Instagram reel: plays muted only while on screen, tap to hear it. */
const Reel: React.FC<{ src: string; caption: string; tag: string; autoplay: boolean }> = ({ src, caption, tag, autoplay }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !autoplay || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      else { v.pause(); setPlaying(false); }
    }, { threshold: 0.35 });
    io.observe(v);
    return () => io.disconnect();
  }, [autoplay]);

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (v.paused) v.play().then(() => setPlaying(true)).catch(() => {});
  };
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().then(() => setPlaying(true)).catch(() => {});
    else { v.pause(); setPlaying(false); }
  };

  return (
    <figure className="h-reel h-card">
      <video ref={videoRef} className="h-reel__video" src={`${src}#t=0.1`} muted playsInline loop preload="metadata" onClick={togglePlay} aria-label={caption} />
      {!playing && <button type="button" className="h-reel__play" onClick={togglePlay} aria-label="Play reel">▶</button>}
      <div className="h-reel__top">
        <a className="h-reel__handle" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer"><span className="h-reel__ig" aria-hidden="true" />@matchupsport</a>
        <button type="button" className="h-reel__sound" onClick={toggleSound} aria-label={muted ? 'Unmute reel' : 'Mute reel'}>{muted ? '🔇' : '🔊'}</button>
      </div>
      <figcaption className="h-reel__caption"><span className="h-reel__tag">{tag}</span>{caption}</figcaption>
    </figure>
  );
};

const FeatureArt: React.FC<{ kind: string }> = ({ kind }) => {
  if (kind === 'score') return (
    <div className="h-art h-art--score">
      <div className="h-art__live"><span className="h-dot" /> Live · Center Court</div>
      <div className="h-art__row"><span>Tariq / Qureshi</span><b>6</b><b>4</b><em>40</em></div>
      <div className="h-art__row"><span>Raza / Khan</span><b>4</b><b>3</b><em>15</em></div>
    </div>
  );
  if (kind === 'bars') return (
    <div className="h-art h-art--bars">
      {[62, 88, 48, 100, 74].map((h, i) => <span key={i} style={{ '--h': `${h}%` } as React.CSSProperties}><i>{['04', '02', '05', '01', '03'][i]}</i></span>)}
    </div>
  );
  if (kind === 'bracket') return (
    <div className="h-art h-art--bracket">
      <div className="h-art__col"><span className="is-win">QF 1</span><span>QF 2</span><span className="is-win">QF 3</span><span>QF 4</span></div>
      <div className="h-art__col"><span className="is-win">SF 1</span><span>SF 2</span></div>
      <div className="h-art__col"><span className="is-final">Final</span></div>
    </div>
  );
  return (
    <div className="h-art h-art--profile">
      <div className="h-art__avatar">MU</div>
      <div><strong>Player profile</strong><small>⌖ National · #04</small></div>
      <div className="h-art__stats"><span><b>68%</b>Win rate</span><span><b>142</b>Matches</span><span><b>12</b>Titles</span></div>
    </div>
  );
};

export const PublicLanding: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const stats = usePlatformStats();
  const { leaderboard } = useLeaderboard();
  const { upcomingTournaments, completedTournaments } = useTournaments();

  const [motionOk] = useState(() => !prefersReducedMotion());
  const [introActive, setIntroActive] = useState(() => motionOk && !introPlayedThisLoad);
  const [heroIn, setHeroIn] = useState(false);
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('All cities');
  const rootRef = useRef<HTMLDivElement>(null);
  const storyRef = useRef<ReturnType<typeof setupHomeStory> | null>(null);

  // Build the story before first paint so nothing flashes in its final state.
  useLayoutEffect(() => {
    if (!rootRef.current) return;
    const story = setupHomeStory(rootRef.current, { motion: motionOk });
    storyRef.current = story;
    return () => { story.destroy(); storyRef.current = null; };
  }, [motionOk]);

  useEffect(() => {
    if (!introActive) {
      const id = requestAnimationFrame(() => setHeroIn(true));
      return () => cancelAnimationFrame(id);
    }
  }, [introActive]);

  useEffect(() => { if (heroIn) storyRef.current?.playHeroEntrance(); }, [heroIn]);

  // Live data changes section heights: let pinned chapters re-measure.
  useEffect(() => { storyRef.current?.refresh(); }, [leaderboard.length, upcomingTournaments.length, completedTournaments.length]);

  const finishIntro = () => {
    introPlayedThisLoad = true;
    setHeroIn(true);
    setIntroActive(false);
  };

  const getHeroPose = () => {
    const el = rootRef.current?.querySelector('.h-hero .h-rig__ball .mu-ball') as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { ball: { x: r.left + r.width / 2, y: r.top + r.height / 2, scale: r.width / 56 }, racket: null };
  };

  const searching = query.trim().length > 0;
  const rows = useMemo(() => {
    const q = query.toLowerCase().trim();
    return leaderboard.slice(0, 8).map((p, i) => ({ ...p, rank: i + 1 })).filter(p => !q || p.name.toLowerCase().includes(q));
  }, [leaderboard, query]);
  // Podium for the top three (when not searching), the rest as a list.
  const podium = searching ? [] : rows.slice(0, 3);
  const listRows = searching ? rows : rows.slice(3);
  const pts = (p: { points: number; wins: number }) => p.points || p.wins * 10;

  const tournamentCards = [
    ...upcomingTournaments.slice(0, 3).map(t => ({ ...t, state: 'Open for Registration' })),
    ...(upcomingTournaments.length < 2 ? completedTournaments.slice(0, 3 - upcomingTournaments.length).map(t => ({ ...t, state: 'Completed' })) : []),
  ];

  // Sign-up CTAs open the auth screen on "Create account"; "Log in" opens "Sign in".
  const goSignup = () => {
    try { sessionStorage.setItem('mu_auth_intent', 'signup'); } catch { /* private mode */ }
    onNavigate('auth-player');
  };

  const scrollTo = (e: React.MouseEvent, id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: motionOk ? 'smooth' : 'auto', block: 'start' });
  };

  return (
    <div ref={rootRef} className={['home', motionOk && 'home--motion', heroIn && 'home--hero-in'].filter(Boolean).join(' ')}>
      {introActive && <PadelIntro getHeroPose={getHeroPose} onReveal={() => setHeroIn(true)} onDone={finishIntro} />}

      <div className="h-noise" aria-hidden="true" />
      <div className="h-progress" aria-hidden="true"><span /></div>

      <nav className="h-nav">
        <a className="h-nav__logo" href="#top" onClick={e => scrollTo(e, 'top')} aria-label="Match Up home"><MatchupLogo className="h-6 w-auto" /></a>
        <div className="h-nav__links">
          <a href="#rankings" onClick={e => scrollTo(e, 'rankings')}>Rankings</a>
          <a href="#tournaments" onClick={e => scrollTo(e, 'tournaments')}>Tournaments</a>
          <a href="#clubs" onClick={e => scrollTo(e, 'clubs')}>Clubs</a>
          <a href="#community" onClick={e => scrollTo(e, 'community')}>Community</a>
          <button type="button" onClick={() => onNavigate('live')}>Spectator Mode</button>
        </div>
        <div className="h-nav__actions">
          <button type="button" className="h-nav__login" onClick={() => onNavigate('auth-player')}>Log in</button>
          <button type="button" className="h-btn h-btn--primary h-btn--sm" onClick={() => goSignup()}>Start playing →</button>
        </div>
        <div className="h-nav__mobile">
          <MobilePillMenu items={[
            { label: 'Rankings', href: '#rankings' },
            { label: 'Tournaments', href: '#tournaments' },
            { label: 'Clubs', href: '#clubs' },
            { label: 'Community', href: '#community' },
            { label: 'Spectator Mode', onClick: () => onNavigate('live') },
            { label: 'Log In', onClick: () => onNavigate('auth-player') },
            { label: 'Play Now', onClick: () => goSignup() },
          ]} />
        </div>
      </nav>

      <main>
        {/* ── Chapter 1 · The serve ─────────────────────────────────────── */}
        <section className="h-hero" id="top">
          <div className="h-hero__stage">
            <div className="h-hero__bg" aria-hidden="true" />
            <div className="h-hero__grid" aria-hidden="true" />
            <div className="h-hero__court-wrap" aria-hidden="true">
              <div className="h-court">
                <span className="h-court__line h-court__line--outer" />
                <span className="h-court__line h-court__line--mid" />
                <span className="h-court__line h-court__line--sl" />
                <span className="h-court__line h-court__line--sr" />
                <span className="h-court__net" />
                <span className="h-court__player h-court__player--1" />
                <span className="h-court__player h-court__player--2" />
                <span className="h-court__player h-court__player--3" />
                <span className="h-court__player h-court__player--4" />
                <span className="h-court__bounce" />
                <span className="h-court__rally"><span className="h-court__ball" /></span>
              </div>
            </div>
            <div className="h-rig" aria-hidden="true">
              <div className="h-rig__racket"><div className="h-rig__kick"><PadelRacket /></div></div>
              <div className="h-rig__ball"><div className="h-rig__bob"><PadelBall /></div></div>
            </div>

            <div className="h-hero__copy h-container">
              <p className="h-kicker"><span className="h-dot" /> Pakistan's competitive padel operating system</p>
              <h1 className="h-hero__title">
                <span className="h-line"><Words text="Where competition" /></span>
                <span className="h-line h-accent"><Words text="meets technology." /></span>
              </h1>
              <p className="h-hero__lede">Track matches, climb leaderboards, organize tournaments, and elevate your game.</p>
              <div className="h-hero__actions">
                <button type="button" className="h-btn h-btn--primary h-magnetic" onClick={goSignup}>Start playing →</button>
                <button type="button" className="h-btn h-btn--ghost" onClick={() => onNavigate('live')}>Spectator mode ›</button>
              </div>
              <div className="h-hero__proof">
                <div className="h-avatars"><span>HT</span><span>SQ</span><span>AR</span><span>+2K</span></div>
                <p><strong>Built for players.</strong><br />Trusted by clubs and organizers.</p>
              </div>
            </div>
            <a className="h-scroll-cue" href="#platform" onClick={e => scrollTo(e, 'platform')}><span>Scroll to explore</span><b>↓</b></a>
          </div>
        </section>

        {/* ── Live band ──────────────────────────────────────────────────── */}
        <section className="h-band" aria-label="Platform live">
          <div className="h-band__track">
            {[0, 1].map(k => (
              <div className="h-band__set" key={k} aria-hidden={k === 1}>
                <span className="h-band__label"><span className="h-dot" /> Platform live</span>
                <span className="h-band__stat"><AnimatedCounter value={stats.activePlayers} format /> <small>Active players</small></span>
                <span className="h-band__sep">✦</span>
                <span className="h-band__stat"><AnimatedCounter value={stats.matchesLive} format /> <small>Matches live</small></span>
                <span className="h-band__sep">✦</span>
                <span className="h-band__stat"><AnimatedCounter value={stats.tournamentsHosted} format /> <small>Tournaments hosted</small></span>
                <span className="h-band__sep">✦</span>
                <span className="h-band__stat"><AnimatedCounter value={stats.totalMatchesPlayed} format /> <small>Matches organized</small></span>
                <span className="h-band__sep">✦</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Chapter 2 · The idea ───────────────────────────────────────── */}
        <section className="h-manifesto" id="platform">
          <div className="h-manifesto__stage h-container">
            <div className="h-manifesto__rings" aria-hidden="true"><span /><span /><span /></div>
            <p className="h-eyebrow">✦ One connected platform</p>
            <h2 className="h-manifesto__title">
              <span className="h-line"><Words text="One platform." className="h-scrub" /></span>
              <span className="h-line h-accent"><Words text="Every point." className="h-scrub" /></span>
            </h2>
            <p className="h-manifesto__copy">MatchUp connects players, clubs, scores, tournaments, rankings, and community into one high-performance system built for the pace of modern padel.</p>
          </div>
        </section>

        {/* ── Chapter 3 · The journey ────────────────────────────────────── */}
        <section className="h-features" aria-label="Built to compete">
          <div className="h-features__stage">
            <div className="h-features__track">
              <article className="h-feature h-feature--intro">
                <p className="h-eyebrow h-eyebrow--dark">Built to compete</p>
                <h3>From first serve<br />to final ranking.</h3>
                <p className="h-feature__hint">Scroll to follow the rally →</p>
              </article>
              {FEATURES.map(f => (
                <article className="h-feature h-card" key={f.n}>
                  <div className="h-feature__top"><span className="h-feature__n">{f.n}</span><span className="h-feature__icon">{f.icon}</span></div>
                  <FeatureArt kind={f.art} />
                  <div className="h-feature__body">
                    <p className="h-feature__eyebrow">{f.eyebrow}</p>
                    <h3>{f.title}</h3>
                    <p>{f.copy}</p>
                    <a href={f.href} onClick={e => scrollTo(e, f.href.slice(1))}>Explore feature →</a>
                  </div>
                </article>
              ))}
            </div>
            <div className="h-features__rail" aria-hidden="true">
              <span className="h-features__rail-fill" />
              <span className="h-features__rail-ball" />
              {FEATURES.map((f, i) => <span key={f.n} className="h-features__stop" style={{ left: `${((i + 1) / FEATURES.length) * 100}%` }}>{f.n}</span>)}
            </div>
          </div>
        </section>

        {/* ── Chapter 4 · The ranking ────────────────────────────────────── */}
        <section className="h-rankings" id="rankings">
          <div className="h-rankings__stage h-container">
            <div className="h-heading">
              <div><p className="h-eyebrow">♛ National rankings</p><h2><span className="h-line">Your game.</span><span className="h-line h-accent">Measured.</span></h2></div>
              <p>Live standings that reward consistency, performance, and the courage to keep competing.</p>
            </div>
            <div className="h-board h-card">
              <div className="h-board__head">
                <div><span className="h-badge"><span className="h-dot" /> {stats.totalMatchesPlayed} Matches Organized</span><h3>MatchUp Top Players</h3></div>
                <div className="h-board__filters">
                  <div className="h-search">⌕ <input aria-label="Search player or club" placeholder="Search player or club" value={query} onChange={e => setQuery(e.target.value)} /></div>
                  <select aria-label="City" value={city} onChange={e => setCity(e.target.value)}><option>All cities</option><option>Karachi</option><option>Lahore</option><option>Islamabad</option></select>
                </div>
              </div>
              {podium.length > 0 && (
                <div className={`h-podium h-podium--${podium.length}`}>
                  {podium.map(p => (
                    <div key={p.id} className={`h-podium__card h-podium__card--${p.rank}`}>
                      <span className="h-podium__rank">{String(p.rank).padStart(2, '0')}</span>
                      <span className="h-podium__ring" style={{ '--p': Math.round(p.gwp) } as React.CSSProperties}>
                        <span className="h-podium__avatar">{p.name.substring(0, 2).toUpperCase()}</span>
                      </span>
                      <strong className="h-podium__name">{p.name}</strong>
                      <span className="h-podium__meta">⌖ National · {p.wins}-{p.matchesPlayed - p.wins} · {Math.round(p.gwp)}% wins</span>
                      <span className="h-podium__pts"><b>{pts(p)}</b> pts</span>
                      <span className="h-podium__step" aria-hidden="true" />
                    </div>
                  ))}
                </div>
              )}
              <div className="h-board__table">
                {listRows.length > 0 && <div className="h-board__row h-board__row--head"><span>Rank</span><span>Player</span><span>Club</span><span>Win rate</span><span>Record</span><span>Points</span></div>}
                {listRows.map(player => (
                  <div key={player.id} className="h-board__row h-board__player">
                    <span className="h-board__rank"><b>{String(player.rank).padStart(2, '0')}</b></span>
                    <span className="h-board__who"><span className="h-avatar">{player.name.substring(0, 2).toUpperCase()}</span><span><strong>{player.name}</strong><small>⌖ National</small></span></span>
                    <span className="h-board__club">Matchup</span>
                    <span className="h-board__rate"><span className="h-board__rate-bar"><i style={{ width: `${Math.max(4, Math.round(player.gwp))}%` }} /></span><small>{Math.round(player.gwp)}%</small></span>
                    <span className="h-board__record"><strong>{player.wins}-{player.matchesPlayed - player.wins}</strong><small>{player.matchesPlayed} matches</small></span>
                    <span className="h-board__points"><strong>{pts(player)}</strong></span>
                  </div>
                ))}
                {rows.length === 0 && <div className="h-board__empty">{leaderboard.length ? 'No players match that search.' : 'Rankings are loading…'}</div>}
              </div>
              <div className="h-board__foot"><span>Ranking logic remains controlled by the MatchUp backend.</span><button type="button" onClick={() => onNavigate('live')}>Enter Spectator Arena →</button></div>
            </div>
          </div>
        </section>

        {/* ── Chapter 5 · The tournament ─────────────────────────────────── */}
        <section className="h-tournament" id="tournaments">
          <div className="h-tournament__stage h-container">
            <div className="h-tournament__copy">
              <p className="h-eyebrow">ϟ Tournament command center</p>
              <h2><span className="h-line">Every round.</span><span className="h-line h-accent">In real time.</span></h2>
              <p>Registration, schedules, brackets, live scores, and results organized into one cinematic tournament experience.</p>
              <ol className="h-steps">
                {['Registration', 'Schedules', 'Live scores', 'Results'].map((s, i) => <li key={s} className="h-step" data-step={i}><span>0{i + 1}</span>{s}</li>)}
              </ol>
            </div>
            <div className="h-bracket h-card">
              <div className="h-bracket__top"><span><span className="h-dot" /> Latest Tournament · Live</span><span>Center Court</span></div>
              <div className="h-bracket__grid">
                <div className="h-bracket__col">
                  <div className="h-match h-match--live" data-round="qf">
                    <div className="h-match__head"><span>Quarterfinal</span><small>7:30 PM</small></div>
                    <div className="h-match__team"><span>Tariq / Qureshi</span><strong>5</strong></div>
                    <div className="h-match__team"><span>Raza / Khan</span><strong>4</strong></div>
                    <div className="h-match__status"><span className="h-dot" /> live</div>
                  </div>
                  <div className="h-match" data-round="qf">
                    <div className="h-match__head"><span>Quarterfinal</span><small>8:15 PM</small></div>
                    <div className="h-match__team"><span>Ahmed / Siddiqui</span></div>
                    <div className="h-match__team"><span>Malik / Farooq</span></div>
                    <div className="h-match__status">scheduled</div>
                  </div>
                </div>
                <svg className="h-bracket__wires" viewBox="0 0 100 200" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M0 50 H50 V100 H100" /><path d="M0 150 H50 V100" />
                </svg>
                <div className="h-bracket__col">
                  <div className="h-match" data-round="sf">
                    <div className="h-match__head"><span>Semifinal</span><small>9:30 PM</small></div>
                    <div className="h-match__team"><span>Winner QF 1</span></div>
                    <div className="h-match__team"><span>Winner QF 2</span></div>
                    <div className="h-match__status">scheduled</div>
                  </div>
                </div>
                <svg className="h-bracket__wires" viewBox="0 0 100 200" preserveAspectRatio="none" aria-hidden="true"><path d="M0 100 H100" /></svg>
                <div className="h-bracket__col">
                  <div className="h-match h-match--final" data-round="f">
                    <div className="h-match__head"><span>Final</span><small>11:00 PM</small></div>
                    <div className="h-match__team"><span>Winner SF 1</span></div>
                    <div className="h-match__team"><span>Winner SF 2</span></div>
                    <div className="h-match__status">scheduled</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="h-container h-upcoming">
            <div className="h-upcoming__head"><div><p className="h-eyebrow">Next up</p><h3>{upcomingTournaments.length ? 'Upcoming tournaments' : 'Recent tournaments'}</h3></div><button type="button" onClick={() => onNavigate('auth-player')}>View all</button></div>
            <div className={`h-upcoming__grid h-upcoming__grid--${Math.min(tournamentCards.length, 3)}`}>
              {tournamentCards.map((t, i) => (
                <TournamentBanner key={t.id} t={t} featured={i === 0 && tournamentCards.length > 1} onOpen={() => onNavigate('auth-player')} />
              ))}
            </div>
          </div>
        </section>

        {/* ── Chapter 6 · The momentum ───────────────────────────────────── */}
        <section className="h-momentum" id="clubs">
          <div className="h-momentum__stage">
            <div className="h-momentum__word" aria-hidden="true">Momentum · Momentum · Momentum ·</div>
            <div className="h-container h-momentum__grid">
              <div className="h-momentum__copy">
                <p className="h-eyebrow">◴ Network performance</p>
                <h2><span className="h-line">The momentum</span><span className="h-line h-accent">is measurable.</span></h2>
                <p>Every match makes the network smarter, the rankings sharper, and the community stronger.</p>
                <button type="button" className="h-link" onClick={() => onNavigate('auth-admin')}>Explore clubs →</button>
              </div>
              <div className="h-metrics">
                <div className="h-metric h-metric--hero h-card">
                  <div className="h-metric__head"><span className="h-metric__icon">↗</span><span className="h-metric__chip">+21% this season</span></div>
                  <strong><span className="h-count" data-count={stats.totalMatchesPlayed}>{stats.totalMatchesPlayed.toLocaleString()}</span></strong>
                  <span className="h-metric__label">Total matches played</span>
                  <div className="h-metric__chart" aria-hidden="true">
                    {[22, 30, 26, 38, 34, 46, 42, 55, 51, 64, 72, 86].map((h, i) => <i key={i} style={{ '--h': `${h}%`, '--i': i } as React.CSSProperties} />)}
                  </div>
                </div>
                <div className="h-metric h-card">
                  <span className="h-metric__icon">◇</span>
                  <strong><span className="h-count" data-count={stats.activeClubs}>{stats.activeClubs.toLocaleString()}</span></strong>
                  <span className="h-metric__label">Active clubs</span>
                  <small>Across regions</small>
                  <span className="h-metric__orbit" aria-hidden="true"><i /><i /><i /></span>
                </div>
                <div className="h-metric h-card">
                  <span className="h-metric__icon">▦</span>
                  <strong><span className="h-count" data-count={stats.monthlyTournaments}>{stats.monthlyTournaments.toLocaleString()}</span></strong>
                  <span className="h-metric__label">Monthly tournaments</span>
                  <small>Growing every month</small>
                  <span className="h-metric__dots" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} className={i % 3 === 0 ? 'on' : ''} />)}</span>
                </div>
                <div className="h-metric h-metric--wide h-card">
                  <div>
                    <span className="h-metric__icon">◎</span>
                    <strong><span className="h-count" data-count={stats.activePlayers}>{stats.activePlayers.toLocaleString()}</span></strong>
                    <span className="h-metric__label">Active players</span>
                    <small>Competing on MatchUp</small>
                  </div>
                  <div className="h-avatars h-avatars--lg" aria-hidden="true"><span>AB</span><span>SQ</span><span>HT</span><span>AR</span><span>MK</span><span>+</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Chapter 7 · The people ─────────────────────────────────────── */}
        <section className="h-community" id="community">
          <div className="h-community__stage h-container">
            <div className="h-heading">
              <div><p className="h-eyebrow">◉ Beyond the scoreboard</p><h2><span className="h-line">Built around</span><span className="h-line h-accent">the people who play.</span></h2></div>
              <p>Competition creates stories. MatchUp gives those stories a place to live, move, and inspire the next match.</p>
            </div>
            <div className="h-community__grid">
              <div className="h-reels">
                <div className="h-reels__grid">
                  {REELS.map(r => <Reel key={r.src} {...r} autoplay={motionOk} />)}
                </div>
                <div className="h-reels__foot">
                  <a className="h-btn h-btn--ghost h-btn--sm" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer"><span className="h-reel__ig" aria-hidden="true" /> Follow @matchupsport</a>
                  <button type="button" className="h-link" onClick={() => onNavigate('live')}>Watch live matches →</button>
                </div>
              </div>
              <div className="h-stack">
                {TESTIMONIALS.map((t, i) => (
                  <blockquote className="h-quote h-card" key={t.name} style={{ '--i': i } as React.CSSProperties}>
                    <p>{t.quote}</p>
                    <footer><span className="h-avatar">{t.initials}</span><span><strong>{t.name}</strong><small>{t.role}</small></span></footer>
                  </blockquote>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Chapter 8 · In your pocket ─────────────────────────────────── */}
        <section className="h-app">
          <div className="h-app__stage h-container">
            <div className="h-app__phone-wrap">
              <div className="h-chip h-chip--rank" aria-hidden="true"><small>Current rank</small><strong>#04</strong></div>
              <div className="h-chip h-chip--live" aria-hidden="true"><span className="h-dot" /> Live · 6:4</div>
              <div className="h-chip h-chip--next" aria-hidden="true"><small>Tonight</small><strong>8:30 PM</strong></div>
              <div className="h-phone">
                <div className="h-phone__island" />
                <div className="h-phone__screen">
                  <MatchupLogo className="h-6 w-auto" />
                  <p>Good evening, Player</p>
                  <h4>Your next match</h4>
                  <div className="h-phone__match"><span>Tonight · 8:30 PM</span><strong>Center Court</strong><small>Matchup Club</small></div>
                  <div className="h-phone__score"><span>Current rank</span><strong>#04</strong></div>
                </div>
              </div>
            </div>
            <div className="h-app__copy">
              <p className="h-eyebrow">MatchUp in your pocket</p>
              <h2><span className="h-line">Your competitive life.</span><span className="h-line h-accent">Always in play.</span></h2>
              <p>Book, compete, score, follow, and grow wherever the game takes you.</p>
              <div className="h-app__stores">
                <a className="h-store"><small>Download on the</small><strong>App Store</strong></a>
                <a className="h-store"><small>Get it on</small><strong>Google Play</strong></a>
              </div>
            </div>
          </div>
        </section>

        {/* ── Chapter 9 · Your move ──────────────────────────────────────── */}
        <section className="h-final">
          <div className="h-final__glow" aria-hidden="true" />
          <div className="h-rig h-rig--final" aria-hidden="true">
            <div className="h-rig__racket"><div className="h-rig__kick"><PadelRacket /></div></div>
            <div className="h-rig__ball"><div className="h-rig__bob"><PadelBall /></div></div>
          </div>
          <div className="h-container h-final__content">
            <MatchupLogo className="h-10 w-auto h-final__logo" />
            <p className="h-eyebrow">The next point starts here</p>
            <h2><span className="h-line">Play more.</span><span className="h-line h-accent">Become harder to beat.</span></h2>
            <p>Create your MatchUp profile and step into Pakistan's fastest-growing competitive padel network.</p>
            <button type="button" className="h-btn h-btn--primary h-btn--lg h-magnetic" onClick={goSignup}>Start playing now →</button>
          </div>
        </section>
      </main>

      <footer className="h-footer">
        <div className="h-container h-footer__top">
          <div className="h-footer__brand"><MatchupLogo className="h-6 w-auto" /><p>The operating system for modern padel competition.</p><div className="h-footer__socials"><a>Instagram</a><a>Facebook</a><a>LinkedIn</a></div></div>
          <div className="h-footer__links">
            <div><strong>Compete</strong><button type="button" onClick={() => onNavigate('leaderboard')}>Leaderboards</button><button type="button" onClick={() => onNavigate('landing')}>Tournaments</button><button type="button" onClick={() => onNavigate('live')}>Live matches</button><button type="button" onClick={() => onNavigate('auth-admin')}>Clubs</button></div>
            <div><strong>Platform</strong><button type="button" onClick={() => onNavigate('auth-player')}>Players</button><button type="button" onClick={() => onNavigate('auth-admin')}>Organizers</button><a>Club management</a><a>Support</a></div>
            <div><strong>Company</strong><a>About MatchUp</a><a>Contact</a><a>Privacy</a><a>Terms</a></div>
          </div>
          <div className="h-footer__news"><strong>Stay in the rally.</strong><p>Get tournament drops, ranking updates, and MatchUp news.</p><label><input placeholder="Email address" aria-label="Email address" /><button type="button" aria-label="Subscribe">→</button></label></div>
        </div>
        <div className="h-footer__word" aria-hidden="true">MATCHUP</div>
        <div className="h-container h-footer__bottom"><span>© 2026 MatchUp. All rights reserved.</span><span>Designed for the next generation of competition.</span></div>
      </footer>
    </div>
  );
};
