# PPOST RecoveryOS

A web-based disaster recovery planning platform built for local governments, Indigenous governing bodies, and emergency management organizations. Built for COMP 4910 Capstone — Thompson Rivers University, Fall 2026.

**Client:** Quan Nguyen, Thompson Rivers University

---

## Demo Video

https://onetru-my.sharepoint.com/:v:/g/personal/t00713596_mytru_ca/IQATDBRW_Z9ATbDZM4XySQ4oAaxP7hiOSNRg3G4YbheR93k

---

## Team

| Member | Role |
|--------|------|
| Earl | Frontend architecture, dashboard integration, authentication |
| Divyansh | Impact assessment, PPOST engine, recovery matrix |
| Daniel | Class D estimates, financial planning |
| Qiaomu | AI module, financial tracking, documents |

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- npm 9+
- Supabase account (credentials provided by Earl)

---

## Install

```bash
git clone https://github.com/COMP4910-group/ppost-platform
cd ppost-platform
npm install
pip install -r packages/api/requirements.txt --break-system-packages
```

---

## Configuration

Copy the example environment file and fill in your values (get the real `.env` from Earl):

```bash
cp packages/api/.env.example packages/api/.env
```

---

## Run

**Terminal 1 — Backend:**
```bash
cd packages/api
python manage.py runserver
```

**Terminal 2 — Frontend:**
```bash
npm start --workspace=packages/web
```

Open http://localhost:3000 in your browser.

---

## Tests

```bash
cd packages/api
python manage.py test
```

---

## Project Structure

```
ppost-platform/
├── packages/
│   ├── api/        # Django backend — authentication, database, REST API
│   └── web/        # React frontend — UI, pages, routing
├── docs/           # Milestone documents, SOPs, meeting notes
├── package.json    # npm workspace root
└── README.md
```

---

## Stack

- **Frontend:** React + TypeScript + Tailwind CSS
- **Backend:** Django + Django REST Framework
- **Database:** Supabase (PostgreSQL)
- **Auth:** JWT via Django Simple JWT

---

## Branching

- Nobody pushes directly to `main`
- All changes go through a pull request
- Branch naming: `feat/your-feature-name`

---

## Documentation

- [Reproduce the project →](docs/reproduce.md)
- [Standard Operating Procedures →](docs/sops/)
