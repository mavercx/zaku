// ════════════════════════════════════════════
//  onboarding.js — Welcome Modal & Empty State
// ════════════════════════════════════════════

import { doc, getDoc, setDoc }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// ── KONTEN SLIDE WELCOME ──────────────────────────────────────
const SLIDES = [
  {
    icon:  '👋',
    title: 'Selamat datang di Zaku!',
    desc:  'Zaku membantu kamu mencatat, memantau, dan memahami keuangan pribadi — semua tersimpan aman di cloud.',
  },
  {
    icon:  '✏️',
    title: 'Catat Transaksi',
    desc:  'Ketuk tombol <strong>Catat</strong> di bagian bawah layar. Isi nominal, kategori, dan keterangan — selesai dalam 10 detik.',
  },
  {
    icon:  '📊',
    title: 'Pantau Keuangan',
    desc:  'Halaman <strong>Analitik</strong> menampilkan grafik pemasukan vs pengeluaran. Halaman <strong>Budget</strong> membantu mengontrol pengeluaran per kategori.',
  },
  {
    icon:  '💳',
    title: 'Kelola Kartu Kredit',
    desc:  'Halaman <strong>CC</strong> melacak tagihan kartu kreditmu otomatis berdasarkan siklus billing yang kamu atur.',
  },
  {
    icon:  '🚀',
    title: 'Siap mulai!',
    desc:  'Data kamu tersimpan otomatis. Mulai dengan catat transaksi pertamamu sekarang.',
  },
];

let _currentSlide = 0;

// ── CEK USER BARU ─────────────────────────────────────────────
export async function isNewUser(uid, db) {
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'settings', 'config'));
    if (!snap.exists()) return true;
    const d = snap.data();
    return !d.onboarded;
  } catch {
    return false;
  }
}

export async function markUserOnboarded(uid, db) {
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'settings', 'config'));
    const existing = snap.exists() ? snap.data() : {};
    await setDoc(
      doc(db, 'users', uid, 'settings', 'config'),
      { ...existing, onboarded: true },
      { merge: true }
    );
  } catch (e) {
    console.error('markUserOnboarded error:', e);
  }
}

// ── RENDER & TAMPILKAN MODAL ──────────────────────────────────
export function showWelcomeModal(uid, db) {
  if (document.getElementById('onboarding-overlay')) return; // sudah ada

  _currentSlide = 0;

  const overlay = document.createElement('div');
  overlay.id = 'onboarding-overlay';
  overlay.className = 'ob-overlay';
  overlay.innerHTML = _buildModal();
  document.body.appendChild(overlay);

  // Double rAF: pastikan browser sudah render state awal (opacity:0) sebelum transisi
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('ob-visible')));

  _bindEvents(uid, db);
  _renderSlide();
}

function _buildModal() {
  return `
    <div class="ob-card" role="dialog" aria-modal="true" aria-label="Selamat datang di Zaku">
      <div class="ob-body">
        <div class="ob-icon" id="ob-icon"></div>
        <h2 class="ob-title" id="ob-title"></h2>
        <p class="ob-desc" id="ob-desc"></p>
      </div>
      <div class="ob-dots" id="ob-dots"></div>
      <div class="ob-footer">
        <button class="ob-btn-skip" id="ob-skip">Lewati</button>
        <button class="ob-btn-next" id="ob-next">Lanjut →</button>
      </div>
    </div>
  `;
}

function _renderSlide() {
  const slide = SLIDES[_currentSlide];
  const isLast = _currentSlide === SLIDES.length - 1;

  const icon  = document.getElementById('ob-icon');
  const title = document.getElementById('ob-title');
  const desc  = document.getElementById('ob-desc');
  const next  = document.getElementById('ob-next');
  const dots  = document.getElementById('ob-dots');

  // Transisi
  [icon, title, desc].forEach(el => {
    el.classList.remove('ob-fade-in');
    void el.offsetWidth; // reflow
    el.classList.add('ob-fade-in');
  });

  icon.textContent  = slide.icon;
  title.textContent = slide.title;
  desc.innerHTML    = slide.desc;
  next.textContent  = isLast ? 'Mulai Sekarang 🚀' : 'Lanjut →';

  // Dots
  dots.innerHTML = SLIDES.map((_, i) =>
    `<span class="ob-dot ${i === _currentSlide ? 'ob-dot-active' : ''}"></span>`
  ).join('');
}

function _bindEvents(uid, db) {
  document.getElementById('ob-next').addEventListener('click', () => {
    if (_currentSlide < SLIDES.length - 1) {
      _currentSlide++;
      _renderSlide();
    } else {
      _closeWelcomeModal(uid, db);
    }
  });

  document.getElementById('ob-skip').addEventListener('click', () => {
    _closeWelcomeModal(uid, db);
  });

  // Swipe gesture (mobile)
  let startX = 0;
  const card = document.querySelector('.ob-card');
  card.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  card.addEventListener('touchend', e => {
    const diff = startX - e.changedTouches[0].clientX;
    if (diff > 50 && _currentSlide < SLIDES.length - 1) { _currentSlide++; _renderSlide(); }
    if (diff < -50 && _currentSlide > 0)                { _currentSlide--; _renderSlide(); }
  });
}

function _closeWelcomeModal(uid, db) {
  const overlay = document.getElementById('onboarding-overlay');
  if (!overlay) return;
  overlay.classList.remove('ob-visible');
  overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
  markUserOnboarded(uid, db);
  // Setelah modal tutup, panggil install atau support seperti biasa
  if (!localStorage.getItem('dompetku_install_shown')) {
    setTimeout(() => window.openInstall?.(), 500);
  } else {
    window.maybeShowSupport?.();
  }
}

// ── EMPTY STATE DIPERKAYA ─────────────────────────────────────
const DUMMY_TRANSACTIONS = [
  { icon: '🍜', label: 'Makan Siang', jenis: 'Pengeluaran', nominal: 35000, kategori: 'Makan & Minum', warna: 'var(--red)' },
  { icon: '💼', label: 'Gaji Bulanan', jenis: 'Pemasukan',  nominal: 5000000, kategori: 'Gaji', warna: 'var(--green)' },
  { icon: '🚗', label: 'BBM', jenis: 'Pengeluaran', nominal: 150000, kategori: 'Transportasi', warna: 'var(--red)' },
];

export function enrichEmptyState() {
  const container = document.getElementById('empty-state-hint');
  if (!container) return; // element tidak ada di HTML, skip

  container.innerHTML = `
    <p class="ob-empty-label">Contoh tampilan transaksi:</p>
    <div class="ob-dummy-list">
      ${DUMMY_TRANSACTIONS.map(t => `
        <div class="ob-dummy-item">
          <span class="ob-dummy-icon">${t.icon}</span>
          <div class="ob-dummy-info">
            <span class="ob-dummy-name">${t.label}</span>
            <span class="ob-dummy-cat">${t.kategori}</span>
          </div>
          <span class="ob-dummy-nominal" style="color:${t.warna}">
            ${t.jenis === 'Pemasukan' ? '+' : '-'}Rp ${t.nominal.toLocaleString('id-ID')}
          </span>
        </div>
      `).join('')}
    </div>
    <p class="ob-empty-cta">Ketuk <strong>Catat</strong> di bawah untuk mulai mencatat transaksimu 👇</p>
  `;
}

// Expose untuk inline HTML jika dibutuhkan
window.showWelcomeModal = showWelcomeModal;
