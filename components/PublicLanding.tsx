
import React, { useEffect } from 'react';
import './PublicLanding.css';
import { usePlatformStats, AnimatedCounter } from './PublicLandingStats';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useTournaments } from '../hooks/useTournaments';
import { MatchupLogo } from './MatchupLogo';
import { MobilePillMenu } from './MobilePillMenu';

export const PublicLanding: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const stats = usePlatformStats();
  const { leaderboard } = useLeaderboard();
  const { upcomingTournaments, completedTournaments } = useTournaments();

  useEffect(() => {

  const reducedMotion = false; // Interactive demo: motion intentionally enabled
  const mobileQuery = window.matchMedia('(max-width: 820px)');
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const lerp = (start: number, end: number, amount: number) => start + (end - start) * amount;

  const nav = document.querySelector('.site-nav');
  const progressBar = document.querySelector('.scroll-progress span') as HTMLElement;
  const hero = document.querySelector('.hero') as HTMLElement;
  const heroContent = document.querySelector('.hero-content') as HTMLElement;
  const heroGrid = document.querySelector('.hero-grid') as HTMLElement;
  const heroOrbit = document.querySelector('.hero-orbit') as HTMLElement;
  const court = document.querySelector('.court-stage') as HTMLElement;
  const glowOne = document.querySelector('.hero-glow--one') as HTMLElement;
  const glowTwo = document.querySelector('.hero-glow--two') as HTMLElement;
  const featureSection = document.querySelector('.feature-story') as HTMLElement;
  const featureTrack = document.querySelector('.feature-track') as HTMLElement;
  const featureCards = [...document.querySelectorAll('.feature-card')] as HTMLElement[];
  const featureProgress = document.querySelector('.feature-progress span') as HTMLElement;
  const performanceSection = document.querySelector('.performance-section') as HTMLElement;
  const performanceBg = document.querySelector('.performance-bg') as HTMLElement;
  const appSection = document.querySelector('.app-section') as HTMLElement;
  const phone = document.querySelector('.phone') as HTMLElement;
  const finalCta = document.querySelector('.final-cta') as HTMLElement;
  const finalOrb = document.querySelector('.final-cta__orb') as HTMLElement;

  const getScrollTop = () => {
    const sc = document.getElementById('main-scroll-container');
    return sc ? sc.scrollTop : (window.scrollY || document.documentElement.scrollTop || 0);
  };
  let targetScroll = getScrollTop();
  let renderedScroll = targetScroll;
  let viewportHeight = window.innerHeight;
  let viewportWidth = window.innerWidth;
  let featureTravel = 0;
  let rafId = 0;

  function updateMeasurements() {
    viewportHeight = window.innerHeight;
    viewportWidth = window.innerWidth;
    if (!featureSection || !featureTrack || mobileQuery.matches || reducedMotion) {
      if (featureSection) featureSection.style.removeProperty('--feature-height');
      featureTravel = 0;
      return;
    }
    const sideBreathingRoom = Math.max(70, viewportWidth * 0.08);
    featureTravel = Math.max(0, featureTrack.scrollWidth - viewportWidth + sideBreathingRoom);
    const scrollDistance = Math.max(viewportHeight * 1.4, featureTravel * 1.18);
    featureSection.style.setProperty('--feature-height', `${Math.ceil(viewportHeight + scrollDistance)}px`);
  }

  function elementProgress(element: HTMLElement, startOffset = 0, endOffset = 0) {
    if (!element) return 0;
    const rect = element.getBoundingClientRect();
    const start = viewportHeight - startOffset;
    const end = -rect.height + endOffset;
    return clamp((start - rect.top) / Math.max(1, start - end), 0, 1);
  }

  function render() {
    renderedScroll = reducedMotion ? targetScroll : lerp(renderedScroll, targetScroll, 0.105);
    const sc = document.getElementById('main-scroll-container');
    const scrollHeight = sc ? sc.scrollHeight : document.documentElement.scrollHeight;
    const maxScroll = Math.max(1, scrollHeight - viewportHeight);
    const globalProgress = clamp(renderedScroll / maxScroll, 0, 1);

    if (progressBar) progressBar.style.transform = `scaleX(${globalProgress})`;
    if (nav) nav.classList.toggle('is-scrolled', renderedScroll > 28);

    if (!reducedMotion && hero) {
      const heroHeight = Math.max(1, hero.offsetHeight);
      const hp = clamp(renderedScroll / heroHeight, 0, 1.18);
      const mobileFactor = mobileQuery.matches ? 0.55 : 1;

      if (heroContent) {
        heroContent.style.transform = `translate3d(0, ${(-hp * 145 * mobileFactor).toFixed(2)}px, 0) scale(${(1 - hp * .035).toFixed(4)})`;
        heroContent.style.opacity = String(clamp(1 - hp * 0.82, 0.18, 1));
      }
      if (heroGrid) {
        heroGrid.style.transform = `perspective(800px) rotateX(65deg) scale(1.4) translate3d(0, ${27 + hp * 13}%, 0)`;
      }
      if (heroOrbit) {
        heroOrbit.style.transform = `translate3d(${(hp * 72 * mobileFactor).toFixed(2)}px, ${(-hp * 115 * mobileFactor).toFixed(2)}px, 0) rotate(${(hp * 34).toFixed(2)}deg)`;
      }
      if (court) {
        court.style.transform = `perspective(1000px) rotateX(${(58 - hp * 10).toFixed(2)}deg) rotateZ(${(-18 + hp * 8).toFixed(2)}deg) translate3d(${(hp * 52).toFixed(2)}px, ${(-hp * 78).toFixed(2)}px, 0) scale(${(1 - hp * .08).toFixed(4)})`;
      }
      if (glowOne) glowOne.style.transform = `translate3d(${(-hp * 75).toFixed(2)}px, ${(hp * 95).toFixed(2)}px, 0) scale(${(1 + hp * .18).toFixed(3)})`;
      if (glowTwo) glowTwo.style.transform = `translate3d(${(hp * 54).toFixed(2)}px, ${(hp * 135).toFixed(2)}px, 0)`;
    }

    if (!reducedMotion && featureSection && featureTrack && !mobileQuery.matches) {
      const sectionTop = featureSection.offsetTop;
      const scrollRange = Math.max(1, featureSection.offsetHeight - viewportHeight);
      const fp = clamp((renderedScroll - sectionTop) / scrollRange, 0, 1);
      const x = -featureTravel * fp;
      featureTrack.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
      if (featureProgress) featureProgress.style.transform = `scaleX(${fp})`;

      featureCards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        const center = rect.left + rect.width / 2;
        const normalized = clamp((center - viewportWidth / 2) / (viewportWidth * .72), -1.25, 1.25);
        const depth = Math.abs(normalized);
        card.style.transform = `translate3d(0, ${(depth * 44).toFixed(2)}px, 0) rotateY(${(-normalized * 8).toFixed(2)}deg) scale(${(1 - depth * .045).toFixed(4)})`;
        card.style.opacity = String(clamp(1 - depth * .25, .56, 1));
        card.classList.toggle('is-near-center', depth < .28);
      });
    }

    if (!reducedMotion && performanceSection && performanceBg) {
      const pp = elementProgress(performanceSection, viewportHeight * .08, viewportHeight * .12);
      performanceBg.style.transform = `translate3d(0, ${((pp - .5) * 150).toFixed(2)}px, 0) scale(${(1.08 + pp * .08).toFixed(3)})`;
    }

    if (!reducedMotion && appSection && phone) {
      const ap = elementProgress(appSection, viewportHeight * .05, viewportHeight * .15);
      const lift = (0.5 - ap) * 120;
      phone.style.transform = `translate3d(0, ${lift.toFixed(2)}px, 0) rotateY(${(12 - ap * 13).toFixed(2)}deg) rotateZ(${(-6 + ap * 4).toFixed(2)}deg) scale(${(.9 + ap * .1).toFixed(3)})`;
    }

    if (!reducedMotion && finalCta && finalOrb) {
      const cp = elementProgress(finalCta, 0, viewportHeight * .15);
      finalOrb.style.transform = `translate3d(0, ${((.5 - cp) * 100).toFixed(2)}px, 0) rotate(${(cp * 38).toFixed(2)}deg) scale(${(.78 + cp * .36).toFixed(3)})`;
      finalOrb.style.opacity = String(clamp(.25 + cp, .25, 1));
    }

    const isSettled = Math.abs(renderedScroll - targetScroll) < 0.08;
    if (!isSettled || !reducedMotion) rafId = requestAnimationFrame(render);
  }

  function onScroll() {
    targetScroll = getScrollTop();
    if (reducedMotion && !rafId) rafId = requestAnimationFrame(() => { rafId = 0; render(); });
  }

  function restartRenderLoop() {
    cancelAnimationFrame(rafId);
    renderedScroll = getScrollTop();
    targetScroll = renderedScroll;
    updateMeasurements();
    rafId = requestAnimationFrame(render);
  }

  // Reveal animations remain native and work inside local/embedded previews.
  const revealElements = [...document.querySelectorAll('[data-reveal]')];
  if (reducedMotion || !('IntersectionObserver' in window)) {
    revealElements.forEach((element: any) => { element.style.opacity = '1'; element.style.transform = 'none'; });
  } else {
    revealElements.forEach((element: any) => { element.style.opacity = '0'; element.style.transform = 'translateY(34px)'; });
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry: any) => {
        if (!entry.isIntersecting) return;
        entry.target.animate(
          [{ opacity: 0, transform: 'translateY(34px)' }, { opacity: 1, transform: 'translateY(0)' }],
          { duration: 780, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }
        );
        observer.unobserve(entry.target);
      });
    }, { threshold: .08, rootMargin: '0px 0px -7% 0px' });
    revealElements.forEach((element) => revealObserver.observe(element));
    // Safety fallback for restrictive embedded browsers.
    window.setTimeout(() => revealElements.forEach((element: any) => {
      if (getComputedStyle(element).opacity === '0' && element.getBoundingClientRect().top < viewportHeight * 1.05) {
        element.style.opacity = '1'; element.style.transform = 'none';
      }
    }), 1400);
  }

  // Leaderboard search and city filter.
  const search = document.querySelector('#playerSearch') as HTMLInputElement;
  const city = document.querySelector('#cityFilter') as HTMLSelectElement;
  const rows = [...document.querySelectorAll('.player-row')] as HTMLElement[];
  function filterRows() {
    const query = (search?.value || '').toLowerCase().trim();
    const selectedCity = city?.value || 'All cities';
    rows.forEach((row) => {
      const matchesQuery = (row.dataset.search || '').includes(query);
      const matchesCity = selectedCity === 'All cities' || row.dataset.city === selectedCity || row.dataset.city === 'Any';
      row.hidden = !(matchesQuery && matchesCity);
    });
  }
  search?.addEventListener('input', filterRows);
  city?.addEventListener('change', filterRows);

  // Mobile navigation handled by React state.

  // Anchor navigation uses the browser's native scroll and never locks the wheel.
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const selector = link.getAttribute('href');
      if (!selector || selector === '#') return;
      const target = document.querySelector(selector);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    });
  });

  const pointerMove = (event: any) => {
    if (!hero || mobileQuery.matches || reducedMotion) return;
    hero.style.setProperty('--pointer-x', `${(event.clientX / viewportWidth * 100).toFixed(1)}%`);
    hero.style.setProperty('--pointer-y', `${(event.clientY / viewportHeight * 100).toFixed(1)}%`);
  };
  window.addEventListener('pointermove', pointerMove, { passive: true });

  const scrollEl = document.getElementById('main-scroll-container') || window;
  scrollEl.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', restartRenderLoop, { passive: true });
  window.addEventListener('load', restartRenderLoop, { once: true });
  let rObs: ResizeObserver | null = null;
  if ('ResizeObserver' in window && featureTrack) {
    rObs = new ResizeObserver(updateMeasurements);
    rObs.observe(featureTrack);
  }
  mobileQuery.addEventListener?.('change', restartRenderLoop);
  
  // Need to force an initial measurement wait for React to flush DOM
  setTimeout(() => restartRenderLoop(), 50);
  
  return () => {
     const scrollEl = document.getElementById('main-scroll-container') || window;
      scrollEl.removeEventListener('scroll', onScroll);
     window.removeEventListener('resize', restartRenderLoop);
     window.removeEventListener('load', restartRenderLoop);
     window.removeEventListener('pointermove', pointerMove);
     mobileQuery.removeEventListener?.('change', restartRenderLoop);
     cancelAnimationFrame(rafId);
     if (rObs) rObs.disconnect();
  };

  }, []);

  return (
    <div className="pl-root">

<div className="noise"></div><div className="scroll-progress" aria-hidden="true"><span></span></div>
<nav className="site-nav">
  <a className="nav-logo" href="#top"><MatchupLogo className="h-6 w-auto" /></a>
  <div className="nav-links"><a href="#rankings">Rankings</a><a href="#tournaments">Tournaments</a><a href="#clubs">Clubs</a><a href="#community">Community</a><a onClick={() => onNavigate('live')} style={{ cursor: 'pointer' }}>Spectator Mode</a></div>
  <div className="nav-actions"><a className="nav-login" onClick={() => onNavigate('auth-player')}>Log in</a><a className="button button--sm button--primary" onClick={() => onNavigate('auth-player')}>Start playing →</a></div>
  <div className="mobile-toggle-wrapper">
    <MobilePillMenu items={[
      { label: 'Rankings', href: '#rankings' },
      { label: 'Tournaments', href: '#tournaments' },
      { label: 'Clubs', href: '#clubs' },
      { label: 'Community', href: '#community' },
      { label: 'Spectator Mode', onClick: () => onNavigate('live') },
      { label: 'Log In', onClick: () => onNavigate('auth-player') },
      { label: 'Play Now', onClick: () => onNavigate('auth-player') }
    ]} />
  </div>
</nav>

<main>
<section className="hero" id="top">
  <div className="hero-grid"></div><div className="hero-glow hero-glow--one"></div><div className="hero-glow hero-glow--two"></div>
  <div className="hero-orbit"><span className="orbit-ring orbit-ring--one"></span><span className="orbit-ring orbit-ring--two"></span><span className="orbit-ball"></span></div>
  <div className="court-stage"><div className="court-stage__surface"><span className="court-line court-line--outer"></span><span className="court-line court-line--middle"></span><span className="court-line court-line--service-left"></span><span className="court-line court-line--service-right"></span><span className="court-net"></span><span className="player-dot player-dot--one"></span><span className="player-dot player-dot--two"></span><span className="player-dot player-dot--three"></span><span className="player-dot player-dot--four"></span></div></div>
  <div className="hero-content container">
    <div className="hero-kicker"><span className="live-dot"></span> Pakistan's competitive padel operating system</div>
    <h1>Where competition<br/><span>meets technology.</span></h1>
    <p>Track matches, climb leaderboards, organize tournaments, and elevate your game.</p>
    <div className="hero-actions"><a className="button button--primary" onClick={() => onNavigate('auth-player')}>Start playing →</a><a className="button button--ghost" onClick={() => onNavigate('live')} style={{ cursor: 'pointer' }}>Spectator mode ›</a></div>
    <div className="hero-proof"><div className="avatar-stack"><span>HT</span><span>SQ</span><span>AR</span><span>+2K</span></div><p><strong>Built for players.</strong><br/>Trusted by clubs and organizers.</p></div>
  </div>
  <a className="scroll-cue scroll-cue--prototype" href="#platform"><span>Scroll to explore</span><b>↓</b></a>
</section>

<section className="live-strip"><div className="container live-strip__inner"><div className="live-strip__label">◉ <span>Platform live</span></div>
<div className="mini-stat"><AnimatedCounter value={stats.activePlayers} format={true} /><span>Active players</span></div>
<div className="mini-stat"><AnimatedCounter value={stats.matchesLive} format={true} /><span>Matches live</span></div>
<div className="mini-stat"><AnimatedCounter value={stats.tournamentsHosted} format={true} /><span>Tournaments hosted</span></div>
<div className="mini-stat"><AnimatedCounter value={stats.totalMatchesPlayed} format={true} /><span>Matches organized</span></div>
</div></section>

<section className="intro-section section" id="platform"><div className="container intro-grid"><div data-reveal="true"><p className="eyebrow">✦ One connected platform</p><h2>Everything the game needs.<br/><span>Nothing it doesn't.</span></h2></div><p className="section-copy" data-reveal="true">MatchUp connects players, clubs, scores, tournaments, rankings, and community into one high-performance system built for the pace of modern padel.</p></div></section>

<section className="feature-story"><div className="feature-pin"><div className="feature-track">
  <article className="feature-intro-card feature-card"><p className="eyebrow">Built to compete</p><h3>From first serve<br/>to final ranking.</h3><div className="feature-progress"><span></span></div></article>
  <article className="feature-card"><div className="feature-card__number">01</div><div className="feature-card__icon">◉</div><p className="feature-card__eyebrow">Live engine</p><h3>Live scoring</h3><p>Broadcast-ready score updates engineered for courts, organizers, and fans.</p><a href="#platform">Explore feature →</a></article>
  <article className="feature-card"><div className="feature-card__number">02</div><div className="feature-card__icon">♛</div><p className="feature-card__eyebrow">Competitive layer</p><h3>Leaderboards</h3><p>A clear, dynamic view of player form, movement, points, and national standing.</p><a href="#rankings">Explore feature →</a></article>
  <article className="feature-card"><div className="feature-card__number">03</div><div className="feature-card__icon">▦</div><p className="feature-card__eyebrow">Operations</p><h3>Tournament management</h3><p>Registration, scheduling, brackets, results, and communication in one flow.</p><a href="#tournaments">Explore feature →</a></article>
  <article className="feature-card"><div className="feature-card__number">04</div><div className="feature-card__icon">◎</div><p className="feature-card__eyebrow">Identity</p><h3>Player profiles</h3><p>Performance, achievements, history, and competitive identity in one place.</p><a href="#platform">Explore feature →</a></article>
</div></div></section>

<section className="rankings-section section" id="rankings"><div className="container"><div className="section-heading" data-reveal="true"><div><p className="eyebrow">♛ National rankings</p><h2>Your game.<br/><span>Measured.</span></h2></div><p>Live standings that reward consistency, performance, and the courage to keep competing.</p></div>
<div className="leaderboard-shell" data-reveal="true"><div className="leaderboard-head"><div><span className="pulse-badge"><span></span> {stats.totalMatchesPlayed} Matches Organized</span><h3>MatchUp Top Players</h3></div><div className="leaderboard-filters"><label className="search-control">⌕ <input id="playerSearch" placeholder="Search player or club" /></label><select id="cityFilter"><option>All cities</option><option>Karachi</option><option>Lahore</option><option>Islamabad</option></select></div></div>
<div className="leaderboard-table"><div className="leaderboard-row leaderboard-row--header"><span>Rank</span><span>Player</span><span>Club</span><span>Form</span><span>Record</span><span>Points</span></div>
{leaderboard.slice(0,4).map((player, idx) => (
<a key={player.id} className="leaderboard-row player-row" data-city="Any" data-search={player.name.toLowerCase()}><span className="rank-cell"><b>0{idx+1}</b><small className="move move--flat">-</small></span><span className="player-cell"><span className="player-avatar">{player.name.substring(0,2).toUpperCase()}</span><span><strong>{player.name}</strong><small>⌖ National</small></span></span><span className="club-cell">Matchup</span><span className="form-cell"><i className="win">W</i><i className="win">W</i><i className="win">W</i><i className="loss">L</i><i className="win">W</i></span><span className="record-cell"><strong>{player.wins}-{player.matchesPlayed - player.wins}</strong><small>{Math.round(player.gwp)}% win rate</small></span><span className="points-cell"><strong>{player.points || (player.wins * 10)}</strong><span>›</span></span></a>
))}
</div><div className="leaderboard-foot"><span>Ranking logic remains controlled by the MatchUp backend.</span><a onClick={() => onNavigate('live')}>Enter Spectator Arena →</a></div></div></div></section>

<section className="tournament-section section" id="tournaments"><div className="container"><div className="section-heading" data-reveal="true"><div><p className="eyebrow">ϟ Tournament command center</p><h2>Every round.<br/><span>In real time.</span></h2></div><p>Registration, schedules, brackets, live scores, and results organized into one cinematic tournament experience.</p></div>
<div className="tournament-layout"><div className="bracket-card" data-reveal="true"><div className="card-topline"><span>◉ Latest Tournament · Live</span><span>Center Court</span></div><div className="bracket-flow"><div className="match-node match-node--live"><div className="match-node__head"><span>Quarterfinal</span><small>7:30 PM</small></div><div className="match-team"><span>Tariq / Qureshi</span><strong>5</strong></div><div className="match-team"><span>Raza / Khan</span><strong>4</strong></div><div className="match-status"><span className="live-dot"></span> live</div></div><div className="match-node"><div className="match-node__head"><span>Quarterfinal</span><small>8:15 PM</small></div><div className="match-team"><span>Ahmed / Siddiqui</span></div><div className="match-team"><span>Malik / Farooq</span></div><div className="match-status">scheduled</div></div><div className="match-node"><div className="match-node__head"><span>Semifinal</span><small>9:30 PM</small></div><div className="match-team"><span>Winner QF 1</span></div><div className="match-team"><span>Winner QF 2</span></div><div className="match-status">scheduled</div></div><div className="match-node"><div className="match-node__head"><span>Final</span><small>11:00 PM</small></div><div className="match-team"><span>Winner SF 1</span></div><div className="match-team"><span>Winner SF 2</span></div><div className="match-status">scheduled</div></div></div><div className="court-visual"><span className="court-ball"></span><span className="court-trail"></span></div></div>
<aside className="tournament-list" data-reveal="true"><div className="tournament-list__head"><div><p className="eyebrow">Next up</p><h3>Upcoming tournaments</h3></div><a onClick={() => onNavigate('auth-player')}>View all</a></div>{upcomingTournaments.slice(0,3).map(t => {    const d = new Date(t.date);    const m = d.toLocaleDateString('en-US', {month: 'short'});    const dy = d.getDate();    return (<a key={t.id} className="tournament-item" onClick={() => onNavigate('auth-player')}><div className="date-tile"><strong>{dy}</strong><span>{m}</span></div><div className="tournament-item__body"><strong>{t.name}</strong><span>⌖ {t.venue || 'TBA'}</span><div className="capacity"><i style={{width: '60%'}}></i></div><small>Open for Registration</small></div><span>›</span></a>)})}
{upcomingTournaments.length < 2 && completedTournaments.length > 0 && (
  <>
    <div className="tournament-list__head" style={{ marginTop: '32px' }}><div><p className="eyebrow">Recent</p><h3>Completed tournaments</h3></div></div>
    {completedTournaments.slice(0, 3 - upcomingTournaments.length).map(t => {
      const d = new Date(t.date);
      const m = d.toLocaleDateString('en-US', {month: 'short'});
      const dy = d.getDate();
      return (
      <a key={t.id} className="tournament-item" onClick={() => onNavigate('auth-player')}><div className="date-tile"><strong>{dy}</strong><span>{m}</span></div><div className="tournament-item__body"><strong>{t.name}</strong><span>⌖ {t.venue || 'TBA'}</span><small style={{color: '#66719B'}}>Completed</small></div><span>›</span></a>
      )
    })}
  </>
)}
</aside></div></div></section>

<section className="performance-section section" id="clubs"><div className="performance-bg"></div><div className="container performance-grid"><div className="performance-copy" data-reveal="true"><p className="eyebrow">◴ Network performance</p><h2>The momentum<br/><span>is measurable.</span></h2><p>Every match makes the network smarter, the rankings sharper, and the community stronger.</p><a className="text-link" onClick={() => onNavigate('auth-admin')}>Explore clubs →</a></div><div className="metric-grid" data-reveal="true">
<div className="metric-card"><span>↗</span><AnimatedCounter value={stats.totalMatchesPlayed} format={true} /><span>Total matches played</span><small>+21% this season</small></div>
<div className="metric-card"><span>◇</span><AnimatedCounter value={stats.activeClubs} format={true} /><span>Active clubs</span><small>Across regions</small></div>
<div className="metric-card"><span>▦</span><AnimatedCounter value={stats.monthlyTournaments} format={true} /><span>Monthly tournaments</span><small>Growing every month</small></div>
<div className="metric-card"><span>◎</span><AnimatedCounter value={stats.userGrowth} prefix="+" suffix="%" /><span>User growth</span><small>Last 90 days</small></div>
</div></div></section>

<section className="community-section section" id="community"><div className="container"><div className="section-heading" data-reveal="true"><div><p className="eyebrow">◉ Beyond the scoreboard</p><h2>Built around<br/><span>the people who play.</span></h2></div><p>Competition creates stories. MatchUp gives those stories a place to live, move, and inspire the next match.</p></div><div className="community-grid"><article className="highlight-card" data-reveal="true"><div className="highlight-visual"><span className="play-ring">▶</span><div className="score-overlay"><small>Match point</small><strong>6:4 · 5:5</strong></div></div><div className="highlight-copy"><span>Match highlight</span><h3>One rally. Twenty-six shots. A place in the final.</h3><a onClick={() => onNavigate('live')}>Watch the point →</a></div></article><div className="testimonial-stack" data-reveal="true"><blockquote className="active"><p>“MatchUp made the tournament feel professional from registration to the final point.”</p><footer><span className="player-avatar">AM</span><span><strong>Areeb Malik</strong><small>Competitive player</small></span></footer></blockquote><blockquote><p>“We spend less time managing spreadsheets and more time creating a great event.”</p><footer><span className="player-avatar">MQ</span><span><strong>Maha Qazi</strong><small>Tournament organizer</small></span></footer></blockquote><blockquote><p>“Seeing my ranking move after every match changes how seriously I approach the game.”</p><footer><span className="player-avatar">OS</span><span><strong>Omer Shah</strong><small>Ranked player</small></span></footer></blockquote></div></div></div></section>

<section className="app-section section"><div className="container app-shell" data-reveal="true"><div className="phone-stage"><div className="phone"><div className="phone-island"></div><div className="phone-screen"><MatchupLogo className="h-6 w-auto" /><p>Good evening, Player</p><h4>Your next match</h4><div className="phone-match"><span>Tonight · 8:30 PM</span><strong>Center Court</strong><small>Matchup Club</small></div><div className="phone-score"><span>Current rank</span><strong>#04</strong></div></div></div></div><div className="app-copy"><p className="eyebrow">MatchUp in your pocket</p><h2>Your competitive life.<br/><span>Always in play.</span></h2><p>Book, compete, score, follow, and grow wherever the game takes you.</p><div className="app-actions"><a className="store-button"><small>Download on the</small><strong>App Store</strong></a><a className="store-button"><small>Get it on</small><strong>Google Play</strong></a></div></div></div></section>

<section className="final-cta section"><div className="final-cta__orb"></div><div className="container final-cta__content" data-reveal="true"><MatchupLogo className="h-10 w-auto mb-6" /><p className="eyebrow">The next point starts here</p><h2>Play more.<br/><span>Become harder to beat.</span></h2><p>Create your MatchUp profile and step into Pakistan's fastest-growing competitive padel network.</p><a className="button button--primary button--large" onClick={() => onNavigate('auth-player')}>Start playing now →</a></div></section>
</main>
<footer className="site-footer"><div className="container footer-top"><div className="footer-brand"><MatchupLogo className="h-6 w-auto mb-4" /><p>The operating system for modern padel competition.</p><div className="socials"><a>Instagram</a><a>Facebook</a><a>LinkedIn</a></div></div><div className="footer-links"><div><strong>Compete</strong><a onClick={() => onNavigate('leaderboard')}>Leaderboards</a><a onClick={() => onNavigate('landing')}>Tournaments</a><a onClick={() => onNavigate('live')}>Live matches</a><a onClick={() => onNavigate('auth-admin')}>Clubs</a></div><div><strong>Platform</strong><a onClick={() => onNavigate('auth-player')}>Players</a><a onClick={() => onNavigate('auth-admin')}>Organizers</a><a>Club management</a><a>Support</a></div><div><strong>Company</strong><a>About MatchUp</a><a>Contact</a><a>Privacy</a><a>Terms</a></div></div><div className="newsletter"><strong>Stay in the rally.</strong><p>Get tournament drops, ranking updates, and MatchUp news.</p><label><input placeholder="Email address" /><button>→</button></label></div></div><div className="container footer-bottom"><span>© 2026 MatchUp. All rights reserved.</span><span>Designed for the next generation of competition.</span></div></footer>

    </div>
  );
};
