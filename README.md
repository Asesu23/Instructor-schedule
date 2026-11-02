# Limit Monitor

A Windows desktop dashboard that tracks Claude usage-limit resets across multiple Chrome profiles, so you always know which account is ready to use.

## Features

* Per-profile countdown to the next limit reset, with a clear "Ready" state.
* Live session status for every profile: not running, starting, open, closing. A profile counts as open only while its extension reports a live claude.ai tab, and closing the last claude.ai tab or window is reported right away, so sessions you close by hand are noticed and profiles that Chrome keeps loaded in the background are never shown as open.
* One-click launch and close of a profile session. Closing only affects the selected profile and leaves the rest of Chrome untouched.
* Usage window timer: a second timer on every card shows how long the current usage window keeps running. It starts with the first message sent after the previous window ended, whether that is the "1" from Auto Send or a message you typed yourself, and later messages do not extend it.
* Auto Send: a toggle in the footer that starts a new usage window for every profile that shows "Ready" and has no window running. It works one profile at a time: the extension opens the chat named "1" and sends "1" to it. Only one profile is ever launched at a time, a session that was launched automatically is closed afterwards, and a profile is handled at most once per window.
* Shared instructions: the text of the "Instructions for Claude" setting is edited once in the dashboard and written into every Claude account through the extension, one profile at a time, with the result of each profile reported.
* Self-updating extension: it reloads itself when its files change, so an update reaches every profile without visiting `chrome://extensions`.
* One-click profile cloning from a template profile that already has the extension installed.
* System tray integration with a single-instance guard.
* Responsive dark UI: profile cards scale to fill the whole window, and a scrollbar only appears when the profiles cannot fit even at the smallest card size.

## How it works

* **Content script** reads the limit reset time from the claude.ai page and sends a heartbeat when the page loads and then every few seconds so the dashboard knows the session is alive. Only times that appear next to a usage-limit message are considered, and every banner is evaluated once, so a stale banner can never roll the reset time over to the next day.
* **Background service worker** forwards both to the local daemon over HTTP (this avoids CORS issues). It reports every message sent to Claude (it observes the completion requests the page makes, never their content) and the moment the last claude.ai tab or window of the profile is closed. It closes the profile's windows when the dashboard asks for it and opens a temporary tab for the ping and settings tasks. It compares a hash of its own source files every 15 seconds while a session is active and reloads itself when they change (never in the middle of a task), then re-injects the content scripts into the claude.ai tabs that are already open.
* **Ping script** runs in that temporary tab. It finds the chat by its title, opens it, types the message, presses send, waits until the message box clears, and reports the result back. The chat title and the message are handed over by the service worker for that specific tab and are never read from the page URL, so a crafted link cannot make the extension send anything.
* **Settings script** runs in a temporary tab as well. The claude.ai settings are a modal window opened through the URL hash, so it opens `#settings/account`, finds the instructions field by its heading, fills it, clicks the save button that only appears after an edit, reloads the page, and reports success only when the saved text matches. Like the ping task, the text is handed over by the service worker for that specific tab and is never read from the page URL.
* **Dialog helper** (`dialogs.js`) closes unexpected modal windows, such as announcements and upsells, that would cover the page during a task. It uses the dismiss button of the modal or the Escape key, and never touches a modal that contains form controls, such as the settings window itself.
* **Python daemon** is a small threaded HTTP server bound to `127.0.0.1`. It stores reset timestamps with atomic writes to `%LOCALAPPDATA%\Limit Monitor\state.json` (anything more than 12 hours away is discarded as noise), keeps the start of every usage window in `%LOCALAPPDATA%\Limit Monitor\usage.json` and the shared instructions text in `%LOCALAPPDATA%\Limit Monitor\settings.json`, tracks heartbeats in memory, queues tasks and hands them to the extension with the next heartbeat, and rejects requests that do not come from the extension.
* **Auto Send** runs inside the dashboard loop. It only considers profiles in which the extension has connected at least once, picks the first one that shows "Ready" and has no usage window running, launches it (or uses it in place if it is already open), waits for the result, closes the session it launched, and pauses briefly before the next profile. A failed profile is retried once after ten minutes and then left alone for a whole window. The same runner applies the shared instructions, which takes priority over Auto Send.
* **Tkinter dashboard** (CustomTkinter) refreshes once per second and never blocks on I/O.

## Requirements

* Windows 10 or newer
* Google Chrome
* Python 3.10+

## Setup

1. Install dependencies:

   ```
   pip install -r requirements.txt
   ```

2. Create a template Chrome profile, sign in to claude.ai, and load the `claude-ext` folder through `chrome://extensions` (Developer mode, Load unpacked). Set `TEMPLATE_PROFILE` in `python-core-controller.py` to that profile's directory name.
3. Start the dashboard:

   ```
   python python-core-controller.py
   ```

New profiles created from the dashboard are cloned from the template, so the extension is already installed in them.

Auto Send expects a chat named `1` in every Claude account. The chat title and the message are set by `PING_CHAT` and `PING_TEXT` in `python-core-controller.py`. The ping drives the claude.ai web interface, so its selectors, listed at the top of `claude-ext/ping.js`, may need an update when the site layout changes. A usage window lasts `WINDOW_SECONDS` (five hours) in `python-core-controller.py`, and a message is recognized by the request pattern `MESSAGE_ENDPOINT` at the top of `claude-ext/background.js`. The settings page is driven in the same way, so `HASHES`, `HEADING` and `SAVE_LABEL` at the top of `claude-ext/settings.js` may need an update when the layout of the claude.ai settings changes.

Once the extension has been loaded in a profile, later updates need no manual reload: replace the files in `claude-ext` and every running profile picks them up, usually within half a minute. Profiles that are not running load the new files on their next launch.

## Build

```
pip install pyinstaller
pyinstaller --clean --noconfirm "Limit Monitor.spec"
```

The icon is bundled into the executable. To regenerate the application and extension icons from a single source, run `python create_icon.py`.

## Project layout

```
python-core-controller.py   dashboard, tray icon and local HTTP daemon
claude-ext/                 Manifest V3 extension (content scripts, service worker, icons)
icon_art.py                 single source of the application icon artwork
create_icon.py              generates icon.ico and the extension icons from icon_art.py
Limit Monitor.spec          PyInstaller configuration
```