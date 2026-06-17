# Todoist Analyst

A personal analytics dashboard for your Todoist data — runs entirely in your
browser, no installation or build step required. It pulls your tasks,
projects, labels, and completion history straight from the Todoist API and
turns them into KPIs and charts to help you see where your attention is
needed and where tasks are quietly piling up.

## Features

- **KPIs**: active tasks, overdue tasks, completed today/this week, current streak
- **Charts**: completions over time, completions by day of week, weekly
  completions, active tasks by project, active tasks by age
  (how long ago tasks were created), active tasks by label, and upcoming
  workload
- **Click-through links**: click a bar or slice on most charts to open the
  matching filtered view directly in the Todoist web app
- Dark theme, responsive layout

## Getting your Todoist API token

1. Open Todoist in your browser.
2. Go to **Settings → Integrations → Developer**.
3. Copy your API token.

## Running the app

From this directory, run:

```bash
./start.sh
```

This starts a local web server and opens the dashboard at
`http://localhost:8000` in your default browser.

If `./start.sh` doesn't open a browser automatically, just run:

```bash
python3 -m http.server 8000
```

and open `http://localhost:8000` manually in Brave or Chrome.

## Running it persistently (macOS)

Instead of running `./start.sh` every time, you can install a LaunchAgent
that starts the server automatically at login and keeps it running:

```bash
./launchd/install.sh
```

The dashboard will then always be available at `http://localhost:8000`,
even after a reboot — no terminal window needed. To remove it:

```bash
./launchd/uninstall.sh
```

## First-time setup

On first load, the app will ask you to connect your Todoist account. Click
the gear icon (or the **Connect** button) and paste in your API token.

## Privacy & security

- Your API token is stored **only** in this browser's local storage, on
  this computer.
- It is sent directly to `api.todoist.com` and nowhere else — there is no
  backend server or third-party service involved.
- This repository never contains your token or any other credentials; there
  is nothing to configure or hide before pushing changes.

## Tech stack

- Plain HTML/CSS/JS (ES modules) — no build step
- [Tailwind CSS](https://tailwindcss.com/) via the Play CDN
- [Chart.js](https://www.chartjs.org/) for charts
- [Todoist API v1](https://developer.todoist.com/api/v1/)

## Stopping the server

Press `Ctrl+C` in the terminal running `start.sh`. If you installed the
LaunchAgent instead, run `./launchd/uninstall.sh`.

## License

[MIT](LICENSE) — free to use, modify, and share.
