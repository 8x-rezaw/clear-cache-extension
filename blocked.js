const $ = (id) => document.getElementById(id);

chrome.runtime.sendMessage({ type: 'lastBlocked' }).then((url) => {
  if (!url) return;
  $('url').textContent = url;
  $('proceed').hidden = false;
  $('proceed').addEventListener('click', async () => {
    if (await chrome.runtime.sendMessage({ type: 'bypass', url })) location.replace(url);
  });
});

$('back').addEventListener('click', () => {
  if (history.length > 1) history.back();
  else window.close();
});
