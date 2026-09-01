// V4 stability fixes. Loaded before the module; uses delegation for dynamically-created UI.
(() => {
  const esc = v => String(v ?? '').replace(/[&<>\'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));

  // app.js expects this optional element to exist. Create it before app.js runs so one
  // missing optional control cannot abort the rest of the application initialization.
  if (!document.getElementById('quickSettings')) {
    const b = document.createElement('button');
    b.id = 'quickSettings';
    b.hidden = true;
    b.type = 'button';
    document.body.appendChild(b);
  }

  function closeSettingsSafely() {
    const view = document.getElementById('settingsView');
    if (!view) return;
    view.classList.remove('open');
    view.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function setGoal(type) {
    // app.js keeps the goal state in its module scope, so use the visible buttons as the
    // immediate UI state and dispatch a click to the real button when it exists.
    document.querySelectorAll('#goalPills button').forEach(b => {
      b.classList.toggle('active', b.dataset.goal === type);
    });
  }

  function saveGoalsSafely() {
    const kcal = Math.max(800, Number(document.getElementById('targetKcal')?.value) || 2200);
    const protein = Math.max(0, Number(document.getElementById('targetProtein')?.value) || 0);
    const carbs = Math.max(0, Number(document.getElementById('targetCarbs')?.value) || 0);
    const fat = Math.max(0, Number(document.getElementById('targetFat')?.value) || 0);
    let goal = document.querySelector('#goalPills button.active')?.dataset.goal || 'maintain';
    const saved = {kcal, protein, carbs, fat, goal};
    localStorage.setItem('kalorier-goals', JSON.stringify(saved));

    // app.js will read these values on the next render/load. If its module is available,
    // trigger the normal settings close and a reload so every progress component is synced.
    closeSettingsSafely();
    location.reload();
  }

  document.addEventListener('click', e => {
    const back = e.target.closest('#closeSettings');
    if (back) { e.preventDefault(); closeSettingsSafely(); return; }

    const goal = e.target.closest('#goalPills button');
    if (goal) { e.preventDefault(); setGoal(goal.dataset.goal); return; }

    const save = e.target.closest('#saveSettings');
    if (save) { e.preventDefault(); saveGoalsSafely(); return; }
  });

  // Compact source badges. L = Livsmedelsverket, OFF = Open Food Facts.
  function sourceBadge(source) {
    const s = String(source || '').toLowerCase();
    if (s === 'openfoodfacts') return '<span class="source-badge off" title="Open Food Facts">OFF</span>';
    if (s.includes('livsmedelsverket')) return '<span class="source-badge liv" title="Livsmedelsverket">L</span>';
    return '';
  }

  function applyBadges(root = document) {
    root.querySelectorAll('.result, .food').forEach(row => {
      if (row.querySelector('.source-badge')) return;
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
