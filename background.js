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
    const tabId = sender.tab?.id;
    if (tabId === undefined) return;
    const count = await bumpBadge(tabId);
    await chrome.tabs.sendMessage(tabId, { type: 'toast', url: String(msg.url || ''), count }, { frameId: 0 }).catch(() => {});
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
