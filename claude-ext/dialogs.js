(() => {
    const GRACE_MS = 2500;
    const COOLDOWN_MS = 1500;
    const DIALOGS = '[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog[open]';
    const CONTROLS = 'textarea, input, select, [contenteditable="true"]';
    const DISMISS_LABEL = /^(close|dismiss|not now|maybe later|later|skip|got it|no thanks|cancel|закрыть|не сейчас|позже|пропустить|понятно|нет, спасибо|отмена|×|✕)$/i;

    const firstSeen = new WeakMap();
    const lastTry = new WeakMap();

    const isShown = (element) => element.getClientRects().length > 0;

    const labelOf = (button) =>
        (button.getAttribute("aria-label") || button.innerText || button.textContent || "").trim();

    const closeButton = (dialog) =>
        Array.from(dialog.querySelectorAll("button, [role='button']"))
            .filter((button) => isShown(button) && DISMISS_LABEL.test(labelOf(button)))
            .shift() || null;

    const pressEscape = (dialog) => {
        const init = { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true, cancelable: true };
        const target = document.activeElement || dialog;
        for (const type of ["keydown", "keyup"]) {
            target.dispatchEvent(new KeyboardEvent(type, init));
        }
    };

    const dismissStray = () => {
        const now = Date.now();
        let acted = false;
        for (const dialog of Array.from(document.querySelectorAll(DIALOGS)).filter(isShown)) {
            if (dialog.querySelector(CONTROLS)) continue;
            if (!firstSeen.has(dialog)) {
                firstSeen.set(dialog, now);
                continue;
            }
            if (now - firstSeen.get(dialog) < GRACE_MS) continue;
            if (now - (lastTry.get(dialog) || 0) < COOLDOWN_MS) continue;
            lastTry.set(dialog, now);
            const button = closeButton(dialog);
            if (button) button.click();
            else pressEscape(dialog);
            acted = true;
        }
        return acted;
    };

    globalThis.botDialogs = { dismissStray };
})();
