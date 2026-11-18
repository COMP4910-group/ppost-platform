# PPOST data files (Divyansh) — PROVISIONAL LOCATION

> This folder is temporary. Earl's designated team data folders were not in my local copy
> of the repo yet. Once I pull `main`, these four files move into my designated folder.
> The file names and contents stay the same.

All four files use the team format: `event_id`, `event_name`, `submitted_by`, `last_updated`, then everything inside `data`.
They contain **sample data only** (fictional Clearwater Ridge Wildfire). They are not live and not read from Supabase.

| File | What it holds | Start reading at |
|---|---|---|
| `impact.json` | Impact Assessment: every question, its YES / NO / UNKNOWN answer, notes, parent and child questions, and the problems, tasks and safety tactics each answer produced | `data.dashboard_summary`, `data.examples`, `data.questions` |
| `ppost.json` | The 8 priorities and every Problem → Objective → Strategy → Tactic with owner, status, source and 5W1H details, plus verification tasks and cost history | `data.dashboard_summary`, then `data.problems` / `data.tactics` |
| `matrix.json` | Recovery Matrix: 8 priorities × 6 sectors = 48 cells, each with a status (RED / AMBER / GREEN / NOT_ASSESSED), record IDs, gaps and sample cost totals | `data.dashboard_summary.attention_cells`, `data.cells` |
| `activity_history.json` | Who changed what and when: change events with version, changed fields and before / after values, newest first | `data.dashboard_summary`, `data.events` |

## IDs that connect the files
- PPOST identifies the event as `EV-2026-014` (`data.ppost_disaster_id`). The team `event_id` is `1` (see `data.event_mapping`).
- Question → problem: `impact.json questions[].related_problem_ids` → `ppost.json problems[].id`
- Problem → objective → strategy → tactic: `objective_ids`, `strategy_ids`, `tactic_ids` (and the reverse `problem_ids`, `objective_id`, `strategy_id`)
- Tactic → finance: `ppost.json tactics[].finance.current_cost_entry_id` → `cost_entries[].id`. `class_d_estimate_id` is `null` for now (pending Daniel).
- Record → AI: `ai_proposal_id` is `null` for now (pending Qiaomu).
- Record → history: `activity_history.json events[].record_type` + `record_id`
- Matrix cell → records: `cells[].problem_ids / objective_ids / strategy_ids / tactic_ids`

## Rules to keep in mind
- `UNANSWERED` is not the same as `UNKNOWN`.
- Counts exclude `ARCHIVED` records (archived records are kept, never deleted).
- Money values end in `_sample`. They are synthetic, not official estimates.
- Values that are not connected yet are `null`, `[]` or `"pending_integration"`.
