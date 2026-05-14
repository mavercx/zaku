// ════════════════════════════════════════════
//  app.js — Entry Point, Init & Event Binding
// ════════════════════════════════════════════

import { formatRibuan }          from "./utils.js";
import { updateKategoriDropdown } from "./render.js";
import { populateSelects, goTo } from "./ui.js";
import {
  simpan, hapusRecord, editRecord, copyToForm,
  resetForm, simpanBudget, simpanPengaturanCC,
  tambahKategori, hapusKategori,
  importDataTSV, syncFieldsFromHistory,
  konfirmasiLunasiCC, batalLunasiCC,
} from "./data.js";
import { startNotifScheduler, checkAlerts, renderNotifSettings } from "./notif.js";

// firebase-init.js diimport terakhir karena
// ia memanggil loadDataFromFirebase yang butuh semua modul siap
import { db, currentUser as _cu } from "./firebase-init.js";

// ── HELPER: ambil currentUser yang selalu fresh ───────────────
// currentUser di firebase-init bisa berubah setelah onAuthStateChanged,
// jadi kita bungkus dalam getter agar selalu sinkron.
function uid() {
  // firebase-init meng-export 'currentUser' sebagai let,
  // kita re-import ulang tiap kali dibutuhkan lewat window helper
  return window._currentUser ? window._currentUser.uid : null;
}

// firebase-init.js akan set window._currentUser saat auth berubah
// (lihat catatan di firebase-init.js)

// ── INIT TAMPILAN ─────────────────────────────────────────────
populateSelects();
updateKategoriDropdown();

// Set tanggal hari ini di form
const nd = new Date();
nd.setMinutes(nd.getMinutes() - nd.getTimezoneOffset());
document.getElementById('f-tanggal').value = nd.toISOString().split('T')[0];

// Apply saved theme
if (localStorage.getItem('dompetku_theme') === 'dark') {
  document.body.classList.add('dark-theme');
  document.getElementById('theme-toggle').textContent = '☀️';
}

// ── BIND FUNGSI KE WINDOW (dipanggil dari HTML inline) ────────

window.simpan = () => simpan(db, uid());

window.hapusRecord = (id) => hapusRecord(id, db, uid());

window.editRecord = (id) => editRecord(id);

window.copyToForm = (id) => copyToForm(id);

window.resetForm = () => resetForm();

window.simpanBudget = () => simpanBudget(db, uid());

window.simpanPengaturanCC = () => simpanPengaturanCC(db, uid());

window.tambahKategori = () => tambahKategori(db, uid());

window.hapusKategori = (type, name) => hapusKategori(type, name, db, uid());

window.importDataTSV = () => importDataTSV(db, uid());

window.syncFieldsFromHistory = (val) => syncFieldsFromHistory(val);

window.konfirmasiLunasiCC = (periodKey, total, bulanLabel, tahun) =>
  konfirmasiLunasiCC(db, uid(), periodKey, total, bulanLabel, tahun);

window.batalLunasiCC = (periodKey) => batalLunasiCC(db, uid(), periodKey);

window.checkAutoCC = () => {
  document.getElementById('f-cc').checked =
    document.getElementById('f-metode').value === 'Kartu Kredit' &&
    document.getElementById('f-jenis').value  === 'Pengeluaran';
};

window.updateKategoriDropdown = updateKategoriDropdown;
window.formatRibuan           = formatRibuan;

// Notifikasi: jalankan scheduler setelah data siap
// (dipanggil dari data.js via window setelah loadDataFromFirebase selesai)
window._onDataReady = () => {
  startNotifScheduler();
  renderNotifSettings();
  // Refresh year options berdasarkan data aktual dari Firebase
  if (typeof window.refreshYearOptions === 'function') window.refreshYearOptions();
};
