"use strict";

// Default API base URL - can be overridden via environment variables
const DEFAULT_API_BASE_URL = 'http://localhost:3001';

// Try to get API base URL from environment or use default
const API_BASE_URL = typeof process !== 'undefined' && process.env?.API_BASE_URL 
    ? process.env.API_BASE_URL 
    : DEFAULT_API_BASE_URL;

const aiApi = {
    /**
     * Send a prompt to the AI backend and get the response
     * @param {string} prompt - The text to send to AI
     * @param {string} language - Optional language identifier
     * @returns {Promise<{output: string}>}
     */
    async sendPrompt(prompt, language = null) {
        const response = await fetch(`${API_BASE_URL}/api/ai`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt,
                language: language
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.output || 'AI request failed');
        }
        
        return response.json();
    },
    
    /**
     * Check if the backend is available
     * @returns {Promise<boolean>}
     */
    async isBackendAvailable() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/health`);
            return response.ok;
        } catch {
            return false;
        }
    }
};

export default aiApi;
export { API_BASE_URL };