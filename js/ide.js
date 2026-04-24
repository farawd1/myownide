import aiApi from "./ai-api.js";

const CE = "CE";
const EXTRA_CE = "EXTRA_CE";
const INITIAL_WAIT_TIME_MS = 250;
const MAX_PROBE_REQUESTS = 240;
const DEFAULT_LANGUAGE_ID = 105;
const APPEARANCE_STORAGE_KEY = "myownide.appearance";

const AUTHENTICATED_BASE_URL = {
    [CE]: "https://ce.judge0.com",
    [EXTRA_CE]: "https://extra-ce.judge0.com"
};

const UNAUTHENTICATED_BASE_URL = {
    [CE]: "https://ce.judge0.com",
    [EXTRA_CE]: "https://extra-ce.judge0.com"
};

const EXTENSIONS_TABLE = {
    asm: { flavor: CE, language_id: 45 },
    c: { flavor: CE, language_id: 103 },
    cpp: { flavor: CE, language_id: 105 },
    cs: { flavor: EXTRA_CE, language_id: 29 },
    go: { flavor: CE, language_id: 95 },
    java: { flavor: CE, language_id: 91 },
    js: { flavor: CE, language_id: 102 },
    lua: { flavor: CE, language_id: 64 },
    pas: { flavor: CE, language_id: 67 },
    php: { flavor: CE, language_id: 98 },
    py: { flavor: EXTRA_CE, language_id: 25 },
    r: { flavor: CE, language_id: 99 },
    rb: { flavor: CE, language_id: 72 },
    rs: { flavor: CE, language_id: 73 },
    scala: { flavor: CE, language_id: 81 },
    sh: { flavor: CE, language_id: 46 },
    swift: { flavor: CE, language_id: 83 },
    ts: { flavor: CE, language_id: 101 },
    txt: { flavor: CE, language_id: 43 }
};

const state = {
    sourceEditor: null,
    stdinEditor: null,
    stdoutEditor: null,
    languageDetails: {},
    currentFilename: "main.cpp",
    sqliteAdditionalFiles: null,
    lastStressInput: "",
    lastRunReviewContext: null,
    appearance: {
        theme: "dark",
        accentColor: "#f59e0b",
        fontSize: 14,
        fontFamily: "JetBrains Mono"
    }
};

const elements = {};

function encode(str) {
    return btoa(unescape(encodeURIComponent(str || "")));
}

function decode(str) {
    if (!str) {
        return "";
    }

    try {
        return decodeURIComponent(escape(atob(str)));
    } catch {
        return str;
    }
}

function showModal(title, content) {
    $("#judge0-site-modal #title").text(title);
    $("#judge0-site-modal .content").html(content);
    $("#judge0-site-modal").modal("show");
}

function setStatus(message) {
    elements.statusLine.textContent = message;
}

function setReviewButtonVisible(visible) {
    elements.reviewCodeBtn.hidden = !visible;
    elements.reviewCodeBtn.disabled = !visible;
}

function getSelectedLanguageId() {
    return Number(elements.languageSelect.value);
}

function getSelectedLanguageFlavor() {
    return elements.languageSelect.selectedOptions[0]?.getAttribute("flavor") || CE;
}

function getSelectedLanguageName() {
    return elements.languageSelect.selectedOptions[0]?.textContent || "C++";
}

function getEditorLanguageMode(languageName) {
    const table = {
        Bash: "shell",
        C: "c",
        C3: "c",
        "C#": "csharp",
        "C++": "cpp",
        Go: "go",
        Java: "java",
        JavaScript: "javascript",
        Kotlin: "kotlin",
        Lua: "lua",
        Pascal: "pascal",
        PHP: "php",
        Python: "python",
        R: "r",
        Ruby: "ruby",
        Rust: "rust",
        Scala: "scala",
        SQL: "sql",
        Swift: "swift",
        TypeScript: "typescript"
    };

    for (const [key, mode] of Object.entries(table)) {
        if (languageName.toLowerCase().startsWith(key.toLowerCase())) {
            return mode;
        }
    }

    return "plaintext";
}

function getLanguageForExtension(extension) {
    return EXTENSIONS_TABLE[extension] || { flavor: CE, language_id: 43 };
}

function loadAppearance() {
    try {
        const saved = JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY) || "{}");
        state.appearance = {
            ...state.appearance,
            ...saved
        };
    } catch {
        state.appearance = { ...state.appearance };
    }
}

function persistAppearance() {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(state.appearance));
}

function updateAppearanceControls() {
    elements.themeSelect.value = state.appearance.theme;
    elements.accentColor.value = state.appearance.accentColor;
    elements.fontSize.value = String(state.appearance.fontSize);
    elements.fontSizeValue.textContent = `${state.appearance.fontSize}px`;
    elements.fontFamily.value = state.appearance.fontFamily;
}

function applyAppearance() {
    document.body.dataset.theme = state.appearance.theme;
    document.documentElement.style.setProperty("--accent", state.appearance.accentColor);
    document.documentElement.style.setProperty("--accent-strong", state.appearance.accentColor);

    const editorTheme = state.appearance.theme === "dark" ? "vs-dark" : "vs";
    [state.sourceEditor, state.stdinEditor, state.stdoutEditor].forEach(editor => {
        if (editor) {
            editor.updateOptions({
                fontSize: state.appearance.fontSize,
                fontFamily: state.appearance.fontFamily
            });
        }
    });

    if (typeof monaco !== "undefined") {
        monaco.editor.setTheme(editorTheme);
    }

    const themeMeta = document.querySelector("meta[name='theme-color']");
    if (themeMeta) {
        themeMeta.setAttribute("content", state.appearance.theme === "dark" ? "#111827" : "#ffffff");
    }
}

function toggleAppearancePanel(forceOpen = null) {
    const shouldOpen = forceOpen === null
        ? !elements.appearancePanel.classList.contains("is-open")
        : forceOpen;

    elements.appearancePanel.classList.toggle("is-open", shouldOpen);
}

async function loadLanguageDetail(flavor, languageId) {
    const key = `${flavor}:${languageId}`;
    if (state.languageDetails[key]) {
        return state.languageDetails[key];
    }

    const response = await fetch(`${UNAUTHENTICATED_BASE_URL[flavor]}/languages/${languageId}`);
    const data = await response.json();
    state.languageDetails[key] = data;
    return data;
}

async function handleLanguageChange() {
    const languageName = getSelectedLanguageName();
    monaco.editor.setModelLanguage(state.sourceEditor.getModel(), getEditorLanguageMode(languageName));
    const detail = await loadLanguageDetail(getSelectedLanguageFlavor(), getSelectedLanguageId());
    state.currentFilename = detail.source_file || state.currentFilename;
}

async function loadLanguages() {
    const [ceResponse, extraResponse] = await Promise.all([
        fetch(`${UNAUTHENTICATED_BASE_URL[CE]}/languages`),
        fetch(`${UNAUTHENTICATED_BASE_URL[EXTRA_CE]}/languages`)
    ]);
    const [ceLanguages, extraLanguages] = await Promise.all([ceResponse.json(), extraResponse.json()]);

    const options = [];

    ceLanguages.forEach(language => {
        if (language.id !== 89) {
            options.push({ ...language, flavor: CE });
        }
    });

    extraLanguages.forEach(language => {
        if (language.id !== 89 && !options.some(item => item.name === language.name)) {
            options.push({ ...language, flavor: EXTRA_CE });
        }
    });

    options.sort((a, b) => a.name.localeCompare(b.name));

    options.forEach(language => {
        const option = document.createElement("option");
        option.value = language.id;
        option.textContent = language.name;
        option.setAttribute("flavor", language.flavor);
        elements.languageSelect.appendChild(option);
    });

    elements.languageSelect.value = String(DEFAULT_LANGUAGE_ID);
    $("#select-language").dropdown();
    await handleLanguageChange();
}

async function submitToJudge0(sourceCode, stdin) {
    const languageId = getSelectedLanguageId();
    const flavor = getSelectedLanguageFlavor();
    const payload = {
        source_code: languageId === 44 ? sourceCode : encode(sourceCode),
        language_id: languageId,
        stdin: encode(stdin),
        redirect_stderr_to_stdout: true
    };

    if (languageId === 82) {
        if (!state.sqliteAdditionalFiles) {
            const response = await fetch("./data/additional_files_zip_base64.txt");
            state.sqliteAdditionalFiles = await response.text();
        }
        payload.additional_files = state.sqliteAdditionalFiles;
    }

    const response = await fetch(`${AUTHENTICATED_BASE_URL[flavor]}/submissions?base64_encoded=true&wait=false`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`Judge0 submit failed with status ${response.status}`);
    }

    const data = await response.json();
    return { flavor, token: data.token };
}

async function pollSubmission(flavor, token, iteration = 0) {
    if (iteration >= MAX_PROBE_REQUESTS) {
        throw new Error("Maximum number of probe requests reached.");
    }

    const response = await fetch(`${UNAUTHENTICATED_BASE_URL[flavor]}/submissions/${token}?base64_encoded=true`);

    if (!response.ok) {
        throw new Error(`Judge0 poll failed with status ${response.status}`);
    }

    const data = await response.json();

    if (data.status?.id <= 2) {
        await new Promise(resolve => setTimeout(resolve, INITIAL_WAIT_TIME_MS + iteration * 60));
        return pollSubmission(flavor, token, iteration + 1);
    }

    return data;
}

function formatExecutionResult(data) {
    const output = [decode(data.compile_output), decode(data.stdout), decode(data.stderr)]
        .filter(Boolean)
        .join("\n")
        .trim();

    return {
        statusId: data.status?.id ?? null,
        status: data.status?.description || "Unknown",
        output,
        time: data.time ?? "-",
        memory: data.memory ?? "-"
    };
}

function shouldOfferReview(result) {
    const reviewableStatusIds = new Set([5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    const reviewableStatusNames = new Set([
        "Compilation Error",
        "Runtime Error (NZEC)",
        "Runtime Error (SIGSEGV)",
        "Runtime Error (SIGXFSZ)",
        "Runtime Error (SIGFPE)",
        "Runtime Error (SIGABRT)",
        "Runtime Error (NZEC)",
        "Runtime Error",
        "Time Limit Exceeded",
        "Internal Error",
        "Exec Format Error"
    ]);

    if (!result) {
        return false;
    }

    if (result.statusId && reviewableStatusIds.has(result.statusId)) {
        return true;
    }

    if (result.status && reviewableStatusNames.has(result.status)) {
        return true;
    }

    return /^run error:/i.test(result.output || "");
}

async function reviewCurrentCode() {
    if (!state.lastRunReviewContext) {
        showModal("Review Code", "Сначала запустите код и дождитесь ошибки, после этого появится разбор.");
        return;
    }

    try {
        elements.reviewCodeBtn.classList.add("loading");
        setStatus("ИИ анализирует ошибку...");
        const prompt = [
            "Проанализируй ошибку в коде и объясни, как её исправить.",
            "Ответь на русском языке.",
            "Структура ответа:",
            "1. В чем причина ошибки",
            "2. Что именно исправить",
            "3. Исправленный фрагмент или идея исправления",
            "",
            `Язык: ${state.lastRunReviewContext.language}`,
            `Статус запуска: ${state.lastRunReviewContext.status}`,
            "",
            "Код:",
            state.lastRunReviewContext.code,
            "",
            "Ввод:",
            state.lastRunReviewContext.stdin || "(пусто)",
            "",
            "Вывод/ошибка:",
            state.lastRunReviewContext.output || "(пусто)"
        ].join("\n");

        const result = await aiApi.sendPrompt(prompt, state.lastRunReviewContext.language);
        showModal("AI Review Code", `<div style="white-space: pre-wrap;">${$("<div>").text(result.output || "").html()}</div>`);
        setStatus("ИИ подготовил разбор ошибки");
    } catch (error) {
        showModal("AI Review Code", `<div style="white-space: pre-wrap;">${$("<div>").text(error.message).html()}</div>`);
        setStatus("Не удалось получить разбор ошибки");
    } finally {
        elements.reviewCodeBtn.classList.remove("loading");
    }
}

async function runCode(stdin = state.stdinEditor.getValue()) {
    const sourceCode = state.sourceEditor.getValue().trim();

    if (!sourceCode) {
        showModal("Run Error", "Source code cannot be empty.");
        return;
    }

    try {
        elements.runBtn.classList.add("loading");
        setReviewButtonVisible(false);
        state.lastRunReviewContext = null;
        setStatus("Running...");
        const { flavor, token } = await submitToJudge0(state.sourceEditor.getValue(), stdin);
        const submission = await pollSubmission(flavor, token);
        const result = formatExecutionResult(submission);
        state.stdoutEditor.setValue(result.output || result.status);
        setStatus(`${result.status} | ${result.time}s | ${result.memory}KB`);

        if (shouldOfferReview(result)) {
            state.lastRunReviewContext = {
                language: getSelectedLanguageName(),
                status: result.status,
                code: state.sourceEditor.getValue(),
                stdin,
                output: result.output || result.status
            };
            setReviewButtonVisible(true);
        }
    } catch (error) {
        state.stdoutEditor.setValue(`Run error:\n${error.message}`);
        state.lastRunReviewContext = {
            language: getSelectedLanguageName(),
            status: "Run error",
            code: state.sourceEditor.getValue(),
            stdin,
            output: `Run error:\n${error.message}`
        };
        setReviewButtonVisible(true);
        setStatus("Run failed");
    } finally {
        elements.runBtn.classList.remove("loading");
    }
}

async function analyzeComplexity() {
    const code = state.sourceEditor.getValue().trim();
    if (!code) {
        elements.complexityResult.textContent = "Editor is empty.";
        return;
    }

    try {
        elements.complexityBtn.classList.add("loading");
        setStatus("Analyzing complexity...");
        const result = await aiApi.getComplexity(code, getSelectedLanguageName(), "");
        elements.complexityResult.textContent = result.complexity || "Unknown";
        setStatus("Complexity analyzed");
    } catch (error) {
        elements.complexityResult.textContent = `Error: ${error.message}`;
        setStatus("Complexity failed");
    } finally {
        elements.complexityBtn.classList.remove("loading");
    }
}

function buildArray(values) {
    return `${values.length}\n${values.join(" ")}\n`;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getStressConfig() {
    const size = Math.max(0, Number(elements.stressSize.value) || 0);
    let min = Number(elements.stressMin.value);
    let max = Number(elements.stressMax.value);

    if (min > max) {
        [min, max] = [max, min];
    }

    return { size, min, max };
}

function generateStressPreset(kind) {
    const { size, min, max } = getStressConfig();
    let values = [];

    switch (kind) {
        case "empty":
            values = [];
            break;
        case "zeros":
            values = Array(size).fill(0);
            break;
        case "negative":
            values = Array.from({ length: size }, () => -Math.abs(randomInt(Math.min(min, -1), Math.max(max, 1))));
            break;
        case "increasing":
            values = Array.from({ length: size }, (_, index) => min + index);
            break;
        case "decreasing":
            values = Array.from({ length: size }, (_, index) => max - index);
            break;
        case "constant":
            values = Array(size).fill(randomInt(min, max));
            break;
        case "alternating":
            values = Array.from({ length: size }, (_, index) => index % 2 === 0 ? max : min);
            break;
        case "duplicates":
            values = Array.from({ length: size }, () => randomInt(min, Math.min(max, min + 2)));
            break;
        case "single":
            values = [randomInt(min, max)];
            break;
        case "random":
        default:
            values = Array.from({ length: size }, () => randomInt(min, max));
            break;
    }

    const input = buildArray(values);
    state.lastStressInput = input;
    elements.stressPreview.textContent = input;
}

function replaceInputWithStress() {
    if (!state.lastStressInput) {
        generateStressPreset("random");
    }
    state.stdinEditor.setValue(state.lastStressInput);
}

function appendInputWithStress() {
    if (!state.lastStressInput) {
        generateStressPreset("random");
    }

    const current = state.stdinEditor.getValue().trimEnd();
    const next = state.lastStressInput.trim();
    const joined = current ? `${current}\n${next}\n` : `${next}\n`;
    state.stdinEditor.setValue(joined);
}

function openFile(content, filename) {
    state.sourceEditor.setValue(content);
    state.currentFilename = filename;
    const extension = (filename.split(".").pop() || "").toLowerCase();
    const language = getLanguageForExtension(extension);
    selectLanguageByFlavorAndId(language.language_id, language.flavor);
}

function saveFile(content, filename) {
    const blob = new Blob([content], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
}

function selectLanguageByFlavorAndId(languageId, flavor) {
    const option = [...elements.languageSelect.options].find(item => Number(item.value) === Number(languageId) && item.getAttribute("flavor") === flavor);
    if (!option) {
        return;
    }

    elements.languageSelect.value = option.value;
    elements.languageSelect.dispatchEvent(new Event("change"));
}

function createEditors() {
    state.sourceEditor = monaco.editor.create(elements.sourceEditor, {
        value: DEFAULT_SOURCE,
        language: "cpp",
        theme: "vs-dark",
        automaticLayout: true,
        fontFamily: state.appearance.fontFamily,
        fontSize: state.appearance.fontSize,
        minimap: { enabled: false }
    });

    state.stdinEditor = monaco.editor.create(elements.stdinEditor, {
        value: DEFAULT_STDIN,
        language: "plaintext",
        theme: "vs-dark",
        automaticLayout: true,
        fontFamily: state.appearance.fontFamily,
        fontSize: Math.max(12, state.appearance.fontSize - 1),
        minimap: { enabled: false }
    });

    state.stdoutEditor = monaco.editor.create(elements.stdoutEditor, {
        value: "",
        language: "plaintext",
        theme: "vs-dark",
        readOnly: true,
        automaticLayout: true,
        fontFamily: state.appearance.fontFamily,
        fontSize: Math.max(12, state.appearance.fontSize - 1),
        minimap: { enabled: false }
    });
}

function bindEvents() {
    elements.languageSelect.addEventListener("change", handleLanguageChange);
    elements.runBtn.addEventListener("click", () => runCode());
    elements.openFileBtn.addEventListener("click", () => elements.openFileInput.click());
    elements.saveBtn.addEventListener("click", () => saveFile(state.sourceEditor.getValue(), state.currentFilename));
    elements.reviewCodeBtn.addEventListener("click", reviewCurrentCode);
    elements.appearanceBtn.addEventListener("click", () => toggleAppearancePanel(true));
    elements.closeAppearanceBtn.addEventListener("click", () => toggleAppearancePanel(false));
    elements.appearancePanel.addEventListener("click", event => {
        if (event.target === elements.appearancePanel) {
            toggleAppearancePanel(false);
        }
    });

    elements.themeSelect.addEventListener("change", () => {
        state.appearance.theme = elements.themeSelect.value;
        persistAppearance();
        applyAppearance();
    });

    elements.accentColor.addEventListener("input", () => {
        state.appearance.accentColor = elements.accentColor.value;
        persistAppearance();
        applyAppearance();
    });

    elements.fontSize.addEventListener("input", () => {
        state.appearance.fontSize = Number(elements.fontSize.value);
        elements.fontSizeValue.textContent = `${state.appearance.fontSize}px`;
        persistAppearance();
        applyAppearance();
    });

    elements.fontFamily.addEventListener("change", () => {
        state.appearance.fontFamily = elements.fontFamily.value;
        persistAppearance();
        applyAppearance();
    });

    elements.openFileInput.addEventListener("change", event => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = loadEvent => openFile(loadEvent.target.result, file.name);
        reader.readAsText(file);
        event.target.value = "";
    });

    elements.complexityBtn.addEventListener("click", analyzeComplexity);
    elements.runStressBtn.addEventListener("click", () => runCode(state.stdinEditor.getValue()));
    elements.generateStressBtn.addEventListener("click", () => generateStressPreset(elements.stressPresetSelect.value));
    elements.replaceInputBtn.addEventListener("click", replaceInputWithStress);
    elements.appendInputBtn.addEventListener("click", appendInputWithStress);
    elements.stressPresetSelect.addEventListener("change", () => generateStressPreset(elements.stressPresetSelect.value));

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            toggleAppearancePanel(false);
        }

        if (event.ctrlKey || event.metaKey) {
            switch (event.key) {
                case "Enter":
                    event.preventDefault();
                    runCode();
                    break;
                case "s":
                    event.preventDefault();
                    saveFile(state.sourceEditor.getValue(), state.currentFilename);
                    break;
                case "o":
                    event.preventDefault();
                    elements.openFileInput.click();
                    break;
                case ",":
                    event.preventDefault();
                    toggleAppearancePanel();
                    break;
                case "C":
                    if (event.shiftKey) {
                        event.preventDefault();
                        analyzeComplexity();
                    }
                    break;
                default:
                    break;
            }
        }
    });
}

function cacheElements() {
    elements.languageSelect = document.getElementById("select-language");
    elements.runBtn = document.getElementById("run-btn");
    elements.openFileBtn = document.getElementById("open-file-btn");
    elements.saveBtn = document.getElementById("save-btn");
    elements.reviewCodeBtn = document.getElementById("review-code-btn");
    elements.appearanceBtn = document.getElementById("appearance-btn");
    elements.closeAppearanceBtn = document.getElementById("close-appearance-btn");
    elements.appearancePanel = document.getElementById("appearance-panel");
    elements.themeSelect = document.getElementById("theme-select");
    elements.accentColor = document.getElementById("accent-color");
    elements.fontSize = document.getElementById("font-size");
    elements.fontSizeValue = document.getElementById("font-size-value");
    elements.fontFamily = document.getElementById("font-family");
    elements.sourceEditor = document.getElementById("source-editor");
    elements.stdinEditor = document.getElementById("stdin-editor");
    elements.stdoutEditor = document.getElementById("stdout-editor");
    elements.statusLine = document.getElementById("status-line");
    elements.complexityBtn = document.getElementById("complexity-btn");
    elements.complexityResult = document.getElementById("complexity-result");
    elements.stressSize = document.getElementById("stress-size");
    elements.stressMin = document.getElementById("stress-min");
    elements.stressMax = document.getElementById("stress-max");
    elements.stressPresetSelect = document.getElementById("stress-preset-select");
    elements.runStressBtn = document.getElementById("run-stress-btn");
    elements.generateStressBtn = document.getElementById("generate-stress-btn");
    elements.replaceInputBtn = document.getElementById("replace-input-btn");
    elements.appendInputBtn = document.getElementById("append-input-btn");
    elements.stressPreview = document.getElementById("stress-preview");
    elements.openFileInput = document.getElementById("open-file-input");
}

document.addEventListener("DOMContentLoaded", async () => {
    loadAppearance();
    cacheElements();
    setReviewButtonVisible(false);
    updateAppearanceControls();
    createEditors();
    applyAppearance();
    bindEvents();
    await loadLanguages();
    $("#stress-preset-select").dropdown();
    generateStressPreset(elements.stressPresetSelect.value || "random");
    setStatus("Ready");
});

const DEFAULT_SOURCE = `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;
    vector<long long> a(n);
    for (int i = 0; i < n; ++i) cin >> a[i];

    long long sum = 0;
    for (long long x : a) sum += x;

    cout << sum << "\\n";
    return 0;
}
`;

const DEFAULT_STDIN = `5
1 2 3 4 5
`;
