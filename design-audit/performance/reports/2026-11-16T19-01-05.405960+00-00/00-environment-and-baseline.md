# Környezet és alapmérés

2026. november 16. · rögzített alkalmazáspillanatkép · szintetikus helyi adatok.

A 20261116T182653Z időpontban rögzített pillanatkép Budapest szerint 2026-11-16 19:26:53. Alap HEAD: cf2b7887ffa1777e7dbb7699103c6ec90cb07d5b; ág: main. A nem commitolt fájlok is részei a vizsgált állapotnak, ezért a commit önmagában nem reprodukciós azonosító. A snapshot.json 377 fájl SHA-256 lenyomatát tartalmazza. Az auditált alkalmazás fájljai változatlanok.

Forrásrepo: /Users/I769428/Documents/ChatGPT/Főzés/konyha-app

Pillanatkép: /Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z

Node v26.5.0, darwin/arm64, böngésző 157.0.8103.51, Python 3.9.6, npm 11.17.0, PGlite 0.3.14, Playwright 1.58.2.

Architektúra: klasszikus JavaScript globális modulok, localStorage, Supabase auth/REST/RPC, Phoenix WebSocket, Deno Edge Functions, Python kompatibilitási szerver és Capacitor közös webforrás. A web build másol, az esbuild a natív bridge-et bundle-özi. A vizsgált CI Node 22-t használ, a helyi audit Node 26-on futott.

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

Ezek laboradatok, nem éles felhasználói mérések. A viewport és a CPU emulált, nincs fizikai iPhone/Android vagy natív Capacitor-teszt. A helyi kiszolgálás HTTP/1.1, nyers fájlokkal, ETag újraellenőrzéssel; éles CDN, HTTP/2/3 és gzip/Brotli nem mérve. A Google Fonts kérései blokkolva voltak. A hálózati késleltetés és sávszélesség mesterséges. Supabase helyett PGlite és szintetikus REST/Phoenix protokoll működött: ez nem PostgREST-, cloud Realtime-, régió-, connection pool- vagy lock contention-benchmark. Élő providerlatencia, minőség, tokenelszámolás, mikrofon/WebRTC és push/email nem volt tesztelve.

A gépen más Codex-munka is futott. A PGlite benchmark röviden átfedett a hálózati indítási sorral; a külön CPU-profilozás és a hosszú főszál-feladat reprodukciója később, külön történt. Három startup-ismétlésből nem számolunk p95-öt. A blokkolási összeg az 50 ms feletti long-task többlet a megfigyelési ablakban, nem Lighthouse TBT-pontszám. Az Event Timing-adatok nem hitelesített field INP. A CLS a megfigyelt kumulatív eltolódás, nem teljes munkamenetes terepi érték.

A használhatósági próba a load után ellenőrzi az inicializált főnézetet és hozzáad egy 100 ms-os stabilizációs várakozást; nem hivatalos TTI. Az indulási sor vendégállapotra vonatkozik. A bejelentkezett műveletek külön kerültek mérésre. A képernyők csökkentett animációval készültek. A diagnosztikus API- és SQL-idők nem helyettesítik az éles hálózati megfigyelést.

[bizonyíték](../../runs/2026-11-16T18-34-31.217Z-full/results.json) · [bizonyíték](../../resources.json) · [bizonyíték](../../build-web.log)
