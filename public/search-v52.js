(() => {
  const $ = s => document.querySelector(s);
  const input = $('#foodSearch'), results = $('#results'), hint = $('#searchHint'), amountArea = $('#amountArea'), selectedFood = $('#selectedFood'), amount = $('#amount'), saveFood = $('#saveFood');
  if (!input || !results) return;

  const ALIASES = {
    agg:['agg','honsagg'], honsagg:['agg','honsagg'], gradde:['gradde','vispgradde','matlagningsgradde','kaffegradde'], vispgradde:['gradde','vispgradde'],
    potatis:['potatis'], kyckling:['kyckling','kycklingfile'], kycklingfile:['kyckling','kycklingfile'], not:['not','notter'], notter:['not','notter'],
    havre:['havre','havregryn'], havregryn:['havre','havregryn'], mjolk:['mjolk','standardmjolk','mellanmjolk','latmjolk'],
    yoghurt:['yoghurt','yogurt'], yogurt:['yoghurt','yogurt'], kvarg:['kvarg','skyr'], skyr:['kvarg','skyr'], smor:['smor','margarin'],
    ris:['ris'], pasta:['pasta','makaroner','spaghetti'], brod:['brod','limpa','fralla'], ost:['ost','cheddar','hushallsost'],
    korv:['korv','falukorv','varmkorv'], potatisplatt:['potatisplatt','potatispannkaka','raggmunk']
  };
  const norm = s => String(s||'').toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
  const lev = (a,b) => { if(a===b)return 0; if(!a||!b||Math.abs(a.length-b.length)>2)return 99; let p=Array.from({length:b.length+1},(_,i)=>i); for(let i=1;i<=a.length;i++){const r=[i];for(let j=1;j<=b.length;j++)r[j]=Math.min(r[j-1]+1,p[j]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=r} return p[b.length]; };
  const usageKey='kalorier-search-usage';
  const getUsage=()=>{try{return JSON.parse(localStorage.getItem(usageKey)||'{}')}catch{return {}}};
  const bumpUsage=item=>{const u=getUsage(),k=`${item.source||'livs'}:${item.id||norm(item.name)}`;u[k]=(u[k]||0)+1;localStorage.setItem(usageKey,JSON.stringify(u));};

  function queryVariants(q){
    const out=[q], tokens=norm(q).split(' ').filter(Boolean);
    for(const token of tokens) for(const alias of (ALIASES[token]||[])) if(!out.includes(alias)) out.push(alias);
    if(q.length>=4) out.push(q.slice(0,-1));
    for(let i=0;i<q.length-1&&out.length<8;i++){const a=q.split('');[a[i],a[i+1]]=[a[i+1],a[i]];const v=a.join('');if(v!==q&&!out.includes(v))out.push(v)}
    return [...new Set(out)].slice(0,8);
  }

  function score(item,query){
    const q=norm(query),name=norm(item.name),brand=norm(item.brand),qt=q.split(' ').filter(Boolean),nt=name.split(' ').filter(Boolean);
    if(!q||!name)return -9999;
    let s=0,matched=0;
    if(name===q)s+=5000; else if(name.startsWith(q))s+=1800; else if(name.includes(` ${q}`))s+=1300; else if(name.includes(q))s+=700;
    if(brand===q)s+=900; else if(brand.includes(q))s+=300;
    for(const token of qt){
      const candidates=[token,...(ALIASES[token]||[])]; let best=0;
      for(const c of new Set(candidates)){
        if(nt.includes(c))best=Math.max(best,1200);
        else if(nt.some(x=>x.startsWith(c)))best=Math.max(best,650);
        else if(c.length>=4&&nt.some(x=>lev(c,x)<=1))best=Math.max(best,420);
        else if(c.length>=4&&nt.some(x=>lev(c,x)<=2))best=Math.max(best,180);
        else if(c.length>=3&&name.includes(c))best=Math.max(best,220);
      }
      if(best){matched++;s+=best;}
    }
    if(matched<qt.length)return -9999;
    if(qt.length===1&&nt.length>4)s-=(nt.length-4)*80;
    if(qt.length===1&&/\b(hemgjord|hemlagad|recept|gryta|sas|pannkaka|panna)\b/.test(name)&&!name.startsWith(q))s-=500;
    if(item.source&&item.source.toLowerCase().includes('livsmedel'))s+=item.verified?260:120;
    if(item.source==='openfoodfacts')s+=20;
    s+=Math.min(500,(getUsage()[`${item.source||'livs'}:${item.id||name}`]||0)*35);
    return s;
  }

  const SMART_FOODS = [
    {keys:['kokt agg','kokt honsagg','hardkokt agg','stekt agg'],name:'Ägg, kokt',kcal:143,protein:12.6,carbs:.7,fat:9.5},
    {keys:['agg','honsagg'],name:'Ägg, hönsägg',kcal:143,protein:12.6,carbs:.7,fat:9.5},
    {keys:['banan','banan utan skal'],name:'Banan, utan skal',kcal:89,protein:1.1,carbs:22.8,fat:.3},
    {keys:['kokt ris','ris kokt'],name:'Ris, kokt',kcal:130,protein:2.7,carbs:28.2,fat:.3},
    {keys:['kokt potatis','potatis kokt'],name:'Potatis, kokt',kcal:80,protein:1.8,carbs:17,fat:.1},
    {keys:['kycklingfile','kyckling file','kokt kyckling','stekt kyckling'],name:'Kycklingfilé, tillagad',kcal:165,protein:31,carbs:0,fat:3.6},
    {keys:['havregryn','havre'],name:'Havregryn',kcal:360,protein:13.3,carbs:57,fat:6.5},
    {keys:['mjolk','standardmjolk'],name:'Mjölk, standard',kcal:60,protein:3.5,carbs:4.8,fat:3.0},
    {keys:['vispgradde','gradde'],name:'Vispgrädde',kcal:360,protein:2.1,carbs:3.0,fat:38},
    {keys:['kvarg','skyr'],name:'Kvarg, naturell',kcal:65,protein:11,carbs:4,fat:.2}
  ];
  function smartSuggestion(query, ranked){
    if(ranked.length && ranked[0]._score>=1700)return null;
    const q=norm(query), tokens=q.split(' ').filter(Boolean);
    let best=null,bestScore=-1;
    for(const food of SMART_FOODS){
      for(const key of food.keys){
        const kt=key.split(' '), matched=tokens.filter(t=>kt.some(k=>k===t||k.startsWith(t)||lev(t,k)<=1)).length;
        const prep=tokens.filter(t=>['kokt','stekt','grillad','tillagad','hardkokt'].includes(t)).length;
        let s=matched*500+(q.includes(key)?700:0)+(prep&&key.includes('kokt')?250:0);
        if(matched===tokens.length&&matched>0&&s>bestScore){bestScore=s;best=food}
      }
    }
    if(!best)return null;
    return {...best,id:`ai:${norm(best.name)}`,source:'ai',_score:bestScore};
  }

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const badge=item=>{let cls='search-badge-livs',label='LIVS';if(item.source==='openfoodfacts'){cls='search-badge-off';label='OFF'}else if(item.source==='ai'){cls='search-badge-ai';label='AI'}return `<span class="search-badge ${cls}">${label}</span>`};
  const aiBar=document.createElement('div');
  aiBar.className='ai-search-bar';
  aiBar.setAttribute('aria-live','polite');
  results.parentNode.insertBefore(aiBar,results);

  function resultButton(f){return `<button type="button" class="result" data-id="${esc(f.id||norm(f.name))}"><div class="result-main"><strong>${esc(f.name)}</strong>${badge(f)}</div><small>${f.brand?esc(f.brand)+' · ':''}${Math.round(Number(f.kcal)||0)} kcal · ${(Number(f.protein)||0).toLocaleString('sv-SE',{maximumFractionDigits:1})} g protein / 100 g</small></button>`}
  function render(items,aiItem=null){
    aiBar.innerHTML=aiItem?`<div class="ai-search-inner"><div class="ai-search-copy"><span class="ai-search-title">AI-förslag</span><strong>${esc(aiItem.name)}</strong><small>${Math.round(Number(aiItem.kcal)||0)} kcal · ${(Number(aiItem.protein)||0).toLocaleString('sv-SE',{maximumFractionDigits:1})} g protein / 100 g</small></div><button type="button" class="ai-search-select">Välj</button></div>`:'';
    results.innerHTML=items.length?items.map(resultButton).join(''):'<div class="empty">Inga relevanta resultat hittades.</div>';
    results.querySelectorAll('.result').forEach(b=>{const id=b.dataset.id;const food=items.find(x=>String(x.id||norm(x.name))===id);b.onclick=()=>choose(food)});
    const aiButton=aiBar.querySelector('.ai-search-select');if(aiButton)aiButton.onclick=()=>choose(aiItem);
  }
  function choose(food){window.__kalorierSelectedFood=food;amountArea.hidden=false;selectedFood.innerHTML=`<strong>${esc(food.name)}</strong><small>${Math.round(Number(food.kcal)||0)} kcal per 100 g · ${food.source==='openfoodfacts'?'OFF':food.source==='ai'?'AI':'LIVS'}${food.brand?' · '+esc(food.brand):''}</small>`;requestAnimationFrame(()=>{amount.focus();amount.select()})}

  async function search(q){
    const raw=String(q||'').replace(/\s+/g,' ').trim(); if(raw.length<2){hint.textContent='Skriv vad du åt – vi söker överallt.';render([]);return}
    const request=Symbol();search._request=request;hint.textContent='Söker…';
    try{
      const variants=queryVariants(raw),all=[];
      for(const v of variants){const [a,b]=await Promise.all([fetch(`/api/foods?q=${encodeURIComponent(v)}&fuzzy=1`),fetch(`/api/products?q=${encodeURIComponent(v)}`)]);if(a.ok){const x=await a.json();if(Array.isArray(x))all.push(...x)}if(b.ok){const x=await b.json();if(Array.isArray(x))all.push(...x)}}
      if(search._request!==request)return;
      const seen=new Set(),ranked=all.filter(x=>{const k=`${x.source||'livs'}:${x.id||norm(x.name)}`;if(seen.has(k))return false;seen.add(k);return true}).map(x=>({...x,_score:Math.max(...variants.map(v=>score(x,v)))})).filter(x=>x._score>0).sort((a,b)=>b._score-a._score);
      const ai=smartSuggestion(raw,ranked);
      render(ranked.slice(0,50),ai);
      hint.textContent=ranked.length?(ai?`${Math.min(50,ranked.length)} relevanta + AI-förslag`:`${Math.min(50,ranked.length)} relevanta resultat`):(ai?'AI-förslag':'Inga relevanta resultat.');
    }catch{if(search._request===request){hint.textContent='Kunde inte läsa databaserna.';render([])}}
  }

  input.oninput=e=>{clearTimeout(window.__kalorierSearchTimer);const q=e.target.value;$('#clearSearch').hidden=!q;window.__kalorierSearchTimer=setTimeout(()=>search(q),160)};
  $('#clearSearch').onclick=()=>{input.value='';$('#clearSearch').hidden=true;search('');input.focus()};
  const open=q=>{const view=$('#searchView');view.classList.add('open');view.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';input.value=q||'';amountArea.hidden=true;window.__kalorierSelectedFood=null;$('#clearSearch').hidden=!q;render([]);hint.textContent=q?'Söker…':'Skriv vad du åt – vi söker överallt.';requestAnimationFrame(()=>{input.focus();if(q)search(q)})};
  const close=()=>{$('#searchView').classList.remove('open');$('#searchView').setAttribute('aria-hidden','true');document.body.style.overflow='';window.__kalorierSelectedFood=null};
  $('#addFood').onclick=()=>open('');$('#closeSearch').onclick=close;document.querySelectorAll('.quick button').forEach(b=>b.onclick=()=>open(b.dataset.q));
  saveFood.onclick=async()=>{const food=window.__kalorierSelectedFood,grams=Number(amount.value);if(!food||!(grams>0))return;const f=grams/100,body={date:new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10),time:new Date().toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'}),name:food.name,source:food.source||'livsmedelsverket',product_id:food.id||null,barcode:food.barcode||null,grams,kcal:(food.kcal||0)*f,protein:(food.protein||0)*f,carbs:(food.carbs||0)*f,fat:(food.fat||0)*f};const r=await fetch('/api/diary',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(r.ok){bumpUsage(food);close();location.reload()}else alert('Kunde inte spara maten.')};
  const style=document.createElement('style');style.textContent=`.result-main{display:flex;align-items:center;gap:8px}.search-badge{display:inline-flex;align-items:center;height:20px;padding:0 7px;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:.04em;white-space:nowrap}.search-badge-livs{background:#ecebe6;color:#3d3d39}.search-badge-off{background:#181818;color:#fff}.search-badge-ai{background:#e7ddff;color:#5b3b9c}.ai-search-bar{flex:0 0 auto;margin:0 0 8px}.ai-search-inner{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#fff;border:1px solid #ddd;border-radius:15px;padding:11px 12px;box-shadow:0 2px 10px #00000008}.ai-search-copy{min-width:0}.ai-search-title{display:block;color:#6b4aa1;font-size:10px;font-weight:850;letter-spacing:.08em;text-transform:uppercase;margin-bottom:2px}.ai-search-copy strong{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ai-search-copy small{display:block;color:#888;margin-top:3px;font-size:11px}.ai-search-select{border:0;background:#181818;color:#fff;border-radius:11px;padding:10px 13px;font-weight:800;white-space:nowrap;touch-action:manipulation}`;document.head.appendChild(style);
})();
