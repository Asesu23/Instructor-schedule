(() => {
    const STATE_KEY = "bot_ping_state";
    const POLL_MS = 250;
    const CLAIM_ATTEMPTS = 12;
    const CLAIM_RETRY_MS = 500;
    const TOTAL_TIMEOUT_MS = 45000;
    const FIND_TIMEOUT_MS = 25000;
    const NAVIGATE_TIMEOUT_MS = 10000;
    const EDITOR_TIMEOUT_MS = 15000;
    const EDITOR_READY_MS = 800;
    const INPUT_SETTLE_MS = 200;
    const SEND_BUTTON_TIMEOUT_MS = 4000;
    const SENT_TIMEOUT_MS = 6000;
    const SETTLE_MS = 6000;
    const CHAT_LINK = 'a[href^="/chat/"]';
    const EDITOR_SELECTORS = [
        '[data-testid="chat-input"][contenteditable="true"]',
        '.ProseMirror[contenteditable="true"]',
        '[contenteditable="true"][role="textbox"]'
    ];
    const SEND_LABEL = /send|отправ|envoy|senden|enviar|invia|送信|发送|보내/iu;

    const hinted = new URLSearchParams(window.location.search).has("bot_ping");

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const ask = (message) =>
        new Promise((resolve) => {
            try {
                chrome.runtime.sendMessage(message, (response) => {
                    resolve(chrome.runtime.lastError ? null : response || null);
                });
            } catch (err) {
                resolve(null);
            }
        });

    const readState = () => {
        try {
            return JSON.parse(window.sessionStorage.getItem(STATE_KEY));
        } catch (err) {
            return null;
        }
    };

    const writeState = (state) => {
        try {
            window.sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
        } catch (err) {
            return;
        }
    };

    const dismissStray = () => {
        const tools = globalThis.botDialogs;
        if (tools) tools.dismissStray();
    };

    const waitFor = async (probe, timeoutMs, deadline) => {
        const limit = Math.min(Date.now() + timeoutMs, deadline);
        for (;;) {
            const value = probe();
            if (value) return value;
            if (Date.now() >= limit) return null;
            dismissStray();
            await sleep(POLL_MS);
        }
    };

    const isShown = (element) => element.getClientRects().length > 0;

    const firstLine = (element) =>
        (element.innerText || element.textContent || "")
            .split("\n")
            .map((line) => line.trim())
            .find(Boolean) || "";

    const findChatLink = (title) =>
        Array.from(document.querySelectorAll(CHAT_LINK)).find((link) => firstLine(link) === title) || null;

    const findEditor = () => {
        for (const selector of EDITOR_SELECTORS) {
            const found = Array.from(document.querySelectorAll(selector)).filter(isShown).pop();
            if (found) return found;
        }
        return null;
    };

    const composerText = () => {
        const editor = findEditor();
        return editor ? (editor.innerText || editor.textContent || "").trim() : "";
    };

    const placeCaret = (editor) => {
        editor.focus();
        window.getSelection().selectAllChildren(editor);
    };

    const typeText = async (text) => {
        let editor = findEditor();
        if (!editor) return false;
        placeCaret(editor);
        document.execCommand("insertText", false, text);
        await sleep(INPUT_SETTLE_MS);
        if (composerText() === text) return true;

        editor = findEditor();
        if (!editor) return false;
        placeCaret(editor);
        const data = new DataTransfer();
        data.setData("text/plain", text);
        editor.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
        await sleep(INPUT_SETTLE_MS);
        return composerText() === text;
    };

    const isUsable = (button) =>
        !button.disabled && button.getAttribute("aria-disabled") !== "true" && isShown(button);

    const findSendButton = () => {
        const editor = findEditor();
        const scopes = [editor && editor.closest("fieldset, form"), document].filter(Boolean);
        for (const scope of scopes) {
            const match = Array.from(scope.querySelectorAll("button"))
                .filter((button) => isUsable(button) && SEND_LABEL.test(button.getAttribute("aria-label") || ""))
                .pop();
            if (match) return match;
        }
        return null;
    };

    const pressEnter = () => {
        const editor = findEditor();
        if (!editor) return;
        const init = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true };
        for (const type of ["keydown", "keypress", "keyup"]) {
            editor.dispatchEvent(new KeyboardEvent(type, init));
        }
    };

    const conclude = async (task, state, ok, detail) => {
        state.step = "done";
        writeState(state);
        await ask({ type: "PING_RESULT", payload: { profile_id: task.profile_id, ok, detail } });
    };

    const run = async (task, state) => {
        const until = (probe, timeoutMs) => waitFor(probe, timeoutMs, state.deadline);
        const fail = (detail) => conclude(task, state, false, detail);

        if (state.step === "find") {
            const link = await until(() => findChatLink(task.chat), FIND_TIMEOUT_MS);
            if (!link) return fail(`chat "${task.chat}" not found`);
            state.href = new URL(link.href).pathname;
            state.step = "send";
            writeState(state);
            link.click();
        }

        const arrived = await until(() => window.location.pathname === state.href, NAVIGATE_TIMEOUT_MS);
        if (!arrived) {
            if (state.reloaded) return fail("could not open the chat");
            state.reloaded = true;
            writeState(state);
            window.location.assign(state.href);
            return null;
        }

        if (!(await until(findEditor, EDITOR_TIMEOUT_MS))) return fail("message box not found");
        await sleep(EDITOR_READY_MS);
        if (!(await typeText(task.text))) return fail("could not type the message");

        const button = await until(findSendButton, SEND_BUTTON_TIMEOUT_MS);
        if (window.location.pathname !== state.href) return fail("chat changed before sending");
        if (composerText() !== task.text) return fail("message box was reset");
        if (button) button.click();
        else pressEnter();

        if (!(await until(() => composerText() === "", SENT_TIMEOUT_MS))) return fail("message was not sent");

        await sleep(SETTLE_MS);
        return conclude(task, state, true, "");
    };

    const claimTask = async () => {
        for (let attempt = 0; attempt < CLAIM_ATTEMPTS; attempt += 1) {
            const task = await ask({ type: "PING_CLAIM" });
            if (task && task.chat && task.text) return task;
            await sleep(CLAIM_RETRY_MS);
        }
        return null;
    };

    const main = async () => {
        const saved = readState();
        if (!hinted && !saved) return;
        if (saved && saved.step === "done") return;

        const task = await claimTask();
        if (!task) return;

        const state = saved || { step: "find", href: null, reloaded: false, deadline: Date.now() + TOTAL_TIMEOUT_MS };
        if (!saved) writeState(state);

        try {
            await run(task, state);
        } catch (err) {
            await conclude(task, state, false, `unexpected error: ${err && err.message ? err.message : err}`);
        }
    };

    main();
})();
