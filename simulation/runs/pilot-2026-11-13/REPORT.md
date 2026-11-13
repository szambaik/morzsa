# Morzsa — első, költségkímélő UX-szimuláció

2026. november 13. · Seed: 20261113 · Helyi tesztadatok · Publikus háztartásadat nem változott.

## Eredmény

A legerősebb jelzés: **a recept olvasása és a főzés megkezdése még összemosódik**, és a rögzített chat/főzési sáv kevés helyet hagy az olvasásnak. A készletváltoztatásnál a „Javaslat · még nincs mentve” megfogalmazás és a külön Mentés gomb érthetően jelzi a határt.

Ez egy kicsi, részben megszakadt pilot. Két független, célokkal irányított AI-szereplő próbálta a valódi felületet; **nem valódi felhasználói kutatás**. Mindkettő böngészőeszköze elérhetetlenné vált a futás közben. Ez a szimuláció infrastruktúrájának hibája, nem a Morzsa feladatbefejezési hibája. A hiányzó lépéseket nem számítottuk sikeresnek.

Külön lefutott a hat kétfős háztartás adatkezelési alapköre: **48 forgatókönyv-esemény, 114/114 sikeres adatvédelmi és állapotkonzisztencia-ellenőrzés**. Előre megadott AI-műveleteket játszottunk vissza a valódi modelleken és memóriában futó Supabase alap-RPC-kon. Ez nem AI-pontossági vagy UX-sikerarány.

## Konfiguráció és mért számok

| Mérés | Eredmény | Mit jelent? |
|---|---|---|
| Adatkezelési profilok | 6 háztartás, 12 auth-személy | Közös izolált adat, külön személyes előzmény |
| Forgatókönyvnapok | 2 | Nem a tervezett hétnapos autonóm vizsgálat |
| Adatkezelési események | 48 | Vásárlás, fogyás, lista, ismétlés, elvetés, konfliktus, befejezés, emlékeztető |
| Invariánsok | 114/114 | Tárolási/RPC és modellállapot; nem UI-kattintás |
| UI-szereplők | 2 | Elfoglalt pár egyik tagja és tervező egyik tagja |
| UI-műveletek | 8 | A: 2; E: 6; önbevallott, naplózott műveletszám |
| Böngészőhívások | 14 | A: 4; E: 10 |
| Megkezdett UI-feladatok | 3 | 1 készlet/lista + 2 receptcél |
| Teljesen befejezett UI-feladatok | 0 | Infrastruktúra-megszakítás; **nem 0%-os app-sikerarány** |
| UI-feladatbefejezési arány | Nem megállapítható | Nincs végigfutott, kiértékelhető feladatcsoport |
| AI intent-pontosság | Nem mértük | Konzerv AI-válaszok; nincs valódi inferencia |
| Élő kétklienses realtime | Nem mértük | A SQL-RPC konfliktuskezelést teszteltük |
| Külső API-hívás és -díj | 0 hívás, $0 API-díj | A Codex beszélgetés és két szereplő saját kvótát/díjat használ; összköltsége itt nem lekérdezhető |

A felületbe nem adtunk kattintási útvonalat a szereplőknek. A szülő feladat a munkamenetük után külön értékelte a naplókat és megnyitotta a ténylegesen mentett képfájlokat. A bíró így elkülönül a szereplőktől, de a szülő ismeri a kódot: az értékelés nem teljesen vak.

## Felületi lépések és bizonyíték

1. **Kezdőképernyő — vegyes.** A megszokott chatbevitel megtalálható. A nagy főzési köszöntő és a Megvan még blokk sok függőleges helyet használ. Az A-szereplő 720px magas külső képe levágja a 844px iframe alját; a hiányzó navigáció ebből a képből **nem állapítható meg apphibaként**.
2. **Tejparancs — érthető, mentésig nem ellenőrzött.** A kért készletből kivétel és listára vétel megjelent két sorban. A szereplő a friss hozzáférhetőségi állapotban látta a még nem mentett jelzést és a Mentés/Pontosítás/Mégsem gombokat. Mentés, visszavonás és ismételt listaelem nem lett UI-n ellenőrizve.
3. **Receptgyűjtemény — megtalálható, olvasási belépés bizonytalan.** A tervező megnyitotta a gyűjteményt. A recept címére kattintás nem nyitott receptet; a Főzzünk együtt igen.
4. **Teljes elkészítés — működő olvasási alap, zsúfolt alsó terület.** A Teljes recept alapállapotban mindhárom lépés elérhető volt, görgetéssel végigolvasva. A lépések olvasása nem változtatta a 0/3 teljesítést. A főzési lépésválasztó, chat és navigáció az alsó kb. 200px területen versenyez a tartalommal.
5. **Hozzávaló szerkesztése / megosztás — nem ellenőrzött.** A vezérlők egy része megtalálható volt, de a műveletsor itt megszakadt. Nincs állítás sikeres listára mentésről vagy rendszerszintű megosztásról.

![A szereplő kezdőképernyője: a 844px mobilkeretet a 720px külső képernyő részben levágja](ui/actor-a/01-initial.png)

![A tervező által megnyitott recept](ui/planner/01-recipe-open.jpg)

![A teljes elkészítés olvasása; lent rögzített főzési és chatvezérlők](ui/planner/02-recipe-method.jpg)

## Rangsorolt megállapítások

### SIM-001 — Olvasás és főzés indítása összemosódik

- **Kategória / súly:** UX, közepes. Egy megfigyelt szereplő; gyakoriság nem becsülhető.
- **Szándék:** Előbb átfutni a receptet, utána dönteni a főzésről.
- **Megfigyelt:** A címre kattintás nem működött; a Főzzünk együtt után már Főzés/Befejezem fogadta, bár semmit sem jelölt késznek.
- **Elvárt:** A teljes recept olvasása legyen elsődleges, a főzés indítása külön egyértelmű lépés.
- **Ok:** A könyvtári kártya egyetlen fő belépési pontja a főzéshez kapcsolódik. Ez kód és napló alapján igazolt; a felhasználói hatás szimulált.
- **Bizonyíték:** planner/session.json 3–6. művelet, 01-recipe-open.jpg és 02-recipe-method.jpg.
- **Javaslat:** Kattintható receptkártya „Recept megnyitása” jelentéssel, külön „Főzés indítása”; az olvasás önmagában ne hozzon létre elkezdett főzést.
- **Elfogadás:** Új mobilpróbán a szereplő legfeljebb két érintéssel eléri az összes hozzávalót/lépést; olvasás után a főzési státusz nem változik.

### SIM-002 — Olvasás közben a chat és főzési dock túl sok helyet használ

- **Kategória / súly:** UI/UX, közepes.
- **Szándék:** Folyamatosan végigolvasni az elkészítést.
- **Megfigyelt:** A rögzített lépésválasztó és chat a mobilkeret alsó részén sok helyet használ; a második lépés a vezérlők alá fut a képen. A tartalom továbbgörgethető, nincs igazolt elveszett utolsó sor.
- **Elvárt:** Olvasáskor több szöveg, főzéskor egy aktív lépés és egy következő művelet legyen hangsúlyos.
- **Ok:** A teljes recept nézet és a főzési chat ugyanazt a rögzített alsó vezérlősort használja.
- **Bizonyíték:** 02-recipe-method.jpg; planner 5–6. művelet.
- **Javaslat:** Olvasási nézetben a composer helyett egy kis „Kérdés Morzsának” belépés; fókuszban teljes chat és kész/tovább. A hozzávalógomb maradjon mindig elérhető.
- **Elfogadás:** 390×844 és 320×676 méreten a teljes recept olvasásához használt rögzített sáv legfeljebb 120px legyen a navigációval együtt; az utolsó lépés teljes szövege elérhető, nem takart.

### SIM-003 — Régi receptek lépéscíme megismétli a leírást

- **Kategória / súly:** UI/tartalom, alacsony.
- **Szándék:** Gyorsan átlátni, mi lesz a következő főzési teendő.
- **Megfigyelt:** A régi palacsintarecept első cselekvő mondata hosszú, több soros címként, majd hasonló szövegként ismétlődik.
- **Elvárt:** Rövid cím, alatta részletes módszer.
- **Ok:** A régi, stepTitles nélküli mentések első mondatából képződik kompatibilis cím. Az új AI-receptek már külön címet támogatnak.
- **Bizonyíték:** 02-recipe-method.jpg; recipe-room-model.js stepTitle fallback.
- **Javaslat:** Régi receptekhez fokozatos, külön metaadatként tárolt rövid címek, a mentett elkészítés felülírása nélkül.
- **Elfogadás:** A címet legfeljebb két sorban lehessen áttekinteni mobilon; a részletes instrukció változatlanul olvasható.

### SIM-INFRA-001 — Független böngészős szereplők vezérlőeszköze eltűnt

- **Kategória / súly:** Harness, magas a kutatáshoz; nem termékhiba.
- **Megfigyelt:** A 4., illetve 10. CUA-hívás után a szereplők nem tudták tovább hívni a böngészőt. Az E-szereplő JSON-naplóját a szülő a végső beszámoló alapján írta ki; ezt nem automatikus trace-ként kezeljük.
- **Javaslat:** Tartós böngészőadapter és checkpoint minden művelet után; egy hiányzó eszközt ne keverjünk a feladatelhagyással. Képek mentése a teljes 844px mobilkerettel, később 320px próba is.
- **Elfogadás:** Mindkét szereplő végigfut vagy maga hagyja el a célt; nincs eszközhiány miatti megszakítás. A bíró minden változtató művelethez kap előtte/utána bizonyítékot.

## Ami működik és megőrzendő

- Jól látható, még nem mentett AI-javaslat; nem állítja befejezettnek a módosítást.
- A Teljes recept alapállapotban több lépést mutat; puszta görgetés nem pipál ki főzési lépést.
- Ismételt listakérés nem duplikál: a replay-ben mind a hat háztartásban igazolt.
- A partner által módosított rekordra érkező elavult revíziót a valódi alap-RPC elutasítja, az új állapot megmarad.
- A saját, nem bepipált emlékeztető megmarad vásárlásbefejezés után.
- A tej friss megerősítése után aznap nem kérdez újra, 24 óra múlva igen; az emlékeztető nem távolít el készletet.

## Funkcióhipotézisek — későbbi próbára, még nem implementálva

1. **Olvasás → főzés indítása:** külön receptolvasási állapot, amelyből egy érintés a fókuszos főzés. SIM-001/002 alapján a legerősebb ötlet.
2. **Főzés közbeni segítség igény szerint:** kis Morzsa-belépés olvasáskor, teljes chat csak kérdéskor. A tartalomnak ad helyet, miközben az asszisztens elérhető marad.
3. **Hiányzó hozzávalóhoz gyors helyettesítés:** a hiányzó sorból „Mivel helyettesítsem?” a recept chatjébe, a készlet ismeretlen elemeit külön megerősítve. Ez termékhipotézis; a pilot nem tesztelte a helyettesítési feladatot.
4. **Proaktivitás tanulása:** „Túl gyakran kérdezed / Most hasznos” visszajelzés az emlékeztetőn. A jelenlegi napi tejciklus technikailag jó, de a gyakoriság hasznosságát csak hosszabb, valódi háztartási használat igazolhatja.

## Következő implementációs és tesztfeladatok

| Prioritás | Feladat | Elfogadási cél |
|---|---|---|
| 1 | Harness böngészőfolytatás és teljes trace | 2×2 UI-cél megszakítás nélkül vagy valódi elhagyással |
| 2 | Külön receptolvasási belépés | SIM-001 mérhető célja |
| 3 | Composer csökkentése olvasás közben | SIM-002 méret- és láthatósági célja |
| 4 | Valódi AI fejléc/kontextus próba | Vásárlás/fogyás/lista/kérdés/bizonytalanság külön; valós inferencia naplóval |
| 5 | Hétnapos kétfős kör + valódi emberek kalibrálása | Emlékeztető-hasznosság, partnerkoordináció, javaslatelfogadás mérése |

Regressziós készlet: név-only vásárlás; ugyanaz a listakérés kétszer; partner közben átírja a mennyiséget; bizonytalan állítás elvetése; tej újraellenőrzése 0/23/24 óránál; egyéni emlékeztető vásárlás után; olvasás nem főzés; fókuszváltás nem lépésteljesítés; utolsó lépés láthatósága; megosztás megszakítása nem másol.

## Újrafuttatás, teljes nyers bizonyíték

- [Harness és modellezési/költségterv](../../README.md)
- [Profilok és UI-célok](../../pilot.json)
- [Seedelt eseménynapló](replay-seeded/events.jsonl), [mért adatkezelési eredmények](replay-seeded/metrics.json)
- [A szereplő naplója](ui/actor-a/session.json), [E szereplő naplója](ui/planner/session.json)

Az eredeti nem randomizált és a seedelt háztartássorrend összehasonlításakor 0 új hiba és 0 megváltozott invariáns jelent meg. Az összehasonlító csak azonos seed/mód/eseményszám mellett fut. Más UI-szereplő, viewport vagy backend mellett a UX-mérések nem hasonlíthatók vakon százalékként.

A pilot megállapításai alapján **nem írtunk át automatikusan termékfunkciót**. A közben elkészült teljes recept/fókusz, kompakt hozzávalóvezérlők és export a már korábban kért fejlesztések, nem a kutatási eredményre utólag ráhangolt javítások. A natív rendszerszintű megosztás és a valós böngészős letöltés teljes végponti próbája még szükséges.
