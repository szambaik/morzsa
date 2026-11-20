# Unified Morzsa workspace

The supplied six-view board and written requirements are preserved here.
The implementation builds on the existing global-script application; it does
not initialize a new app or replace data contracts. See design-qa.md for the
comparison and verification record.

Local reference fixture (synthetic data only):
MORZSA_QA_PORT=8087 MORZSA_QA_COLLABORATION=1 MORZSA_QA_RECIPE_REFERENCE=1 MORZSA_QA_UNIFIED_REFERENCE=1 node tests/persistence-fixture.mjs

Optional, explicit targeted sanity against a fresh fixture:
node design/unified-workspace-2026-11-19/sanity.mjs

Production source photographs continue to use the existing backend/device
image cache. The local fixture injects reference crops and stubbed chat results.
