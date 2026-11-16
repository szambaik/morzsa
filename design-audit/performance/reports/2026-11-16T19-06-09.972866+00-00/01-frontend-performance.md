# Frontend, főszál és memória

2026. november 16. · rögzített alkalmazáspillanatkép · szintetikus helyi adatok.

### PERF-001 — Ismételt kategóriakeresés blokkolja a bevásárlólista renderelését

P1 · confirmed · bizonyosság: high

667 tételnél 4225 ms főszál-feladat és 4327 ms navigáció; külön profilozott ismétlés: 4186 ms. 2000 tételnél a kattintás 30 s után időtúllépett.

**Ok:** A shoppingGroupHeader minden csoporthoz újraszűri a teljes listát. A productCategory minden összehasonlításnál új tömböt épít, kisbetűsít és lineárisan keres. A CPU-profil forró pontja app.js:15.

**Reprodukció:**

1. 50, 250, majd 667 szintetikus katalógustétel kerüljön a készletbe és a listára.
2. Áttekintésből kattintás a Lista fülre.
3. A long-task adatok és a shopping-667.cpuprofile ellenőrzése.

**Forrás:** [app.js:15](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/app.js:15), [app.js:175](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/app.js:175), [app.js:198](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/app.js:198)

**Bizonyíték:** [bizonyíték](../../runs/2026-11-16T18-34-31.217Z-full/results.json) — scaling · [bizonyíték](../../runs/2026-11-16T18-41-13.534Z-supplement/traces/shopping-667.cpuprofile) · [bizonyíték](../../runs/2026-11-16T18-34-31.217Z-full/traces/long-session.zip)

**Javaslat:** Normalizált név → kategória index; csoportosítás és darabszámok egy menetben. Szükség esetén ezt kövesse DOM-ablakozás.

**Elfogadás:**

- 250 tételnél a meleg Lista-váltás p95 ≤ 200 ms.
- 667 tételnél nincs 200 ms feletti alkalmazáskód-feladat.
- 2000 tételnél sem veszhet el a navigáció válaszkészsége.
- Magyar/angol nevek és egyéni tételek helyes kategóriában maradnak.

### PERF-002 — Pontos recept-alapanyagokhoz is teljes fuzzy keresés fut

P1 · confirmed · bizonyosság: high

Már 50 tételnél 527 ms-os főszál-feladat; a profilozott megnyitás 643 ms-os intervalluma főként QuickEntry keresés.

**Ok:** recipe-library.cards → discoverySections → recipeChoice → resolve → QuickEntry.match. A ranked minden katalógusnévre Levenshtein-távolságot számol akkor is, amikor a név pontosan egyezik.

**Reprodukció:**

1. 31 seed-recept, 50 tételes készlet/lista.
2. Receptek / Neked megnyitása.
3. recipes-50.cpuprofile megnyitása DevToolsban.

**Forrás:** [quick-entry.js:2](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/quick-entry.js:2), [quick-entry.js:4](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/quick-entry.js:4), [quick-entry.js:5](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/quick-entry.js:5), [quick-entry.js:6](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/quick-entry.js:6), [recipe-library.js:26](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/recipe-library.js:26), [kitchen-model.js:58](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/kitchen-model.js:58)

**Bizonyíték:** [bizonyíték](../../runs/2026-11-16T18-34-31.217Z-full/results.json) — scaling · [bizonyíték](../../runs/2026-11-16T18-41-13.534Z-supplement/traces/recipes-50.cpuprofile) · [bizonyíték](../../runs/2026-11-16T18-41-13.534Z-supplement/traces/recipes-250.cpuprofile)

**Javaslat:** Pontos és alias-egyezések indexelése; fuzzy keresés csak elírásnál. A recept-alapanyag feloldásokat a katalógusverzióhoz kötötten cache-elni.

**Elfogadás:**

- A 24 kártyás meleg ajánló renderelése p95 ≤ 200 ms.
- Pontos neveknél nincs teljes katalógusos távolságszámítás.
- Az elírt és ékezet nélküli gyors bevitel megmarad.

### PERF-005 — A web build 60 szinkron scriptet és kb. 1 MB nyers JS/CSS-t tölt

P2 · confirmed · bizonyosság: high

703084 byte JS és 305846 byte CSS változatlanul kerül a buildbe. Lassú 4G laborprofil: hideg LCP medián 5768 ms, használhatósági próba 6206 ms.

**Ok:** Nincs alkalmazásbundle, minifikálás vagy kódfelosztás a web buildben. A klasszikus globális scriptfüggőségek és a sok erőforrás több hálózati kört igényelnek.

**Reprodukció:**

1. build:web a pillanatképen.
2. 390 px-es hideg indítás 150 ms RTT és 200000 byte/s letöltés mellett.
3. Meleg cache és 400 ms RTT megismétlése.

**Forrás:** [index.html:1](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/index.html:1), [scripts/build-mobile.mjs:5](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/scripts/build-mobile.mjs:5), [styles.css:1](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/styles.css:1), [workspace.css:1](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/workspace.css:1)

**Bizonyíték:** [bizonyíték](../../resources.json) · [bizonyíték](../../runs/2026-11-16T18-34-31.217Z-full/results.json) — startup

**Javaslat:** Explicit buildfüggőségek; minifikált kezdeti csomag; ritka hang/kép funkciók késleltetett betöltése. Stagingen a tömörítés és cache ellenőrzése.

**Elfogadás:**

- LCP ≤ 2.5 s cél a kijelölt mobilprofilon.
- Külön kezdeti JS/CSS transfer budget.
- Az inicializációs sorrend és mind az öt nézet működése megmarad.

### PERF-009 — A kész képek cache-e leválasztott DOM-elemeket tart meg

P2 · confirmed · bizonyosság: high

682 → 1082 DOM-csomópont és 162 → 262 listener, 100 ismétlés után. Ez célzott komponensszintű életciklusteszt.

**Ok:** entry.views erős referenciát tart a hostra és paint closure-re. A leválasztott elemeket csak későbbi refresh/paint takarítja; egy kész, nem frissülő képnél ez elmaradhat.

**Reprodukció:**

1. Egy kész helyi receptkép bemelegítése.
2. Ugyanazon kép 100 mount/remove ciklusa.
3. Kényszerített GC után DOM- és listener-számlálás.

**Forrás:** [recipe-images.js:23](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/recipe-images.js:23), [recipe-images.js:47](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/recipe-images.js:47), [recipe-images.js:48](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/recipe-images.js:48)

**Bizonyíték:** [bizonyíték](../../runs/2026-11-16T18-41-13.534Z-supplement/results.json) — imageRetention

**Javaslat:** Explicit dispose/unmount, observer-lekapcsolás, leválasztott nézetek törlése és korlátos képcache.

**Elfogadás:**

- 100 mount/unmount után a bemelegített DOM/listener-alapérték közelébe tér vissza.
- Látható képek és lejáró signed URL-ek frissítése működik.

## Hosszú használat

A hosszú munkamenet 353.9 s-ig futott, 20 mintával, 140 nézetváltással, 20 párbeszédnyitással és 4 szintetikus AI-fordulóval. A GC utáni első/utolsó heap 4.11 / 4.69 MiB; DOM 606 / 828; listener 161 / 174; socket 2 / 2. A kis heap-növekedés a felgyűlt chatadatok és JIT miatt önmagában nem leak-bizonyíték. A kész-kép célzott tesztje ettől külön, konkrét DOM-retenciót igazolt.

[bizonyíték](../../runs/2026-11-16T18-45-56.672Z-soak/results.json)
