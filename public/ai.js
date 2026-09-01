/* Kalorier AI food interpreter
   Complex natural-language input only. Normal food search stays untouched.
*/
(function(){
  const input=document.querySelector('#foodSearch');
  const results=document.querySelector('#results');
  if(!input||!results)return;

  let requestId=0;
  let current=null;

  const norm=s=>String(s||'').toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();

  function isComplex(q){
    const n=norm(q);
    if(n.length<8)return false;
    const words=n.split(' ').filter(Boolean);
    if(words.length<3)return false;
    return /\b(åt|at|käkade|kakade|jag åt|jag at|till frukost|till lunch|till middag|med|och|plus|samt|i|på|pa)\b/.test(n)
      || /\b\d+(?:[.,]\d+)?\s*(g|gram|kg|ml|dl|cl|l|st|stycken|skivor|matskedar|msk|tsk)\b/.test(n)
      || /\b\d+\s*(ägg|agg|bananer|banan|mackor|macka|smörgåsar|smorgasar)\b/.test(n);
  }

  function esc(v){return String(v??'').replace(/[&<>\'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function kcalFor(x){return Math.round((Number(x.kcal)||0)*(Number(x.grams)||0)/100);}
  function macro(x,k){return ((Number(x[k])||0)*(Number(x.grams)||0)/100);}

  async function searchFood(q){
    try{
      const r=await fetch('/api/foods?q='+encodeURIComponent(q));
      const d=await r.json();
      if(Array.isArray(d)&&d.length)return d[0];
    }catch{}
    return null;
  }

  function render(){
    if(!current)return;
    const items=current.items||[];
    const total=items.reduce((a,x)=>a+kcalFor(x.food),0);
    const protein=items.reduce((a,x)=>a+macro(x.food,'protein'),0);
    const carbs=items.reduce((a,x)=>a+macro(x.food,'carbs'),0);
    const fat=items.reduce((a,x)=>a+macro(x.food,'fat'),0);

    results.innerHTML=`<div class="ai-meal-card">
      <div class="ai-meal-head"><div><div class="search-group-title">🧠 Smart tolkning</div><strong>${esc(current.original)}</strong></div><span class="ai-badge">AI</span></div>
      <div class="ai-items">${items.map((x,i)=>`<div class="ai-item">
        <div class="ai-item-main"><span class="ai-dot">${esc(x.icon||'🍽️')}</span><div><strong>${esc(x.food.name)}</strong><small>${esc(x.reason||'Matchad mot matdatabasen')}</small></div></div>
        <label><input class="ai-grams" data-i="${i}" type="number" min="1" step="1" value="${Math.round(x.grams)}"> g</label>
        <button type="button" class="ai-remove" data-remove="${i}" aria-label="Ta bort">×</button>
      </div>`).join('')}</div>
      <div class="ai-total"><div><strong>${total} kcal</strong><small>${protein.toFixed(1)} g protein · ${carbs.toFixed(1)} g kolhydrater · ${fat.toFixed(1)} g fett</small></div><button type="button" class="primary" id="aiAddAll">＋ Lägg till allt</button></div>
    </div>`;

    results.querySelectorAll('.ai-grams').forEach(el=>el.addEventListener('input',()=>{
      current.items[Number(el.dataset.i)].grams=Math.max(1,Number(el.value)||1);
      render();
    }));
    results.querySelectorAll('[data-remove]').forEach(el=>el.addEventListener('click',()=>{
      current.items.splice(Number(el.dataset.remove),1);
      if(current.items.length)render(); else results.innerHTML='<div class="empty">AI kunde inte hitta några ingredienser.</div>';
    }));
    document.querySelector('#aiAddAll')?.addEventListener('click',addAll);
  }

  async function addAll(){
    if(!current?.items?.length)return;
    const date=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
    const now=new Date();
    const time=now.toTimeString().slice(0,5);
    const button=document.querySelector('#aiAddAll');
    if(button){button.disabled=true;button.textContent='Lägger till…';}
    try{
      for(const x of current.items){
        const grams=Math.max(1,Number(x.grams)||1);
        await fetch('/api/diary',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date,time,name:x.food.name,source:x.food.source||'livsmedelsverket',product_id:x.food.id||null,grams,kcal:(Number(x.food.kcal)||0)*grams/100,protein:(Number(x.food.protein)||0)*grams/100,carbs:(Number(x.food.carbs)||0)*grams/100,fat:(Number(x.food.fat)||0)*grams/100})});
      }
      results.innerHTML='<div class="empty">✓ Måltiden lades till i dagboken.</div>';
      setTimeout(()=>{document.querySelector('#closeSearch')?.click();window.location.reload();},500);
    }catch{
      if(button){button.disabled=false;button.textContent='＋ Lägg till allt';}
    }
  }

  async function run(q){
    const id=++requestId;
    results.innerHTML='<div class="empty">🧠 Tolkar måltiden…</div>';
    document.querySelector('#searchHint').textContent='AI tolkar maten och matchar mot databasen…';
    try{
      const r=await fetch('/api/ai/parse',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:q})});
      const data=await r.json();
      if(id!==requestId)return;
      if(!r.ok||!Array.isArray(data.items)||!data.items.length)throw new Error('no-items');
      const items=[];
      for(const raw of data.items.slice(0,12)){
        const food=await searchFood(raw.search||raw.name);
        if(!food)continue;
        items.push({food,grams:Number(raw.grams)||100,icon:raw.icon||'🍽️',reason:raw.reason||''});
      }
      if(!items.length)throw new Error('no-matches');
      current={original:q,items};
      render();
      document.querySelector('#searchHint').textContent='AI-tolkning · verifierad mot matdatabasen';
    }catch(e){
      if(id!==requestId)return;
      results.innerHTML='<div class="empty">Kunde inte tolka måltiden just nu. Prova att skriva t.ex. “2 ägg med 10 g smör”.</div>';
      document.querySelector('#searchHint').textContent='Vanlig sökning fungerar fortfarande som vanligt.';
    }
  }

  input.addEventListener('input',e=>{
    const q=e.target.value;
    if(!isComplex(q))return;
    e.stopImmediatePropagation();
    clearTimeout(window.__kalorierAISearchTimer);
    window.__kalorierAISearchTimer=setTimeout(()=>run(q),300);
  },true);

  input.addEventListener('keydown',e=>{
    if(e.key!=='Enter'||!isComplex(input.value))return;
    e.preventDefault();
    e.stopImmediatePropagation();
    run(input.value);
  },true);

  const style=document.createElement('style');
  style.textContent=`
    .ai-meal-card{padding:4px 0 18px}.ai-meal-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px}.ai-meal-head strong{display:block;font-size:17px;margin-top:3px}.ai-badge{font-size:11px;font-weight:700;padding:4px 7px;border-radius:999px;background:#eee;letter-spacing:.04em}.ai-items{display:grid;gap:7px}.ai-item{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:12px;border:1px solid #e5e5e0;border-radius:14px;background:#fafaf7}.ai-item-main{display:flex;gap:10px;align-items:center;min-width:0}.ai-item-main>div{min-width:0}.ai-dot{font-size:20px}.ai-item strong,.ai-item small{display:block}.ai-item small{margin-top:3px;color:#777;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ai-grams{width:65px;border:1px solid #ddd;border-radius:9px;padding:7px;text-align:right}.ai-remove{border:0;background:transparent;font-size:22px;color:#999}.ai-total{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:12px;padding-top:12px;border-top:1px solid #e5e5e0}.ai-total strong,.ai-total small{display:block}.ai-total small{color:#777;margin-top:3px;font-size:12px}
  `;
  document.head.appendChild(style);
})();
