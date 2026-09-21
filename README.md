# AI Content Creator

An application for writing and entertainment: an editor UI for stories of different types (novels, RPG-like stories, and more).

## Project Layout

| Path  | Description                                        |
|-------|----------------------------------------------------|
| `api/` | Spring Boot backend (Java 25, Maven) providing the REST API |
| `ui/`  | React frontend (Vite + TypeScript) providing the editing UI   |

## Repository

- `api/` inherits from the company Spring Boot standards BOM (`com.example.company:java-springboot-standards-jdk25:1.0.0-SNAPSHOT`), which manages Spring Boot 4.1.1 and the JDK 25 toolchain, including checkstyle.
- Storage is abstracted behind repository interfaces backed by an in-memory implementation so a real database can be swapped in later.

## Prerequisites

- JDK 25 (already installed at `C:\Users\jhilt\.jdks\ms-25.0.4.1`, not on `PATH`)
- Maven 3.9.x
- Node.js 20+

## Running the API

```powershell
$env:JAVA_HOME = "C:\Users\jhilt\.jdks\ms-25.0.4.1"
mvn -f api/pom.xml spring-boot:run
```

The API listens on `http://localhost:8080`. Springdoc swagger UI is available at `http://localhost:8080/swagger-ui.html`.

## Running the UI

```powershell
cd ui
npm install
npm run dev
```

The UI runs on `http://localhost:5173` and proxies `/api` requests to the API.

## Building

```powershell
$env:JAVA_HOME = "C:\Users\jhilt\.jdks\ms-25.0.4.1"
mvn -f api/pom.xml verify
```

```powershell
cd ui
npm run build
```

## Conventions

- Java style is enforced by the company standards BOM during `mvn verify` (checkstyle).
- Frontend is standard Vite + React + TypeScript; the API base URL is configured via `VITE_API_BASE_URL` (defaults to `/api`).