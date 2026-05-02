export default async function handler(req, res) {
  const { type } = req.query; // Frontend requests ?type=tickers
  
  // Appending the path to the base REST URL
  const endpoint = type || 'tickers';
  const sodexUrl = `https://mainnet-gw.sodex.dev/api/v1/spot/${endpoint}`;
  
  try {
    const response = await fetch(sodexUrl);
    
    if (!response.ok) {
        return res.status(response.status).json({ error: `SoDEX error ${response.status}` });
    }
    
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
