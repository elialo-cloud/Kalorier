const foods = [
  {id:'egg',name:'Ägg, kokt',kcal:143,protein:12.6,carbs:0.7,fat:9.5},
  {id:'banana',name:'Banan, utan skal',kcal:89,protein:1.1,carbs:22.8,fat:0.3},
  {id:'rice',name:'Ris, kokt',kcal:130,protein:2.7,carbs:28.2,fat:0.3},
  {id:'rice-dry',name:'Ris, okokt',kcal:350,protein:7.1,carbs:78.9,fat:0.7},
  {id:'chicken',name:'Kycklingfilé, rå',kcal:110,protein:23.1,carbs:0,fat:1.2},
  {id:'oats',name:'Havregryn',kcal:360,protein:13.3,carbs:57.0,fat:6.5},
  {id:'potato',name:'Potatis, kokt',kcal:80,protein:1.8,carbs:17.0,fat:0.1}
];

let log = JSON.parse(localStorage.getItem('kalorier-log') || '[]');
let selected = null;
const $ = s => document.querySelector(s);
const dialog = $('#foodDialog');

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
function showResults(q=''){
  const matches=foods.filter(f=>f.name.toLowerCase().includes(q.toLowerCase())).slice(0,8);
  $('#results').innerHTML=matches.map(f=>`<button type="button" class="result" data-id="${f.id}"><strong>${f.name}</strong><small>${f.kcal} kcal · ${f.protein} g protein / 100 g</small></button>`).join('');
  document.querySelectorAll('.result').forEach(b=>b.onclick=()=>selectFood(b.dataset.id));
}
function selectFood(id){selected=foods.find(f=>f.id===id);$('#amountArea').hidden=false;$('#selectedFood').innerHTML=`<strong>${selected.name}</strong><small>${selected.kcal} kcal per 100 g</small>`;$('#amount').focus();$('#amount').select();}
$('#addFood').onclick=()=>{dialog.showModal();$('#foodSearch').value='';$('#amountArea').hidden=true;showResults();};
$('#foodSearch').oninput=e=>showResults(e.target.value);
$('#foodForm').onsubmit=e=>{if(!selected)return;e.preventDefault();const amount=Number($('#amount').value)||0;const factor=amount/100;log.push({name:selected.name,amount,kcal:selected.kcal*factor,protein:selected.protein*factor,carbs:selected.carbs*factor,fat:selected.fat*factor});save();dialog.close();selected=null;};
document.querySelectorAll('.quick button').forEach(b=>b.onclick=()=>{const text=b.textContent.replace(/^[^ ]+ /,'');const f=foods.find(x=>x.name.toLowerCase().startsWith(text.toLowerCase()));if(f){dialog.showModal();selectFood(f.id);}});
render();
