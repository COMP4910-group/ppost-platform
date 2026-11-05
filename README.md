# PPOST Recovery Platform

A web-based disaster recovery planning platform built for local governments, Indigenous governing bodies, and emergency management organizations.

## What it does
- Structured PPOST workflow: Disaster → Priority → Problem → Objective → Strategy → Tactic
- Dynamic impact assessment with YES / NO / UNKNOWN logic
- Class D cost estimating and funding gap tracking
- AI-assisted planning with mandatory human approval
- Initial Recovery Plan generation from structured data
- Full audit trail and version history

## Team
| Member | Role | Branch |
|--------|------|--------|
| Earl | Core Platform / API / Auth | `feat/core-platform` |
| Divyansh | PPOST Engine / Recovery Matrix | `feat/ppost-engine` |
| Daniel | Financial / Recovery Planning | `feat/finance-engine` |
| Qiaomu | AI & Evaluation | `feat/ai-service` |

## Getting started
1. Clone the repo
```bash
   git clone https://github.com/COMP4910-group/ppost-platform
   cd ppost-platform
```
2. Copy the environment file
```bash
   cp .env.example .env
```
3. Start the services
```bash
   docker-compose up
```

## Stack
- **Frontend:** React + TypeScript + Tailwind CSS
- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **AI:** Claude API (Anthropic)
- **Infrastructure:** Docker

## Branching rules
- Nobody pushes directly to `main`
- All changes go through a pull request with at least 1 approval
- Branch naming: `feat/your-feature-name`
