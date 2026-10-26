// Vercel Serverless Function: /api/assistant
const assistantService = require('../assistantService');

module.exports = async function handler(req, res) {
  // CORS Preflight headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    });
  }

  try {
    let payload = req.body;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        payload = {};
      }
    }
    payload = payload || {};

    const result = await assistantService.handleAssistantRequest(payload);
    return res.status(200).json({
      success: true,
      reply: result.reply,
      provider: result.provider,
      configured: result.configured,
      warning: result.warning || null
    });
  } catch (err) {
    console.error('Error in /api/assistant serverless function:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error processing assistant query'
    });
  }
};
