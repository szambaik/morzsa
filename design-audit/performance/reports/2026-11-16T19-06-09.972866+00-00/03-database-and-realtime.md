# Adatbázis és Realtime

2026. november 16. · rögzített alkalmazáspillanatkép · szintetikus helyi adatok.

### PERF-006 — Realtime mellett is sok teljes háttérolvasás történik

P2 · confirmed · bizonyosság: high

A burst helyesen egy refresh-ciklussá áll össze, de az 8 REST-kérést indít. Két kliens 16.5 s alatt 42 kérést végzett. Kliensenként 2 socket maradt.

**Ok:** A household.refresh minden alkalommal teljes ellenőrzött fetchRows-t, majd pantry/kitchen/shopping frissítéseket indít. A 8 s-os poll egészséges Realtime mellett is marad; a perzisztencia 15 s-os és globális focusout-frissítése hozzáadódik.

**Reprodukció:**

1. Két szintetikus közös háztartási kliens.
2. 20 egyidejű Phoenix postgres_changes jel az egyik kliensnek.
3. 16.5 s változtatás nélküli időszak megfigyelése.

**Forrás:** [household.js:111](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/household.js:111), [household.js:120](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/household.js:120), [household.js:125](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/household.js:125), [household.js:157](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/household.js:157), [persistence.js:101](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/persistence.js:101), [persistence.js:103](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/persistence.js:103)

**Bizonyíték:** [bizonyíték](../../runs/2026-11-16T18-34-31.217Z-full/results.json) — realtimeBurst · [bizonyíték](../../runs/2026-11-16T18-34-31.217Z-full/results.json) — idlePolling

**Javaslat:** Adatkörönkénti invalidálás, megosztott aktív olvasások, egészséges Realtime mellett ritkább egyeztetés. A polling fallback megőrzése.

**Elfogadás:**

- Eseményviharban legfeljebb egy aktív egyeztetési ciklus.
- Változatlan adatoknál nincs teljes mellékadatfrissítés.
- Egészséges kapcsolatban cél ≤ 4 háttérkérés/perc/kliens; fallback külön kerettel.

### PERF-007 — A beszélgetésindex a teljes táblán értékeli a hozzáférést

P2 · confirmed · bizonyosság: high

A PGlite minimumidő kb. 1.8 → 6.2 → 26.9 ms. Az 5000 sorból 4950-et a can_read_conversation szűrés dobott el, végig 50 látható sor mellett.

**Ok:** A belső feltétel csak can_read_conversation(id), előzetes owner/shared jelöltszűrés nélkül. A meglévő owner-index ebben a tervben minden kulcsot végigolvas, a jogosultság soronként értékelődik.

**Reprodukció:**

1. 50 látható beszélgetés mellett 100 → 1000 → 5000 teljes sor.
2. conversation_index(0) és belső SELECT: EXPLAIN ANALYZE.
3. Diagnosztikus owner_id-szűrés összevetése, a megosztási szemantika eltérésének jelölésével.

**Forrás:** [supabase/migrations/20261114_persistent_library.sql:153](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/supabase/migrations/20261114_persistent_library.sql:153), [supabase/migrations/20261114_persistent_library.sql:29](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/supabase/migrations/20261114_persistent_library.sql:29)

**Bizonyíték:** [bizonyíték](../../database-runs/2026-11-16T18-35-45.869Z/database.json) — plans/conversation_inner_5000

**Javaslat:** Indexelt saját és megosztott jelöltek egyesítése, majd a szükséges hozzáférési ellenőrzés. Keyset lapozás mérlegelése. Az owner-only diagnosztika nem kész helyettesítő query.

**Elfogadás:**

- Idegen beszélgetések növelése ne okozzon lineáris listázási költséget.
- Privát/megosztott olvasás, visszavonás, törlés és archiválás tesztjei átmennek.

## Ellenőrzött garanciák

Mind a tíz SQL-tesztsor átment: tagság/RLS, meghívások, recipe/voice quota, Realtime publication, pantry review, kitchen events, shopping session, perzisztens könyvtár és proactive suggestions. Ezek helyi SQL-szemantikát tesztelnek, nem production-terhelést.

A 10000 üzenetes conversation_page 50 rekordot hozott a lapozási indexen, kb. 0.42–1.85 ms lokális wrapperidővel. A household_records összetett elsődleges kulcsa illeszkedik az olvasáshoz. A kliens ugyanakkor az összes 1000 soros oldalt kéri tombstone-okkal együtt. A receptek jelenlegi 31 soros feedje gyors; az 5000 soros szintetikus keresés is csak néhány ms volt PGlite-ban. Missing-index állítást ebből önmagában nem teszünk.

A kétklienses listaírás, újratöltés, offline outbox, reconnect és konfliktusos SQL-esetek sikerültek. A burst nem hozott létre sokszoros socketeket. Valódi Supabase Realtime-latencia, connection pool, kölcsönös blokkolás és sokfelhasználós contention nem lett tesztelve.

[bizonyíték](../../database-runs/2026-11-16T18-35-45.869Z/database.json)
