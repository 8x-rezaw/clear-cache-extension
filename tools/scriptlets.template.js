(() => {
  const RULES = /* RULES */ {};

  const parts = location.hostname.split('.');
  const rules = [];
  for (let i = 0; i < parts.length - 1; i++) {
    const found = RULES[parts.slice(i).join('.')];
    if (found) rules.push(...found);
  }
  if (!rules.length) return;

  const SKIP = Symbol('skip');

  const pattern = (raw) => {
    if (!raw || raw === '*') return null;
    const not = raw.startsWith('!');
    const text = not ? raw.slice(1) : raw;
    const m = /^\/(.+)\/([gimsu]*)$/.exec(text);
    const re = m ? new RegExp(m[1], m[2]) : new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return { test: (s) => re.test(String(s)) !== not };
  };

  const constant = (raw) => {
    const values = {
      undefined: undefined, '': undefined, false: false, true: true, null: null,
      noopFunc: () => {}, trueFunc: () => true, falseFunc: () => false,
      emptyArr: [], emptyObj: {}, emptyStr: '', noopPromiseResolve: () => Promise.resolve(),
    };
    if (raw in values) return values[raw];
    if (/^-?\d+$/.test(raw) && Math.abs(Number(raw)) <= 0x7fff) return Number(raw);
    return SKIP;
  };

  // Installs `descriptor(currentValue)` on the last property of a dotted chain,
  // even when the intermediate objects are created later by the page.
  const onChain = (chain, descriptor) => {
    const trap = (owner, props) => {
      const [prop, ...rest] = props;
      if (!rest.length) {
        try { Object.defineProperty(owner, prop, { configurable: true, ...descriptor(owner[prop]) }); } catch {}
        return;
      }
      let current = owner[prop];
      if (current instanceof Object) trap(current, rest);
      try {
        Object.defineProperty(owner, prop, {
          configurable: true,
          get: () => current,
          set: (v) => {
            current = v;
            if (v instanceof Object) trap(v, rest);
          },
        });
      } catch {}
    };
    trap(window, chain.split('.'));
  };

  const abort = () => { throw new ReferenceError('blocked'); };

  const onDom = (fn) => {
    const run = () => { try { fn(); } catch {} };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
    else run();
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      setTimeout(() => { queued = false; run(); }, 100);
    }).observe(document, { childList: true, subtree: true, attributes: true });
  };

  const handlers = {
    set(chain, raw) {
      const value = constant(raw);
      if (value === SKIP || !chain) return;
      onChain(chain, () => ({ get: () => value, set: () => {} }));
    },
    aopr(chain) {
      if (chain) onChain(chain, () => ({ get: abort, set: () => {} }));
    },
    aopw(chain) {
      if (!chain) return;
      onChain(chain, (current) => ({ get: () => current, set: abort }));
    },
    acs(chain, needle) {
      if (!chain) return;
      const match = pattern(needle);
      onChain(chain, (current) => {
        let value = current;
        const check = () => {
          const s = document.currentScript;
          if (s instanceof HTMLScriptElement && (!match || match.test(s.src || s.textContent))) abort();
        };
        return {
          get() { check(); return value; },
          set(v) { check(); value = v; },
        };
      });
    },
    aeld(type, needle) {
      const typeMatch = pattern(type);
      const handlerMatch = pattern(needle);
      const native = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function (t, fn, ...rest) {
        if ((!typeMatch || typeMatch.test(t)) && (!handlerMatch || handlerMatch.test(fn))) return;
        return native.call(this, t, fn, ...rest);
      };
    },
    nostif(needle, delay) {
      const match = pattern(needle);
      const native = window.setTimeout;
      window.setTimeout = function (fn, ms, ...rest) {
        if ((!match || match.test(fn)) && (!delay || String(ms) === delay)) return 0;
        return native.call(this, fn, ms, ...rest);
      };
    },
    nosiif(needle, delay) {
      const match = pattern(needle);
      const native = window.setInterval;
      window.setInterval = function (fn, ms, ...rest) {
        if ((!match || match.test(fn)) && (!delay || String(ms) === delay)) return 0;
        return native.call(this, fn, ms, ...rest);
      };
    },
    ra(attrs, selector) {
      const names = (attrs || '').split('|').filter(Boolean);
      if (!names.length) return;
      const sel = selector || names.map((n) => `[${CSS.escape(n)}]`).join(',');
      onDom(() => {
        for (const el of document.querySelectorAll(sel)) for (const n of names) el.removeAttribute(n);
      });
    },
    rc(classes, selector) {
      const names = (classes || '').split('|').filter(Boolean);
      if (!names.length) return;
      const sel = selector || names.map((n) => `.${CSS.escape(n)}`).join(',');
      onDom(() => {
        for (const el of document.querySelectorAll(sel)) el.classList.remove(...names);
      });
    },
    nofetch(needle) {
      const match = pattern((needle || '').replace(/^url:/, '').split(/\s+/)[0]);
      if (!match) return;
      const native = window.fetch;
      window.fetch = function (input, ...rest) {
        const url = input instanceof Request ? input.url : String(input);
        if (match.test(url)) return Promise.resolve(new Response('', { status: 200 }));
        return native.call(this, input, ...rest);
      };
    },
    jsonprune(paths) {
      const list = (paths || '').split(/\s+/).filter((p) => p && !/[*[\]]/.test(p));
      if (!list.length) return;
      const native = JSON.parse;
      JSON.parse = function (...args) {
        const result = native.apply(this, args);
        for (const path of list) {
          const keys = path.split('.');
          const last = keys.pop();
          let owner = result;
          for (const k of keys) owner = owner instanceof Object ? owner[k] : undefined;
          if (owner instanceof Object) delete owner[last];
        }
        return result;
      };
    },
  };

  for (const [name, ...args] of rules) {
    try { handlers[name]?.(...args); } catch {}
  }
})();
