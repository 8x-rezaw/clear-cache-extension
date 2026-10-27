(() => {
  if (window.__ccxBridge) return;
  window.__ccxBridge = true;

  document.addEventListener('__ccx_blocked', (e) => {
    const url = typeof e.detail === 'string' ? e.detail : '';
    chrome.runtime.sendMessage({ type: 'blocked', url }).catch(() => {});
  });

  if (window !== top) return;

  const fa = (n) => n.toLocaleString('fa-IR');
  let ui = null;
  let hideTimer = 0;

  const font = new FontFace('ccx-vazirmatn', `url("${chrome.runtime.getURL('fonts/vazirmatn.woff2')}")`, { weight: '100 900' });

  function build() {
    document.fonts.add(font);
    font.load().catch(() => {});

    const host = document.createElement('div');
    host.style.cssText = 'all:initial;position:fixed;inset:auto auto 16px 16px;z-index:2147483647';
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `
      <style>
        :host { --bg:#fff; --text:#1f2937; --muted:#6b7280; --soft:#f3f4f6; --accent:#1a73e8; }
        @media (prefers-color-scheme: dark) { :host { --bg:#2b2d31; --text:#e8eaed; --muted:#9aa0a6; --soft:#3c4043; --accent:#8ab4f8; } }
        * { box-sizing: border-box; font-family: "ccx-vazirmatn"; margin: 0; }
        .box {
          direction: rtl; width: 300px; padding: 12px 14px; border-radius: 12px;
          background: var(--bg); color: var(--text); font-size: 13px; line-height: 1.6;
          box-shadow: 0 8px 28px rgba(0,0,0,.22), 0 0 0 1px rgba(0,0,0,.06);
          opacity: 0; transform: translateY(8px); transition: opacity .18s, transform .18s;
        }
        .box.show { opacity: 1; transform: none; }
        .head { display: flex; align-items: center; gap: 8px; }
        b { flex: 1; font-weight: 700; }
        .url { direction: ltr; text-align: right; color: var(--muted); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .row { display: flex; gap: 6px; margin-top: 10px; }
        button { border: 0; border-radius: 7px; padding: 5px 10px; font-size: 12px; font-weight: 600; cursor: pointer; background: var(--soft); color: var(--text); }
        button.primary { color: var(--accent); }
        .x { padding: 0 6px; background: none; color: var(--muted); font-size: 16px; line-height: 1; }
      </style>
      <div class="box" role="status">
        <div class="head"><b></b><button class="x" aria-label="بستن">×</button></div>
        <div class="url"></div>
        <div class="row">
          <button class="primary open">باز کن</button>
          <button class="allow">همیشه برای این سایت مجاز باشد</button>
        </div>
      </div>`;

    const box = root.querySelector('.box');
    ui = {
      host, box,
      title: root.querySelector('b'),
      url: root.querySelector('.url'),
      open: root.querySelector('.open'),
      target: '',
    };

    const hide = () => {
      box.classList.remove('show');
      setTimeout(() => { if (!box.classList.contains('show')) host.remove(); }, 200);
    };
    ui.hide = hide;

    root.querySelector('.x').addEventListener('click', (e) => e.isTrusted && hide());
    ui.open.addEventListener('click', (e) => {
      if (!e.isTrusted) return;
      chrome.runtime.sendMessage({ type: 'open', url: ui.target }).catch(() => {});
      hide();
    });
    root.querySelector('.allow').addEventListener('click', (e) => {
      if (!e.isTrusted) return;
      chrome.runtime.sendMessage({ type: 'allowSite' }).catch(() => {});
      hide();
    });
    box.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    box.addEventListener('mouseleave', () => { hideTimer = setTimeout(hide, 3000); });
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type !== 'toast') return;
    if (!ui) build();

    ui.target = msg.url;
    ui.title.textContent = msg.count > 1 ? `${fa(msg.count)} پنجره‌ی تبلیغاتی مسدود شد` : 'یک پنجره‌ی تبلیغاتی مسدود شد';
    ui.url.textContent = msg.url || 'صفحه‌ی خالی';
    ui.open.hidden = !/^https?:/.test(msg.url);

    if (!ui.host.isConnected) document.documentElement.append(ui.host);
    requestAnimationFrame(() => ui.box.classList.add('show'));
    clearTimeout(hideTimer);
    hideTimer = setTimeout(ui.hide, 6000);
  });
})();
