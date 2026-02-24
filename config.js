// api/config.js — Vercel Serverless Function
// This runs on Vercel's servers, NOT in the browser.
// It safely reads your secret env variable and sends it to your frontend.

export default function handler(req, res) {
  // Allow requests only from your own site (CORS protection)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ 
      error: 'API key not configured on server. Add GEMINI_API_KEY in Vercel Environment Variables.' 
    });
  }

  return res.status(200).json({ apiKey });
}
