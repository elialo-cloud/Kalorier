```js
let log=[],selected=null,searchTimer=null,scanner=null,cameraStream=null,currentDate=localDate(),calendarCursor=new Date();
const $=s=>document.querySelector(s),searchView=$('#searchView'),calendarView=$('#calendarView'),scannerView=$('#scannerView');
const defaultGoals={kcal:2200,protein:160,carbs:220,fat:70,goal:'maintain'};
let goals={...defaultGoals,...JSON.parse(localStorage.getItem('kalorier-goals')||'{}')};

function localDate(d=new Date()){
  const x=new Date(d.getTime()-d.getTimezoneOffset()*60000);
  return x.toISOString().slice(0,10)
}

function dateObj(s){
  const [y,m,d]=s.split('-').map(Number);
  return new Date(y,m-1,d)
}

function fmt(n){
  return new Intl.NumberFormat('sv-SE',{maximumFractionDigits:0})
    .format(Math.round(Number(n)||0))
}

function fmt1(n){
  return new Intl.NumberFormat('sv-SE',{maximumFractionDigits:1})
    .format(Number(n)||0)
}

function esc(v){
  return String(v??'').replace(/[&<>\'\"]/g,c=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    "'":'&#39;',
    '\"':'&quot;'
  }[c]))
}

function saveGoals(){
  localStorage.setItem('kalorier-goals',JSON.stringify(goals))
}

function ensureUI(){
  const badge=document.querySelector('.eyebrow b');

  if(badge)
    badge.textContent='V5.2';

  document.title='Kalorier V5.2';

  const header=document.querySelector('.topbar');

  if(header&&!$('#openSettings')){
    const wrap=document.createElement('div');

    wrap.className='top-actions';

    wrap.innerHTML='<button class="ghost" id="todayTop">Idag</button><button class="icon" id="openSettings" aria-label="Inställningar">⚙</button>';

    header.lastElementChild.replaceWith(wrap)
  }

  if(!$('#suggestions')){
    const s=document.createElement('section');

    s.id='suggestions';
    s.className='suggestions';

    s.innerHTML='<div class="section-head"><h2>För att nå ditt mål</h2><span id="suggestionMeta"></span></div><div id="suggestionList" class="suggestion-list"></div>';

    document.querySelector('.food-section')?.before(s)
  }

  if(!$('#settingsView')){
    const s=document.createElement('div');

    s.id='settingsView';
    s.className='sheet';

    s.innerHTML='<div class="sheet-head"><button id="closeSettings" class="back">‹</button><div><div class="eyebrow">PERSONLIGT MÅL</div><h2>Dina mål</h2></div></div><div class="settings-body"><div class="goal-pills" id="goalPills"><button data-goal="lose">Gå ner</button><button data-goal="maintain">Behålla</button><button data-goal="gain">Gå upp</button></div><div class="settings-card"><label>Kalorier per dag<input id="targetKcal" type="number" min="800" max="10000" step="10" inputmode="numeric"></label><div class="setting-grid"><label>Protein (g)<input id="targetProtein" type="number" min="0" max="500" inputmode="numeric"></label><label>Kolhydrater (g)<input id="targetCarbs" type="number" min="0" max="1000" inputmode="numeric"></label><label>Fett (g)<input id="targetFat" type="number" min="0" max="300" inputmode="numeric"></label></div></div><p class="settings-note">Du bestämmer själv målen. De används för progress och förslag.</p><button class="primary" id="saveSettings">Spara mål</button></div>';

    document.body.appendChild(s)
  }
}

function renderDate(){
  const d=dateObj(currentDate),today=localDate();

  $('#dateLabel').textContent=
    d.toLocaleDateString('sv-SE',{
      weekday:'long',
      day:'numeric',
      month:'long'
    });

  $('#dateSubLabel').textContent=
    currentDate===today?'Idag':d.getFullYear();

  if($('#todayTop'))
    $('#todayTop').hidden=currentDate===today
}

function renderSuggestions(t){
  const list=$('#suggestionList');

  if(!list)return;

  const missing={
    protein:Math.max(0,goals.protein-t.protein),
    carbs:Math.max(0,goals.carbs-t.carbs),
    fat:Math.max(0,goals.fat-t.fat),
    kcal:Math.max(0,goals.kcal-t.kcal)
  };

  const picks=[];

  if(missing.protein>20)
    picks.push(['🥣','Kvarg / skyr','proteinrikt och enkelt']);

  if(missing.protein>20&&missing.fat<25)
    picks.push(['🍗','Kyckling + ris','mycket protein, lätt att portionera']);

  if(missing.carbs>35)
    picks.push(['🍚','Ris eller potatis','enkelt sätt att fylla på kolhydrater']);

  if(missing.fat>15)
    picks.push(['🥑','Avokado eller nötter','bra sätt att få upp fett']);

  if(!picks.length)
    picks.push(['✨','Du ligger bra till','fortsätt efter dina mål']);

  $('#suggestionMeta').textContent=
    missing.kcal>0
      ?`${fmt(missing.kcal)} kcal kvar`
      :'mål nått';

  list.innerHTML=
    picks.slice(0,3)
      .map(x=>`<div class="suggestion"><span>${x[0]}</span><div><strong>${x[1]}</strong><small>${x[2]}</small></div></div>`)
      .join('')
}

function render(){
  renderDate();

  const t=log.reduce((a,x)=>{
    a.kcal+=+x.kcal||0;
    a.protein+=+x.protein||0;
    a.carbs+=+x.carbs||0;
    a.fat+=+x.fat||0;

    return a
  },{
    kcal:0,
    protein:0,
    carbs:0,
    fat:0
  });

  $('#calories').textContent=fmt(t.kcal);

  $('#remaining').textContent=
    `${fmt(Math.max(0,goals.kcal-t.kcal))} kcal`;

  $('[id="goalLabel"]').textContent=
    `mål ${fmt(goals.kcal)} kcal`;

  $('#mealCount').textContent=
    `${fmt(t.kcal)} kcal`;

  [['protein',goals.protein],['carbs',goals.carbs],['fat',goals.fat]]
    .forEach(([k,g])=>{
      $(`#${k}`).textContent=
        `${fmt1(t[k])} / ${g} g`;

      $(`#${k}Bar`).style.width=
        Math.min(100,t[k]/g*100)+'%'
    });

  const deg=
    Math.min(360,t.kcal/goals.kcal*360);

  $('#calorieRing').style.background=
    `conic-gradient(#181818 ${deg}deg,#e8e8e4 ${deg}deg)`;

  $('#foodList').innerHTML=
    log.length
      ?log.map(x=>`<div class="food"><div><strong>${esc(x.name)}</strong><small>${fmt1(x.grams)} g · ${fmt(x.kcal)} kcal · ${fmt1(x.protein)} g protein</small></div><div class="food-actions"><button class="edit-food" data-id="${x.id}">✎</button><button class="delete-food" data-id="${x.id}">×</button></div></div>`).join('')
      :'<div class="empty">Inget registrerat ännu.</div>';

  document.querySelectorAll('.delete-food')
    .forEach(b=>b.onclick=()=>deleteEntry(b.dataset.id));

  document.querySelectorAll('.edit-food')
    .forEach(b=>b.onclick=()=>editEntry(b.dataset.id));

  renderSuggestions(t)
}

async function loadDay(){
  try{
    const r=await fetch(`/api/diary?date=${currentDate}`);

    if(!r.ok)throw 0;

    log=await r.json()
  }catch(e){
    log=[]
  }

  render()
}

async function deleteEntry(id){
  if(!confirm('Ta bort den här posten?'))return;

  const r=await fetch(
    `/api/diary?id=${encodeURIComponent(id)}`,
    {method:'DELETE'}
  );

  if(r.ok)
    loadDay()
}

async function editEntry(id){
  const x=log.find(v=>String(v.id)===String(id));

  if(!x)return;

  const g=Number(
    prompt(`Ändra mängd för ${x.name}`,x.grams)
  );

  if(!Number.isFinite(g)||g<=0)return;

  const f=g/(+x.grams||1);

  const body={
    ...x,
    grams:g,
    kcal:x.kcal*f,
    protein:x.protein*f,
    carbs:x.carbs*f,
    fat:x.fat*f
  };

  const r=await fetch(
    `/api/diary?id=${encodeURIComponent(id)}`,
    {
      method:'PUT',
      headers:{
        'Content-Type':'application/json'
      },
      body:JSON.stringify(body)
    }
  );

  if(r.ok)
    loadDay()
}

function shiftDay(n){
  const d=dateObj(currentDate);

  d.setDate(d.getDate()+n);

  currentDate=localDate(d);

  loadDay()
}

function openSheet(v){
  v.classList.add('open');
  v.setAttribute('aria-hidden','false');
  document.body.style.overflow='hidden'
}

function closeSheet(v){
  v.classList.remove('open');
  v.setAttribute('aria-hidden','true');
  document.body.style.overflow=''
}

function openSearch(q=''){
  openSheet(searchView);

  $('#foodSearch').value=q;
  $('#amountArea').hidden=true;

  selected=null;

  renderResults([]);

  $('#searchHint').textContent=
    q
      ?'Söker…'
      :'Skriv vad du åt – vi söker överallt.';

  requestAnimationFrame(()=>{
    $('#foodSearch').focus();

    if(q)
      searchAll(q)
  })
}

function closeSearch(){
  closeSheet(searchView);
  selected=null
}

function sourceLabel(food){
  if(food.source==='openfoodfacts')
    return 'OFF';

  if(food.source==='ai')
    return 'AI';

  return 'LIVS'
}

function selectFood(food){
  selected=food;

  $('#amountArea').hidden=false;

  $('#selectedFood').innerHTML=
    `<strong>${esc(food.name)}</strong><small>${fmt1(food.kcal)} kcal per 100 g${food.brand?' · '+esc(food.brand):''}<br>${sourceLabel(food)}${food.source==='ai'?' · uppskattat värde':''}</small>`;

  requestAnimationFrame(()=>{
    $('#amount').focus();
    $('#amount').select()
  })
}

function renderResults(items){
  const r=$('#results');

  r.innerHTML=
    items.length
      ?items.map((f,i)=>{
        const label=sourceLabel(f);

        return `<button type="button" class="result" data-i="${i}"><div class="result-top"><strong>${esc(f.name)}</strong><span class="source-badge source-${String(f.source||'livsmedelsverket').replace(/[^a-z]/gi,'')}">${label}</span></div><small>${f.brand?esc(f.brand)+' · ':''}${fmt(f.kcal)} kcal · ${fmt1(f.protein)} g protein / 100 g${f.source==='ai'?' · AI-estimat':f.source==='openfoodfacts'?' · Produkt':''}</small></button>`
      }).join('')
      :'<div class="empty">Inga relevanta resultat hittades.</div>';

  r.querySelectorAll('.result')
    .forEach(b=>
      b.onclick=()=>selectFood(items[+b.dataset.i])
    )
}


/* =========================================================
   SÖKMOTOR V6
   Lifesum-liknande ranking + fuzzy search + AI
========================================================= */

const SEARCH_CACHE=new Map();
const SEARCH_ALIASES=[
  ['ägg',['agg','ägg','honsagg','hönsägg','kokt ägg','kokt agg','stekt ägg','stekt agg','hårdkokt ägg','hardkokt agg']],
  ['grädde',['gradd','grädde','vispgrädde','vispgradd','matgrädde','matgradd']],
  ['mjölk',['mjolk','mjölk','standardmjölk','standardmjolk','mellanmjölk','mellanmjolk','lättmjölk','lattmjolk']],
  ['kyckling',['kyckling','kycklingfilé','kycklingfile','kycklingbröst','kycklingbrost','kycklinglår','kycklinglar']],
  ['ris',['ris','kokt ris','ris kokt','jasminris','basmatiris']],
  ['potatis',['potatis','kokt potatis','potatis kokt','potatisplätt','potatisplatt','raggmunk']],
  ['bröd',['bröd','brod','franska','limpa','fullkornsbröd','fullkornsbrod','knäckebröd','knackebrod']],
  ['köttfärs',['köttfärs','kottfars','nötfärs','notfars','nötköttfärs','notkottfars']],
  ['yoghurt',['yoghurt','grekisk yoghurt','turkisk yoghurt']],
  ['kvarg',['kvarg','skyr','proteinpudding']],
  ['coca cola zero',['coca cola zero','coca-cola zero','cola zero','coke zero','coke zero sugar']],
  ['coca cola',['coca cola','coca-cola','cola','coke']],
  ['banan',['banan','banana']],
  ['äpple',['äpple','apple']],
  ['havregryn',['havregryn','havregrynsgröt','havregryns grot']],
  ['pasta',['pasta','makaroner','spaghetti','spagetti','penne']],
  ['tonfisk',['tonfisk','tuna']],
  ['lax',['lax','salmon']],
  ['avokado',['avokado','avocado']],
  ['ost',['ost','cheese']],
  ['smör',['smör','smor','butter']],
  ['olja',['olja','olivolja','rapsolja']],
  ['nötter',['nötter','notter','mandel','cashew','cashewnötter','jordnötter']],
  ['proteinpulver',['proteinpulver','whey','whey protein','protein powder']]
];

function norm(s){
  return String(s||'')
    .toLocaleLowerCase('sv-SE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/gi,' ')
    .replace(/\s+/g,' ')
    .trim()
}

function tokens(s){
  return norm(s).split(' ').filter(Boolean)
}

function levenshtein(a,b){
  if(a===b)return 0;

  if(!a||!b)
    return Math.max(a.length,b.length);

  const prev=Array.from(
    {length:b.length+1},
    (_,i)=>i
  );

  for(let i=1;i<=a.length;i++){
    const cur=[i];

    for(let j=1;j<=b.length;j++){
      cur[j]=Math.min(
        cur[j-1]+1,
        prev[j]+1,
        prev[j-1]+(a[i-1]===b[j-1]?0:1)
      )
    }

    for(let j=0;j<cur.length;j++)
      prev[j]=cur[j]
  }

  return prev[b.length]
}

function similarity(a,b){
  a=norm(a);
  b=norm(b);

  if(!a||!b)return 0;
  if(a===b)return 1;

  if(a.includes(b)||b.includes(a)){
    return Math.min(a.length,b.length)/
      Math.max(a.length,b.length)
  }

  const d=levenshtein(a,b);

  return Math.max(
    0,
    1-d/Math.max(a.length,b.length)
  )
}

function aliasTerms(q){
  const n=norm(q);
  const out=new Set([n]);

  for(const [canonical,aliases] of SEARCH_ALIASES){
    const all=[
      canonical,
      ...aliases
    ].map(norm);

    const related=all.some(x=>
      x===n||
      x.includes(n)||
      n.includes(x)
    );

    if(related){
      all.forEach(x=>out.add(x));
    }
  }

  return [...out]
}

function searchVariants(q){
  const n=norm(q);
  const out=new Set([n]);

  aliasTerms(n).forEach(x=>out.add(x));

  return [...out]
}


/* ---------------------------------------------------------
   Lokal AI-motor
--------------------------------------------------------- */

const AI_FOODS=[
  {
    match:['kokt ägg','kokt agg','hårdkokt ägg','hardkokt agg','ägg'],
    name:'Kokt ägg',
    kcal:155,
    protein:12.6,
    carbs:1.1,
    fat:10.6
  },
  {
    match:['stekt ägg','stekt agg'],
    name:'Stekt ägg',
    kcal:196,
    protein:13.6,
    carbs:.8,
    fat:14.8
  },
  {
    match:['kyckling','kycklingfilé','kycklingfile','kycklingbröst','kycklingbrost'],
    name:'Kycklingfilé, tillagad',
    kcal:165,
    protein:31,
    carbs:0,
    fat:3.6
  },
  {
    match:['kokt ris','ris','jasminris','basmatiris'],
    name:'Kokt ris',
    kcal:130,
    protein:2.7,
    carbs:28.2,
    fat:.3
  },
  {
    match:['kokt potatis','potatis'],
    name:'Kokt potatis',
    kcal:87,
    protein:1.9,
    carbs:20.1,
    fat:.1
  },
  {
    match:['havregryn','havregrynsgröt'],
    name:'Havregrynsgröt med vatten',
    kcal:68,
    protein:2.4,
    carbs:11.7,
    fat:1.4
  },
  {
    match:['pannkaka','pannkakor'],
    name:'Pannkaka, klassisk',
    kcal:190,
    protein:6.1,
    carbs:22.7,
    fat:8.7
  },
  {
    match:['tacos','taco','tacofärs','tacofars'],
    name:'Tacos med nötfärs, uppskattat',
    kcal:190,
    protein:12,
    carbs:12,
    fat:10
  },
  {
    match:['kyckling med ris','kyckling ris'],
    name:'Kyckling med ris, uppskattat',
    kcal:150,
    protein:13,
    carbs:18,
    fat:3.5
  },
  {
    match:['proteinshake','protein shake','protein dryck'],
    name:'Proteinshake, uppskattat',
    kcal:120,
    protein:24,
    carbs:4,
    fat:2
  },
  {
    match:['smörgås','macka','smorgas'],
    name:'Smörgås, uppskattat',
    kcal:220,
    protein:8,
    carbs:28,
    fat:8
  }
];

function aiCandidate(q){
  const n=norm(q);

  if(!n)
    return null;

  const qt=tokens(n);

  let best=null;
  let bestScore=0;

  for(const food of AI_FOODS){

    for(const phrase of food.match){

      const p=norm(phrase);
      const pt=tokens(p);

      let score=similarity(n,p)*100;

      let matched=0;

      for(const token of qt){

        const bestTokenScore=
          Math.max(
            ...pt.map(x=>{
              if(x===token)return 1;
              if(x.startsWith(token)||token.startsWith(x))return .9;
              return similarity(token,x)
            })
          );

        if(bestTokenScore>=.72)
          matched++;

        score+=bestTokenScore*25;
      }

      if(qt.length&&matched===qt.length)
        score+=55;

      if(pt.length===qt.length)
        score+=25;

      if(score>bestScore){
        bestScore=score;
        best=food;
      }
    }
  }

  if(!best)
    return null;

  /*
    AI får visas vid ganska breda sökningar,
    men inte vid rena nonsens-sökningar.
  */

  if(
    bestScore<80
  )
    return null;

  return {
    id:`ai:${norm(best.name).replace(/ /g,'-')}`,
    source:'ai',
    verified:0,
    name:best.name,
    kcal:best.kcal,
    protein:best.protein,
    carbs:best.carbs,
    fat:best.fat
  }
}


/* ---------------------------------------------------------
   Databas-ranking
--------------------------------------------------------- */

function tokenScore(queryToken,nameTokens){

  let best=0;

  for(const n of nameTokens){

    if(n===queryToken)
      best=Math.max(best,1);

    else if(
      n.startsWith(queryToken)||
      queryToken.startsWith(n)
    )
      best=Math.max(best,.92);

    else
      best=Math.max(
        best,
        similarity(queryToken,n)
      );
  }

  return best
}

function searchScore(item,q){

  const query=norm(q);
  const name=norm(item.name);
  const brand=norm(item.brand);

  if(!query||!name)
    return -Infinity;

  const qt=tokens(query);
  const nt=tokens(name);
  const bt=tokens(brand);

  let score=0;
  let matched=0;

  /* Exakt namn */

  if(name===query)
    score+=10000;

  /* Namnet börjar med sökningen */

  if(name.startsWith(query))
    score+=4500;

  /* Exakt fras någonstans */

  if(name.includes(` ${query}`))
    score+=3000;

  if(name.includes(query))
    score+=1800;

  /* Varumärke */

  if(brand===query)
    score+=2500;

  if(brand.includes(query))
    score+=900;

  /* Token ranking */

  qt.forEach(token=>{

    const ts=tokenScore(token,nt);

    if(ts>=.72){
      matched++;

      score+=
        ts>=.99
          ?1800
          :ts>=.9
            ?1100
            :500*ts;
    }
  });

  /*
    Alla sökord bör finnas.
    Detta är viktigt för exempelvis:
    "kyckling ris"
    så att "kyckling" ensam inte tar över.
  */

  if(qt.length>1){

    if(matched===qt.length)
      score+=2200;

    else if(matched===qt.length-1)
      score-=500;

    else
      score-=1800;
  }

  /* Position: första orden är viktigare */

  if(qt.length){

    const first=qt[0];
    const pos=nt.indexOf(first);

    if(pos===0)
      score+=800;

    else if(pos>0&&pos<3)
      score+=250;
  }

  /* Kortare, renare namn prioriteras */

  score-=
    Math.max(
      0,
      nt.length-qt.length
    )*35;

  /* Undvik recept / maträtter vid enkel råvara */

  if(
    qt.length===1&&
    /\b(hemgjord|hemlagad|recept|sås|sauce|gryta)\b/.test(name)&&
    !name.startsWith(query)
  ){
    score-=700;
  }

  /* Verified */

  if(item.verified)
    score+=120;

  /* OFF-produkter med varumärke */

  if(
    item.source==='openfoodfacts'&&
    brand
  ){
    score+=50;
  }

  /*
    Svag fuzzy-match ska inte få igenom helt fel saker.
  */

  if(
    matched===0
  )
    return -Infinity;

  return score;
}


/* ---------------------------------------------------------
   API
--------------------------------------------------------- */

async function fetchSearchEndpoint(path,variant){

  const key=`${path}|${variant}`;

  if(SEARCH_CACHE.has(key))
    return SEARCH_CACHE.get(key);

  try{

    const r=await fetch(
      `${path}?q=${encodeURIComponent(variant)}`
    );

    if(!r.ok)
      return [];

    const data=await r.json();

    const result=
      Array.isArray(data)
        ?data
        :[];

    SEARCH_CACHE.set(
      key,
      result
    );

    /*
      Begränsa cacheminnet så det inte växer
      obegränsat under lång användning.
    */

    if(SEARCH_CACHE.size>150)
      SEARCH_CACHE.delete(
        SEARCH_CACHE.keys().next().value
      );

    return result;

  }catch{
    return []
  }
}


/* ---------------------------------------------------------
   Huvudsökning
--------------------------------------------------------- */

async function searchAll(q=''){

  const raw=String(q)
    .replace(/\s+/g,' ')
    .trim();

  if(raw.length<2){

    $('#searchHint').textContent=
      'Skriv vad du åt – vi söker överallt.';

    renderResults([]);

    return;
  }

  const request=Symbol();

  searchAll._request=request;

  $('#searchHint').textContent=
    'Söker…';

  try{

    const vs=searchVariants(raw);

    /*
      Kör Livsmedelsverket + OFF parallellt
      för alla relevanta varianter.
    */

    const batches=
      await Promise.all(
        vs.map(v=>
          Promise.all([
            fetchSearchEndpoint(
              '/api/foods',
              v
            ),
            fetchSearchEndpoint(
              '/api/products',
              v
            )
          ])
        )
      );

    if(
      searchAll._request!==request
    )
      return;

    const all=batches.flat(2);

    /*
      Deduplicering.
    */

    const seen=new Set();

    const unique=
      all
        .filter(x=>
          x&&
          x.name
        )
        .filter(x=>{

          const key=[
            x.source||'',
            x.id||'',
            norm(x.name),
            norm(x.brand||'')
          ].join('|');

          if(seen.has(key))
            return false;

          seen.add(key);

          return true;
        });


    /*
      Ranka mot ORIGINALSÖKNINGEN.
      Alias används för hämtning men originalet
      avgör vad som faktiskt är relevant.
    */

    const ranked=
      unique
        .map((x,i)=>{

          const scores=vs.map(v=>
            searchScore(x,v)
          );

          const originalScore=
            searchScore(x,raw);

          return {
            ...x,
            _score:
              Math.max(
                originalScore,
                ...scores
              ),
            _originalScore:
              originalScore,
            _i:i
          };
        })
        .filter(x=>
          Number.isFinite(x._score)
        )
        .sort((a,b)=>
          b._score-a._score||
          a._i-b._i
        );


    /*
      AI ska inte försvinna bara för att databasen
      råkar returnera NÅGOT.
      
      Endast om databasen har en riktigt stark
      träff använder vi databasen exklusivt.
    */

    const ai=aiCandidate(raw);

    const top=ranked[0];

    const strongDatabaseMatch=
      top&&
      (
        top._originalScore>=
        6500
        ||
        (
          top._score>=9000&&
          similarity(
            norm(raw),
            norm(top.name)
          )>=.65
        )
      );

    let final=[];

    if(
      ai&&
      !strongDatabaseMatch
    ){

      /*
        AI först eftersom det är ett smart
        semantiskt förslag.
      */

      final.push(ai);
    }

    final.push(
      ...ranked
    );

    /*
      Om AI redan finns i databasen:
      visa den inte två gånger.
    */

    const finalSeen=new Set();

    final=final.filter(x=>{

      const key=
        `${x.source}|${norm(x.name)}`;

      if(finalSeen.has(key))
        return false;

      finalSeen.add(key);

      return true;
    });


    /*
      Max 50 resultat.
    */

    final=
      final.slice(0,50);

    renderResults(final);


    /* -----------------------------------------------------
       Statusrad
    ----------------------------------------------------- */

    if(!final.length){

      $('#searchHint').textContent=
        ai
          ?'🧠 AI-förslag hittades inte heller.'
          :'Inga relevanta resultat hittades.';

    }else if(
      ai&&
      !strongDatabaseMatch
    ){

      $('#searchHint').textContent=
        `🧠 AI-förslag · ${ranked.length} databasresultat`;

    }else{

      $('#searchHint').textContent=
        `${ranked.length} relevanta träffar`;
    }

  }catch(e){

    console.error(
      'Search error:',
      e
    );

    if(
      searchAll._request!==request
    )
      return;

    /*
      Även om API:t dör ska AI fortfarande fungera.
    */

    const ai=aiCandidate(raw);

    if(ai){

      renderResults([
        ai
      ]);

      $('#searchHint').textContent=
        '🧠 AI-förslag – databasen kunde inte läsas.';

    }else{

      $('#searchHint').textContent=
        'Kunde inte läsa databaserna.';

      renderResults([]);
    }
  }
}


/* =========================================================
   RESTEN AV APPEN — OFÖRÄNDRAD
========================================================= */

$('#foodSearch').oninput=e=>{
  clearTimeout(searchTimer);

  const q=e.target.value;

  $('#clearSearch').hidden=!q;

  searchTimer=setTimeout(
    ()=>searchAll(q),
    180
  )
};

$('#clearSearch').onclick=()=>{
  $('#foodSearch').value='';
  $('#clearSearch').hidden=true;
  searchAll('');
  $('#foodSearch').focus()
};

$('#addFood').onclick=()=>openSearch();
$('#closeSearch').onclick=closeSearch;

$('#saveFood').onclick=async()=>{

  if(!selected)return;

  const grams=+$('#amount').value;

  if(!(grams>0))return;

  const f=grams/100;

  const body={
    date:currentDate,
    time:new Date().toLocaleTimeString(
      'sv-SE',
      {
        hour:'2-digit',
        minute:'2-digit'
      }
    ),
    name:selected.name,
    source:selected.source||'livsmedelsverket',
    product_id:selected.id||null,
    barcode:selected.barcode||null,
    grams,
    kcal:(selected.kcal||0)*f,
    protein:(selected.protein||0)*f,
    carbs:(selected.carbs||0)*f,
    fat:(selected.fat||0)*f
  };

  const r=await fetch(
    '/api/diary',
    {
      method:'POST',
      headers:{
        'Content-Type':'application/json'
      },
      body:JSON.stringify(body)
    }
  );

  if(r.ok){
    closeSearch();
    await loadDay()
  }else{
    alert('Kunde inte spara maten.')
  }
};

document
  .querySelectorAll('.quick button')
  .forEach(b=>
    b.onclick=()=>openSearch(b.dataset.q)
  );


function openCalendar(){
  calendarCursor=dateObj(currentDate);
  renderCalendar();
  openSheet(calendarView)
}

function closeCalendar(){
  closeSheet(calendarView)
}

function renderCalendar(){

  const y=calendarCursor.getFullYear();
  const m=calendarCursor.getMonth();

  $('#monthTitle').textContent=
    calendarCursor.toLocaleDateString(
      'sv-SE',
      {month:'long'}
    );

  $('#monthYear').textContent=y;

  const first=new Date(y,m,1);
  const start=(first.getDay()+6)%7;
  const last=new Date(y,m+1,0).getDate();
  const prev=new Date(y,m,0).getDate();

  let html='';

  for(let i=0;i<start;i++){

    html+=
      `<button class="muted-day" data-date="${localDate(new Date(y,m-1,prev-start+i+1))}">${prev-start+i+1}</button>`;
  }

  for(let d=1;d<=last;d++){

    const ds=
      localDate(new Date(y,m,d));

    const sel=
      ds===currentDate;

    const today=
      ds===localDate();

    html+=
      `<button class="${sel?'selected ':''}${today?'today ':''}" data-date="${ds}">${d}</button>`;
  }

  for(
    let i=1;
    (start+last+i-1)%7!==0;
    i++
  ){

    html+=
      `<button class="muted-day" data-date="${localDate(new Date(y,m+1,i))}">${i}</button>`;
  }

  $('#calendarGrid').innerHTML=html;

  $('#calendarGrid')
    .querySelectorAll('button')
    .forEach(b=>
      b.onclick=()=>{
        currentDate=b.dataset.date;
        closeCalendar();
        loadDay()
      }
    )
}


async function lookupBarcode(code){

  code=String(code||'')
    .replace(/\D/g,'');

  if(!/^\d{8,14}$/.test(code)){

    $('#scannerStatus').textContent=
      'Ogiltig streckkod.';

    return
  }

  $('#scannerStatus').textContent=
    'Letar efter produkten…';

  try{

    const r=await fetch(
      `/api/products/barcode/${code}`
    );

    const data=await r.json();

    if(!r.ok)
      throw new Error(
        data.error||
        'Produkten hittades inte.'
      );

    await closeScanner();

    openSearch();

    renderResults([
      data
    ]);

    selectFood(data)

  }catch(e){

    $('#scannerStatus').textContent=
      e.message||
      'Produkten hittades inte.'
  }
}


async function startScanner(){

  openSheet(scannerView);

  $('#scannerStatus').textContent=
    'Startar mobilkameran…';

  const video=$('#cameraVideo');

  try{

    if(
      navigator.mediaDevices?.getUserMedia
    ){

      cameraStream=
        await navigator.mediaDevices.getUserMedia({
          video:{
            facingMode:{
              ideal:'environment'
            },
            width:{
              ideal:1280
            },
            height:{
              ideal:720
            }
          },
          audio:false
        });

      video.srcObject=
        cameraStream;

      await video.play();

      $('#scannerStatus').textContent=
        'Rikta kameran mot streckkoden…';

      if(
        'BarcodeDetector' in window
      ){

        const detector=
          new BarcodeDetector({
            formats:[
              'ean_13',
              'ean_8',
              'upc_a',
              'upc_e'
            ]
          });

        const scan=async()=>{

          if(!cameraStream)
            return;

          try{

            const codes=
              await detector.detect(video);

            if(
              codes[0]?.rawValue
            ){

              await lookupBarcode(
                codes[0].rawValue
              );

              return
            }

          }catch{}

          requestAnimationFrame(scan)
        };

        requestAnimationFrame(scan);

        return
      }
    }

    if(window.Html5Qrcode){

      scanner=
        new Html5Qrcode(
          'scannerReader'
        );

      await scanner.start(
        {
          facingMode:'environment'
        },
        {
          fps:10,
          qrbox:{
            width:280,
            height:140
          },
          formatsToSupport:[
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E
          ]
        },
        lookupBarcode,
        ()=>{}
      );

      $('#scannerStatus').textContent=
        'Rikta kameran mot streckkoden…'

    }else{

      throw new Error('scanner')
    }

  }catch(e){

    console.error(e);

    $('#scannerStatus').textContent=
      'Kunde inte starta kameran. Kontrollera kameraåtkomst och HTTPS, eller skriv streckkoden manuellt.'
  }
}


async function stopScanner(){

  if(cameraStream){

    cameraStream
      .getTracks()
      .forEach(t=>t.stop());

    cameraStream=null
  }

  if(scanner){

    try{

      if(scanner.isScanning)
        await scanner.stop()

    }catch{}

    try{
      scanner.clear()
    }catch{}

    scanner=null
  }

  const v=$('#cameraVideo');

  if(v)
    v.srcObject=null
}


async function closeScanner(){

  await stopScanner();

  closeSheet(scannerView)
}


function openSettings(){

  const v=$('#settingsView');

  $('#targetKcal').value=
    goals.kcal;

  $('#targetProtein').value=
    goals.protein;

  $('#targetCarbs').value=
    goals.carbs;

  $('#targetFat').value=
    goals.fat;

  document
    .querySelectorAll('#goalPills button')
    .forEach(b=>
      b.classList.toggle(
        'active',
        b.dataset.goal===goals.goal
      )
    );

  openSheet(v)
}


function closeSettings(){
  closeSheet($('#settingsView'))
}


ensureUI();

$('#scanBarcode').onclick=
  startScanner;

$('#closeScanner').onclick=
  closeScanner;

$('#manualScan').onclick=
  ()=>lookupBarcode(
    $('#manualBarcode').value
  );

$('#openSettings').onclick=
  openSettings;

$('#closeSettings').onclick=
  closeSettings;

document
  .querySelectorAll('#goalPills button')
  .forEach(b=>
    b.onclick=()=>{
      goals.goal=b.dataset.goal;

      document
        .querySelectorAll('#goalPills button')
        .forEach(x=>
          x.classList.toggle(
            'active',
            x===b
          )
        )
    }
  );

$('#saveSettings').onclick=()=>{

  goals={
    kcal:Math.max(
      800,
      +$('#targetKcal').value||2200
    ),

    protein:Math.max(
      0,
      +$('#targetProtein').value||160
    ),

    carbs:Math.max(
      0,
      +$('#targetCarbs').value||220
    ),

    fat:Math.max(
      0,
      +$('#targetFat').value||70
    ),

    goal:goals.goal
  };

  saveGoals();

  closeSettings();

  render()
};

$('#openCalendar').onclick=
  openCalendar;

$('#closeCalendar').onclick=
  closeCalendar;

$('#prevMonth').onclick=()=>{
  calendarCursor.setMonth(
    calendarCursor.getMonth()-1
  );

  renderCalendar()
};

$('#nextMonth').onclick=()=>{
  calendarCursor.setMonth(
    calendarCursor.getMonth()+1
  );

  renderCalendar()
};

$('#calendarToday').onclick=()=>{
  currentDate=localDate();
  closeCalendar();
  loadDay()
};

$('#todayTop').onclick=()=>{
  currentDate=localDate();
  loadDay()
};

$('#prevDay').onclick=
  ()=>shiftDay(-1);

$('#nextDay').onclick=
  ()=>shiftDay(1);

loadDay();
```
