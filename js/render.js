// ════════════════════════════════════════════
//  render.js — Zaku App | Semua Fungsi Render Tampilan
// ════════════════════════════════════════════

import { MONTHS, ICONS, fmt, fmtS, getCCPeriod } from "./utils.js";

// ── HELPER: escape HTML untuk mencegah XSS ───────────────────
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let trendChart; // instance Chart.js

// ── HELPERS INTERNAL ─────────────────────────────────────────

function ccBarHTML(total, limit, cutoffLabel = '') {
  const pct   = Math.min(Math.round((total / limit) * 100), 100) || 0;
  const color = pct >= 90 ? 'var(--red)' : pct >= 70 ? 'var(--amber)' : 'var(--green)';
  const cutoff = cutoffLabel
    ? `<div style="font-size:11px;color:var(--text3);margin-top:8px;text-align:right;">${cutoffLabel}</div>`
    : '';
  return `
    <div class="cc-progress-wrap">
      <div class="cc-top">
        <span class="cc-top-label">Tagihan: ${fmt(total)}</span>
        <span class="cc-top-pct" style="color:${color}">${pct}% terpakai</span>
      </div>
      <div class="cc-track">
        <div class="cc-fill" style="width:${pct}%;background:${color}"></div>
      </div>
      <div class="cc-footer">
        <span>Limit: ${fmt(limit)}</span>
        <span>Sisa: ${fmt(limit - total)}</span>
      </div>
      ${cutoff}
    </div>`;
}

function barRowsHTML(obj, color = 'var(--accent)') {
  const sorted = Object.entries(obj).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) return '<div class="empty-state">Belum ada data</div>';
  const max = sorted[0][1];
  return sorted.map(([k, v]) => `
    <div class="bar-row">
      <div class="bar-label">${ICONS[k] || '•'} ${esc(k)}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${Math.round(v / max * 100)}%;background:${color}"></div>
      </div>
      <div class="bar-val">${fmtS(v)}</div>
    </div>`
  ).join('');
}

// ── HELPER: Hitung saldo per metode ──────────────────────────
// Transaksi CC (metode='Kartu Kredit') dianggap memotong saldo QRIS/Transfer
// karena CC hanya alat bayar, bukan rekening terpisah.
function calcBal(met) {
  const masuk = window.data
    .filter(r => r.metode === met && r.jenis === 'Pemasukan')
    .reduce((s, r) => s + Number(r.nominal), 0);

  const keluar = window.data
    .filter(r => {
      if (r.jenis !== 'Pengeluaran') return false;
      if (r.kategori === 'Bayar Tagihan CC') return false;
      // Pengeluaran CC dibebankan ke QRIS/Transfer
      if (r.metode === 'Kartu Kredit') return met === 'QRIS/Transfer';
      return r.metode === met;
    })
    .reduce((s, r) => s + Number(r.nominal), 0);

  return masuk - keluar;
}

// ── RENDER SUMMARY BAR ───────────────────────────────────────
function renderSummary(m, y, mIn, mOut) {
  // calcBal sudah menggabungkan pengeluaran CC ke QRIS/Transfer
  const totalSaldo = calcBal('Cash') + calcBal('QRIS/Transfer');

  const selisih  = mIn - mOut;
  const pctUsed  = mIn > 0 ? Math.min(Math.round(mOut / mIn * 100), 100) : (mOut > 0 ? 100 : 0);
  const fillColor = pctUsed >= 90 ? '#f87171' : pctUsed >= 70 ? '#fbbf24' : '#34d399';

  let badgeClass, badgeText;
  if (selisih > 0)      { badgeClass = 'surplus'; badgeText = '▲ Surplus'; }
  else if (selisih < 0) { badgeClass = 'defisit'; badgeText = '▼ Defisit'; }
  else                  { badgeClass = 'impas';   badgeText = '= Impas'; }

  document.getElementById('b-summary').innerHTML = `
    <div class="summary-bar">
      <div class="summary-top">
        <div>
          <div class="summary-label">Total Saldo</div>
          <div class="summary-total">${fmt(totalSaldo)}</div>
        </div>
        <div class="summary-badge ${badgeClass}">${badgeText} ${fmtS(Math.abs(selisih))}</div>
      </div>
      <div class="summary-row">
        <div class="summary-item">
          <div class="summary-item-label">Pemasukan ${m}</div>
          <div class="summary-item-val in">+${fmtS(mIn)}</div>
        </div>
        <div class="summary-item">
          <div class="summary-item-label">Pengeluaran ${m}</div>
          <div class="summary-item-val out">-${fmtS(mOut)}</div>
        </div>
      </div>
      <div class="summary-progress-wrap">
        <div class="summary-progress-label">
          <span>Penggunaan bulan ini</span>
          <span>${pctUsed}% dari pemasukan</span>
        </div>
        <div class="summary-track">
          <div class="summary-fill" style="width:${pctUsed}%;background:${fillColor}"></div>
        </div>
      </div>
    </div>`;
}

// ── RENDER BERANDA ────────────────────────────────────────────
export function renderBeranda() {
  const m = document.getElementById('b-month').value;
  const y = parseInt(document.getElementById('b-year').value);
  const rows = window.data.filter(d => d.bulan === m && parseInt(d.tahun) === y);

  const mIn  = rows.filter(r => r.jenis === 'Pemasukan').reduce((s, r) => s + r.nominal, 0);
  // Pengeluaran riil = semua pengeluaran bulan ini termasuk CC,
  // kecuali "Bayar Tagihan CC" agar tidak dobel hitung
  const mOut = rows
    .filter(r => r.jenis === 'Pengeluaran' && r.kategori !== 'Bayar Tagihan CC')
    .reduce((s, r) => s + r.nominal, 0);

  renderSummary(m, y, mIn, mOut);

  // calcBal sudah dipindah ke scope module (dipakai renderSummary & renderBeranda)

  document.getElementById('b-accounts').innerHTML = `
    <div class="stat-card c-purple">
      <div class="stat-label">Saldo Cash</div>
      <div class="stat-value">${fmt(calcBal('Cash'))}</div>
    </div>
    <div class="stat-card c-blue">
      <div class="stat-label">Saldo QRIS/Bank</div>
      <div class="stat-value">${fmt(calcBal('QRIS/Transfer'))}</div>
    </div>`;

  document.getElementById('b-stats').innerHTML = `
    <div class="stat-card c-green">
      <div class="stat-label">Pemasukan (${m})</div>
      <div class="stat-value">${fmt(mIn)}</div>
    </div>
    <div class="stat-card c-red">
      <div class="stat-label">Pengeluaran Riil</div>
      <div class="stat-value">${fmt(mOut)}</div>
    </div>`;

  const recent = [...rows]
    .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))
    .slice(0, 5);

  document.getElementById('b-recent').innerHTML = recent.map(r => `
    <div class="row-item">
      <div class="row-icon" style="background:var(--surface2)">${ICONS[r.kategori] || '📌'}</div>
      <div class="row-info">
        <div class="row-name">${esc(r.keterangan)}</div>
        <div class="row-meta">${esc(r.kategori)} · ${esc(r.tanggal)}</div>
      </div>
      <div class="row-right">
        <div class="row-amount ${r.jenis === 'Pemasukan' ? 'in' : 'out'}">${fmt(r.nominal)}</div>
        <div class="row-actions">
          <button class="btn-action" onclick="copyToForm('${esc(r.id)}')">📋</button>
        </div>
      </div>
    </div>`
  ).join('') || '<div class="empty-state">Belum ada aktivitas di Zaku</div>';

  const ccRows  = window.data.filter(r => r.cc && getCCPeriod(r.tanggal).bulan === m && getCCPeriod(r.tanggal).tahun === y);
  const ccTotal = ccRows.reduce((s, r) => s + Number(r.nominal), 0);
  document.getElementById('b-cc').innerHTML = ccBarHTML(
    ccTotal, window.settings.ccLimit, `Cut-off tgl ${window.settings.ccCutoff}`
  );
}

// ── RENDER TRANSAKSI ──────────────────────────────────────────
export function renderTransaksi() {
  const m = document.getElementById('t-month').value;
  const y = parseInt(document.getElementById('t-year').value);
  const j = document.getElementById('t-jenis').value;
  const k = document.getElementById('t-kat').value;

  let rows = window.data.filter(d => d.bulan === m && parseInt(d.tahun) === y);
  if (j) rows = rows.filter(r => r.jenis === j);
  if (k) rows = rows.filter(r => r.kategori === k);
  rows = [...rows].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

  if (!rows.length) {
    document.getElementById('t-list').innerHTML = '<div class="empty-state">Tidak ada data</div>';
    return;
  }

  // ── Grouping per hari ────────────────────────────────────────
  const today     = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

  function dayLabel(tgl) {
    // Parse manual agar tidak kena UTC offset bug
    const [yy, mm, dd] = tgl.split('-').map(Number);
    const d = new Date(yy, mm - 1, dd); // local midnight
    if (d.getTime() === today.getTime())     return 'Hari ini';
    if (d.getTime() === yesterday.getTime()) return 'Kemarin';
    return d.toLocaleDateString('id-ID', { weekday:'short', day:'numeric', month:'long', year:'numeric' });
  }

  // Kelompokkan rows per tanggal
  const groups = [];
  let lastTgl = null;
  rows.forEach(r => {
    if (r.tanggal !== lastTgl) {
      groups.push({ tanggal: r.tanggal, rows: [] });
      lastTgl = r.tanggal;
    }
    groups[groups.length - 1].rows.push(r);
  });

  document.getElementById('t-list').innerHTML = groups.map(g => {
    const subtotal = g.rows.reduce((s, r) => {
      return r.jenis === 'Pemasukan' ? s + r.nominal : s - r.nominal;
    }, 0);
    const subtotalClass = subtotal >= 0 ? 'in' : 'out';
    const subtotalStr   = (subtotal >= 0 ? '+' : '') + fmt(subtotal);

    const rowsHTML = g.rows.map(r => `
      <div class="row-item">
        <div class="row-swipe-inner">
          <div class="row-icon" style="background:var(--surface2)">${ICONS[r.kategori] || '📌'}</div>
          <div class="row-info">
            <div class="row-name">${esc(r.keterangan)}</div>
            <div class="row-meta">${esc(r.kategori)}</div>
          </div>
          <div class="row-right">
            <div class="row-amount ${r.jenis === 'Pemasukan' ? 'in' : 'out'}">${r.jenis === 'Pemasukan' ? '+' : '-'}${fmt(r.nominal)}</div>
            <div class="row-actions">
              <button class="btn-action" onclick="editRecord('${esc(r.id)}')">✏️</button>
              <button class="btn-action" onclick="hapusRecord('${esc(r.id)}')">🗑️</button>
            </div>
          </div>
        </div>
      </div>`).join('');

    return `
      <div class="t-day-group">
        <div class="t-day-header">
          <span class="t-day-label">${dayLabel(g.tanggal)}</span>
          <span class="t-day-subtotal ${subtotalClass}">${subtotalStr}</span>
        </div>
        ${rowsHTML}
      </div>`;
  }).join('');
}

// ── RENDER ANALITIK ───────────────────────────────────────────
export function renderAnalitik() {
  const m = document.getElementById('a-month').value;
  const y = parseInt(document.getElementById('a-year').value);

  document.getElementById('y-label').textContent     = y;
  document.getElementById('y-label-kat').textContent = y;
  document.getElementById('y-label-top').textContent = y;
  document.getElementById('y-label-trend').textContent   = y;
  document.getElementById('a-label-proyeksi').textContent    = `${m} ${y}`;
  document.getElementById('a-label-perbandingan').textContent = `${m} vs sebelumnya`;

  const yearRows    = window.data.filter(r => parseInt(r.tahun) === y);
  const yIn         = yearRows.filter(r => r.jenis === 'Pemasukan').reduce((s, r) => s + r.nominal, 0);
  const yOutRows    = yearRows.filter(r => r.jenis === 'Pengeluaran' && r.kategori !== 'Bayar Tagihan CC');
  const yOut        = yOutRows.reduce((s, r) => s + r.nominal, 0);
  const monthsElapsed = (y === new Date().getFullYear()) ? new Date().getMonth() + 1 : 12;

  document.getElementById('y-stats').innerHTML = `
    <div class="stat-card c-blue"><div class="stat-label">Masuk</div><div class="stat-value">${fmtS(yIn)}</div></div>
    <div class="stat-card c-red"><div class="stat-label">Keluar</div><div class="stat-value">${fmtS(yOut)}</div></div>
    <div class="stat-card c-green"><div class="stat-label">Saldo</div><div class="stat-value">${fmtS(yIn - yOut)}</div></div>
    <div class="stat-card c-amber"><div class="stat-label">Avg/Bln</div><div class="stat-value">${fmtS(yOut / monthsElapsed)}</div></div>`;

  const yKat = {};
  yOutRows.forEach(r => { yKat[r.kategori] = (yKat[r.kategori] || 0) + r.nominal; });
  document.getElementById('y-kat').innerHTML = barRowsHTML(yKat, 'var(--amber)');

  const top5 = [...yOutRows].sort((a, b) => b.nominal - a.nominal).slice(0, 5);
  document.getElementById('y-top-list').innerHTML = top5.map(r => `
    <div class="row-item">
      <div class="row-info">
        <div class="row-name">${esc(r.keterangan)}</div>
        <div class="row-meta">${esc(r.tanggal)}</div>
      </div>
      <div class="row-right row-amount out">-${fmt(r.nominal)}</div>
    </div>`
  ).join('') || '<div class="empty-state">Belum ada data</div>';

  document.getElementById('a-label-bulan').textContent = m;
  document.getElementById('a-label-masuk').textContent = m;

  const monthRows = window.data.filter(r => r.bulan === m && parseInt(r.tahun) === y);
  const katB   = {};
  const masukB = {};
  monthRows.filter(r => r.jenis === 'Pengeluaran' && r.kategori !== 'Bayar Tagihan CC')
           .forEach(r => { katB[r.kategori]  = (katB[r.kategori]  || 0) + r.nominal; });
  monthRows.filter(r => r.jenis === 'Pemasukan')
           .forEach(r => { masukB[r.kategori] = (masukB[r.kategori] || 0) + r.nominal; });

  document.getElementById('a-kat').innerHTML   = barRowsHTML(katB,   'var(--red)');
  document.getElementById('a-masuk').innerHTML = barRowsHTML(masukB, 'var(--green)');

  // ── BARU: Proyeksi, Perbandingan, Tren Kategori ──
  renderProyeksi(m, y, monthRows);
  renderPerbandingan(m, y);
  renderKategoriTrendPicker(y);

  // Render chart tahunan — gunakan rAF agar canvas sudah visible di DOM
  requestAnimationFrame(() => renderChart());
}

// ── PROYEKSI AKHIR BULAN ──────────────────────────────────────
function renderProyeksi(m, y, monthRows) {
  const el = document.getElementById('a-proyeksi');
  if (!el) return;

  const now      = new Date();
  const isCurrentMonth = (m === MONTHS[now.getMonth()] && y === now.getFullYear());

  const mIn  = monthRows.filter(r => r.jenis === 'Pemasukan').reduce((s, r) => s + Number(r.nominal), 0);
  const mOut = monthRows.filter(r => r.jenis === 'Pengeluaran' && r.kategori !== 'Bayar Tagihan CC')
                        .reduce((s, r) => s + Number(r.nominal), 0);

  if (!isCurrentMonth) {
    const selisih   = mIn - mOut;
    const pct       = mIn > 0 ? Math.round(mOut / mIn * 100) : 0;
    const badgeColor = selisih >= 0 ? 'var(--green)' : 'var(--red)';
    el.innerHTML = `
      <div class="proyeksi-note">
        📅 ${m} ${y} sudah selesai — realisasi pengeluaran <b>${pct}%</b> dari pemasukan.
        Selisih: <b style="color:${badgeColor}">${selisih >= 0 ? '+' : ''}${fmt(selisih)}</b>
      </div>`;
    return;
  }

  const todayDate   = now.getDate();
  const daysInMonth = new Date(y, now.getMonth() + 1, 0).getDate();
  const daysLeft    = daysInMonth - todayDate;

  // Rata-rata pengeluaran harian berdasarkan data yang ada
  const firstTx   = monthRows.length
    ? new Date(Math.min(...monthRows.map(r => new Date(r.tanggal))))
    : now;
  const daysRecorded = Math.max(1, todayDate - firstTx.getDate() + 1);
  const avgDaily     = mOut / daysRecorded;
  const proyeksi     = Math.round(mOut + avgDaily * daysLeft);
  const selisihProy  = mIn - proyeksi;
  const pctProy      = mIn > 0 ? Math.round(proyeksi / mIn * 100) : 0;
  const colorProy    = pctProy >= 100 ? 'var(--red)' : pctProy >= 80 ? 'var(--amber)' : 'var(--green)';

  el.innerHTML = `
    <div class="proyeksi-grid">
      <div class="proyeksi-item">
        <div class="proyeksi-label">Pengeluaran s/d hari ini</div>
        <div class="proyeksi-val out">${fmt(mOut)}</div>
        <div class="proyeksi-sub">Hari ke-${todayDate} dari ${daysInMonth}</div>
      </div>
      <div class="proyeksi-item">
        <div class="proyeksi-label">Rata-rata / hari</div>
        <div class="proyeksi-val">${fmt(avgDaily)}</div>
        <div class="proyeksi-sub">Berdasarkan ${daysRecorded} hari tercatat</div>
      </div>
      <div class="proyeksi-item">
        <div class="proyeksi-label">Proyeksi akhir bulan</div>
        <div class="proyeksi-val" style="color:${colorProy}">${fmt(proyeksi)}</div>
        <div class="proyeksi-sub">${pctProy}% dari pemasukan</div>
      </div>
      <div class="proyeksi-item">
        <div class="proyeksi-label">Sisa ruang belanja</div>
        <div class="proyeksi-val" style="color:${selisihProy >= 0 ? 'var(--green)' : 'var(--red)'}">
          ${selisihProy >= 0 ? fmt(selisihProy) : '−' + fmt(Math.abs(selisihProy))}
        </div>
        <div class="proyeksi-sub">${daysLeft} hari tersisa</div>
      </div>
    </div>
    <div class="proyeksi-bar-wrap">
      <div class="proyeksi-bar-label">
        <span>Realisasi</span>
        <span>Proyeksi</span>
        <span>Pemasukan</span>
      </div>
      <div class="proyeksi-track">
        <div class="proyeksi-fill-actual"  style="width:${Math.min(mIn > 0 ? mOut/mIn*100 : 0, 100)}%"></div>
        <div class="proyeksi-fill-forecast" style="width:${Math.min(pctProy, 100)}%;opacity:.4"></div>
      </div>
    </div>`;
}

// ── PERBANDINGAN BULAN INI VS BULAN LALU ─────────────────────
function renderPerbandingan(m, y) {
  const el = document.getElementById('a-perbandingan');
  if (!el) return;

  const mIdx   = MONTHS.indexOf(m);
  const prevM  = mIdx === 0 ? MONTHS[11] : MONTHS[mIdx - 1];
  const prevY  = mIdx === 0 ? y - 1 : y;

  const currRows = window.data.filter(r =>
    r.bulan === m && parseInt(r.tahun) === y &&
    r.jenis === 'Pengeluaran' && r.kategori !== 'Bayar Tagihan CC'
  );
  const prevRows = window.data.filter(r =>
    r.bulan === prevM && parseInt(r.tahun) === prevY &&
    r.jenis === 'Pengeluaran' && r.kategori !== 'Bayar Tagihan CC'
  );

  // Kumpulkan semua kategori yang ada di salah satu bulan
  const allKats = [...new Set([...currRows, ...prevRows].map(r => r.kategori))];

  if (!allKats.length) {
    el.innerHTML = '<div class="empty-state">Belum ada data untuk dibandingkan</div>';
    return;
  }

  const currTot = currRows.reduce((s, r) => s + Number(r.nominal), 0);
  const prevTot = prevRows.reduce((s, r) => s + Number(r.nominal), 0);
  const totDiff = currTot - prevTot;
  const totPct  = prevTot > 0 ? Math.round((totDiff / prevTot) * 100) : null;

  // Header total
  let totalHtml = `
    <div class="perbandingan-total">
      <div class="perbandingan-header-col">${prevM}</div>
      <div class="perbandingan-header-col">${m}</div>
      <div class="perbandingan-header-col">Selisih</div>
    </div>
    <div class="perbandingan-total-row">
      <div class="perbandingan-val">${fmtS(prevTot)}</div>
      <div class="perbandingan-val">${fmtS(currTot)}</div>
      <div class="perbandingan-val" style="color:${totDiff > 0 ? 'var(--red)' : 'var(--green)'}">
        ${totDiff > 0 ? '+' : ''}${fmtS(totDiff)}${totPct !== null ? ` (${totPct > 0 ? '+' : ''}${totPct}%)` : ''}
      </div>
    </div>
    <div class="perbandingan-divider"></div>`;

  // Per kategori — urutkan dari selisih terbesar (kenaikan)
  const katData = allKats.map(kat => {
    const c = currRows.filter(r => r.kategori === kat).reduce((s, r) => s + Number(r.nominal), 0);
    const p = prevRows.filter(r => r.kategori === kat).reduce((s, r) => s + Number(r.nominal), 0);
    return { kat, c, p, diff: c - p };
  }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  const maxVal = Math.max(...katData.map(k => Math.max(k.c, k.p)), 1);

  const rowsHtml = katData.map(({ kat, c, p, diff }) => {
    const pct   = p > 0 ? Math.round((diff / p) * 100) : null;
    const color = diff > 0 ? 'var(--red)' : diff < 0 ? 'var(--green)' : 'var(--text3)';
    const wC    = Math.round(c / maxVal * 100);
    const wP    = Math.round(p / maxVal * 100);
    return `
      <div class="perbandingan-row">
        <div class="perbandingan-kat">${ICONS[kat] || '•'} ${esc(kat)}</div>
        <div class="perbandingan-bars">
          <div class="perbandingan-bar-wrap">
            <div class="perbandingan-bar prev" style="width:${wP}%"></div>
            <span class="perbandingan-bar-val">${p > 0 ? fmtS(p) : '—'}</span>
          </div>
          <div class="perbandingan-bar-wrap">
            <div class="perbandingan-bar curr" style="width:${wC}%"></div>
            <span class="perbandingan-bar-val">${c > 0 ? fmtS(c) : '—'}</span>
          </div>
        </div>
        <div class="perbandingan-diff" style="color:${color}">
          ${diff === 0 ? '=' : (diff > 0 ? '↑' : '↓')} ${diff !== 0 ? fmtS(Math.abs(diff)) : ''}
          ${pct !== null && diff !== 0 ? `<span class="perbandingan-pct">${Math.abs(pct)}%</span>` : ''}
        </div>
      </div>`;
  }).join('');

  // Legend
  const legend = `
    <div class="perbandingan-legend">
      <span><span class="legend-dot prev"></span>${prevM}</span>
      <span><span class="legend-dot curr"></span>${m}</span>
    </div>`;

  el.innerHTML = totalHtml + legend + rowsHtml;
}

// ── TREN PER KATEGORI — PICKER & CHART ────────────────────────
let katTrendChart = null;
const KAT_COLORS  = ['#60a5fa','#f87171','#34d399','#fbbf24','#a78bfa','#fb923c','#38bdf8','#f472b6','#4ade80','#facc15'];

export function renderKategoriTrendPicker(yearOverride) {
  const el = document.getElementById('a-kat-trend-picker');
  if (!el) return;

  const y    = yearOverride || parseInt(document.getElementById('a-year').value);
  const cats = window.userCategories?.Pengeluaran || [];

  // Buat chips kalau belum ada
  if (!el.querySelector('.kat-chip')) {
    el.innerHTML = cats.map((k, i) => `
      <button class="kat-chip" data-kat="${esc(k)}"
        style="--chip-color:${KAT_COLORS[i % KAT_COLORS.length]}"
        onclick="toggleKatChip(this)">${ICONS[k] || ''} ${esc(k)}</button>`
    ).join('');
  }

  renderKategoriTrendChart(y);
}

export function renderKategoriTrendChart(y) {
  const ctx = document.getElementById('katTrendChart');
  if (!ctx) return;

  const selected = [...document.querySelectorAll('.kat-chip.active')].map(el => el.dataset.kat);
  if (!selected.length) {
    if (katTrendChart) { katTrendChart.destroy(); katTrendChart = null; }
    document.getElementById('a-kat-trend-empty').style.display = 'block';
    return;
  }
  document.getElementById('a-kat-trend-empty').style.display = 'none';

  const datasets = selected.map((kat, i) => {
    const color = KAT_COLORS[
      [...document.querySelectorAll('.kat-chip')].findIndex(el => el.dataset.kat === kat) % KAT_COLORS.length
    ];
    return {
      label: kat,
      data: MONTHS.map(m =>
        window.data.filter(r =>
          r.bulan === m && parseInt(r.tahun) === y &&
          r.jenis === 'Pengeluaran' && r.kategori === kat
        ).reduce((s, r) => s + Number(r.nominal), 0)
      ),
      borderColor: color,
      backgroundColor: color + '22',
      tension: 0.35,
      fill: false,
      pointRadius: 4,
      pointHoverRadius: 6,
    };
  });

  if (katTrendChart) katTrendChart.destroy();
  katTrendChart = new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: { labels: MONTHS.map(m => m.substring(0, 3)), datasets },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: Rp${Math.round(ctx.raw).toLocaleString('id-ID')}`,
          },
        },
      },
      scales: {
        y: {
          ticks: {
            callback: v => v >= 1e6 ? (v/1e6).toFixed(1)+'jt' : v >= 1e3 ? Math.round(v/1e3)+'rb' : v,
            maxTicksLimit: 6,
          },
        },
      },
    },
  });
}

window.toggleKatChip = function(el) {
  el.classList.toggle('active');
  const y = parseInt(document.getElementById('a-year').value);
  renderKategoriTrendChart(y);
};

// ── RENDER CHART (Tren Tahunan Bar) ──────────────────────────
export function renderChart() {
  const y      = parseInt(document.getElementById('a-year').value);
  const canvas = document.getElementById('trendChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const inD = MONTHS.map(m =>
    window.data.filter(d => d.bulan === m && parseInt(d.tahun) === y && d.jenis === 'Pemasukan')
               .reduce((s, r) => s + r.nominal, 0)
  );
  const outD = MONTHS.map(m =>
    window.data.filter(d =>
      d.bulan === m && parseInt(d.tahun) === y &&
      d.jenis === 'Pengeluaran' &&
      d.kategori !== 'Bayar Tagihan CC'
    ).reduce((s, r) => s + r.nominal, 0)
  );
  if (trendChart) trendChart.destroy();
  trendChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: MONTHS.map(m => m.substring(0, 3)),
      datasets: [
        { label: 'Masuk',  data: inD,  backgroundColor: '#34D399' },
        { label: 'Keluar', data: outD, backgroundColor: '#F87171' },
      ],
    },
    options: {
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
      scales: {
        y: {
          ticks: {
            callback: v => v >= 1e6 ? (v/1e6).toFixed(1)+'jt' : v >= 1e3 ? Math.round(v/1e3)+'rb' : v,
            maxTicksLimit: 6,
          },
        },
      },
    },
  });
}
export function renderBudget() {
  const m    = document.getElementById('bg-month').value;
  const y    = parseInt(document.getElementById('bg-year').value);
  const mOuts = window.data.filter(d => d.jenis === 'Pengeluaran' && d.bulan === m && parseInt(d.tahun) === y);

  document.getElementById('bg-list').innerHTML = Object.entries(window.budgets).map(([kat, limit]) => {
    const spent = mOuts.filter(r => r.kategori === kat).reduce((s, r) => s + r.nominal, 0);
    const pct   = Math.min((spent / limit) * 100, 100);
    const color = pct >= 90 ? 'var(--red)' : pct >= 75 ? 'var(--amber)' : 'var(--accent)';
    return `
      <div class="budget-item">
        <div class="budget-header">
          <span>${esc(kat)}</span>
          <span style="color:${color}">${fmt(spent)} / ${fmt(limit)}</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
      </div>`;
  }).join('') || '<div class="empty-state">Belum ada anggaran di Zaku</div>';
}

// ── RENDER CC ─────────────────────────────────────────────────
// ── RENDER CC ─────────────────────────────────────────────────
export function renderCC() {
  const m = document.getElementById('c-month').value;
  const y = parseInt(document.getElementById('c-year').value);
  const periodKey = `${m}_${y}`;

  const ccRows = window.data.filter(r =>
    r.cc && getCCPeriod(r.tanggal).bulan === m && getCCPeriod(r.tanggal).tahun === y
  );
  const total = ccRows.reduce((s, r) => s + Number(r.nominal), 0);
  const limit = window.settings.ccLimit;

  const payments   = window.ccPayments || {};
  const payInfo    = payments[periodKey];
  const sudahBayar = !!payInfo;

  document.getElementById('c-rincian-title').textContent = `Tagihan ${m} ${y}`;

  // ── Stats ──
  const pctUsed = limit > 0 ? Math.round(total / limit * 100) : 0;
  document.getElementById('c-stats').innerHTML = `
    <div class="stat-card c-amber">
      <div class="stat-label">Tagihan</div>
      <div class="stat-value">${fmt(total)}</div>
    </div>
    <div class="stat-card c-green">
      <div class="stat-label">Sisa Limit</div>
      <div class="stat-value">${fmt(limit - total)}</div>
    </div>
    <div class="stat-card c-blue">
      <div class="stat-label">Terpakai</div>
      <div class="stat-value">${pctUsed}%</div>
    </div>
    <div class="stat-card ${sudahBayar ? 'c-green' : 'c-red'}">
      <div class="stat-label">Status</div>
      <div class="stat-value" style="font-size:13px">${sudahBayar ? '✅ Lunas' : '⏳ Belum'}</div>
    </div>`;

  // ── Progress bar ──
  document.getElementById('c-bar').innerHTML = ccBarHTML(total, limit, `Cut-off tgl ${window.settings.ccCutoff}`);

  // ── Status pembayaran ──
  const statusEl = document.getElementById('c-payment-status');
  if (statusEl) {
    if (sudahBayar) {
      statusEl.innerHTML = `
        <div class="cc-paid-banner">
          <div class="cc-paid-icon">✅</div>
          <div class="cc-paid-info">
            <div class="cc-paid-title">Tagihan ${m} ${y} sudah lunas</div>
            <div class="cc-paid-date">Dikonfirmasi: ${payInfo.tanggal} · ${fmt(payInfo.nominal || total)}</div>
          </div>
          <button class="btn-cc-unpay" onclick="batalLunasiCC('${periodKey}')">Batalkan</button>
        </div>`;
    } else if (total > 0) {
      statusEl.innerHTML = `
        <div class="cc-unpaid-banner">
          <div class="cc-unpaid-icon">⏳</div>
          <div class="cc-unpaid-info">
            <div class="cc-unpaid-title">Belum dikonfirmasi lunas</div>
            <div class="cc-unpaid-sub">Total tagihan: ${fmt(total)}</div>
          </div>
          <button class="btn-cc-pay" onclick="konfirmasiLunasiCC('${periodKey}', ${total}, '${m}', ${y})">✅ Sudah Bayar</button>
        </div>`;
    } else {
      statusEl.innerHTML = '';
    }
  }

  // ── Daftar transaksi CC ──
  document.getElementById('c-list').innerHTML = ccRows
    .sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal))
    .map(r => `
    <div class="row-item">
      <div class="row-icon" style="background:var(--surface2)">${ICONS[r.kategori] || '💳'}</div>
      <div class="row-info">
        <div class="row-name">${esc(r.keterangan)}</div>
        <div class="row-meta">${esc(r.kategori)} · ${esc(r.tanggal)}</div>
      </div>
      <div class="row-right row-amount out">-${fmt(r.nominal)}</div>
    </div>`)
    .join('') || '<div class="empty-state">Belum ada transaksi CC periode ini</div>';

  // ── Simulasi cicilan ──
  renderCicilanSimulator(total);

  // ── Kalender riwayat pembayaran ──
  renderCCPaymentCalendar(y);
}

// ── SIMULASI CICILAN ─────────────────────────────────────────
export function renderCicilanSimulator(tagihanOverride) {
  const el = document.getElementById('c-cicilan');
  if (!el) return;

  const m = document.getElementById('c-month').value;
  const y = parseInt(document.getElementById('c-year').value);
  const periodKey = `${m}_${y}`;
  const ccRows = window.data.filter(r =>
    r.cc && getCCPeriod(r.tanggal).bulan === m && getCCPeriod(r.tanggal).tahun === y
  );
  const tagihan = tagihanOverride ?? ccRows.reduce((s, r) => s + Number(r.nominal), 0);

  if (tagihan <= 0) {
    el.innerHTML = '<div class="empty-state">Tidak ada tagihan untuk disimulasikan</div>';
    return;
  }

  // Ambil nilai dari input kalau sudah ada, atau default
  const bungaInput  = document.getElementById('sim-bunga');
  const minPctInput = document.getElementById('sim-minpct');
  const bungaBulan  = bungaInput  ? parseFloat(bungaInput.value)  || 2.25 : 2.25;
  const minPct      = minPctInput ? parseFloat(minPctInput.value) || 10   : 10;

  // Hitung skenario LUNAS PENUH
  const skenarios = [
    { label: 'Lunas Penuh',    bayar: tagihan,                    icon: '✅', kelas: 'sim-green' },
    { label: '50% / bulan',    bayar: tagihan * 0.5,              icon: '🔵', kelas: 'sim-blue'  },
    { label: '30% / bulan',    bayar: tagihan * 0.3,              icon: '🟡', kelas: 'sim-amber' },
    { label: `Min ${minPct}%`, bayar: Math.max(tagihan * (minPct / 100), 50000), icon: '🔴', kelas: 'sim-red' },
  ];

  function hitungCicilan(tagihan, bayarPerBulan, bungaPctBulan) {
    if (bayarPerBulan >= tagihan) return { bulan: 1, totalBunga: 0, totalBayar: tagihan };
    let sisa = tagihan, totalBunga = 0, bulan = 0;
    const MAX = 600;
    while (sisa > 0 && bulan < MAX) {
      const bunga = sisa * (bungaPctBulan / 100);
      totalBunga += bunga;
      sisa = sisa + bunga - bayarPerBulan;
      if (sisa < 0) sisa = 0;
      bulan++;
    }
    return { bulan, totalBunga, totalBayar: tagihan + totalBunga };
  }

  const rows = skenarios.map(s => {
    const { bulan, totalBunga, totalBayar } = hitungCicilan(tagihan, s.bayar, bungaBulan);
    return { ...s, bayar: s.bayar, bulan, totalBunga, totalBayar };
  });

  el.innerHTML = `
    <div class="sim-controls">
      <div class="sim-control-item">
        <label class="sim-label">Bunga / bulan (%)</label>
        <input class="sim-input" id="sim-bunga" type="number" step="0.1" min="0.1" max="10"
          value="${bungaBulan}" oninput="renderCicilanSimulator()">
      </div>
      <div class="sim-control-item">
        <label class="sim-label">Minimum bayar (%)</label>
        <input class="sim-input" id="sim-minpct" type="number" step="1" min="1" max="50"
          value="${minPct}" oninput="renderCicilanSimulator()">
      </div>
    </div>
    <div class="sim-tagihan">Simulasi tagihan: <strong>${fmt(tagihan)}</strong></div>
    <div class="sim-table">
      <div class="sim-thead">
        <div>Skenario</div>
        <div>Bayar/bln</div>
        <div>Durasi</div>
        <div>Total Bunga</div>
        <div>Total Bayar</div>
      </div>
      ${rows.map(r => `
        <div class="sim-row ${r.kelas}">
          <div class="sim-scenario">${r.icon} ${r.label}</div>
          <div class="sim-cell">${fmtS(r.bayar)}</div>
          <div class="sim-cell">${r.bulan} bln</div>
          <div class="sim-cell sim-bunga-val">${r.totalBunga > 0 ? '+' + fmt(r.totalBunga) : '—'}</div>
          <div class="sim-cell sim-total-val">${fmt(r.totalBayar)}</div>
        </div>`).join('')}
    </div>
    <div class="sim-note">💡 Bayar penuh tiap bulan = hemat <strong>${fmt(rows[rows.length-1].totalBunga)}</strong> bunga vs bayar minimum</div>`;
}

// ── KALENDER RIWAYAT PEMBAYARAN CC ────────────────────────────
export function renderCCPaymentCalendar(yearOverride) {
  const el = document.getElementById('c-history-calendar');
  if (!el) return;

  const y        = yearOverride || parseInt(document.getElementById('c-year').value);
  const payments = window.ccPayments || {};

  // Kumpulkan semua periode yang punya data CC
  const periods = new Set();
  window.data.filter(r => r.cc).forEach(r => {
    const p = getCCPeriod(r.tanggal);
    periods.add(`${p.bulan}_${p.tahun}`);
  });
  // Tambahkan juga periode yang sudah ada di ccPayments
  Object.keys(payments).forEach(k => periods.add(k));

  // Filter yang relevan dengan tahun dipilih + tahun ±1 untuk tampilan lengkap
  const allPeriods = MONTHS.map(m => `${m}_${y}`);

  const cells = allPeriods.map(key => {
    const [bulan, tahunStr] = key.split('_');
    const tahun = parseInt(tahunStr);
    const ccRows  = window.data.filter(r =>
      r.cc && getCCPeriod(r.tanggal).bulan === bulan && getCCPeriod(r.tanggal).tahun === tahun
    );
    const total   = ccRows.reduce((s, r) => s + Number(r.nominal), 0);
    const payInfo = payments[key];

    // State: paid / unpaid-with-bill / empty
    let state, badge, tooltip;
    if (payInfo) {
      state   = 'paid';
      badge   = '✅';
      tooltip = `Lunas ${payInfo.tanggal} · ${fmt(total)}`;
    } else if (total > 0) {
      state   = 'unpaid';
      badge   = '⏳';
      tooltip = `Belum lunas · ${fmt(total)}`;
    } else {
      state   = 'empty';
      badge   = '';
      tooltip = 'Tidak ada tagihan';
    }

    return { key, bulan, tahun, total, state, badge, tooltip };
  });

  // Summary stats
  const totalPaid   = cells.filter(c => c.state === 'paid').length;
  const totalUnpaid = cells.filter(c => c.state === 'unpaid').length;
  const totalTagihan = cells.reduce((s, c) => s + c.total, 0);
  const totalLunas   = cells.filter(c => c.state === 'paid')
                            .reduce((s, c) => s + c.total, 0);

  el.innerHTML = `
    <div class="cc-cal-stats">
      <div class="cc-cal-stat">
        <div class="cc-cal-stat-val" style="color:var(--green)">${totalPaid}</div>
        <div class="cc-cal-stat-label">Periode Lunas</div>
      </div>
      <div class="cc-cal-stat">
        <div class="cc-cal-stat-val" style="color:${totalUnpaid > 0 ? 'var(--red)' : 'var(--text3)'}">${totalUnpaid}</div>
        <div class="cc-cal-stat-label">Belum Lunas</div>
      </div>
      <div class="cc-cal-stat">
        <div class="cc-cal-stat-val">${fmtS(totalTagihan)}</div>
        <div class="cc-cal-stat-label">Total Tagihan ${y}</div>
      </div>
      <div class="cc-cal-stat">
        <div class="cc-cal-stat-val" style="color:var(--green)">${fmtS(totalLunas)}</div>
        <div class="cc-cal-stat-label">Terkonfirmasi Lunas</div>
      </div>
    </div>
    <div class="cc-cal-grid">
      ${cells.map(c => `
        <div class="cc-cal-cell cc-cal-${c.state}"
             title="${c.tooltip}"
             onclick="syncPeriodToCC('${c.bulan}','${c.tahun}')">
          <div class="cc-cal-month">${c.bulan.substring(0, 3)}</div>
          <div class="cc-cal-badge">${c.badge}</div>
          ${c.total > 0 ? `<div class="cc-cal-amount">${fmtS(c.total)}</div>` : ''}
        </div>`).join('')}
    </div>
    <div class="cc-cal-legend">
      <span><span class="cc-cal-dot paid"></span>Lunas</span>
      <span><span class="cc-cal-dot unpaid"></span>Belum Lunas</span>
      <span><span class="cc-cal-dot empty"></span>Tidak Ada Tagihan</span>
    </div>`;
}

window.syncPeriodToCC = function(bulan, tahun) {
  // Klik cell kalender → pindah ke periode itu
  ['b','t','a','bg','c'].forEach(p => {
    const mEl = document.getElementById(`${p}-month`);
    const yEl = document.getElementById(`${p}-year`);
    if (mEl) mEl.value = bulan;
    if (yEl) yEl.value = tahun;
  });
  window.renderAll();
};

window.renderCicilanSimulator = renderCicilanSimulator;
window.renderCCPaymentCalendar = renderCCPaymentCalendar;

// ── RENDER KATEGORI LIST (Pengaturan) ─────────────────────────
export function renderCategoryList() {
  const render = (type, elId) => {
    const el = document.getElementById(elId);
    el.innerHTML = window.userCategories[type].map(k => `
      <div class="tag-item">
        ${esc(k)}
        <span class="tag-del" data-type="${esc(type)}" data-name="${esc(k)}">×</span>
      </div>`
    ).join('');
    // Pakai event listener agar nilai asli (termasuk &) terkirim dengan benar
    el.querySelectorAll('.tag-del').forEach(btn => {
      btn.addEventListener('click', () => {
        window.hapusKategori(btn.dataset.type, btn.dataset.name);
      });
    });
  };
  render('Pemasukan',   'kat-list-pemasukan');
  render('Pengeluaran', 'kat-list-pengeluaran');
}

// ── UPDATE DROPDOWN KATEGORI ──────────────────────────────────
export function updateKategoriDropdown() {
  const j    = document.getElementById('f-jenis').value;
  const cats = window.userCategories[j] || [];

  document.getElementById('f-kategori').innerHTML =
    cats.map(k => `<option value="${esc(k)}">${esc(k)}</option>`).join('');

  const allCats = [...window.userCategories.Pemasukan, ...window.userCategories.Pengeluaran];
  document.getElementById('t-kat').innerHTML =
    '<option value="">Semua Kategori</option>' +
    allCats.map(k => `<option value="${esc(k)}">${esc(k)}</option>`).join('');

  document.getElementById('bg-kategori').innerHTML =
    window.userCategories.Pengeluaran.map(k => `<option value="${esc(k)}">${esc(k)}</option>`).join('');

  document.getElementById('wrap-cc').style.display = j === 'Pemasukan' ? 'none' : 'flex';
}

// ── RENDER ALL ────────────────────────────────────────────────
export function renderAll() {
  document.getElementById('onboarding').style.display = window.data.length === 0 ? 'block' : 'none';
  renderBeranda();
  renderTransaksi();
  renderAnalitik();
  renderBudget();
  renderCC();
}

// Expose ke window untuk inline HTML onclick
window.renderAll               = renderAll;
window.renderTransaksi          = renderTransaksi;
window.renderAnalitik           = renderAnalitik;
window.renderBudget             = renderBudget;
window.renderBeranda            = renderBeranda;
window.renderCC                 = renderCC;
window.renderChart              = renderChart;
window.renderKategoriTrendChart = renderKategoriTrendChart;
window.renderCicilanSimulator   = renderCicilanSimulator;
window.renderCCPaymentCalendar  = renderCCPaymentCalendar;
