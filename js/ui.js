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
    const menuText = document.getElementById('btn-menu-text');
    if (menuText) menuText.textContent = title + ' ▾';
  }

  document.getElementById('nav-dropdown').classList.remove('show');
  if (page === 'analitik') requestAnimationFrame(() => renderChart());
  window.scrollTo(0, 0);

  // ── Update bottom nav active state ──────────────────────────
  _updateBottomNav(page);
}

// Update bottom nav + desktop nav tabs
function _updateBottomNav(page) {
  // Bottom nav mobile
  const BN_MAP = { beranda:'bn-beranda', transaksi:'bn-transaksi', analitik:'bn-analitik', cc:'bn-cc' };
  document.querySelectorAll('.bn-tab').forEach(t => t.classList.remove('active'));
  const bnId = BN_MAP[page];
  if (bnId) {
    const el = document.getElementById(bnId);
    if (el) el.classList.add('active');
  }

  // Desktop nav tabs
  const DNT_MAP = { beranda:'dnt-beranda', transaksi:'dnt-transaksi', analitik:'dnt-analitik', cc:'dnt-cc', input:'dnt-input' };
  document.querySelectorAll('.nav-desktop-tab').forEach(t => {
    t.classList.remove('active');
  });
  const dntId = DNT_MAP[page];
  if (dntId) {
    const el = document.getElementById(dntId);
    if (el) el.classList.add('active');
  }

  // FAB: sembunyikan di halaman input
  const fab = document.getElementById('fab-catat');
  if (fab) fab.style.transform = page === 'input'
    ? 'translateX(-50%) scale(0)'
    : 'translateX(-50%) scale(1)';
}

// Expose supaya ux.js bisa pakai tanpa polling
window._updateBottomNav = _updateBottomNav;

// ── SYNC PERIOD (semua halaman ikut berubah) ──────────────────
export function syncPeriod(sId) {
  const type = sId.split('-')[1]; // 'month' atau 'year'
  const val  = document.getElementById(sId).value;

  // Prefix halaman yang sedang aktif
  const activePage = document.querySelector('.page.active');
  const activeId   = activePage ? activePage.id : '';

  // CC punya periode sendiri — hanya sync sesama CC, jangan paksa ikut halaman lain
  if (activeId === 'page-cc') {
    // Hanya update c-month / c-year lalu render CC saja
    window.renderCC();
    return;
  }

  // Halaman lain: sync semua prefix kecuali 'c' (CC tetap independen)
  ['b', 't', 'a', 'bg'].forEach(p => {
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

  const MONTHS_LIST = ['Januari','Februari','Maret','April','Mei','Juni',
                       'Juli','Agustus','September','Oktober','November','Desember'];

  // Isi dropdown bulan — semua halaman
  ['b-month','t-month','a-month','bg-month','c-month'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    MONTHS_LIST.forEach(m => el.add(new Option(m, m, false, m === cm)));
  });

  // Range tahun: 3 tahun ke belakang s/d 2 tahun ke depan
  // Ini memastikan semua riwayat CC bisa dipilih
  const yearMin = cy - 3;
  const yearMax = cy + 2;
  const years   = [];
  for (let y = yearMin; y <= yearMax; y++) years.push(y);

  ['b-year','t-year','a-year','bg-year','c-year'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    years.forEach(y => el.add(new Option(y, y, false, y === cy)));
  });
}

// Fungsi untuk refresh year options setelah data load
// (dipanggil dari data.js setelah loadDataFromFirebase)
export function refreshYearOptions() {
  if (!window.data || !window.data.length) return;
  const years = [...new Set(window.data.map(r => parseInt(r.tahun)))].sort();
  // Tambahkan tahun yang ada di data tapi belum ada di dropdown
  ['b-year','t-year','a-year','bg-year','c-year'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const existing = [...el.options].map(o => parseInt(o.value));
    years.forEach(y => {
      if (!existing.includes(y)) {
        // Insert pada posisi yang benar (urut)
        let inserted = false;
        for (let i = 0; i < el.options.length; i++) {
          if (parseInt(el.options[i].value) > y) {
            el.add(new Option(y, y), i);
            inserted = true;
            break;
          }
        }
        if (!inserted) el.add(new Option(y, y));
      }
    });
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
window.refreshYearOptions = refreshYearOptions;
