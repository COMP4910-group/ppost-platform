# SOP: Starting the Application

**Purpose:** Start the PPOST RecoveryOS application locally.  
**Who performs this:** Any team member or maintainer.  
**Prerequisites:** `.env` file configured, dependencies installed.

---

## Steps

1. Open two terminal windows in the project root (`ppost-platform/`)

2. **Terminal 1 — Start the backend:**
```bash
cd packages/api
python manage.py runserver
```
Wait until you see: `Starting development server at http://127.0.0.1:8000/`

3. **Terminal 2 — Start the frontend:**
```bash
npm start --workspace=packages/web
```
Wait until you see: `Compiled successfully`

4. Open http://localhost:3000 in your browser

5. Log in with the test account (contact Earl for credentials)

---

## How to check it worked

- Browser opens to the login screen
- Logging in takes you to the Welcome screen
- Sidebar navigation is visible and functional

---

## If it fails

- **Backend error "could not connect to database"** — check your `.env` file has the correct Supabase credentials
- **Frontend error "npm start not found"** — run `npm install` from the project root first
- **Port already in use** — another process is using port 3000 or 8000, close it and retry
