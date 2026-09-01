let log = JSON.parse(localStorage.getItem('kalorier-log') || '[]');
let selected = null;
let mode = 'foods';
let searchTimer = null;
let scannerStream = null;
let scannerRunning = false;
const $ = s => document.querySelector(s);
const dialog = $('#foodDialog');
const scannerDialog = $('#scannerDialog');

function fmt(n){return new Intl.NumberFormat('sv-SE',{maximumFractionDigits:0}).format(Math.round(Number(n)||0));}
function escapeHtml(value){return String(value ?? '').replace(/[&<>\'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));}
function render(){
  const totals=log.reduce((a,x)=>{a.kcal+=x.kcal;a.protein+=x.protein;a.carbs+=x.carbs;a.fat+=x.fat;return a},{kcal:0,protein:0,carbs:0,fat:0});
  $('#calories').textContent=fmt(totals.kcal);
  $('#remaining').textContent=`${fmt(Math.max(0,2200-totals.kcal))} kcal`;
  $('#mealCount').textContent=`${fmt(totals.kcal)} kcal`;
  [['protein',160],['carbs',220],['fat',70]].forEach(([key,target])=>{$(`#${key}`).textContent=`${fmt(totals[key])} / ${target} g`;$(`#${key}Bar`).style.width=Math.min(100,totals[key]/target*100)+'%';});
  const deg=Math.min(360,totals.kcal/2200*360);$('#calorieRing').style.background=`conic-gradient(#171717 ${deg}deg,#e8e8e4 ${deg}deg)`;
  $('#foodList').innerHTML=log.length?log.map((x,i)=>`<div class="food"><div><strong>${escapeHtml(x.name)}</strong><small>${x.amount} g · ${fmt(x.kcal)} kcal</small></div><button onclick="removeFood(${i})" style="border:0;background:none;cursor:pointer">×</button></div>`).join(''):'<div class="empty">Inget registrerat ännu.</div>';
}
window.removeFood=i=>{log.splice(i,1);save();};
function save(){localStorage.setItem('kalorier-log',JSON.stringify(log));render();}

function selectFood(food){
  if(!food)return;
  selected=food;
  $('#amountArea').hidden=false;
  const extra=food.brand?` · ${escapeHtml(food.brand)}`:'';
  const source=food.source==='openfoodfacts'?'Produkt från Open Food Facts':'Livsmedel';
  $('#selectedFood').innerHTML=`<strong>${escapeHtml(food.name)}</strong><small>${fmt(food.kcal)} kcal per 100 g${extra}<br>${source}</small>`;
  $('#amount').focus();$('#amount').select();
}

function renderResults(matches, productMode){
  const results=$('#results');
  results.innerHTML=matches.length?matches.map((f,i)=>`<button type="button" class="result" data-index="${i}"><strong>${escapeHtml(f.name)}</strong><small>${productMode&&f.brand?escapeHtml(f.brand)+' · ':''}${fmt(f.kcal)} kcal · ${Number(f.protein||0).toFixed(1)} g protein / 100 g</small></button>`).join(''):'<div class="empty">Inga resultat hittades.</div>';
  results.querySelectorAll('.result').forEach(b=>b.onclick=()=>selectFood(matches[Number(b.dataset.index)]));
}

async function searchFoods(q=''){
  const results=$('#results');
  results.innerHTML='<div class="empty">Söker…</div>';
  try{
    if(mode==='products'){
      if(q.length<2){results.innerHTML='<div class="empty">Skriv minst 2 tecken.</div>';return;}
      const response=await fetch(`/api/products?q=${encodeURIComponent(q)}`);
      if(!response.ok)throw new Error('Produkt-API-fel');
      const matches=await response.json();
      if(!Array.isArray(matches))throw new Error('Ogiltigt svar');
      renderResults(matches,true);
    }else{
      const response=await fetch(`/api/foods?q=${encodeURIComponent(q)}`);
      if(!response.ok)throw new Error('Mat-API-fel');
      const matches=await response.json();
      renderResults(matches,false);
    }
  }catch(error){console.error(error);results.innerHTML='<div class="empty">Kunde inte läsa databasen.</div>';}
}

function setMode(next){
  mode=next;
  $('#foodTab').classList.toggle('active',mode==='foods');
  $('#productTab').classList.toggle('active',mode==='products');
  searchFoods($('#foodSearch').value.trim());
}

$('#foodTab').onclick=()=>setMode('foods');
$('#productTab').onclick=()=>setMode('products');
$('#foodSearch').oninput=e=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>searchFoods(e.target.value.trim()),300);};
$('#addFood').onclick=()=>{dialog.showModal();$('#foodSearch').value='';$('#amountArea').hidden=true;selected=null;setMode('foods');};

$('#foodForm').onsubmit=e=>{
  if(!selected)return;
  e.preventDefault();
  const amount=Number($('#amount').value)||0;
  if(amount<=0)return;
  const factor=amount/100;
  log.push({name:selected.name,amount,kcal:(selected.kcal||0)*factor,protein:(selected.protein||0)*factor,carbs:(selected.carbs||0)*factor,fat:(selected.fat||0)*factor});
  save();dialog.close();selected=null;
};

document.querySelectorAll('.quick button').forEach(b=>b.onclick=async()=>{
  const text=b.textContent.replace(/^[^ ]+ /,'').trim();
  dialog.showModal();$('#foodSearch').value=text;$('#amountArea').hidden=true;selected=null;setMode('foods');await searchFoods(text);
});

async function lookupBarcode(code){
  code=String(code||'').replace(/\D/g,'');
  if(!/^\d{8,14}$/.test(code)){ $('#scannerStatus').textContent='Ogiltig streckkod.';return; }
  $('#scannerStatus').textContent='Letar efter produkten…';
  try{
    const response=await fetch(`/api/products/barcode/${encodeURIComponent(code)}`);
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'Produkten hittades inte.');
    stopScanner();scannerDialog.close();dialog.showModal();$('#foodSearch').value='';setMode('products');renderResults([data],true);selectFood(data);
  }catch(error){$('#scannerStatus').textContent=error.message||'Produkten hittades inte.';}
}

$('#manualScan').onclick=()=>lookupBarcode($('#manualBarcode').value);
$('#closeScanner').onclick=()=>{stopScanner();scannerDialog.close();};
scannerDialog.addEventListener('cancel',()=>stopScanner());

async function startScanner(){
  scannerDialog.showModal();
  $('#scannerStatus').textContent='Startar kameran…';
  $('#manualBarcode').value='';
  if(!('mediaDevices' in navigator)||!navigator.mediaDevices.getUserMedia){$('#scannerStatus').textContent='Kameran stöds inte här. Skriv streckkoden manuellt.';return;}
  if(!('BarcodeDetector' in window)){$('#scannerStatus').textContent='Den här webbläsaren saknar inbyggd streckkodsläsare. Skriv streckkoden manuellt eller använd Chrome på mobilen.';return;}
  try{
    const detector=new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e']});
    scannerStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
    const video=$('#scannerVideo');video.srcObject=scannerStream;await video.play();scannerRunning=true;
    $('#scannerStatus').textContent='Rikta kameran mot streckkoden…';
    const scan=async()=>{
      if(!scannerRunning)return;
      try{const codes=await detector.detect(video);if(codes.length&&codes[0].rawValue){scannerRunning=false;await lookupBarcode(codes[0].rawValue);return;}}catch(e){console.debug(e);}
      requestAnimationFrame(scan);
    };
    requestAnimationFrame(scan);
  }catch(error){console.error(error);$('#scannerStatus').textContent='Kunde inte starta kameran. Kontrollera kameratillståndet eller skriv streckkoden manuellt.';}
}
function stopScanner(){scannerRunning=false;if(scannerStream){scannerStream.getTracks().forEach(t=>t.stop());scannerStream=null;}const video=$('#scannerVideo');if(video)video.srcObject=null;}
$('#scanBarcode').onclick=startScanner;

render();
