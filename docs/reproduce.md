# Reproducing the PPOST RecoveryOS Environment

This document covers everything outside the repository that is needed to run the project.

---

## 1. Supabase Database

The project uses a hosted PostgreSQL database on Supabase.

- **Provider:** Supabase (https://supabase.com)
- **Project:** ppost-platform (owned by Earl)
- **Access:** Contact Earl (t00595022@mytru.ca) to be added as a team member in the Supabase dashboard

A fresh maintainer will need to:
1. Be added to the Supabase project by Earl
2. Obtain the database connection credentials from Earl
3. Fill in `packages/api/.env` using `packages/api/.env.example` as a template

---

## 2. Environment Variables

The `.env` file is not committed to the repository for security reasons. To get it:

1. Copy the example file: `cp packages/api/.env.example packages/api/.env`
2. Contact Earl for the real values
3. Never commit the `.env` file

---

## 3. Database Tables

The following tables exist in Supabase and are managed by Django migrations:

- `users` — authenticated users
- `disaster_events` — active recovery events
- `impact_assessments` — Div's impact data
- `ppost_responses` — PPOST chain entries
- `financial_records` — Johnny's financial data
- `recovery_plans` — generated recovery plans

To apply migrations on a fresh setup:
```bash
cd packages/api
python manage.py migrate
```

To create a test user:
```bash
python manage.py create_test_user
```

---

## 4. Synthetic Data

Pages currently using synthetic data (no real credentials required):

- Audit & Approvals — pending real institutional audit credentials
- Funding & Assistance — pending real government funding credentials

This synthetic data is hardcoded in the frontend components for demo purposes.

---

## 5. No External API Keys Required

The current implementation does not require any paid external API keys. All services used are either free tier or owned by the team.

---

## 6. Accounts

| Service | Owner | Purpose |
|---------|-------|---------|
| Supabase | Earl | Database hosting |
| GitHub | Earl | Repository |

