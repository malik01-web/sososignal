export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192', // Active fast Groq model
        messages: [
            { 
                role: 'system', 
                // System prompt ensures the output doesn't break your UI parser
                content: 'You are OnchainEdge AI. Return ONLY a strict JSON object. Do not wrap in markdown blocks. No conversational text.' 
            },
            { role: 'user', content: prompt }
        ],
        // Forces the LLM to output valid JSON matching your frontend's requirements
        response_format: { type: "json_object" }, 
        temperature: 0.2 // Lowered temperature for consistent, analytical responses
      })
    });

    if (!response.ok) throw new Error(`Groq API returned ${response.status}`);
    
    const data = await response.json();
    const result = data.choices[0].message.content;
    
    res.status(200).json({ result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
