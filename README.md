# University Schedule (Refactored Structure)

## Run

1. From the project root, start a local server:
   - `py -m http.server 8080`
2. Open:
   - `http://localhost:8080/`

## Chrome App Install (GitHub Pages / Mobile / Desktop)

1. Deploy to HTTPS (GitHub Pages is already HTTPS).
2. Open the site in Chrome.
3. Install as app:
   - Android Chrome: use in-app `Install` button or menu (`⋮`) -> `Install app` (not just `Add to Home screen`).
   - Desktop Chrome: click the install icon in address bar or menu (`⋮`) -> `Install University Schedule`.
4. Launch from installed apps:
   - Android: app drawer / installed apps list (launcher behavior can vary by device).
   - Desktop: Chrome Apps/OS app launcher and Start menu shortcuts (platform-dependent).
5. If a phone still shows only `Add to Home screen`:
   - Update Chrome.
   - Reload once after update.
   - Ensure site is HTTPS and Service Worker is active.
   - Reopen and install with `Install app`.
   - Remove old shortcut-only install first, then install again from the app install prompt.

## Structure

- `index.html`: Main page shell with external CSS/JS includes.
- `styles/main.css`: All extracted stylesheet rules from the original inline `<style>` block.
- `src/main.js`: Module entry point.
- `src/app.js`: Core application logic (preserved from original inline script).
- `src/dom.js`: DOM element access helpers.
- `src/events.js`: Event binding helpers for shared UI wiring.
- `src/storage.js`: Storage access helper.
- `src/data.js`: Shared static configuration/constants (notification asset paths).
- `src/utils.js`: Shared bootstrap utility helpers.
- `assets/svg/`: SVG assets.
- `assets/icons/`: PNG icon assets.

## Assets

- SVG files are in `assets/svg/`.
- PNG/PWA icon files are in `assets/icons/`.
- `manifest.webmanifest` icon paths were updated accordingly.

## Assumption

To preserve behavior with minimal risk, all original runtime logic remains in `src/app.js`, and only bootstrap/global exposure was made explicit for compatibility with existing inline HTML handlers.

Because the app now boots via ES modules, it is expected to run from a local server (`http://localhost`) rather than direct `file://` opening.

Launcher placement is controlled by Chrome/OS/phone launcher. This refactor maximizes installability, but exact icon placement cannot be fully forced by web code.
