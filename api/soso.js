export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SOSO_KEY = process.env.SOSO_API_KEY;
  const { endpoint } = req.query;

  if (!endpoint) return res.status(400).json({ error: 'No endpoint specified' });

  const SOSO_BASE = 'https://sososcan.io/api';

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (SOSO_KEY && SOSO_KEY !== 'demo') {
      headers['Authorization'] = SOSO_KEY;
    }

    const response = await fetch(`${SOSO_BASE}/${endpoint}`, { headers });

    if (!response.ok) throw new Error('SoSoValue API error: ' + response.status);

    const data = await response.json();
    return res.status(200).json(data);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
