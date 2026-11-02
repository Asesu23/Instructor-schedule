(() => {
    const STATE_KEY = "bot_settings_state";
    const HASHES = ["#settings/account", "#settings/general", "#settings/profile"];
    const POLL_MS = 250;
    const CLAIM_ATTEMPTS = 8;
    const CLAIM_RETRY_MS = 500;
    const TOTAL_TIMEOUT_MS = 120000;
    const FIRST_FIELD_TIMEOUT_MS = 6000;
    const FIELD_TIMEOUT_MS = 8000;
    const FIELD_READY_MS = 1500;
    const FILL_ATTEMPTS = 3;
    const RECHECK_MS = 600;
    const SAVE_BUTTON_TIMEOUT_MS = 5000;
    const AFTER_SAVE_MS = 3500;
    const VERIFY_TIMEOUT_MS = 8000;
    const MIN_FALLBACK_HEIGHT = 80;
    const FIELD_SELECTOR = 'textarea, [contenteditable="true"], [contenteditable="plaintext-only"]';
    const HEADING = /instruction|инструкц|anweisung|instrucc|istruzion|preferenc|предпочт/i;
    const SAVE_LABEL = /^(save|save changes|update|apply|сохранить|сохранить изменения|применить|speichern|änderungen speichern|enregistrer|enregistrer les modifications|guardar|guardar cambios|salva|salva modifiche|salvar|保存)$/i;

    const hinted = new URLSearchParams(window.location.search).has("bot_settings");

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

    const isUsable = (button) =>
        !button.disabled && button.getAttribute("aria-disabled") !== "true" && isShown(button);

    const normalize = (value) =>
        String(value)
            .replace(/\r\n/g, "\n")
            .replace(/[ \t]+\n/g, "\n")
            .replace(/\n{2,}/g, "\n")
            .trim();

    const readField = (element) =>
        typeof element.value === "string" ? element.value : element.innerText || element.textContent || "";

    const headingDepth = (element) => {
        let node = element.parentElement;
        for (let depth = 1; node && depth <= 6; depth += 1) {
            if (HEADING.test((node.innerText || node.textContent || "").slice(0, 400))) return depth;
            node = node.parentElement;
        }
        return 0;
    };

    const findField = () => {
        const fields = Array.from(document.querySelectorAll(FIELD_SELECTOR)).filter(isShown);
        const labelled = fields
            .map((element) => ({
                element,
                depth: headingDepth(element),
                area: element.clientWidth * element.clientHeight
            }))
            .filter((item) => item.depth > 0)
            .sort((a, b) => a.depth - b.depth || b.area - a.area);
        if (labelled.length > 0) return labelled[0].element;
        return fields.length === 1 && fields[0].clientHeight >= MIN_FALLBACK_HEIGHT ? fields[0] : null;
    };

    const openHash = (hash) => {
        if (window.location.hash === hash) window.location.hash = "";
        window.location.hash = hash;
    };

    const locateField = async (until, preferred) => {
        let field = await until(findField, FIRST_FIELD_TIMEOUT_MS);
        const hashes = [preferred, ...HASHES].filter((hash, index, all) => hash && all.indexOf(hash) === index);
        for (let index = 0; !field && index < hashes.length; index += 1) {
            openHash(hashes[index]);
            field = await until(findField, FIELD_TIMEOUT_MS);
        }
        return field;
    };

    const setField = (element, text, attempt) => {
        element.focus();
        if (element.tagName === "TEXTAREA") {
            if (attempt === 0) {
                element.select();
                document.execCommand("insertText", false, text);
                return;
            }
            const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
            setter.call(element, text);
            element.dispatchEvent(new Event("input", { bubbles: true }));
            element.dispatchEvent(new Event("change", { bubbles: true }));
            return;
        }
        window.getSelection().selectAllChildren(element);
        if (attempt === 0) {
            const data = new DataTransfer();
            data.setData("text/plain", text);
            element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
            return;
        }
        document.execCommand("insertText", false, text);
    };

    const fillField = async (text) => {
        for (let attempt = 0; attempt < FILL_ATTEMPTS; attempt += 1) {
            const field = findField();
            if (!field) return false;
            if (normalize(readField(field)) === normalize(text)) return true;
            setField(field, text, attempt);
            await sleep(RECHECK_MS);
            const current = findField();
            if (current && normalize(readField(current)) === normalize(text)) return true;
        }
        return false;
    };

    const buttonText = (button) =>
        (button.innerText || button.textContent || button.getAttribute("aria-label") || "").trim();

    const findSaveButton = (before) => {
        const field = findField();
        let scope = field ? field.parentElement : null;
        let fresh = null;
        for (let depth = 0; scope && depth < 6; depth += 1) {
            const buttons = Array.from(scope.querySelectorAll("button")).filter(isUsable);
            const labelled = buttons.filter((button) => SAVE_LABEL.test(buttonText(button))).pop();
            if (labelled) return labelled;
            if (!fresh) fresh = buttons.find((button) => !before.has(button)) || null;
            scope = scope.parentElement;
        }
        return fresh;
    };

    const conclude = async (task, state, ok, detail) => {
        state.step = "done";
        writeState(state);
        await ask({ type: "SETTINGS_RESULT", payload: { profile_id: task.profile_id, ok, detail } });
    };

    const run = async (task, state) => {
        const until = (probe, timeoutMs) => waitFor(probe, timeoutMs, state.deadline);
        const fail = (detail) => conclude(task, state, false, detail);
        const wanted = normalize(task.text);

        if (state.step === "apply") {
            if (!(await locateField(until, null))) return fail("instructions field not found");
            state.hash = window.location.hash;
            await sleep(FIELD_READY_MS);

            const present = findField();
            if (present && normalize(readField(present)) === wanted) return conclude(task, state, true, "");

            const before = new Set(Array.from(document.querySelectorAll("button")));
            if (!(await fillField(task.text))) return fail("could not fill the instructions field");

            const button = await until(() => findSaveButton(before), SAVE_BUTTON_TIMEOUT_MS);
            if (button) button.click();
            await sleep(AFTER_SAVE_MS);

            state.step = "verify";
            writeState(state);
            window.location.reload();
            return null;
        }

        if (!(await locateField(until, state.hash))) return fail("instructions field not found after reload");
        const matched = await until(() => {
            const field = findField();
            return field && normalize(readField(field)) === wanted;
        }, VERIFY_TIMEOUT_MS);
        if (!matched) return fail("the instructions did not persist");
        return conclude(task, state, true, "");
    };

    const claimTask = async (attempts) => {
        for (let attempt = 0; attempt < attempts; attempt += 1) {
            const task = await ask({ type: "SETTINGS_CLAIM" });
            if (task && typeof task.text === "string" && task.text.length > 0) return task;
            if (attempt + 1 < attempts) await sleep(CLAIM_RETRY_MS);
        }
        return null;
    };

    const main = async () => {
        const saved = readState();
        if (saved && saved.step === "done") return;

        const task = await claimTask(hinted || saved ? CLAIM_ATTEMPTS : 1);
        if (!task) return;

        const state = saved || { step: "apply", hash: null, deadline: Date.now() + TOTAL_TIMEOUT_MS };
        if (!saved) writeState(state);

        try {
            await run(task, state);
        } catch (err) {
            await conclude(task, state, false, `unexpected error: ${err && err.message ? err.message : err}`);
        }
    };

    main();
})();
