# Morzsa — teljesítmény, megbízhatóság és válaszkészség

2026. november 16. · rögzített alkalmazáspillanatkép · szintetikus helyi adatok.

## Vezetői összefoglaló

Több különböző lassulási mechanizmus igazolódott. CPU-profillal kimutatható a bevásárlólista ismételt kategóriakeresése és a receptajánló teljes fuzzy keresése. Lassított hálózaton az AI előkészítése látható folyamatjelzés nélkül vár, a közös készlet párbeszédablaka pedig lezárul a teljes hálózati lánc idejére. Képfeldolgozásnál soros várakozás és leválasztott DOM-elemek megtartása is reprodukálódott.

A kis adatmennyiségű alaputak működtek; AI-hibából, megszakításból és offline listamódosításból helyreállt az app. 2000 tételnél egy navigációs művelet időtúllépett. Nem találtunk igazolt P0 adatvesztést. Az éles panasz valamennyi oka és az élő provider/DB késleltetése ebből a helyi auditból nem állapítható meg.

## Öt elsőként kezelendő probléma

- **PERF-001 — Ismételt kategóriakeresés blokkolja a bevásárlólista renderelését.** 667 tételnél 4225 ms főszál-feladat és 4327 ms navigáció; külön profilozott ismétlés: 4186 ms. 2000 tételnél a kattintás 30 s után időtúllépett.

- **PERF-002 — Pontos recept-alapanyagokhoz is teljes fuzzy keresés fut.** Már 50 tételnél 527 ms-os főszál-feladat; a profilozott megnyitás 643 ms-os intervalluma főként QuickEntry keresés.

- **PERF-003 — Az AI előkészítése látható folyamatjelzés nélkül vár.** 800 ms-nál az üzenet még a mezőben áll, a Küldés gomb aktív, nincs thinking és Stop. Az azonnali helyi AI-válasz is csak 3338 ms körül látható.

- **PERF-004 — A közös készlet teljes hálózati lánca lezárja a párbeszédablakot.** Az összes gomb, a bezárás is tiltott; a művelet 2952 ms-ot vett igénybe.

- **PERF-008 — Egy lassú kép más képek cache-olvasását is feltartja.** A második cache-kérés csak 2019.6 ms-nál indul. A korábbi, sorrendet nem garantáló próba önmagában nem volt bizonyító; a rendezett ismétlés igen.

## Vizsgált verzió és párhuzamos munka

A 20261116T182653Z időpontban rögzített pillanatkép Budapest szerint 2026-11-16 19:26:53. Alap HEAD: cf2b7887ffa1777e7dbb7699103c6ec90cb07d5b; ág: main. A nem commitolt fájlok is részei a vizsgált állapotnak, ezért a commit önmagában nem reprodukciós azonosító. A snapshot.json 377 fájl SHA-256 lenyomatát tartalmazza. Az auditált alkalmazás fájljai változatlanok. Ellenőrzés (UTC): 2026-11-16T19:05:07.479918+00:00.

Az eredeti munkapéldányban közben változott: .gitignore, AGENTS.md, docs/UX-FIRST-AUDIT-FIX-LOG-2026-11-16.md, proactive-ui.js, proactive.css, supabase/migrations/20261116_proactive_suggestions.sql, tests/proactive-sql.test.mjs, tests/proactive.browser.js. Ezeket nem írtuk vissza a pillanatképbe. Javítás előtt az új közös állapotot össze kell vetni az auditált forrással.

## Mérések

| Hálózat | Cache | n | Használhatósági próba ms | LCP ms | FCP ms | TTFB ms | Blokkolási összeg ms |
|---|---|---:|---:|---:|---:|---:|---:|
| fast | cold | 3 | 287.7 | 48 | 28 | 0.9 | 66 |
| fast | warm | 3 | 245.1 | 144 | 136 | 1 | 64 |
| mobile | cold | 3 | 1729.3 | 1460 | 540 | 80.5 | 77 |
| mobile | warm | 3 | 1402.1 | 1092 | 204 | 80.7 | 65 |
| slow4g | cold | 3 | 6206.2 | 5768 | 3468 | 150.5 | 74 |
| slow4g | warm | 3 | 2449.3 | 1996 | 364 | 150.7 | 82 |
| highLatency | cold | 3 | 6205.4 | 5124 | 1124 | 400.5 | 83 |
| highLatency | warm | 3 | 5861.6 | 4936 | 832 | 400.8 | 65 |

60 startup-mérés készült. Az öt fő nézet mind a hat kért méreten használható volt; 30/30 esetben nem volt vízszintes túlcsordulás.

A hosszú munkamenet 353.9 s-ig futott, 20 mintával, 140 nézetváltással, 20 párbeszédnyitással és 4 szintetikus AI-fordulóval. A GC utáni első/utolsó heap 4.11 / 4.69 MiB; DOM 606 / 828; listener 161 / 174; socket 2 / 2. A kis heap-növekedés a felgyűlt chatadatok és JIT miatt önmagában nem leak-bizonyíték. A kész-kép célzott tesztje ettől külön, konkrét DOM-retenciót igazolt.

## Frontend

- PERF-001: 667 tételnél 4225 ms főszál-feladat és 4327 ms navigáció; külön profilozott ismétlés: 4186 ms. 2000 tételnél a kattintás 30 s után időtúllépett.
- PERF-002: Már 50 tételnél 527 ms-os főszál-feladat; a profilozott megnyitás 643 ms-os intervalluma főként QuickEntry keresés.
- PERF-005: 703084 byte JS és 305846 byte CSS változatlanul kerül a buildbe. Lassú 4G laborprofil: hideg LCP medián 5768 ms, használhatósági próba 6206 ms.
- PERF-009: 682 → 1082 DOM-csomópont és 162 → 262 listener, 100 ismétlés után. Ez célzott komponensszintű életciklusteszt.

## Backend, adatbázis és Realtime

- PERF-006: A burst helyesen egy refresh-ciklussá áll össze, de az 8 REST-kérést indít. Két kliens 16.5 s alatt 42 kérést végzett. Kliensenként 2 socket maradt.
- PERF-007: A PGlite minimumidő kb. 1.8 → 6.2 → 26.9 ms. Az 5000 sorból 4950-et a can_read_conversation szűrés dobott el, végig 50 látható sor mellett.

## AI és megbízhatóság

A szintetikus stream mellett a többi nézet interaktív maradt. 503/retry, Stop, csonkolt stream és 61.0 s-os kliens-timeout után helyreállt a felület. AI-művelet csak jóváhagyás után írt a közös listába, az újratöltés visszaigazolta a mentést. A 30 ms-nál megszakított Gemini handler a kontrollált tesztben még elindította a providerhívást.

## Felhasználói utak

| Út | Végrehajtás és állapot |
|---|---|
| J1 Indítás | 60 cold/warm mérés, 6 viewport, 4 hálózati profil, 4× CPU. Lassú profilban túllépés. |
| J2 Navigáció | Mind az öt nézet; 125 főváltás rövid ismételt sorban és 30 viewport/nézet-kombináció. Nagy adatokkal lassul. |
| J3 Készlet | Hozzáadás, állapotváltás, elfogyott jelölés, frissítés. Közös lassú mentési zárolás reprodukálva. |
| J4 Lista | Batch bevitel, tört mennyiség, törlés, vásárolt jelölés, lezárás, két kliens, offline/reconnect. Funkcionálisan sikeres. |
| J5 Receptek | SQL-feed, részletek, adagváltás, hiányok előnézete és listára tétele. Renderelési long task. |
| J6 AI | Rövid/hosszabb kérés, stream, más nézet használata, művelet jóváhagyása, 503/retry, Stop, csonkolás és valódi timeout. |
| J7 Hosszú használat | Külön közel hatperces munkamenet: AI, Realtime, polling, párbeszédek. Célzott képcache-retenció. |

## Bizonyosság

PERF-001…010: a leírt helyi mechanizmus bizonyított. PERF-011: alacsony bizonyosságú időzítési hipotézis, a 400 válaszok ténye dokumentált. A konkrét éles fagyás kiváltó okát és gyakoriságát nem bizonyítottuk.

## Prioritásos terv

Először a négy P1 feladat: számítási indexek és pontos egyezések, azonnali AI-preparing állapot, interaktív közös mentés. Utána képsor, képcache-életciklus, háttérfrissítések, query-jelöltek és indítási csomag. [Teljes technikai javítási terv](08-prioritized-remediation-plan.md).

| Művelet | Javasolt cél | Mérés | Besorolás és felhasználói hatás |
|---|---|---|---|
| Kezdeti betöltés | LCP ≤ 2.5 s, CLS ≤ 0.1 | Kijelölt mobilprofil, később field p75 | Kiadási cél: hamar megjelenő használható tartalom |
| Főnézet-váltás | p50 ≤ 100 ms, p95 ≤ 200 ms meleg adatokkal | Kattintás → használható frame, legalább 30 minta | Kiadási követelmény szokásos háztartási méreten |
| Helyi kapcsoló/gomb | p95 ≤ 100 ms, long task ≤ 50 ms cél | Event Timing és trace | Kiadási cél: azonnali visszajelzés |
| Készlet/lista mentés | Visszajelzés ≤ 100 ms; szervernyugta p95 ≤ 1.5 s a kijelölt stagingprofilon | UI és persisted timestamp külön | Pending UI kiadási feltétel; hálózati SLO később validálandó |
| Receptfeed | Cache p95 ≤ 200 ms; hálózatos adat p95 ≤ 1 s | Render és request külön | Kiadási cél a 24 kártyás oldalon |
| AI előkészítés | Jelzés ≤ 100 ms; meleg preflight p95 ≤ 500 ms | Gomb → preparing és provider-start | Jelzés kiadási feltétel; láncrövidítés optimalizáció |
| AI első válasz | Kezdeti cél p50 ≤ 2 s, p95 ≤ 5 s | Provider és end-to-end TTFT külön | Hosszabb távú, valódi providermintákkal kalibrálandó |
| AI teljes válasz | p50 ≤ 8 s, p95 ≤ 20 s cél; 60 s végső határidő | Azonos feladat/profil | Szolgáltatási cél; timeout/retry helyreállás kiadási feltétel |
| Realtime | p95 ≤ 1 s egészséges kapcsolat; polling fallback ≤ 10 s | Két kliens persisted → visible | Stagingen validálandó; offline szándékmegőrzés kiadási feltétel |
| Memória | Nincs monoton DOM/listener-emelkedés; 10 perc után GC-heap +10% cél az új adatok nélkül | Azonos nézet, forced GC, adatok számlálása | Kiadási ellenőrzés; többórás fizikai eszközteszt később |
| Képbetöltés | Cache-kérés ne várjon független generálásra | Képenként queue/start/end | Kiadási működési feltétel; generálási idő élő mintákból |

## Lefutott tesztek

291/291 meglévő JavaScript-teszt, tíz SQL-tesztsor, 9/9 Python-teszt, build:web és a tényleges Python Handler indítása sikerült. Hat CPU-profil, PGlite EXPLAIN ANALYZE és öt injektált provider/handler eset is lefutott. A kapacitási és képcache-fail ellenőrzések megmaradtak. A hibás első soak-seedelés és az önmagában nem bizonyító, rendezetlen képpróba is szerepel az eredeti runokban.

## Korlátok

Ezek laboradatok, nem éles felhasználói mérések. A viewport és a CPU emulált, nincs fizikai iPhone/Android vagy natív Capacitor-teszt. A helyi kiszolgálás HTTP/1.1, nyers fájlokkal, ETag újraellenőrzéssel; éles CDN, HTTP/2/3 és gzip/Brotli nem mérve. A Google Fonts kérései blokkolva voltak. A hálózati késleltetés és sávszélesség mesterséges. Supabase helyett PGlite és szintetikus REST/Phoenix protokoll működött: ez nem PostgREST-, cloud Realtime-, régió-, connection pool- vagy lock contention-benchmark. Élő providerlatencia, minőség, tokenelszámolás, mikrofon/WebRTC és push/email nem volt tesztelve.

A gépen más Codex-munka is futott. A PGlite benchmark röviden átfedett a hálózati indítási sorral; a külön CPU-profilozás és a hosszú főszál-feladat reprodukciója később, külön történt. Három startup-ismétlésből nem számolunk p95-öt. A blokkolási összeg az 50 ms feletti long-task többlet a megfigyelési ablakban, nem Lighthouse TBT-pontszám. Az Event Timing-adatok nem hitelesített field INP. A CLS a megfigyelt kumulatív eltolódás, nem teljes munkamenetes terepi érték.

A használhatósági próba a load után ellenőrzi az inicializált főnézetet és hozzáad egy 100 ms-os stabilizációs várakozást; nem hivatalos TTI. Az indulási sor vendégállapotra vonatkozik. A bejelentkezett műveletek külön kerültek mérésre. A képernyők csökkentett animációval készültek. A diagnosztikus API- és SQL-idők nem helyettesítik az éles hálózati megfigyelést.

## Fájlok és újrafuttatás

[Teljes képernyő- és bizonyítékjegyzék](06-user-journey-results.md). [Gépileg feldolgozható findings.json](findings.json). A két szinttel feljebb található README.md tartalmazza a pontos parancsokat. Az audit során nem módosítottunk alkalmazáskódot, éles adatot vagy auth/RLS-szabályt; nem commitoltunk, pusholtunk vagy deployoltunk. Auditfájlok és helyi tesztadatok készültek.
