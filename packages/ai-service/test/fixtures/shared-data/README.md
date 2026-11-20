# Shared-data test fixtures (byte-identical copies — do not edit)

SYNTHETIC DEMONSTRATION DATA (fictional Clearwater Ridge Wildfire). Not real client data.

These are unmodified copies of teammates' published exports, used to test the
source adapters. Do not edit them to make tests pass: if a teammate publishes a
new version, replace the file and update the hashes below. `sources.test.ts`
fails if a copy no longer matches its recorded hash.

| File | Owner | Original location | SHA-256 |
|---|---|---|---|
| `divyansh/impact.json` | Divyansh | `origin/feat/ppost.data.jason_file` @ `0259f995`, `shared-data/divyansh/impact.json` | `d32c2f463378d61e4ea79dc2ee46714d8137bd841c07a2f66e4c784b48fb5530` |
| `divyansh/matrix.json` | Divyansh | same commit, `shared-data/divyansh/matrix.json` | `9021cac0d3e6660e3422443ce57c5221b5f7cf25d2fbe4790bb842b1403c1fe0` |
| `divyansh/ppost.json` | Divyansh | same commit, `shared-data/divyansh/ppost.json` | `51211d5c8c1351552af0f5a4b06d00529564d84e31bda7a1fa79e2f2bb40f963` |
| `daniel/finance_report.sample.json` | Daniel | shared with Qiaomu on 2026-11-19 (not yet in the repo) | `33de58d149cc3548f80a34d1386642edc95ee3306c75698866c4a2385bc22e17` |
| `daniel/finance_report.schema.json` | Daniel | shared with Qiaomu on 2026-11-19 (not yet in the repo) | `ec81c6d5f8f20f2af7357230b028e3fa0f793a346a64434b823df49b12e6120d` |

`event-mapping.assumed.json` is ours: the explicit event mapping used for the
synthetic preview. It is marked `"status": "assumed"` because Divyansh's exports
label the mapping `assumed_for_sample`; it must not be marked confirmed until
Earl and the data owners confirm it.
