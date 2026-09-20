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
  // Picked by hand from the list; otherwise the page follows the shop's day.
  let userPicked = false;
  // What each loaded day told us: { running, finished, orders }. Shops on an
  // older app don't send it, and the page falls back to the phone's calendar.
  const dayInfo = {};
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

  // The shop reports its own local business day; label with the viewer's local calendar (not UTC),
  // or "Today" would point at yesterday for the first hours after midnight.
  function localISO(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function todayISO() { return localISO(0); }
  function yesterdayISO() { return localISO(-1); }

  const dateText = (date) => new Date(date + 'T12:00:00').toLocaleDateString(window.SPC.lang() === 'ar' ? 'ar-JO' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  /** Does the shop tell us its own day (app 1.1.8+)? */
  const shopKnowsItsDay = () => Object.values(dayInfo).some((info) => typeof info.running === 'boolean');

  function dayLabel(date) {
    const info = dayInfo[date];
    if (!shopKnowsItsDay()) {
      if (date === todayISO()) return t('today');
      if (date === yesterdayISO()) return t('yesterday');
      return dateText(date);
    }
    // The shop's day can end at 9pm or 1am, so name days by date, not by the phone's "today".
    if (info && info.running) return `${dateText(date)} · ${t('day_running')}`;
    if (info && info.finished) return `${dateText(date)} · ${t('day_finished_mark')}`;
    return dateText(date);
  }

  function rememberDay(date, snap) {
    if (!snap || snap.empty || !snap.data) return;
    const d = snap.data;
    dayInfo[date] = { running: d.running, finished: d.finished || null, orders: (d.summary && d.summary.orders) || 0 };
  }

  async function fetchDay(date) {
    const snap = await api('GET', `/api/shop/snapshot?date=${date}`, null, token);
    rememberDay(date, snap);
    return snap;
  }

  function dayDates() {
    const stored = shop.dates || [];
    return (shopKnowsItsDay() ? [...stored] : [...new Set([todayISO(), ...stored])]).sort().reverse();
  }

  function renderDayOptions() {
    const dates = dayDates();
    if (!selectedDate || !dates.includes(selectedDate)) selectedDate = dates[0];
    $('daySelect').innerHTML = dates.map((d) => `<option value="${d}" ${d === selectedDate ? 'selected' : ''}>${escapeHTML(dayLabel(d))}</option>`).join('');
  }

  /**
   * Which day to open on: the shop's current day — unless it was just
   * finished and nothing has been sold since, then the finished day, so the
   * manager lands on the final numbers.
   */
  async function pickDefaultDay() {
    const dates = [...(shop.dates || [])].sort().reverse();
    if (!dates.length) return;
    const newest = await fetchDay(dates[0]);
    let pick = dates[0];
    const info = dayInfo[dates[0]];
    if (info && info.running && info.orders === 0 && dates[1]) {
      const previous = await fetchDay(dates[1]);
      if (dayInfo[dates[1]] && dayInfo[dates[1]].finished) { pick = dates[1]; lastSnapshot = previous; }
    }
    if (pick === dates[0]) lastSnapshot = newest;
    selectedDate = pick;
  }

  async function loadShop() {
    shop = await api('GET', '/api/shop', null, token);
    $('shopName').textContent = shop.name;
    if (!userPicked) await pickDefaultDay();
    renderDayOptions();
  }

  async function loadDay() {
    const btn = $('refreshBtn');
    btn.disabled = true;
    try {
      lastSnapshot = await fetchDay(selectedDate);
      renderDayOptions();
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
      if (userPicked || !lastSnapshot || lastSnapshot.date !== selectedDate) await loadDay();
      else render();
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
    const info = dayInfo[selectedDate];
    const isToday = shopKnowsItsDay() ? !!(info && info.running) : selectedDate === todayISO();
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

    const status = $('dayStatus');
    if (d.finished) {
      status.className = 'notice notice-success';
      status.textContent = t('day_finished_banner', { time: clockTime(d.finished.at), name: d.finished.by || '—' });
      status.hidden = false;
    } else if (d.running === true) {
      status.className = 'notice notice-info';
      status.textContent = t('day_running_banner');
      status.hidden = false;
    } else {
      status.hidden = true;
    }
    const waiting = d.shiftsSummary && d.shiftsSummary.pendingReview;
    if (waiting) status.textContent += ' ' + t('pending_banner', { n: waiting });

    $('statRevenue').innerHTML = amount(summary.revenue);
    $('statOrders').textContent = String(summary.orders || 0);
    $('statProfit').innerHTML = amount(summary.profit);
    const cashTotal = ((d.paymentBreakdown || []).find((p) => p.method === 'Cash') || {}).total || 0;
    const sum = d.shiftsSummary;
    // Counting per shift: the float is the same money all day, and the day is judged by the shifts.
    $('statCashLabel').textContent = t(sum ? 'drawer_now' : 'expected_cash');
    $('statCash').innerHTML = amount(sum ? sum.drawerNow : d.expectedCashInDrawer);
    $('statCashSub').textContent = sum
      ? ''
      : d.openingFloat !== undefined
        ? t('cash_breakdown', { float: money(d.openingFloat), cash: money(cashTotal), expenses: money(d.externalExpensesTotal || 0) })
        : '';

    const shifts = Array.isArray(d.shifts) ? d.shifts : [];
    const notes = Array.isArray(d.notes) ? d.notes : [];
    const adjustments = Array.isArray(d.shiftAdjustments) ? d.shiftAdjustments : [];
    const dash = (n) => (n === null || n === undefined ? '—' : money(n));
    const diffPill = (diff) => (diff === null || diff === undefined
      ? `<span class="pill pill-muted">${escapeHTML(t('shift_open'))}</span>`
      : diff === 0
        ? `<span class="pill pill-success">${escapeHTML(t('shift_exact'))}</span>`
        : `<span class="pill ${diff < 0 ? 'pill-danger' : 'pill-warning'}">${escapeHTML(t(diff < 0 ? 'shift_short' : 'shift_over', { amount: money(Math.abs(diff)) }))}</span>`);
    const shiftTimes = (s) => `<span class="ltr">${escapeHTML(clockTime(s.openedAt))} – ${s.closedAt ? escapeHTML(clockTime(s.closedAt)) : '…'}</span>`;

    $('shiftsCard').hidden = !(d.shiftsEnabled || shifts.length);
    $('shiftsCount').textContent = shifts.length ? String(shifts.length) : '';
    const sumRow = (label, value, cls) => `<div class="sum-row${cls ? ' ' + cls : ''}"><span>${escapeHTML(label)}</span><span class="ltr">${value}</span></div>`;
    $('shiftsSummary').innerHTML = sum ? `<div class="sum-rows">
      ${sumRow(t('sum_float_once'), money(sum.openingFloat))}
      ${sumRow(t('sum_cash_sales'), money(sum.cashSales))}
      ${sum.expenses ? sumRow(t('sum_expenses'), '-' + money(sum.expenses)) : ''}
      ${sumRow(t('sum_collected'), money(sum.collected))}
      ${sumRow(t('sum_net_difference'), diffPill(sum.netDifference), 'total')}
    </div>` : '';

    $('shiftsList').innerHTML = listOrEmpty(shifts, (s) => {
      // What it was at closing stays visible beside the reviewed figure.
      const first = adjustments.find((x) => x.shiftId === s.id);
      const pills = first && first.oldDifference !== s.difference ? `${diffPill(first.oldDifference)} ← ${diffPill(s.difference)}` : diffPill(s.difference);
      const status = !s.closedAt ? ''
        : s.reviewStatus === 'pending' ? `<span class="pill pill-warning">${escapeHTML(t('shift_pending'))}</span>`
          : s.reviewStatus === 'reviewed' ? `<span class="pill pill-success">${escapeHTML(t('shift_reviewed', { name: s.reviewedBy || '—' }))}</span>` : '';
      const shiftNotes = notes.filter((n) => n.shiftId === s.id);
      const calc = s.cashTotal === undefined
        ? escapeHTML(t('shift_line', { sales: dash(s.salesTotal), expected: dash(s.expectedCash), counted: dash(s.countedCash) }))
        : `${escapeHTML(t('shift_calc', { float: dash(s.openingFloat), auto: s.autoOpened ? t('auto_float') : '', cash: dash(s.cashTotal), expenses: dash(s.expensesTotal), expected: dash(s.expectedCash) }))}<br>${escapeHTML(t('shift_calc_counted', { counted: dash(s.countedCash), cards: dash(s.cardsTotal) }))}`;
      return `
      <li><div class="main"><div class="title">${shiftTimes(s)} · ${escapeHTML(s.closedBy || s.openedBy || '—')} ${status}</div>
      <div class="calc">${calc}</div>
      ${shiftNotes.length ? `<ul class="shift-notes">${shiftNotes.map((n) => `<li>📝 ${escapeHTML(n.text)} <span class="meta">— ${escapeHTML(n.author || '')}, <span class="ltr">${escapeHTML(clockTime(n.createdAt))}</span></span></li>`).join('')}</ul>` : ''}
      </div>
      <div class="end pills">${pills}</div></li>`;
    });

    $('reviewsCard').hidden = !adjustments.length;
    $('reviewsCount').textContent = adjustments.length ? String(adjustments.length) : '';
    $('reviewsList').innerHTML = listOrEmpty(adjustments, (x) => {
      const changes = [];
      if (x.oldFloat !== x.newFloat) changes.push(t('adj_float', { old: money(x.oldFloat), new: money(x.newFloat) }));
      if (x.oldCounted !== x.newCounted) changes.push(t('adj_counted', { old: money(x.oldCounted), new: money(x.newCounted) }));
      const shift = shifts.find((s) => s.id === x.shiftId);
      return `
      <li><div class="main"><div class="title">${escapeHTML(t(x.action === 'corrected' ? 'adj_corrected' : x.action === 'expense_rejected' ? 'adj_expense_rejected' : 'adj_confirmed'))}${shift ? ' · ' + shiftTimes(shift) : ''}${x.afterDayFinished ? ` <span class="pill pill-danger">${escapeHTML(t('adj_after_finish'))}</span>` : ''}</div>
      <div class="sub">${changes.length ? escapeHTML(changes.join(' · ')) + ' · ' : ''}${escapeHTML(t('reason', { text: x.reason }))}</div>
      <div class="sub">${escapeHTML(t('adj_by', { cashier: x.cashier || '—', by: x.reviewedBy || '—' }))} · <span class="ltr">${escapeHTML(clockTime(x.createdAt))}</span></div></div>
      <div class="end pills">${diffPill(x.oldDifference)} ← ${diffPill(x.newDifference)}</div></li>`;
    });

    // Notes not tied to a shift (a shop that doesn't count per shift).
    const dayNotes = notes.filter((n) => !n.shiftId || !shifts.some((s) => s.id === n.shiftId));
    $('notesCard').hidden = !dayNotes.length;
    $('notesCount').textContent = dayNotes.length ? String(dayNotes.length) : '';
    $('notesList').innerHTML = listOrEmpty(dayNotes, (n) => `
      <li><div class="main"><div class="title">📝 ${escapeHTML(n.text)}</div>
      <div class="sub">${escapeHTML(n.author || '—')} · <span class="ltr">${escapeHTML(clockTime(n.createdAt))}</span></div></div></li>`);

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
    const expensePill = (e) => (e.status === 'pending' ? `<span class="pill pill-warning">${escapeHTML(t('expense_pending'))}</span>`
      : e.status === 'rejected' ? `<span class="pill pill-danger">${escapeHTML(t('expense_rejected'))}</span>` : '');
    $('expensesList').innerHTML = listOrEmpty(d.externalExpenses, (e) => `
      <li><div class="main"><div class="title">${escapeHTML(e.items)} ${expensePill(e)}</div>
      <div class="sub">${escapeHTML(t('recorded_by', { name: e.recordedBy || '—' }))}${e.approvedBy ? ' · ' + escapeHTML(t('approved_by', { name: e.approvedBy })) : ''} · <span class="ltr">${escapeHTML(clockTime(e.createdAt))}</span></div>
      ${e.status === 'rejected' && e.reviewReason ? `<div class="sub">${escapeHTML(t('reason', { text: e.reviewReason }))}</div>` : ''}</div>
      <div class="end">${e.status === 'rejected' ? `<s>${money(e.amount)}</s>` : money(e.amount)}</div></li>`);

    // Payment method corrected on an invoice (Visa rung up, cash taken…) — kept, never hidden.
    const fixes = Array.isArray(d.paymentCorrections) ? d.paymentCorrections : [];
    $('correctionsCard').hidden = !fixes.length;
    $('correctionsCount').textContent = fixes.length ? String(fixes.length) : '';
    const methodName = (m) => t('method_' + String(m).toLowerCase());
    $('correctionsList').innerHTML = listOrEmpty(fixes, (c) => `
      <li><div class="main"><div class="title"><span class="ltr">${escapeHTML(c.invoice)}</span> ${escapeHTML(methodName(c.oldMethod))} → ${escapeHTML(methodName(c.newMethod))}${c.afterDayFinished ? ` <span class="pill pill-danger">${escapeHTML(t('adj_after_finish'))}</span>` : ''}</div>
      <div class="sub">${escapeHTML(t('reason', { text: c.reason || '—' }))} · ${escapeHTML(c.correctedBy || '—')} · <span class="ltr">${escapeHTML(clockTime(c.createdAt))}</span></div>
      ${c.oldDifference !== null && c.newDifference !== null ? `<div class="sub">${escapeHTML(t('pay_fix_shift', { from: money(c.oldDifference), to: money(c.newDifference) }))}</div>` : ''}</div>
      <div class="end">${money(c.amount)}</div></li>`);

    // Drawer opened without a sale — how often, who and why.
    const openings = Array.isArray(d.drawerOpenings) ? d.drawerOpenings : [];
    $('drawerCard').hidden = !openings.length;
    $('drawerCount').textContent = openings.length ? String(openings.length) : '';
    const drawerReason = (o) => (o.reason === 'other' ? (o.note || '') : t(o.reason === 'change' ? 'drawer_change' : 'drawer_exchange'));
    $('drawerList').innerHTML = listOrEmpty(openings, (o) => `
      <li><div class="main"><div class="title">${escapeHTML(drawerReason(o))}</div>
      <div class="sub">${escapeHTML(o.user || '—')} · <span class="ltr">${escapeHTML(clockTime(o.createdAt))}</span></div></div></li>`);

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

    // What arrived, what sold, what was thrown away — the paper list on the fridge, on the phone.
    const week = d.stockWeek;
    $('stockWeekCard').hidden = !(week && week.products && week.products.length);
    if (week && week.products) {
      const tot = week.totals;
      $('stockWeekTotals').innerHTML = `<div class="sum-rows">
        <div class="sum-row"><span>${escapeHTML(t('stock_received'))}</span><span class="ltr">${tot.received}</span></div>
        <div class="sum-row"><span>${escapeHTML(t('stock_sold'))}</span><span class="ltr">${tot.sold}</span></div>
        <div class="sum-row"><span>${escapeHTML(t('stock_wasted'))}</span><span class="ltr">${tot.wasted}${tot.received ? ' (' + Math.round((tot.wasted / tot.received) * 100) + '%)' : ''}</span></div>
        <div class="sum-row total"><span>${escapeHTML(t('stock_loss'))}</span><span class="ltr">${money(tot.wasteValue)} ${escapeHTML(t('currency'))}</span></div>
      </div>`;
      $('stockWeekList').innerHTML = week.products.slice(0, 12).map((p) => `
        <li><div class="main"><div class="title">${escapeHTML((p.emoji || '') + ' ' + p.name)}</div>
        <div class="sub">${escapeHTML(t('stock_line', { received: p.received, sold: p.sold, wasted: p.wasted }))}${p.wastePct ? ' · ' + p.wastePct + '%' : ''}</div></div>
        <div class="end">${p.wasteValue ? `<span class="pill pill-danger">-${money(p.wasteValue)}</span>` : `<span class="pill pill-success">✓</span>`}</div></li>`).join('');
      $('stockWeekIdle').textContent = (week.idle || []).length ? t('stock_idle', { names: week.idle.map((p) => `${p.name} (${p.stock})`).join('، ') }) : '';
    }

    const wasteList = Array.isArray(d.waste) ? d.waste : [];
    $('wasteCard').hidden = !wasteList.length;
    $('wasteCount').textContent = wasteList.length ? String(wasteList.length) : '';
    const wasteReason = (w) => (w.reason === 'other' ? (w.note || '') : t(w.reason === 'expired' ? 'waste_expired' : 'waste_damaged'));
    $('wasteList').innerHTML = listOrEmpty(wasteList, (w) => `
      <li><div class="main"><div class="title">${escapeHTML(w.product)} × ${w.qty} ${w.status === 'pending' ? `<span class="pill pill-warning">${escapeHTML(t('expense_pending'))}</span>` : w.status === 'rejected' ? `<span class="pill pill-danger">${escapeHTML(t('expense_rejected'))}</span>` : ''}</div>
      <div class="sub">${escapeHTML(wasteReason(w))} · ${escapeHTML(w.recordedBy || '—')} · <span class="ltr">${escapeHTML(clockTime(w.createdAt))}</span></div>
      ${w.status === 'rejected' && w.reviewReason ? `<div class="sub">${escapeHTML(t('reason', { text: w.reviewReason }))}</div>` : ''}</div>
      <div class="end">${w.status === 'rejected' ? `<s>${money(w.value)}</s>` : money(w.value)}</div></li>`);

    const receivedList = Array.isArray(d.received) ? d.received : [];
    $('receivedCard').hidden = !receivedList.length;
    $('receivedCount').textContent = receivedList.length ? String(receivedList.length) : '';
    $('receivedList').innerHTML = listOrEmpty(receivedList, (r) => `
      <li><div class="main"><div class="title">${escapeHTML(r.product)}</div>
      <div class="sub">${escapeHTML(r.by || '—')} · <span class="ltr">${escapeHTML(clockTime(r.createdAt))}</span></div></div>
      <div class="end">+${r.qty}</div></li>`);

    const low = d.lowStock;
    $('lowStockCard').hidden = !Array.isArray(low);
    if (Array.isArray(low)) {
      $('lowStockCount').textContent = low.length ? String(low.length) : '';
      $('lowStockList').innerHTML = listOrEmpty(low, (p) => `
        <li><div class="main"><div class="title">${escapeHTML(p.name)}</div></div>
        <div class="end"><span class="pill ${p.stock <= 0 ? 'pill-danger' : 'pill-warning'}">${escapeHTML(p.stock <= 0 ? t('out_of_stock') : t('stock_left', { n: p.stock }))}</span></div></li>`);
    }
  }

  /** The owner sets their own password here; nobody else ever sees it. */
  function openPasswordModal() {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
      <h2>${escapeHTML(t('change_password'))}</h2>
      <p class="sub">${escapeHTML(t('change_password_sub'))}</p>
      <div class="field"><label for="pwCurrent">${escapeHTML(t('current_password'))}</label><input id="pwCurrent" type="password" autocomplete="current-password" /></div>
      <div class="field"><label for="pwNew">${escapeHTML(t('new_password'))}</label><input id="pwNew" type="password" autocomplete="new-password" /></div>
      <div class="field"><label for="pwAgain">${escapeHTML(t('new_password_again'))}</label><input id="pwAgain" type="password" autocomplete="new-password" /></div>
      <p class="form-error" id="pwError" role="alert"></p>
      <div class="actions">
        <button class="btn btn-outline" type="button" data-close>${escapeHTML(t('cancel'))}</button>
        <button class="btn btn-primary" type="button" id="pwSave">${escapeHTML(t('save_password'))}</button>
      </div>
    </div>`;
    document.body.appendChild(backdrop);
    const close = () => backdrop.remove();
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop || e.target.closest('[data-close]')) close(); });
    const err = backdrop.querySelector('#pwError');
    backdrop.querySelector('#pwCurrent').focus();
    backdrop.querySelector('#pwSave').addEventListener('click', async (e) => {
      const currentPassword = backdrop.querySelector('#pwCurrent').value;
      const newPassword = backdrop.querySelector('#pwNew').value;
      const again = backdrop.querySelector('#pwAgain').value;
      err.textContent = '';
      if (!currentPassword || !newPassword) { err.textContent = t('fill_both'); return; }
      if (newPassword.length < 8) { err.textContent = t('password_too_short'); return; }
      if (newPassword !== again) { err.textContent = t('passwords_differ'); return; }
      e.target.disabled = true;
      try {
        const result = await api('POST', '/api/password', { currentPassword, newPassword }, token);
        token = result.token;
        try { localStorage.setItem(TOKEN_KEY, token); } catch (ignore) { /* this visit only */ }
        close();
        showNotice('success', t('password_changed'));
        setTimeout(() => showNotice('', ''), 6000);
      } catch (error) {
        err.textContent = error.message;
        e.target.disabled = false;
      }
    });
  }

  /* ---------- Wiring ---------- */

  document.querySelectorAll('.langBtn').forEach((btn) => btn.addEventListener('click', () => {
    window.SPC.setLang(window.SPC.lang() === 'ar' ? 'en' : 'ar');
    if (shop) { renderDayOptions(); render(); }
  }));
  $('passwordBtn').addEventListener('click', openPasswordModal);
  $('logoutBtn').addEventListener('click', signOut);
  $('refreshBtn').addEventListener('click', refreshAll);
  $('daySelect').addEventListener('change', (e) => { selectedDate = e.target.value; userPicked = true; loadDay(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && token && shop) refreshAll(); });

  $('loginLogo').innerHTML = window.SPC.logoHTML();
  $('topLogo').innerHTML = window.SPC.logoHTML();
  window.SPC.applyLang();

  if (token) openApp(); else showLogin();
})();
