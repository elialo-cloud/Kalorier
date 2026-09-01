/* Kalorier Search Engine v9
   Retrieval -> intent -> hard relevance gates -> ranking -> dedupe.
   Inspired by production full-text search patterns and OpenNutriTracker.
*/
const K_SEARCH_CACHE=new Map();
let K_SEARCH_SEQ=0;
let kSelected=null;

const K_AI=[
  {keys:['ägg','agg','kokt ägg','kokt agg','hårdkokt ägg','hardkokt agg'],name:'Kokt ägg',kcal:155,protein:12.6,carbs:1.1,fat:10.6},
  {keys:['stekt ägg','stekt agg'],name:'Stekt ägg',kcal:196,protein:13.6,carbs:.8,fat:14.8},
  {keys:['banan'],name:'Banan',kcal:89,protein:1.1,carbs:22.8,fat:.3},
  {keys:['ris','kokt ris','jasminris','basmatiris'],name:'Kokt ris',kcal:130,protein:2.7,carbs:28.2,fat:.3},
  {keys:['potatis','kokt potatis'],name:'Kokt potatis',kcal:87,protein:1.9,carbs:20.1,fat:.1},
  {keys:['kyckling','kycklingfilé','kycklingfile','kycklingbröst','kycklingbrost'],name:'Kycklingfilé, tillagad',kcal:165,protein:31,carbs:0,fat:3.6},
  {keys:['havregryn'],name:'Havregrynsgröt med vatten',kcal:68,protein:2.4,carbs:11.7,fat:1.4}
];

// Accent-insensitive Swedish normalization. This is deliberately conservative:
// normalization fixes spelling/diacritics; it does NOT invent semantic matches.
function kNorm(v){
  return String(v??'')
    .toLocaleLowerCase('sv-SE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^\p{L}\p{N}]+/gu,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function kTokens(v){return kNorm(v).split(' ').filter(Boolean)}
function kCompact(v){return kNorm(v).replace(/\s+/g,'')}

// Small, explicit typo/alias layer. No broad synonym expansion here.
const K_ALIASES={
  agg:'ägg',
  mjolk:'mjölk',
  brod:'bröd',
  smor:'smör',
  kottfars:'köttfärs',
  notfars:'nötfärs',
  kycklingfile:'kycklingfilé',
  kycklingbrost:'kycklingbröst',
  avocado:'avokado'
};

function kLev(a,b){
  if(a===b)return 0;
  if(!a||!b)return Math.max(a.length,b.length);
  if(Math.abs(a.length-b.length)>2)return 99;
  const r=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    let prev=r[0]; r[0]=i;
    for(let j=1;j<=b.length;j++){
      const old=r[j];
      r[j]=Math.min(r[j]+1,r[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));
      prev=old;
    }
  }
  return r[b.length];
}
function kTypoClose(q,n){
  if(q.length<4||n.length<4)return false;
  const d=kLev(q,n);
  return d===1 || (q.length>=7&&d===2);
}

function kIntent(query){
  const t=kTokens(query);
  const n=kNorm(query);
  const productHints=/\b(zero|sugar|light|max|protein|original|classic|cola|coca|pepsi|arla|ica|coop|eldorado|garant|felix|findus|oatly)\b/i.test(n);
  const recipeHints=/\b(recept|med|gryta|soppa|sås|sauce|gratäng|paj|pizza|sallad|smoothie|macka|pannkaka)\b/i.test(n);
  if(productHints)return 'product';
  if(recipeHints)return 'recipe';
  return t.length>2?'compound':'food';
}

function kCandidateInfo(item,query){
  const q=kNorm(query), nt=kTokens(item.name), qt=kTokens(q);
  const name=kNorm(item.name), brand=kNorm(item.brand);
  if(!q||!name)return null;

  const tokenMatches=[];
  for(const token of qt){
    let best={type:'none',value:0};
    for(const n of nt){
      if(n===token){best={type:'exact',value:1};break;}
      if(n.startsWith(token)&&token.length>=3){best={type:'prefix',value:.9};continue}
      if(token.length>=4&&n.startsWith(token.slice(0,Math.max(2,token.length-1)))&&kTypoClose(token,n)){
        best={type:'typo',value:.72};
      }else if(kTypoClose(token,n)){
        best={type:'typo',value:.65};
      }
    }
    tokenMatches.push(best);
  }

  // HARD GATE: every query token must be represented.
  if(tokenMatches.some(x=>x.type==='none'))return null;

  const exactPhrase=name===q;
  const starts=name.startsWith(q);
  const wordStarts=name.startsWith(q+' ');
  const containsPhrase=name.includes(q);
  const exactTokens=tokenMatches.filter(x=>x.type==='exact').length;
  const typoTokens=tokenMatches.filter(x=>x.type==='typo').length;
  const prefixTokens=tokenMatches.filter(x=>x.type==='prefix').length;

  // For a single short query, require an exact/prefix token. This kills
  // accidental matches from fuzzy search such as unrelated foods.
  if(qt.length===1&&qt[0].length<=3&&exactTokens===0&&prefixTokens===0)return null;

  // Fuzzy is fallback only: if the normal token match is absent, it may help.
  // It never outranks an exact/prefix match.
  if(typoTokens>0&&exactTokens===0&&prefixTokens===0){
    if(qt.length!==1)return null;
  }

  return {q,name,brand,qt,nt,exactPhrase,starts,wordStarts,containsPhrase,exactTokens,typoTokens,prefixTokens};
}

function kScore(item,query){
  const info=kCandidateInfo(item,query);
  if(!info)return -Infinity;
  const {q,name,brand,qt,nt,exactPhrase,starts,wordStarts,containsPhrase,exactTokens,typoTokens,prefixTokens}=info;
  const intent=kIntent(q);
  let score=0;

  // Primary text relevance. Large gaps are intentional.
  if(exactPhrase)score+=100000;
  else if(wordStarts)score+=85000;
  else if(starts)score+=80000;
  else if(name.includes(' '+q))score+=68000;
  else if(containsPhrase)score+=56000;

  score+=exactTokens*9000;
  score+=prefixTokens*5000;
  score-=typoTokens*3500;

  // Multi-token coverage and order.
  if(qt.length>1){
    const matched=exactTokens+prefixTokens+typoTokens;
    score+=matched/qt.length*12000;
    if(exactTokens===qt.length)score+=7000;
    if(name.includes(q))score+=6000;
  }

  // Brand is useful for product searches, but must never overpower a name match.
  if(brand){
    if(brand===q)score+=4500;
    else if(brand.startsWith(q))score+=2200;
    else if(brand.includes(q))score+=900;
  }

  // Intent-aware tie breakers.
  if(intent==='food'){
    if(item.source==='livsmedelsverket'||item.source==='livs'||item.source==='life')score+=1200;
    if(item.verified)score+=600;
  }else if(intent==='product'){
    if(item.source==='openfoodfacts')score+=1800;
    if(brand)score+=300;
  }else if(intent==='recipe'){
    if(item.source==='recipe'||item.source==='ai')score+=1000;
  }

  // Prefer concise names for broad food searches. Don't punish products with brands.
  if(intent==='food')score-=Math.max(0,nt.length-qt.length)*80;

  // Explicit recipe-ish names should not dominate a one-word basic food search.
  if(qt.length===1&&intent==='food'&&/\b(hemgjord|hemlagad|recept|gryta|sås|sauce|pannkaka|pizza|gratäng|soppa|dessert|smoothie)\b/i.test(name))score-=5000;

  return score;
}

function kDedup(items){
  const groups=new Map();
  for(const x of items){
    if(!x?.name)continue;
    const key=`${kNorm(x.name)}|${kNorm(x.brand||'')}`;
    const old=groups.get(key);
    if(!old||x.__score>old.__score)groups.set(key,x);
  }
  return [...groups.values()];
}

async function kFetch(path,q){
  const key=path+'|'+kNorm(q);
  if(K_SEARCH_CACHE.has(key))return K_SEARCH_CACHE.get(key);
  try{
    const r=await fetch(`${path}?q=${encodeURIComponent(q)}`);
    if(!r.ok)return[];
    const d=await r.json();
    const rows=Array.isArray(d)?d:[];
    K_SEARCH_CACHE.set(key,rows);
    if(K_SEARCH_CACHE.size>160)K_SEARCH_CACHE.delete(K_SEARCH_CACHE.keys().next().value);
    return rows;
  }catch{return[]}
}

function kAI(query){
  const n=kNorm(query);
  const found=K_AI.find(x=>x.keys.some(k=>kNorm(k)===n));
  if(!found)return null;
  return {id:'ai:'+kCompact(found.name),source:'ai',name:found.name,kcal:found.kcal,protein:found.protein,carbs:found.carbs,fat:found.fat};
}
function kSource(x){return x.source==='ai'?'AI':x.source==='openfoodfacts'?'OFF':'LIVS'}
function kEsc(v){return String(v??'').replace(/[&<>\'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

function kRender(items){
  const r=document.querySelector('#results');
  if(!items.length){r.innerHTML='<div class="empty">Inga relevanta resultat hittades.</div>';return}
  const ai=items.filter(x=>x.source==='ai');
  const db=items.filter(x=>x.source!=='ai');
  const button=x=>`<button type="button" class="result" data-kid="${kEsc(x.__kid)}"><div class="result-top"><strong>${kEsc(x.name)}</strong><span class="source-badge source-${kSource(x).toLowerCase()}">${kSource(x)}</span></div><small>${x.brand?kEsc(x.brand)+' · ':''}${Math.round(Number(x.kcal)||0)} kcal · ${Number(x.protein||0).toFixed(1)} g protein / 100 g${x.source==='ai'?' · AI-estimat':x.source==='openfoodfacts'?' · Produkt':''}</small></button>`;
  let html='';
  if(ai.length)html+='<div class="search-group-title">🧠 AI-förslag</div>'+ai.slice(0,1).map(button).join('');
  if(db.length)html+='<div class="search-group-title">Livsmedel & produkter</div>'+db.map(button).join('');
  r.innerHTML=html;
  r.querySelectorAll('.result').forEach(b=>b.onclick=()=>kSelect(items.find(y=>y.__kid===b.dataset.kid)));
}

function kSelect(food){
  if(!food)return;
  kSelected=food;
  document.querySelector('#amountArea').hidden=false;
  document.querySelector('#selectedFood').innerHTML=`<strong>${kEsc(food.name)}</strong><small>${Number(food.kcal||0).toFixed(1)} kcal per 100 g${food.brand?' · '+kEsc(food.brand):''}<br>${kSource(food)}${food.source==='ai'?' · uppskattat värde':''}</small>`;
  const a=document.querySelector('#amount');a.focus();a.select();
}

async function kSearch(raw){
  const q=String(raw||'').replace(/\s+/g,' ').trim();
  const seq=++K_SEARCH_SEQ;
  if(q.length<2){
    document.querySelector('#searchHint').textContent='Skriv vad du åt – vi söker smartare.';
    kRender([]);return;
  }
  document.querySelector('#searchHint').textContent='Söker…';

  const normalized=kNorm(q);
  const alias=K_ALIASES[normalized];
  const variants=[q];
  if(alias&&kNorm(alias)!==normalized)variants.push(alias);

  // For compound searches, also retrieve each token. This gives the ranker
  // a broader candidate pool while the hard gate still requires every token.
  const qt=kTokens(q);
  if(qt.length>1){
    for(const token of qt)if(token.length>=3)variants.push(token);
  }

  const unique=[...new Set(variants.map(v=>String(v).trim()).filter(Boolean))];
  const batches=await Promise.all(unique.map(v=>Promise.all([
    kFetch('/api/foods',v),
    kFetch('/api/products',v)
  ])));
  if(seq!==K_SEARCH_SEQ)return;

  const candidates=[];
  for(const batch of batches)for(const rows of batch)for(const row of rows)candidates.push(row);
  const base=kDedup(candidates.map((x,i)=>({...x,__sourceIndex:i})));

  const ranked=[];
  for(let i=0;i<base.length;i++){
    const x=base[i];
    const score=kScore(x,q);
    if(!Number.isFinite(score))continue;
    ranked.push({...x,__score:score,__i:i,__kid:`${i}|${x.source||''}|${kNorm(x.name)}|${kNorm(x.brand||'')}`});
  }

  ranked.sort((a,b)=>{
    if(b.__score!==a.__score)return b.__score-a.__score;
    // Stable deterministic tie breakers.
    const an=kNorm(a.name),bn=kNorm(b.name);
    if(an.length!==bn.length)return an.length-bn.length;
    return a.__i-b.__i;
  });

  const ai=kAI(q);
  const final=[];
  if(ai)final.push({...ai,__kid:'ai|'+kCompact(ai.name)});
  final.push(...ranked.slice(0,100));
  kRender(final);
  document.querySelector('#searchHint').textContent=ai?`🧠 AI-förslag · ${ranked.length} relevanta träffar`:`${ranked.length} relevanta träffar`;
}

// Capture-phase listeners deliberately take control of the old search handlers
// in app.js, so only this search engine handles typing, quick searches and save.
const kInput=document.querySelector('#foodSearch');
if(kInput)kInput.addEventListener('input',e=>{
  e.stopImmediatePropagation();
  const q=e.target.value;
  document.querySelector('#clearSearch').hidden=!q;
  clearTimeout(window.__kalorierSearchTimerV9);
  window.__kalorierSearchTimerV9=setTimeout(()=>kSearch(q),140);
},true);

const clear=document.querySelector('#clearSearch');
if(clear)clear.addEventListener('click',e=>{
  e.stopImmediatePropagation();
  kInput.value='';clear.hidden=true;kSearch('');kInput.focus();
},true);

const add=document.querySelector('#addFood');
if(add)add.addEventListener('click',e=>{
  e.stopImmediatePropagation();
  const v=document.querySelector('#searchView');
  v.classList.add('open');v.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
  document.querySelector('#amountArea').hidden=true;kSelected=null;
  kRender([]);document.querySelector('#searchHint').textContent='Skriv vad du åt – vi söker smartare.';
  requestAnimationFrame(()=>kInput.focus());
},true);

for(const b of document.querySelectorAll('.quick button'))b.addEventListener('click',e=>{
  e.stopImmediatePropagation();
  const v=document.querySelector('#searchView');
  v.classList.add('open');v.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
  document.querySelector('#amountArea').hidden=true;kSelected=null;kInput.value=b.dataset.q||'';document.querySelector('#clearSearch').hidden=!kInput.value;
  requestAnimationFrame(()=>kSearch(kInput.value));
},true);

const save=document.querySelector('#saveFood');
if(save)save.addEventListener('click',async e=>{
  if(!kSelected)return;
  e.stopImmediatePropagation();
  const grams=Number(document.querySelector('#amount').value);
  if(!(grams>0))return;
  const f=grams/100;
  const months=['januari','februari','mars','april','maj','juni','juli','augusti','september','oktober','november','december'];
  const label=document.querySelector('#dateLabel').textContent.toLocaleLowerCase('sv-SE');
  const sub=document.querySelector('#dateSubLabel').textContent.trim();
  const m=months.findIndex(x=>label.includes(x));
  const dm=label.match(/(\d{1,2})/);
  const y=sub==='Idag'?new Date().getFullYear():Number(sub);
  const date=m>=0&&dm&&y?`${y}-${String(m+1).padStart(2,'0')}-${String(Number(dm[1])).padStart(2,'0')}`:new Date().toISOString().slice(0,10);
  const body={date,time:new Date().toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'}),name:kSelected.name,source:kSelected.source||'livsmedelsverket',product_id:kSelected.id||null,barcode:kSelected.barcode||null,grams,kcal:(kSelected.kcal||0)*f,protein:(kSelected.protein||0)*f,carbs:(kSelected.carbs||0)*f,fat:(kSelected.fat||0)*f};
  try{
    const r=await fetch('/api/diary',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(r.ok){document.querySelector('#closeSearch').click();location.reload();}
    else alert('Kunde inte spara maten.');
  }catch{alert('Kunde inte spara maten.');}
},true);
