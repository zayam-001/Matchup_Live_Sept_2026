import React from 'react';

interface ScorecardTemplateProps {
  session: any;
}

export const ScorecardTemplate = React.forwardRef<HTMLDivElement, ScorecardTemplateProps>(({ session }, ref) => {
  if (!session || !session.players) return null;

  // Helper to format MVP Name like "Rafay H."
  const formatMvpName = (fullName: string) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  };

  // Helper to format Team Names like "Rafay / Taha"
  const formatTeamName = (teamStr: string) => {
    if (!teamStr) return '';
    const players = teamStr.split('&').map(p => p.trim());
    const firstNames = players.map(p => p.split(' ')[0]);
    return firstNames.join(' / ');
  };

  // Helper for initials
  const getInitials = (name: string) => {
    if (!name) return '';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Calculate MVP strictly based on most points/games scored
  const playerStats = session.players.map((p: any, index: number) => {
    let totalScoreAcquired = 0;

    const playerName = typeof p === 'string' ? p : p.fullName;
    
    (session.matches || []).forEach((m: any) => {
      const isTeam1 = m.team1Players?.includes(index) || (m.player1 && m.player1.includes(playerName)) || (m.team1Name && m.team1Name.includes(playerName));
      const isTeam2 = m.team2Players?.includes(index) || (m.player2 && m.player2.includes(playerName)) || (m.team2Name && m.team2Name.includes(playerName));

      if (isTeam1) {
        if (m.score?.p1SetScores?.length) {
          totalScoreAcquired += m.score.p1SetScores.reduce((sum: number, val: number) => sum + val, 0);
        } else {
          totalScoreAcquired += (m.score?.p1Games || 0) || (parseInt(m.score?.rawPointsA || m.score?.p1Points, 10) || 0);
        }
      } else if (isTeam2) {
        if (m.score?.p2SetScores?.length) {
          totalScoreAcquired += m.score.p2SetScores.reduce((sum: number, val: number) => sum + val, 0);
        } else {
          totalScoreAcquired += (m.score?.p2Games || 0) || (parseInt(m.score?.rawPointsB || m.score?.p2Points, 10) || 0);
        }
      }
    });

    return {
      name: playerName,
      totalPoints: totalScoreAcquired
    };
  });

  playerStats.sort((a: any, b: any) => b.totalPoints - a.totalPoints);
  const mvp = playerStats[0];

  const dateStr = new Date(session.createdAt || Date.now()).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'numeric', year: 'numeric'
  });
  const idStr = session.id ? session.id.substring(0, 8).toUpperCase() : 'DEMO1234';

  const isRegular = session.type === 'regular' || session.matches?.length === 1;

  // Construct sets data ensuring comprehensive listing for all match configs, returning labels, pairs, and scores
  let scoreRows: Array<{ id: string, t1Score: number, t2Score: number, t1Name: string, t2Name: string, mvpName: string, typeLabel: string }> = [];

  (session.matches || []).forEach((match: any, matchIndex: number) => {
    const t1Raw = match.team1Name || match.player1 || 'Team A';
    const t2Raw = match.team2Name || match.player2 || 'Team B';
    const t1Name = formatTeamName(t1Raw);
    const t2Name = formatTeamName(t2Raw);

    // If it has multiple sets, loop through them
    if (match.score?.p1SetScores?.length && match.score.p1SetScores.length > 0) {
      match.score.p1SetScores.forEach((t1SetScore: number, setIdx: number) => {
        const t2SetScore = match.score.p2SetScores?.[setIdx] || 0;
        let mvpName = '-';
        if (t1SetScore > t2SetScore) mvpName = t1Raw.split('&')[0] || t1Raw;
        if (t2SetScore > t1SetScore) mvpName = t2Raw.split('&')[0] || t2Raw;

        scoreRows.push({
          id: String(setIdx + 1).padStart(2, '0'),
          t1Score: t1SetScore,
          t2Score: t2SetScore,
          t1Name,
          t2Name,
          mvpName: formatMvpName(mvpName),
          typeLabel: session.matches.length === 1 ? 'SET' : `M${matchIndex + 1}/S${setIdx + 1}`
        });
      });
    } else {
      // Fallback to games or raw points
      const t1Score = match.score?.p1Games !== undefined ? match.score.p1Games : (Math.floor(parseInt(match.score?.rawPointsA || match.score?.p1Points, 10)) || 0);
      const t2Score = match.score?.p2Games !== undefined ? match.score.p2Games : (Math.floor(parseInt(match.score?.rawPointsB || match.score?.p2Points, 10)) || 0);
      
      let mvpName = '-';
      if (t1Score > t2Score) mvpName = t1Raw.split('&')[0] || t1Raw;
      if (t2Score > t1Score) mvpName = t2Raw.split('&')[0] || t2Raw;

      scoreRows.push({
        id: String(matchIndex + 1).padStart(2, '0'),
        t1Score,
        t2Score,
        t1Name,
        t2Name,
        mvpName: formatMvpName(mvpName),
        typeLabel: session.matches.length === 1 ? 'MATCH' : 'GAME'
      });
    }
  });

  if (scoreRows.length === 0) {
    scoreRows.push({ id: '01', t1Score: 0, t2Score: 0, t1Name: 'Team A', t2Name: 'Team B', mvpName: '-', typeLabel: 'MATCH' });
  }

  return (
    <div 
      ref={ref} 
      style={{
        width: '800px',
        backgroundColor: '#0B0E14',
        color: '#FFFFFF',
        padding: '35px 45px 45px', // Adjusted top padding
        borderRadius: '16px',
        border: '1px solid #1F232C',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        boxSizing: 'border-box',
        fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
      }}
    >
      {/* HEADER */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottom: '1px solid #1F232C',
        paddingBottom: '30px',
        marginBottom: '35px'
      }}>
        <div style={{ width: '140px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 586" width="100%">
            <path d="M525.45,578.96 L515.91,578.96 L513.64,578.05 L512.05,575.55 L510.68,526.04 L511.14,96.30 L508.86,92.22 L505.00,89.26 L499.55,88.35 L494.55,90.17 L489.77,94.49 L452.05,158.08 L380.68,285.28 L349.77,337.52 L336.14,358.41 L325.45,369.54 L315.45,376.36 L303.64,380.90 L289.55,381.81 L275.91,378.17 L265.91,372.27 L256.59,363.87 L249.32,354.78 L106.14,94.49 L103.18,91.08 L99.09,88.81 L94.55,88.81 L92.27,90.17 L88.41,96.76 L88.41,412.93 L87.73,414.97 L83.64,416.33 L61.82,415.88 L49.55,413.15 L38.64,408.61 L29.55,402.70 L21.14,394.76 L16.59,388.85 L11.14,378.86 L8.41,371.13 L6.14,358.87 L6.14,88.58 L9.77,70.87 L16.59,54.51 L26.59,39.07 L37.27,27.48 L50.91,17.03 L62.27,11.13 L78.18,6.13 L89.09,4.77 L103.18,4.77 L119.09,7.50 L135.00,13.86 L151.36,25.21 L165.68,40.43 L178.86,59.96 L284.77,254.39 L288.18,258.25 L293.18,260.52 L296.82,260.52 L299.55,259.16 L303.41,254.84 L410.23,68.14 L424.77,45.88 L441.82,27.94 L455.00,18.40 L470.91,10.68 L489.55,5.68 L509.09,4.77 L525.91,7.50 L542.73,13.86 L557.73,23.39 L570.68,35.89 L578.86,47.24 L586.14,61.33 L591.14,76.32 L593.86,90.85 L593.41,454.26 L594.77,487.42 L593.86,513.77 L591.14,526.95 L583.86,543.75 L577.95,552.38 L569.09,561.70 L559.09,568.97 L548.64,573.96 L537.27,577.14 L525.45,578.96 Z" fill="white"/>
            <path d="M628.18,415.42 L619.09,415.42 L616.14,412.47 L616.59,334.34 L619.09,332.29 L640.45,330.02 L655.45,325.93 L669.55,319.12 L684.55,307.76 L695.23,295.73 L704.32,280.28 L709.77,263.47 L711.59,249.84 L711.59,240.76 L709.77,227.13 L703.86,209.42 L695.68,195.33 L682.73,181.02 L670.00,171.94 L656.82,165.58 L638.18,160.58 L620.45,160.13 L618.18,159.22 L616.14,156.72 L616.14,82.68 L619.09,79.27 L632.73,78.36 L649.55,79.72 L666.82,82.90 L680.91,86.54 L695.91,91.99 L710.91,99.26 L726.36,108.80 L747.95,127.19 L757.95,138.55 L767.95,152.63 L778.41,172.17 L783.86,185.79 L791.14,214.87 L792.95,231.67 L792.95,253.02 L788.86,281.64 L783.86,299.36 L777.95,314.35 L771.14,327.98 L762.95,341.15 L752.95,354.33 L743.18,365.00 L729.09,377.72 L718.64,385.44 L707.27,392.71 L689.55,401.80 L662.73,410.88 L645.00,414.06 L628.18,415.42 Z" fill="white"/>
            <path d="M303.64,582.14 L278.18,581.68 L255.45,578.05 L231.82,570.78 L207.73,559.43 L186.82,545.34 L164.77,524.67 L147.50,501.51 L137.95,483.79 L132.95,471.53 L126.59,449.72 L122.95,423.37 L121.59,398.84 L121.59,346.60 L123.41,283.91 L121.59,193.97 L122.50,182.16 L124.55,178.75 L127.27,178.75 L129.77,180.80 L144.77,206.69 L185.68,281.19 L197.05,303.45 L200.68,312.99 L203.86,324.34 L206.59,344.79 L206.59,422.01 L209.77,437.46 L215.23,451.08 L226.59,467.89 L235.45,476.75 L245.91,484.47 L264.55,493.56 L275.91,496.74 L288.18,498.55 L302.27,498.55 L314.09,496.74 L326.36,493.10 L338.18,487.65 L355.00,475.39 L366.59,462.44 L371.14,455.17 L378.86,436.09 L382.50,416.56 L383.41,396.57 L382.50,337.06 L383.86,327.07 L387.05,316.17 L400.68,288.46 L459.77,188.07 L462.27,185.11 L464.55,185.11 L466.59,187.16 L466.14,253.02 L467.95,323.44 L467.50,409.75 L463.86,442.91 L460.23,457.90 L454.77,474.25 L444.32,496.06 L431.14,516.04 L412.27,536.71 L395.45,550.34 L374.55,563.06 L355.91,571.24 L333.18,578.05 L303.64,582.14 Z" fill="white"/>
          </svg>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#4F6EF7', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '5px' }}>
            Verified Session
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, marginBottom: '5px', letterSpacing: '1px' }}>
            PERFORMANCE REPORT
          </div>
          <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
            📍 {session.venue || 'Court 1 - Neo Stadium Maidan'}
          </div>
          <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
            ID: #SID-{idStr} • {dateStr}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '25px', marginBottom: '25px' }}>
        
        {/* CARDS -> Sets & Scoreboards */}
        <div style={{ background: '#161B22', borderRadius: '12px', padding: '20px', border: '1px solid #1F232C' }}>
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#4F6EF7', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '15px', display: 'block', borderBottom: '1px solid #1F232C', paddingBottom: '10px' }}>
            Sets &amp; Scoreboards
          </span>

          {scoreRows.map((row, index) => (
            <div key={index} style={{ background: '#1A1F26', marginBottom: '10px', padding: '15px', borderRadius: '8px', border: '1px solid #242B35' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9CA3AF', marginBottom: '10px' }}>
                <span style={{ fontWeight: 600 }}>{row.typeLabel} {row.id}</span>
                <span style={{ fontWeight: 600 }}>MVP: <span style={{ color: '#E5E7EB' }}>{row.mvpName}</span></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#4F6EF7', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                  {row.t1Name}
                </div>
                <div style={{ background: '#0B0E14', padding: '5px 13px', borderRadius: '6px', fontSize: '18px', fontWeight: 800, margin: '0 10px', border: '1px solid #1F232C', whiteSpace: 'nowrap', flexShrink: 0, textAlign: 'center' }}>
                  {row.t1Score} - {row.t2Score}
                </div>
                <div style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#FBBF24', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                  {row.t2Name}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CARDS -> Session Roster */}
        <div style={{ background: '#161B22', borderRadius: '12px', padding: '20px', border: '1px solid #1F232C', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#4F6EF7', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '15px', display: 'block', borderBottom: '1px solid #1F232C', paddingBottom: '10px' }}>
            Session Roster
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {session.players.map((p: any, i: number) => {
              const name = typeof p === 'string' ? p : p.fullName;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '8px', background: '#1A1F26', borderRadius: '6px', border: '1px solid #242B35' }}>
                  <div style={{ width: '24px', height: '24px', background: '#4F6EF7', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800, color: 'white', flexShrink: 0 }}>
                    {getInitials(name)}
                  </div>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>{name}</span>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '25px' }}>
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#4F6EF7', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '15px', display: 'block', borderBottom: '1px solid #1F232C', paddingBottom: '10px' }}>
              Performance Leader
            </span>
            <div style={{ background: 'linear-gradient(90deg, #161B22 0%, #1F2630 100%)', borderLeft: '4px solid #4F6EF7', borderTopRightRadius: '6px', borderBottomRightRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', padding: '20px 15px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#4F6EF7', fontWeight: 800, letterSpacing: '0.5px' }}>PLAYER OF THE SESSION</div>
                <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px' }}>{mvp?.name || 'N/A'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '24px', fontWeight: 800, display: 'block', lineHeight: 1 }}>{mvp?.totalPoints || 0}</span>
                <span style={{ fontSize: '9px', color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>Total Points</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ marginTop: '45px', textAlign: 'center', borderTop: '1px solid #1F232C', paddingTop: '35px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
        <p style={{ fontSize: '13px', fontWeight: 500, color: '#F3F4F6', margin: 0 }}>
          Join the Karachi sports community on
        </p>
        <div style={{ display: 'inline-block', padding: '12px 32px', border: '1px solid #4F6EF7', color: '#4F6EF7', fontSize: '12px', fontWeight: 700, borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Matchup.com.pk
        </div>
        <p style={{ fontSize: '10px', color: '#4B5563', margin: 0 }}>
          © {(new Date()).getFullYear()} Match-Up Ecosystem. All rights reserved.
        </p>
      </div>
    </div>
  );
});
