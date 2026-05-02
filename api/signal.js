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
        // Switched to a highly stable model
        model: 'mixtral-8x7b-32768', 
        messages: [
            { role: 'system', content: 'You are an AI data parser. Output JSON ONLY. Do not use markdown wrappers. Ensure it is valid JSON.' },
            { role: 'user', content: prompt }
        ],
        // Removed strict JSON formatting to prevent 400 crashes if Groq misinterprets the payload
        temperature: 0.2
      })
    });

    if (!response.ok) {
        // This will print EXACTLY why Groq is rejecting the request
        const errorText = await response.text();
        console.error(`Groq API Error (${response.status}):`, errorText);
        return res.status(response.status).json({ error: errorText });
    }
    
    const data = await response.json();
    res.status(200).json({ result: data.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
