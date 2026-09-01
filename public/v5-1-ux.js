(() => {
  const portionMap=[
    {re:/\b(ägg|egg)\b/i,unit:'st',grams:55},
    {re:/\bbanan/i,unit:'st',grams:120},
    {re:/\b(äpple|apple)\b/i,unit:'st',grams:150},
    {re:/\b(päron|pear)\b/i,unit:'st',grams:150},
    {re:/\bkiwi/i,unit:'st',grams:75},
    {re:/\b(apelsin|orange)\b/i,unit:'st',grams:150},
    {re:/\bavokado/i,unit:'st',grams:140},
    {re:/\bpotatis/i,unit:'st',grams:100},
    {re:/\b(bröd|macka|smörgås)\b/i,unit:'skiva',grams:35},
    {re:/\bknäckebröd/i,unit:'skiva',grams:12}
  ];
  const portionFor=name=>portionMap.find(x=>x.re.test(name))||null;
  function mountControls(){
    const card=document.querySelector('#amountArea'),amount=document.querySelector('#amount'),selected=document.querySelector('#selectedFood');
    if(!card||!amount||!selected||card.hidden)return;
    const name=selected.querySelector('strong')?.textContent||'';const p=portionFor(name);if(!p)return;
    let c=card.querySelector('.portion-controls');
    if(!c){
      c=document.createElement('div');c.className='portion-controls';
      c.innerHTML='<div class="portion-title">Portionsstorlek</div><div class="portion-buttons"><button type="button" data-mode="portion"></button><button type="button" data-mode="100">100 g</button><button type="button" data-mode="custom">Egen mängd</button></div><div class="portion-stepper"><button type="button" data-step="-1" aria-label="Minska">−</button><strong data-value>1</strong><span data-unit></span><button type="button" data-step="1" aria-label="Öka">+</button></div>';
      card.prepend(c);
      c.addEventListener('click',e=>{
        const b=e.target.closest('button');if(!b)return;
        const mode=b.dataset.mode,value=c.querySelector('[data-value]'),unit=c.querySelector('[data-unit]');
        if(mode==='portion'){value.textContent='1';unit.textContent=p.unit;amount.value=p.grams;setActive(c,'portion')}
        if(mode==='100'){value.textContent='100';unit.textContent='g';amount.value=100;setActive(c,'100')}
        if(mode==='custom'){value.textContent=amount.value||p.grams;unit.textContent='g';setActive(c,'custom');amount.focus({preventScroll:true});amount.select()}
        if(b.dataset.step){let n=Math.max(1,(Number(value.textContent)||1)+Number(b.dataset.step));value.textContent=n;unit.textContent=p.unit;amount.value=Math.round(p.grams*n);setActive(c,'portion')}
      });
    }
    c.querySelector('[data-mode="portion"]').textContent=`1 ${p.unit}`;
    c.querySelector('[data-mode="portion"]').click();
  }
  function setActive(c,mode){c.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode))}
  document.addEventListener('click',e=>{
    if(e.target.closest('.result'))requestAnimationFrame(mountControls);
  });
  const css=document.createElement('style');css.textContent='.portion-controls{margin:12px 0 14px}.portion-title{font-size:11px;font-weight:800;color:#777;margin-bottom:7px}.portion-buttons{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.portion-buttons button{border:1px solid #ddd;background:#f7f7f4;color:#181818;border-radius:12px;padding:11px 5px;font-weight:750;font-size:11px;min-height:44px;touch-action:manipulation}.portion-buttons button.active{background:#181818;color:#fff;border-color:#181818}.portion-stepper{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:10px}.portion-stepper button{width:42px;height:42px;border:0;background:#eee;border-radius:13px;font-size:24px;touch-action:manipulation}.portion-stepper strong{font-size:21px;min-width:24px;text-align:center}.portion-stepper span{font-size:12px;color:#777;min-width:32px}.amount-card{z-index:8}';document.head.appendChild(css);
})();
