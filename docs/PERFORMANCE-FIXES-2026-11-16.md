# Morzsa — teljesítményjavítások és ellenőrzés, 2026. november 16.

A javítások az eredeti, bizonyítékokkal alátámasztott [teljesítményauditot](../design-audit/performance/README.md) követik. A történeti jelentések változatlanok; ez a dokumentum a megvalósítás és az új mérések állapotát rögzíti.

A főszálat blokkoló ismételt kereséseket megszüntettük, az AI előkészítése azonnali visszajelzést és megszakítást kapott, a készletablak mentés közben bezárható, és csökkent a háttérszinkronizálás forgalma. A webes indulás javult, de lassú hálózaton további csökkentést igényel.

## Hatókör és párhuzamos munka

A munka külön codex/performance-audit-fixes worktree-ben készült. A 4e9e6a8 main állapotot — a korábbi UX-javításokkal és az új proaktív funkcióval együtt — merge-eltük. Az eredeti, módosított munkakönyvtárhoz és a natív UI-n dolgozó session worktree-jéhez nem nyúltunk. A mobile/, ios/ és android/ fájlokhoz nem tartozik változás ebben a javításban. Az új bundling csak a --web ágon fut.

Az alkalmazás és az audit kizárólag szintetikus, helyi adatokkal futott. Nincs éles adatbázis-módosítás, valódi meghívó, üzenetküldés vagy fizetős AI-kérés. Az SQL-migráció és az Edge Function változásai a repóban vannak; éles Supabase-telepítésük nem történt meg.

## Javítások az audit azonosítói szerint

| Azonosító | Megvalósítás | Állapot és bizonyíték |
|---|---|---|
| PERF-001 | Katalógusnév–kategória index; a lista egyszeri csoportosítása; előre kiszámolt csoportok. | A 667 tételes lista megnyitásakor nincs rögzített long task; a 2000 tételes stresszteszt is végigfutott. |
| PERF-002 | Normalizált nevek korlátos cache-e; pontos és alias-egyezés indexből; renderenkénti recept-alapanyag feloldó. | Az 50 tételes receptnézetben nincs long task. Az elírás-, ékezet- és angolnév-kezelés tesztjei megmaradtak. |
| PERF-003 | Busy/Stop állapot a history flush és turn-lock előtt; megszakításkor megmarad a kérdés és a csatolmány; későn megkapott lock feloldása. | A megszakított előkészítés nem küld providerkérést; újrapróbáláskor egyetlen felhasználói üzenet keletkezik. A válasz mentési kísérlete befejeződik a lock feloldása előtt, fiók- és session-ellenőrzéssel. |
| PERF-004 | A mentés állapotát jelző, bezárható készletablak; módosítások továbbra is védettek; a régi mentés nem festheti újra az időközben megnyitott másik tételt. | Késleltetett Rizs-mentés közben Tej megnyitható; Tej ablaka megmarad; újratöltés után a Rizs mentése ellenőrzött. |
| PERF-005 | Webes classic scriptek sorrendtartó összefűzése és minifikálása; egy deferred, tartalomhash-es JS és egy CSS. | Részben megoldva. A tényleges web-dist minden főnézete működik, de a lassú 4G LCP továbbra is 2,5 s felett van. |
| PERF-006 | Csak sikeresen csatlakozott WebSocket számít egészségesnek; táblánkénti invalidálás és esemény-összevonás; kb. 60 s konzisztenciafrissítés; hibás socket mellett az eredeti polling fallback. | 20 stock eseményből 2 REST-olvasás; stabil kapcsolat mellett 17 s változatlan időszakban 0 REST-olvasás. A célzott frissítés nem tolja el a teljes konzisztenciafrissítést. |
| PERF-007 | Additív indexek és indexelt saját/megosztott beszélgetésjelöltek a conversation_index RPC-ben. | Helyben validált, éles telepítésre vár. Az eredeti és az új eredmény azonos 5000 rekordos, több felhasználós tesztben: lapozás, törlés, visszavont megosztás, privát szülőadat és archiválás mellett is. |
| PERF-008 | A képek cache-olvasása legfeljebb négy párhuzamos kérésen, a generálási sortól függetlenül fut. | A második kép olvasása kb. 65 ms-nál elindul akkor is, ha az első két másodpercig vár. |
| PERF-009 | Leválasztott képmountok és IntersectionObserverek felszabadítása; inaktív cache-bejegyzések korlátozása. | 100 mount/eltávolítás és GC után 0 DOM-node és 0 listener növekedés. |
| PERF-010 | A kliens AbortSignal továbbadása az auth, quota, Gemini/Groq és stream feldolgozásnak; megszakításellenőrzés fallback előtt. | Helyi handler- és streamtesztek sikeresek; megszakított előkészítés után 0 providerhívás. Éles Edge Function-telepítésre vár. |
| PERF-011 | A még el nem mentett, revision=0 beszélgetés nem kér conversation_page oldalt. | Az ismert hibafeltétel megelőzve és tesztelve. Az eredeti átmeneti 400-asok teljes időzítési oka továbbra is hipotézis, nem lezárt gyökérok. |

## Mért változás

| Mérési eset | Eredeti audit | Javítás után |
|---|---:|---:|
| 667 tételes lista, profilozott megnyitás intervalluma | 4186 ms | 172 ms |
| 50 tételes receptnézet, profilozott megnyitás intervalluma | 643 ms | 106 ms |
| Második képcache-kérés indulása, első kérés 2 s késleltetéssel | 2020 ms | 65 ms |
| 100 képmount utáni megmaradó DOM-node/listener növekedés | +400 / +100 | 0 / 0 |
| Webes hideg indulás, slow4g, LCP medián (3 minta) | 5768 ms | 4984 ms |
| Új beszélgetésindex RPC, 5000 rekord, 7 helyi minta | legalább kb. 26,9 ms | 0,97 ms medián |

Ezek laboreredmények, nem éles felhasználói Core Web Vitals vagy p95 ígéretek. A profilintervallum a mérőharness által körülvett megnyitás ideje, nem kizárólag JS CPU-idő. A lista- és receptmérések egy-egy profilozott ismétlésből származnak. Az új mérés közben már a mainre bekerült proaktív funkció is jelen volt. A 667 tételes receptnézet egyik futásában maradt egy 51 ms-os long task; nem állítjuk, hogy minden hosszú feladat megszűnt.

Az új web build 61 scriptből egyet, 4 CSS-ből egyet készít. A JS 710 498 → 614 586 byte, a CSS 306 507 → 297 888 byte, tömörítetlenül. Három hideg, 390×844-es, 150 ms késleltetésű / 200 kB/s letöltésű futásban az LCP 4988 / 4984 / 4968 ms volt, a használhatóság mediánja 5422 ms. A loopback HTTP/1.1 kiszolgálás nem használ gzipet/Brotlit; a GitHub Pages éles hálózati eredményét ez nem helyettesíti.

A korábbi 42 háttérkérés két kliensre és 16,5 másodpercre vonatkozott; az új célzott 0 kéréses ellenőrzés egy kliens 17 másodperce. Emiatt ebből nem számolunk közvetlen százalékos csökkenést. A 20 eseményes burst új tesztje valódi táblanévvel dolgozik; ismeretlen eseménynél szándékosan teljes frissítés marad.

Az adatbázisteszt PGlite/WASM PostgreSQL. Az ugyanott mért conversation_inner diagnosztika szándékosan az eredeti lassú lekérdezést futtatja, nem az új RPC-t. Éles Supabase-terhelés, connection pool, hálózat és cold start itt nem mérhető.

## Ellenőrzések és megőrzött bizonyítékok

- 302 JavaScript-teszt, 10 SQL-tesztcsomag, 9 Python-teszt és 26 audit-infrastruktúra teszt sikeres.
- A végső kódon a teljes kötelező release gate: 32 axe-scan, 54 célzott UX-ellenőrzés, nulla sikertelen eset.
- Valós böngészős öt főnézet, 6 viewport (320–1440 px), 30 overflow-ellenőrzés, 125 navigációs/dialogciklus, 50/250/667/2000 tételes stressz.
- AI-stream, providerhiba és újrapróbálás, megszakítás, hosszú válasz, megszakadt stream, tényleges 60 másodperces kliens-timeout és helyreállás.
- Közös lista, gyors egymás utáni műveletek, offline outbox és újracsatlakozás, két kliens közti szinkron, szerveres visszaolvasás.
- A tényleges minifikált web build háromszor indul, mind az öt főnézet használható, helyi listamódosítás újratöltés után megmarad, nincs pageerror.
- A mért futások forrás-hash ellenőrzése nem jelzett futás közbeni változást.

A részletes összehasonlító mérés a 4e9e6a8 main merge után történt. Ezt követte a lock-feloldási sorrend utolsó javítása; utána újra lefutott az összes JS/SQL-teszt, a teljes release gate, a célzott performance-regresszió és a csomagolt webteszt. A lista-/kép-profilokat nem ismételtük, mert ez az utolsó változás ezeket nem érinti.

A szándékosan injektált 503, offline és félbeszakított HTTP-válaszok konzolhibái a nyers adatokban megmaradtak. Ezek a hibakezelési tesztek bemenetei; a regression és supplement futásban nem volt konzolhiba. A megszakított és hibás provideresetek elvárt sikertelen válaszok, nem működő providerhívásként szerepelnek.

Géppel olvasható összegzés, futásazonosítók, forrás-hash-ek és mérési adatok: [evidence.json](performance-fixes-2026-11-16/evidence.json). Képernyőképek: [AI előkészítés és Stop](performance-fixes-2026-11-16/01-preparing-with-stop.png), [bezárható mentés](performance-fixes-2026-11-16/02-closable-pending-pantry.png), [csomagolt webnézet](performance-fixes-2026-11-16/bundled-web.png).

A teljes helyi trace-ek, CPU-profilok és hálózati naplók az evidence.json rawEvidence útvonalain maradnak. Az új futások generált fájljai gitignore alatt vannak; a CI a release- és performance-regressziós bizonyítékokat 14 napig artifactként őrzi meg. A történeti audit nyers bizonyítékait nem töröltük.

## Újrafuttatás

A repository gyökerében, a megfelelő Node/Chromium környezettel:

~~~sh
npm ci
npm --prefix design-audit ci
npm --prefix design-audit/performance ci
npx --prefix design-audit playwright install chromium
npm test
python3 -m unittest discover -s tests -p 'test*.py'
npm --prefix design-audit test
MORZSA_AUDIT_BROWSER_CHANNEL=chromium node design-audit/check-release.mjs
npm --prefix design-audit/performance run audit:performance:regression
npm --prefix design-audit/performance run audit:performance:journeys
node design-audit/performance/runner.mjs supplement
node design-audit/performance/runner.mjs faults
node design-audit/performance/database.mjs
node design-audit/performance/providers.mjs
npm run build:web
MORZSA_AUDIT_BROWSER_CHANNEL=chromium node design-audit/verify-web-build.mjs
~~~

## Nyitott pontok

A lassú hálózati indulás további asset- és betöltésoptimalizálást igényel. A regressziótesztek nem igazolnak éles p95/INP-t vagy fizikai iOS/Android teljesítményt. Az éles SQL-migráció és voice-command Edge Function kiadása külön rollout feladat. A natív UI átállása a párhuzamos session munkája; annak készüléktesztje és integrációja nem része ennek a webes auditnak.
