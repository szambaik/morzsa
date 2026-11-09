# Morzsa: mobilalkalmazás és megbízhatóbb készlet

Tervezési javaslat, 2026-11-09. A készletellenőrzés első verziója és a Capacitor projektalap megvalósult. Az aktuális készültség és a hátralévő lépések: [mobil bekötési útmutató](../mobile/SETUP.md). A push és az áruházi tesztkiadás még következő lépés.

## Termékdöntés

A Morzsa továbbra is hozzávetőleges háztartási emlékezet, nem raktárnyilvántartás. Az eltelt idő a készletadat bizonytalanságát növeli; önmagában nem bizonyítja, hogy a termék elfogyott vagy lejárt. Az alapműködés ezért emlékeztető és gyors megerősítés legyen. Automatikus levétel legfeljebb későbbi, kifejezetten bekapcsolható termékszabályként, visszavonhatóan kerüljön be.

## Első szállítható készletfunkció

- A háttérben tároljuk az utolsó megerősítés időpontját. A készlet jelölése továbbra is van/nincs.
- A vásárlás lezárásakor a ténylegesen megvett termékek megerősítést kapnak akkor is, ha már korábban otthon voltak. Ugyanez érvényes az explicit „vettem / van otthon” hangparancsra és a „Van még” gombra.
- Fontos: ezt külön eseményként kell kezelni. A jelenlegi idempotens stock_add nem változtatja meg a stock értékét, ha már jelen van a termék; pusztán az adatkülönbségből nem derülne ki az új vásárlás.
- A készletben egy visszafogott „Érdemes ránézni · 4” belépő nyitja az ellenőrzést. Egyszerre legfeljebb 3–5 tétel, nagy, gyors válaszokkal: Van még / Elfogyott / Elfogyott, listára. A Mégse/később nem módosít készletet.
- Induló ellenőrzési időközök: tej körülbelül egy hét; friss zöldség néhány nap; tartós kamratételek jóval ritkábban. Ezek termékadat-ellenőrzési időközök, nem élelmiszer-biztonsági vagy fogyaszthatósági határidők. A felhasználót nem kérjük dátumok vagy súlyok megadására.
- A megerősítés közös: ha egyik háztartástag ellenőrizte a tejet, a másiknál is eltűnik a kérdés.
- Bevásárlás lezárása vagy listakészítés természetes alkalom egy rövid, kihagyható ellenőrzésre. A listához adás önmagában nem jelenti, hogy a termék elfogyott.
- Az AI receptajánló a régen ellenőrzött tételeket bizonytalanként kapja meg; ilyen hozzávalónál feltételesen fogalmaz. Nem állítja biztosan, hogy van még otthon.
- A régi készletadatok ellenőrzési ideje ismeretlen. Nem jelöljük őket frissnek a frissítés napjával, és nem töröljük tömegesen; egyszeri, adagolt áttekintést ajánlunk.

## Értesítések

Először alkalmazáson belüli emlékeztető. A mobilverzióban opcionális heti összefoglaló, nem termékenkénti értesítés. Az értesítés mindig az aktuális közös állapotot megnyitó ellenőrző nézethez vezet. Megbízható, háztartásonként összehangolt push csak backend ütemezéssel és eszköztoken-kezeléssel készülhet; egy készüléken ütemezett helyi értesítés magától nem tudja, hogy a másik tag már ellenőrzött. Engedélyt akkor kérünk, amikor a felhasználó bekapcsolja az emlékeztetőt.

## Visszafelé kompatibilis adatok

A meglévő numerikus stock értékeket és RPC-ket megőrizzük. Helyben opcionális, háztartásonként elkülönített ellenőrzési metaadat, megosztáshoz külön, RLS-védett tábla szükséges: household_id, product_name, last_confirmed_at, review_after, confirmed_by és revision. Szerveridő és verzióellenőrzés akadályozza meg, hogy egy régi kliensmódosítás felülírjon egy új megerősítést.

Nem adunk egyszerűen új bucketet a jelenlegi household_records táblához: a régi HouseholdModel.diff a nem ismert rekordokat törlendőnek tekinthetné. A külön metaadat-tábla opcionálisan tölthető, a régi kliensek továbbra is tudják kezelni a készletet. Ismeretlen/hiányzó metaadatból nem következik készlettörlés. Az új stock-módosítás és ellenőrzési metaadat közös atomikus művelete additív RPC-vel valósítható meg, a régi RPC megtartásával.

## iOS és Android: javasolt út

Capacitor a meglévő webes felület és üzleti logika köré. A webapp is megmarad, közös fejlesztési alapból. A csomag tartalmazza a felületi fájlokat; nem egy GitHub Pages címet nyitunk meg egy üres keretben. A Supabase marad a közös háttérrendszer.

Első mobilmérföldkő:

1. Reprodukálható webes build és elkülönített public könyvtár, hogy dokumentáció, tesztek, helyi konfiguráció és titkos fájlok ne kerüljenek az appcsomagba.
2. Capacitor iOS/Android projektek, alkalmazásazonosítók, ikonok, nyitóképernyő, safe area és billentyűzet-kezelés.
3. Rendszerböngészős Google-belépés és natív visszatérési link; megfelelő munkamenet-tárolás. iOS-en Sign in with Apple bevezetését tervezzük a Google-login mellé az App Review 4.8 követelményeinek teljesítésére.
4. Mikrofon, hangfeldolgozás, háttérbe kerülés és hálózatváltás tesztelése valódi iPhone-on és Androidon. A WebView önmagában nem garantál jobb teljesítményt.
5. A böngészős helyi adatok nem jelennek meg automatikusan a natív app külön tárolójában. Közös háztartás bejelentkezéssel visszatölthető; csak helyi készlet/lista átviteléhez explicit import/export vagy felhasználó által indított másolás kell. Nincs néma összefésülés.
6. TestFlight és Play tesztkiadás, majd a visszajelzések alapján publikus kiadás.

A kiadáshoz fejlesztői fiókok, aláírás, áruházi adatlap, adatkezelési tájékoztató, fióktörlési folyamat és valós eszköztesztek is szükségesek. Az Apple 4.2 alapján a megfelelő hasznosságot és appélményt kell bemutatni; a Capacitor választása nem jelent automatikus elfogadást. A 2023-11-13 után létrehozott személyes Google Play-fiókoknál jelenleg legalább 12 folyamatosan beiratkozott tesztelővel 14 napos zárt teszt kell a publikus hozzáférés kérelmezése előtt. A felhasználó fióktípusa még nincs felmérve.

## Javasolt sorrend és elfogadási feltételek

1. Gyors készlet-ellenőrzés a webappban: nincs dátumbeviteli kötelezettség; öt tétel áttekintése körülbelül fél perc; partner megerősítése közösen látszik; régi készlet sértetlen.
2. Mobil tesztkiadás: listaindítás, ellenőrzés, vásárláslezárás és bejelentkezés mindkét platformon; meglévő közös adatok elérhetők; hálózati hiba nem veszít módosítást.
3. Opcionális heti push: közös ellenőrzés után ne küldjünk felesleges új emlékeztetőt; értesítést kikapcsolva is teljesen használható az app.
4. Használati tapasztalat alapján személyre szabott gyakoriság; később opcionális automatikus levétel. Előbb egyszerű szabályok, csak igazolt előnynél AI a döntéshez.

## Ellenőrzött források, 2026-11-09

- https://capacitorjs.com/docs
- https://developer.apple.com/app-store/review/guidelines/ — 4.2, 4.8 és fióktörlési szabályok.
- https://support.google.com/googleplay/android-developer/answer/14151465?hl=en — új személyes fiókok tesztkövetelményei.
