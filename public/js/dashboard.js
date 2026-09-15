/* Smart POS Cloud — manager page: one shop's day, read-only. */
(function () {
  'use strict';

  const { t, api, escapeHTML, money, relativeTime, clockTime } = window.SPC;
  const TOKEN_KEY = 'spc_manager_token';
  const REFRESH_MS = 60 * 1000;
  const OFFLINE_AFTER_MS = 25 * 60 * 1000; // the shop pushes every 10 minutes

  const $ = (id) => document.getElementById(id);
  let token = null;
  let shop = null;
  let selectedDate = null;
  let lastSnapshot = null;
  let refreshTimer = null;

  try { token = localStorage.getItem(TOKEN_KEY); } catch (e) { token = null; }

  /* ---------- Sign-in ---------- */

  function showLogin() {
    clearInterval(refreshTimer);
    $('app').hidden = true;
    $('loginScreen').hidden = false;
    $('shopCode').focus();
  }

  function signOut() {
    token = null;
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
    showLogin();
  }

  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = $('shopCode').value.trim();
    const password = $('password').value;
    const errorEl = $('loginError');
    if (!code || !password) { errorEl.textContent = t('fill_both'); return; }

    const btn = $('loginBtn');
    btn.disabled = true;
    btn.textContent = t('signing_in');
    errorEl.textContent = '';
    // A sleeping free server can take a while to answer the first request.
    const slowTimer = setTimeout(() => { errorEl.textContent = t('waking_up'); }, 4000);
    try {
      const result = await api('POST', '/api/login', { code, password });
      token = result.token;
      try { localStorage.setItem(TOKEN_KEY, token); } catch (err) { /* stays signed in for this visit */ }
      $('password').value = '';
      errorEl.textContent = '';
      await openApp();
    } catch (err) {
      errorEl.textContent = err.message;
    } finally {
      clearTimeout(slowTimer);
      btn.disabled = false;
      btn.textContent = t('sign_in');
    }
  });

  /* ---------- Data ---------- */

  function handleAuthError(err) {
    if (err.status === 401 || err.status === 403) {
      signOut();
      $('loginError').textContent = err.message;
      return true;
    }
    return false;
  }

  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function yesterdayISO() { return new Date(Date.now() - 86400000).toISOString().slice(0, 10); }

  function dayLabel(date) {
    if (date === todayISO()) return t('today');
    if (date === yesterdayISO()) return t('yesterday');
    return new Date(date + 'T12:00:00Z').toLocaleDateString(window.SPC.lang() === 'ar' ? 'ar-JO' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function renderDayOptions() {
    const dates = [...new Set([todayISO(), ...(shop.dates || [])])].sort().reverse();
    if (!selectedDate || !dates.includes(selectedDate)) selectedDate = dates[0];
    $('daySelect').innerHTML = dates.map((d) => `<option value="${d}" ${d === selectedDate ? 'selected' : ''}>${escapeHTML(dayLabel(d))}</option>`).join('');
  }

  async function loadShop() {
    shop = await api('GET', '/api/shop', null, token);
    $('shopName').textContent = shop.name;
    renderDayOptions();
  }

  async function loadDay() {
    const btn = $('refreshBtn');
    btn.disabled = true;
    try {
      lastSnapshot = await api('GET', `/api/shop/snapshot?date=${selectedDate}`, null, token);
      render();
    } catch (err) {
      if (!handleAuthError(err)) showNotice('danger', err.message);
    } finally {
      btn.disabled = false;
    }
  }

  async function refreshAll() {
    try {
      await loadShop();
      await loadDay();
    } catch (err) {
      if (!handleAuthError(err)) showNotice('danger', err.message);
    }
  }

  async function openApp() {
    $('loginScreen').hidden = true;
    $('app').hidden = false;
    await refreshAll();
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => { if (!document.hidden) refreshAll(); }, REFRESH_MS);
  }

  /* ---------- Rendering ---------- */

  function showNotice(tone, text) {
    const el = $('notice');
    el.className = `notice notice-${tone}`;
    el.textContent = text;
    el.hidden = !text;
  }

  const amount = (n) => `${money(n)}<small>${escapeHTML(t('currency'))}</small>`;
  const listOrEmpty = (items, render) => (items && items.length ? items.map(render).join('') : `<li class="empty-line">${escapeHTML(t('nothing_today'))}</li>`);

  function paymentName(method) {
    const key = 'pay_' + String(method || '').toLowerCase();
    const translated = t(key);
    return translated === key ? method : translated;
  }

  function render() {
    const snap = lastSnapshot;
    const isToday = selectedDate === todayISO();
    const lastPush = shop.lastPushAt;

    if (!lastPush) {
      showNotice('', '');
      $('dataArea').hidden = true;
      $('emptyState').hidden = false;
      $('emptyTitle').textContent = t('never_connected_title');
      $('emptySub').textContent = t('never_connected_sub');
      $('updatedText').textContent = '';
      return;
    }

    const offline = Date.now() - new Date(lastPush).getTime() > OFFLINE_AFTER_MS;
    showNotice('warning', isToday && offline ? t('shop_offline', { time: relativeTime(lastPush) }) : '');
    $('updatedText').textContent = snap && snap.receivedAt ? t('updated_from_shop', { time: relativeTime(snap.receivedAt) }) : '';

    if (!snap || snap.empty) {
      $('dataArea').hidden = true;
      $('emptyState').hidden = false;
      $('emptyTitle').textContent = t('no_data_title');
      $('emptySub').textContent = t('no_data_sub');
      return;
    }
    $('emptyState').hidden = true;
    $('dataArea').hidden = false;

    const d = snap.data;
    const summary = d.summary || {};
    $('statRevenue').innerHTML = amount(summary.revenue);
    $('statOrders').textContent = String(summary.orders || 0);
    $('statProfit').innerHTML = amount(summary.profit);
    $('statCash').innerHTML = amount(d.expectedCashInDrawer);

    const payments = d.paymentBreakdown || [];
    const maxPay = Math.max(1, ...payments.map((p) => p.total));
    $('paymentList').innerHTML = payments.length ? payments.map((p) => `
      <div class="bar-row">
        <div class="bar-head">
          <span>${escapeHTML(paymentName(p.method))} <span class="meta">· ${escapeHTML(t('transactions', { n: p.count }))}</span></span>
          <span class="amount">${money(p.total)} ${escapeHTML(t('currency'))}</span>
        </div>
        <div class="bar ${escapeHTML(String(p.method).toLowerCase())}"><span data-w="${Math.round((p.total / maxPay) * 100)}"></span></div>
      </div>`).join('') : `<p class="empty-line">${escapeHTML(t('nothing_today'))}</p>`;
    // Widths set through the DOM, not inline style attributes (blocked by the page's security policy).
    $('paymentList').querySelectorAll('[data-w]').forEach((el) => { el.style.width = el.getAttribute('data-w') + '%'; });

    $('topList').innerHTML = listOrEmpty(d.topProducts, (p) => `
      <li><div class="main"><div class="title">${escapeHTML(p.name)}</div><div class="sub">${escapeHTML(t('qty', { n: p.qty }))}</div></div>
      <div class="end">${money(p.total)}</div></li>`);

    $('expensesTotal').textContent = d.externalExpenses && d.externalExpenses.length ? `${money(d.externalExpensesTotal)} ${t('currency')}` : '';
    $('expensesList').innerHTML = listOrEmpty(d.externalExpenses, (e) => `
      <li><div class="main"><div class="title">${escapeHTML(e.items)}</div>
      <div class="sub">${escapeHTML(t('recorded_by', { name: e.recordedBy || '—' }))}${e.approvedBy ? ' · ' + escapeHTML(t('approved_by', { name: e.approvedBy })) : ''} · <span class="ltr">${escapeHTML(clockTime(e.createdAt))}</span></div></div>
      <div class="end">${money(e.amount)}</div></li>`);

    const deleted = d.deletedInvoices || [];
    $('deletedCount').textContent = deleted.length ? String(deleted.length) : '';
    $('deletedList').innerHTML = listOrEmpty(deleted, (x) => `
      <li><div class="main"><div class="title"><span class="ltr">${escapeHTML(x.invoiceNumber)}</span> <span class="pill pill-danger">${escapeHTML(t('deleted_by', { name: x.deletedBy || '—' }))}</span></div>
      <div class="sub">${x.reason ? escapeHTML(t('reason', { text: x.reason })) + ' · ' : ''}<span class="ltr">${escapeHTML(clockTime(x.deletedAt))}</span></div></div>
      <div class="end">${money(x.total)}</div></li>`);

    const discounts = d.discountedSales || [];
    $('discountCount').textContent = discounts.length ? String(discounts.length) : '';
    $('discountList').innerHTML = listOrEmpty(discounts, (x) => `
      <li><div class="main"><div class="title"><span class="ltr">${escapeHTML(x.invoiceNumber)}</span> <span class="pill pill-warning">${escapeHTML(t('discount_of', { amount: money(x.discount) }))}</span></div>
      <div class="sub">${escapeHTML(t('cashier', { name: x.cashier || '—' }))}${x.table ? ' · ' + escapeHTML(t('table', { name: x.table })) : ''} · <span class="ltr">${escapeHTML(clockTime(x.createdAt))}</span></div></div>
      <div class="end">${money(x.total)}</div></li>`);

    const tables = d.tableChanges || [];
    $('tableCount').textContent = tables.length ? String(tables.length) : '';
    $('tableList').innerHTML = listOrEmpty(tables, (x) => `
      <li><div class="main"><div class="title">${escapeHTML(x.action === 'renamed' ? t('table_renamed', { old: x.oldName, new: x.newName }) : t('table_deleted', { old: x.oldName }))}</div>
      <div class="sub">${escapeHTML(t('requested_by', { name: x.requestedBy || '—' }))}${x.approvedBy ? ' · ' + escapeHTML(t('approved_by', { name: x.approvedBy })) : ''}${x.reason ? ' · ' + escapeHTML(t('reason', { text: x.reason })) : ''} · <span class="ltr">${escapeHTML(clockTime(x.changedAt))}</span></div></div></li>`);

    const low = d.lowStock;
    $('lowStockCard').hidden = !Array.isArray(low);
    if (Array.isArray(low)) {
      $('lowStockCount').textContent = low.length ? String(low.length) : '';
      $('lowStockList').innerHTML = listOrEmpty(low, (p) => `
        <li><div class="main"><div class="title">${escapeHTML(p.name)}</div></div>
        <div class="end"><span class="pill ${p.stock <= 0 ? 'pill-danger' : 'pill-warning'}">${escapeHTML(p.stock <= 0 ? t('out_of_stock') : t('stock_left', { n: p.stock }))}</span></div></li>`);
    }
  }

  /* ---------- Wiring ---------- */

  document.querySelectorAll('.langBtn').forEach((btn) => btn.addEventListener('click', () => {
    window.SPC.setLang(window.SPC.lang() === 'ar' ? 'en' : 'ar');
    if (shop) { renderDayOptions(); render(); }
  }));
  $('logoutBtn').addEventListener('click', signOut);
  $('refreshBtn').addEventListener('click', refreshAll);
  $('daySelect').addEventListener('change', (e) => { selectedDate = e.target.value; loadDay(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && token && shop) refreshAll(); });

  $('loginLogo').innerHTML = window.SPC.logoHTML();
  $('topLogo').innerHTML = window.SPC.logoHTML();
  window.SPC.applyLang();

  if (token) openApp(); else showLogin();
})();
