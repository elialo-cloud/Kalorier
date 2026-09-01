from pathlib import Path
import re

p = Path('public/app.js')
s = p.read_text(encoding='utf-8')

new_score = r'''function searchScore(item,q){
  const query=norm(q);
  const name=norm(item.name);
  const brand=norm(item.brand);
  if(!query||!name)return -Infinity;
  const qt=tokens(query),nt=tokens(name),bt=tokens(brand);
  const isShort=qt.length===1&&qt[0].length<=3;
  let score=0,matched=0;
  if(isShort){
    const t=qt[0];
    if(name===t)score+=12000;
    else if(nt[0]===t)score+=10500;
    else if(nt.some(x=>x===t))score+=9000;
    else if(nt[0]?.startsWith(t))score+=7000;
    else if(nt.some(x=>x.startsWith(t)))score+=5500;
    else if(brand===t||bt.includes(t))score+=5000;
    else{
      const close=nt.some(x=>x.length>=t.length&&levenshtein(t,x)<=1&&similarity(t,x)>=.75);
      if(!close)return -Infinity;
      score+=2500;
    }
    if(!nt.some(x=>x===t||x.startsWith(t))&&!bt.some(x=>x===t||x.startsWith(t)))return -Infinity;
    score-=Math.max(0,nt.length-1)*18;
    if(item.verified)score+=180;
    return score;
  }
  for(const token of qt){
    let best=0,bestIndex=-1;
    nt.forEach((n,i)=>{
      let v=0;
      if(n===token)v=1;
      else if(n.startsWith(token))v=.94;
      else if(token.startsWith(n)&&n.length>=4)v=.86;
      else if(token.length>=4&&n.length>=4&&levenshtein(token,n)<=1)v=.78;
      if(v>best){best=v;bestIndex=i;}
    });
    if(best>=.78){matched++;score+=best>=.99?2600:best>=.9?1700:850;if(bestIndex===0)score+=450;}
  }
  if(matched!==qt.length)return -Infinity;
  if(name===query)score+=12000;
  else if(name.startsWith(query))score+=6500;
  else if(name.includes(` ${query}`))score+=4800;
  else if(name.includes(query))score+=1800;
  if(brand===query)score+=1800;
  else if(brand.includes(query))score+=350;
  if(qt.length===1){
    const prepared=/\b(hemgjord|hemlagad|recept|gryta|sås|sauce|pannkaka|panna|pizza|gratäng|soppa|dessert)\b/.test(name);
    if(prepared&&!name.startsWith(query))score-=1400;
  }
  score-=Math.max(0,nt.length-qt.length)*45;
  if(item.verified)score+=180;
  if(item.source==='openfoodfacts'&&brand)score+=35;
  return score;
}'''

s, n = re.subn(r'function searchScore\(item,q\)\{.*?\n\}\n\n\n/\* ---------------------------------------------------------\n   API', new_score+'\n\n\n/* ---------------------------------------------------------\n   API', s, count=1, flags=re.S)
if n != 1: raise SystemExit('searchScore block not found')

new_render = r'''function renderResults(items){
  const r=$('#results');
  if(!items.length){r.innerHTML='<div class="empty">Inga relevanta resultat hittades.</div>';return;}
  const ai=items.filter(x=>x.source==='ai'),db=items.filter(x=>x.source!=='ai');
  const button=f=>{
    const label=sourceLabel(f);
    return `<button type="button" class="result" data-key="${esc(`${f.source||''}|${norm(f.name)}|${norm(f.brand||'')}`)}"><div class="result-top"><strong>${esc(f.name)}</strong><span class="source-badge source-${String(f.source||'livsmedelsverket').replace(/[^a-z]/gi,'')}">${label}</span></div><small>${f.brand?esc(f.brand)+' · ':''}${fmt(f.kcal)} kcal · ${fmt1(f.protein)} g protein / 100 g${f.source==='ai'?' · AI-estimat':f.source==='openfoodfacts'?' · Produkt':''}</small></button>`;
  };
  let html='';
  if(ai.length)html+=`<div class="search-group-title">🧠 AI-förslag</div>${ai.slice(0,1).map(button).join('')}`;
  if(db.length)html+=`<div class="search-group-title">Livsmedel & produkter</div>${db.map(button).join('')}`;
  r.innerHTML=html;
  r.querySelectorAll('.result').forEach(b=>b.onclick=()=>{
    const key=b.dataset.key;
    const food=items.find(x=>`${x.source||''}|${norm(x.name)}|${norm(x.brand||'')}`===key);
    if(food)selectFood(food);
  });
}'''
s, n = re.subn(r'function renderResults\(items\)\{.*?\n\}\n\n\n/\* =========================================================\n   SÖKMOTOR V6', new_render+'\n\n\n/* =========================================================\n   SÖKMOTOR V7', s, count=1, flags=re.S)
if n != 1: raise SystemExit('renderResults block not found')

new_variants = r'''function searchVariants(q){
  const n=norm(q);
  if(!n)return [];
  const qt=tokens(n);
  if(qt.length===1&&qt[0].length<=3)return [n];
  const out=new Set([n]);
  aliasTerms(n).forEach(x=>out.add(x));
  return [...out]
}'''
s, n = re.subn(r'function searchVariants\(q\)\{.*?\n\}', new_variants, s, count=1, flags=re.S)
if n != 1: raise SystemExit('searchVariants block not found')

s = s.replace("final=\n      final.slice(0,50);", "final=\n      final.slice(0,100);", 1)
marker = "    renderResults(final);"
replacement = "    final=final.filter(x=>x.source==='ai'||Number.isFinite(searchScore(x,raw)));\n\n    renderResults(final);"
if marker not in s: raise SystemExit('render marker not found')
s = s.replace(marker, replacement, 1)
p.write_text(s, encoding='utf-8')
print('patched')
