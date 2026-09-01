(() => {
  const input = document.querySelector('#foodSearch');
  const results = document.querySelector('#results');
  if (!input || !results) return;

  const oldInputHandler = input.oninput;
  let timer = 0;
  let generation = 0;

  const aliases = [
    [/\bcoca\s*cola\b/g, 'coke'],
    [/\bcoca\s+cola\s+zero\b/g, 'coke zero'],
    [/\bcola\s+zero\b/g, 'coke zero'],
    [/\bpotatisplätt(ar)?\b/g, 'potatisplätt'],
    [/\bpotatispannkaka\b/g, 'potatisplätt'],
    [/\braggmunk\b/g, 'potatisplätt'],
    [/\bägg\b/g, 'ägg'],
  ];

  const normalize = s => String(s || '')
    .toLocaleLowerCase('sv-SE')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const compact = s => normalize(s).replace(/\s+/g, '');
  const tokens = s => normalize(s).split(' ').filter(Boolean);

  function levenshtein(a,b){
    if(a===b)return 0;
    if(!a)return b.length;
    if(!b)return a.length;
    if(Math.abs(a.length-b.length)>2)return 99;
    let prev=Array.from({length:b.length+1},(_,i)=>i);
    for(let i=1;i<=a.length;i++){
      const cur=[i];
      for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
      prev=cur;
    }
    return prev[b.length];
  }

  function queryVariants(raw){
    const q=normalize(raw);
    const out=[q];
    for(const [re,repl] of aliases){
      if(re.test(q)){
        re.lastIndex=0;
        const v=q.replace(re,repl).replace(/\s+/g,' ').trim();
        if(v && !out.includes(v))out.push(v);
      } else re.lastIndex=0;
    }
    // Common Swedish/English spelling variants.
    const swaps={"tomat":"tomato","tomatoes":"tomat","yoghurt":"yogurt","jogurt":"yogurt","keso":"cottage cheese"};
    const v=q.split(' ').map(x=>swaps[x]||x).join(' ');
    if(v!==q&&!out.includes(v))out.push(v);
    return out;
  }

  function score(name, rawQuery){
    const n=normalize(name), q=normalize(rawQuery), qt=tokens(q), nt=tokens(n);
    if(!q || !n)return -999;
    const nq=compact(q), nn=compact(n);
    let s=0;
    if(n===q)s+=1000;
    if(n.startsWith(q))s+=700;
    if(nn===nq)s+=950;
    if(nn.startsWith(nq))s+=600;

    let matched=0;
    for(const t of qt){
      if(nt.includes(t)){s+=260;matched++;continue}
      if(nt.some(x=>x.startsWith(t))){s+=180;matched++;continue}
      if(t.length>=4 && nt.some(x=>levenshtein(t,x)<=1)){s+=100;matched++;continue}
      if(t.length>=5 && nt.some(x=>levenshtein(t,x)<=2)){s+=35;matched++;}
    }
    if(qt.length && matched===qt.length)s+=220;
    else if(qt.length>1 && matched===0)return -999;

    // Substring matching is useful, but never let a random substring beat a real word match.
    if(n.includes(q))s+=140;
    const first=qt[0];
    if(first && nt.some(x=>x.startsWith(first)))s+=70;

    // Prefer simpler canonical food names over long recipe/preparation strings.
    const extra=Math.max(0,nt.length-qt.length);
    s-=extra*12;
    if(/\b(recept|hemgjord|hemlagad|med|och|sås|gryta|panna)\b/.test(n)&&qt.length===1)s-=35;
    return s;
  }

  function rerank(rawQuery){
    const q=normalize(rawQuery);
    const buttons=[...results.querySelectorAll('.result')];
    if(!buttons.length)return;
    const ranked=buttons.map((el,index)=>({el,index,score:score(el.textContent,q)}))
      .filter(x=>x.score>-500)
      .sort((a,b)=>b.score-a.score||a.index-b.index);

    // For a single-word query, suppress results that don't actually contain/closely match the word.
    const qt=tokens(q);
    const strict=qt.length===1 && qt[0].length>=3;
    const visible=strict ? ranked.filter(x=>x.score>=100) : ranked.filter(x=>x.score>=0);
    const frag=document.createDocumentFragment();
    for(const x of visible.slice(0,50))frag.appendChild(x.el);
    results.replaceChildren(frag);
    if(!visible.length){
      results.innerHTML='<div class="empty">Inga relevanta resultat hittades.</div>';
    }
  }

  function runSearch(raw){
    const q=String(raw||'').replace(/\s+/g,' ').trim();
    if(!q){ if(oldInputHandler) oldInputHandler({target:input}); return; }
    const id=++generation;
    const variants=queryVariants(q);
    // Use the user's exact normalized query first. If that produces nothing useful,
    // retry with a known alias. The original search engine remains responsible for retrieval.
    const run=(variant,index=0)=>{
      if(id!==generation)return;
      input.value=variant;
      if(oldInputHandler)oldInputHandler({target:input});
      input.value=q;
      window.setTimeout(()=>{
        if(id!==generation)return;
        const count=results.querySelectorAll('.result').length;
        if(count===0 && index+1<variants.length)run(variants[index+1],index+1);
        else rerank(q);
      },320);
    };
    run(variants[0]);
  }

  input.oninput=e=>{
    const q=e.target.value;
    clearTimeout(timer);
    timer=setTimeout(()=>runSearch(q),170);
  };

  // Re-rank once more after the existing engine finishes a request.
  input.addEventListener('keyup',()=>{
    clearTimeout(timer);
    timer=setTimeout(()=>rerank(input.value),260);
  });

  // Keep the version visible even if a compatibility script runs before this file.
  document.title='Kalorier V5.2';
  const badge=document.querySelector('.eyebrow b');
  if(badge)badge.textContent='V5.2';
})();
