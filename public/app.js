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
   SÖKMOTOR
========================================================= */

const SEARCH_ALIASES=[
  ['ägg',['agg','honsagg','kokt agg','kokt ägg','stekt agg','stekt ägg','hardkokt agg','hårdkokt ägg']],
  ['grädde',['gradd','vispgradd','vispgrädde','matgradd','matgrädde']],
  ['mjölk',['mjolk','standardmjolk','standardmjölk','mellanmjolk','mellanmjölk','lattmjolk','lättmjölk']],
  ['kyckling',['kycklingfilé','kycklingfile','kycklingbröst','kycklingbrost','kycklinglår','kycklinglar']],
  ['ris',['kokt ris','ris kokt','jasminris','basmatiris']],
  ['potatis',['kokt potatis','potatis kokt','potatisplatt','potatisplätt','raggmunk']],
  ['bröd',['brod','franska','limpa','fullkornsbrod','fullkornsbröd','knäckebrod','knäckebröd']],
  ['köttfärs',['kottfars','notfars','nötfärs','notkottfars','nötköttfärs']],
  ['yoghurt',['yoghurt','grekisk yoghurt','turkisk yoghurt']],
  ['kvarg',['skyr','proteinpudding','kvarg']],
  ['coca cola zero',['coke zero','cola zero','coca cola zero']],
  ['coca cola',['coke','cola','coca cola']]
];

function norm(s){
  return String(s||'')
    .toLocaleLowerCase('sv-SE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^\p{L}\p{N}]+/gu,' ')
    .replace(/\s+/g,' ')
    .trim()
}

function tokens(s){
  return norm(s).split(' ').filter(Boolean)
}

function lev(a,b){
  if(a===b)return 0;

  if(Math.abs(a.length-b.length)>3)
    return 99;

  const prev=
    Array.from(
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
      );

      if(
        j>1&&
        i>1&&
        a[i-1]===b[j-2]&&
        a[i-2]===b[j-1]
      ){
        cur[j]=Math.min(
          cur[j],
          prev[j-2]+1
        )
      }
    }

    for(let j=0;j<=b.length;j++)
      prev[j]=cur[j]
  }

  return prev[b.length]
}

function similarity(a,b){
  if(!a||!b)return 0;

  if(a===b)return 1;

  if(a.includes(b)||b.includes(a))
    return Math.min(a.length,b.length)/
           Math.max(a.length,b.length);

  const d=lev(a,b);

  return Math.max(
    0,
    1-d/Math.max(a.length,b.length)
  )
}

function aliasTerms(q){
  const n=norm(q);
  const out=new Set([n]);

  for(
    const [canonical,aliases]
    of SEARCH_ALIASES
  ){

    const all=[
      canonical,
      ...aliases
    ].map(norm);

    if(
      all.some(x=>
        x===n||
        x.includes(n)||
        n.includes(x)
      )
    ){
      all.forEach(x=>out.add(x));
      out.add(norm(canonical))
    }
  }

  return [...out]
}

function variants(q){
  const n=norm(q);
  const out=new Set([n]);

  aliasTerms(n)
    .forEach(x=>out.add(x));

  return [...out]
}


/*
  AI-förslag.
  Detta är fortfarande den lokala AI-fallbacken,
  inte ett externt AI-API.
*/

const AI_FOODS=[
  {
    match:[
      'kokt agg',
      'kokt ägg',
      'hardkokt agg',
      'hardkokt ägg',
      'hårdkokt ägg'
    ],
    name:'Kokt ägg',
    kcal:155,
    protein:12.6,
    carbs:1.1,
    fat:10.6
  },

  {
    match:[
      'stekt agg',
      'stekt ägg'
    ],
    name:'Stekt ägg',
    kcal:196,
    protein:13.6,
    carbs:0.8,
    fat:14.8
  },

  {
    match:[
      'kycklingfile',
      'kycklingfilé',
      'kycklingbrost',
      'kycklingbröst'
    ],
    name:'Kycklingfilé, tillagad',
    kcal:165,
    protein:31,
    carbs:0,
    fat:3.6
  },

  {
    match:[
      'kokt ris',
      'ris kokt',
      'jasminris',
      'basmatiris'
    ],
    name:'Kokt ris',
    kcal:130,
    protein:2.7,
    carbs:28.2,
    fat:0.3
  },

  {
    match:[
      'kokt potatis',
      'potatis kokt'
    ],
    name:'Kokt potatis',
    kcal:87,
    protein:1.9,
    carbs:20.1,
    fat:0.1
  },

  {
    match:[
      'havregrynsgröt',
      'havregryns grot',
      'havregrynsgröt med vatten'
    ],
    name:'Havregrynsgröt med vatten',
    kcal:68,
    protein:2.4,
    carbs:11.7,
    fat:1.4
  },

  {
    match:[
      'pannkaka',
      'pannkakor'
    ],
    name:'Pannkaka, klassisk',
    kcal:190,
    protein:6.1,
    carbs:22.7,
    fat:8.7
  },

  {
    match:[
      'tacos',
      'taco',
      'tacofars',
      'tacofärs'
    ],
    name:'Tacos med nötfärs, uppskattat',
    kcal:190,
    protein:12,
    carbs:12,
    fat:10
  },

  {
    match:[
      'kyckling ris',
      'kyckling med ris'
    ],
    name:'Kyckling med ris, uppskattat',
    kcal:150,
    protein:13,
    carbs:18,
    fat:3.5
  }
];


function aiCandidate(q){

  const n=norm(q);

  if(!n)return null;

  let best=null;
  let bestScore=0;

  const qt=tokens(n);

  for(
    const f of AI_FOODS
  ){

    for(
      const m of f.match
    ){

      const mn=norm(m);
      const mt=tokens(mn);

      let score=
        similarity(n,mn)*100;

      let matched=0;

      for(
        const token of qt
      ){

        if(
          mt.some(x=>
            x===token||
            x.startsWith(token)||
            token.startsWith(x)||
            similarity(token,x)>=0.72
          )
        ){
          matched++;
        }
      }

      if(qt.length){
        score+=
          matched/qt.length*100;
      }

      if(
        matched===qt.length &&
        qt.length>1
      ){
        score+=80;
      }

      if(score>bestScore){

        bestScore=score;
        best={
          ...f
        }
      }
    }
  }

  if(
    !best||
    bestScore<55
  ){
    return null;
  }

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


function searchScore(item,q){

  const name=norm(item.name);
  const brand=norm(item.brand);
  const query=norm(q);

  if(!query||!name)
    return -999;

  const qt=tokens(query);
  const nt=tokens(name);

  let s=0;
  let matched=0;

  if(name===query)
    s+=5000;

  if(name.startsWith(query))
    s+=1700;

  if(name.includes(` ${query}`))
    s+=1300;

  if(name.includes(query))
    s+=700;

  if(brand===query)
    s+=1200;

  if(brand.includes(query))
    s+=450;

  for(
    const t of qt
  ){

    if(nt.includes(t)){
      s+=900;
      matched++;
      continue;
    }

    if(
      nt.some(x=>x.startsWith(t))
    ){
      s+=520;
      matched++;
      continue;
    }

    const near=
      nt.map(x=>similarity(t,x))
        .reduce((a,b)=>Math.max(a,b),0);

    if(
      t.length>=3&&
      near>=0.86
    ){
      s+=330*near;
      matched++;
      continue;
    }

    if(
      t.length>=4&&
      near>=0.72
    ){
      s+=120*near;
      matched++;
    }
  }

  if(qt.length>1&&matched===0)
    return -999;

  if(qt.length>1&&matched<qt.length)
    s-=300;

  s-=Math.max(
    0,
    nt.length-qt.length
  )*24;

  if(
    /\b(hemgjord|hemlagad|recept|sås|sauce)\b/.test(name)&&
    !name.startsWith(query)
  ){
    s-=80;
  }

  if(
    item.source==='openfoodfacts'&&
    brand
  ){
    s+=12;
  }

  if(item.verified)
    s+=40;

  return s
}


async function fetchSearchEndpoint(path,variant){

  try{

    const r=await fetch(
      `${path}?q=${encodeURIComponent(variant)}`
    );

    if(!r.ok)
      return [];

    const data=await r.json();

    return Array.isArray(data)
      ?data
      :[];

  }catch{
    return []
  }
}


async function searchAll(q=''){

  const raw=String(q)
    .replace(/\s+/g,' ')
    .trim();

  if(raw.length<2){

    $('#searchHint').textContent=
      'Skriv vad du åt – vi söker överallt.';

    renderResults([]);

    return
  }

  const request=Symbol();

  searchAll._request=request;

  $('#searchHint').textContent=
    'Söker i Livsmedelsverket + OFF…';

  try{

    const vs=variants(raw);

    const batches=
      await Promise.all(
        vs.map(v=>
          Promise.all([
            fetchSearchEndpoint('/api/foods',v),
            fetchSearchEndpoint('/api/products',v)
          ])
        )
      );

    if(
      searchAll._request!==request
    ){
      return
    }

    let all=batches.flat(2);

    const seen=new Set();

    const ranked=
      all
        .filter(x=>x&&x.name)
        .filter(x=>{

          const key=
            `${x.source||''}|${x.id||''}|${norm(x.name)}|${norm(x.brand||'')}`;

          if(seen.has(key))
            return false;

          seen.add(key);

          return true
        })
        .map((x,i)=>({

          ...x,

          _score:
            Math.max(
              ...vs.map(v=>
                searchScore(x,v)
              )
            ),

          _i:i
        }))
        .filter(x=>x._score>-999)
        .sort((a,b)=>
          b._score-a._score||
          a._i-b._i
        );


    /*
      AI skapas oavsett om databasen
      hittade resultat.

      Endast en riktigt stark träff
      blockerar AI-förslaget.
    */

    const ai=aiCandidate(raw);

    const databaseScore=
      ranked.length
        ?ranked[0]._score
        :0;

    const strongMatch=
      databaseScore>=1800;

    const final=[];

    if(
      ai &&
      !strongMatch
    ){
      final.push(ai);
    }

    final.push(
      ...ranked
    );

    renderResults(
      final.slice(0,50)
    );

    if(!final.length){

      $('#searchHint').textContent=
        'Inga relevanta resultat hittades.';

    }else if(
      ai &&
      !strongMatch
    ){

      $('#searchHint').textContent=
        '🧠 AI-förslag + databasresultat';

    }else{

      $('#searchHint').textContent=
        'Bästa träffar från Livsmedelsverket + OFF';
    }

  }catch(e){

    console.error(e);

    if(
      searchAll._request!==request
    ){
      return
    }

    const ai=aiCandidate(raw);

    if(ai){

      renderResults([
        ai
      ]);

      $('#searchHint').textContent=
        '🧠 AI-förslag – inget säkert databassvar hittades.';

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
