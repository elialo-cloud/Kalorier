(() => {
  const portionMap = [
    { re:/\b(ägg|egg)\b/i, unit:'st', amount:1, grams:55 },
    { re:/\bbanan/i, unit:'st', amount:1, grams:120 },
    { re:/\bäpple|apple/i, unit:'st', amount:1, grams:150 },
    { re:/\bpäron|pear/i, unit:'st', amount:1, grams:150 },
    { re:/\bkiwi/i, unit:'st', amount:1, grams:75 },
    { re:/\borange|apelsin/i, unit:'st', amount:1, grams:150 },
    { re:/\bavokado/i, unit:'st', amount:1, grams:140 },
    { re:/\bpotatis/i, unit:'st', amount:1, grams:100 },
    { re:/\bbröd|macka|smörgås/i, unit:'skiva', amount:1, grams:35 },
    { re:/\bknäckebröd/i, unit:'skiva', amount:1, grams:12 },
  ];
  const getPortion = name => portionMap.find(x=>x.re.test(name)) || {unit:'g',amount:100,grams:100};
  const originalSelect = window.selectFood;
  window.selectFood = function(food){
    originalSelect?.(food);
    const p=getPortion(food.name||'');
    const amount=document.querySelector('#amount');
    const card=document.querySelector('#amountArea');
    if(!amount||!card)return;
    let controls=card.querySelector('.portion-controls');
    if(!controls){
      controls=document.createElement('div');
      controls.className='portion-controls';
      controls.innerHTML='<div class="portion-title">Portion</div><div class="portion-buttons"><button type="button" data-mode="portion">1 portion</button><button type="button" data-mode="100">100 g</button><button type="button" data-mode="custom">Egen mängd</button></div><div class="portion-stepper"><button type="button" data-step="-1">−</button><strong id="portionValue">1</strong><button type="button" data-step="1">+</button><span id="portionUnit">st</span></div>';
      card.prepend(controls);
      controls.addEventListener('click',e=>{
        const mode=e.target.closest('[data-mode]')?.dataset.mode;
        const step=e.target.closest('[data-step]')?.dataset.step;
        if(mode){
          controls.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
          const value=document.querySelector('#portionValue'),unit=document.querySelector('#portionUnit');
          if(mode==='portion'){value.textContent=p.amount;unit.textContent=p.unit;amount.value=p.grams*p.amount}
          else if(mode==='100'){value.textContent='100';unit.textContent='g';amount.value=100}
          else {value.textContent=amount.value||p.grams;unit.textContent='g';amount.focus()}
        }
        if(step){
          const value=document.querySelector('#portionValue');let n=Math.max(1,(Number(value.textContent)||1)+Number(step));value.textContent=n;document.querySelector('#portionUnit').textContent=p.unit;amount.value=Math.round(p.grams*n)}
      });
    }
    controls.querySelector('[data-mode="portion"]').textContent=`${p.amount} ${p.unit}`;
    controls.querySelector('[data-mode="portion"]').click();
  };

  const css=document.createElement('style');
  css.textContent='.portion-controls{margin:12px 0 14px}.portion-title{font-size:11px;font-weight:800;color:#777;margin-bottom:7px}.portion-buttons{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.portion-buttons button{border:1px solid #ddd;background:#f7f7f4;border-radius:12px;padding:11px 5px;font-weight:750;font-size:11px;min-height:44px}.portion-buttons button.active{background:#181818;color:#fff;border-color:#181818}.portion-stepper{display:flex;align-items:center;justify-content:center;gap:15px;margin-top:10px}.portion-stepper button{width:42px;height:42px;border:0;background:#eee;border-radius:13px;font-size:24px}.portion-stepper strong{font-size:21px;min-width:35px;text-align:center}.portion-stepper span{font-size:12px;color:#777;min-width:25px}.amount-card{padding-bottom:14px}@media(max-width:450px){.portion-buttons button{font-size:10px}}';document.head.appendChild(css);
})();
