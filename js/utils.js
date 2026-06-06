// ═══════════════════════════════════════════
//  utils.js — Helper & Konstanta Global
// ════════════════════════════════════════════

export const MONTHS = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember'
];

export const ICONS = {
  'Tagihan':           '🏠',
  'Makan & Minum':     '🍽️',
  'Transportasi':      '🚗',
  'Perawatan Picanto': '⚙️',
  'Belanja':           '🛍️',
  'Gaya Hidup & Hobi': '🎯',
  'Freediving & Trip': '🤿',
  'Klinik Gigi':       '🦷',
  'Kesehatan':         '💊',
  'Keluarga':          '👨‍👩‍👧',
  'Sosial & Sedekah':  '🤝',
  'Investasi':         '📈',
  'Bayar Tagihan CC':  '💳',
  'Lain-lain':         '📌',
  'Gaji':              '💵',
  'Transfer Masuk':    '💰',
  'Sewa Gear Slowpulse': '🏄‍♂️',
  'Bonus/THR':         '🎁',
  'Freelance':         '💻',
  'Lainnya':           '📂',
};

// ── FORMAT ANGKA ─────────────────────────────────────────────
/** Format lengkap: Rp1.250.000 */
export function fmt(n) {
  return (n < 0 ? '-' : '') + 'Rp' + Math.round(Math.abs(n)).toLocaleString('id-ID');
}

/** Konversi nilai ke Number dengan aman — handle undefined/null/NaN → 0 */
export function safeNum(val) {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

/** Format singkat: Rp1,3 jt / Rp250 rb */
export function fmtS(n) {
  const sign = n < 0 ? '-' : '';
  const abs  = Math.abs(n);
  if (abs >= 1e6) return sign + 'Rp' + (abs / 1e6).toFixed(1) + ' jt';
  if (abs >= 1e3) return sign + 'Rp' + Math.round(abs / 1e3) + ' rb';
  return sign + 'Rp' + Math.round(abs);
}

// ── PERIODE CC ───────────────────────────────────────────────
/** Hitung periode tagihan CC berdasarkan tanggal cutoff */
export function getCCPeriod(dateStr) {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  let y = parseInt(yearStr);
  let m = parseInt(monthStr) - 1;
  const d = parseInt(dayStr);

  if (d > (window.settings?.ccCutoff ?? 25)) {
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return { bulan: MONTHS[m], tahun: y };
}

// ── TOAST ─────────────────────────────────────────────────────
export function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast     = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ── LOADER ─────────────────────────────────────────────────────
export function showLoading() { document.getElementById('loader').classList.remove('hidden'); }
export function hideLoading() { document.getElementById('loader').classList.add('hidden'); }

// ── FORMAT INPUT RIBUAN ────────────────────────────────────────
/** Otomatis format input angka jadi 1.250.000 dan sync ke hidden field */
export function formatRibuan(el) {
  const raw = el.value.replace(/\D/g, '');
  if (!raw) { el.value = ''; return; }
  el.value = parseInt(raw).toLocaleString('id-ID');
  const hiddenId = el.id.replace('-display', '');
  const hiddenEl = document.getElementById(hiddenId);
  if (hiddenEl) hiddenEl.value = raw;
}

// ── EKSPOR KE WINDOW (untuk inline HTML onchange/onclick) ──────
window.safeNum     = safeNum;
window.showToast   = showToast;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.fmt         = fmt;
window.fmtS        = fmtS;
window.getCCPeriod = getCCPeriod;
window.formatRibuan = formatRibuan;
