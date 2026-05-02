export default async function handler(req, res) {
  // Stripped back exactly to what the whitepaper showed
  const sodexUrl = 'https://mainnet-gw.sodex.dev/api/v1/spot';
  
  try {
    const response = await fetch(sodexUrl);
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`SoDEX Error (${response.status}):`, errorText);
        return res.status(response.status).json({ error: `SoDEX Error: ${errorText}` });
    }
    
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
