# Beépített receptajánló – bekötési terv

Állapot: terv, nincs telepített receptgeneráló Edge Function vagy beállított szolgáltatói API-kulcs. A webapp jelenleg a beépített recepteket rendezi készlet alapján, illetve szerkeszthető kérést ad át külső AI-klienseknek.

## Javasolt első verzió

- Egy „Adj 3 receptötletet” gomb indítja a generálást az aktuális otthon jelölt élelmiszerekből. Készletváltozáskor új ajánlás kérhető; lapváltáskor nem generálunk újra.
- A GitHub Pages frontend a Supabase `recipe-ideas` Edge Functiont hívja, a felhasználó bejelentkezési tokenjével. A függvény ellenőrzi a munkamenetet és közös készletnél a háztartási tagságot.
- A szolgáltató API-kulcsa Supabase secret; soha nem kerül a böngészőbe. A ChatGPT/Gemini előfizetés és a szolgáltatói API elszámolása külön dolog.
- A modell kis, költségtakarékos API-modell legyen, konfigurálható szolgáltatóval és modellazonosítóval. A végleges választást magyar receptminőség, válaszidő és aktuális API-árak alapján kell tesztelni.
- Csak élelmiszerneveket, nyelvet, adagszámot és a felhasználó által megadott étkezési preferenciákat küldünk. Nem feltételezünk készletmennyiséget vagy frissességet.

## Válasz és megjelenítés

Szigorú JSON-séma: legfeljebb 3 recept, cím, adag, elkészítési idő, hozzávalók névvel/mennyiséggel/egységgel, lépések. A backend ellenőrzi a sémát, méretet, hibát és esetleges elutasítást. Az app a katalógus és az aktuális készlet alapján számolja a hiányzó hozzávalókat. A strukturált válasz önmagában nem garantál helyes receptet.

Az eredmény külön „AI-ötletek” csoportba kerülhet, mentéssel és a hiányzó hozzávalók listához adásával. Generálási hiba esetén a meglévő receptválogatás marad elérhető.

## Költség és működés

- Felhasználónkénti kérési korlát, globális napi költségkeret, időkorlát és maximális kimeneti méret.
- Háztartáshoz vagy felhasználóhoz kötött gyorsítótár: normalizált készlet + nyelv + adag + preferenciák + modell/prompt verzió. Az azonos készlet nem jár ismételt modellhívással.
- Párhuzamos azonos kérések összevonása; új készlethez régi, késve érkező válasz nem írhatja felül az aktuális ajánlást.
- A meglévő Python `/api/chat` csak külön szerveren fut; a GitHub Pages nem futtatja. Ez az Edge Function külön telepítendő.

## Bekötéshez szükséges

1. API-szolgáltató és modell kiválasztása, számlázás/költségkeret beállítása.
2. API-kulcs beállítása a Supabase secretsben.
3. Edge Function, jogosultságok, kvóta és cache implementálása és telepítése.
4. Frontend bekötés, majd hitelesített élő válasz ellenőrzése magyarul és angolul, üres/vegyes készlettel és hibakezeléssel.

Strukturált válasz dokumentáció: https://developers.openai.com/api/docs/guides/structured-outputs
