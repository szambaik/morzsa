# Morzsa – proaktív élmény és navigáció

Az átadott „Morzsa Proaktív Élmény és Navigáció” koncepció alapján készült
helyi implementáció. A meglévő, párhuzamosan készült auditjavításokra épül.
A koncepció illusztrációi helyett a jelenlegi Morzsa színeit, kabaláját és
komponenseit használja.

## Felületek

- **Navigáció:** Áttekintés · Lista · Morzsa · Készlet · Receptek. A Morzsa
  középen, visszafogott kiemeléssel marad. A chat továbbra is az induló nézet.
  A tabváltás megőrzi az aktív beszélgetést, a piszkozatot, a receptolvasást,
  a kereső szövegét és a képernyő görgetési helyét.
- **Áttekintés:** a „Morzsa figyel” blokk összesen legfeljebb három kiemelt
  jelzést/receptet mutat. A régi párhuzamos hiány- és ajánlóblokkok helyét
  veszi át. Üres készlethez nincs kitalált jelzés.
- **Chat:** az üres beszélgetésben rövid, adatból származó összefoglaló és
  belépők jelennek meg. Meglévő beszélgetés, főzés, válogatás vagy folyamatban
  lévő kérés közben nem tesz új javaslatot a beszélgetésbe. A korábbi kompakt
  készletellenőrzés és a vásárlás lezárása megmarad, ha az a következő lépés.
- **Receptek:** a „Morzsa ajánlja” két kiemelt receptnél megmutatja a
  megerősített, az ellenőrzendő és a hiányzó hozzávalókat, az ismert időt és
  adagszámot. Az ajánlás alatti feedben ugyanaz a recept nem jelenik meg újra.
  A recept megnyitása a meglévő receptolvasóba és főzési folyamatba vezet.
- **Lista:** legfeljebb öt javaslatból a felhasználó választ, majd külön
  jóváhagyja a csomagot. Nincs előre kiválasztott tétel. A meglévő listatételek,
  a kipipált állapot, mennyiségek és receptkapcsolatok megmaradnak.

## Bizonyíték és visszajelzés

A készletben jelzett „kevés” és „elfogyott” állapot tényként csak a felhasználói
jelölést írja le. A régi megerősítés ellenőrzési kérdés; nem lejárati adat.

A vásárlási ritmus legalább három külön vásárlási napból, legfeljebb 180 napos
előzményből számol medián intervallumot. Az azonos napi archívumok egyetlen
megfigyelésnek számítanak. A hibás, jövőbeli, túl régi, nem vásárlási és erősen
szabálytalan adatok nem alapoznak meg becslést. A jelzés „Becslés · vásárlási
ritmus” felirattal jelenik meg. Ez nem pontos fogyasztási vagy megromlási
előrejelzés. Friss készletmegerősítés két napra elcsendesíti ezt a becslést.

A „Van még / Már megvan” visszajelzés megerősíti a jelenlétet. A már „kevésnek”
jelölt termék kevés marad; a hiányzónak jelölt termék kerül újra otthonra.
Az ismételt korrekciók óvatosabban időzített becslést eredményeznek. A „Most
nem” hét napra, a „Máskor” három napra elrejti ugyanazt a terméket a kapcsolódó
felületeken. A receptnél külön „Hasznos ötlet” és halasztás adható; a későbbi
sorrend a kedvenceket, a korábbi főzéseket és ezt a visszajelzést is figyelembe
veszi. A halasztás lejárata nem garantál új jelzést, ha már nem releváns.

Nincs automatikus LLM-kérés vagy háttérben futó AI-beszélgetés. A javaslatok
megjelenítése és elrejtése nem indít tartalomgenerálást. A már meglévő
receptolvasó kép- és főzésfunkciói a saját jelenlegi működésüket követik.

## Tárolás és közös háztartás

- **proactive-model.js:** tiszta, tesztelhető helyi becslés, rangsorolás,
  visszajelzés és hozzáadás. A korábbi mentésformátumokat nem alakítja át.
- **proactive-ui.js és proactive.css:** az új felületek és navigáció. A helyi
  visszajelzés külön morzsa-proactive-v1 kulcsban, felhasználónként és
  háztartásonként van. A személyes recept-visszajelzések az eszközön maradnak.
- **20261116_proactive_suggestions.sql:** a közös termékjavaslatokat
  szerveroldali, determinisztikus számításból állítja elő. Külön queue és
  feedback tábla, tagságalapú RLS, időzítés, lejárat és műveletszámlálók
  tartoznak hozzá. A számlálók a háztartásban maradnak; nincs külső analitika.
- A közös elfogadás ugyanabban a tranzakcióban ellenőrzi az aktuális adatot,
  írja a jóváhagyott tételeket és menti a visszajelzést. Egy elavult tétel a
  teljes csomagot visszagörgeti. Megismételt kérés nem növeli a mennyiséget.
  A böngésző a közös mentés végéig zárolja a helyi szerkesztést, és a szerver
  által visszaolvasott állapotot jeleníti meg.

## Bekapcsolás a telepített szolgáltatásban

Az új migrációt a meglévő pantry-review és kitchen-intelligence migrációk után
kell alkalmazni a Supabase-projektben:

    supabase/migrations/20261116_proactive_suggestions.sql

A migráció ebben a munkában helyi PGlite adatbázisban lett ellenőrizve;
**éles adatbázisra nem került ki**. A még régi backenddel is működik a frontend:
a meglévő mentési utakat használja, a visszajelzéseket eszközönként tárolja,
és ezt a felület jelzi. A migrációval a közös visszajelzések is megosztódnak.
Nincs adatimport, adattörlés vagy meglévő RPC-szerződés módosítása.

## Ellenőrzés

- Teljes JavaScript tesztcsomag, benne 12 új modelles eset.
- 10 SQL-tesztcsomag; az új csomag ellenőrzi az ismételhető migrációt,
  valós vásárlási ritmust, közös halasztást, ismétlést, elavult állapotot,
  csomagos visszagörgetést és más/eltávolított tag hozzáférésének tiltását.
- Python szervertesztek.
- tests/proactive.browser.js: külön böngésző és helyi PGlite fixture,
  HU/EN, 320/390/1440 px, öt menüpont, legalább 44 px-es navigáció,
  piszkozat/görgetés/recept visszaállítása, receptduplikáció,
  jóváhagyás előtti változatlan adatok, két tag közös műveletei.
- Web build és natív frontendcsomag. A fizikai telefonos és az éles
  Supabase-kapcsolattal végzett ellenőrzés külön kiadási lépés.

A böngészőpróba fixture-je:

    MORZSA_QA_PROACTIVE=1 MORZSA_QA_PORT=8898 node tests/persistence-fixture.mjs

A JavaScript böngészőteszt egy Playwright page objektumot kapó függvény.
A fixture kizárólag helyi tesztadatokat és a valódi SQL-migrációkat használja.
A képernyőképek és a részletes eredmény a design/proactive-2026-11-16 mappában
találhatók.
