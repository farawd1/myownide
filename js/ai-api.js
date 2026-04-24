"use strict";

const DEFAULT_API_BASE_URL = "http://localhost:3001";

const API_BASE_URL = typeof window !== "undefined" && window.location?.hostname
    ? (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? DEFAULT_API_BASE_URL
        : `${window.location.origin}`)
    : DEFAULT_API_BASE_URL;

async function request(path, body) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.output || data.error || data.details || "Request failed");
    }

    return data;
}

const aiApi = {
    sendPrompt(prompt, language = null) {
        return request("/api/ai", { prompt, language });
    },
    sendAssistantChat(messages, context) {
        return request("/api/assistant/chat", { messages, context });
    },
    runAssistantAction(action, context) {
        return request("/api/assistant/action", { action, context });
    },
    getComplexity(code, language, problem) {
        return request("/api/complexity-ai", { code, language, problem });
    },
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
