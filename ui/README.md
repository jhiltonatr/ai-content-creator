# AI Content Creator UI

React frontend for the AI Content Creator application, built with Vite and TypeScript.

## Scripts

- `npm run dev` — start the Vite dev server (proxies `/api` to `http://localhost:8080`)
- `npm run build` — type-check and produce a production build in `dist/`
- `npm run lint` — run oxlint
- `npm run preview` — preview the production build

## API Base URL

API requests go to `VITE_API_BASE_URL` (defaults to `/api`). The dev server proxies `/api` to
the Spring Boot backend running on `http://localhost:8080`.