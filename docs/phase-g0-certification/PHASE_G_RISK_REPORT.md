# PHASE_G_RISK_REPORT.md
**Owner:** LILCKY STUDIO LIMITED  
**Date:** 2026-06-02

---

## RISK MATRIX

| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| R01 | KV namespace placeholders (rald-notify, rald-search, rald-inbox) — rate limiting inactive | HIGH | MEDIUM | P0 remediation: replace before consumer launch |
| R02 | rald-loop-business uses Lovable deploy — not GitHub source-of-truth | HIGH | MEDIUM | Migrate to wrangler deploy in G1 sprint |
| R03 | Branch protection not enabled — unreviewed pushes to main possible | HIGH | MEDIUM | Enable immediately |
| R04 | SSO token passed in URL query string — browser history exposure | MEDIUM | LOW | One-time exchange code (G2) |
| R05 | Real-time messaging (Durable Objects) not yet implemented — polling only for MVP | MEDIUM | MEDIUM | Document polling pattern; Durable Objects in G3 |
| R06 | loop-crm CRM timeline events not yet wired from messenger | LOW | LOW | Complete in G1 integration sprint |
| R07 | rald-inbox channel adapter for loop_messenger not yet implemented | LOW | MEDIUM | Complete in G1 implementation |
| R08 | Attachment storage (object storage) not yet configured — metadata layer only | LOW | LOW | Wire CF R2 or Supabase Storage in G2 |
| R09 | No automated E2E test suite across the ecosystem | MEDIUM | MEDIUM | Add integration test suite in G2 |
| R10 | CF Account ID in public SECRETS.md | HIGH | LOW | Remediate immediately (P0-R02) |

---

## P0 RISKS (Block Consumer Launch)

R01, R02, R03, R10 — all have clear remediation paths and < 4h total effort.

**Signed: LILCKY STUDIO LIMITED — 2026-06-02**
