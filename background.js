importScripts('site.js');

const DEFAULTS = { popupBlock: true, allowedSites: [] };
const getSettings = () => chrome.storage.local.get(DEFAULTS);

let queue = Promise.resolve();
const sync = () => (queue = queue.then(register, register));

async function register() {
  const { popupBlock, allowedSites } = await getSettings();
  await chrome.declarativeNetRequest.updateEnabledRulesets(
    popupBlock ? { enableRulesetIds: ['ads'] } : { disableRulesetIds: ['ads'] });
  const dynamic = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: dynamic.map((r) => r.id),
    addRules: popupBlock && allowedSites.length ? [
      { id: 1, priority: 100, action: { type: 'allowAllRequests' }, condition: { requestDomains: allowedSites, resourceTypes: ['main_frame', 'sub_frame'] } },
      { id: 2, priority: 100, action: { type: 'allow' }, condition: { initiatorDomains: allowedSites, resourceTypes: ['main_frame'] } },
    ] : [],
  });

  const existing = await chrome.scripting.getRegisteredContentScripts();
  if (existing.length) await chrome.scripting.unregisterContentScripts();
  if (!popupBlock) return;

  const patterns = (site) =>
    site.includes('.') && !/^[\d.]+$/.test(site) ? [`*://${site}/*`, `*://*.${site}/*`] : [`*://${site}/*`];
  const excludeMatches = allowedSites.flatMap(patterns);
  const { genericOff } = await loadCosmetic();
  const common = {
    matches: ['http://*/*', 'https://*/*'],
    excludeMatches,
    allFrames: true,
    matchOriginAsFallback: true,
    runAt: 'document_start',
  };
  await chrome.scripting.registerContentScripts([
    { id: 'guard', js: ['guard.js'], world: 'MAIN', ...common },
    { id: 'scriptlets', js: ['rules/scriptlets.js'], world: 'MAIN', ...common },
    { id: 'bridge', js: ['bridge.js', 'procedural.js'], ...common },
    {
      id: 'generic',
      css: ['rules/generic.css'],
      matches: common.matches,
      excludeMatches: [...excludeMatches, ...genericOff.flatMap(patterns)],
      runAt: 'document_start',
    },
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
const traps = new Map();
const committed = new Map();
const attempts = new Map();
const trapped = (tabId) => (traps.get(tabId) || 0) > Date.now();

let cosmetic = null;
const loadCosmetic = async () =>
  (cosmetic ??= await fetch(chrome.runtime.getURL('rules/cosmetic.json')).then((r) => r.json()));

const hostChain = (hostname) => {
  const parts = hostname.split('.');
  return parts.slice(0, -1).map((_, i) => parts.slice(i).join('.'));
};

async function cosmeticCss(hostname) {
  const { genericExcept, sites, except, genericOff } = await loadCosmetic();
  const hosts = hostChain(hostname);
  const selectors = new Set();
  if (!hosts.some((h) => genericOff.includes(h))) {
    for (const [sel, skip] of Object.entries(genericExcept)) {
      if (!skip.some((d) => hosts.includes(d))) selectors.add(sel);
    }
  }
  for (const h of hosts) for (const sel of sites[h] || []) selectors.add(sel);
  for (const h of hosts) {
    for (const sel of Object.keys(except)) if (except[sel].includes(h)) selectors.delete(sel);
  }
  return [...selectors].map((sel) => (sel.endsWith('}') ? sel : `${sel}{display:none!important}`)).join('\n');
}

async function proceduralTasks(hostname) {
  const { procedural } = await loadCosmetic();
  return hostChain(hostname).flatMap((h) => procedural[h] || []);
}

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

  if (trapped(d.sourceTabId)) {
    chrome.tabs.remove(d.tabId).catch(() => {});
    return reportBlocked(d.sourceTabId, d.url);
  }
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
chrome.webNavigation.onBeforeNavigate.addListener((d) => {
  if (d.frameId === 0) attempts.set(d.tabId, d.url);
  onMainFrame(d);
});
chrome.webNavigation.onCommitted.addListener(onMainFrame);

chrome.webNavigation.onCommitted.addListener(async (d) => {
  const url = parseWeb(d.url);
  if (d.frameId === 0) {
    const previous = committed.get(d.tabId);
    committed.set(d.tabId, url ? siteOf(url.hostname) : null);
    if (url && previous && previous !== siteOf(url.hostname) && trapped(d.tabId)) {
      traps.delete(d.tabId);
      await chrome.tabs.goBack(d.tabId).catch(() => {});
      return reportBlocked(d.tabId, d.url);
    }
  }
  if (!url) return;

  const { popupBlock, allowedSites } = await getSettings();
  if (!popupBlock) return;
  const top = d.frameId === 0 ? url : parseWeb((await chrome.tabs.get(d.tabId).catch(() => null))?.url);
  if (top && allowedSites.includes(siteOf(top.hostname))) return;
  const css = await cosmeticCss(url.hostname);
  if (css) {
    chrome.scripting.insertCSS({ target: { tabId: d.tabId, frameIds: [d.frameId] }, css, origin: 'USER' }).catch(() => {});
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  for (const map of [watched, approvals, traps, committed, attempts]) map.delete(tabId);
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
  async procedural(msg, sender) {
    const url = parseWeb(sender.url);
    return url ? proceduralTasks(url.hostname) : [];
  },
  async trap(msg, sender) {
    if (sender.tab) traps.set(sender.tab.id, Date.now() + 1500);
  },
  async lastBlocked(msg, sender) {
    const blockedPage = chrome.runtime.getURL('blocked.html');
    if (!sender.tab || !sender.url?.startsWith(blockedPage)) return null;
    return attempts.get(sender.tab.id) || null;
  },
  async bypass(msg, sender) {
    const url = parseWeb(msg.url);
    if (!url || !sender.url?.startsWith(chrome.runtime.getURL('blocked.html'))) return false;
    const id = 1000 + Math.floor(Math.random() * 1e6);
    await chrome.declarativeNetRequest.updateSessionRules({
      addRules: [{ id, priority: 200, action: { type: 'allow' }, condition: { requestDomains: [url.hostname], resourceTypes: ['main_frame'] } }],
    });
    setTimeout(() => chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [id] }), 30000);
    return true;
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
  handler(msg, sender).then((result) => reply(result ?? true), () => reply(false));
  return true;
});
