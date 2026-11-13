# V2ray Sub Radar · v5.2.0

## External Lab / Config Renamer

- Split third-party feed collection and output processing into two independent GitHub Actions workflows.
- The collector writes only `External-raw.txt`, `data/external-raw-index.json`, and source health status.
- A `workflow_run` action starts after a successful collector run and generates renamed `External.txt` plus `data/external-processed.json`.
- Ported ConfigRenamerPro naming behavior: `SkyBit-N_yyyy-MM-dd_HH-mm`, Tehran time, country flag preservation, pirate-flag fallback, VMess `ps` updates, and duplicate removal.
- Added stable source attribution by endpoint identity before the URI fragment, merging providers that publish the same endpoint with different labels.
- Family-Sub can join the aggregate when `EXTERNAL_GITHUB_TOKEN` is configured as a repository secret.
- Previous processed output is preserved when the latest collector run has no fresh aggregate; stale state is exposed to the site and bot.

## GitHub Pages

- Pinned the quick navigation bar to the viewport bottom and moved it outside the main content container.
- Added protocol, country, source, and text filters for processed configurations.
- Added per-config copy, copy-all-filtered, filtered TXT download, summary metrics, and protocol/country distribution bars.
- Kept External Lab hidden until the user explicitly opens the separate tab.

## Telegram / Cloudflare Worker

- Added hidden on-demand `/external`, `/externalmix`, `/externalprotocol`, and `/externalcountry` commands.
- Added inline selection menus for protocol and country; filtered configs are delivered as TXT documents.
- Kept External commands out of `/start`, `/help`, BotFather's public command menu, regular Mix broadcasts, and the normal subscription flow.
- No D1 schema migration or Cron trigger is required for this upgrade.
