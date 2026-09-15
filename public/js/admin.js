/* Smart POS Cloud — owner page: add shops, hand out codes, manage access. */
(function () {
  'use strict';

  const { t, api, escapeHTML, relativeTime, copyText } = window.SPC;
  const TOKEN_KEY = 'spc_admin_token';
  const OFFLINE_AFTER_MS = 25 * 60 * 1000;
  const $ = (id) => document.getElementById(id);

  // Owner sessions last only for this browser tab.
  let token = null;
  try { token = sessionStorage.getItem(TOKEN_KEY); } catch (e) { token = null; }
  let shops = [];

  function showLogin() {
    $('app').hidden = true;
    $('loginScreen').hidden = false;
    $('password').focus();
  }

  function signOut() {
    token = null;
    try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
    showLogin();
  }

  function handleAuthError(err) {
    if (err.status === 401) {
      signOut();
      $('loginError').textContent = t('session_ended');
      return true;
    }
    return false;
  }

  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('loginBtn');
    btn.disabled = true;
    btn.textContent = t('signing_in');
    const slowTimer = setTimeout(() => { $('loginError').textContent = t('waking_up'); }, 4000);
    try {
      const result = await api('POST', '/api/admin/login', { password: $('password').value });
      token = result.token;
      try { sessionStorage.setItem(TOKEN_KEY, token); } catch (err) { /* this page only */ }
      $('password').value = '';
      $('loginError').textContent = '';
      openApp();
    } catch (err) {
      $('loginError').textContent = err.message;
    } finally {
      clearTimeout(slowTimer);
      btn.disabled = false;
      btn.textContent = t('sign_in');
    }
  });

  async function loadShops() {
    try {
      shops = await api('GET', '/api/admin/shops', null, token);
      renderShops();
    } catch (err) {
      if (!handleAuthError(err)) window.SPC.toast(err.message);
    }
  }

  function openApp() {
    $('loginScreen').hidden = true;
    $('app').hidden = false;
    loadShops();
  }

  function statusPill(shop) {
    if (shop.disabled) return `<span class="pill pill-muted">${escapeHTML(t('disabled'))}</span>`;
    if (!shop.lastPushAt) return `<span class="pill pill-muted">${escapeHTML(t('never'))}</span>`;
    const offline = Date.now() - new Date(shop.lastPushAt).getTime() > OFFLINE_AFTER_MS;
    return `<span class="pill ${offline ? 'pill-warning' : 'pill-success'}">${escapeHTML(offline ? t('offline') : t('active'))}</span>`;
  }

  function renderShops() {
    $('shopCount').textContent = shops.length ? String(shops.length) : '';
    if (!shops.length) {
      $('shopList').innerHTML = `<li class="empty-line">${escapeHTML(t('no_shops'))}</li>`;
      return;
    }
    $('shopList').innerHTML = shops.map((s) => `
      <li>
        <div class="main">
          <div class="title">${escapeHTML(s.name)} ${statusPill(s)}</div>
          <div class="sub"><span class="ltr">${escapeHTML(s.code)}</span> · ${escapeHTML(s.lastPushAt ? t('last_update', { time: relativeTime(s.lastPushAt) }) : t('never'))}</div>
          <div class="shop-actions">
            <button class="btn btn-outline btn-sm" data-act="reset" data-id="${s.id}">${escapeHTML(t('reset_password'))}</button>
            <button class="btn btn-outline btn-sm" data-act="code" data-id="${s.id}">${escapeHTML(t('new_connection_code'))}</button>
            <button class="btn btn-outline btn-sm" data-act="rename" data-id="${s.id}">${escapeHTML(t('rename'))}</button>
            <button class="btn btn-outline btn-sm ${s.disabled ? '' : 'btn-danger-text'}" data-act="toggle" data-id="${s.id}">${escapeHTML(s.disabled ? t('enable') : t('disable'))}</button>
          </div>
        </div>
      </li>`).join('');
  }

  /* ---------- Showing codes once ---------- */

  function secretBox(label, value) {
    return `<div class="secret-box"><div class="k">${escapeHTML(label)}</div>
      <div class="secret-row"><code>${escapeHTML(value)}</code><button class="btn btn-outline btn-sm" type="button" data-copy="${escapeHTML(value)}">${escapeHTML(t('copy'))}</button></div></div>`;
  }

  function showModal(html) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}<div class="actions"><button class="btn btn-primary" type="button" data-close>${escapeHTML(t('done'))}</button></div></div>`;
    backdrop.addEventListener('click', (e) => {
      const copyBtn = e.target.closest('[data-copy]');
      if (copyBtn) copyText(copyBtn.getAttribute('data-copy'));
      if (e.target.closest('[data-close]')) backdrop.remove();
    });
    document.body.appendChild(backdrop);
    backdrop.querySelector('[data-close]').focus();
  }

  const siteUrl = () => window.location.origin;

  function showCreated(result) {
    const message = t('manager_message', { url: siteUrl(), code: result.shop.code, password: result.managerPassword });
    showModal(`
      <h2>${escapeHTML(t('created_title', { name: result.shop.name }))}</h2>
      <p class="notice notice-warning">${escapeHTML(t('secrets_once'))}</p>
      <h3 class="muted">${escapeHTML(t('for_manager'))}</h3>
      ${secretBox(t('website'), siteUrl())}
      ${secretBox(t('shop_code'), result.shop.code)}
      ${secretBox(t('password'), result.managerPassword)}
      <button class="btn btn-outline btn-block" type="button" data-copy="${escapeHTML(message)}">${escapeHTML(t('copy_message'))}</button>
      <h3 class="muted">${escapeHTML(t('for_pos'))}</h3>
      ${secretBox(t('connection_code'), result.connectionCode)}
    `);
  }

  /* ---------- Actions ---------- */

  $('addShopForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('shopNameInput').value.trim();
    if (!name) { $('addShopError').textContent = t('shop_name_ph'); return; }
    const btn = $('addShopBtn');
    btn.disabled = true;
    btn.textContent = t('adding');
    $('addShopError').textContent = '';
    try {
      const result = await api('POST', '/api/admin/shops', { name }, token);
      $('shopNameInput').value = '';
      showCreated(result);
      loadShops();
    } catch (err) {
      if (!handleAuthError(err)) $('addShopError').textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = t('add_shop');
    }
  });

  $('shopList').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const shop = shops.find((s) => s.id === Number(btn.getAttribute('data-id')));
    if (!shop) return;
    const act = btn.getAttribute('data-act');

    try {
      if (act === 'reset') {
        if (!window.confirm(t('confirm_reset', { name: shop.name }))) return;
        const result = await api('POST', `/api/admin/shops/${shop.id}/reset-password`, {}, token);
        const message = t('manager_message', { url: siteUrl(), code: shop.code, password: result.managerPassword });
        showModal(`<h2>${escapeHTML(t('new_password_title', { name: shop.name }))}</h2>
          <p class="notice notice-warning">${escapeHTML(t('secrets_once'))}</p>
          ${secretBox(t('password'), result.managerPassword)}
          <button class="btn btn-outline btn-block" type="button" data-copy="${escapeHTML(message)}">${escapeHTML(t('copy_message'))}</button>`);
      } else if (act === 'code') {
        if (!window.confirm(t('confirm_new_code', { name: shop.name }))) return;
        const result = await api('POST', `/api/admin/shops/${shop.id}/new-connection-code`, {}, token);
        showModal(`<h2>${escapeHTML(t('new_code_title', { name: shop.name }))}</h2>
          <p class="notice notice-warning">${escapeHTML(t('secrets_once'))}</p>
          <h3 class="muted">${escapeHTML(t('for_pos'))}</h3>
          ${secretBox(t('connection_code'), result.connectionCode)}`);
      } else if (act === 'rename') {
        const name = window.prompt(t('rename_prompt'), shop.name);
        if (!name || !name.trim() || name.trim() === shop.name) return;
        await api('POST', `/api/admin/shops/${shop.id}/rename`, { name: name.trim() }, token);
      } else if (act === 'toggle') {
        if (!shop.disabled && !window.confirm(t('confirm_disable', { name: shop.name }))) return;
        await api('POST', `/api/admin/shops/${shop.id}/disabled`, { disabled: !shop.disabled }, token);
      }
      loadShops();
    } catch (err) {
      if (!handleAuthError(err)) window.SPC.toast(err.message);
    }
  });

  document.querySelectorAll('.langBtn').forEach((btn) => btn.addEventListener('click', () => {
    window.SPC.setLang(window.SPC.lang() === 'ar' ? 'en' : 'ar');
    renderShops();
  }));
  $('logoutBtn').addEventListener('click', signOut);

  $('loginLogo').innerHTML = window.SPC.logoHTML();
  $('topLogo').innerHTML = window.SPC.logoHTML();
  window.SPC.applyLang();

  if (token) openApp(); else showLogin();
})();
