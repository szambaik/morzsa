# Javasolt teljesítménykeretek

2026. november 16. · rögzített alkalmazáspillanatkép · szintetikus helyi adatok.

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

Ezek javasolt célok, nem bizonyított éles SLO-k. p95 csak megfelelő mintaszám és azonos profil mellett. Az AI-keretek feladat-, modell- és képméret szerint kalibrálandók.
