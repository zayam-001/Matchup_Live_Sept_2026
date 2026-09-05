import React, { useEffect, useRef, useState } from "react";
import { doc, getDoc, onSnapshot, collectionGroup, getDocs, collection } from "firebase/firestore";
import { gsap } from "gsap";
import { db } from "../services/storage";
import styles from "./obs.module.css";
import { MatchupLogo } from "./MatchupLogo";
import { Match, MatchStatus } from "../types";
import { useMatchResult } from "../hooks/useMatchResult";
import { useTournamentDoc } from "../hooks/useTournamentDoc";

function mergeMatchData(existing: Match | null, incoming: any): Match {
  if (!incoming) return existing as Match;
  if (!existing) return { ...incoming };

  const merged: any = { ...existing };
  for (const key of Object.keys(incoming)) {
    const val = incoming[key];
    if (val !== undefined && val !== null) {
      if (key === 'score' && typeof val === 'object' && existing.score) {
        merged.score = {
          ...existing.score,
          ...val,
          p1SetScores: val.p1SetScores || existing.score.p1SetScores || [],
          p2SetScores: val.p2SetScores || existing.score.p2SetScores || [],
        };
      } else {
        merged[key] = val;
      }
    }
  }
  return merged;
}

export interface OBSDiagnosticsState {
  globalDocExists: boolean | null;
  obsIndexExists: boolean | null;
  subcollectionDocExists: boolean | null;
  tournamentDocExists: boolean | null;
  fallbackSearchRan: boolean;
  resolvedMatchId: string | null;
  resolvedTournamentId: string | null;
  matchFieldsCount: number;
  hasScore: boolean;
  hasTeams: boolean;
  missingFields: string[];
  cssConstraintsPassed: boolean;
  viewportWidth: number;
  viewportHeight: number;
  lastScoreUpdate: string | null;
}

export default function OBSOverlay({
  matchId,
  tournamentId: initialTournamentId,
}: {
  matchId: string;
  tournamentId?: string;
}) {
  const [tournamentId, setTournamentId] = useState(initialTournamentId);
  const cardRef = useRef<HTMLDivElement>(null);
  const prevSetsRef = useRef<Array<{team1: number, team2: number, p1Pts: string, p2Pts: string}>>([]);
  const points1Ref = useRef<HTMLDivElement>(null);
  const points2Ref = useRef<HTMLDivElement>(null);
  const scoreRefs = useRef<Array<HTMLDivElement | null>>([]);
  const stingActiveRef = useRef<boolean>(false);
  const stingLayerRef = useRef<HTMLDivElement>(null);
  const stingRuleRef = useRef<HTMLDivElement>(null);
  const stingBodyRef = useRef<HTMLDivElement>(null);
  const stingLine1Ref = useRef<HTMLDivElement>(null);
  const stingLine2Ref = useRef<HTMLDivElement>(null);
  const stingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [diagnostics, setDiagnostics] = useState<OBSDiagnosticsState>({
    globalDocExists: null,
    obsIndexExists: null,
    subcollectionDocExists: null,
    tournamentDocExists: null,
    fallbackSearchRan: false,
    resolvedMatchId: matchId,
    resolvedTournamentId: initialTournamentId || null,
    matchFieldsCount: 0,
    hasScore: false,
    hasTeams: false,
    missingFields: [],
    cssConstraintsPassed: true,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    lastScoreUpdate: null
  });

  const { matchData: liveMatch } = useMatchResult(matchId);
  const { tournament } = useTournamentDoc(tournamentId || null);
  const [match, setMatch] = useState<Match | null>(null);

  useEffect(() => {
    if (liveMatch) setMatch(liveMatch as Match);
  }, [liveMatch]);

  // Debug states
  const [debug, setDebug] = useState({
    resolvedMatchId: matchId,
    resolvedTournamentId: tournamentId,
    matchFieldsCount: 0,
    hasTeams: false,
    hasScoreObj: false,
    hasStatus: false,
    isCompleted: false,
    p1Sets: 0,
    p2Sets: 0,
    p1Games: 0,
    p2Games: 0,
    p1Pts: "0",
    p2Pts: "0",
    missingFields: [] as string[]
  });
  const [showDebug, setShowDebug] = useState(false);
  

  useEffect(() => {
    if (!match) return;

    const missing: string[] = [];
    if (!match.team1Name && !match.team1Id) missing.push("team1Name/team1Id missing");
    if (!match.team2Name && !match.team2Id) missing.push("team2Name/team2Id missing");
    if (!match.score) missing.push("score state missing");

    const fieldsCount = Object.keys(match).length;
    const hasScoreObj = !!match.score;
    const hasTeamsInfo = !!(match.team1Name || match.team1Id) && !!(match.team2Name || match.team2Id);

    setDebug((prev) => ({
      ...prev,
      matchFieldsCount: fieldsCount,
      hasTeams: hasTeamsInfo,
      hasScoreObj,
      hasStatus: !!match.status,
      missingFields: missing,
    }));

    console.log(`[OBSOverlay Data Verification] Match "${matchId}" state verified:`, {
      hasTeams: hasTeamsInfo,
      hasScore: hasScoreObj,
      status: match.status,
      missing
    });
  }, [match, matchId]);

  // Diagnostic Timeout Guard: If match is null after 3.5 seconds, surface debug panel automatically
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!match) {
        console.warn(`[OBSOverlay Timeout] MatchId "${matchId}" did not resolve within 3.5s. Enabling diagnostic info.`);
        setShowDebugPanel(true);
      }
    }, 3500);
    return () => clearTimeout(timer);
  }, [match, matchId]);

  // Derived sets mapped from Match schema
  const isCompleted =
    match?.status === MatchStatus.COMPLETED ||
    String(match?.status).toUpperCase() === "COMPLETED" ||
    String(match?.status).toUpperCase() === "FINISHED" ||
    !!match?.winnerTeamId;
  const setsCount = Math.max(
    match?.score?.p1SetScores?.length || 0,
    match?.score?.p2SetScores?.length || 0,
  );
  const mappedSets = [];

  for (let i = 0; i < setsCount; i++) {
    mappedSets.push({
      team1: match?.score?.p1SetScores[i] || 0,
      team2: match?.score?.p2SetScores[i] || 0,
    });
  }

  if (!isCompleted && match?.status !== MatchStatus.SCHEDULED) {
    mappedSets.push({
      team1: match?.score?.p1Games || 0,
      team2: match?.score?.p2Games || 0,
    });
  }

  useEffect(() => {
    if (!cardRef.current || !match) return;
    if (match.status !== MatchStatus.SCHEDULED) {
      gsap.fromTo(
        cardRef.current,
        { y: 50, opacity: 0, scale: 0.95 },
        { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: "back.out(1.2)" },
      );
    }
  }, [match?.status]);

  // ── Score change animation ───────────────────────────────────────
  useEffect(() => {
    if (!match) return;

    const currentSets = mappedSets.map((s) => ({
      ...s,
      p1Pts: match.score?.p1Points || "0",
      p2Pts: match.score?.p2Points || "0",
    }));
    const prevSets = prevSetsRef.current;

    currentSets.forEach((set, setIdx) => {
      const prev = prevSets[setIdx] || {
        team1: 0,
        team2: 0,
        p1Pts: "0",
        p2Pts: "0",
      };

      if (set.team1 !== prev.team1) animateScoreBox(`t1s${setIdx}`);
      if (set.team2 !== prev.team2) animateScoreBox(`t2s${setIdx}`);
    });

    if (currentSets.length > 0) {
      const lastCurrent = currentSets[currentSets.length - 1];
      const lastPrev =
        prevSets.length > 0
          ? prevSets[prevSets.length - 1]
          : { p1Pts: "0", p2Pts: "0" };
      if (lastCurrent.p1Pts !== lastPrev.p1Pts)
        animatePointsBox(points1Ref.current);
      if (lastCurrent.p2Pts !== lastPrev.p2Pts)
        animatePointsBox(points2Ref.current);
    }

    prevSetsRef.current = currentSets.map((s) => ({ ...s }));
  }, [
    match?.score?.p1SetScores,
    match?.score?.p2SetScores,
    match?.score?.p1Games,
    match?.score?.p2Games,
    match?.score?.p1Points,
    match?.score?.p2Points,
  ]);

  const animateScoreBox = (key: string) => {
    const el = scoreRefs.current[key];
    if (!el) return;
    gsap.fromTo(
      el,
      {
        scale: 1,
        backgroundColor: "rgba(26,86,219,0.55)",
        borderColor: "#4a7dfa",
      },
      {
        scale: 1.55,
        backgroundColor: "rgba(26,86,219,0.95)",
        borderColor: "#6b9fff",
        duration: 0.18,
        ease: "power3.out",
        yoyo: true,
        repeat: 1,
        onComplete: () =>
          gsap.set(el, { scale: 1, clearProps: "backgroundColor,borderColor" }),
      },
    );
  };

  const animatePointsBox = (el: HTMLElement | null) => {
    if (!el) return;
    gsap.fromTo(
      el,
      { scale: 1, color: "#FFFFFF", textShadow: "none" },
      {
        scale: 1.35,
        color: "#00E5FF",
        textShadow: "0 0 10px rgba(0,229,255,0.8)",
        duration: 0.18,
        ease: "power3.out",
        yoyo: true,
        repeat: 1,
        onComplete: () => gsap.set(el, { scale: 1, clearProps: "all" }),
      },
    );
  };

  // ── Logo sting ───────────────────────────────────────────────────
  const triggerSting = () => {
    if (stingActiveRef.current) return;
    stingActiveRef.current = true;

    const layer = stingLayerRef.current;
    const rule = stingRuleRef.current;
    const body = stingBodyRef.current;
    const l1 = stingLine1Ref.current;
    const l2 = stingLine2Ref.current;
    if (!layer || !rule || !body || !l1 || !l2) return;

    gsap.set(layer, { display: "flex", opacity: 0 });
    gsap.set(rule, { width: "0%", opacity: 1 });
    gsap.set(body, { opacity: 0, scale: 0.58 });
    gsap.set([l1, l2], { opacity: 0, y: 5 });

    gsap
      .timeline({
        onComplete: () => {
          stingActiveRef.current = false;
        },
      })
      .to(layer, { opacity: 1, duration: 0.28, ease: "power2.out" })
      .to(
        rule,
        { width: "90%", duration: 0.44, ease: "power3.inOut" },
        "-=0.05",
      )
      .to(
        body,
        { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2.4)" },
        "-=0.20",
      )
      .to(l1, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }, "-=0.25")
      .to(l2, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }, "-=0.18")
      .to({}, { duration: 2.0 })
      .to([body, l1, l2], {
        opacity: 0,
        y: -8,
        duration: 0.28,
        ease: "power2.in",
        stagger: 0.04,
      })
      .to(
        rule,
        { width: "0%", opacity: 0, duration: 0.28, ease: "power3.in" },
        "-=0.20",
      )
      .to(layer, { opacity: 0, duration: 0.22, ease: "power2.in" }, "-=0.10")
      .set(layer, { display: "none" });
  };

  // ── 60-second sting interval ──────────────────────────────────────
  useEffect(() => {
    document.fonts.ready.then(() => {
      if (stingTimerRef.current)
        clearInterval(stingTimerRef.current as NodeJS.Timeout);
      stingTimerRef.current = setInterval(triggerSting, 60_000);
    });
    return () => {
      if (stingTimerRef.current)
        clearInterval(stingTimerRef.current as NodeJS.Timeout);
    };
  }, [match?.score]);

  // ── Helpers ───────────────────────────────────────────────────────
  const isWinningSet = (team: "team1" | "team2", setIdx: number) => {
    const s = mappedSets[setIdx];
    if (!s) return false;
    return team === "team1"
      ? s.team1 > s.team2 && setIdx < setsCount
      : s.team2 > s.team1 && setIdx < setsCount;
  };

  if (!match) {
    return (
      <div className={styles.obsPage}>
        <div className="flex flex-col items-center justify-center min-h-screen text-white/70 font-mono p-6 text-center">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-4 h-4 rounded-full bg-brand animate-ping" />
            <span className="text-lg font-black uppercase tracking-widest text-brand">
              Connecting OBS Stream Overlay...
            </span>
          </div>

          <p className="text-xs text-white/50 max-w-md mb-6">
            Listening for Firestore score updates for Match ID: <code className="bg-white/10 px-1.5 py-0.5 rounded text-white font-bold">{matchId}</code>
          </p>

          {showDebugPanel && (
            <div className="bg-black/90 border border-white/10 rounded-2xl p-6 text-left w-full max-w-2xl font-mono text-xs shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                <span className="font-bold text-amber-400 uppercase tracking-wider">
                  🔍 OBS Overlay Diagnostic Verification
                </span>
                <span className="text-[10px] text-white/40">
                  Viewport: {diagnostics.viewportWidth}x{diagnostics.viewportHeight}px
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4 text-white/80">
                <div className="bg-white/5 p-2.5 rounded border border-white/5">
                  <div className="text-white/40 text-[10px] uppercase">Global Match Doc</div>
                  <div className={`font-bold mt-1 ${diagnostics.globalDocExists === true ? 'text-emerald-400' : diagnostics.globalDocExists === false ? 'text-rose-400' : 'text-amber-400'}`}>
                    {diagnostics.globalDocExists === true ? '✓ FOUND' : diagnostics.globalDocExists === false ? '✗ NOT FOUND' : '⏳ CHECKING...'}
                  </div>
                </div>

                <div className="bg-white/5 p-2.5 rounded border border-white/5">
                  <div className="text-white/40 text-[10px] uppercase">obsIndex Record</div>
                  <div className={`font-bold mt-1 ${diagnostics.obsIndexExists === true ? 'text-emerald-400' : diagnostics.obsIndexExists === false ? 'text-rose-400' : 'text-amber-400'}`}>
                    {diagnostics.obsIndexExists === true ? '✓ FOUND' : diagnostics.obsIndexExists === false ? '✗ NOT FOUND' : '⏳ CHECKING...'}
                  </div>
                </div>

                <div className="bg-white/5 p-2.5 rounded border border-white/5">
                  <div className="text-white/40 text-[10px] uppercase">Subcollection Match Doc</div>
                  <div className={`font-bold mt-1 ${diagnostics.subcollectionDocExists === true ? 'text-emerald-400' : diagnostics.subcollectionDocExists === false ? 'text-rose-400' : 'text-amber-400'}`}>
                    {diagnostics.subcollectionDocExists === true ? '✓ FOUND' : diagnostics.subcollectionDocExists === false ? '✗ NOT FOUND' : '⏳ CHECKING...'}
                  </div>
                </div>

                <div className="bg-white/5 p-2.5 rounded border border-white/5">
                  <div className="text-white/40 text-[10px] uppercase">Tournament Doc</div>
                  <div className={`font-bold mt-1 ${diagnostics.tournamentDocExists === true ? 'text-emerald-400' : diagnostics.tournamentDocExists === false ? 'text-rose-400' : 'text-amber-400'}`}>
                    {diagnostics.tournamentDocExists === true ? '✓ FOUND' : diagnostics.tournamentDocExists === false ? '✗ NOT FOUND' : '⏳ CHECKING...'}
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-white/60 space-y-1 bg-white/5 p-3 rounded">
                <div>Resolved Tournament ID: <span className="text-white">{tournamentId || 'None'}</span></div>
                <div>Fallback Tournament Scan: <span className={diagnostics.fallbackSearchRan ? "text-emerald-400" : "text-amber-400"}>{diagnostics.fallbackSearchRan ? "Executed" : "Pending"}</span></div>
                <div>CSS Constraints Valid: <span className={diagnostics.cssConstraintsPassed ? "text-emerald-400" : "text-rose-400"}>{diagnostics.cssConstraintsPassed ? "PASS" : "FAIL"}</span></div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const rawOverlay = match?.activeOverlay;
  const validOverlays = ["scoreboard", "team_vs_team", "player_profiles", "winner_result"];
  const activeOverlay = (rawOverlay && validOverlays.includes(rawOverlay)) ? rawOverlay : "scoreboard";

  const getTeamDisplayName = (teamId?: string, name?: string, playerNames?: string, teamObj?: any) => {
    const tData = tournament?.teams?.find((t: any) => String(t.id) === String(teamId));
    if (tData) {
      if (tData.name) return tData.name;
      if (tData.player1?.name && tData.player2?.name) {
        return `${tData.player1.name} / ${tData.player2.name}`;
      }
      if (tData.player1?.name) return tData.player1.name;
    }
    if (name) return name;
    if (playerNames) return playerNames;
    if (teamObj) {
      if (teamObj.name) return teamObj.name;
      if (teamObj.player1?.name && teamObj.player2?.name) {
        return `${teamObj.player1.name} / ${teamObj.player2.name}`;
      }
    }
    return teamId ? "TEAM" : "TBD";
  };

  const t1Name = getTeamDisplayName(match?.team1Id, match?.team1Name, match?.team1PlayerNames, (match as any)?.team1);
  const t2Name = getTeamDisplayName(match?.team2Id, match?.team2Name, match?.team2PlayerNames, (match as any)?.team2);

  return (
    <div className={styles.obsPage}>
      {/* Optional Debug Bar toggleable with ?debug=true */}
      {showDebugPanel && (
        <div className="absolute top-2 right-2 z-[9999] bg-black/80 border border-white/20 rounded-lg p-2 text-[10px] font-mono text-white flex items-center gap-3 backdrop-blur-md shadow-lg">
          <span className="text-emerald-400 font-bold">● LIVE OBS REALTIME</span>
          <span>Match: {matchId}</span>
          <span>Status: {match.status}</span>
          <span>Updated: {diagnostics.lastScoreUpdate || 'Just now'}</span>
          <button 
            onClick={() => setShowDebugPanel(false)}
            className="text-white/50 hover:text-white ml-2 uppercase font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Dynamic Overlay Rendering */}
      {activeOverlay === "scoreboard" && (
        <div className={styles.obsCard} ref={cardRef}>
          {/* ── TEAMS ──────────────────────────────────────────── */}
          <div className={styles.obsBody}>
            <div className={styles.obsLogoWrap}>
              <MatchupLogo className={styles.obsLogoSvg} />
              {isCompleted && (
                <span className="text-[9px] font-black text-white bg-red-600 px-1.5 py-0.5 rounded tracking-widest uppercase ml-1">
                  FINAL
                </span>
              )}
            </div>
            <div className={styles.obsTeams}>
              {/* Team 1 */}
              <div className={styles.obsRow}>
                <span className={styles.obsTname}>{t1Name}</span>
                <div className={styles.obsSets}>
                  {mappedSets.map((s, i) => (
                    <div
                      key={i}
                      ref={(el) => {
                        scoreRefs.current[`t1s${i}`] = el;
                      }}
                      className={`${styles.obsSbox} ${isWinningSet("team1", i) ? styles.win : ""}`}
                    >
                      {s.team1}
                    </div>
                  ))}
                  {!isCompleted && (
                    <div
                      className={`${styles.obsSbox} ${styles.liveScoreValue}`}
                    >
                      <span ref={points1Ref}>
                        {match.score?.p1Points === "0"
                          ? "0"
                          : match.score?.p1Points}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {/* Team 2 */}
              <div className={styles.obsRow}>
                <span className={styles.obsTname}>{t2Name}</span>
                <div className={styles.obsSets}>
                  {mappedSets.map((s, i) => (
                    <div
                      key={i}
                      ref={(el) => {
                        scoreRefs.current[`t2s${i}`] = el;
                      }}
                      className={`${styles.obsSbox} ${isWinningSet("team2", i) ? styles.win : ""}`}
                    >
                      {s.team2}
                    </div>
                  ))}
                  {!isCompleted && (
                    <div
                      className={`${styles.obsSbox} ${styles.liveScoreValue}`}
                    >
                      <span ref={points2Ref}>
                        {match.score?.p2Points === "0"
                          ? "0"
                          : match.score?.p2Points}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* ── STING LAYER ────────────────────────────────────── */}
          <div className={styles.stingLayer} ref={stingLayerRef}>
            <div className={styles.stingRule} ref={stingRuleRef} />
            <div className={styles.stingBody} ref={stingBodyRef}>
              <MatchupLogo className={styles.stingLogo} />
              <div className={styles.stingWords}>
                <span className={styles.stingTaglineTop} ref={stingLine1Ref}>
                  THE SPECTATORS
                </span>
                <span className={styles.stingTaglineBot} ref={stingLine2Ref}>
                  SPORTS PLATFORM
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeOverlay === "team_vs_team" && (
        <div className="absolute inset-0 flex items-center justify-center p-8 bg-black/80 backdrop-blur-md z-50">
          <div className="text-center w-full max-w-4xl">
            <h2 className="text-4xl font-black text-brand tracking-[0.2em] mb-4 uppercase">
              Matchup
            </h2>
            <div className="flex items-center justify-between mt-12 bg-white/5 border border-white/10 rounded-3xl p-12">
              <div className="flex-1 text-center">
                <div className="text-5xl font-black text-white tracking-widest">
                  {t1Name}
                </div>
                <div className="text-xl text-content-muted mt-2 font-mono uppercase">
                  Team 1
                </div>
              </div>
              <div className="text-3xl font-black text-white/40 italic px-8">
                VS
              </div>
              <div className="flex-1 text-center">
                <div className="text-5xl font-black text-white tracking-widest">
                  {t2Name}
                </div>
                <div className="text-xl text-content-muted mt-2 font-mono uppercase">
                  Team 2
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeOverlay === "player_profiles" && (
        <div className="absolute inset-0 flex items-center justify-center p-8 bg-black/80 backdrop-blur-md z-50">
          <div className="w-full max-w-6xl">
            <h2 className="text-3xl font-black text-center text-brand tracking-[0.2em] mb-8 uppercase">
              Player Profiles
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                ...(match?.team1PlayerNames?.split(" & ") || ["P1", "P2"]),
                ...(match?.team2PlayerNames?.split(" & ") || ["P3", "P4"]),
              ].map((p, i) => (
                <div
                  key={i}
                  className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center flex flex-col items-center"
                >
                  <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mb-4"></div>
                  <div className="text-xl font-black text-white uppercase tracking-wider">
                    {p.trim()}
                  </div>
                  <div className="text-sm font-mono text-content-muted mt-2">
                    Win %: 0.00
                  </div>
                  <div className="text-xs font-bold text-brand uppercase mt-1">
                    Category: Pro
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeOverlay === "winner_result" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-50 p-4">
          <div className="w-[450px] aspect-[9/20] bg-surface-ground border border-white/10 rounded-[40px] p-8 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-brand/20 blur-[100px] pointer-events-none rounded-full scale-150"></div>
            <h2 className="text-2xl font-black text-white tracking-[0.3em] uppercase mb-12 z-10 text-center">
              Final Result
            </h2>

            <div className="w-full space-y-6 z-10">
              <div
                className={`p-6 rounded-2xl border flex flex-col items-center ${match?.winnerTeamId === match?.team1Id ? "bg-brand/20 border-brand" : "bg-white/5 border-white/10"}`}
              >
                <span className="text-3xl font-black text-white text-center uppercase tracking-wider">
                  {t1Name}
                </span>
                {match?.winnerTeamId === match?.team1Id && (
                  <span className="text-sm text-brand font-bold uppercase mt-2">
                    Winner
                  </span>
                )}
              </div>
              <div className="text-center font-black text-white/30 italic">
                VS
              </div>
              <div
                className={`p-6 rounded-2xl border flex flex-col items-center ${match?.winnerTeamId === match?.team2Id ? "bg-brand/20 border-brand" : "bg-white/5 border-white/10"}`}
              >
                <span className="text-3xl font-black text-white text-center uppercase tracking-wider">
                  {t2Name}
                </span>
                {match?.winnerTeamId === match?.team2Id && (
                  <span className="text-sm text-brand font-bold uppercase mt-2">
                    Winner
                  </span>
                )}
              </div>
            </div>

            <div className="mt-12 flex gap-4 z-10 font-mono text-xl">
              {mappedSets.map((s, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center bg-black/50 rounded-lg p-3 border border-white/5"
                >
                  <span
                    className={`font-bold ${isWinningSet("team1", i) ? "text-white" : "text-content-muted"}`}
                  >
                    {s.team1}
                  </span>
                  <div className="w-4 h-[1px] bg-white/10 my-1"></div>
                  <span
                    className={`font-bold ${isWinningSet("team2", i) ? "text-white" : "text-content-muted"}`}
                  >
                    {s.team2}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
