/* Kalorier — search v8
   Conservative relevance ranking inspired by OpenNutriTracker.
   Exact/prefix/token relevance wins; fuzzy only fixes obvious typos.
*/
const K_SEARCH_CACHE=new Map();
let K_SEARCH_SEQ=0;
const K_AI=[
 {keys:['ägg','agg','kokt ägg','kokt agg','hårdkokt ägg','hardkokt agg'],name:'Kokt ägg',kcal:155,protein:12.6,carbs:1.1,fat:10.6},
 {keys:['stekt ägg','stekt agg'],name:'Stekt ägg',kcal:196,protein:13.6,carbs:.8,fat:14.8},
 {keys:['banan'],name:'Banan',kcal:89,protein:1.1,carbs:22.8,fat:.3},
 {keys:['ris','kokt ris','jasminris','basmatiris'],name:'Kokt ris',kcal:130,protein:2.7,carbs:28.2,fat:.3},
 {keys:['potatis','kokt potatis'],name:'Kokt potatis',kcal:87,protein:1.9,carbs:20.1,fat:.1},
 {keys:['kyckling','kycklingfilé','kycklingfile','kycklingbröst','kycklingbrost'],name:'Kycklingfilé, tillagad',kcal:165,protein:31,carbs:0,fat:3.6},
 {keys:['havregryn'],name:'Havregrynsgröt med vatten',kcal:68,protein:2.4,carbs:11.7,fat:1.4}
];
function kNorm(v){return String(v??'').toLocaleLowerCase('sv-SE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim()}
function kTokens(v){return kNorm(v).split(' ').filter(Boolean)}
function kDice(a,b){const A=new Set(a),B=new Set(b);if(!A.size||!B.size)return 0;let h=0;for(const x of A)if(B.has(x))h++;return 2*h/(A.size+B.size)}
function kLev(a,b){if(a===b)return 0;if(!a||!b)return Math.max(a.length,b.length);const r=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let p=r[0];r[0]=i;for(let j=1;j<=b.length;j++){const o=r[j];r[j]=Math.min(r[j]+1,r[j-1]+1,p+(a[i-1]===b[j-1]?0:1));p=o}}return r[b.length]}
function kTypoClose(q,n){if(q.length<4||n.length<4)return false;const d=kLev(q,n);return d<=1||(q.length>=7&&d<=2)}
function kScore(item,query){
 const q=kNorm(query),name=kNorm(item.name),brand=kNorm(item.brand);if(!q||!name)return-Infinity;
 const qt=kTokens(q),nt=kTokens(name);let score=0;
 if(name===q)score+=10000;else if(name.startsWith(q+' '))score+=7600;else if(name.startsWith(q))score+=7000;else if(name.includes(' '+q))score+=5400;else if(name.includes(q))score+=3200;
 if(brand===q)score+=1800;else if(brand.startsWith(q))score+=900;else if(brand.includes(q))score+=350;
 let matched=0,fuzzy=0;
 for(const token of qt){let best=0,exact=false,prefix=false,close=false;for(const n of nt){if(n===token){best=1;exact=true;break}if(n.startsWith(token)||(token.length>=4&&token.startsWith(n))){best=Math.max(best,.92);prefix=true;continue}if(kTypoClose(token,n)){best=Math.max(best,.78);close=true}}if(best<.78)return-Infinity;matched++;if(close&&!exact&&!prefix)fuzzy++;score+=exact?2600:prefix?1700:800}
 if(matched!==qt.length)return-Infinity;
 if(qt.length>1){const overlap=kDice(qt,nt);if(overlap<.5)return-Infinity;score+=overlap*900}
 if(qt.length===1&&qt[0].length<=3){const t=qt[0],strong=nt.some(n=>n===t||n.startsWith(t));if(!strong)return-Infinity}
 if(qt.length===1&&/\b(hemgjord|hemlagad|recept|gryta|sås|sauce|pannkaka|pizza|gratäng|soppa|dessert|smoothie)\b/i.test(name)&&!name.startsWith(q))score-=1200;
 if(item.verified)score+=90;if(item.source==='openfoodfacts'&&brand)score+=20;score-=Math.max(0,nt.length-qt.length)*18;score-=fuzzy*140;return score
}
function kDedup(items){const seen=new Set(),out=[];for(const x of items){if(!x||!x.name)continue;const key=`${x.source||''}|${kNorm(x.name)}|${kNorm(x.brand||'')}`;if(seen.has(key))continue;seen.add(key);out.push(x)}return out}
async function kFetch(path,q){const key=path+'|'+q;if(K_SEARCH_CACHE.has(key))return K_SEARCH_CACHE.get(key);try{const r=await fetch(`${path}?q=${encodeURIComponent(q)}`);if(!r.ok)return[];const d=await r.json(),rows=Array.isArray(d)?d:[];K_SEARCH_CACHE.set(key,rows);if(K_SEARCH_CACHE.size>120)K_SEARCH_CACHE.delete(K_SEARCH_CACHE.keys().next().value);return rows}catch{return[]}}
function kAI(q){const n=kNorm(q),f=K_AI.find(x=>x.keys.some(k=>kNorm(k)===n));return f?{id:'ai:'+kNorm(f.name).replace(/ /g,'-'),source:'ai',name:f.name,kcal:f.kcal,protein:f.protein,carbs:f.carbs,fat:f.fat}:null}
function kSource(x){return x.source==='ai'?'AI':x.source==='openfoodfacts'?'OFF':'LIVS'}
function kEsc(v){return String(v??'').replace(/[&<>\'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
let kSelected=null;
function kOpen(q=''){const v=document.querySelector('#searchView');v.classList.add('open');v.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';document.querySelector('#amountArea').hidden=true;kSelected=null;const i=document.querySelector('#foodSearch');i.value=q;i.focus();document.querySelector('#clearSearch').hidden=!q;document.querySelector('#searchHint').textContent=q?'Söker…':'Skriv vad du åt – vi söker smartare.';if(q)kSearch(q);else document.querySelector('#results').innerHTML='<div class="empty">Skriv vad du åt.</div>'}
function kRender(items){const r=document.querySelector('#results');if(!items.length){r.innerHTML='<div class="empty">Inga relevanta resultat hittades.</div>';return}const ai=items.filter(x=>x.source==='ai'),db=items.filter(x=>x.source!=='ai');const b=x=>`<button type="button" class="result" data-kid="${kEsc(x.__kid)}"><div class="result-top"><strong>${kEsc(x.name)}</strong><span class="source-badge source-${kSource(x).toLowerCase()}">${kSource(x)}</span></div><small>${x.brand?kEsc(x.brand)+' · ':''}${Math.round(Number(x.kcal)||0)} kcal · ${Number(x.protein||0).toFixed(1)} g protein / 100 g${x.source==='ai'?' · AI-estimat':x.source==='openfoodfacts'?' · Produkt':''}</small></button>`;let h='';if(ai.length)h+='<div class="search-group-title">🧠 AI-förslag</div>'+ai.slice(0,1).map(b).join('');if(db.length)h+='<div class="search-group-title">Livsmedel & produkter</div>'+db.map(b).join('');r.innerHTML=h;r.querySelectorAll('.result').forEach(x=>x.onclick=()=>kSelect(items.find(y=>y.__kid===x.dataset.kid)))}
function kSelect(food){if(!food)return;kSelected=food;document.querySelector('#amountArea').hidden=false;document.querySelector('#selectedFood').innerHTML=`<strong>${kEsc(food.name)}</strong><small>${Number(food.kcal||0).toFixed(1)} kcal per 100 g${food.brand?' · '+kEsc(food.brand):''}<br>${kSource(food)}${food.source==='ai'?' · uppskattat värde':''}</small>`;const a=document.querySelector('#amount');a.focus();a.select()}
async function kSearch(raw){const q=String(raw||'').replace(/\s+/g,' ').trim(),seq=++K_SEARCH_SEQ;if(q.length<2){document.querySelector('#searchHint').textContent='Skriv vad du åt – vi söker smartare.';kRender([]);return}document.querySelector('#searchHint').textContent='Söker…';const variants=[q],n=kNorm(q),alias={agg:'ägg',mjolk:'mjölk',brod:'bröd',smor:'smör',kottfars:'köttfärs',notfars:'nötfärs',kycklingfile:'kycklingfilé',avocado:'avokado'};if(alias[n])variants.push(alias[n]);const batches=await Promise.all(variants.map(v=>Promise.all([kFetch('/api/foods',v),kFetch('/api/products',v)])));if(seq!==K_SEARCH_SEQ)return;const all=kDedup(batches.flat(2));const ranked=all.map((x,i)=>({...x,__score:kScore(x,q),__i:i,__kid:`${i}|${x.source||''}|${kNorm(x.name)}|${kNorm(x.brand||'')}`})).filter(x=>Number.isFinite(x.__score)).sort((a,b)=>b.__score-a.__score||a.__i-b.__i);const ai=kAI(q),final=[];if(ai)final.push({...ai,__kid:'ai|'+kNorm(ai.name)});final.push(...ranked.slice(0,100));kRender(final);document.querySelector('#searchHint').textContent=ai?`🧠 AI-förslag · ${ranked.length} livsmedel`:`${ranked.length} relevanta träffar`}
const kInput=document.querySelector('#foodSearch');
if(kInput)kInput.addEventListener('input',e=>{e.stopImmediatePropagation();const q=e.target.value;document.querySelector('#clearSearch').hidden=!q;clearTimeout(window.__kalorierSearchTimerV8);window.__kalorierSearchTimerV8=setTimeout(()=>kSearch(q),140)},true);
const add=document.querySelector('#addFood');if(add)add.addEventListener('click',e=>{e.stopImmediatePropagation();kOpen()},true);
for(const b of document.querySelectorAll('.quick button'))b.addEventListener('click',e=>{e.stopImmediatePropagation();kOpen(b.dataset.q||'')},true);
const save=document.querySelector('#saveFood');if(save)save.addEventListener('click',async e=>{if(!kSelected)return;e.stopImmediatePropagation();const grams=Number(document.querySelector('#amount').value);if(!(grams>0))return;const f=grams/100;const months=['januari','februari','mars','april','maj','juni','juli','augusti','september','oktober','november','december'];const label=document.querySelector('#dateLabel').textContent.toLocaleLowerCase('sv-SE');const sub=document.querySelector('#dateSubLabel').textContent.trim();const m=months.findIndex(x=>label.includes(x));const dm=label.match(/(\d{1,2})/);const y=sub==='Idag'?new Date().getFullYear():Number(sub);const date=m>=0&&dm&&y?`${y}-${String(m+1).padStart(2,'0')}-${String(Number(dm[1])).padStart(2,'0')}`:new Date().toISOString().slice(0,10);const body={date,time:new Date().toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'}),name:kSelected.name,source:kSelected.source||'livsmedelsverket',product_id:kSelected.id||null,barcode:kSelected.barcode||null,grams,kcal:(kSelected.kcal||0)*f,protein:(kSelected.protein||0)*f,carbs:(kSelected.carbs||0)*f,fat:(kSelected.fat||0)*f};try{const r=await fetch('/api/diary',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,date})});if(r.ok){document.querySelector('#closeSearch').click();location.reload()}else alert('Kunde inte spara maten.')}catch{alert('Kunde inte spara maten.')}},true);
