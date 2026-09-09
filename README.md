# V2ray_Sub — Pro Subscription Hub

A high-performance, GitHub Pages-friendly V2Ray/Xray subscription hub focused on **beginner usability first** while keeping a premium, graphic-heavy interface.

## What this version focuses on

- One-tap subscription discovery and copy.
- Beginner-first 3-step onboarding: **Find → Copy → Guide**.
- Client cards that open an illustrated, step-by-step guide by clicking the app icon or guide button.
- Dedicated **NPV Tunnel** guide using the five screenshots stored under `Pic/NPV tunnel/`.
- Advanced config search with selectable search field.
- Protocol, security and country filters.
- Favorites, pagination, copy actions and TXT/CSV/JSON export.
- Subscription QR generator.
- Local TXT/CONF parser and clipboard parser.
- Local workspace settings, favorites and custom subscription sources.
- Auto refresh and data diagnostics.
- Responsive layout for desktop, tablet and mobile.
- Animated background with cursor-reactive lighting, grid parallax and subtle card tilt.
- Reduced-motion support and motion toggle for accessibility.
- Persian RTL + English/Latin typography tuned with **Vazirmatn** and **Space Grotesk**.

## Beginner workflow

1. Open **Subscriptions**.
2. Pick **Mix**, **Irancell**, or **MCI**.
3. Press **Copy link**.
4. Open **Client Guides**.
5. Tap the icon for your app.
6. Follow the screenshots.
7. Refresh the subscription inside the app and run Ping/Test.

## NPV Tunnel

The NPV Tunnel guide is mapped to the images in:

```text
Pic/NPV tunnel/
├── icon.jpg
├── 1.jpg
├── 2.jpg
├── 3.jpg
├── 4.jpg
└── 5.jpg
```

The five steps are:

1. Open the app and enter **Config**.
2. Tap **+** at the bottom.
3. Choose **Add Subscription**.
4. Enter a name and paste the subscription URL.
5. Confirm, refresh, run Ping, and select a usable server.

## Data sources

The public repository sources are:

- `Mix.txt`
- `Irancell.txt`
- `Mci.txt`

They are loaded directly from the repository through the GitHub raw content endpoint, making the app compatible with GitHub Pages without a custom backend.

## Keyboard shortcuts

- `/` — focus advanced config search
- `G` — open the detected device guide
- `C` — copy the primary Mix subscription URL
- `R` — refresh data

## Local privacy

Custom subscription URLs and personal UI settings are stored in the browser's `localStorage`. They are not written back to the repository by this front-end.

## Deployment

The project is designed for static hosting. Upload the project files to the repository root and enable GitHub Pages for the desired branch/folder.

## License

Apache-2.0. See `LICENSE`.
