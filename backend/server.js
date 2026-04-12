const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const { estimateComplexity } = require('./complexity-analyzer');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || '*'
}));
app.use(express.json());

// Default values
const DEFAULT_ANTHROPIC_MODEL = 'claude-3-5-sonnet-20241022';
const DEFAULT_JUDGE0_API_URL = 'https://ce.judge0.com';

// AI endpoint - sends prompt to Anthropic
app.post('/api/ai', async (req, res) => {
  try {
    const { prompt, language } = req.body;
    
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ 
        output: 'Error: Prompt is required and must be a string' 
      });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const model = process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL;

    if (!apiKey) {
      return res.status(500).json({ 
        output: 'Error: ANTHROPIC_API_KEY is not configured. Please set it in your environment variables.' 
      });
    }

    // Build the system message based on context
    let systemMessage = `You are an AI assistant integrated into an online code editor. 
Your job is to help users with their code. When the user sends code or a prompt, analyze it and provide helpful responses.
If the input looks like code, help explain, debug, or optimize it.
If the input is a natural language question, answer it helpfully.
Keep responses concise and focused.`;

    if (language) {
      systemMessage += ` The user is working with ${language}.`;
    }

    // Call Anthropic API
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: model,
        max_tokens: 4096,
        system: systemMessage,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        }
      }
    );

    // Extract the text from the response
    const output = response.data.content[0].text;
    
    res.json({ output });
  } catch (error) {
    console.error('AI request error:', error.response?.data || error.message);
    
    let errorMessage = 'Error: Failed to get AI response';
    
    if (error.response?.status === 401) {
      errorMessage = 'Error: Invalid ANTHROPIC_API_KEY. Please check your API key.';
    } else if (error.response?.status === 429) {
      errorMessage = 'Error: Rate limit exceeded. Please try again later.';
    } else if (error.response?.data?.error?.message) {
      errorMessage = `Error: ${error.response.data.error.message}`;
    } else if (error.message) {
      errorMessage = `Error: ${error.message}`;
    }
    
    res.status(error.response?.status || 500).json({ output: errorMessage });
  }
});

// Proxy endpoint for Judge0 submissions
app.post('/api/submit', async (req, res) => {
  try {
    const judge0Url = process.env.JUDGE0_API_URL || DEFAULT_JUDGE0_API_URL;
    const apiKey = process.env.JUDGE0_API_KEY || '';
    
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // Forward the request to Judge0
    const response = await axios.post(
      `${judge0Url}/submissions?base64_encoded=true&wait=false`,
      req.body,
      { headers }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Judge0 submission error:', error.message);
    res.status(error.response?.status || 500).json({
      error: error.message || 'Failed to submit to Judge0'
    });
  }
});

// Get submission result from Judge0
app.get('/api/submissions/:token', async (req, res) => {
  try {
    const judge0Url = process.env.JUDGE0_API_URL || DEFAULT_JUDGE0_API_URL;
    const apiKey = process.env.JUDGE0_API_KEY || '';
    
    const headers = {};
    
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await axios.get(
      `${judge0Url}/submissions/${req.params.token}?base64_encoded=true`,
      { headers }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Judge0 result error:', error.message);
    res.status(error.response?.status || 500).json({
      error: error.message || 'Failed to get submission result'
    });
  }
});

// Complexity estimator endpoint
app.post('/api/complexity', (req, res) => {
  try {
    console.log("[complexity] request received");

    const { language, code } = req.body || {};

    console.log("[complexity] language:", language);
    console.log("[complexity] code length:", code ? code.length : 0);

    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "code is required" });
    }

    if (language && language !== "cpp") {
      return res.json({
        complexity: "Unknown",
        confidence: 0.2,
        tleRisk: "Unknown",
        summary: "Complexity estimation is currently optimized for C++ only.",
        reasons: ["Current analyzer MVP supports C++ best"]
      });
    }

    const result = estimateComplexity(code);

    console.log("[complexity] result:", result.complexity);

    return res.json(result);
  } catch (error) {
    console.error("[complexity] error:", error);

    return res.status(500).json({
      error: "Failed to estimate complexity",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Environment variables:');
  console.log(`  - ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'set' : 'not set'}`);
  console.log(`  - ANTHROPIC_MODEL: ${process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL}`);
  console.log(`  - JUDGE0_API_URL: ${process.env.JUDGE0_API_URL || DEFAULT_JUDGE0_API_URL}`);
  console.log(`  - FRONTEND_ORIGIN: ${process.env.FRONTEND_ORIGIN || 'not set (allowing all)'}`);
});