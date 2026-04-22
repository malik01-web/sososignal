export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SOSO_KEY = process.env.SOSO_API_KEY;
  if (!SOSO_KEY) return res.status(500).json({ error: 'SoSoValue key not configured' });

  const { type } = req.query;

  // Try multiple endpoint variations
  const etfEndpoints = [
    'https://openapi.sosovalue.com/api/v2/etf/bitcoin/metrics',
    'https://openapi.sosovalue.com/api/v1/etf/bitcoin/spot/metrics',
    'https://openapi.sosovalue.com/api/v1/etf/bitcoin/spot/list',
  ];

  const newsEndpoint = 'https://openapi.sosovalue.com/api/v1/news/featured?pageNum=1&pageSize=6&categoryList=1,2';

  try {
    if (type === 'news') {
      const r = await fetch(newsEndpoint, {
        headers: { 'x-soso-api-key': SOSO_KEY, 'Content-Type': 'application/json' }
      });
      if (!r.ok) throw new Error('News API ' + r.status);
      const data = await r.json();
      res.setHeader('Cache-Control', 's-maxage=3600');
      return res.status(200).json(data);
    }

    // ETF — try each endpoint until one works
    for (const url of etfEndpoints) {
      try {
        const r = await fetch(url, {
          headers: { 'x-soso-api-key': SOSO_KEY, 'Content-Type': 'application/json' }
        });
        if (!r.ok) continue;
        const data = await r.json();
        if (data && (data.data || data.code === 0)) {
          res.setHeader('Cache-Control', 's-maxage=3600');
          return res.status(200).json({ ...data, _endpoint: url });
        }
      } catch(e) { continue; }
    }

    return res.status(404).json({ error: 'No ETF endpoint responded' });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
