# V2ray_Sub v5.1 · External Lab

- Keeps the primary Mix pipeline and normal update delivery isolated.
- Adds an opt-in external source report and a separately generated `External.txt` file.
- Adds a responsive External Sources workspace with search, category/status filters, source health, parser metrics, and a separate bundle link.
- Adds a three-preset main-site theme controller (Aurora, Emerald, Ember) with per-browser persistence.
- Adds `/guide` for the GitHub Pages visual guide and `/npvguide` for the existing NPV Tunnel import images.
- Adds exact-duplicate removal, base64 feed decoding, host/port validation, and private/loopback endpoint rejection to the external parser.
- Preserves the last known-good external bundle if every source fails in one run, and marks it stale in the UI/report.
- Adds an independent GitHub Actions workflow that runs every six hours and does not touch `Mix.txt` or the regular Telegram update workflow.
