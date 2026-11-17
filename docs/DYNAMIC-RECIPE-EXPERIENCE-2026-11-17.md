# Dinamikus receptélmény

A 2026. november 17-én átadott „Morzsa – Dinamikus receptélmény” terv
megvalósítása a meglévő receptkönyvre és főzési munkamenetekre épül.

## Felfedezés → előkészítés → főzés

- A Neked / Böngészés / Mentettek nézetek és a készletre, ízlésre, korábbi
  kedvencekre épülő ajánlás megmarad. A kártyán az idő mellett az ismert
  adagszám is szerepel, a hiányzó hozzávalók röviden látszanak. Az ismeretlen
  készlet továbbra sem hiány.
- A részletekből az „Előkészítem a főzést” visz a hozzávalókhoz. A mentett
  nehézség látszik; régi receptekhez nem találunk ki értékelést. Az opcionális
  eszközellenőrzés és a receptspecifikus előkészítési tippek itt jelennek meg.
- A hiányzó **és kevés** tételek bekerülnek a jóváhagyható bevásárlási
  előnézetbe. A recept szükséglete és a vásárlási mennyiség külön szerepel;
  az ismeretlen tételeket előbb ellenőrizni kell. A közös listán a meglévő
  mennyiséget és a partner módosítását megőrzi a régi, szándékalapú sor.
  „Elmentve” csak szerveres visszaigazolás után jelenik meg.
- Az adagválasztó a tört értékeket is kezeli, például ½ / 3 = 1/6.
  Az egyértelműen azonosítható mennyiségszövegek a leírásban is változnak.
  A hőfok és a főzési idő nem szorzódik. A szabad szövegű vagy tartományos
  mennyiségek megmaradnak; nem találunk ki hozzájuk átváltást. Az alaprecept
  és a képek azonosítója változatlan. Adagszám nélküli régi recept olvasható,
  de a vezetett főzéshez meg kell adni az eredeti adagszámot.
- Főzés közben a saját műveletsáv: hozzávalók, kérdezés, szünet és következő
  lépés. A szünet megőrzi a haladást és letiltja a lépés készre jelölését.
  A futó időzítők ettől még járnak, ezt a felület kiírja.
- Minden időzítő külön szüneteltethető, folytatható, alaphelyzetbe állítható
  és lezárható. Az alaphelyzet a teljes időt állítja vissza, szüneteltetve.
  A számítás abszolút időbélyegből történik: háttérből visszatérve is helyes.
  A másodpercek nem kerülnek élő képernyőolvasó-bejelentésbe. Az alkalmazás
  nem ígér operációs rendszer által garantált lezárt-képernyős riasztást.
- Kérdezés közben az aktuális lépés látható marad. Mobilon közös görgethető
  felület, asztalon lépés és segítség egymás mellett. A gyors kérdések
  szerkeszthető üzenetet készítenek elő, küldés nélkül. Visszatéréskor a
  kérdezés gombja visszakapja a fókuszt.
- A lezárásnál a meglévő értékelés, kedvenc és jegyzet mellett opcionálisan
  a maradék adagok száma is menthető. Ez nem írja át a készletet.

## Ellenőrzött AI-tartalom

A cooking-experience.js közös, verziózott szerződést ad a kliensnek és a
backendnek. A strukturált cookingUI csak egy felhasználói kérdés meglévő
válaszának opcionális része; lépésváltáskor nincs kötelező új AI-hívás.

A saját receptfejlécet, hozzávalókat, lépést, időzítőket, segédpanelt és
lezárást mindig az alkalmazás rajzolja. Az AI ezek mellé legfeljebb négy
komponenst választhat:

| Típus | Korlát |
| --- | --- |
| tip_card | Rövid, egyszerű szöveges tipp |
| substitution_card | Létező hozzávaló neve és indokolt javaslat; nincs automatikus alkalmazás |
| troubleshooting_card | Szöveges hibakeresési segítség |
| timer_card | 1–120 perces javaslat, csak külön kattintásra indul |
| ingredient_checklist | Indexek a kanonikus hozzávalókhoz; a mennyiséget az alkalmazás számítja |
| step_visual | A már megjelenített kanonikus lépéskép; nincs AI által megadott URL |

Ismeretlen típus, túl hosszú adat, idegen hozzávaló vagy hibás érték esetén
a kompozíció eldobható a normál válasz elvesztése nélkül. Szöveget escapelve
jelenítünk meg; nincs AI-tól származó HTML, CSS, JavaScript vagy műveletkód.
A kártyák a lépéshez és az adott adagválasztáshoz kötődnek, másik lépésnél
vagy más adaghoz nem kerülnek elő. A háztartási javaslatok továbbra is a
meglévő jóváhagyási, jogosultsági és szerveres visszajelzési útvonalon mennek.

## Kompatibilitás és kiadás

- A morzsa-v1 és későbbi helyi mentések betöltését, a háztartási rekordokat,
  a meglévő RPC-aláírásokat és az olvasási jogosultságokat nem változtatjuk.
- Új opcionális receptmezők: difficulty, preparationTips. Az időzítő,
  szünet, eszközlista, segédkártyák és maradék a meglévő conversation metadata
  mezőben maradnak. A régi munkameneteket nem küldjük vissza kötelező
  előkészítésre.
- A főzés saját munkamenet, ugyanazon fiók eszközei között szinkronizálható.
  Más háztartástag megosztott beszélgetésének olvasási korlátja változatlan.
- A szünet a közös activity/activityAt munkamenet-állapotot használja.
  A „Később folytatom” ment és kilép; a főzési sáv „Szünet” gombja helyben
  tartja a lépést. Egy szünetelő főzés kifejezett újranyitása folytatja azt.
- Az új migration csak servings és difficulty adatot ad a nyilvános
  recipe_feed eredményéhez; nem módosít régi recepteket vagy készletadatot.
- Kiadáskor alkalmazandó migration: 20261117_dynamic_recipe_experience.sql.
  Frissítendő funkciók: recipe-ideas, voice-command, plus-assistant; a közös
  cooking-experience.js forrás a funkciócsomag függősége. A frontend régi
  backend mellett is használható, strukturált segédkártyák nélkül.
- A meglévő recept- és lépésképek automatikus generálása és tartós backend
  cache-e változatlan. A tesztben helyi helyettesítő képet használunk.
- A Pages továbbra is kizárólag a sikeres Audit regression gate által
  ellenőrzött artifactot telepítheti. Ez az ág önmagában nem éles telepítés.

## Ellenőrzés

Az új unit tesztek fedik a tört adagokat, időzítők háttérből visszatérését,
ismételt műveleteit, egyidejű metaadat-összefésülést, törlésvédelmet,
komponensvalidálást, escapelést és a két szöveges AI-provider szerződését.
A SQL tesztek megismétlik a migrationt és ellenőrzik a változatlan
jogosultságokat, a régi recepteket és az opcionális új mezők mentését.

Futtatható böngészős regresszió: node design-audit/dynamic-recipes.mjs.
WebKit-változat: MORZSA_DYNAMIC_BROWSER=webkit node design-audit/dynamic-recipes.mjs.
A teszt helyi, valódi SQL migrationökkel létrehozott adatbázist használ,
minden külső hálózati kérést blokkol. 320, 375, 390, 430, 768 és 1280 px;
eszközellenőrzés, adagok, hiányok jóváhagyása, időzítők, szünet, újratöltés,
kontextusos kérdés, hibás komponens, fókusz és másik eszközről folytatás.
A Chrome-változat a kötelező kiadási kapu része. WebKit tesztelés történt,
fizikai iPhone-on végzett ellenőrzést vagy éles AI-minőségmérést nem állítunk.
