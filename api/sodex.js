export default async function handler(req, res) {
  // Official SoDEX Mainnet REST Endpoint for Spot Markets
  const sodexUrl = 'https://mainnet-gw.sodex.dev/api/v1/spot';
  
  try {
    const response = await fetch(sodexUrl);
    if (!response.ok) throw new Error(`SoDEX API returned ${response.status}`);
    
    const data = await response.json();
    
    // Cache for 30 seconds to keep live markets responsive but safe
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
