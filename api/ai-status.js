// Vercel Serverless Function: /api/ai-status
const assistantService = require('../assistantService');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const config = assistantService.getAIConfig();
    return res.status(200).json({
      configured: config.configured,
      provider: config.provider,
      model: config.model
    });
  } catch (err) {
    console.error('Error in /api/ai-status serverless function:', err);
    return res.status(500).json({
      configured: false,
      error: err.message
    });
  }
};
