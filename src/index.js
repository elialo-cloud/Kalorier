const seedFoods = [
  { id: 'egg', name: 'Ägg, kokt', kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5 },
  { id: 'banana', name: 'Banan, utan skal', kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
  { id: 'rice', name: 'Ris, kokt', kcal: 130, protein: 2.7, carbs: 28.2, fat: 0.3 },
  { id: 'rice-dry', name: 'Ris, okokt', kcal: 350, protein: 7.1, carbs: 78.9, fat: 0.7 },
  { id: 'chicken', name: 'Kycklingfilé, rå', kcal: 110, protein: 23.1, carbs: 0, fat: 1.2 },
  { id: 'oats', name: 'Havregryn', kcal: 360, protein: 13.3, carbs: 57, fat: 6.5 },
  { id: 'potato', name: 'Potatis, kokt', kcal: 80, protein: 1.8, carbs: 17, fat: 0.1 }
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return Response.json({ ok: true, service: 'kalorier' });
    }

    if (url.pathname === '/api/foods' && request.method === 'GET') {
      const q = (url.searchParams.get('q') || '').trim().toLowerCase();

      // Until D1 is connected, return the small seed set.
      // Once env.DB exists, searches come from the real database.
      if (env.DB) {
        const result = q
          ? await env.DB.prepare(`SELECT id,name,category,kcal_per_100g AS kcal,protein_per_100g AS protein,carbs_per_100g AS carbs,fat_per_100g AS fat,edible_state,preparation,source,verified FROM foods WHERE name LIKE ? ORDER BY verified DESC, name LIMIT 30`).bind(`%${q}%`).all()
          : await env.DB.prepare(`SELECT id,name,category,kcal_per_100g AS kcal,protein_per_100g AS protein,carbs_per_100g AS carbs,fat_per_100g AS fat,edible_state,preparation,source,verified FROM foods ORDER BY verified DESC, name LIMIT 30`).all();
        return Response.json(result.results);
      }

      const results = q ? seedFoods.filter(f => f.name.toLowerCase().includes(q)) : seedFoods;
      return Response.json(results);
    }

    return env.ASSETS.fetch(request);
  }
};
