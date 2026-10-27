importScripts('site.js');

const DEFAULTS = { popupBlock: true, allowedSites: [] };
const getSettings = () => chrome.storage.local.get(DEFAULTS);

let queue = Promise.resolve();
const sync = () => (queue = queue.then(register, register));

async function register() {
  const { popupBlock, allowedSites } = await getSettings();
  const existing = await chrome.scripting.getRegisteredContentScripts();
  if (existing.length) await chrome.scripting.unregisterContentScripts();
  if (!popupBlock) return;

  const excludeMatches = allowedSites.flatMap((site) =>
    site.includes('.') && !/^[\d.]+$/.test(site) ? [`*://${site}/*`, `*://*.${site}/*`] : [`*://${site}/*`]);
  const common = {
    matches: ['http://*/*', 'https://*/*'],
    excludeMatches,
    allFrames: true,
    matchOriginAsFallback: true,
    runAt: 'document_start',
  };
  await chrome.scripting.registerContentScripts([
    { id: 'guard', js: ['guard.js'], world: 'MAIN', ...common },
    { id: 'bridge', js: ['bridge.js'], ...common },
  ]);
}

async function setSiteAllowed(site, allow) {
  const { allowedSites } = await getSettings();
  const next = new Set(allowedSites);
  allow ? next.add(site) : next.delete(site);
  await chrome.storage.local.set({ allowedSites: [...next].sort() });
  await sync();
}

const parseWeb = (raw) => {
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const approvals = new Map();
const watched = new Map();

function addApproval(tabId, url, long) {
  const now = Date.now();
  const list = (approvals.get(tabId) || []).filter((a) => a.until > now);
  list.push({ url, until: now + (long ? 30000 : 4000) });
  approvals.set(tabId, list);
}

function takeApproval(tabId, url) {
  const now = Date.now();
  const list = (approvals.get(tabId) || []).filter((a) => a.until > now);
  const i = list.findIndex((a) => a.url === url);
  if (i !== -1) list.splice(i, 1);
  approvals.set(tabId, list);
  return i !== -1;
}

async function reportBlocked(tabId, url) {
  const count = await bumpBadge(tabId).catch(() => 0);
  await chrome.tabs.sendMessage(tabId, { type: 'toast', url: String(url || ''), count }, { frameId: 0 }).catch(() => {});
}

function inspect(tabId) {
  const entry = watched.get(tabId);
  if (!entry || entry.pending) return;
  if (Date.now() > entry.until) return watched.delete(tabId);
  const url = parseWeb(entry.url);
  if (!url || siteOf(url.hostname) === entry.site) return;
  watched.delete(tabId);
  chrome.tabs.remove(tabId).catch(() => {});
  reportBlocked(entry.source, entry.url);
}

chrome.webNavigation.onCreatedNavigationTarget.addListener(async (d) => {
  const { popupBlock, allowedSites } = await getSettings();
  if (!popupBlock) return;
  const source = await chrome.tabs.get(d.sourceTabId).catch(() => null);
  const from = source && parseWeb(source.url);
  if (!from) return;
  const site = siteOf(from.hostname);
  if (allowedSites.includes(site)) return;

  const entry = { source: d.sourceTabId, site, url: d.url, pending: true, until: Date.now() + 15000 };
  watched.set(d.tabId, entry);
  await sleep(250);
  if (takeApproval(d.sourceTabId, d.url)) return watched.delete(d.tabId);
  entry.pending = false;
  inspect(d.tabId);
});

const onMainFrame = (d) => {
  if (d.frameId !== 0) return;
  const entry = watched.get(d.tabId);
  if (!entry) return;
  entry.url = d.url;
  inspect(d.tabId);
};
chrome.webNavigation.onBeforeNavigate.addListener(onMainFrame);
chrome.webNavigation.onCommitted.addListener(onMainFrame);

chrome.tabs.onRemoved.addListener((tabId) => {
  watched.delete(tabId);
  approvals.delete(tabId);
});

async function bumpBadge(tabId) {
  const count = (Number(await chrome.action.getBadgeText({ tabId })) || 0) + 1;
  await chrome.action.setBadgeText({ tabId, text: String(count) });
  return count;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
  chrome.action.setBadgeTextColor({ color: '#ffffff' });
  sync();
});
chrome.runtime.onStartup.addListener(sync);

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'loading' && info.url) chrome.action.setBadgeText({ tabId, text: '' });
});

const handlers = {
  async blocked(msg, sender) {
    if (sender.tab) await reportBlocked(sender.tab.id, msg.url);
  },
  async approve(msg, sender) {
    if (sender.tab && parseWeb(msg.url)) addApproval(sender.tab.id, msg.url, msg.long);
  },
  async open(msg, sender) {
    if (!sender.tab || sender.frameId !== 0 || !/^https?:\/\//.test(msg.url)) return;
    await chrome.tabs.create({ url: msg.url, index: sender.tab.index + 1, openerTabId: sender.tab.id });
  },
  async allowSite(msg, sender) {
    if (!sender.tab || sender.frameId !== 0) return;
    await setSiteAllowed(siteOf(new URL(sender.tab.url).hostname), true);
    await chrome.tabs.reload(sender.tab.id);
  },
  async setEnabled(msg, sender) {
    if (sender.tab) return;
    await chrome.storage.local.set({ popupBlock: Boolean(msg.value) });
    await sync();
  },
  async setSite(msg, sender) {
    if (sender.tab) return;
    await setSiteAllowed(String(msg.site), Boolean(msg.allow));
  },
};

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const handler = handlers[msg?.type];
  if (!handler) return false;
  handler(msg, sender).then(() => reply(true), () => reply(false));
  return true;
});
