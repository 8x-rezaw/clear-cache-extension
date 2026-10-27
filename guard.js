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

  const nativeOpen = window.open;
  function open(url, ...rest) {
    if (allowed(url)) return nativeOpen.call(this === undefined ? window : this, url, ...rest);
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

  addEventListener('click', (e) => {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
    if (!a || !blockAnchor(a, e.isTrusted)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    report(a.href);
  }, true);

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
