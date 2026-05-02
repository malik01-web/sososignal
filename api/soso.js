export default async function handler(req, res) {
  const { type, id } = req.query;
  const baseUrl = process.env.SOSO_API_URL || 'https://api.sosovalue.com/v1'; 
  const apiKey = process.env.SOSO_API_KEY;

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
        // Blanket coverage for common API key headers
        'Authorization': `Bearer ${apiKey}`,
        'x-api-key': apiKey,
        'API-Key': apiKey,
        'Apikey': apiKey
      }
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`SoSoValue ${type} Error (${response.status}):`, errorText);
        return res.status(response.status).json({ error: `SoSoValue Error: ${errorText}` });
    }

    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    res.status(200).json(data);
  } catch (error) {
    console.error("Fetch crash:", error);
    res.status(500).json({ error: error.message });
  }
}
