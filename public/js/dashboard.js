/* ==========================================================================
   Smart POS — Remote Monitor dashboard logic
   Read-only: the only writes this page ever makes are to its own
   localStorage session token. It never sends anything back to the shop.
   ========================================================================== */

(function () {
  'use strict';

  const TOKEN_KEY = 'smartpos_cloud_token';
  const REFRESH_MS = 60 * 1000;
  const STALE_AFTER_MS = 20 * 60 * 1000; // shown as a gentle note, not an error

  const loginScreen = document.getElementById('loginScreen');
  const dashboard = document.getElementById('dashboard');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const loginBtn = document.getElementById('loginBtn');

  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
  function clearToken() { localStorage.removeItem(TOKEN_KEY); }

  function showLogin() {
    loginScreen.classList.remove('hidden');
    dashboard.classList.add('hidden');
  }

  function showDashboard() {
    loginScreen.classList.add('hidden');
    dashboard.classList.remove('hidden');
  }

  function escapeHTML(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function money(n) {
    return (Number(n) || 0).toFixed(2) + ' JD';
  }

  // Local report timestamps come as SQL "YYYY-MM-DD HH:MM:SS" in UTC with no
  // timezone marker — same parsing convention the local app's own reports
  // page uses, so times shown here match what the shop would see.
  function formatTime(sqlTimestamp) {
    if (!sqlTimestamp) return '—';
    const d = new Date(String(sqlTimestamp).replace(' ', 'T') + 'Z');
    if (isNaN(d.getTime())) return sqlTimestamp;
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function formatShowingDate(dateStr) {
    if (!dateStr) return 'No data yet';
    // dateStr is a plain "YYYY-MM-DD" calendar day, not an instant — format
    // it in UTC so a viewer in any timezone sees the same day the shop
    // meant, instead of it shifting back a day west of UTC.
    const d = new Date(dateStr + 'T00:00:00Z');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }

  function relativeTime(isoTimestamp) {
    if (!isoTimestamp) return '';
    const ms = Date.now() - new Date(isoTimestamp).getTime();
    if (isNaN(ms) || ms < 0) return '';
    const mins = Math.round(ms / 60000);
    if (mins < 1) return 'moments ago';
    if (mins === 1) return '1 minute ago';
    if (mins < 60) return `${mins} minutes ago`;
    const hrs = Math.round(mins / 60);
    if (hrs === 1) return '1 hour ago';
    if (hrs < 48) return `${hrs} hours ago`;
    const days = Math.round(hrs / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  async function api(path, options) {
    options = options || {};
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    const token = getToken();
    if (token) headers.Authorization = 'Bearer ' + token;

    const res = await fetch(path, Object.assign({}, options, { headers }));
    if (res.status === 401) {
      clearToken();
      showLogin();
      throw new Error('Session expired — please sign in again.');
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status}).`);
    return data;
  }

  function renderTable(bodyId, rows, colCount, rowFn) {
    const body = document.getElementById(bodyId);
    if (!rows || !rows.length) {
      body.innerHTML = `<tr class="empty-row"><td colspan="${colCount}">Nothing to show for this snapshot.</td></tr>`;
      return;
    }
    body.innerHTML = rows.map(rowFn).join('');
  }

  function render(snapshot) {
    const statusBanner = document.getElementById('statusBanner');
    const emptyState = document.getElementById('emptyState');
    const dataArea = document.getElementById('dataArea');

    if (!snapshot || snapshot.empty) {
      document.getElementById('showingDate').textContent = 'No data yet';
      document.getElementById('lastUpdated').textContent = '';
      emptyState.classList.remove('hidden');
      dataArea.classList.add('hidden');
      statusBanner.classList.add('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    dataArea.classList.remove('hidden');

    // Always show the date of the snapshot itself — never assume "today".
    // This is the last real closing data the shop sent, however old it is.
    document.getElementById('showingDate').textContent = formatShowingDate(snapshot.date);

    const receivedAt = snapshot.receivedAt || snapshot.generatedAt;
    const rel = relativeTime(receivedAt);
    document.getElementById('lastUpdated').textContent = rel ? `Last updated ${rel}` : '';

    const stale = receivedAt && (Date.now() - new Date(receivedAt).getTime() > STALE_AFTER_MS);
    if (stale) {
      statusBanner.textContent = `No new data from the shop in a while (last received ${rel}). This is expected if the shop is closed or offline right now — the numbers below are its last real closing data.`;
      statusBanner.classList.remove('hidden');
    } else {
      statusBanner.classList.add('hidden');
    }

    const summary = snapshot.summary || {};
    document.getElementById('statRevenue').textContent = money(summary.revenue);
    document.getElementById('statOrders').textContent = summary.orders != null ? summary.orders : '—';

    const paymentBreakdown = document.getElementById('paymentBreakdown');
    const methods = snapshot.paymentMethods || [];
    paymentBreakdown.innerHTML = methods.length
      ? methods.map((m) => `<div class="payment-row"><span class="method">${escapeHTML(m.method)} (${m.count})</span><span class="amount">${money(m.total)}</span></div>`).join('')
      : '<div class="payment-row"><span class="method">No sales yet</span></div>';

    renderTable('deletedInvoicesBody', snapshot.deletedInvoices, 5, (d) => `
      <tr>
        <td>${escapeHTML(d.invoiceNumber)}</td>
        <td>${money(d.total)}</td>
        <td>${escapeHTML(d.deletedBy)}</td>
        <td>${escapeHTML(d.reason)}</td>
        <td>${formatTime(d.deletedAt)}</td>
      </tr>
    `);

    renderTable('discountedSalesBody', snapshot.discountedSales, 5, (s) => `
      <tr>
        <td>${escapeHTML(s.invoiceNumber)}</td>
        <td>-${money(s.discount)}</td>
        <td>${money(s.total)}</td>
        <td>${escapeHTML(s.cashier)}</td>
        <td>${escapeHTML(s.table || '—')}</td>
      </tr>
    `);

    renderTable('tableChangesBody', snapshot.tableChanges, 6, (c) => `
      <tr>
        <td>${c.action === 'renamed' ? '✏️ Renamed' : '🗑️ Deleted'}</td>
        <td>${escapeHTML(c.oldName)}${c.newName ? ' → ' + escapeHTML(c.newName) : ''}</td>
        <td>${escapeHTML(c.reason)}</td>
        <td>${escapeHTML(c.requestedBy)}</td>
        <td>${escapeHTML(c.approvedBy)}</td>
        <td>${formatTime(c.changedAt)}</td>
      </tr>
    `);
  }

  let cameFromColdStart = false;

  async function loadData() {
    try {
      const data = await api('/api/data');
      render(data);
    } catch (err) {
      if (!cameFromColdStart) {
        // First failure while the free-tier instance wakes up — show a
        // friendly notice instead of a scary error, then retry shortly.
        cameFromColdStart = true;
        const statusBanner = document.getElementById('statusBanner');
        statusBanner.textContent = 'Waking up the server — this can take up to a minute on the first check.';
        statusBanner.classList.remove('hidden');
        setTimeout(loadData, 4000);
      }
    }
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    const password = document.getElementById('password').value;
    if (!password) {
      loginError.textContent = 'Enter the password.';
      return;
    }
    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in...';
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sign in failed.');
      setToken(data.token);
      showDashboard();
      cameFromColdStart = false;
      loadData();
    } catch (err) {
      loginError.textContent = err.message;
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign In';
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    clearToken();
    showLogin();
  });

  // ---------- Boot ----------
  if (getToken()) {
    showDashboard();
    loadData();
  } else {
    showLogin();
  }

  setInterval(() => {
    if (getToken() && !dashboard.classList.contains('hidden')) loadData();
  }, REFRESH_MS);
})();
