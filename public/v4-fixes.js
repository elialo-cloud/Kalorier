// Kalorier V4.2: search stability, goal fixes, and source badge polish.
(() => {
  document.title='Kalorier V4.2';
  const version=document.querySelector('.eyebrow b'); if(version) version.textContent='V4.2';
  function closeSettingsSafely(){const v=document.getElementById('settingsView');if(v){v.classList.remove('open');v.setAttribute('aria-hidden','true')}document.body.style.overflow=''}
  function setGoal(type){document.querySelectorAll('#goalPills button').forEach(b=>b.classList.toggle('active',b.dataset.goal===type))}
  function saveGoalsSafely(){
    const num=(id,def,min)=>Math.max(min,Number(document.getElementById(id)?.value)||def);
    const saved={kcal:num('targetKcal',2200,800),protein:num('targetProtein',160,0),carbs:num('targetCarbs',220,0),fat:num('targetFat',70,0),goal:document.querySelector('#goalPills button.active')?.dataset.goal||'maintain'};
    localStorage.setItem('kalorier-goals',JSON.stringify(saved)); closeSettingsSafely(); location.reload();
  }
  document.addEventListener('click',e=>{
    const back=e.target.closest('#closeSettings');if(back){e.preventDefault();closeSettingsSafely();return}
    const goal=e.target.closest('#goalPills button');if(goal){e.preventDefault();setGoal(goal.dataset.goal);return}
    const save=e.target.closest('#saveSettings');if(save){e.preventDefault();saveGoalsSafely();return}
  });
  // Normalize whitespace before every search. This prevents "Nori" -> "Nori " from becoming a different/empty query.
  const originalSearchAll=searchAll;
  searchAll=async function(q=''){
    const normalized=String(q).replace(/\s+/g,' ').trim();
    if(normalized!==q && document.activeElement?.id==='foodSearch') document.getElementById('foodSearch').value=normalized;
    return originalSearchAll(normalized);
  };
  const input=document.getElementById('foodSearch');
  if(input){
    input.addEventListener('keydown',e=>{if(e.key===' ' && !input.value.trim()){e.preventDefault();return} if(e.key==='Enter'){e.preventDefault();input.value=input.value.replace(/\s+/g,' ').trim();searchAll(input.value)}});
    input.addEventListener('blur',()=>{const n=input.value.replace(/\s+/g,' ').trim();if(n!==input.value){input.value=n;searchAll(n)}});
  }
  function badgeFor(row){
    const isOff=/\bProdukt\b/.test(row.textContent||'');
    return isOff?'<span class="source-badge off" title="Open Food Facts" aria-label="Open Food Facts"><span class="off-mark">●</span> OFF</span>':'<span class="source-badge liv" title="Livsmedelsverket" aria-label="Livsmedelsverket">LIVS</span>';
  }
  function applyBadges(){document.querySelectorAll('.result,.food').forEach(row=>{const title=row.querySelector('strong');if(!title||title.querySelector('.source-badge'))return;title.insertAdjacentHTML('beforeend',' '+badgeFor(row))})}
  const style=document.createElement('style');style.textContent=`
    .source-badge{display:inline-flex;align-items:center;gap:3px;vertical-align:middle;margin-left:6px;padding:3px 7px;border-radius:999px;font-size:9px;font-weight:800;letter-spacing:.03em;line-height:1;white-space:nowrap;opacity:.92}
    .source-badge .off-mark{font-size:7px;line-height:1}.source-badge.liv,.source-badge.off{background:#f2f6e9;color:#566a2c;border:1px solid #dce6c9}
    #foodSearch{scroll-margin-top:12px}
  `;document.head.appendChild(style);
  new MutationObserver(applyBadges).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyBadges);else applyBadges();
})();
