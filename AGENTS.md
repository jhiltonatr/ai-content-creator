# AI Content Creator

An application for writing and entertainment: an editor UI for stories of different types (novels, RPG-like stories, and more).

## Components

- `api/` — Spring Boot REST backend (Maven). Layers: `domain` → `storage` → `web`. Storage is abstracted behind repository interfaces with an in-memory implementation, so a real database can be swapped in later without touching application code.
- `ui/` — React frontend (TypeScript, Vite). Dev server proxies `/api` to the backend at `http://localhost:8080`.

## Versions

- Java: 25 (Microsoft OpenJDK 25.0.4.1 — not on PATH; set `JAVA_HOME` to `C:\Users\jhilt\.jdks\ms-25.0.4.1`)
- Spring Boot: 4.1.1
- React: 19.2.8
- Vite: 8.3.0

## Build & run

```powershell
$env:JAVA_HOME = "C:\Users\jhilt\.jdks\ms-25.0.4.1"
mvn -f api/pom.xml verify
mvn -f api/pom.xml spring-boot:run   # API on http://localhost:8080
```

```powershell
cd ui
npm install
npm run dev                          # UI on http://localhost:5173
```