// ════════════════════════════════════════════
//  notif.js — In-App Alerts & Local Notifications
// ════════════════════════════════════════════

import { fmt, fmtS, getCCPeriod, MONTHS, showToast } from "./utils.js";

// ── KONSTANTA ─────────────────────────────────────────────────
const NOTIF_KEY         = 'dompetku_notif_dismissed'; // localStorage: {alertId: timestamp}
const NOTIF_PERM_KEY    = 'dompetku_notif_perm';      // 'granted'|'denied'|'pending'
const REDISMISS_HOURS   = 24;                          // alert muncul lagi setelah X jam

// ── HELPER: cek apakah alert sudah di-dismiss dalam X jam ─────
function wasDismissed(id) {
  try {
    const store = JSON.parse(localStorage.getItem(NOTIF_KEY) || '{}');
    const ts    = store[id];
    if (!ts) return false;
    return (Date.now() - ts) < REDISMISS_HOURS * 3600 * 1000;
  } catch { return false; }
}

function markDismissed(id) {
  try {
    const store = JSON.parse(localStorage.getItem(NOTIF_KEY) || '{}');
    store[id] = Date.now();
    localStorage.setItem(NOTIF_KEY, JSON.stringify(store));
  } catch {}
}

// ── RENDER ALERT BANNER ───────────────────────────────────────
function renderAlertBanner(alerts) {
  const container = document.getElementById('alert-container');
  if (!container) return;

  // Hapus alert lama yang sudah resolved
  const existing = container.querySelectorAll('.alert-banner[data-id]');
  existing.forEach(el => {
    if (!alerts.find(a => a.id === el.dataset.id)) el.remove();
  });

  alerts.forEach(alert => {
    if (wasDismissed(alert.id)) return;
    if (container.querySelector(`[data-id="${alert.id}"]`)) return; // sudah ada

    const el = document.createElement('div');
    el.className = `alert-banner alert-${alert.type}`;
    el.dataset.id = alert.id;
    el.innerHTML = `
      <div class="alert-left">
        <span class="alert-icon">${alert.icon}</span>
        <div class="alert-body">
          <div class="alert-title">${alert.title}</div>
          <div class="alert-desc">${alert.desc}</div>
        </div>
      </div>
      <button class="alert-close" data-id="${alert.id}">×</button>`;
    container.appendChild(el);

    el.querySelector('.alert-close').addEventListener('click', () => {
      markDismissed(alert.id);
      el.classList.add('alert-hide');
      setTimeout(() => el.remove(), 300);
    });
  });
}

// ── GENERATE SEMUA ALERT ──────────────────────────────────────
export function checkAlerts() {
  if (!window.data || !window.settings) return;

  const alerts = [];
  const now    = new Date();
  const today  = now.getDate();
  const thisM  = MONTHS[now.getMonth()];
  const thisY  = now.getFullYear();

  // ── 1. TAGIHAN CC BELUM LUNAS (cek bulan lalu & bulan ini) ──
  // Bulan lalu
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevM    = MONTHS[prevDate.getMonth()];
  const prevY    = prevDate.getFullYear();
  const prevKey  = `${prevM}_${prevY}`;

  const prevCCRows  = window.data.filter(r =>
    r.cc && getCCPeriod(r.tanggal).bulan === prevM && getCCPeriod(r.tanggal).tahun === prevY
  );
  const prevCCTotal = prevCCRows.reduce((s, r) => s + Number(r.nominal), 0);

  if (prevCCTotal > 0 && !(window.ccPayments || {})[prevKey]) {
    alerts.push({
      id:    `cc-unpaid-${prevKey}`,
      type:  'danger',
      icon:  '💳',
      title: `Tagihan CC ${prevM} ${prevY} belum lunas`,
      desc:  `${fmt(prevCCTotal)} — konfirmasi pembayaran di tab Kontrol CC`,
    });
  }

  // ── 2. MENDEKATI CUTOFF CC (3 hari sebelum) ─────────────────
  const cutoff    = window.settings.ccCutoff;
  const daysLeft  = cutoff - today;
  const currKey   = `${thisM}_${thisY}`;
  const currCCRows = window.data.filter(r =>
    r.cc && getCCPeriod(r.tanggal).bulan === thisM && getCCPeriod(r.tanggal).tahun === thisY
  );
  const currCCTotal = currCCRows.reduce((s, r) => s + Number(r.nominal), 0);

  if (daysLeft >= 0 && daysLeft <= 3 && currCCTotal > 0) {
    alerts.push({
      id:    `cc-cutoff-${currKey}-d${today}`,
      type:  'warning',
      icon:  '⏰',
      title: daysLeft === 0
        ? `Hari ini cut-off CC (tgl ${cutoff})`
        : `Cut-off CC ${daysLeft} hari lagi (tgl ${cutoff})`,
      desc:  `Tagihan berjalan: ${fmt(currCCTotal)} — pastikan tidak ada pengeluaran besar sebelum cut-off`,
    });
  }

  // ── 3. PENGELUARAN > 80% PEMASUKAN BULAN INI ────────────────
  const monthRows = window.data.filter(d =>
    d.bulan === thisM && parseInt(d.tahun) === thisY
  );
  const mIn  = monthRows.filter(r => r.jenis === 'Pemasukan').reduce((s, r) => s + Number(r.nominal), 0);
  const mOut = monthRows.filter(r =>
    r.jenis === 'Pengeluaran' && r.kategori !== 'Bayar Tagihan CC'
  ).reduce((s, r) => s + Number(r.nominal), 0);

  if (mIn > 0) {
    const pct = Math.round((mOut / mIn) * 100);
    if (pct >= 100) {
      alerts.push({
        id:    `overspend-${thisM}-${thisY}`,
        type:  'danger',
        icon:  '🚨',
        title: `Pengeluaran melebihi pemasukan bulan ini!`,
        desc:  `${fmt(mOut)} keluar vs ${fmt(mIn)} masuk (${pct}%) — defisit ${fmt(mOut - mIn)}`,
      });
    } else if (pct >= 80) {
      alerts.push({
        id:    `highspend-${thisM}-${thisY}-${Math.floor(pct / 5) * 5}`,
        type:  'warning',
        icon:  '⚠️',
        title: `Pengeluaran sudah ${pct}% dari pemasukan`,
        desc:  `${fmt(mOut)} dari ${fmt(mIn)} — sisa ruang ${fmt(mIn - mOut)}`,
      });
    }
  }

  // ── 4. BUDGET KATEGORI HAMPIR HABIS (≥ 85%) ─────────────────
  if (window.budgets) {
    Object.entries(window.budgets).forEach(([kat, limit]) => {
      const spent = monthRows
        .filter(r => r.jenis === 'Pengeluaran' && r.kategori === kat)
        .reduce((s, r) => s + Number(r.nominal), 0);
      const pct = Math.round((spent / limit) * 100);

      if (pct >= 100) {
        alerts.push({
          id:    `budget-over-${kat}-${thisM}-${thisY}`,
          type:  'danger',
          icon:  '🎯',
          title: `Budget "${kat}" terlampaui`,
          desc:  `${fmt(spent)} dari limit ${fmt(limit)} (${pct}%)`,
        });
      } else if (pct >= 85) {
        alerts.push({
          id:    `budget-warn-${kat}-${thisM}-${thisY}-${Math.floor(pct / 5) * 5}`,
          type:  'warning',
          icon:  '🎯',
          title: `Budget "${kat}" hampir habis (${pct}%)`,
          desc:  `Terpakai ${fmt(spent)} dari ${fmt(limit)} — sisa ${fmt(limit - spent)}`,
        });
      }
    });
  }

  // ── 5. SALDO QRIS/TRANSFER NEGATIF ──────────────────────────
  const qrisIn  = window.data.filter(r => r.metode === 'QRIS/Transfer' && r.jenis === 'Pemasukan').reduce((s,r) => s + Number(r.nominal), 0);
  const qrisOut = window.data.filter(r => r.metode === 'QRIS/Transfer' && r.jenis === 'Pengeluaran' && r.kategori !== 'Bayar Tagihan CC').reduce((s,r) => s + Number(r.nominal), 0);
  const qrisBal = qrisIn - qrisOut;

  if (qrisBal < 0) {
    alerts.push({
      id:    `qris-negative-${thisM}-${thisY}`,
      type:  'danger',
      icon:  '🏦',
      title: 'Saldo QRIS/Bank negatif',
      desc:  `Saldo tercatat ${fmt(qrisBal)} — cek apakah ada transaksi yang belum diinput`,
    });
  }

  renderAlertBanner(alerts);

  // Kembalikan jumlah alert aktif untuk badge
  return alerts.filter(a => !wasDismissed(a.id)).length;
}

// ── REQUEST IZIN NOTIFIKASI BROWSER ──────────────────────────
export async function requestNotifPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied')  return 'denied';
  const result = await Notification.requestPermission();
  localStorage.setItem(NOTIF_PERM_KEY, result);
  return result;
}

// ── KIRIM LOCAL NOTIFICATION (saat app terbuka di background) ─
export function sendLocalNotif(title, body, tag = 'dompetku') {
  if (Notification.permission !== 'granted') return;
  new Notification(title, {
    body,
    tag,
    icon: 'https://cdn-icons-png.flaticon.com/512/10433/10433048.png',
    badge:'https://cdn-icons-png.flaticon.com/512/10433/10433048.png',
  });
}

// ── SCHEDULER: cek ulang tiap jam saat app terbuka ────────────
let _notifInterval = null;
export function startNotifScheduler() {
  checkAlerts();
  if (_notifInterval) clearInterval(_notifInterval);
  _notifInterval = setInterval(() => {
    const count = checkAlerts();
    // Kirim browser notif kalau ada alert baru dan izin sudah granted
    if (count > 0 && Notification.permission === 'granted') {
      sendLocalNotif(
        'Dompetku — Ada yang perlu dicek',
        `${count} pengingat keuangan aktif`,
        'dompetku-check'
      );
    }
  }, 60 * 60 * 1000); // tiap 1 jam
}

// ── TOGGLE PENGATURAN NOTIF ────────────────────────────────────
export function renderNotifSettings() {
  const el = document.getElementById('notif-settings-block');
  if (!el) return;

  const supported = 'Notification' in window;
  const perm      = supported ? Notification.permission : 'unsupported';

  let statusHtml, btnHtml;
  if (!supported) {
    statusHtml = '<span class="notif-badge notif-off">Tidak didukung browser ini</span>';
    btnHtml    = '';
  } else if (perm === 'granted') {
    statusHtml = '<span class="notif-badge notif-on">✅ Aktif</span>';
    btnHtml    = `<button class="btn-cancel" style="width:auto;padding:9px 16px;font-size:13px;" onclick="testNotif()">🔔 Test Notifikasi</button>`;
  } else if (perm === 'denied') {
    statusHtml = '<span class="notif-badge notif-blocked">🚫 Diblokir — aktifkan di pengaturan browser</span>';
    btnHtml    = '';
  } else {
    statusHtml = '<span class="notif-badge notif-off">⭕ Belum diaktifkan</span>';
    btnHtml    = `<button class="btn-submit" style="padding:10px 18px;font-size:13px;width:auto;" onclick="enableNotif()">Aktifkan Notifikasi</button>`;
  }

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:10px;">
      <div>
        <div style="font-size:14px;font-weight:700;margin-bottom:4px;">Status Notifikasi Browser</div>
        ${statusHtml}
      </div>
      ${btnHtml}
    </div>
    <div style="font-size:12px;color:var(--text3);line-height:1.6;">
      Notifikasi in-app selalu aktif. Notifikasi browser akan muncul saat app terbuka di tab lain.
    </div>`;
}

// Expose ke window
window.enableNotif = async () => {
  const r = await requestNotifPermission();
  if (r === 'granted') {
    showToast('Notifikasi diaktifkan! 🔔');
    sendLocalNotif('Dompetku', 'Notifikasi berhasil diaktifkan!');
  } else if (r === 'denied') {
    showToast('Notifikasi diblokir — aktifkan di pengaturan browser', 'error');
  }
  renderNotifSettings();
};

window.testNotif = () => {
  sendLocalNotif('Dompetku — Test 🔔', 'Notifikasi berjalan dengan baik!');
  showToast('Test notifikasi dikirim!');
};

window.checkAlerts = checkAlerts;
