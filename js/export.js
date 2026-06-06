// ════════════════════════════════════════════
//  export.js — Export CSV & PDF
//  v2.1 — Bug fixes + improvements
// ════════════════════════════════════════════

import { fmt, safeNum, showToast, showLoading, hideLoading } from "./utils.js";

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

/**
 * Escape nilai field CSV secara benar:
 * - Bungkus dengan tanda kutip ganda
 * - Escape kutip ganda internal dengan dua kutip ganda ("")
 */
function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Jika ada koma, newline, atau tanda kutip → bungkus dan escape
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Dapatkan rentang bulan dari data untuk nama file
 * Contoh: "Jan2025-Jun2025"
 */
function getDateRange(rows) {
  if (!rows.length) return { display: new Date().toISOString().split('T')[0], filename: new Date().toISOString().split('T')[0] };
  const sorted  = [...rows].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
  const first   = new Date(sorted[0].tanggal);
  const last    = new Date(sorted[sorted.length - 1].tanggal);
  // display: "Mei 2026" (dengan spasi) — untuk teks di PDF
  const fmtDisplay = d =>
    d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
  // filename: "Mei2026" (tanpa spasi) — untuk nama file
  const fmtFile = d =>
    d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }).replace(/\s+/g, '');
  const displayFirst = fmtDisplay(first), displayLast = fmtDisplay(last);
  const fileFirst    = fmtFile(first),    fileLast    = fmtFile(last);
  if (fileFirst === fileLast) return { display: displayFirst, filename: fileFirst };
  return {
    display:  `${displayFirst} sd ${displayLast}`,
    filename: `${fileFirst}_sd_${fileLast}`,
  };
}

// ── EXPORT RENTANG WAKTU ─────────────────────────────────────
/**
 * Filter data berdasarkan rentang tanggal lalu export CSV atau PDF
 * @param {'csv'|'pdf'} type
 * @param {string} from — format YYYY-MM-DD
 * @param {string} to   — format YYYY-MM-DD
 */
export function exportRange(type, from, to) {
  if (!window.data || window.data.length === 0) {
    showToast('Tidak ada data untuk diekspor.', 'error');
    return;
  }
  if (!from || !to) {
    showToast('Pilih rentang tanggal terlebih dahulu.', 'error');
    return;
  }
  if (from > to) {
    showToast('Tanggal awal tidak boleh lebih dari tanggal akhir.', 'error');
    return;
  }

  // Simpan data asli, ganti sementara dengan data yang difilter
  const original = window.data;
  window.data = original.filter(r => r.tanggal >= from && r.tanggal <= to);

  if (window.data.length === 0) {
    window.data = original;
    showToast('Tidak ada data pada rentang tanggal tersebut.', 'error');
    return;
  }

  if (type === 'csv') exportCSV();
  else exportPDF();

  window.data = original;
}

// ── MODAL RENTANG WAKTU ──────────────────────────────────────
export function openExportRangeModal() {
  // Buat modal jika belum ada
  let modal = document.getElementById('export-range-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'export-range-modal';
    modal.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:3500;
      display:flex;align-items:center;justify-content:center;
    `;
    modal.innerHTML = `
      <div style="background:var(--surface);border-radius:var(--radius);padding:24px;
                  max-width:340px;width:90%;box-shadow:0 16px 40px rgba(0,0,0,0.2);">
        <div style="font-size:16px;font-weight:800;margin-bottom:16px;">📅 Export Rentang Waktu</div>
        <div style="margin-bottom:12px;">
          <label style="font-size:12px;font-weight:700;color:var(--text2);display:block;margin-bottom:4px;">Dari Tanggal</label>
          <input type="date" id="export-range-from"
            style="width:100%;padding:10px;border:1px solid var(--border);border-radius:var(--radius-sm);
                   background:var(--surface2);color:var(--text);font-size:14px;font-family:var(--font);box-sizing:border-box;">
        </div>
        <div style="margin-bottom:20px;">
          <label style="font-size:12px;font-weight:700;color:var(--text2);display:block;margin-bottom:4px;">Sampai Tanggal</label>
          <input type="date" id="export-range-to"
            style="width:100%;padding:10px;border:1px solid var(--border);border-radius:var(--radius-sm);
                   background:var(--surface2);color:var(--text);font-size:14px;font-family:var(--font);box-sizing:border-box;">
        </div>
        <div style="display:flex;gap:8px;margin-bottom:8px;">
          <button onclick="window.exportRange('csv', document.getElementById('export-range-from').value, document.getElementById('export-range-to').value); document.getElementById('export-range-modal').remove();"
            style="flex:1;padding:11px;border-radius:var(--radius-sm);background:var(--accent);color:#fff;
                   border:none;font-size:13px;font-weight:700;cursor:pointer;font-family:var(--font);">
            📊 CSV
          </button>
          <button onclick="window.exportRange('pdf', document.getElementById('export-range-from').value, document.getElementById('export-range-to').value); document.getElementById('export-range-modal').remove();"
            style="flex:1;padding:11px;border-radius:var(--radius-sm);background:var(--accent);color:#fff;
                   border:none;font-size:13px;font-weight:700;cursor:pointer;font-family:var(--font);">
            📄 PDF
          </button>
        </div>
        <button onclick="document.getElementById('export-range-modal').remove();"
          style="width:100%;padding:10px;border-radius:var(--radius-sm);background:var(--surface2);color:var(--text2);
                 border:1px solid var(--border);font-size:13px;cursor:pointer;font-family:var(--font);">
          Batal
        </button>
      </div>
    `;
    document.body.appendChild(modal);

    // Set default: bulan ini
    const now  = new Date();
    const y    = now.getFullYear();
    const m    = String(now.getMonth() + 1).padStart(2, '0');
    const last = new Date(y, now.getMonth() + 1, 0).getDate();
    document.getElementById('export-range-from').value = `${y}-${m}-01`;
    document.getElementById('export-range-to').value   = `${y}-${m}-${last}`;
  } else {
    modal.style.display = 'flex';
  }
}

export function exportCSV() {
  try {
    if (!window.data || window.data.length === 0) {
      showToast('Tidak ada data untuk diekspor.', 'error');
      return;
    }

    const sorted = getSortedData();
    const groups = groupByMonth(sorted);

    // Hitung ringkasan keseluruhan
    const totalIn  = sorted.filter(r => r.jenis === 'Pemasukan') .reduce((s, r) => s + safeNum(r.nominal), 0);
    const totalOut = sorted.filter(r => r.jenis === 'Pengeluaran').reduce((s, r) => s + safeNum(r.nominal), 0);
    const saldo    = totalIn - totalOut;

    const lines = [
      // Info file
      `${escapeCSV('Laporan Keuangan — Zaku App')}`,
      `${escapeCSV('Digenerate:')},${ escapeCSV(new Date().toLocaleString('id-ID'))}`,
      `${escapeCSV('Total Pemasukan:')},${escapeCSV(fmt(totalIn))}`,
      `${escapeCSV('Total Pengeluaran:')},${escapeCSV(fmt(totalOut))}`,
      `${escapeCSV('Saldo Bersih:')},${escapeCSV(fmt(saldo))}`,
      '', // baris kosong pemisah
      // Header kolom
      ['ID','Tanggal','Bulan','Jenis','Kategori','Metode','Nominal','Keterangan'].map(escapeCSV).join(','),
    ];

    Object.entries(groups).forEach(([monthLabel, rows]) => {
      // Baris separator bulan
      lines.push([`=== ${monthLabel} ===`,'','','','','','',''].map(escapeCSV).join(','));

      rows.forEach(d => {
        lines.push([
          d.id,
          d.tanggal,
          monthLabel,
          d.jenis,
          d.kategori,
          d.metode,
          safeNum(d.nominal),
          d.keterangan,  // escapeCSV akan handle koma/kutip di dalam keterangan
        ].map(escapeCSV).join(','));
      });

      const mIn  = rows.filter(r => r.jenis === 'Pemasukan') .reduce((s, r) => s + safeNum(r.nominal), 0);
      const mOut = rows.filter(r => r.jenis === 'Pengeluaran').reduce((s, r) => s + safeNum(r.nominal), 0);
      lines.push(['','','','','','',
        escapeCSV(`Subtotal ${monthLabel}`),
        escapeCSV(`Pemasukan: ${fmt(mIn)} | Pengeluaran: ${fmt(mOut)} | Saldo: ${fmt(mIn - mOut)}`),
      ].join(','));
      lines.push(''); // baris kosong antar bulan
    });

    const csvContent = '\uFEFF' + lines.join('\n'); // BOM untuk Excel Indonesia
    const blob       = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url        = URL.createObjectURL(blob);
    const anchor     = document.createElement('a');
    anchor.href      = url;
    const dateRange  = getDateRange(sorted);
    anchor.download  = `Zaku_${dateRange.filename}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    showToast('✅ CSV berhasil diunduh!');
  } catch (err) {
    console.error('Export CSV error:', err);
    showToast('❌ Gagal mengekspor CSV: ' + err.message, 'error');
  }
}

// ── EXPORT PDF ────────────────────────────────────────────────
export function exportPDF() {
  try {
    // Guard: pastikan library tersedia
    if (!window.jspdf || !window.jspdf.jsPDF) {
      showToast('❌ Library PDF belum dimuat. Coba refresh halaman.', 'error');
      return;
    }

    if (!window.data || window.data.length === 0) {
      showToast('Tidak ada data untuk diekspor.', 'error');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc       = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Guard: pastikan autoTable tersedia
    if (typeof doc.autoTable !== 'function') {
      showToast('❌ Plugin tabel PDF belum dimuat. Coba refresh halaman.', 'error');
      return;
    }

    showLoading();

    const sorted = getSortedData();
    const groups = groupByMonth(sorted);

    // Hitung ringkasan keseluruhan
    const totalIn  = sorted.filter(r => r.jenis === 'Pemasukan') .reduce((s, r) => s + safeNum(r.nominal), 0);
    const totalOut = sorted.filter(r => r.jenis === 'Pengeluaran').reduce((s, r) => s + safeNum(r.nominal), 0);
    const saldo    = totalIn - totalOut;

    // ── HALAMAN: HEADER UTAMA ────────────────────────────────
    // Judul
    doc.setFillColor(78, 110, 90); // warna brand Zaku
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Laporan Keuangan', 14, 13);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Zaku — Navigasi Keuangan Pribadi', 14, 21);

    // Tanggal generate (pojok kanan)
    doc.setFontSize(8);
    doc.text(`Digenerate: ${new Date().toLocaleString('id-ID')}`, 196, 10, { align: 'right' });
    const dateRange = getDateRange(sorted);
    doc.text(`Periode: ${dateRange.display}`, 196, 16, { align: 'right' });

    // ── RINGKASAN KEUANGAN ───────────────────────────────────
    let y = 38;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Ringkasan Keuangan', 14, y);
    y += 2;

    // Kotak ringkasan 3 kolom
    const summaryData = [
      { label: 'Total Pemasukan', value: fmt(totalIn),  color: [5, 150, 105] },
      { label: 'Total Pengeluaran', value: fmt(totalOut), color: [220, 38, 38] },
      { label: 'Saldo Bersih', value: fmt(saldo), color: saldo >= 0 ? [5, 150, 105] : [220, 38, 38] },
    ];

    summaryData.forEach((item, i) => {
      const x = 14 + i * 62;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, y + 2, 58, 16, 2, 2, 'F');
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(item.label, x + 4, y + 8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...item.color);
      doc.text(item.value, x + 4, y + 14);
    });

    y += 24;

    // ── TABEL PER BULAN ──────────────────────────────────────
    Object.entries(groups).forEach(([monthLabel, rows]) => {
      // Header bulan — pastikan tidak terpotong di akhir halaman
      if (y > 245) {
        doc.addPage();
        y = 14;
      }

      // Hitung subtotal bulan
      const mIn  = rows.filter(r => r.jenis === 'Pemasukan') .reduce((s, r) => s + safeNum(r.nominal), 0);
      const mOut = rows.filter(r => r.jenis === 'Pengeluaran').reduce((s, r) => s + safeNum(r.nominal), 0);

      doc.setFillColor(78, 110, 90);
      doc.roundedRect(14, y, 182, 7, 1, 1, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(monthLabel, 17, y + 5);
      y += 9;

      // Subtotal bar di bawah header bulan — full width agar tidak terpotong
      doc.setFillColor(235, 242, 238);
      doc.rect(14, y, 182, 6, 'F');
      doc.setTextColor(50, 100, 70);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(
        `Masuk: ${fmt(mIn)}   |   Keluar: ${fmt(mOut)}   |   Saldo: ${fmt(mIn - mOut)}`,
        105, y + 4, { align: 'center' }
      );
      y += 7;

      // Tabel transaksi
      doc.autoTable({
        startY: y,
        head: [['Tanggal', 'Jenis', 'Kategori', 'Keterangan', 'Metode', 'Nominal']],
        body: rows.map(d => {
          const ket = d.keterangan ?? '';
          const nom = safeNum(d.nominal);
          return [
            d.tanggal,
            d.jenis,
            d.kategori,
            ket.length > 35 ? ket.substring(0, 33) + '…' : ket,
            d.metode || '-',
            (d.jenis === 'Pengeluaran' ? '-' : '+') + fmt(nom),
          ];
        }),
        styles:       { fontSize: 7.5, cellPadding: 2 },
        headStyles:   { fillColor: [241, 245, 249], textColor: [50, 50, 50], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 22 },  // Tanggal
          1: { cellWidth: 22 },  // Jenis
          2: { cellWidth: 30 },  // Kategori
          3: { cellWidth: 60 },  // Keterangan
          4: { cellWidth: 24 },  // Metode
          5: { cellWidth: 28, halign: 'right' }, // Nominal
        },
        alternateRowStyles: { fillColor: [252, 253, 254] },
        didParseCell: (data) => {
          if (data.column.index === 5 && data.section === 'body') {
            const val = String(data.cell.raw || '');
            data.cell.styles.textColor = val.startsWith('-') ? [220, 38, 38] : [5, 150, 105];
            data.cell.styles.fontStyle = 'bold';
          }
        },
        margin: { left: 14, right: 14 },
      });

      y = doc.lastAutoTable.finalY + 8;
    });

    // ── FOOTER TIAP HALAMAN ──────────────────────────────────
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.setFont('helvetica', 'normal');
      doc.text('Zaku — Navigasi Keuangan Pribadi  |  zaku.my.id', 14, 292);
      doc.text(`Halaman ${i} / ${pageCount}`, 196, 292, { align: 'right' });
    }

    const filename = `Zaku_Laporan_${dateRange.filename}.pdf`;
    doc.save(filename);
    showToast('✅ PDF berhasil diunduh!');
  } catch (err) {
    console.error('Export PDF error:', err);
    showToast('❌ Gagal mengekspor PDF: ' + err.message, 'error');
  } finally {
    hideLoading();
  }
}


