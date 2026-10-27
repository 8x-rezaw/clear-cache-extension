const $ = (id) => document.getElementById(id);

const fa = (n) => n.toLocaleString('fa-IR');

const OPTIONS = ['cache', 'cacheStorage', 'cookies', 'localStorage', 'currentSiteOnly', 'reload'];

const store = {
  get() {
    try { return JSON.parse(localStorage.getItem('prefs')) || {}; } catch { return {}; }
  },
  set(value) {
    try { localStorage.setItem('prefs', JSON.stringify(value)); } catch {}
  },
};

const prefs = store.get();
for (const id of OPTIONS) if (typeof prefs[id] === 'boolean') $(id).checked = prefs[id];
const savedRange = document.querySelector(`input[name=since][value="${prefs.since}"]`);
if (savedRange) savedRange.checked = true;

document.addEventListener('change', () => {
  const next = { since: document.querySelector('input[name=since]:checked').value };
  for (const id of OPTIONS) next[id] = $(id).checked;
  store.set(next);
});

class UserError extends Error {}

function since() {
  const ms = Number(document.querySelector('input[name=since]:checked').value);
  return ms ? Date.now() - ms : 0;
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function parseWebUrl(raw) {
  try {
    const url = new URL(raw);
    return /^https?:$/.test(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

function currentSite(tab) {
  if (!$('currentSiteOnly').checked) return null;
  const url = parseWebUrl(tab?.url);
  if (!url) throw new UserError('این صفحه سایت معتبری نیست.');
  return url;
}

let busy = false;

async function run(btn, action) {
  if (busy) return;
  busy = true;
  const buttons = document.querySelectorAll('.actions button');
  const base = btn.dataset.label;
  const show = (text, state = '') => {
    btn.textContent = text;
    btn.classList.remove('ok', 'err');
    if (state) btn.classList.add(state);
  };

  clearTimeout(btn.resetTimer);
  buttons.forEach((b) => (b.disabled = true));
  show('در حال پاک کردن…');

  try {
    await action();
    show('پاک شد', 'ok');
  } catch (e) {
    show(e instanceof UserError ? e.message : 'خطا: ' + e.message, 'err');
  } finally {
    busy = false;
    buttons.forEach((b) => (b.disabled = false));
    btn.resetTimer = setTimeout(() => show(base), 2000);
  }
}

$('clear').addEventListener('click', () => run($('clear'), async () => {
  const dataTypes = {
    cache: $('cache').checked,
    cacheStorage: $('cacheStorage').checked,
    serviceWorkers: $('cacheStorage').checked,
    cookies: $('cookies').checked,
    localStorage: $('localStorage').checked,
  };
  if (!Object.values(dataTypes).some(Boolean)) throw new UserError('حداقل یک گزینه را انتخاب کنید.');

  const tab = await activeTab();
  const site = currentSite(tab);
  const options = { since: since() };
  if (site) options.origins = siteOrigins(site);

  await chrome.browsingData.remove(options, dataTypes);

  if ($('reload').checked && tab?.id && parseWebUrl(tab.url)) {
    await chrome.tabs.reload(tab.id, { bypassCache: true });
  }
}));

$('clearSuggestions').addEventListener('click', () => run($('clearSuggestions'), async () => {
  const site = currentSite(await activeTab());
  const from = since();
  if (!site) return chrome.browsingData.removeHistory({ since: from });

  const host = baseHost(site.hostname);
  const items = await chrome.history.search({ text: host, startTime: from, maxResults: 1e6 });
  const urls = new Set();
  for (const item of items) {
    const url = parseWebUrl(item.url);
    if (url && baseHost(url.hostname) === host) urls.add(item.url);
  }
  await Promise.all([...urls].map((url) => chrome.history.deleteUrl({ url })));
}));

function baseHost(hostname) {
  return hostname.replace(/^www\./, '');
}

// example.com and www.example.com hold separate data; clear both, on http and https.
function siteOrigins(site) {
  const host = baseHost(site.hostname);
  const port = site.port ? ':' + site.port : '';
  const bare = !host.includes('.') || /^[\d.]+$/.test(host) || host.startsWith('[');
  const hosts = bare ? [host] : [host, 'www.' + host];
  return ['https:', 'http:'].flatMap((p) => hosts.map((h) => `${p}//${h}${port}`));
}

async function initBlocker() {
  const tab = await activeTab();
  const url = parseWebUrl(tab?.url);
  const site = url && siteOf(url.hostname);
  const count = tab?.id !== undefined ? Number(await chrome.action.getBadgeText({ tabId: tab.id })) || 0 : 0;
  const settings = await chrome.storage.local.get({ popupBlock: true, allowedSites: [] });

  const render = () => {
    const allowed = site && settings.allowedSites.includes(site);
    const info = $('blockInfo');
    const toggle = $('siteToggle');
    $('popupBlock').checked = settings.popupBlock;
    toggle.hidden = !settings.popupBlock || !site;
    info.replaceChildren();

    if (!settings.popupBlock) return info.append('خاموش است');
    if (!site) return info.append('روی همه‌ی سایت‌ها فعال است');

    const name = document.createElement('bdi');
    name.textContent = site;
    if (allowed) {
      info.append('روی ', name, ' خاموش است ·');
      toggle.textContent = 'روشن کن';
    } else {
      info.append(count ? `${fa(count)} مورد در این صفحه مسدود شد ·` : 'روی این سایت فعال است ·');
      toggle.textContent = 'برای این سایت خاموش کن';
    }
  };

  const reloadTab = () => { if (url) chrome.tabs.reload(tab.id); };

  $('popupBlock').addEventListener('change', async (e) => {
    settings.popupBlock = e.target.checked;
    render();
    await chrome.runtime.sendMessage({ type: 'setEnabled', value: settings.popupBlock });
    reloadTab();
  });

  $('siteToggle').addEventListener('click', async () => {
    const allow = !settings.allowedSites.includes(site);
    settings.allowedSites = allow ? [...settings.allowedSites, site] : settings.allowedSites.filter((s) => s !== site);
    render();
    await chrome.runtime.sendMessage({ type: 'setSite', site, allow });
    reloadTab();
  });

  render();
}

initBlocker();
