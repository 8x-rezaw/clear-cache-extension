(() => {
  if (window.__ccxProcedural) return;
  window.__ccxProcedural = true;

  const matcher = (raw) => {
    const m = /^\/(.+)\/([gimsu]*)$/.exec(raw);
    if (m) {
      try { const re = new RegExp(m[1], m[2]); return (s) => re.test(s); } catch { return null; }
    }
    return (s) => s.includes(raw);
  };

  const compile = (task) => {
    if (!task.sel) return null;
    if (task.path) {
      const path = matcher(task.path);
      if (!path || !path(location.pathname + location.search)) return null;
    }
    const steps = [];
    let action = ['hide'];
    for (const [op, arg] of task.ops) {
      if (op === 'has-text') {
        const test = matcher(arg);
        if (!test) return null;
        steps.push((nodes) => nodes.filter((n) => test(n.textContent)));
      } else if (op === 'min-text-length') {
        const min = Number(arg);
        steps.push((nodes) => nodes.filter((n) => n.textContent.length >= min));
      } else if (op === 'upward') {
        const n = Number(arg);
        steps.push((nodes) => nodes.map((node) => {
          if (Number.isInteger(n) && n > 0) {
            for (let i = 0; i < n && node; i++) node = node.parentElement;
            return node;
          }
          try { return node.parentElement?.closest(arg); } catch { return null; }
        }).filter(Boolean));
      } else if (op === 'remove') {
        action = ['remove'];
      } else if (op === 'style') {
        action = ['style', arg.split(';').map((d) => d.split(':')).filter((d) => d.length >= 2)
          .map(([p, ...v]) => [p.trim(), v.join(':').replace(/!important/i, '').trim()])];
      } else {
        return null;
      }
    }
    try { document.createDocumentFragment().querySelector(task.sel); } catch { return null; }
    return { sel: task.sel, steps, action };
  };

  const handled = new WeakSet();

  const apply = (node, [type, declarations]) => {
    if (handled.has(node)) return;
    handled.add(node);
    if (type === 'remove') node.remove();
    else if (type === 'style') for (const [p, v] of declarations) node.style.setProperty(p, v, 'important');
    else node.style.setProperty('display', 'none', 'important');
  };

  const start = (tasks) => {
    const compiled = tasks.map(compile).filter(Boolean);
    if (!compiled.length) return;

    const run = () => {
      for (const task of compiled) {
        let nodes = [...document.querySelectorAll(task.sel)];
        for (const step of task.steps) {
          if (!nodes.length) break;
          nodes = step(nodes);
        }
        for (const node of nodes) apply(node, task.action);
      }
    };

    let queued = false;
    const schedule = () => {
      if (queued) return;
      queued = true;
      setTimeout(() => { queued = false; run(); }, 150);
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
    else run();
    new MutationObserver(schedule).observe(document, { childList: true, subtree: true, characterData: true });
  };

  chrome.runtime.sendMessage({ type: 'procedural' }).then((tasks) => {
    if (Array.isArray(tasks) && tasks.length) start(tasks);
  }).catch(() => {});
})();
