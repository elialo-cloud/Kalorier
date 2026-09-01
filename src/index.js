const seedFoods = [
  { id: 'egg', name: 'Ägg, kokt', kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5 },
  { id: 'banana', name: 'Banan, utan skal', kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
  { id: 'rice', name: 'Ris, kokt', kcal: 130, protein: 2.7, carbs: 28.2, fat: 0.3 },
  { id: 'rice-dry', name: 'Ris, okokt', kcal: 350, protein: 7.1, carbs: 78.9, fat: 0.7 },
  { id: 'chicken', name: 'Kycklingfilé, rå', kcal: 110, protein: 23.1, carbs: 0, fat: 1.2 },
  { id: 'oats', name: 'Havregryn', kcal: 360, protein: 13.3, carbs: 57, fat: 6.5 },
  { id: 'potato', name: 'Potatis, kokt', kcal: 80, protein: 1.8, carbs: 17, fat: 0.1 }
];

const OFF_FIELDS = 'code,product_name,product_name_sv,brands,quantity,serving_size,nutriments,image_front_small_url,countries_tags';
const OFF_HEADERS = { 'User-Agent': 'Kalorier/1.0 (Cloudflare Worker)' };

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/coca[-\s]?cola/g, 'coca cola')
    .replace(/zero sugar/g, 'zero')
    .replace(/sugarfree|sockerfri/g, 'zero')
    .replace(/\bcoke\b/g, 'coca cola')
    .replace(/[^a-z0-9åäö\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreMatch(query, product) {
  const q = normalize(query);
  const text = normalize([product.name, product.brand, product.quantity].filter(Boolean).join(' '));
  if (!q || !text) return 0;
  if (text === q) return 1000;
  if (text.includes(q)) return 800;

  const words = q.split(' ').filter(Boolean);
  const hits = words.filter(w => text.includes(w));
  let score = hits.length * 120;
  if (words.length && hits.length === words.length) score += 350;

  // Lightweight fuzzy matching for misspellings/word variants.
  for (const word of words) {
    if (word.length < 4 || text.includes(word)) continue;
    for (const candidate of text.split(' ')) {
      if (Math.abs(candidate.length - word.length) > 2) continue;
      let common = 0;
      for (const ch of word) if (candidate.includes(ch)) common++;
      if (common / word.length >= 0.75) { score += 45; break; }
    }
  }
  return score;
}

function productFromOFF(p) {
  const n = p?.nutriments || {};
  return {
    id: `off:${p.code}`,
    barcode: p.code || null,
    name: p.product_name_sv || p.product_name || 'Okänd produkt',
    brand: p.brands || '', quantity: p.quantity || '', serving_size: p.serving_size || '',
    kcal: Number(n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0),
    protein: Number(n['proteins_100g'] ?? 0),
    carbs: Number(n['carbohydrates_100g'] ?? 0),
    fat: Number(n['fat_100g'] ?? 0),
    image: p.image_front_small_url || null, source: 'openfoodfacts'
  };
}

async function searchOpenFoodFacts(q) {
  const params = new URLSearchParams({ search_terms: q, search_simple: '1', action: 'process', json: '1', page_size: '40', page: '1', lc: 'sv', cc: 'se', fields: OFF_FIELDS });
  const response = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params}`, { headers: OFF_HEADERS });
  if (!response.ok) throw new Error(`Open Food Facts ${response.status}`);
  const data = await response.json();
  return (data.products || [])
    .filter(p => p.code && (p.product_name_sv || p.product_name))
    .map(productFromOFF)
    .filter(p => p.kcal > 0 || p.protein > 0 || p.carbs > 0 || p.fat > 0)
    .map(p => ({ ...p, _score: scoreMatch(q, p) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 20)
    .map(({ _score, ...p }) => p);
}

async function getOpenFoodFactsProduct(barcode) {
  const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}?fields=${OFF_FIELDS}`, { headers: OFF_HEADERS });
  if (!response.ok) throw new Error(`Open Food Facts ${response.status}`);
  const data = await response.json();
  return data.status === 1 && data.product ? productFromOFF(data.product) : null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') return Response.json({ ok: true, service: 'kalorier' });

    if (url.pathname === '/api/foods' && request.method === 'GET') {
      const q = normalize(url.searchParams.get('q') || '');
      if (env.DB) {
        const result = q
          ? await env.DB.prepare(`SELECT id,name,category,kcal_per_100g AS kcal,protein_per_100g AS protein,carbs_per_100g AS carbs,fat_per_100g AS fat,edible_state,preparation,source,verified FROM foods WHERE name LIKE ? ORDER BY verified DESC, name LIMIT 30`).bind(`%${q}%`).all()
          : await env.DB.prepare(`SELECT id,name,category,kcal_per_100g AS kcal,protein_per_100g AS protein,carbs_per_100g AS carbs,fat_per_100g AS fat,edible_state,preparation,source,verified FROM foods ORDER BY verified DESC, name LIMIT 30`).all();
        return Response.json(result.results);
      }
      return Response.json(q ? seedFoods.filter(f => normalize(f.name).includes(q)) : seedFoods);
    }

    if (url.pathname === '/api/products' && request.method === 'GET') {
      const q = (url.searchParams.get('q') || '').trim();
      if (q.length < 2) return Response.json([]);
      try { return Response.json(await searchOpenFoodFacts(q), { headers: { 'Cache-Control': 'public, max-age=300' } }); }
      catch (error) { console.error(error); return Response.json({ error: 'Kunde inte läsa produktdatabasen.' }, { status: 502 }); }
    }

    if (url.pathname.startsWith('/api/products/barcode/') && request.method === 'GET') {
      const barcode = url.pathname.split('/').pop();
      if (!barcode || !/^\d{8,14}$/.test(barcode)) return Response.json({ error: 'Ogiltig streckkod.' }, { status: 400 });
      try {
        const product = await getOpenFoodFactsProduct(barcode);
        return product ? Response.json(product, { headers: { 'Cache-Control': 'public, max-age=3600' } }) : Response.json({ error: 'Produkten hittades inte.' }, { status: 404 });
      } catch (error) { console.error(error); return Response.json({ error: 'Kunde inte läsa produktdatabasen.' }, { status: 502 }); }
    }
    return env.ASSETS.fetch(request);
  }
};
