export default function handler(req, res) {
  res.json({ apiKey: process.env.GEMINI_API_KEY });
}
