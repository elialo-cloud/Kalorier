// V4 stability + source badge polish.
(() => {
  if (!document.getElementById('quickSettings')) {
    const b=document.createElement('button'); b.id='quickSettings'; b.hidden=true; b.type='button'; document.body.appendChild(b);
  }
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
  function badgeFor(row){
    const isOff=/\bProdukt\b/.test(row.textContent||'');
    return isOff?'<span class="source-badge off" title="Open Food Facts" aria-label="Open Food Facts"><span class="off-mark">●</span> OFF</span>':'<span class="source-badge liv" title="Livsmedelsverket" aria-label="Livsmedelsverket"><span class="liv-mark">L</span> LIVS</span>';
  }
  function applyBadges(){document.querySelectorAll('.result,.food').forEach(row=>{const title=row.querySelector('strong');if(!title||title.querySelector('.source-badge'))return;title.insertAdjacentHTML('beforeend',' '+badgeFor(row))})}
  const style=document.createElement('style');style.textContent=`
    .source-badge{display:inline-flex;align-items:center;gap:3px;vertical-align:middle;margin-left:6px;padding:3px 7px;border-radius:999px;font-size:9px;font-weight:800;letter-spacing:.03em;line-height:1;white-space:nowrap;opacity:.92}
    .source-badge .off-mark{font-size:7px;line-height:1}.source-badge.liv{background:#f0f2ef;color:#435147;border:1px solid #d8dfd9}.source-badge.off{background:#f2f6e9;color:#566a2c;border:1px solid #dce6c9}
  `;document.head.appendChild(style);
  new MutationObserver(applyBadges).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyBadges);else applyBadges();
})();
