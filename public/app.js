let log = JSON.parse(localStorage.getItem('kalorier-log') || '[]');
let selected = null;
let searchTimer = null;
let scanner = null;
const $ = s => document.querySelector(s);
const dialog = $('#foodDialog');
const scannerDialog = $('#scannerDialog');

function fmt(n){return new Intl.NumberFormat('sv-SE',{maximumFractionDigits:0}).format(Math.round(Number(n)||0));}
function escapeHtml(value){return String(value ?? '').replace(/[&<>\'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));}
function render(){
  const totals=log.reduce((a,x)=>{a.kcal+=x.kcal;a.protein+=x.protein;a.carbs+=x.carbs;a.fat+=x.fat;return a},{kcal:0,protein:0,carbs:0,fat:0});
  $('#calories').textContent=fmt(totals.kcal); $('#remaining').textContent=`${fmt(Math.max(0,2200-totals.kcal))} kcal`; $('#mealCount').textContent=`${fmt(totals.kcal)} kcal`;
  [['protein',160],['carbs',220],['fat',70]].forEach(([key,target])=>{$(`#${key}`).textContent=`${fmt(totals[key])} / ${target} g`;$(`#${key}Bar`).style.width=Math.min(100,totals[key]/target*100)+'%';});
  const deg=Math.min(360,totals.kcal/2200*360);$('#calorieRing').style.background=`conic-gradient(#171717 ${deg}deg,#e8e8e4 ${deg}deg)`;
  $('#foodList').innerHTML=log.length?log.map((x,i)=>`<div class="food"><div><strong>${escapeHtml(x.name)}</strong><small>${x.amount} g · ${fmt(x.kcal)} kcal</small></div><button onclick="removeFood(${i})" style="border:0;background:none;cursor:pointer">×</button></div>`).join(''):'<div class="empty">Inget registrerat ännu.</div>';
}
window.removeFood=i=>{log.splice(i,1);save();}; function save(){localStorage.setItem('kalorier-log',JSON.stringify(log));render();}
function selectFood(food){selected=food;$('#amountArea').hidden=false;const extra=food.brand?` · ${escapeHtml(food.brand)}`:'';const source=food.source==='openfoodfacts'?'Produkt':'Livsmedel';$('#selectedFood').innerHTML=`<strong>${escapeHtml(food.name)}</strong><small>${fmt(food.kcal)} kcal per 100 g${extra}<br>${source}</small>`;$('#amount').focus();$('#amount').select();}
function renderResults(items){const results=$('#results');results.innerHTML=items.length?items.map((f,i)=>`<button type="button" class="result" data-index="${i}"><strong>${escapeHtml(f.name)}</strong><small>${f.brand?escapeHtml(f.brand)+' · ':''}${fmt(f.kcal)} kcal · ${Number(f.protein||0).toFixed(1)} g protein / 100 g${f.source==='openfoodfacts'?' · Produkt':''}</small></button>`).join(''):'<div class="empty">Inga resultat hittades.</div>';results.querySelectorAll('.result').forEach(b=>b.onclick=()=>selectFood(items[Number(b.dataset.index)]));}
async function searchAll(q=''){
  const results=$('#results'); if(q.length<2){results.innerHTML='<div class="empty">Skriv minst 2 tecken för att söka.</div>';return;} results.innerHTML='<div class="empty">Söker…</div>';
  try{
    const [foodResponse,productResponse]=await Promise.all([fetch(`/api/foods?q=${encodeURIComponent(q)}`),fetch(`/api/products?q=${encodeURIComponent(q)}`)]);
    const foods=foodResponse.ok?await foodResponse.json():[]; const products=productResponse.ok?await productResponse.json():[];
    const combined=[...(Array.isArray(foods)?foods:[]),...(Array.isArray(products)?products:[])];
    combined.sort((a,b)=>{const aq=String(a.name||'').toLowerCase(),bq=String(b.name||'').toLowerCase(),qq=q.toLowerCase();return (aq===qq?0:aq.startsWith(qq)?1:2)-(bq===qq?0:bq.startsWith(qq)?1:2);});
    renderResults(combined.slice(0,50));
  }catch(e){console.error(e);results.innerHTML='<div class="empty">Kunde inte läsa databaserna.</div>';}
}
$('#foodSearch').oninput=e=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>searchAll(e.target.value.trim()),350);};
$('#addFood').onclick=()=>{dialog.showModal();$('#foodSearch').value='';$('#results').innerHTML='<div class="empty">Sök efter mat eller produkt.</div>';$('#amountArea').hidden=true;selected=null;setTimeout(()=>$('#foodSearch').focus(),50);};
$('#foodForm').onsubmit=e=>{if(!selected)return;e.preventDefault();const amount=Number($('#amount').value)||0;if(amount<=0)return;const factor=amount/100;log.push({name:selected.name,amount,kcal:(selected.kcal||0)*factor,protein:(selected.protein||0)*factor,carbs:(selected.carbs||0)*factor,fat:(selected.fat||0)*factor});save();dialog.close();selected=null;};
document.querySelectorAll('.quick button').forEach(b=>b.onclick=async()=>{const text=b.textContent.replace(/^[^ ]+ /,'').trim();dialog.showModal();$('#foodSearch').value=text;$('#amountArea').hidden=true;selected=null;await searchAll(text);});
async function lookupBarcode(code){code=String(code||'').replace(/\D/g,'');if(!/^\d{8,14}$/.test(code)){$('#scannerStatus').textContent='Ogiltig streckkod.';return;}$('#scannerStatus').textContent='Letar efter produkten…';try{const r=await fetch(`/api/products/barcode/${encodeURIComponent(code)}`);const data=await r.json();if(!r.ok)throw new Error(data.error||'Produkten hittades inte.');await stopScanner();scannerDialog.close();dialog.showModal();$('#foodSearch').value='';renderResults([data]);selectFood(data);}catch(e){$('#scannerStatus').textContent=e.message||'Produkten hittades inte.';}}
async function startScanner(){scannerDialog.showModal();$('#scannerStatus').textContent='Startar mobilkameran…';$('#manualBarcode').value='';if(!window.Html5Qrcode){$('#scannerStatus').textContent='Streckkodsläsaren kunde inte laddas. Skriv streckkoden manuellt.';return;}try{scanner=new Html5Qrcode('scannerReader');await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:280,height:140},formatsToSupport:[Html5QrcodeSupportedFormats.EAN_13,Html5QrcodeSupportedFormats.EAN_8,Html5QrcodeSupportedFormats.UPC_A,Html5QrcodeSupportedFormats.UPC_E]},code=>lookupBarcode(code),()=>{});$('#scannerStatus').textContent='Rikta mobilkameran mot streckkoden…';}catch(e){console.error(e);$('#scannerStatus').textContent='Kunde inte starta mobilkameran. Tillåt kameraåtkomst och försök igen.';}}
async function stopScanner(){if(scanner){try{if(scanner.isScanning)await scanner.stop();}catch(e){}try{scanner.clear();}catch(e){}scanner=null;}}
$('#scanBarcode').onclick=startScanner;$('#manualScan').onclick=()=>lookupBarcode($('#manualBarcode').value);$('#closeScanner').onclick=async()=>{await stopScanner();scannerDialog.close();};scannerDialog.addEventListener('cancel',()=>stopScanner());render();
