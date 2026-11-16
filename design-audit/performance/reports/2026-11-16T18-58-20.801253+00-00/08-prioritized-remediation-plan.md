# Prioritásos javítási terv

2026. november 16. · rögzített alkalmazáspillanatkép · szintetikus helyi adatok.

P0: nincs igazolt kritikus adatvesztési probléma a vizsgált környezetben.

## P1

### PERF-001 — Ismételt kategóriakeresés blokkolja a bevásárlólista renderelését

P1 · confirmed · bizonyosság: high

667 tételnél 4225 ms főszál-feladat és 4327 ms navigáció; külön profilozott ismétlés: 4186 ms. 2000 tételnél a kattintás 30 s után időtúllépett.

**Ok:** A shoppingGroupHeader minden csoporthoz újraszűri a teljes listát. A productCategory minden összehasonlításnál új tömböt épít, kisbetűsít és lineárisan keres. A CPU-profil forró pontja app.js:15.

**Reprodukció:**

1. 50, 250, majd 667 szintetikus katalógustétel kerüljön a készletbe és a listára.
2. Áttekintésből kattintás a Lista fülre.
3. A long-task adatok és a shopping-667.cpuprofile ellenőrzése.

**Forrás:** app.js:15, app.js:175, app.js:198

**Bizonyíték:** [bizonyíték](../../runs/2026-11-16T18-34-31.217Z-full/results.json) — scaling · [bizonyíték](../../runs/2026-11-16T18-41-13.534Z-supplement/traces/shopping-667.cpuprofile) · [bizonyíték](../../runs/2026-11-16T18-34-31.217Z-full/traces/long-session.zip)

**Javaslat:** Normalizált név → kategória index; csoportosítás és darabszámok egy menetben. Szükség esetén ezt kövesse DOM-ablakozás.

**Elfogadás:**

- 250 tételnél a meleg Lista-váltás p95 ≤ 200 ms.
- 667 tételnél nincs 200 ms feletti alkalmazáskód-feladat.
- 2000 tételnél sem veszhet el a navigáció válaszkészsége.
- Magyar/angol nevek és egyéni tételek helyes kategóriában maradnak.

Komplexitás: **M**. Kockázat: A régi mentések, megosztott adatok és RPC-szerződések kompatibilitását meg kell őrizni.

Regresszió: a reprodukciós lépések és elfogadási küszöbök újrafuttatása; a meglévő tesztsor megőrzése.

### PERF-002 — Pontos recept-alapanyagokhoz is teljes fuzzy keresés fut

P1 · confirmed · bizonyosság: high

Már 50 tételnél 527 ms-os főszál-feladat; a profilozott megnyitás 643 ms-os intervalluma főként QuickEntry keresés.

**Ok:** recipe-library.cards → discoverySections → recipeChoice → resolve → QuickEntry.match. A ranked minden katalógusnévre Levenshtein-távolságot számol akkor is, amikor a név pontosan egyezik.

**Reprodukció:**

1. 31 seed-recept, 50 tételes készlet/lista.
2. Receptek / Neked megnyitása.
3. recipes-50.cpuprofile megnyitása DevToolsban.

**Forrás:** quick-entry.js:2, quick-entry.js:4, quick-entry.js:5, quick-entry.js:6, recipe-library.js:26, kitchen-model.js:58

**Bizonyíték:** [bizonyíték](../../runs/2026-11-16T18-34-31.217Z-full/results.json) — scaling · [bizonyíték](../../runs/2026-11-16T18-41-13.534Z-supplement/traces/recipes-50.cpuprofile) · [bizonyíték](../../runs/2026-11-16T18-41-13.534Z-supplement/traces/recipes-250.cpuprofile)

**Javaslat:** Pontos és alias-egyezések indexelése; fuzzy keresés csak elírásnál. A recept-alapanyag feloldásokat a katalógusverzióhoz kötötten cache-elni.

**Elfogadás:**

- A 24 kártyás meleg ajánló renderelése p95 ≤ 200 ms.
- Pontos neveknél nincs teljes katalógusos távolságszámítás.
- Az elírt és ékezet nélküli gyors bevitel megmarad.

Komplexitás: **M**. Kockázat: A régi mentések, megosztott adatok és RPC-szerződések kompatibilitását meg kell őrizni.

Regresszió: a reprodukciós lépések és elfogadási küszöbök újrafuttatása; a meglévő tesztsor megőrzése.

### PERF-003 — Az AI előkészítése látható folyamatjelzés nélkül vár

P1 · confirmed · bizonyosság: high

800 ms-nál az üzenet még a mezőben áll, a Küldés gomb aktív, nincs thinking és Stop. Az azonnali helyi AI-válasz is csak 3338 ms körül látható.

**Ok:** send előbb await-eli a beginTurn műveletet; a busy és renderChat később fut. A beginTurn flush/refresh, zárolás és történetolvasás láncot végez. Globális focusout további frissítést indíthat.

**Reprodukció:**

1. Új chat egy szintetikus bejelentkezett fiókkal.
2. Minden RPC-válasz 600 ms mesterséges késleltetést kap.
3. Küldés után 800 ms-nál képernyő és vezérlőállapot rögzítése.

**Forrás:** companion-ui.js:199, companion-ui.js:201, companion-ui.js:206, persistence.js:44, persistence.js:102, persistence.js:104

**Bizonyíték:** [bizonyíték](../../runs/2026-11-16T18-34-31.217Z-full/results.json) — aiPreflight · [bizonyíték](../../runs/2026-11-16T18-34-31.217Z-full/screenshots/22-ai-preflight-800ms.png) · [bizonyíték](../../runs/2026-11-16T18-34-31.217Z-full/traces/journeys.zip)

**Javaslat:** Az egész előkészítési szakasz kapjon azonnali, megszakítható sending állapotot. A zárolási/mentési garanciák mellett a fölösleges olvasások összevonása.

**Elfogadás:**

- Küldés után ≤ 100 ms-on belül látható állapotváltozás.
- Előkészítés közben működő megszakítás.
- Dupla küldés nem indít két modelligényt.
- Másik eszköz turn-lockja továbbra is érvényes.

Komplexitás: **M**. Kockázat: A régi mentések, megosztott adatok és RPC-szerződések kompatibilitását meg kell őrizni.

Regresszió: a reprodukciós lépések és elfogadási küszöbök újrafuttatása; a meglévő tesztsor megőrzése.

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

Komplexitás: **M**. Kockázat: A régi mentések, megosztott adatok és RPC-szerződések kompatibilitását meg kell őrizni.

Regresszió: a reprodukciós lépések és elfogadási küszöbök újrafuttatása; a meglévő tesztsor megőrzése.

## P2

### PERF-005 — A web build 60 szinkron scriptet és kb. 1 MB nyers JS/CSS-t tölt

P2 · confirmed · bizonyosság: high

703084 byte JS és 305846 byte CSS változatlanul kerül a buildbe. Lassú 4G laborprofil: hideg LCP medián 5768 ms, használhatósági próba 6206 ms.

**Ok:** Nincs alkalmazásbundle, minifikálás vagy kódfelosztás a web buildben. A klasszikus globális scriptfüggőségek és a sok erőforrás több hálózati kört igényelnek.

**Reprodukció:**

1. build:web a pillanatképen.
2. 390 px-es hideg indítás 150 ms RTT és 200000 byte/s letöltés mellett.
3. Meleg cache és 400 ms RTT megismétlése.

**Forrás:** index.html:1, scripts/build-mobile.mjs:5, styles.css:1, workspace.css:1

**Bizonyíték:** [bizonyíték](../../resources.json) · [bizonyíték](../../runs/2026-11-16T18-34-31.217Z-full/results.json) — startup

**Javaslat:** Explicit buildfüggőségek; minifikált kezdeti csomag; ritka hang/kép funkciók késleltetett betöltése. Stagingen a tömörítés és cache ellenőrzése.

**Elfogadás:**

- LCP ≤ 2.5 s cél a kijelölt mobilprofilon.
- Külön kezdeti JS/CSS transfer budget.
- Az inicializációs sorrend és mind az öt nézet működése megmarad.

Komplexitás: **M**. Kockázat: A mérés helyi HTTP/1.1 és tömörítés nélküli. A CDN HTTP/2/3, gzip/Brotli és cache eltérése miatt ez nem éles weboldal-latencia.

Regresszió: a reprodukciós lépések és elfogadási küszöbök újrafuttatása; a meglévő tesztsor megőrzése.

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

Komplexitás: **M**. Kockázat: A régi mentések, megosztott adatok és RPC-szerződések kompatibilitását meg kell őrizni.

Regresszió: a reprodukciós lépések és elfogadási küszöbök újrafuttatása; a meglévő tesztsor megőrzése.

### PERF-007 — A beszélgetésindex a teljes táblán értékeli a hozzáférést

P2 · confirmed · bizonyosság: high

A PGlite minimumidő kb. 1.8 → 6.2 → 26.9 ms. Az 5000 sorból 4950-et a can_read_conversation szűrés dobott el, végig 50 látható sor mellett.

**Ok:** A belső feltétel csak can_read_conversation(id), előzetes owner/shared jelöltszűrés nélkül. A meglévő owner-index ebben a tervben minden kulcsot végigolvas, a jogosultság soronként értékelődik.

**Reprodukció:**

1. 50 látható beszélgetés mellett 100 → 1000 → 5000 teljes sor.
2. conversation_index(0) és belső SELECT: EXPLAIN ANALYZE.
3. Diagnosztikus owner_id-szűrés összevetése, a megosztási szemantika eltérésének jelölésével.

**Forrás:** supabase/migrations/20261114_persistent_library.sql:153, supabase/migrations/20261114_persistent_library.sql:29

**Bizonyíték:** [bizonyíték](../../database-runs/2026-11-16T18-35-45.869Z/database.json) — plans/conversation_inner_5000

**Javaslat:** Indexelt saját és megosztott jelöltek egyesítése, majd a szükséges hozzáférési ellenőrzés. Keyset lapozás mérlegelése. Az owner-only diagnosztika nem kész helyettesítő query.

**Elfogadás:**

- Idegen beszélgetések növelése ne okozzon lineáris listázási költséget.
- Privát/megosztott olvasás, visszavonás, törlés és archiválás tesztjei átmennek.

Komplexitás: **M**. Kockázat: A számok WASM-laborértékek. Éles slow query vagy lock contention nem lett mérve.

Regresszió: a reprodukciós lépések és elfogadási küszöbök újrafuttatása; a meglévő tesztsor megőrzése.

### PERF-008 — Egy lassú kép más képek cache-olvasását is feltartja

P2 · confirmed · bizonyosság: high

A második cache-kérés csak 2019.6 ms-nál indul. A korábbi, sorrendet nem garantáló próba önmagában nem volt bizonyító; a rendezett ismétlés igen.

**Ok:** Egyetlen modul-szintű Promise queue fogja össze az összes load feladatot, a független cache-only olvasásokat is.

**Reprodukció:**

1. Az első kép kérésének elindítása és ennek megvárása.
2. Csak ezután a második RecipeImages.mount hívás.
3. Az első lokális válasz 2000 ms-ot vár, a második azonnali lenne.

**Forrás:** recipe-images.js:3, recipe-images.js:49, recipe-images.js:70

**Bizonyíték:** [bizonyíték](../../runs/2026-11-16T18-41-13.534Z-supplement/results.json) — orderedImageQueue

**Javaslat:** Külön cache-olvasási út és kis párhuzamossági korlát, képenkénti deduplikációval. A generálás kvótája és idempotenciája maradjon védett.

**Elfogadás:**

- A második cache-olvasás ≤ 200 ms-on belül elindul a másik generálás mellett.
- Ugyanazon képhez nincs dupla generálás.

Komplexitás: **M**. Kockázat: A régi mentések, megosztott adatok és RPC-szerződések kompatibilitását meg kell őrizni.

Regresszió: a reprodukciós lépések és elfogadási küszöbök újrafuttatása; a meglévő tesztsor megőrzése.

### PERF-009 — A kész képek cache-e leválasztott DOM-elemeket tart meg

P2 · confirmed · bizonyosság: high

682 → 1082 DOM-csomópont és 162 → 262 listener, 100 ismétlés után. Ez célzott komponensszintű életciklusteszt.

**Ok:** entry.views erős referenciát tart a hostra és paint closure-re. A leválasztott elemeket csak későbbi refresh/paint takarítja; egy kész, nem frissülő képnél ez elmaradhat.

**Reprodukció:**

1. Egy kész helyi receptkép bemelegítése.
2. Ugyanazon kép 100 mount/remove ciklusa.
3. Kényszerített GC után DOM- és listener-számlálás.

**Forrás:** recipe-images.js:23, recipe-images.js:47, recipe-images.js:48

**Bizonyíték:** [bizonyíték](../../runs/2026-11-16T18-41-13.534Z-supplement/results.json) — imageRetention

**Javaslat:** Explicit dispose/unmount, observer-lekapcsolás, leválasztott nézetek törlése és korlátos képcache.

**Elfogadás:**

- 100 mount/unmount után a bemelegített DOM/listener-alapérték közelébe tér vissza.
- Látható képek és lejáró signed URL-ek frissítése működik.

Komplexitás: **M**. Kockázat: A régi mentések, megosztott adatok és RPC-szerződések kompatibilitását meg kell őrizni.

Regresszió: a reprodukciós lépések és elfogadási küszöbök újrafuttatása; a meglévő tesztsor megőrzése.

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

Komplexitás: **S**. Kockázat: Injektált handler-teszt. Éles Deno-disconnect és providerelszámolás nem lett mérve.

Regresszió: a reprodukciós lépések és elfogadási küszöbök újrafuttatása; a meglévő tesztsor megőrzése.

## P3

### PERF-011 — Átmeneti conversation_page 400 a chat életciklusában

P3 · hypothesis · bizonyosság: low

A teljes futásban három 400-as válasz; a részletes naplózásnál egy Conversation access denied. Három egymás utáni üres chat külön próbája nem reprodukálta.

**Ok:** Lehetséges még nem perzisztált thread körüli frissítési verseny; a pontos ok nem bizonyított. A későbbi mentések sikerültek.

**Reprodukció:**

1. A teljes és kiegészítő run conversation_page kéréseinek ellenőrzése.
2. Új, üres beszélgetés és az első mentett turn körüli időzítés reprodukálása.

**Forrás:** persistence.js:73, persistence.js:88, persistence.js:104

**Bizonyíték:** [bizonyíték](../../runs/2026-11-16T18-34-31.217Z-full/results.json) — network · [bizonyíték](../../runs/2026-11-16T18-41-13.534Z-supplement/results.json) — fixtureCalls · [bizonyíték](../../runs/2026-11-16T18-41-13.534Z-supplement/results.json) — emptyChatRequests

**Javaslat:** Korrelált trace az üres → mentett thread átmenetről; a loadThread feltétel csak bizonyított reprodukció után változzon.

**Elfogadás:**

- Indokolatlanul tiltott olvasás ne induljon üres threadre.
- Valódi jogosultság-visszavonás továbbra is hibaként kezelendő.

Komplexitás: **S**. Kockázat: A régi mentések, megosztott adatok és RPC-szerződések kompatibilitását meg kell őrizni.

Regresszió: a reprodukciós lépések és elfogadási küszöbök újrafuttatása; a meglévő tesztsor megőrzése.

A terv nem lett implementálva. S = lokális változtatás; M = több modul vagy adatút. A párhuzamos agent munkáját nem írtuk felül.
