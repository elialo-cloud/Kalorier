// Kalorier V5.1 compatibility helpers.
// Keep the stable V4.2 behavior, but never overwrite the V5.1 version label.
(() => {
  if (!document.getElementById('quickSettings')) {
    const b=document.createElement('button');
    b.id='quickSettings'; b.type='button'; b.hidden=true;
    document.body.appendChild(b);
  }
  function setVersion(){
    document.title='Kalorier V5.1';
    const version=document.querySelector('.eyebrow b');
    if(version) version.textContent='V5.1';
  }
  function closeSettingsSafely(){
    const v=document.getElementById('settingsView');
    if(v){v.classList.remove('open');v.setAttribute('aria-hidden','true')}
    document.body.style.overflow='';
  }
  function setGoal(type){document.querySelectorAll('#goalPills button').forEach(b=>b.classList.toggle('active',b.dataset.goal===type))}
  function saveGoalsSafely(){
    const num=(id,def,min)=>Math.max(min,Number(document.getElementById(id)?.value)||def);
    const saved={kcal:num('targetKcal',2200,800),protein:num('targetProtein',160,0),carbs:num('targetCarbs',220,0),fat:num('targetFat',70,0),goal:document.querySelector('#goalPills button.active')?.dataset.goal||'maintain'};
    localStorage.setItem('kalorier-goals',JSON.stringify(saved));closeSettingsSafely();if(typeof render==='function')render();
  }
  document.addEventListener('click',e=>{
    const back=e.target.closest('#closeSettings');if(back){e.preventDefault();closeSettingsSafely();return}
    const goal=e.target.closest('#goalPills button');if(goal){e.preventDefault();setGoal(goal.dataset.goal);return}
    const save=e.target.closest('#saveSettings');if(save){e.preventDefault();saveGoalsSafely();return}
  });
  setVersion();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setVersion);
})();
