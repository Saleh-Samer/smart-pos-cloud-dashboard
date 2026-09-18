/* Smart POS Cloud — translations and helpers shared by the manager page and the owner page. */
(function (global) {
  'use strict';

  const DICT = {
    ar: {
      app_title: 'متابعة المبيعات',
      lang_toggle: 'English',
      sign_in: 'تسجيل الدخول',
      signing_in: 'جاري الدخول...',
      sign_out: 'خروج',
      shop_code: 'رمز المحل',
      shop_code_ph: 'مثال: SP-AB12CD',
      password: 'كلمة السر',
      manager_sub: 'ادخل برمز محلك وكلمة السر لتشاهد مبيعاتك.',
      fill_both: 'أدخل رمز المحل وكلمة السر.',
      network_error: 'تعذّر الاتصال. تأكد من الإنترنت وحاول مرة أخرى.',
      waking_up: 'جاري تشغيل الموقع... قد يستغرق هذا دقيقة في أول مرة.',

      today: 'اليوم',
      yesterday: 'أمس',
      refresh: 'تحديث',
      adj_expense_rejected: 'رفض مصروف',
      expense_pending: 'بانتظار الموافقة',
      expense_rejected: 'مرفوض',
      drawer_openings: 'فتح الدرج بدون بيع',
      drawer_change: 'صرافة لزبون',
      drawer_exchange: 'تبديل فكّة',
      change_password: 'كلمة السر',
      change_password_sub: 'كلمة السر تبعك إنت وحدك. لا نحن ولا حدا ثاني بيقدر يشوفها بعد ما تحفظها.',
      current_password: 'كلمة السر الحالية',
      new_password: 'كلمة السر الجديدة (8 أحرف أو أكثر)',
      new_password_again: 'أعد كتابة الجديدة',
      save_password: 'حفظ كلمة السر',
      password_too_short: 'كلمة السر الجديدة لازم 8 أحرف أو أكثر.',
      passwords_differ: 'الكلمتان غير متطابقتين.',
      password_changed: 'تم تغيير كلمة السر. باقي الأجهزة انقطعت جلساتها.',
      cancel: 'إلغاء',
      updated_from_shop: 'آخر تحديث من المحل: {time}',
      just_now: 'الآن',
      shop_offline: 'المحل غير متصل حالياً — الأرقام هي آخر ما وصل {time}.',
      no_data_title: 'لا توجد بيانات لهذا اليوم بعد',
      no_data_sub: 'تظهر الأرقام هنا تلقائياً بعد أن يرسلها برنامج المحل (خلال دقائق من أول عملية بيع).',
      never_connected_title: 'المحل لم يُرسل أي بيانات بعد',
      never_connected_sub: 'تأكد من إدخال رمز الربط في برنامج المحل: الإعدادات ← المتابعة عن بعد.',

      revenue: 'المبيعات',
      orders: 'عدد الفواتير',
      profit: 'الربح',
      expected_cash: 'الكاش المتوقع بالدرج',
      currency: 'د.أ',
      by_payment: 'المبيعات حسب طريقة الدفع',
      transactions: '{n} عملية',
      top_products: 'الأكثر مبيعاً',
      qty: 'الكمية: {n}',
      expenses: 'المصاريف الخارجية',
      expenses_total: 'المجموع',
      recorded_by: 'سجّلها {name}',
      approved_by: 'وافق {name}',
      deleted_invoices: 'الفواتير المحذوفة',
      deleted_by: 'حذفها {name}',
      discounts: 'الخصومات',
      discount_of: 'خصم {amount}',
      cashier: 'الكاشير {name}',
      table: 'طاولة {name}',
      table_changes: 'تعديلات الطاولات',
      table_renamed: 'تغيير اسم: {old} ← {new}',
      table_deleted: 'حذف طاولة: {old}',
      requested_by: 'طلبها {name}',
      low_stock: 'منتجات قاربت على النفاد',
      stock_left: 'متبقي {n}',
      out_of_stock: 'نفد',
      nothing_today: 'لا يوجد.',
      day_running: 'الدوام الحالي',
      day_finished_mark: 'منتهي ✅',
      day_finished_banner: '✅ تم إنهاء الدوام الساعة {time} — بواسطة {name}. هذه الأرقام النهائية لليوم.',
      day_running_banner: '⏳ الدوام ما زال شغّالاً — الأرقام تتحدث تلقائياً من المحل.',
      cash_breakdown: 'بداية الدرج {float} + نقدي {cash} − مصاريف {expenses}',
      shifts: 'الورديات',
      shift_line: 'المبيعات {sales} · المتوقع {expected} · المعدود {counted}',
      shift_open: 'مفتوحة',
      shift_exact: 'مطابق',
      shift_short: 'نقص {amount}',
      shift_over: 'زيادة {amount}',
      drawer_now: 'المفروض بالدرج الآن',
      count_reviews: 'تعديلات الجرد',
      cashier_notes: 'ملاحظات الكاشير',
      shift_calc: 'فكّة {float}{auto} + نقدي {cash} − مصاريف {expenses} = متوقع {expected}',
      shift_calc_counted: 'المعدود {counted} · بطاقات {cards}',
      auto_float: ' 🤖',
      shift_pending: '⏳ بانتظار المراجعة',
      shift_reviewed: '✅ راجعها {name}',
      pending_banner: '⚠️ {n} وردية بانتظار مراجعة المحاسب.',
      sum_float_once: 'الفكّة (مرة واحدة)',
      sum_cash_sales: 'مبيعات الكاش',
      sum_expenses: 'مصاريف',
      sum_collected: 'الكاش المستلم من الورديات',
      sum_net_difference: 'صافي فرق اليوم',
      adj_corrected: 'تعديل',
      adj_confirmed: 'تثبيت الفرق',
      adj_after_finish: 'بعد إنهاء الدوام',
      adj_float: 'الفكّة {old} ← {new}',
      adj_counted: 'المعدود {old} ← {new}',
      adj_by: 'الكاشير {cashier} · راجعها {by}',
      note_by: '{name}',
      reason: 'السبب: {text}',

      pay_cash: 'نقدي',
      pay_visa: 'فيزا',
      pay_cliq: 'كليك',
      pay_wallet: 'محفظة',
      pay_card: 'بطاقة',

      // Owner page
      admin_title: 'إدارة المحلات',
      admin_sub: 'صفحة خاصة بصاحب البرنامج.',
      owner_password: 'كلمة سر المالك',
      add_shop: 'إضافة محل',
      shop_name_ph: 'اسم المحل الجديد',
      adding: 'جاري الإضافة...',
      shops: 'المحلات',
      no_shops: 'لا توجد محلات بعد. أضف أول محل من الأعلى.',
      last_update: 'آخر تحديث: {time}',
      never: 'لم يُرسل بيانات بعد',
      disabled: 'موقوف',
      active: 'يعمل',
      offline: 'غير متصل',
      reset_password: 'كلمة سر جديدة',
      new_connection_code: 'رمز ربط جديد',
      rename: 'تغيير الاسم',
      disable: 'إيقاف',
      enable: 'تشغيل',
      rename_prompt: 'الاسم الجديد للمحل:',
      confirm_reset: 'إنشاء كلمة سر جديدة لمدير "{name}"؟ ستتوقف كلمة السر القديمة ويخرج من كل الأجهزة.',
      confirm_new_code: 'إنشاء رمز ربط جديد لـ "{name}"؟ سيتوقف الرمز القديم فوراً، ويجب إدخال الجديد في برنامج المحل.',
      confirm_disable: 'إيقاف "{name}"؟ لن يستطيع المدير الدخول ولن تُستقبل مبيعات المحل.',
      created_title: 'تمت إضافة "{name}"',
      secrets_once: 'انسخ هذه البيانات الآن — كلمة السر ورمز الربط لا يظهران مرة ثانية.',
      for_manager: 'للمدير (أرسلها له)',
      for_pos: 'لبرنامج المحل (الإعدادات ← المتابعة عن بعد)',
      website: 'الموقع',
      connection_code: 'رمز الربط',
      copy: 'نسخ',
      copied: 'تم النسخ',
      copy_message: 'نسخ رسالة جاهزة للمدير',
      manager_message: 'أهلاً، هذه بيانات متابعة مبيعات محلك من أي مكان:\nالموقع: {url}\nرمز المحل: {code}\nكلمة السر: {password}\n\nنصيحة: افتح الموقع من موبايلك واختر "إضافة إلى الشاشة الرئيسية".',
      new_password_title: 'كلمة سر جديدة لـ "{name}"',
      new_code_title: 'رمز ربط جديد لـ "{name}"',
      done: 'تم',
      last_backup: 'آخر نسخة احتياطية: {time} ({size} ميغابايت)',
      no_backup: 'لا توجد نسخة احتياطية على السحابة بعد',
      download_backup: 'تنزيل آخر نسخة',
      restore_title: 'تم تنزيل النسخة',
      restore_steps: 'لاسترجاعها على جهاز جديد:\n1. ركّب Smart POS على الجهاز الجديد وافتحه مرة ثم أغلقه.\n2. افتح المجلد %APPDATA%\\smart-pos-desktop\\data\n3. احذف data.sqlite و data.sqlite-wal و data.sqlite-shm\n4. انسخ الملف الذي نزل وسمّه data.sqlite\n5. افتح Smart POS — ستحتاج رمز تفعيل جديد لأن الجهاز تغيّر.',
      session_ended: 'انتهت الجلسة. سجّل الدخول مرة أخرى.'
    },
    en: {
      app_title: 'Sales Monitor',
      lang_toggle: 'العربية',
      sign_in: 'Sign In',
      signing_in: 'Signing in...',
      sign_out: 'Sign out',
      shop_code: 'Shop code',
      shop_code_ph: 'e.g. SP-AB12CD',
      password: 'Password',
      manager_sub: 'Sign in with your shop code and password to see your sales.',
      fill_both: 'Enter the shop code and password.',
      network_error: "Couldn't connect. Check the internet and try again.",
      waking_up: 'Starting the website... this can take a minute the first time.',

      today: 'Today',
      yesterday: 'Yesterday',
      refresh: 'Refresh',
      adj_expense_rejected: 'Expense rejected',
      expense_pending: 'Waiting',
      expense_rejected: 'Rejected',
      drawer_openings: 'Drawer opened without a sale',
      drawer_change: 'Giving change',
      drawer_exchange: 'Swapping notes for coins',
      change_password: 'Password',
      change_password_sub: 'This password is yours alone — once you save it, nobody else can see it, not even us.',
      current_password: 'Current password',
      new_password: 'New password (8 characters or more)',
      new_password_again: 'Repeat the new password',
      save_password: 'Save password',
      password_too_short: 'The new password must be at least 8 characters.',
      passwords_differ: 'The two passwords do not match.',
      password_changed: 'Password changed. Other devices have been signed out.',
      cancel: 'Cancel',
      updated_from_shop: 'Last update from the shop: {time}',
      just_now: 'just now',
      shop_offline: 'The shop is offline right now — these are the last numbers received {time}.',
      no_data_title: 'No data for this day yet',
      no_data_sub: "Numbers appear here automatically once the shop's program sends them (within minutes of the first sale).",
      never_connected_title: "The shop hasn't sent any data yet",
      never_connected_sub: "Make sure the connection code was entered in the shop's program: Settings → Remote Monitoring.",

      revenue: 'Sales',
      orders: 'Invoices',
      profit: 'Profit',
      expected_cash: 'Expected cash in drawer',
      currency: 'JD',
      by_payment: 'Sales by payment method',
      transactions: '{n} transaction(s)',
      top_products: 'Best sellers',
      qty: 'Qty: {n}',
      expenses: 'External expenses',
      expenses_total: 'Total',
      recorded_by: 'Recorded by {name}',
      approved_by: 'approved by {name}',
      deleted_invoices: 'Deleted invoices',
      deleted_by: 'Deleted by {name}',
      discounts: 'Discounts',
      discount_of: '{amount} off',
      cashier: 'Cashier {name}',
      table: 'Table {name}',
      table_changes: 'Table changes',
      table_renamed: 'Renamed: {old} → {new}',
      table_deleted: 'Deleted table: {old}',
      requested_by: 'Requested by {name}',
      low_stock: 'Running low',
      stock_left: '{n} left',
      out_of_stock: 'Out',
      nothing_today: 'None.',
      day_running: 'current day',
      day_finished_mark: 'finished ✅',
      day_finished_banner: '✅ The day was finished at {time} by {name}. These are the final numbers.',
      day_running_banner: '⏳ The day is still running — numbers update from the shop automatically.',
      cash_breakdown: 'Float {float} + cash {cash} − expenses {expenses}',
      shifts: 'Shifts',
      shift_line: 'Sales {sales} · expected {expected} · counted {counted}',
      shift_open: 'Open',
      shift_exact: 'Exact',
      shift_short: '{amount} short',
      shift_over: '{amount} over',
      drawer_now: 'Should be in the drawer now',
      count_reviews: 'Count reviews',
      cashier_notes: 'Cashier notes',
      shift_calc: 'Float {float}{auto} + cash {cash} − expenses {expenses} = expected {expected}',
      shift_calc_counted: 'Counted {counted} · cards {cards}',
      auto_float: ' 🤖',
      shift_pending: '⏳ Waiting for review',
      shift_reviewed: '✅ Reviewed by {name}',
      pending_banner: '⚠️ {n} shift(s) waiting for the accountant to review.',
      sum_float_once: 'Float (counted once)',
      sum_cash_sales: 'Cash sales',
      sum_expenses: 'Expenses',
      sum_collected: 'Cash handed in by the shifts',
      sum_net_difference: 'Net difference today',
      adj_corrected: 'Corrected',
      adj_confirmed: 'Difference confirmed',
      adj_after_finish: 'after the day was finished',
      adj_float: 'Float {old} → {new}',
      adj_counted: 'Counted {old} → {new}',
      adj_by: 'Cashier {cashier} · reviewed by {by}',
      note_by: '{name}',
      reason: 'Reason: {text}',

      pay_cash: 'Cash',
      pay_visa: 'Visa',
      pay_cliq: 'CliQ',
      pay_wallet: 'Wallet',
      pay_card: 'Card',

      admin_title: 'Shops',
      admin_sub: "Owner's page.",
      owner_password: 'Owner password',
      add_shop: 'Add shop',
      shop_name_ph: 'New shop name',
      adding: 'Adding...',
      shops: 'Shops',
      no_shops: 'No shops yet. Add the first one above.',
      last_update: 'Last update: {time}',
      never: 'No data sent yet',
      disabled: 'Disabled',
      active: 'Active',
      offline: 'Offline',
      reset_password: 'New password',
      new_connection_code: 'New connection code',
      rename: 'Rename',
      disable: 'Disable',
      enable: 'Enable',
      rename_prompt: 'New shop name:',
      confirm_reset: 'Create a new password for the manager of "{name}"? The old password stops working and they are signed out everywhere.',
      confirm_new_code: 'Create a new connection code for "{name}"? The old code stops working at once — the new one must be entered in the shop\'s program.',
      confirm_disable: 'Disable "{name}"? The manager can\'t sign in and the shop\'s sales won\'t be received.',
      created_title: '"{name}" added',
      secrets_once: 'Copy these now — the password and connection code are not shown again.',
      for_manager: 'For the manager (send to them)',
      for_pos: "For the shop's program (Settings → Remote Monitoring)",
      website: 'Website',
      connection_code: 'Connection code',
      copy: 'Copy',
      copied: 'Copied',
      copy_message: 'Copy a ready message for the manager',
      manager_message: 'Hi, here are the details to follow your shop\'s sales from anywhere:\nWebsite: {url}\nShop code: {code}\nPassword: {password}\n\nTip: open the website on your phone and choose "Add to Home Screen".',
      new_password_title: 'New password for "{name}"',
      new_code_title: 'New connection code for "{name}"',
      done: 'Done',
      last_backup: 'Last backup: {time} ({size} MB)',
      no_backup: 'No cloud backup yet',
      download_backup: 'Download latest backup',
      restore_title: 'Backup downloaded',
      restore_steps: 'To restore it on a new computer:\n1. Install Smart POS on the new computer, open it once, then close it.\n2. Open the folder %APPDATA%\\smart-pos-desktop\\data\n3. Delete data.sqlite, data.sqlite-wal and data.sqlite-shm\n4. Copy the downloaded file there and name it data.sqlite\n5. Open Smart POS — it will need a new activation code because the computer changed.',
      session_ended: 'Your session ended. Please sign in again.'
    }
  };

  // Server error messages are English; show them in Arabic where known.
  const ERRORS_AR = {
    'Incorrect shop code or password.': 'رمز المحل أو كلمة السر غير صحيحة.',
    'Incorrect password.': 'كلمة السر غير صحيحة.',
    'Too many attempts. Try again in 15 minutes.': 'محاولات كثيرة. حاول مرة أخرى بعد 15 دقيقة.',
    'This shop has been disabled.': 'هذا المحل موقوف. تواصل مع مزوّد البرنامج.',
    'Your session has ended. Please sign in again.': 'انتهت الجلسة. سجّل الدخول مرة أخرى.',
    'Could not reach the database. Try again shortly.': 'تعذّر الوصول لقاعدة البيانات. حاول بعد قليل.',
    'Enter a shop name (up to 80 characters).': 'أدخل اسم المحل (حتى 80 حرفاً).',
    'Shop not found.': 'المحل غير موجود.',
    'This shop has not uploaded a backup yet.': 'هذا المحل لم يرفع نسخة احتياطية بعد.'
  };

  const LANG_KEY = 'spc_lang';
  function lang() {
    try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'ar'; } catch (e) { return 'ar'; }
  }
  function setLang(value) {
    try { localStorage.setItem(LANG_KEY, value); } catch (e) { /* private mode: current page only */ }
    applyLang();
  }
  function applyLang() {
    document.documentElement.lang = lang();
    document.documentElement.dir = lang() === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.getAttribute('data-t')); });
    document.querySelectorAll('[data-t-ph]').forEach((el) => { el.setAttribute('placeholder', t(el.getAttribute('data-t-ph'))); });
    document.title = t(document.body.getAttribute('data-title') || 'app_title') + ' · Smart POS';
  }

  function t(key, params) {
    let text = (DICT[lang()] && DICT[lang()][key]) || DICT.en[key] || key;
    if (params) Object.keys(params).forEach((p) => { text = text.split(`{${p}}`).join(params[p]); });
    return text;
  }
  function tError(message) {
    return lang() === 'ar' && ERRORS_AR[message] ? ERRORS_AR[message] : message;
  }

  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function money(n) {
    const value = Number(n) || 0;
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function relativeTime(iso) {
    if (!iso) return '';
    const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
    if (Math.abs(seconds) < 60) return t('just_now');
    const rtf = new Intl.RelativeTimeFormat(lang() === 'ar' ? 'ar' : 'en', { numeric: 'auto' });
    const units = [['day', 86400], ['hour', 3600], ['minute', 60]];
    for (const [unit, size] of units) {
      if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
    }
    return t('just_now');
  }

  function clockTime(iso) {
    if (!iso) return '';
    // Shop records are stored as UTC "YYYY-MM-DD HH:MM:SS" (SQLite datetime('now')).
    const normalized = /T|Z$/.test(iso) ? iso : iso.replace(' ', 'T') + 'Z';
    return new Date(normalized).toLocaleTimeString(lang() === 'ar' ? 'ar-JO' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  async function api(method, path, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    let res;
    try {
      res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    } catch (err) {
      const e = new Error(t('network_error'));
      e.network = true;
      throw e;
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const e = new Error(tError((data && data.error) || t('network_error')));
      e.status = res.status;
      throw e;
    }
    return data;
  }

  function logoHTML() {
    return '<span class="logo" aria-label="Smart POS"><span class="logo-shapes" aria-hidden="true"><span class="s d"></span><span class="s c"></span><span class="s t"></span></span><span class="logo-name">SMART POS</span></span>';
  }

  let toastTimer;
  function toast(text) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast(t('copied'));
    } catch (err) {
      window.prompt(t('copy'), text);
    }
  }

  global.SPC = { t, tError, lang, setLang, applyLang, escapeHTML, money, relativeTime, clockTime, api, logoHTML, toast, copyText };
})(window);
