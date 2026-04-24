const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
require("dotenv").config();

const { estimateComplexity } = require("./complexity-tree-sitter");

const app = express();
const PORT = process.env.PORT || 3001;
const DEFAULT_ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022";
const DEFAULT_JUDGE0_API_URL = "https://ce.judge0.com";

app.use(cors({
    origin: process.env.FRONTEND_ORIGIN || "*"
}));
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "..")));

function getAnthropicConfig() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        const error = new Error("ANTHROPIC_API_KEY is not configured.");
        error.status = 500;
        throw error;
    }

    return {
        apiKey,
        model: process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL
    };
}

function normalizeAnthropicMessages(messages = []) {
    return messages
        .filter(message => message && ["user", "assistant"].includes(message.role) && typeof message.content === "string" && message.content.trim())
        .map(message => ({
            role: message.role,
            content: message.content.trim()
        }));
}

async function callAnthropic({ system, messages, maxTokens = 1800, temperature = 0.2 }) {
    const { apiKey, model } = getAnthropicConfig();

    const response = await axios.post("https://api.anthropic.com/v1/messages", {
        model,
        max_tokens: maxTokens,
        temperature,
        system,
        messages
    }, {
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01"
        }
    });

    return response.data.content?.map(item => item.text || "").join("\n").trim();
}

function buildContextBlock(context = {}) {
    const tests = Array.isArray(context.tests) ? context.tests.slice(0, 8) : [];

    return [
        `Language: ${context.language || "Unknown"}`,
        `Problem statement:\n${context.problem || "(none)"}`,
        `Current code:\n${context.code || "(empty)"}`,
        `Current stdin:\n${context.input || "(empty)"}`,
        `Current output:\n${context.output || "(empty)"}`,
        `Tests:\n${tests.length ? JSON.stringify(tests, null, 2) : "(none)"}`
    ].join("\n\n");
}

function handleAnthropicError(res, error, fallbackMessage) {
    console.error("[anthropic]", error.response?.data || error.message);

    let message = fallbackMessage;
    if (error.response?.status === 401) {
        message = "Invalid ANTHROPIC_API_KEY.";
    } else if (error.response?.status === 429) {
        message = "Anthropic rate limit exceeded.";
    } else if (error.response?.data?.error?.message) {
        message = error.response.data.error.message;
    } else if (error.message) {
        message = error.message;
    }

    res.status(error.status || error.response?.status || 500).json({ output: message, error: message });
}

app.post("/api/ai", async (req, res) => {
    try {
        const { prompt, language } = req.body || {};
        if (!prompt || typeof prompt !== "string") {
            return res.status(400).json({ output: "Prompt is required and must be a string." });
        }

        const system = [
            "You are an AI assistant integrated into an online coding IDE.",
            "Help the user with coding, debugging, explanation, algorithm choice, and test design.",
            "Keep answers concise and useful.",
            language ? `The user is working in ${language}.` : ""
        ].filter(Boolean).join(" ");

        const output = await callAnthropic({
            system,
            messages: [{ role: "user", content: prompt }],
            maxTokens: 1500
        });

        res.json({ output });
    } catch (error) {
        handleAnthropicError(res, error, "Failed to get AI response.");
    }
});

app.post("/api/assistant/chat", async (req, res) => {
    try {
        const { messages, context } = req.body || {};
        const normalizedMessages = normalizeAnthropicMessages(messages);

        if (normalizedMessages.length === 0) {
            return res.status(400).json({ output: "At least one chat message is required." });
        }

        const system = [
            "You are Claude acting as a side copilot inside a competitive programming IDE.",
            "Be direct, technically strong, and context-aware.",
            "When useful, reference the user's current code, tests, problem statement, and latest output.",
            "Prefer actionable help over generic advice.",
            "If the user asks for fixes, propose exact changes or snippets."
        ].join(" ");

        const output = await callAnthropic({
            system: `${system}\n\nIDE context:\n${buildContextBlock(context)}`,
            messages: normalizedMessages,
            maxTokens: 2000
        });

        res.json({ output });
    } catch (error) {
        handleAnthropicError(res, error, "Failed to get assistant reply.");
    }
});

app.post("/api/assistant/action", async (req, res) => {
    try {
        const { action, context } = req.body || {};
        if (!action || typeof action !== "string") {
            return res.status(400).json({ output: "Action is required." });
        }

        const prompts = {
            review: "Perform a code review. Prioritize bugs, hidden edge cases, performance risks, and missing tests. Start with findings.",
            explain: "Explain what the current code does, the algorithm, important data structures, and likely corner cases.",
            optimize: "Propose a stronger version of this solution. Focus on runtime, clarity, and contest robustness. Include improved code only if necessary.",
            explain_complexity: "Explain the asymptotic complexity of the current code with reasoning tied to loops, data structures, and dominant operations."
        };

        const userPrompt = prompts[action];
        if (!userPrompt) {
            return res.status(400).json({ output: `Unsupported action: ${action}` });
        }

        const output = await callAnthropic({
            system: [
                "You are Claude inside an online coding IDE.",
                "Respond to the requested action using the current IDE context.",
                "Be specific and technically precise."
            ].join(" "),
            messages: [{
                role: "user",
                content: `${userPrompt}\n\nIDE context:\n${buildContextBlock(context)}`
            }],
            maxTokens: 2200
        });

        res.json({ output });
    } catch (error) {
        handleAnthropicError(res, error, "Failed to run assistant action.");
    }
});

app.post("/api/complexity-ai", async (req, res) => {
    try {
        const { code, language, problem } = req.body || {};
        if (!code || typeof code !== "string") {
            return res.status(400).json({ error: "Code is required." });
        }

        const output = await callAnthropic({
            system: [
                "You are a strict asymptotic complexity classifier.",
                "Return only the final time complexity in standard Big-O notation.",
                "Examples: O(1), O(log n), O(n), O(n log n), O(n^2), O(V + E), O((V + E) log V).",
                "Do not include explanation, punctuation, labels, or extra words.",
                "If the code is too ambiguous, return Unknown."
            ].join(" "),
            messages: [{
                role: "user",
                content: `Language: ${language || "Unknown"}\nProblem:\n${problem || "(none)"}\n\nCode:\n${code}`
            }],
            maxTokens: 80,
            temperature: 0
        });

        const normalized = output.trim().replace(/\s+/g, " ");
        const match = normalized.match(/^Unknown$|^O\([^)]+\)$/);
        res.json({ complexity: match ? match[0] : normalized });
    } catch (error) {
        handleAnthropicError(res, error, "Failed to estimate complexity.");
    }
});

app.post("/api/cp-solve", async (req, res) => {
    try {
        const { problem } = req.body || {};
        if (!problem || typeof problem !== "string") {
            return res.status(400).json({ output: "Problem statement is required and must be a string." });
        }

        const output = await callAnthropic({
            system: [
                "You are an expert competitive programmer.",
                "Write a complete C++ solution in concise contest style.",
                "Return raw code only without markdown fences or commentary."
            ].join(" "),
            messages: [{
                role: "user",
                content: `Solve this problem and return only the code:\n\n${problem}`
            }],
            maxTokens: 2600
        });

        res.json({ output });
    } catch (error) {
        handleAnthropicError(res, error, "Failed to get CP solution.");
    }
});

app.post("/api/submit", async (req, res) => {
    try {
        const judge0Url = process.env.JUDGE0_API_URL || DEFAULT_JUDGE0_API_URL;
        const apiKey = process.env.JUDGE0_API_KEY || "";
        const headers = { "Content-Type": "application/json" };

        if (apiKey) {
            headers.Authorization = `Bearer ${apiKey}`;
        }

        const response = await axios.post(
            `${judge0Url}/submissions?base64_encoded=true&wait=false`,
            req.body,
            { headers }
        );

        res.json(response.data);
    } catch (error) {
        console.error("[judge0 submit]", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: error.message || "Failed to submit to Judge0"
        });
    }
});

app.get("/api/submissions/:token", async (req, res) => {
    try {
        const judge0Url = process.env.JUDGE0_API_URL || DEFAULT_JUDGE0_API_URL;
        const apiKey = process.env.JUDGE0_API_KEY || "";
        const headers = {};

        if (apiKey) {
            headers.Authorization = `Bearer ${apiKey}`;
        }

        const response = await axios.get(
            `${judge0Url}/submissions/${req.params.token}?base64_encoded=true`,
            { headers }
        );

        res.json(response.data);
    } catch (error) {
        console.error("[judge0 result]", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: error.message || "Failed to get submission result"
        });
    }
});

app.post("/api/complexity", (req, res) => {
    try {
        const { language, code } = req.body || {};
        if (!code || typeof code !== "string") {
            return res.status(400).json({ error: "code is required" });
        }

        if (language && language !== "cpp") {
            return res.json({
                complexity: "Unknown",
                confidence: 0.2,
                tleRisk: "Unknown",
                summary: "Heuristic estimator currently targets C++ best.",
                reasons: ["Current local analyzer is optimized for C++."]
            });
        }

        return res.json(estimateComplexity(code));
    } catch (error) {
        console.error("[complexity heuristic]", error);
        return res.status(500).json({
            error: "Failed to estimate complexity",
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "index.html"));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? "set" : "not set"}`);
    console.log(`ANTHROPIC_MODEL: ${process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL}`);
    console.log(`JUDGE0_API_URL: ${process.env.JUDGE0_API_URL || DEFAULT_JUDGE0_API_URL}`);
});
