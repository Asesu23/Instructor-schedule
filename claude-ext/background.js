const SERVER = "http://127.0.0.1:42042";
const PING_ENTRY = "https://claude.ai/recents";
const SETTINGS_ENTRY = "https://claude.ai/new#settings/account";
const WATCH_INTERVAL_MS = 15000;
const RELOAD_COOLDOWN_MS = 60000;
const SIGNATURE_KEY = "code_signature";
const RELOADED_KEY = "reloaded_at";
const CLAUDE_URLS = ["https://claude.ai/*"];
const MESSAGE_URLS = ["https://claude.ai/api/*"];
const MESSAGE_ENDPOINT = /\/(?:retry_)?completion(?:\?|$)|\/append_message(?:\?|$)/;

const setStatus = (ok, detail) => {
    chrome.action.setBadgeText({ text: ok ? "ON" : "ERR" });
    chrome.action.setBadgeBackgroundColor({ color: ok ? "#2ECC71" : "#E74C3C" });
    chrome.action.setTitle({
        title: ok ? "Claude Limit Tracker: connected" : `Claude Limit Tracker: ${detail}`
    });
};

const post = async (path, payload, options = {}) => {
    try {
        const res = await fetch(`${SERVER}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            ...options
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setStatus(true);
        return res;
    } catch (err) {
        setStatus(false, String(err.message || err));
        throw err;
    }
};

const closeAllWindows = async () => {
    const windows = await chrome.windows.getAll();
    await Promise.all(
        windows.map((win) => chrome.windows.remove(win.id).catch(() => {}))
    );
};

const taskKey = (tabId) => `task_${tabId}`;

const openTaskTab = async (kind, profileId, task, entry, hint) => {
    const tab = await chrome.tabs.create({ url: "about:blank", active: true });
    await chrome.storage.session.set({ [taskKey(tab.id)]: { kind, ...task, profile_id: profileId } });
    const url = new URL(entry);
    url.searchParams.set("bot_profile", profileId);
    url.searchParams.set(hint, "1");
    await chrome.tabs.update(tab.id, { url: url.toString() });
    await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
};

const releaseTaskTab = async (tabId, close) => {
    if (tabId === null) return;
    await chrome.storage.session.remove(taskKey(tabId));
    if (close) await chrome.tabs.remove(tabId);
};

const readOwnFile = async (file) => {
    const res = await fetch(`${chrome.runtime.getURL(file)}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
    return res.text();
};

const sourceFiles = (manifest) => {
    const files = new Set([manifest.background.service_worker]);
    for (const script of manifest.content_scripts || []) {
        for (const file of [...(script.js || []), ...(script.css || [])]) files.add(file);
    }
    return Array.from(files).sort();
};

const codeSignature = async () => {
    const manifestText = await readOwnFile("manifest.json");
    const parts = ["manifest.json", manifestText];
    for (const file of sourceFiles(JSON.parse(manifestText))) {
        parts.push(file, await readOwnFile(file));
    }
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(parts.join("\n")));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const recordBaseline = async () => {
    try {
        await chrome.storage.local.set({ [SIGNATURE_KEY]: await codeSignature() });
    } catch (err) {
        return;
    }
};

const taskInProgress = async () => {
    const stored = await chrome.storage.session.get(null);
    return Object.keys(stored).some((key) => key.startsWith("task_"));
};

let lastWatch = 0;

const reloadIfChanged = async () => {
    const now = Date.now();
    if (now - lastWatch < WATCH_INTERVAL_MS) return;
    lastWatch = now;
    try {
        const current = await codeSignature();
        const stored = await chrome.storage.local.get([SIGNATURE_KEY, RELOADED_KEY]);
        if (stored[SIGNATURE_KEY] === current) return;
        if (!stored[SIGNATURE_KEY]) {
            await chrome.storage.local.set({ [SIGNATURE_KEY]: current });
            return;
        }
        if (now - (stored[RELOADED_KEY] || 0) < RELOAD_COOLDOWN_MS) return;
        if (await taskInProgress()) return;
        await chrome.storage.local.set({ [SIGNATURE_KEY]: current, [RELOADED_KEY]: now });
        chrome.runtime.reload();
    } catch (err) {
        return;
    }
};

const injectContentScripts = async () => {
    const scripts = chrome.runtime.getManifest().content_scripts || [];
    const files = scripts.flatMap((script) => script.js || []);
    const patterns = scripts.flatMap((script) => script.matches || []);
    if (files.length === 0 || patterns.length === 0) return;
    const tabs = await chrome.tabs.query({ url: patterns });
    await Promise.all(
        tabs.map((tab) => chrome.scripting.executeScript({ target: { tabId: tab.id }, files }).catch(() => {}))
    );
};

chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason !== "install" && details.reason !== "update") return;
    await recordBaseline();
    await injectContentScripts().catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
    recordBaseline();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const payload = message.payload || {};

    if (message.type === "LIMIT_REACHED") {
        post("/limit", payload)
            .then(() => sendResponse({ ok: true }))
            .catch(() => sendResponse({ ok: false }));
        return true;
    }

    if (message.type === "HEARTBEAT") {
        reloadIfChanged();
        chrome.storage.local.set({ profile_id: payload.profile_id });
        post("/heartbeat", payload)
            .then((res) => res.json())
            .then((data) => {
                if (data.close) return closeAllWindows();
                if (data.ping) return openTaskTab("ping", payload.profile_id, data.ping, PING_ENTRY, "bot_ping");
                if (data.instructions) {
                    return openTaskTab("instructions", payload.profile_id, data.instructions, SETTINGS_ENTRY, "bot_settings");
                }
                return null;
            })
            .then(() => sendResponse({ ok: true }))
            .catch(() => sendResponse({ ok: false }));
        return true;
    }

    if (message.type === "PING_CLAIM" || message.type === "SETTINGS_CLAIM") {
        const kind = message.type === "PING_CLAIM" ? "ping" : "instructions";
        const key = sender.tab ? taskKey(sender.tab.id) : null;
        if (!key) {
            sendResponse(null);
            return false;
        }
        chrome.storage.session
            .get(key)
            .then((stored) => sendResponse(stored[key] && stored[key].kind === kind ? stored[key] : null))
            .catch(() => sendResponse(null));
        return true;
    }

    if (message.type === "PING_RESULT" || message.type === "SETTINGS_RESULT") {
        const kind = message.type === "PING_RESULT" ? "ping" : "instructions";
        const tabId = sender.tab ? sender.tab.id : null;
        post("/ping-result", { ...payload, kind })
            .then(() => sendResponse({ ok: true }))
            .catch(() => sendResponse({ ok: false }))
            .then(() => releaseTaskTab(tabId, payload.ok === true))
            .catch(() => {});
        return true;
    }

    return false;
});

const reportClosedIfIdle = async () => {
    const tabs = await chrome.tabs.query({ url: CLAUDE_URLS });
    if (tabs.length > 0) return;

    const { profile_id } = await chrome.storage.local.get("profile_id");
    if (!profile_id) return;

    post("/closed", { profile_id }, { keepalive: true }).catch(() => {});
};

chrome.tabs.onRemoved.addListener(() => {
    reportClosedIfIdle().catch(() => {});
});

chrome.windows.onRemoved.addListener(() => {
    reportClosedIfIdle().catch(() => {});
});

const reportMessage = async () => {
    const { profile_id } = await chrome.storage.local.get("profile_id");
    if (!profile_id) return;

    post("/message", { profile_id }).catch(() => {});
};

if (chrome.webRequest) {
    chrome.webRequest.onBeforeRequest.addListener(
        (details) => {
            if (details.method === "POST" && MESSAGE_ENDPOINT.test(details.url)) {
                reportMessage().catch(() => {});
            }
        },
        { urls: MESSAGE_URLS }
    );
}