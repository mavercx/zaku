// ════════════════════════════════════════════
//  data.js — State Global & CRUD Firebase
// ════════════════════════════════════════════

import {
  collection, getDocs, addDoc, updateDoc,
  deleteDoc, doc, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

import { MONTHS, showToast, showLoading, hideLoading } from "./utils.js";
import { renderAll, updateKategoriDropdown, renderCategoryList } from "./render.js";
import { showModal }                       from "./ui.js";

// ── STATE GLOBAL ──────────────────────────────────────────────
window.data       = [];
window.budgets    = {};
window.ccPayments = {}; // { "Januari_2026": { tanggal, nominal } }
window.settings   = { ccLimit: 10000000, ccCutoff: 15 };
window.userCategories = {
  Pemasukan:    ['Gaji','Transfer Masuk','Sewa Gear Slowpulse','Bonus/THR','Freelance','Lainnya'],
  Pengeluaran:  ['Tagihan','Makan & Minum','Transportasi','Perawatan Picanto','Belanja',
                 'Gaya Hidup & Hobi','Freediving & Trip','Klinik Gigi','Kesehatan',
                 'Keluarga','Sosial & Sedekah','Investasi','Bayar Tagihan CC','Lain-lain'],
};

// ── LOAD DATA ─────────────────────────────────────────────────
export async function loadDataFromFirebase(uid, db) {
  showLoading();
  try {
    // Settings & kategori
    const setSnap = await getDoc(doc(db, 'users', uid, 'settings', 'config'));
    if (setSnap.exists()) {
      const d = setSnap.data();
      window.settings = { ccLimit: d.ccLimit || 10000000, ccCutoff: d.ccCutoff || 15 };
      if (d.categories) window.userCategories = d.categories;
    }
    document.getElementById('s-cc-limit').value         = window.settings.ccLimit;
    document.getElementById('s-cc-limit-display').value = window.settings.ccLimit.toLocaleString('id-ID');
    document.getElementById('s-cc-cutoff').value        = window.settings.ccCutoff;

    // Budgets
    const budSnap = await getDocs(collection(db, 'users', uid, 'budgets'));
    window.budgets = {};
    budSnap.forEach(d => { window.budgets[d.id] = d.data().limit; });

    // CC Payments
    const paySnap = await getDocs(collection(db, 'users', uid, 'ccPayments'));
    window.ccPayments = {};
    paySnap.forEach(d => { window.ccPayments[d.id] = d.data(); });

    // Transaksi
    const txSnap = await getDocs(collection(db, 'users', uid, 'transactions'));
    window.data = [];
    txSnap.forEach(d => { const r = d.data(); r.id = d.id; window.data.push(r); });

    updateKategoriDropdown();
    updateAutocomplete();
    renderAll();
    renderCategoryList();
    hideLoading();
    // Jalankan notif scheduler setelah semua data siap
    if (typeof window._onDataReady === 'function') window._onDataReady();
  } catch (e) {
    console.error(e);
    showToast('Gagal memuat data', 'error');
    hideLoading();
  }
}

// ── SIMPAN / EDIT TRANSAKSI ───────────────────────────────────
export async function simpan(db, uid) {
  const id     = document.getElementById('f-id').value;
  const isEdit = id !== '';

  const record = {
    tanggal:   document.getElementById('f-tanggal').value,
    jenis:     document.getElementById('f-jenis').value,
    kategori:  document.getElementById('f-kategori').value,
    metode:    document.getElementById('f-metode').value,
    nominal:   parseFloat(document.getElementById('f-nominal').value) || 0,
    keterangan:document.getElementById('f-ket').value.trim(),
    bulan:     MONTHS[new Date(document.getElementById('f-tanggal').value).getMonth()],
    tahun:     new Date(document.getElementById('f-tanggal').value).getFullYear(),
    cc:        document.getElementById('f-cc').checked,
    recurring: document.getElementById('f-recur').checked,
  };

  if (!record.tanggal)    return showToast('Tanggal belum diisi!', 'error');
  if (!record.keterangan) return showToast('Keterangan belum diisi!', 'error');
  if (!record.nominal)    return showToast('Nominal belum diisi!', 'error');

  showLoading();
  try {
    if (isEdit) {
      await updateDoc(doc(db, 'users', uid, 'transactions', id), record);
      const idx = window.data.findIndex(d => d.id === id);
      record.id = id;
      if (idx !== -1) window.data[idx] = record;
    } else {
      const ref = await addDoc(collection(db, 'users', uid, 'transactions'), record);
      record.id = ref.id;
      window.data.push(record);
    }
    updateAutocomplete();
    renderAll();
    hideLoading();
  } catch (e) {
    console.error('simpan error:', e);
    hideLoading();
    showToast('Gagal menyimpan: ' + (e?.message || e), 'error');
    return; // jangan reset form kalau gagal
  }
  // Di sini sudah pasti sukses — reset form & tampilkan notif
  resetForm();
  showToast(isEdit ? 'Transaksi diperbarui!' : 'Transaksi tersimpan!');
}

// ── HAPUS TRANSAKSI ───────────────────────────────────────────
export function hapusRecord(id, db, uid) {
  showModal('Hapus Transaksi?', 'Transaksi ini akan dihapus permanen dan tidak bisa dikembalikan.', async () => {
    showLoading();
    try {
      await deleteDoc(doc(db, 'users', uid, 'transactions', id));
      window.data = window.data.filter(d => d.id !== id);
      showToast('Transaksi dihapus!');
      renderAll();
      updateAutocomplete();
      hideLoading();
    } catch (e) {
      showToast('Gagal menghapus', 'error');
      hideLoading();
    }
  });
}

// ── EDIT TRANSAKSI (isi form) ─────────────────────────────────
export function editRecord(id) {
  const r = window.data.find(d => d.id === id);
  if (!r) return;
  document.getElementById('form-title').textContent       = 'Edit Transaksi';
  document.getElementById('f-id').value                   = r.id;
  document.getElementById('f-jenis').value                = r.jenis;
  updateKategoriDropdown();
  document.getElementById('f-tanggal').value              = r.tanggal;
  document.getElementById('f-metode').value               = r.metode;
  document.getElementById('f-kategori').value             = r.kategori;
  document.getElementById('f-nominal').value              = r.nominal;
  document.getElementById('f-nominal-display').value      = Number(r.nominal).toLocaleString('id-ID');
  document.getElementById('f-ket').value                  = r.keterangan;
  document.getElementById('f-cc').checked                 = r.cc;
  document.getElementById('f-recur').checked              = r.recurring;
  window.goTo('input', 'Catat');
}

// ── COPY KE FORM ──────────────────────────────────────────────
export function copyToForm(id) {
  const r = window.data.find(d => d.id === id);
  if (!r) return;
  document.getElementById('f-jenis').value           = r.jenis;
  updateKategoriDropdown();
  document.getElementById('f-kategori').value        = r.kategori;
  document.getElementById('f-metode').value          = r.metode;
  document.getElementById('f-nominal').value         = r.nominal;
  document.getElementById('f-nominal-display').value = Number(r.nominal).toLocaleString('id-ID');
  document.getElementById('f-ket').value             = r.keterangan;
  document.getElementById('f-cc').checked            = r.cc;
  document.getElementById('f-recur').checked         = r.recurring;
  window.goTo('input', 'Catat');
  showToast('Data disalin!');
}

// ── RESET FORM ────────────────────────────────────────────────
export function resetForm(navigasi = true) {
  document.getElementById('form-title').textContent   = 'Catat Transaksi';
  document.getElementById('f-id').value               = '';
  document.getElementById('f-nominal').value          = '';
  document.getElementById('f-nominal-display').value  = '';
  document.getElementById('f-ket').value              = '';
  document.getElementById('f-cc').checked             = false;
  document.getElementById('f-recur').checked          = false;
  // Reset ke default
  document.getElementById('f-jenis').value            = 'Pengeluaran';
  document.getElementById('f-metode').value           = 'QRIS/Transfer';
  updateKategoriDropdown();
  // Reset tanggal ke hari ini
  const nd = new Date();
  nd.setMinutes(nd.getMinutes() - nd.getTimezoneOffset());
  document.getElementById('f-tanggal').value = nd.toISOString().split('T')[0];
  if (navigasi && typeof window.goTo === 'function') window.goTo('beranda', 'Beranda');
}

// ── SIMPAN BUDGET ─────────────────────────────────────────────
export async function simpanBudget(db, uid) {
  const kat = document.getElementById('bg-kategori').value;
  const lim = parseFloat(document.getElementById('bg-limit').value);
  if (!lim) return showToast('Masukkan nominal valid', 'error');
  showLoading();
  try {
    await setDoc(doc(db, 'users', uid, 'budgets', kat), { limit: lim });
    window.budgets[kat] = lim;
    showToast('Anggaran diset!');
    window.renderBudget();
    hideLoading();
  } catch (e) {
    showToast('Gagal set anggaran', 'error');
    hideLoading();
  }
}

// ── SIMPAN PENGATURAN CC ──────────────────────────────────────
export async function simpanPengaturanCC(db, uid) {
  const lim = parseFloat(document.getElementById('s-cc-limit').value);
  const cut = parseInt(document.getElementById('s-cc-cutoff').value);
  if (!lim || lim <= 0)          return showToast('Limit CC tidak valid!', 'error');
  if (!cut || cut < 1 || cut > 28) return showToast('Tanggal cutoff harus antara 1–28', 'error');
  showLoading();
  try {
    window.settings.ccLimit  = lim;
    window.settings.ccCutoff = cut;
    await setDoc(
      doc(db, 'users', uid, 'settings', 'config'),
      { ...window.settings, categories: window.userCategories }
    );
    showToast('Pengaturan CC tersimpan!');
    window.renderBeranda();
    window.renderCC();
    hideLoading();
  } catch (e) {
    showToast('Gagal simpan CC', 'error');
    hideLoading();
  }
}

// ── TAMBAH / HAPUS KATEGORI ───────────────────────────────────
export async function tambahKategori(db, uid) {
  const name = document.getElementById('new-kat-name').value.trim();
  const type = document.getElementById('new-kat-type').value;
  if (!name) return;
  if (window.userCategories[type].includes(name)) return showToast('Kategori sudah ada', 'error');
  showLoading();
  window.userCategories[type].push(name);
  try {
    await setDoc(
      doc(db, 'users', uid, 'settings', 'config'),
      { ...window.settings, categories: window.userCategories }
    );
    document.getElementById('new-kat-name').value = '';
    updateKategoriDropdown();
    renderCategoryList();
    showToast('Kategori ditambahkan');
    hideLoading();
  } catch (e) {
    // Rollback optimistic update kalau Firebase gagal
    window.userCategories[type] = window.userCategories[type].filter(k => k !== name);
    showToast('Gagal menambah kategori', 'error');
    hideLoading();
  }
}

export function hapusKategori(type, name, db, uid) {
  showModal(`Hapus kategori "${name}"?`, 'Transaksi yang sudah menggunakan kategori ini tidak terpengaruh.', async () => {
    showLoading();
    window.userCategories[type] = window.userCategories[type].filter(k => k !== name);
    try {
      await setDoc(
        doc(db, 'users', uid, 'settings', 'config'),
        { ...window.settings, categories: window.userCategories }
      );
      updateKategoriDropdown();
      renderCategoryList();
      showToast('Kategori dihapus');
      hideLoading();
    } catch (e) {
      // Rollback — kembalikan kategori yang gagal dihapus
      window.userCategories[type].push(name);
      showToast('Gagal menghapus kategori', 'error');
      hideLoading();
    }
  });
}

// ── IMPORT TSV ────────────────────────────────────────────────
export function importDataTSV(db, uid) {
  const fi = document.getElementById('file-import');
  if (!fi.files.length) return showToast('Pilih file!', 'error');
  const reader = new FileReader();
  reader.onload = async (e) => {
    const lines = e.target.result.split('\n');
    let count = 0;
    showLoading();
    try {
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const c = lines[i].split('\t');
        if (c.length < 8) continue;

        let tgl = c[1] ? c[1].trim() : '';
        if (tgl.includes('/')) {
          const p = tgl.split('/');
          if (p.length === 3) tgl = `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
        }

        const record = {
          tanggal:   tgl,
          jenis:     c[2].trim(),
          kategori:  c[3].trim(),
          metode:    c[4].trim(),
          nominal:   parseFloat(c[5]) || 0,
          keterangan:c[6].replace(/^"|"$/g, '').trim(),
          bulan:     c[7].trim(),
          tahun:     parseInt(c[8]),
          cc:        c[9]?.trim().toUpperCase()  === 'TRUE',
          recurring: c[10]?.trim().toUpperCase() === 'TRUE',
        };

        const ref = await addDoc(collection(db, 'users', uid, 'transactions'), record);
        record.id = ref.id;
        window.data.push(record);
        count++;
      }
      showToast(`Migrasi ${count} transaksi sukses!`);
      updateAutocomplete();
      renderAll();
      hideLoading();
    } catch (err) {
      showToast('Gagal migrasi', 'error');
      hideLoading();
    }
  };
  reader.readAsText(fi.files[0]);
}

// ── KONFIRMASI LUNAS CC ──────────────────────────────────────
export async function konfirmasiLunasiCC(db, uid, periodKey, total, bulanLabel, tahun) {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  const tanggalBayar = today.toISOString().split('T')[0];

  showLoading();
  try {
    const payData = { tanggal: tanggalBayar, nominal: total, bulan: bulanLabel, tahun };
    await setDoc(doc(db, 'users', uid, 'ccPayments', periodKey), payData);
    window.ccPayments[periodKey] = payData;
    showToast(`Tagihan ${bulanLabel} ${tahun} dikonfirmasi lunas! ✅`);
    window.renderCC();
    hideLoading();
  } catch (e) {
    showToast('Gagal konfirmasi pembayaran', 'error');
    hideLoading();
  }
}

export async function batalLunasiCC(db, uid, periodKey) {
  showLoading();
  try {
    await deleteDoc(doc(db, 'users', uid, 'ccPayments', periodKey));
    delete window.ccPayments[periodKey];
    showToast('Status pembayaran dibatalkan');
    window.renderCC();
    hideLoading();
  } catch (e) {
    showToast('Gagal membatalkan', 'error');
    hideLoading();
  }
}

// ── AUTOCOMPLETE ──────────────────────────────────────────────
export function updateAutocomplete() {
  const unique = [...new Set(window.data.map(d => d.keterangan).filter(k => k && k.trim()))];
  document.getElementById('histori-ket').innerHTML =
    unique.map(k => `<option value="${k.replace(/"/g, '&quot;')}">`).join('');
}

export function syncFieldsFromHistory(val) {
  const match = window.data.find(d => d.keterangan === val);
  if (match) {
    document.getElementById('f-jenis').value           = match.jenis;
    updateKategoriDropdown();
    document.getElementById('f-kategori').value        = match.kategori;
    document.getElementById('f-metode').value          = match.metode;
    // Nominal sengaja tidak diisi — user mengisi sendiri
    // Gunakan checkAutoCC agar checkbox CC selalu konsisten dengan metode + jenis
    if (typeof window.checkAutoCC === 'function') window.checkAutoCC();
    showToast('Terisi otomatis dari riwayat!');
  }
}
