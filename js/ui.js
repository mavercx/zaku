// ════════════════════════════════════════════
//  ui.js — Modal, Theme, Navigasi, Install, Support
// ════════════════════════════════════════════

import { renderChart } from "./render.js";

// ── MODAL KONFIRMASI ──────────────────────────────────────────
let _modalCallback = null;

export function showModal(title, desc, onOk, okLabel = 'Ya, Hapus', okDanger = true) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-desc').textContent  = desc;
  const btn       = document.getElementById('modal-ok-btn');
  btn.textContent = okLabel;
  btn.style.background = okDanger ? 'var(--red)' : 'var(--accent)';
  _modalCallback  = onOk;
  document.getElementById('modal-overlay').classList.add('show');
}

export function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
  _modalCallback = null;
}

document.getElementById('modal-ok-btn').addEventListener('click', () => {
  if (_modalCallback) _modalCallback();
  closeModal();
});
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

// ── PRIVACY MODAL ─────────────────────────────────────────────
export function openPrivacy()  { document.getElementById('privacy-overlay').classList.add('show'); }
export function closePrivacy() { document.getElementById('privacy-overlay').classList.remove('show'); }
document.getElementById('privacy-overlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('privacy-overlay')) closePrivacy();
});

// ── SUPPORT MODAL ─────────────────────────────────────────────
export function openSupportModal() {
  document.getElementById('support-overlay').classList.add('show');
}
export function closeSupportModal() {
  document.getElementById('support-overlay').classList.remove('show');
  localStorage.setItem('dompetku_support_closed', Date.now());
}
document.getElementById('support-overlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('support-overlay')) closeSupportModal();
});

// Chip interaktif support
document.querySelectorAll('.support-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.support-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
  });
});

// Auto-show support popup setelah 7 hari atau pertama kali
export function maybeShowSupport() {
  const last     = localStorage.getItem('dompetku_support_closed');
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  if (!last || (Date.now() - parseInt(last)) > sevenDays) {
    setTimeout(() => openSupportModal(), 5000);
  }
}

// ── INSTALL MODAL ─────────────────────────────────────────────
export function openInstall() {
  const el = document.getElementById('install-overlay');
  el.style.opacity       = '1';
  el.style.pointerEvents = 'auto';
}

export function closeInstall() {
  const el = document.getElementById('install-overlay');
  el.style.opacity       = '0';
  el.style.pointerEvents = 'none';
  localStorage.setItem('dompetku_install_shown', '1');
  maybeShowSupport();
}

export function installTab(tab) {
  document.getElementById('install-android').style.display = tab === 'android' ? 'flex' : 'none';
  document.getElementById('install-ios').style.display     = tab === 'ios'     ? 'flex' : 'none';

  const activeStyle   = 'flex:1;padding:8px;border-radius:8px;border:1px solid var(--accent);background:var(--accent-bg);color:var(--accent);font-size:13px;font-weight:700;cursor:pointer;font-family:var(--font);';
  const inactiveStyle = 'flex:1;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text2);font-size:13px;font-weight:700;cursor:pointer;font-family:var(--font);';

  document.getElementById('tab-android').style.cssText = tab === 'android' ? activeStyle : inactiveStyle;
  document.getElementById('tab-ios').style.cssText     = tab === 'ios'     ? activeStyle : inactiveStyle;
}

document.getElementById('install-overlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('install-overlay')) closeInstall();
});

// ── THEME ─────────────────────────────────────────────────────
export function toggleTheme() {
  const dark = document.body.classList.toggle('dark-theme');
  document.getElementById('theme-toggle').textContent = dark ? '☀️' : '🌙';
  localStorage.setItem('dompetku_theme', dark ? 'dark' : 'light');
}

// ── EXPORT DROPDOWN ───────────────────────────────────────────
export function toggleExport() { document.getElementById('export-dropdown').classList.toggle('show'); }
export function closeExport()  { document.getElementById('export-dropdown').classList.remove('show'); }

// ── NAV MENU ──────────────────────────────────────────────────
export function toggleMenu() { document.getElementById('nav-dropdown').classList.toggle('show'); }

// Tutup dropdown jika klik di luar
window.addEventListener('click', (e) => {
  if (!e.target.closest('.nav-menu-wrap')) document.getElementById('nav-dropdown').classList.remove('show');
  if (!e.target.closest('.export-wrap'))   document.getElementById('export-dropdown').classList.remove('show');
});

// ── NAVIGASI HALAMAN ──────────────────────────────────────────
export function goTo(page, title) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');

  const tabs = ['beranda', 'transaksi', 'analitik', 'budget', 'cc', 'pengaturan'];
  const idx  = tabs.indexOf(page);
  if (idx >= 0) {
    document.querySelectorAll('.nav-tab')[idx].classList.add('active');
    document.getElementById('btn-menu-text').textContent = title + ' ▾';
  }

  document.getElementById('nav-dropdown').classList.remove('show');
  if (page === 'analitik') renderChart();
  window.scrollTo(0, 0);
}

// ── SYNC PERIOD (semua halaman ikut berubah) ──────────────────
export function syncPeriod(sId) {
  const type = sId.split('-')[1];
  const val  = document.getElementById(sId).value;
  ['b', 't', 'a', 'bg', 'c'].forEach(p => {
    const el = document.getElementById(`${p}-${type}`);
    if (el) el.value = val;
  });
  window.renderAll();
}

// ── POPULATE SELECT BULAN & TAHUN ─────────────────────────────
export function populateSelects() {
  const now = new Date();
  const cm  = ['Januari','Februari','Maret','April','Mei','Juni',
               'Juli','Agustus','September','Oktober','November','Desember'][now.getMonth()];
  const cy  = now.getFullYear();

  ['b-month','t-month','a-month','bg-month','c-month'].forEach(id => {
    const el = document.getElementById(id);
    ['Januari','Februari','Maret','April','Mei','Juni',
     'Juli','Agustus','September','Oktober','November','Desember']
      .forEach(m => el.add(new Option(m, m, false, m === cm)));
  });

  ['b-year','t-year','a-year','bg-year','c-year'].forEach(id => {
    const el = document.getElementById(id);
    [2025, 2026, 2027].forEach(y => el.add(new Option(y, y, false, y === cy)));
  });
}

// Expose ke window untuk inline HTML onclick
window.showModal        = showModal;
window.closeModal       = closeModal;
window.openPrivacy      = openPrivacy;
window.closePrivacy     = closePrivacy;
window.openSupportModal = openSupportModal;
window.closeSupportModal = closeSupportModal;
window.openInstall      = openInstall;
window.closeInstall     = closeInstall;
window.installTab       = installTab;
window.toggleTheme      = toggleTheme;
window.toggleExport     = toggleExport;
window.closeExport      = closeExport;
window.toggleMenu       = toggleMenu;
window.goTo             = goTo;
window.syncPeriod       = syncPeriod;
