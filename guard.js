(() => {
  const EVENT = '__ccx_blocked';
  const SECOND_LEVEL = /^(?:co|com|net|org|ac|gov|edu|gen|id|sch|ltd|plc|or|ne|go)\.[a-z]{2}$/;

  const siteOf = (hostname) => {
    const host = hostname.replace(/\.$/, '').toLowerCase();
    if (!host.includes('.') || host.includes(':') || /^[\d.]+$/.test(host)) return host;
    const parts = host.split('.');
    return parts.slice(SECOND_LEVEL.test(parts.slice(-2).join('.')) ? -3 : -2).join('.');
  };

  const topSite = (() => {
    try { if (top.location.hostname) return siteOf(top.location.hostname); } catch {}
    const ancestors = location.ancestorOrigins;
    if (ancestors && ancestors.length) {
      try { return siteOf(new URL(ancestors[ancestors.length - 1]).hostname); } catch {}
    }
    return siteOf(location.hostname);
  })();

  const resolve = (url) => {
    const raw = url === undefined || url === null ? '' : String(url).trim();
    if (!raw) return null;
    try { return new URL(raw, location.href); } catch { return null; }
  };

  const allowed = (url) => {
    const u = resolve(url);
    if (!u) return false;
    if (u.protocol === 'http:' || u.protocol === 'https:') return siteOf(u.hostname) === topSite;
    if (u.protocol === 'blob:') return u.origin === location.origin;
    return false;
  };

  let lastReport = 0;
  const report = (url) => {
    const now = Date.now();
    if (now - lastReport < 300) return;
    lastReport = now;
    const u = resolve(url);
    document.dispatchEvent(new CustomEvent(EVENT, { detail: u ? u.href : '' }));
  };

  const approve = (url, long = false) => {
    const u = resolve(url);
    if (u) document.dispatchEvent(new CustomEvent('__ccx_allow', { detail: JSON.stringify({ url: u.href, long }) }));
  };

  let lastNewWindow = 0;

  const DIALOG_TEXT = /^(?:ok|okay|cancel|allow|block|close|yes|no|accept|deny|later|not now|skip|[×✕✖✗x]|تایید|تأیید|لغو|بستن|ببند|بله|خیر|باشه|اجازه|اجازه بده|بعدا|بعداً|رد|انصراف)$/i;
  const CLOSE_ATTR = /(?<!dis)close(?!t)|dismiss|بستن/i;

  const overlayOf = (el) => {
    let found = null;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const p = getComputedStyle(n).position;
      if (p === 'fixed' || p === 'sticky') found = n;
    }
    return found;
  };

  const suspicious = (el) => {
    for (let n = el, i = 0; n instanceof Element && i < 4 && n !== document.body; n = n.parentElement, i++) {
      const attrs = `${n.id} ${n.getAttribute('class') || ''} ${n.getAttribute('aria-label') || ''} ${n.getAttribute('title') || ''}`;
      const text = (n.textContent || '').trim();
      const closeLike = CLOSE_ATTR.test(attrs) || (text.length <= 12 && /^(?:[×✕✖✗x]|close|بستن|ببند|skip)$/i.test(text));
      const dialogLike = text.length <= 12 && DIALOG_TEXT.test(text);
      if (!closeLike && !dialogLike) continue;
      const overlay = overlayOf(n);
      if (closeLike || overlay) return { overlay };
    }
    return null;
  };

  const TRUSTED = new Set([
    'shaparak.ir', 'zarinpal.com', 'idpay.ir', 'payping.ir', 'nextpay.org', 'zibal.ir', 'vandar.io', 'sep.ir',
    'pec.ir', 'bankmellat.ir', 'sadadpsp.ir', 'asanpardakht.ir', 'bitpay.ir', 'irankish.com', 'paypal.com',
    'stripe.com', 'google.com', 'apple.com', 'microsoft.com', 'live.com', 'github.com',
  ]);
  const trusted = (url) => {
    const u = resolve(url);
    return Boolean(u && /^https?:$/.test(u.protocol) && TRUSTED.has(siteOf(u.hostname)));
  };

  let trap = null;
  const trapped = () => trap && Date.now() < trap.until;

  const hideOverlay = () => {
    const el = trap?.overlay;
    if (!el) return;
    el.style.setProperty('display', 'none', 'important');
    for (const root of [document.documentElement, document.body]) {
      if (root && getComputedStyle(root).overflow === 'hidden') root.style.setProperty('overflow', 'auto', 'important');
    }
  };

  const blockTrapped = (url) => {
    hideOverlay();
    report(url);
    trap = null;
  };

  const nativeOpen = window.open;
  function open(url, ...rest) {
    if (trapped() && !trusted(url)) {
      blockTrapped(url);
      return null;
    }
    if (allowed(url)) {
      lastNewWindow = Date.now();
      return nativeOpen.call(this === undefined ? window : this, url, ...rest);
    }
    report(url);
    return null;
  }
  window.open = open;

  const frameWindow = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
  Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
    ...frameWindow,
    get() {
      const w = frameWindow.get.call(this);
      try { if (w && w.open !== open) w.open = open; } catch {}
      return w;
    },
  });

  const opensNewWindow = (a) => {
    const target = (a.getAttribute('target') || document.querySelector('base[target]')?.target || '').toLowerCase();
    return target !== '' && target !== '_self' && target !== '_top' && target !== '_parent';
  };

  const hidden = (a) => {
    const r = a.getBoundingClientRect();
    if (r.width * r.height > innerWidth * innerHeight * 0.5) return true;
    for (let el = a; el && el !== document.documentElement; el = el.parentElement) {
      const s = getComputedStyle(el);
      if (Number(s.opacity) < 0.1 || s.visibility === 'hidden') return true;
    }
    return false;
  };

  const blockAnchor = (a, trusted) =>
    a instanceof HTMLAnchorElement && a.href && opensNewWindow(a) && !allowed(a.href) && (!trusted || hidden(a));

  const anchorOf = (e) => (e.target instanceof Element ? e.target.closest('a[href]') : null);

  addEventListener('click', (e) => {
    if (e.isTrusted && e.button === 0) {
      const hit = suspicious(e.target);
      trap = hit ? { until: Date.now() + 1500, overlay: hit.overlay } : null;
      if (hit) document.dispatchEvent(new CustomEvent('__ccx_trap'));
    }
    const a = anchorOf(e);
    if (!a || e.button !== 0) return;
    if (trapped() && !allowed(a.href) && !trusted(a.href) && !a.getAttribute('href').startsWith('#')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return blockTrapped(a.href);
    }
    if (e.isTrusted && (e.ctrlKey || e.metaKey || e.shiftKey)) return approve(a.href);
    if (!opensNewWindow(a)) return;
    if (blockAnchor(a, e.isTrusted)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return report(a.href);
    }
    lastNewWindow = Date.now();
    if (e.isTrusted) approve(a.href);
  }, true);

  addEventListener('auxclick', (e) => {
    const a = anchorOf(e);
    if (a && e.isTrusted && e.button === 1) approve(a.href);
  }, true);

  addEventListener('contextmenu', (e) => {
    const a = anchorOf(e);
    if (a && e.isTrusted) approve(a.href, true);
  }, true);

  if (window === top && window.navigation) {
    navigation.addEventListener('navigate', (e) => {
      if (!e.cancelable || e.hashChange || e.downloadRequest !== null) return;
      if (trapped() && e.formData === null && !allowed(e.destination.url) && !trusted(e.destination.url)) {
        e.preventDefault();
        return blockTrapped(e.destination.url);
      }
      if (e.userInitiated) return;
      if (Date.now() - lastNewWindow > 3000 || allowed(e.destination.url)) return;
      e.preventDefault();
      report(e.destination.url);
    });
  }

  const nativeClick = HTMLElement.prototype.click;
  HTMLElement.prototype.click = function () {
    if (blockAnchor(this, false)) return report(this.href);
    return nativeClick.call(this);
  };

  const nativeDispatch = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function (event) {
    if (event instanceof MouseEvent && event.type === 'click' && !this.isConnected && blockAnchor(this, false)) {
      report(this.href);
      return false;
    }
    return nativeDispatch.call(this, event);
  };
})();
