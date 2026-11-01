# LeafScan frontend

React 19 + Vite + Tailwind interface for account verification, leaf uploads, scan history, and administration.

Use Node 22.12+ (24 recommended). Run `npm ci`, then `npm run dev`.
Vite proxies `/api` to the backend on port 5000. For separate hosting, set
`VITE_API_URL` (including `/api`) before `npm run build`.

Checks: `npm run build` and `npm run lint`.
See the root README for database, backend, AI service, and email setup.
