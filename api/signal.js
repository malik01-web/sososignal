export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { prompt } = req.body;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
            { role: 'system', content: 'You are OnchainEdge AI. Return ONLY a strict JSON object. Do not wrap in markdown blocks. No conversational text.' },
            { role: 'user', content: prompt }
        ],
        response_format: { type: "json_object" }, 
        temperature: 0.2
      })
    });

    if (!response.ok) {
        return res.status(response.status).json({ error: `Groq error ${response.status}` });
    }
    
    const data = await response.json();
    res.status(200).json({ result: data.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
