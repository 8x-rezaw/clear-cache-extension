(() => {
  const root = document.documentElement;
  const dark = matchMedia('(prefers-color-scheme: dark)');
  let saved = null;
  try { saved = localStorage.getItem('theme'); } catch {}
  const apply = () => { root.dataset.theme = saved || (dark.matches ? 'dark' : 'light'); };
  apply();
  dark.addEventListener('change', apply);

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('theme')?.addEventListener('click', () => {
      saved = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('theme', saved); } catch {}
      apply();
    });
  });
})();
