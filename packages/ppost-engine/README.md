# ppost-engine

PPOST hierarchy (Disaster → Priority → Problem → Objective → Strategy → Tactic),
the YES/NO/UNKNOWN assessment rule engine, Recovery Matrix logic + React grid, and 5W1H validation.

| Path | What it is |
|---|---|
| `src/model/types.ts` | Data model incl. 5W1H fields |
| `src/model/defaults.ts` | 8-tier priority hierarchy, sectors |
| `src/engine/assessment.ts` | UNKNOWN → safety tactic + verification task |
| `src/engine/matrix.ts` | Matrix cell colours, PPOST chains per priority |
| `src/engine/validation.ts` | 5W1H completeness checks |
| `src/components/RecoveryMatrix.tsx` | Clickable 8 × sector grid |
| `sql/001_ppost_schema.sql` | PostgreSQL tables |

```bash
# from the repo root (npm workspaces installs every package)
npm install
npm test -w ppost-engine        # 13 tests
npm run build -w ppost-engine   # outputs dist/ for packages/web to import
npm run demo -w ppost-engine    # see the engine run in the terminal (edit answers in src/demo.ts)
```

To use it in the web app, add `"ppost-engine": "*"` to `packages/web/package.json` dependencies,
run `npm install` at the root, then `import { RecoveryMatrix } from 'ppost-engine'`.
Re-run the build after changing the engine.

Logic is pure TypeScript (no database, no Express) so both the web app and the API can reuse it.
