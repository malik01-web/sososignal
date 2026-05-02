export default async function handler(req, res) {
  const { type, id } = req.query;
  
  // IMPORTANT: Set your base URL as an environment variable in Vercel. 
  // Fallback assumes the standard production v1 prefix.
  const baseUrl = process.env.SOSO_API_URL || 'https://api.sosovalue.com/v1'; 

  let endpoint = '';
  
  // Map frontend types to exact SoSoValue Endpoints
  switch (type) {
    case 'treasury':
      endpoint = '/btc-treasuries'; 
      break;
    case 'crypto-stocks':
      endpoint = '/crypto-stocks';
      break;
    case 'currency':
      // Requires ID as a path variable, not a query param
      endpoint = id ? `/currencies/${id}/market-snapshot` : '/currencies'; 
      break;
    case 'etf-flows':
      endpoint = '/etfs/summary-history'; 
      break;
    case 'sector':
      endpoint = '/indexes'; 
      break;
    default:
      return res.status(400).json({ error: 'Invalid type requested' });
  }

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      headers: {
        // Many hackathon APIs require an x-api-key header or Authorization Bearer
        'Authorization': `Bearer ${process.env.SOSO_API_KEY}` 
      }
    });
    
    if (!response.ok) throw new Error(`SoSoValue API returned ${response.status}`);
    const data = await response.json();
    
    // CACHE CONTROL: Crucial to avoid hitting the 20 req/min limit
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
