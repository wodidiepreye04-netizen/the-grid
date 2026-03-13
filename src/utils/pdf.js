/** THE GRID — PDF Report Generator */
import jsPDF from 'jspdf';

/**
 * Generate and download a PDF report
 * @param {object} report - Report data from daily_reports table
 * @param {Array} blocks - Block details array
 * @param {Array} checkIns - Check-in records
 */
export function downloadPDF(report, blocks, checkIns) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const margin = 20;
  const textW = W - margin * 2;
  let y = margin;

  // ── HEADER ──
  doc.setFontSize(8);
  doc.setTextColor(102);
  doc.text('THE GRID — DAILY OPERATING SYSTEM', margin, y);
  y += 6;

  doc.setFontSize(18);
  doc.setTextColor(0);
  doc.text(`Daily Report: ${report.report_date}`, margin, y);
  y += 10;

  // ── SCORES ──
  doc.setFontSize(10);
  doc.setTextColor(51);
  doc.text(`Completion: ${report.completion_score}%`, margin, y);
  doc.text(`Blocks: ${report.completed_blocks}/${report.total_blocks} completed`, margin + 60, y);
  doc.text(`Skipped: ${report.skipped_blocks}`, margin + 130, y);
  y += 8;

  if (report.deep_work_integrity != null) {
    doc.text(`Deep Work Integrity: ${report.deep_work_integrity}%`, margin, y);
    y += 8;
  }

  // ── DIVIDER ──
  doc.setDrawColor(200);
  doc.line(margin, y, W - margin, y);
  y += 6;

  // ── BLOCK BREAKDOWN ──
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text('Block-by-Block Breakdown', margin, y);
  y += 6;

  doc.setFontSize(8);
  doc.setTextColor(102);
  doc.text('TIME', margin, y);
  doc.text('BLOCK', margin + 25, y);
  doc.text('STATUS', margin + 95, y);
  doc.text('REASON', margin + 120, y);
  y += 5;

  doc.setDrawColor(230);
  doc.line(margin, y, W - margin, y);
  y += 4;

  doc.setTextColor(51);
  for (const block of blocks) {
    if (y > 270) {
      doc.addPage();
      y = margin;
    }

    const ci = checkIns.find(c => c.block_id === block.id);
    const startTime = block.start_time ? block.start_time.slice(0, 5) : '--:--';
    const status = block.status || 'pending';
    const reason = ci?.skip_reason || '';

    // Color-code status
    if (status === 'completed' || status === 'started') doc.setTextColor(0, 180, 40);
    else if (status === 'skipped') doc.setTextColor(220, 40, 40);
    else if (status === 'delayed') doc.setTextColor(200, 140, 0);
    else doc.setTextColor(150);

    doc.text(startTime, margin, y);
    doc.setTextColor(51);
    doc.text(block.name.substring(0, 35), margin + 25, y);

    if (status === 'completed' || status === 'started') doc.setTextColor(0, 180, 40);
    else if (status === 'skipped') doc.setTextColor(220, 40, 40);
    else if (status === 'delayed') doc.setTextColor(200, 140, 0);
    else doc.setTextColor(150);

    doc.text(status.toUpperCase(), margin + 95, y);

    if (reason) {
      doc.setTextColor(150);
      doc.text(reason.substring(0, 30), margin + 120, y);
    }

    y += 5;
  }

  y += 6;
  doc.setDrawColor(200);
  doc.line(margin, y, W - margin, y);
  y += 8;

  // ── VERDICT ──
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text('Performance Verdict', margin, y);
  y += 6;

  doc.setFontSize(9);
  doc.setTextColor(51);
  const verdictLines = doc.splitTextToSize(report.verdict, textW);
  doc.text(verdictLines, margin, y);
  y += verdictLines.length * 5 + 4;

  // ── RECOMMENDATION ──
  if (report.recommendation) {
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text('Recommendation for Tomorrow', margin, y);
    y += 6;

    doc.setFontSize(9);
    doc.setTextColor(51);
    const recLines = doc.splitTextToSize(report.recommendation, textW);
    doc.text(recLines, margin, y);
    y += recLines.length * 5;
  }

  // ── FOOTER ──
  y = doc.internal.pageSize.getHeight() - 10;
  doc.setFontSize(7);
  doc.setTextColor(170);
  doc.text('THE GRID — Because discipline without enforcement is just intention.', margin, y);

  // Download
  doc.save(`TheGrid_Report_${report.report_date}.pdf`);
}
