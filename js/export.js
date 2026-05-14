// ════════════════════════════════════════════
//  export.js — Export CSV & PDF
// ════════════════════════════════════════════

import { fmt } from "./utils.js";
import { showToast } from "./utils.js";

// ── HELPER ────────────────────────────────────────────────────

function getSortedData() {
  return [...window.data].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
}

function groupByMonth(rows) {
  const groups = {};
  rows.forEach(r => {
    const key = `${r.bulan} ${r.tahun}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });
  return groups;
}

// ── EXPORT CSV ────────────────────────────────────────────────
export function exportCSV() {
  const sorted = getSortedData();
  const groups = groupByMonth(sorted);
  const lines  = ['ID,Tanggal,Bulan,Jenis,Kategori,Metode,Nominal,Keterangan'];

  Object.entries(groups).forEach(([monthLabel, rows]) => {
    lines.push(`,,,,,,,"=== ${monthLabel} ==="`);

    rows.forEach(d => {
      lines.push([
        d.id, d.tanggal, monthLabel,
        d.jenis, d.kategori, d.metode,
        d.nominal, `"${d.keterangan}"`,
      ].join(','));
    });

    const totalIn  = rows.filter(r => r.jenis === 'Pemasukan') .reduce((s, r) => s + Number(r.nominal), 0);
    const totalOut = rows.filter(r => r.jenis === 'Pengeluaran').reduce((s, r) => s + Number(r.nominal), 0);
    lines.push(`,,,,,,,"Subtotal Pemasukan: Rp${Math.round(totalIn).toLocaleString('id-ID')} | Pengeluaran: Rp${Math.round(totalOut).toLocaleString('id-ID')}"`);
  });

  const csv      = 'data:text/csv;charset=utf-8,\uFEFF' + lines.join('\n');
  const anchor   = document.createElement('a');
  anchor.href    = encodeURI(csv);
  anchor.download = `Dompetku_v2_${new Date().toISOString().split('T')[0]}.csv`;
  anchor.click();
  showToast('CSV berhasil diunduh!');
}

// ── EXPORT PDF ────────────────────────────────────────────────
export function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc       = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const sorted    = getSortedData();
  const groups    = groupByMonth(sorted);

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Laporan Keuangan — Dompetku v2', 14, 16);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120);
  doc.text(`Digenerate: ${new Date().toLocaleString('id-ID')}`, 14, 22);

  let startY = 28;

  Object.entries(groups).forEach(([monthLabel, rows]) => {
    // Header bulan
    doc.setFillColor(37, 99, 235);
    doc.rect(14, startY, 182, 7, 'F');
    doc.setTextColor(255);
    doc.setFont('helvetica', 'bold');
    doc.text(`  ${monthLabel}`, 14, startY + 5);
    startY += 9;

    // Tabel transaksi
    doc.autoTable({
      startY,
      head: [['Tanggal', 'Jenis', 'Kategori', 'Keterangan', 'Nominal']],
      body: rows.map(d => [
        d.tanggal,
        d.jenis,
        d.kategori,
        d.keterangan.length > 30 ? d.keterangan.substring(0, 28) + '…' : d.keterangan,
        (d.jenis === 'Pengeluaran' ? '-' : '+') + 'Rp' + Math.round(d.nominal).toLocaleString('id-ID'),
      ]),
      styles:     { fontSize: 8 },
      headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0] },
      didParseCell: (data) => {
        if (data.column.index === 4 && data.section === 'body') {
          const val = data.cell.raw || '';
          data.cell.styles.textColor = val.startsWith('-') ? [220, 38, 38] : [5, 150, 105];
        }
      },
    });

    startY = doc.lastAutoTable.finalY + 10;
  });

  doc.save(`Laporan_Dompetku_${new Date().toISOString().split('T')[0]}.pdf`);
  showToast('PDF berhasil diunduh!');
}

// Expose ke window untuk inline HTML onclick
window.exportCSV = exportCSV;
window.exportPDF = exportPDF;
