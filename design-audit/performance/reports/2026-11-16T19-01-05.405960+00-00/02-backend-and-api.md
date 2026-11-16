# Backend és API

2026. november 16. · rögzített alkalmazáspillanatkép · szintetikus helyi adatok.

### PERF-004 — A közös készlet teljes hálózati lánca lezárja a párbeszédablakot

P1 · confirmed · bizonyosság: high

Az összes gomb, a bezárás is tiltott; a művelet 2952 ms-ot vett igénybe.

**Ok:** openPantryDetails minden gombot letilt és a cancel eseményt blokkolja, amíg updatePantryAvailability a saveVoiceState → household.push → fetchRows és PantryReview.confirm láncot végigvárja. Ez műveleti zárolás, nem általános JavaScript-fagyás.

**Reprodukció:**

1. Közös háztartásban Rizs-részletek megnyitása.
2. Minden REST-válasz késleltetése 450 ms-mal.
3. Van otthon választása, majd a bezáró- és műveleti gombok ellenőrzése.

**Forrás:** pantry-library.js:28, pantry-library.js:44, pantry-library.js:51, household.js:144, household.js:111

**Bizonyíték:** [bizonyíték](../../runs/2026-11-16T18-34-31.217Z-full/results.json) — sharedPantry · [bizonyíték](../../runs/2026-11-16T18-34-31.217Z-full/results.json) — sharedPantryPending · [bizonyíték](../../runs/2026-11-16T18-34-31.217Z-full/screenshots/25-shared-pantry-saving.png) · [bizonyíték](../../runs/2026-11-16T18-34-31.217Z-full/traces/shared.zip)

**Javaslat:** Bezárható párbeszédablak, helyi pending állapot és mentési nyugta külön kezelése. A mutációs válasz adhassa vissza a megerősített új állapotot, ahol ez biztonságos.

**Elfogadás:**

- 450 ms-os hálózatnál a vezérlők azonnal visszajeleznek és az ablak bezárható.
- Sikeres mentés csak szervernyugta után látszik.
- Hibánál a felhasználói szándék és az újrapróbálás megmarad.

### PERF-006 — Realtime mellett is sok teljes háttérolvasás történik

P2 · confirmed · bizonyosság: high

A burst helyesen egy refresh-ciklussá áll össze, de az 8 REST-kérést indít. Két kliens 16.5 s alatt 42 kérést végzett. Kliensenként 2 socket maradt.

**Ok:** A household.refresh minden alkalommal teljes ellenőrzött fetchRows-t, majd pantry/kitchen/shopping frissítéseket indít. A 8 s-os poll egészséges Realtime mellett is marad; a perzisztencia 15 s-os és globális focusout-frissítése hozzáadódik.

**Reprodukció:**

1. Két szintetikus közös háztartási kliens.
2. 20 egyidejű Phoenix postgres_changes jel az egyik kliensnek.
3. 16.5 s változtatás nélküli időszak megfigyelése.

**Forrás:** household.js:111, household.js:120, household.js:125, household.js:157, persistence.js:101, persistence.js:103

**Bizonyíték:** [bizonyíték](../../runs/2026-11-16T18-34-31.217Z-full/results.json) — realtimeBurst · [bizonyíték](../../runs/2026-11-16T18-34-31.217Z-full/results.json) — idlePolling

**Javaslat:** Adatkörönkénti invalidálás, megosztott aktív olvasások, egészséges Realtime mellett ritkább egyeztetés. A polling fallback megőrzése.

**Elfogadás:**

- Eseményviharban legfeljebb egy aktív egyeztetési ciklus.
- Változatlan adatoknál nincs teljes mellékadatfrissítés.
- Egészséges kapcsolatban cél ≤ 4 háttérkérés/perc/kliens; fallback külön kerettel.

### PERF-010 — A Gemini handler kliensmegszakítás után is elindíthat providerhívást

P2 · confirmed · bizonyosság: high

A megszakítás után is 1 providerhívás indult, a handler kb. 399 ms-nál teljes tesztválaszt adott.

**Ok:** A Gemini ág auth/quota/generate hívásai saját határidőjelet kapnak, de nem az ügyfél Request.signal jelét.

**Reprodukció:**

1. Tényleges voice-command handler injektált fetch-csel.
2. Request.signal megszakítása 30 ms-nál, auth/quota 120–120 ms.
3. Providerhívások és válasz ellenőrzése.

**Forrás:** supabase/functions/voice-command/handler.mjs:87, supabase/functions/voice-command/handler.mjs:90, supabase/functions/voice-command/handler.mjs:94, supabase/functions/voice-command/provider.mjs:6

**Bizonyíték:** [bizonyíték](../../provider-runs/2026-11-16T18-37-26.468Z/providers.json) — cases

**Javaslat:** Az ügyfél abortjelének összefűzése minden előkészítő/provider határidővel. Megszakítás után ne induljon új kísérlet vagy fallback.

**Elfogadás:**

- Auth közbeni megszakítás után 0 quota- és providerhívás.
- Provider-várakozás közbeni megszakítás lezárja az olvasót; nincs fallback.
- UI timeout/retry továbbra is helyreáll.

## API-láncok

A kliens adat-RPC határideje 20 s; AI chat 60 s; kép 85 s. Edge oldalon auth/quota/DB műveletek gyakran egymást követő 10 s-os maximumot kapnak. Free szöveg: Groq, ha beállítva, majd Gemini. Képes/hangos input Gemini. Plus: OpenAI Responses, külön realtime- és képútvonallal. A recipe-ideas ág auth → cache/quota → Gemini láncot használ. A tartós képútvonal hozzáférést, job/lease-t, storage-t és signed URL-t is kezel.

A mért böngészőkérések útvonala, metódusa, státusza, időtartama, kérésmérete és válaszbytes értéke a results.json network listáiban szerepel; a megszakítások külön failure mezőt kaptak. A fixtureCalls részletes státusz- és hibabody-adatot tartalmaz a későbbi futásokban. Ezek helyi protokolltesztek, nem élő API-latenciák.
