export default async function handler(req, res) {
  const { type, id } = req.query;
  const baseUrl = process.env.SOSO_API_URL || 'https://api.sosovalue.com/v1'; 

  let endpoint = '';
  switch (type) {
    case 'treasury': endpoint = '/btc-treasuries'; break;
    case 'crypto-stocks': endpoint = '/crypto-stocks'; break;
    case 'currency': endpoint = id ? `/currencies/${id}/market-snapshot` : '/currencies'; break;
    case 'etf-flows': endpoint = '/etfs/summary-history'; break;
    case 'sector': endpoint = '/indexes'; break;
    default: return res.status(400).json({ error: 'Invalid type requested' });
  }

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${process.env.SOSO_API_KEY}`,
        // Some hackathon gateways require x-api-key instead of Bearer, adding both is safe
        'x-api-key': process.env.SOSO_API_KEY 
      }
    });
    
    // Pass the actual upstream error code (401, 404, etc.) to the frontend instead of generic 500
    if (!response.ok) {
        return res.status(response.status).json({ error: `Upstream error ${response.status}` });
    }

    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
