// ════════════════════════════════════════════
//  firebase-init.js — Konfigurasi & Auth
// ════════════════════════════════════════════

import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore }
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { loadDataFromFirebase }          from "./data.js";
import { openInstall, maybeShowSupport, showModal } from "./ui.js";
import { hideLoading, showToast, showLoading }      from "./utils.js";
// ── ONBOARDING ────────────────────────────────────────────────
import { isNewUser, showWelcomeModal, enrichEmptyState } from "./onboarding.js";

const firebaseConfig = {
  apiKey:            "AIzaSyD8p2vn3_VSBgtKAQJThv6i-yTSR430wuk",
  authDomain:        "dompetku-app-22ab5.firebaseapp.com",
  projectId:         "dompetku-app-22ab5",
  storageBucket:     "dompetku-app-22ab5.firebasestorage.app",
  messagingSenderId: "329761272621",
  appId:             "1:329761272621:web:0d4dc882815beb89e399a4"
};

const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const db       = getFirestore(app);
const provider = new GoogleAuthProvider();

export { db };
export let currentUser = null;

// ── AUTH STATE ────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser         = user;
    window._currentUser = user; // agar app.js bisa baca uid
    document.getElementById('login-page').style.display  = 'none';
    document.getElementById('app-content').style.display = 'block';
    await loadDataFromFirebase(user.uid, db);

    // ── Cek onboarding user baru ──────────────────────────────
    const newUser = await isNewUser(user.uid, db);
    if (newUser) {
      // User pertama kali login: tampilkan welcome modal
      // Install prompt & support ditangani di dalam onboarding setelah modal ditutup
      setTimeout(() => showWelcomeModal(user.uid, db), 800);
      enrichEmptyState(); // perkaya empty state dengan contoh dummy
    } else if (!localStorage.getItem('dompetku_install_shown')) {
      setTimeout(() => openInstall(), 2000);
    } else {
      maybeShowSupport();
    }
    // ─────────────────────────────────────────────────────────

  } else {
    currentUser         = null;
    window._currentUser = null;
    document.getElementById('login-page').style.display  = 'flex';
    document.getElementById('app-content').style.display = 'none';
    hideLoading();
  }
});

// ── LOGIN / LOGOUT ────────────────────────────────────────────
window.loginGoogle = () => {
  showLoading();
  signInWithPopup(auth, provider).catch(() => {
    showToast('Gagal Login', 'error');
    hideLoading();
  });
};

window.confirmLogout = () => {
  showModal(
    'Konfirmasi Logout',
    'Yakin ingin logout? Data tersimpan dan bisa diakses lagi saat masuk.',
    () => signOut(auth),
    'Logout'
  );
};
