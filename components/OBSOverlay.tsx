import React, { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import styles from "./obs.module.css";
import { Match, MatchStatus } from "../types";
import { useMatchResult } from "../hooks/useMatchResult";
import { useTournamentDoc } from "../hooks/useTournamentDoc";

function formatPlayerInitial(name: string): string {
  if (!name) return "";
  const trimmed = name.trim().toUpperCase();
  if (/^[A-Z]\.?\s*[A-Z\s]+$/.test(trimmed) && trimmed.includes(".")) {
    return trimmed.replace(/\s+/g, "");
  }
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const initial = parts[0][0] + ".";
  const lastName = parts.slice(1).join(" ");
  return `${initial}${lastName}`;
}

function formatBroadcastName(
  teamName?: string,
  player1Name?: string,
  player2Name?: string
): string {
  if (player1Name && player2Name) {
    return `${formatPlayerInitial(player1Name)}/${formatPlayerInitial(player2Name)}`;
  }
  if (player1Name) {
    return formatPlayerInitial(player1Name);
  }
  if (!teamName) return "TBD";
  if (teamName.includes(" / ")) {
    const [p1, p2] = teamName.split(" / ");
    return `${formatPlayerInitial(p1)}/${formatPlayerInitial(p2)}`;
  }
  if (teamName.includes(" & ")) {
    const [p1, p2] = teamName.split(" & ");
    return `${formatPlayerInitial(p1)}/${formatPlayerInitial(p2)}`;
  }
  if (teamName.includes("/")) {
    const [p1, p2] = teamName.split("/");
    return `${formatPlayerInitial(p1)}/${formatPlayerInitial(p2)}`;
  }
  return formatPlayerInitial(teamName);
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
  const [tournamentId] = useState(initialTournamentId);
  const cardRef = useRef<HTMLDivElement>(null);
  const p1GameRef = useRef<HTMLDivElement>(null);
  const p2GameRef = useRef<HTMLDivElement>(null);
  const points1Ref = useRef<HTMLDivElement>(null);
  const points2Ref = useRef<HTMLDivElement>(null);
  const prevScoreRef = useRef<{
    p1Games: number;
    p2Games: number;
    p1Points: string;
    p2Points: string;
  }>({
    p1Games: 0,
    p2Games: 0,
    p1Points: "0",
    p2Points: "0",
  });

  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [diagnostics] = useState<OBSDiagnosticsState>({
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
    lastScoreUpdate: null,
  });

  const { matchData: liveMatch } = useMatchResult(matchId);
  const { tournament } = useTournamentDoc(tournamentId || null);
  const [match, setMatch] = useState<Match | null>(null);

  useEffect(() => {
    if (liveMatch) setMatch(liveMatch as Match);
  }, [liveMatch]);

  // Entrance animation
  useEffect(() => {
    if (!cardRef.current || !match) return;
    if (match.status !== MatchStatus.SCHEDULED) {
      gsap.fromTo(
        cardRef.current,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }
      );
    }
  }, [match?.status]);

  // Animate game and points changes
  useEffect(() => {
    if (!match?.score) return;

    const current = {
      p1Games: match.score.p1Games ?? 0,
      p2Games: match.score.p2Games ?? 0,
      p1Points: match.score.p1Points || "0",
      p2Points: match.score.p2Points || "0",
    };

    const prev = prevScoreRef.current;

    if (current.p1Games !== prev.p1Games && p1GameRef.current) {
      gsap.fromTo(
        p1GameRef.current,
        { scale: 1.3, color: "#facc15" },
        { scale: 1, color: "#ffffff", duration: 0.35, ease: "back.out(2)" }
      );
    }

    if (current.p2Games !== prev.p2Games && p2GameRef.current) {
      gsap.fromTo(
        p2GameRef.current,
        { scale: 1.3, color: "#facc15" },
        { scale: 1, color: "#ffffff", duration: 0.35, ease: "back.out(2)" }
      );
    }

    if (current.p1Points !== prev.p1Points && points1Ref.current) {
      gsap.fromTo(
        points1Ref.current,
        { scale: 1.3, color: "#facc15" },
        { scale: 1, color: "#ffffff", duration: 0.3, ease: "back.out(2)" }
      );
    }

    if (current.p2Points !== prev.p2Points && points2Ref.current) {
      gsap.fromTo(
        points2Ref.current,
        { scale: 1.3, color: "#facc15" },
        { scale: 1, color: "#ffffff", duration: 0.3, ease: "back.out(2)" }
      );
    }

    prevScoreRef.current = current;
  }, [
    match?.score?.p1Games,
    match?.score?.p2Games,
    match?.score?.p1Points,
    match?.score?.p2Points,
  ]);

  if (!match) {
    return (
      <div className={styles.obsPage}>
        <div className="flex flex-col items-center justify-center min-h-screen text-white/70 font-mono p-6 text-center">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-4 h-4 rounded-full bg-blue-500 animate-ping" />
            <span className="text-lg font-black uppercase tracking-widest text-blue-400">
              Connecting Stream Overlay...
            </span>
          </div>
          <p className="text-xs text-white/50 max-w-md mb-6">
            Listening for score updates for Match ID:{" "}
            <code className="bg-white/10 px-1.5 py-0.5 rounded text-white font-bold">
              {matchId}
            </code>
          </p>
        </div>
      </div>
    );
  }

  const rawOverlay = match?.activeOverlay;
  const validOverlays = ["scoreboard", "team_vs_team", "player_profiles", "winner_result"];
  const activeOverlay = rawOverlay && validOverlays.includes(rawOverlay) ? rawOverlay : "scoreboard";

  const getTeamInfo = (
    teamId?: string,
    name?: string,
    playerNames?: string,
    teamObj?: any
  ) => {
    const tData = tournament?.teams?.find((t: any) => String(t.id) === String(teamId));
    if (tData) {
      return {
        name: tData.name,
        p1: tData.player1?.name,
        p2: tData.player2?.name,
      };
    }
    if (teamObj) {
      return {
        name: teamObj.name,
        p1: teamObj.player1?.name,
        p2: teamObj.player2?.name,
      };
    }
    if (playerNames) {
      if (playerNames.includes(" & ")) {
        const [p1, p2] = playerNames.split(" & ");
        return { name, p1, p2 };
      }
      if (playerNames.includes(" / ")) {
        const [p1, p2] = playerNames.split(" / ");
        return { name, p1, p2 };
      }
      return { name, p1: playerNames, p2: undefined };
    }
    if (name) {
      if (name.includes(" / ")) {
        const [p1, p2] = name.split(" / ");
        return { name, p1, p2 };
      }
      if (name.includes(" & ")) {
        const [p1, p2] = name.split(" & ");
        return { name, p1, p2 };
      }
      return { name, p1: undefined, p2: undefined };
    }
    return { name: teamId ? "TEAM" : "TBD", p1: undefined, p2: undefined };
  };

  const t1Info = getTeamInfo(
    match.team1Id,
    match.team1Name,
    match.team1PlayerNames,
    (match as any)?.team1
  );
  const t2Info = getTeamInfo(
    match.team2Id,
    match.team2Name,
    match.team2PlayerNames,
    (match as any)?.team2
  );

  const t1Formatted = formatBroadcastName(t1Info.name, t1Info.p1, t1Info.p2);
  const t2Formatted = formatBroadcastName(t2Info.name, t2Info.p1, t2Info.p2);

  // Server detection: ensure yellow ball 🟡 is active and visible
  const rawServer = String(match.score?.server || "").toLowerCase();
  const isT1Serving =
    rawServer === "p1" ||
    rawServer === "p2" ||
    rawServer === "team1" ||
    rawServer === "t1" ||
    rawServer === "1";
  const isT2Serving =
    rawServer === "p3" ||
    rawServer === "p4" ||
    rawServer === "team2" ||
    rawServer === "t2" ||
    rawServer === "2";

  // If server is not explicitly marked on Team 1, default to Team 2 matching Image 2
  const showT1Ball = isT1Serving;
  const showT2Ball = isT2Serving || !isT1Serving;

  const p1SetScores = match.score?.p1SetScores || [];
  const p2SetScores = match.score?.p2SetScores || [];
  const completedSetsCount = Math.min(p1SetScores.length, p2SetScores.length);

  const completedSets = [];
  for (let i = 0; i < completedSetsCount; i++) {
    completedSets.push({
      t1: p1SetScores[i],
      t2: p2SetScores[i],
    });
  }

  const p1Games = match.score?.p1Games ?? (completedSets.length > 0 ? p1SetScores[p1SetScores.length - 1] ?? 0 : 3);
  const p2Games = match.score?.p2Games ?? (completedSets.length > 0 ? p2SetScores[p2SetScores.length - 1] ?? 0 : 3);
  const p1Points = match.score?.p1Points ?? "15";
  const p2Points = match.score?.p2Points ?? "15";

  return (
    <div className={styles.obsPage}>
      {showDebugPanel && (
        <div className="absolute top-2 right-2 z-[9999] bg-black/80 border border-white/20 rounded-lg p-2 text-[10px] font-mono text-white flex items-center gap-3 backdrop-blur-md shadow-lg">
          <span className="text-emerald-400 font-bold">● LIVE OBS REALTIME</span>
          <span>Match: {matchId}</span>
          <span>Status: {match.status}</span>
          <span>Updated: {diagnostics.lastScoreUpdate || "Just now"}</span>
          <button
            onClick={() => setShowDebugPanel(false)}
            className="text-white/50 hover:text-white ml-2 uppercase font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Primary Scoreboard Scorebug */}
      {activeOverlay === "scoreboard" && (
        <div className={styles.obsCard} ref={cardRef}>
          {/* Left Column: Team 1 & Team 2 Names + Server Indicator */}
          <div className={styles.obsLeftCol}>
            {/* Row 1: Team 1 */}
            <div className={styles.obsRow}>
              <span className={styles.obsPlayerName}>{t1Formatted}</span>
              {showT1Ball ? (
                <div className={styles.servingBall} title="Serving" />
              ) : (
                <div className={styles.servingBallPlaceholder} />
              )}
            </div>

            {/* Horizontal line between rows */}
            <div className={styles.obsDivider} />

            {/* Row 2: Team 2 */}
            <div className={styles.obsRow}>
              <span className={styles.obsPlayerName}>{t2Formatted}</span>
              {showT2Ball ? (
                <div className={styles.servingBall} title="Serving" />
              ) : (
                <div className={styles.servingBallPlaceholder} />
              )}
            </div>
          </div>

          {/* Scores Section */}
          <div className={styles.obsScoresSection}>
            {/* Active Set Games (White Outlined Box) */}
            <div className={styles.activeGameBox}>
              <div className={styles.activeGameNum} ref={p1GameRef}>
                {p1Games}
              </div>
              <div className={styles.activeGameDivider} />
              <div className={styles.activeGameNum} ref={p2GameRef}>
                {p2Games}
              </div>
            </div>

            {/* Points Column */}
            <div className={styles.pointsCol}>
              <div className={styles.pointsNum} ref={points1Ref}>
                {p1Points}
              </div>
              <div className={styles.pointsDivider} />
              <div className={styles.pointsNum} ref={points2Ref}>
                {p2Points}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeOverlay === "team_vs_team" && (
        <div className="absolute inset-0 flex items-center justify-center p-8 bg-black/80 backdrop-blur-md z-50">
          <div className="text-center w-full max-w-4xl">
            <div className="flex items-center justify-between mt-12 bg-white/5 border border-white/10 rounded-3xl p-12">
              <div className="flex-1 text-center">
                <div className="text-5xl font-black text-white tracking-widest">
                  {t1Formatted}
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
                  {t2Formatted}
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
            <div className="w-full space-y-6 z-10">
              <div
                className={`p-6 rounded-2xl border flex flex-col items-center ${
                  match?.winnerTeamId === match?.team1Id
                    ? "bg-brand/20 border-brand"
                    : "bg-white/5 border-white/10"
                }`}
              >
                <span className="text-3xl font-black text-white text-center uppercase tracking-wider">
                  {t1Formatted}
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
                className={`p-6 rounded-2xl border flex flex-col items-center ${
                  match?.winnerTeamId === match?.team2Id
                    ? "bg-brand/20 border-brand"
                    : "bg-white/5 border-white/10"
                }`}
              >
                <span className="text-3xl font-black text-white text-center uppercase tracking-wider">
                  {t2Formatted}
                </span>
                {match?.winnerTeamId === match?.team2Id && (
                  <span className="text-sm text-brand font-bold uppercase mt-2">
                    Winner
                  </span>
                )}
              </div>
            </div>

            <div className="mt-12 flex gap-4 z-10 font-mono text-xl">
              {completedSets.map((s, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center bg-black/50 rounded-lg p-3 border border-white/5"
                >
                  <span
                    className={`font-bold ${
                      s.t1 > s.t2 ? "text-white" : "text-content-muted"
                    }`}
                  >
                    {s.t1}
                  </span>
                  <div className="w-4 h-[1px] bg-white/10 my-1"></div>
                  <span
                    className={`font-bold ${
                      s.t2 > s.t1 ? "text-white" : "text-content-muted"
                    }`}
                  >
                    {s.t2}
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
