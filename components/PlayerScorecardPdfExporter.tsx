import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Download, X, Crown, Trophy, Sparkles, BarChart3, Medal, Calendar, CheckCircle2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toJpeg, toPng } from 'html-to-image';
import { Logo } from './ui/Logo';

interface PlayerScorecardPdfExporterProps {
  top7Players: any[];
  tournamentName: string;
  categoryName?: string | null;
  dayLabel?: string;
  onClose: () => void;
}

export const PlayerScorecardPdfExporter: React.FC<PlayerScorecardPdfExporterProps> = ({
  top7Players,
  tournamentName,
  categoryName,
  dayLabel = 'All Tournament Days',
  onClose,
}) => {
  const posterRef = useRef<HTMLDivElement>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingJpg, setExportingJpg] = useState(false);
  const [exportFormat, setExportFormat] = useState<'jpg' | 'png'>('jpg');

  // Ensure strict top 7 filtering
  const filteredTop7 = top7Players.slice(0, 7);

  // Fancy PDF Export Handler using jsPDF & autoTable
  const handleExportPdf = () => {
    if (exportingPdf || filteredTop7.length === 0) return;
    setExportingPdf(true);

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // 1. Header Dark Banner Bar
      doc.setFillColor(11, 15, 25); // #0B0F19
      doc.rect(0, 0, pageWidth, 42, 'F');

      // Accent Gold Bar
      doc.setFillColor(234, 179, 8); // Gold #EAB308
      doc.rect(0, 42, pageWidth, 2, 'F');

      // Title & Branding Text
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('MATCHUP OFFICIAL DAILY WRAP', 14, 18);

      doc.setFontSize(10);
      doc.setTextColor(234, 179, 8); // Gold text
      doc.text(`TODAY'S CHAMPIONS & TOP 7 SCORECARD REPORT (${dayLabel.toUpperCase()})`, 14, 25);

      doc.setFontSize(9);
      doc.setTextColor(156, 163, 175);
      doc.text(`Tournament: ${tournamentName.toUpperCase()} | Category: ${categoryName || 'All Categories'} | ${dayLabel}`, 14, 32);

      // Top Right Watermark / Website
      doc.setFontSize(10);
      doc.setTextColor(234, 179, 8);
      doc.setFont('helvetica', 'bold');
      doc.text('WWW.MATCHUP.COM.PK', pageWidth - 14, 20, { align: 'right' });
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text(`Generated on ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`, pageWidth - 14, 28, { align: 'right' });

      let yPos = 52;

      // 2. Podium Highlights Box for Top 3 Finishers
      if (filteredTop7.length >= 3) {
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, yPos, pageWidth - 28, 26, 3, 3, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(14, yPos, pageWidth - 28, 26, 3, 3, 'D');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text('TOP 3 PODIUM FINISHERS:', 18, yPos + 7);

        // Gold #1
        doc.setTextColor(180, 83, 9); // Amber gold
        doc.text(`1ST CHAMPION: ${filteredTop7[0]?.name || ''} (${filteredTop7[0]?.wins || 0} Wins - ${filteredTop7[0]?.losses || 0} Losses, ${filteredTop7[0]?.fipPpfPoints || filteredTop7[0]?.pointsScored || 0} FIP/PPF Pts)`, 18, yPos + 14);

        // Silver #2
        doc.setTextColor(71, 85, 105);
        doc.text(`2ND FINALIST: ${filteredTop7[1]?.name || ''} (${filteredTop7[1]?.wins || 0} Wins - ${filteredTop7[1]?.losses || 0} Losses, ${filteredTop7[1]?.fipPpfPoints || filteredTop7[1]?.pointsScored || 0} FIP/PPF Pts)`, 18, yPos + 20);

        // Bronze #3
        doc.setTextColor(180, 83, 9);
        doc.text(`3RD SEMI-FINALIST: ${filteredTop7[2]?.name || ''} (${filteredTop7[2]?.wins || 0} Wins - ${filteredTop7[2]?.losses || 0} Losses, ${filteredTop7[2]?.fipPpfPoints || filteredTop7[2]?.pointsScored || 0} FIP/PPF Pts)`, pageWidth / 2 + 10, yPos + 14);

        yPos += 32;
      }

      // 3. Top 7 Leaderboard Table
      const tableData = filteredTop7.map((p, idx) => {
        const rankText = p.knockoutStage === 'CHAMPION' || idx === 0 ? '🏆 #1 CHAMP' : p.knockoutStage === 'RUNNER_UP' || idx === 1 ? '🥈 #2 FINALIST' : `#${idx + 1}`;
        const recordText = `${p.wins}W - ${p.losses}L (${(p.gamesWon || 0) - (p.gamesLost || 0)} GD)`;
        const fipPointsText = `${p.fipPpfPoints || p.pointsScored || 0} FIP Pts`;
        const dominanceText = `${p.dominanceScore || 0}/10`;
        const shotHighlights = [
          p.viboraCount ? `${p.viboraCount} Vibora` : '',
          p.smashCount ? `${p.smashCount} Smash` : '',
          p.winnerCount ? `${p.winnerCount} Winners` : '',
        ].filter(Boolean).join(' • ') || 'Solid Performance';

        return [
          rankText,
          p.name,
          p.categoryName || p.teamName || 'Open Category',
          recordText,
          fipPointsText,
          dominanceText,
          shotHighlights,
        ];
      });

      autoTable(doc, {
        startY: yPos,
        head: [['Rank', 'Player Name', 'Category', 'Record (W-L)', 'FIP/PPF Pts', 'Dominance', 'Shot Highlights']],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: [11, 15, 25],
          textColor: [234, 179, 8],
          fontSize: 9,
          fontStyle: 'bold',
          halign: 'left',
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: [30, 41, 59],
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 24 },
          1: { fontStyle: 'bold', cellWidth: 36 },
          2: { cellWidth: 28 },
          3: { cellWidth: 26 },
          4: { fontStyle: 'bold', cellWidth: 22 },
          5: { fontStyle: 'bold', cellWidth: 18 },
          6: { cellWidth: 32 },
        },
        alternateRowStyles: {
          fillColor: [241, 245, 249],
        },
        margin: { left: 14, right: 14 },
      });

      // 4. Footer Stamp & Page Numbers
      const finalY = (doc as any).lastAutoTable.finalY || (pageHeight - 25);

      doc.setDrawColor(226, 232, 240);
      doc.line(14, finalY + 10, pageWidth - 14, finalY + 10);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('OFFICIAL MATCHUP TOURNAMENT REPORT • STRICTLY TOP 7 QUALIFIED PLAYERS', 14, finalY + 16);
      doc.text('Page 1 of 1', pageWidth - 14, finalY + 16, { align: 'right' });

      // Save PDF File
      doc.save(`Top_7_Player_Scorecard_${tournamentName.replace(/[^a-zA-Z0-9]+/g, '_')}.pdf`);
    } catch (err) {
      console.error('Failed to export Top 7 PDF Scorecard:', err);
    } finally {
      setExportingPdf(false);
    }
  };

  // JPG Poster Export Handler
  const handleExportJpg = async () => {
    if (!posterRef.current || exportingJpg) return;
    setExportingJpg(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 200));

      const width = 1080;
      const height = 1350;

      const exportOptions = {
        cacheBust: true,
        style: {
          transform: 'none',
          width: `${width}px`,
          height: `${height}px`,
        },
        pixelRatio: 2,
        backgroundColor: '#07090e',
        width,
        height,
      };

      const dataUrl = exportFormat === 'jpg'
        ? await toJpeg(posterRef.current, { ...exportOptions, quality: 0.95 })
        : await toPng(posterRef.current, exportOptions);

      const fileName = `Top_7_Scorecard_${tournamentName.replace(/[^a-zA-Z0-9]+/g, '_')}.${exportFormat}`;

      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export Top 7 JPG scorecard:', err);
    } finally {
      setExportingJpg(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-surface-dark border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col my-auto max-h-[92vh]">
        
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-white/10 shrink-0 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center text-yellow-400">
              <FileText size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-wider">
                Top 7 Complete Player Scorecard Exporter
              </h3>
              <p className="text-xs text-content-muted">
                Fancy PDF Document & High-Resolution JPG Graphic Report (Strictly Top 7)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Format toggle for Graphic */}
            <div className="flex items-center bg-surface-elevated border border-white/10 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setExportFormat('jpg')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  exportFormat === 'jpg' ? 'bg-yellow-500 text-black font-black' : 'text-content-muted hover:text-white'
                }`}
              >
                JPG
              </button>
              <button
                onClick={() => setExportFormat('png')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  exportFormat === 'png' ? 'bg-yellow-500 text-black font-black' : 'text-content-muted hover:text-white'
                }`}
              >
                PNG
              </button>
            </div>

            {/* Download JPG Button */}
            <button
              onClick={handleExportJpg}
              disabled={exportingJpg}
              className="px-4 py-2.5 rounded-xl bg-surface-elevated border border-white/10 text-white hover:border-yellow-400 font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Download size={15} />
              {exportingJpg ? 'Generating...' : `Download ${exportFormat.toUpperCase()}`}
            </button>

            {/* Download PDF Button */}
            <button
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-600 hover:from-yellow-500 hover:to-amber-700 text-amber-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <FileText size={16} />
              {exportingPdf ? 'Building PDF...' : 'Download Fancy PDF'}
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-surface-elevated border border-white/10 flex items-center justify-center text-content-muted hover:text-white hover:border-white/20 transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Poster Canvas Preview Container */}
        <div className="flex-1 overflow-y-auto flex justify-center py-4 bg-black/50 rounded-2xl border border-white/5 p-4">
          
          <div
            ref={posterRef}
            style={{ width: '1080px', height: '1350px' }}
            className="bg-[#070A12] text-white p-10 flex flex-col justify-between relative overflow-hidden select-none border border-[#4D78FF]/30 shrink-0"
          >
            {/* Background Glows with Brand Colors (#4D78FF Electric Blue & #E65C31 Vibrant Orange) */}
            <div className="absolute -top-32 -right-32 w-[450px] h-[450px] bg-[#4D78FF]/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute -bottom-32 -left-32 w-[450px] h-[450px] bg-[#E65C31]/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(77,120,255,0.06)_0%,transparent_70%)] pointer-events-none" />

            {/* Header Block */}
            <div className="relative z-10 flex items-center justify-between pb-6 border-b-2 border-[#4D78FF]">
              <div className="flex items-center gap-4">
                <Logo size={52} variant="white" />
                <div>
                  <div className="text-xs font-black tracking-[0.25em] text-[#4D78FF] uppercase flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#E65C31] inline-block animate-ping" />
                    MATCH UP OFFICIAL DAILY WRAP
                  </div>
                  <h1 className="text-3xl font-black tracking-tight uppercase text-white font-mono mt-0.5">
                    {tournamentName}
                  </h1>
                </div>
              </div>

              <div className="text-right">
                <div className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#E65C31] text-white font-mono text-xs font-black uppercase tracking-widest shadow-lg shadow-[#E65C31]/25">
                  <Calendar size={15} /> {dayLabel.toUpperCase()} • DAILY WRAP
                </div>
                <div className="text-[11px] text-slate-300 uppercase tracking-widest font-bold mt-1.5">
                  TODAY'S CHAMPIONS & STANDINGS
                </div>
              </div>
            </div>

            {/* Hero Banner Section */}
            <div className="relative z-10 my-3 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#4D78FF]/20 border border-[#4D78FF]/50 rounded-full text-white text-xs font-black uppercase tracking-[0.25em] mb-2 shadow-sm">
                <Crown size={14} className="text-[#E65C31]" /> TODAY'S WRAP CHAMPIONS
              </div>
              <h2 className="text-4xl font-black tracking-wider uppercase text-white drop-shadow-md">
                {(() => {
                  if (!dayLabel || dayLabel.toUpperCase().includes('OVERALL')) {
                    return 'OVERALL TOP 7 SCORECARD';
                  }
                  const match = dayLabel.match(/Day\s*\d+/i);
                  if (match) {
                    return `${match[0].toUpperCase()} TOP 7 SCORECARD`;
                  }
                  return `${dayLabel.toUpperCase()} TOP 7 SCORECARD`;
                })()}
              </h2>
              <p className="text-xs text-slate-300 uppercase tracking-widest font-bold mt-1">
                Official daily standings based on win-rate, dominance rating & shot performance
              </p>
            </div>

            {/* Top 7 Table Container (Tight & Spacious Fill) */}
            <div className="relative z-10 my-auto bg-[#0D1326] border-2 border-[#4D78FF] rounded-2xl overflow-hidden shadow-2xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#4D78FF] text-xs uppercase text-white font-black h-14 border-b-2 border-white/20">
                  <tr>
                    <th className="px-5 py-4 w-20">Rank</th>
                    <th className="px-5 py-4">Player / Team</th>
                    <th className="px-5 py-4">Matches (W-L)</th>
                    <th className="px-5 py-4">Points</th>
                    <th className="px-5 py-4">Dominance</th>
                    <th className="px-5 py-4">Shot Highlights</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-[#0D1326]">
                  {filteredTop7.map((p, i) => (
                    <tr key={p.id || i} className={i % 2 === 0 ? 'bg-[#0D1326]' : 'bg-[#121A33]'}>
                      <td className="px-5 py-3.5 font-black font-mono text-base">
                        {i === 0 ? (
                          <span className="text-white font-black flex items-center justify-center gap-1 bg-[#E65C31] px-3 py-1 rounded-lg shadow-md shadow-[#E65C31]/30">
                            <Crown size={18} /> #1
                          </span>
                        ) : i === 1 ? (
                          <span className="text-white font-black flex items-center justify-center gap-1 bg-[#4D78FF] px-3 py-1 rounded-lg shadow-md shadow-[#4D78FF]/30">
                            <Medal size={16} /> #2
                          </span>
                        ) : i === 2 ? (
                          <span className="text-black font-black flex items-center justify-center gap-1 bg-amber-400 px-3 py-1 rounded-lg shadow-md">
                            <Medal size={16} /> #3
                          </span>
                        ) : (
                          <span className="text-slate-300 font-extrabold px-3 py-1 bg-white/10 rounded-lg inline-block text-center">#{i + 1}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-white text-base">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#4D78FF] text-white flex items-center justify-center font-black text-xs shadow-inner shrink-0">
                            {p.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-white font-black text-base uppercase tracking-tight">{p.name}</div>
                            {p.teamName && <div className="text-[11px] font-semibold text-slate-300">{p.teamName}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono font-black text-white text-base">
                        {p.wins} - {p.losses} <span className="text-xs text-slate-300 font-semibold">({(p.gamesWon || 0) - (p.gamesLost || 0)} GD)</span>
                      </td>
                      <td className="px-5 py-3.5 font-mono font-black text-[#4D78FF] text-lg">
                        {p.pointsScored} pts
                      </td>
                      <td className="px-5 py-3.5 font-mono font-black text-[#E65C31] text-lg">
                        {p.dominanceScore}/10
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {p.viboraCount > 0 && (
                            <span className="px-2.5 py-1 rounded-md text-[10px] font-black bg-cyan-500/30 text-cyan-200 border border-cyan-400/50">
                              ⚡ {p.viboraCount} Vibora
                            </span>
                          )}
                          {p.smashCount > 0 && (
                            <span className="px-2.5 py-1 rounded-md text-[10px] font-black bg-[#E65C31]/30 text-orange-200 border border-[#E65C31]/50">
                              💥 {p.smashCount} Smash
                            </span>
                          )}
                          {p.winnerCount > 0 && (
                            <span className="px-2.5 py-1 rounded-md text-[10px] font-black bg-[#4D78FF]/30 text-blue-200 border border-[#4D78FF]/50">
                              🏆 {p.winnerCount} Winners
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Official Footer */}
            <div className="relative z-10 pt-5 mt-4 border-t border-white/10 flex items-center justify-between text-xs font-mono text-slate-400">
              <div>
                VERIFIED OFFICIAL DOCUMENT • <span className="text-[#4D78FF] font-bold">MATCH UP COMPETITION ENGINE</span>
              </div>
              <div className="text-right tracking-widest font-bold text-[#E65C31]">
                WWW.MATCHUP.COM.PK
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
