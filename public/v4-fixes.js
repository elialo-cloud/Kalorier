// Small V4 stability/UI fixes kept separate so future frontend work is safer.
(() => {
  const esc = v => String(v ?? '').replace(/[&<>\'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));

  function closeSettingsSafely() {
    const view = document.getElementById('settingsView');
    if (!view) return;
    view.classList.remove('open');
    view.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // The settings sheet is generated dynamically by app.js, so delegation is more reliable
  // than binding once before the element exists.
  document.addEventListener('click', e => {
    if (e.target.closest('#closeSettings')) closeSettingsSafely();
  });

  // Add compact source badges to search results and diary rows without touching app logic.
  function sourceBadge(source) {
    const s = String(source || '').toLowerCase();
    if (s === 'openfoodfacts') return '<span class="source-badge off" title="Open Food Facts">OFF</span>';
    if (s.includes('livsmedelsverket')) return '<span class="source-badge liv" title="Livsmedelsverket">L</span>';
    return '';
  }

  function applyBadges(root = document) {
    root.querySelectorAll('.result, .food').forEach(row => {
      const source = row.dataset.source || row.querySelector('[data-source]')?.dataset.source || '';
      if (!source || row.querySelector('.source-badge')) return;
      // app.js does not expose the selected object's source in the DOM, so infer OFF from its
      // existing product label; all remaining normal food rows are Livsmedelsverket data.
      const isOff = /Produkt/.test(row.textContent || '');
      const badge = sourceBadge(isOff ? 'openfoodfacts' : 'livsmedelsverket');
      const title = row.querySelector('strong');
      if (title && badge) title.insertAdjacentHTML('beforeend', ' ' + badge);
    });
  }

  const observer = new MutationObserver(() => applyBadges());
  observer.observe(document.documentElement, {childList:true, subtree:true});
  window.addEventListener('load', () => setTimeout(applyBadges, 50));
})();
