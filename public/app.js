let log = JSON.parse(localStorage.getItem('kalorier-log') || '[]');
let selected = null;
const $ = s => document.querySelector(s);
const dialog = $('#foodDialog');
let searchTimer = null;

function fmt(n){return new Intl.NumberFormat('sv-SE',{maximumFractionDigits:0}).format(Math.round(n));}
function render(){
  const totals=log.reduce((a,x)=>{a.kcal+=x.kcal;a.protein+=x.protein;a.carbs+=x.carbs;a.fat+=x.fat;return a},{kcal:0,protein:0,carbs:0,fat:0});
  $('#calories').textContent=fmt(totals.kcal);
  $('#remaining').textContent=`${fmt(Math.max(0,2200-totals.kcal))} kcal`;
  $('#mealCount').textContent=`${fmt(totals.kcal)} kcal`;
  [['protein',160],['carbs',220],['fat',70]].forEach(([key,target])=>{$(`#${key}`).textContent=`${fmt(totals[key])} / ${target} g`;$(`#${key}Bar`).style.width=Math.min(100,totals[key]/target*100)+'%';});
  const deg=Math.min(360,totals.kcal/2200*360);$('#calorieRing').style.background=`conic-gradient(#171717 ${deg}deg,#e8e8e4 ${deg}deg)`;
  $('#foodList').innerHTML=log.length?log.map((x,i)=>`<div class="food"><div><strong>${x.name}</strong><small>${x.amount} g · ${fmt(x.kcal)} kcal</small></div><button onclick="removeFood(${i})" style="border:0;background:none;cursor:pointer">×</button></div>`).join(''):'<div class="empty">Inget registrerat ännu.</div>';
}
window.removeFood=i=>{log.splice(i,1);save();};
function save(){localStorage.setItem('kalorier-log',JSON.stringify(log));render();}

async function searchFoods(q=''){
  const results = $('#results');
  results.innerHTML = '<div class="empty">Söker…</div>';
  try {
    const response = await fetch(`/api/foods?q=${encodeURIComponent(q)}`);
    if (!response.ok) throw new Error('API-fel');
    const matches = await response.json();
    results.innerHTML = matches.length
      ? matches.map(f=>`<button type="button" class="result" data-id="${f.id}"><strong>${escapeHtml(f.name)}</strong><small>${fmt(f.kcal)} kcal · ${f.protein ?? 0} g protein / 100 g</small></button>`).join('')
      : '<div class="empty">Inga livsmedel hittades.</div>';
    results.querySelectorAll('.result').forEach(b=>b.onclick=()=>selectFood(matches.find(f=>String(f.id)===b.dataset.id)));
  } catch (error) {
    results.innerHTML = '<div class="empty">Kunde inte läsa matdatabasen.</div>';
    console.error(error);
  }
}

function escapeHtml(value){
  return String(value ?? '').replace(/[&<>\'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function selectFood(food){
  if(!food) return;
  selected=food;
  $('#amountArea').hidden=false;
  $('#selectedFood').innerHTML=`<strong>${escapeHtml(selected.name)}</strong><small>${fmt(selected.kcal)} kcal per 100 g</small>`;
  $('#amount').focus();
  $('#amount').select();
}

$('#addFood').onclick=()=>{dialog.showModal();$('#foodSearch').value='';$('#amountArea').hidden=true;selected=null;searchFoods();};
$('#foodSearch').oninput=e=>{
  clearTimeout(searchTimer);
  searchTimer=setTimeout(()=>searchFoods(e.target.value.trim()),150);
};

$('#foodForm').onsubmit=e=>{
  if(!selected)return;
  e.preventDefault();
  const amount=Number($('#amount').value)||0;
  if(amount<=0)return;
  const factor=amount/100;
  log.push({name:selected.name,amount,kcal:(selected.kcal||0)*factor,protein:(selected.protein||0)*factor,carbs:(selected.carbs||0)*factor,fat:(selected.fat||0)*factor});
  save();
  dialog.close();
  selected=null;
};

document.querySelectorAll('.quick button').forEach(b=>b.onclick=async()=>{
  const text=b.textContent.replace(/^[^ ]+ /,'').trim();
  dialog.showModal();
  $('#foodSearch').value=text;
  $('#amountArea').hidden=true;
  selected=null;
  await searchFoods(text);
});

render();
