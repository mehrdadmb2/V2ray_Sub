# V2ray_Sub — Premium Subscription Hub

A GitHub Pages friendly Persian/English web interface for discovering, copying and using V2Ray/Xray subscriptions.

## What this version preserves

This release is built directly on the reference site structure: subscription links, OS detection, V2rayNG visual tutorial, client download cards, advanced configuration table, filters, downloads, chart, Getting Started, FAQ, changelog and contribution section remain part of the page.

## UX improvements

- Premium glassmorphism theme with a **CSS-only animated background**; no global mouse tracking or pointer animation loop.
- Clear beginner path: **Choose subscription → Choose client → Open guide**.
- Subscription URLs remain visible and one-click copyable.
- Advanced search now supports a selectable search field.
- Real repository assets are used for V2rayNG and NPV Tunnel icons where available.
- V2rayNG tutorial images remain usable and clickable.
- NPV Tunnel tutorial uses `Pic/NPV tunnel/1.jpg` through `5.jpg` exactly as the requested five-step workflow.
- Image fallback uses GitHub Raw when a relative GitHub Pages asset path fails.
- Persian UI uses Vazirmatn; technical/Latin/URL content uses Space Grotesk where appropriate.
- Responsive layouts for desktop, tablet and mobile.
- Reduced-motion support for users who disable animations.

## NPV Tunnel guide

1. Open NPV Tunnel and tap **Config**.
2. Tap **+** at the bottom.
3. Select **Add Subscription**.
4. Enter a custom name and the Subscription URL copied from the site.
5. Confirm, refresh, then run Ping and choose a configuration.

## GitHub Pages

Keep the existing `Pic/` directory and subscription text files in the repository. Do not remove the existing reference assets. The page uses repository-relative paths first, then falls back to the raw GitHub URL when needed.

## Local development

No build step is required for the front-end. Open `index.html` through a static server for the best browser behavior.


## UI & Device Detection Update

- Local SVG brand assets are included for Windows, Android, Apple/iOS and Linux so the core platform logos do not depend on Font Awesome brand icons.
- Added a local `favicon.svg` and `theme-color` metadata for a proper browser-tab identity.
- Windows detection distinguishes Windows 11, Windows 10, Windows 8.1, Windows 8 and Windows 7 when the browser exposes enough version information.
- Android, iOS/iPadOS, macOS, ChromeOS and Linux receive dedicated platform badges and recommended client links.
- Subscription cards expose the URL visibly plus Copy, Share, Open and Guide actions.
- Added compact quick-client chips and utility information without introducing continuous mouse listeners or heavy animation loops.

### New local assets

```text
favicon.svg
windows.svg
android.svg
apple.svg
linux.svg
hiddify.svg
v2box.svg
```
