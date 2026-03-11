export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    // Build keys array from all 60 env variables
    const keys = [
      process.env.GROQ_API_KEY,
      ...Array.from({length: 59}, (_, i) => process.env[`GROQ_KEY_${i + 2}`])
    ].filter(Boolean); // remove undefined/empty

    if (keys.length === 0) {
      return res.status(500).json({ error: 'No API keys configured' });
    }

    // Try each key until one works
    let lastError = null;
    for (let i = 0; i < keys.length; i++) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${keys[i]}`
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages,
            temperature: 0.82,
            max_tokens: 2048
          })
        });

        const data = await groqRes.json();

        // If rate limited or key dead, try next key
        if (groqRes.status === 429 || groqRes.status === 401) {
          console.log(`Key ${i + 1} failed (${groqRes.status}), trying next...`);
          lastError = data.error?.message || `Key ${i+1} failed`;
          continue;
        }

        if (!groqRes.ok) {
          lastError = data.error?.message || 'Groq error';
          continue;
        }

        // Success!
        return res.status(200).json(data);

      } catch (err) {
        console.log(`Key ${i + 1} threw error: ${err.message}`);
        lastError = err.message;
        continue;
      }
    }

    // All keys failed
    return res.status(429).json({ error: 'All keys exhausted: ' + lastError });

  } catch (err) {
    console.error('Handler error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
