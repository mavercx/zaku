// ════════════════════════════════════════════
//  ux.js — Zaku UX Enhancements
//  • Bottom nav active state sync
//  • Swipe periode (kiri/kanan ganti bulan)
//  • Swipe-to-delete transaksi
//  • FAB entrance animation
// ════════════════════════════════════════════

import { MONTHS } from './utils.js';

// ── CONSTANTS ─────────────────────────────────
const SWIPE_THRESHOLD   = 50;   // px minimum swipe distance
const SWIPE_RESTRAINT   = 80;   // px max perpendicular drift
const DELETE_THRESHOLD  = 80;   // px swipe to reveal delete

// ── 1. BOTTOM NAV ACTIVE STATE ────────────────
// goTo() di ui.js sudah memanggil window._updateBottomNav langsung.
// ux.js tidak perlu patch lagi — cukup pastikan fungsi tersedia.
(function initBottomNavSync() {
  // Set active state saat halaman pertama load
  document.addEventListener('DOMContentLoaded', () => {
    const activePage = document.querySelector('.page.active');
    if (activePage && typeof window._updateBottomNav === 'function') {
      window._updateBottomNav(activePage.id.replace('page-', ''));
    }
  });
  // Fallback: kalau DOMContentLoaded sudah lewat (modul load async)
  if (document.readyState !== 'loading') {
    setTimeout(() => {
      const activePage = document.querySelector('.page.active');
      if (activePage && typeof window._updateBottomNav === 'function') {
        window._updateBottomNav(activePage.id.replace('page-', ''));
      }
    }, 300);
  }
})();

// _updateBottomNav sekarang didefinisikan di ui.js dan di-expose ke window

// ── 2. MORE MENU ──────────────────────────────
window.toggleMoreMenu = function() {
  const d = document.getElementById('more-dropdown');
  if (!d) return;
  d.classList.toggle('show');
};
window.closeMoreMenu = function() {
  const d = document.getElementById('more-dropdown');
  if (d) d.classList.remove('show');
};
document.addEventListener('click', (e) => {
  if (!e.target.closest('.export-wrap')) {
    document.querySelectorAll('.export-dropdown.show, .more-dropdown.show')
      .forEach(d => d.classList.remove('show'));
  }
});

// ── 3. SWIPE PERIODE ──────────────────────────
// Swipe left = next month, swipe right = prev month
// Attaches to any element with [data-swipe-period]

function initSwipePeriod() {
  const MONTH_IDS = {
    'page-beranda':    { m: 'b-month', y: 'b-year' },
    'page-transaksi':  { m: 't-month', y: 't-year' },
    'page-analitik':   { m: 'a-month', y: 'a-year' },
    'page-budget':     { m: 'bg-month', y: 'bg-year' },
    'page-cc':         { m: 'c-month', y: 'c-year' },
  };

  function getActivePage() {
    return document.querySelector('.page.active');
  }

  function shiftMonth(direction) {
    const page = getActivePage();
    if (!page) return;
    const ids = MONTH_IDS[page.id];
    if (!ids) return;

    const mEl = document.getElementById(ids.m);
    const yEl = document.getElementById(ids.y);
    if (!mEl || !yEl) return;

    let mIdx = MONTHS.indexOf(mEl.value);
    let y    = parseInt(yEl.value);
    if (mIdx === -1) return;

    mIdx += direction; // -1 = prev, +1 = next
    if (mIdx < 0)  { mIdx = 11; y--; }
    if (mIdx > 11) { mIdx = 0;  y++; }

    mEl.value = MONTHS[mIdx];
    yEl.value = y;

    // Sync all period bars via existing syncPeriod if available
    if (typeof window.syncPeriod === 'function') {
      window.syncPeriod(ids.m);
    } else if (typeof window.renderAll === 'function') {
      window.renderAll();
    }

    // Haptic feedback on supported devices
    if (navigator.vibrate) navigator.vibrate(12);

    // Show month indicator
    showMonthToast(MONTHS[mIdx], y);
  }

  function showMonthToast(month, year) {
    let el = document.getElementById('period-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'period-toast';
      el.className = 'period-toast';
      document.body.appendChild(el);
    }
    el.textContent = `${month} ${year}`;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 1200);
  }

  // Attach swipe to the full page container (catches swipes anywhere on page)
  let touchStartX = 0, touchStartY = 0;

  document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    // Ignore if inside a swipe-delete item being dragged
    if (e.target.closest('.row-item.swiping')) return;
    // Ignore if inside a modal or dropdown
    if (e.target.closest('[id$="-overlay"]') || e.target.closest('.export-dropdown')) return;

    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;

    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (Math.abs(dy) > SWIPE_RESTRAINT) return;

    // Only trigger swipe on period-bar area or main content area
    const activePage = getActivePage();
    if (!activePage) return;

    // swipe left → next month, swipe right → prev month
    shiftMonth(dx < 0 ? 1 : -1);
  }, { passive: true });
}

// ── 4. SWIPE-TO-DELETE ────────────────────────
// Attaches to #t-list [data-swipe-delete]
// Row slides left, red delete button appears

function initSwipeToDelete() {
  const list = document.getElementById('t-list');
  if (!list) return;

  // Use MutationObserver to handle dynamically rendered rows
  const observer = new MutationObserver(() => attachSwipeHandlers(list));
  observer.observe(list, { childList: true });
  attachSwipeHandlers(list);
}

function attachSwipeHandlers(container) {
  container.querySelectorAll('.row-item:not([data-swipe-init])').forEach(row => {
    row.setAttribute('data-swipe-init', '1');

    // Wrap inner content in a translate layer
    row.style.position = 'relative';
    row.style.overflow = 'hidden';
    row.style.transition = 'none';

    // Build delete reveal button
    let delBtn = row.querySelector('.swipe-del-btn');
    if (!delBtn) {
      delBtn = document.createElement('button');
      delBtn.className = 'swipe-del-btn';
      delBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="3,6 5,6 21,6"/><path d="M19,6v14a2,2,0,01-2,2H7a2,2,0,01-2-2V6m3,0V4a2,2,0,012-2h4a2,2,0,012,2v2"/></svg><span>Hapus</span>';

      // Get the hapus function from the existing edit button's sibling
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const hapusBtn = row.querySelector('.btn-action[onclick*="hapusRecord"]');
        if (hapusBtn) hapusBtn.click();
        else resetRow(row);
      });
      row.appendChild(delBtn);
    }

    // Inner content wrapper for translate
    let inner = row.querySelector('.row-swipe-inner');
    if (!inner) {
      inner = document.createElement('div');
      inner.className = 'row-swipe-inner';
      // Move all children except delBtn into inner
      [...row.children].forEach(c => {
        if (!c.classList.contains('swipe-del-btn')) inner.appendChild(c);
      });
      row.insertBefore(inner, delBtn);
    }

    let startX = 0, startY = 0, currentX = 0, dragging = false, opened = false;

    inner.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      currentX = 0;
      dragging = true;
      inner.style.transition = 'none';
    }, { passive: true });

    inner.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const dx = e.touches[0].clientX - startX;
      const dy = Math.abs(e.touches[0].clientY - startY);
      if (dy > 20 && Math.abs(dx) < dy) { dragging = false; return; }

      currentX = Math.min(0, opened ? dx - DELETE_THRESHOLD : dx);
      currentX = Math.max(-DELETE_THRESHOLD - 20, currentX);

      if (currentX < -5) row.classList.add('swiping');
      inner.style.transform = `translateX(${currentX}px)`;

      const pct = Math.min(Math.abs(currentX) / DELETE_THRESHOLD, 1);
      delBtn.style.opacity = pct;
    }, { passive: true });

    inner.addEventListener('touchend', () => {
      dragging = false;
      row.classList.remove('swiping');
      inner.style.transition = 'transform 0.25s cubic-bezier(0.25,0.46,0.45,0.94)';

      if (currentX < -(DELETE_THRESHOLD * 0.55)) {
        // Snap open
        inner.style.transform = `translateX(-${DELETE_THRESHOLD}px)`;
        delBtn.style.opacity = '1';
        opened = true;
        // Auto-close after 4s
        clearTimeout(row._closeTimer);
        row._closeTimer = setTimeout(() => resetRow(row), 4000);
      } else {
        resetRow(row);
      }
    });
  });
}

function resetRow(row) {
  const inner = row.querySelector('.row-swipe-inner');
  const delBtn = row.querySelector('.swipe-del-btn');
  if (inner) {
    inner.style.transition = 'transform 0.25s cubic-bezier(0.25,0.46,0.45,0.94)';
    inner.style.transform = 'translateX(0)';
  }
  if (delBtn) delBtn.style.opacity = '0';
}

// Reset any open swipe row when tapping elsewhere
document.addEventListener('touchstart', (e) => {
  if (!e.target.closest('.row-item')) {
    document.querySelectorAll('.row-item').forEach(r => resetRow(r));
  }
}, { passive: true });

// ── INIT ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initSwipePeriod();
  // swipe-to-delete init runs after app renders t-list
  setTimeout(initSwipeToDelete, 800);
});

// Also expose for app.js to call after render
window.initSwipeToDelete = initSwipeToDelete;
