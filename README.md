# Morzsa — mobilos webapp

## Indítás

A mappában futtasd: python3 server.py
Megnyitás: http://localhost:8765
Telefonról ugyanazon a hálózaton: http://<a Mac helyi IP-címe>:8765
A korábbi python http.server helyett a server.py szükséges az AI-hoz; ez a titkos konfigurációt sem szolgálja ki.

## AI bekapcsolása

1. Készíts saját OpenAI API-kulcsot: https://platform.openai.com/api-keys
2. Nyisd meg a helyi .env fájlt, és az OPENAI_API_KEY= után írd be. Ne küldd chatbe és ne tedd Gitbe.
3. A szerver minden kérésnél újraolvassa a beállítást, ezért nem kell újraindítani. A receptet újra megnyitva frissül az AI állapotjelzése.
4. A modell az OPENAI_MODEL mezőben állítható. Alapértelmezés: gpt-6-astra. Az elérhetőség a saját API-fióktól függ.
5. Nyiss meg egy receptet, és az alatta lévő beszélgetésben kérdezz.

Az API használata a saját OpenAI API-fiók keretét fogyasztja. A ChatGPT-előfizetés önmagában nem állít be API-kulcsot ebben az appban. Az élő szolgáltatást kulcs hiányában még nem ellenőriztük; nincs szimulált AI-válasz.

Az implementáció az OpenAI hivatalos Responses API útmutatóját követi: https://developers.openai.com/api/docs/guides/text

## Készlet

667 választható tétel, 27 kategória; keresés ékezet nélkül is. A van otthon és bevásárlólistán jelölés független. Jobbra húzás is listára tesz. Nincs mennyiség, kevés állapot, lejárat vagy főzés utáni kötelező adminisztráció. Saját tétel hozzáadható. A v1 készlet, lista és kedvencek megmaradnak; a v2 állapota külön tárolódik.

## Beszélgetés

Minden recepthez külön, helyben tárolt előzmény tartozik. Bezárás és újratöltés után is megmarad. A kérdés, a recept és a készlet élelmiszerei kerülnek az OpenAI-hoz, az utolsó 24 üzenettel. A háztartási katalógust nem küldjük. Az API-ban store=false. Az AI tanácsot ad; nem írja át automatikusan a receptet vagy bevásárlólistát. Sikertelen kérés újrapróbálható, a kérdés nem vész el. A képanyag ebben a kiadásban továbbra is jelölt emoji-illusztráció.

Az összes helyi adat böngészőnként külön van localStorage-ban; nincs felhőszinkron vagy bejelentkezés. A telefon és a Mac nem ugyanazt a helyi készletet módosítja.

## Szerver

Csak Python standard library szükséges. Kulcs szerveroldalon; .env Gitből kizárva, fájljog 600, HTTP-n nem hozzáférhető. Fix OpenAI végpont, korlátozott kérésméret, szerepkör-ellenőrzés, időkorlát, 20 kérés/perc és legfeljebb 2 párhuzamos AI-kérés. Eredet-ellenőrzés védi a böngészős kéréseket más weboldalakról.

Ez helyi, megbízható otthoni hálózatra való prototípus. Nyilvános telepítés előtt felhasználói hitelesítés, HTTPS, tartós adatbázis, felhasználónkénti költségkorlát és üzemeltetési felügyelet szükséges. Ne publikáld a helyi szervert porttovábbítással.

## Ellenőrzés

python3 -m unittest discover -s tests -v
node --check app.js

A szervertesztek ellenőrzik a privát fájlok védelmét, hiányzó kulcs hibáját, rendszer-szerepkör tiltását, az API válaszainak összefűzését és az eredet-ellenőrzést. A sikeres API-válasz tesztje helyettesített szolgáltatással fut; nem élő modellhívás.

Böngészőben ellenőrizve: ugyanaz a paprika mindkét jelöléssel egyszerre, keresési szűrés, 390 és 320 px szélességen túlcsordulás nélkül, receptenkénti kérdés megőrzése újratöltés után, hiányzó kulcs valós hibajelzése és újrapróbálási lehetősége. Mind a 7 szerverteszt átment.

Katalógus megjelenítés: háromoszlopos kis kártyarács. Mind a 27 kategória nyitva indul, natív details/summary elemmel külön összecsukható. Keresés alatt a találatok kategóriái nyitva látszanak. Egy munkameneten belül a kategóriák összecsukott állapota megmarad jelöléskor. Az ikonok ahol lehetséges alapanyagonként különböznek; rokon termékek közös ikont kaphatnak. Az otthoni és listás jelölés független maradt.

Kategórianavigáció: bal oldali sticky, külön görgethető ikon- és feliratsáv, mellette mobilon kétoszlopos alapanyagrács. Kategóriaválasztáskor a megfelelő csoport jelenik meg; a Minden gomb minden csoportot megmutat. Az összecsukható csoportfejlécek megmaradtak.

## GitHub Pages

A GitHub Pages kiadás a statikus mobilos felületet publikálja. A készlet, kedvencek és bevásárlólista ott is működik, az adott böngészőben tárolva. A Python AI-szerver nem fut GitHub Pages alatt; az AI-chathez a helyi server.py vagy később külön hosztolt backend szükséges. A .env fájl nincs a repóban. Az új böngésző üres készlettel indul. A korábban mentett készlet megmarad.

## Gyors bevásárlási mennyiségek

A készletfejléc és a kártyák kompaktabbak. A kártya pluszgombja egy termékre jellemző vásárlási egységet ad hozzá: például krumpli 1 kg, fokhagyma 1 db, tej 1 l. Ismételt koppintás növeli az összmennyiséget. A régi, mennyiség nélküli listatételeket 1 egységként kezeli.

A plusz 450 ms-os nyomva tartása (vagy jobb kattintás, billentyűzettel Alt+le) megnyitja a mennyiségválasztót. Gyorsértékek: 1, 2, 3, 5; külön szám és egység is választható. A választó a listán szereplő teljes mennyiséget állítja be: meglévő tételnél felülírja, új tételnél létrehozza azt. Megnyitáskor a jelenlegi mennyiség és egység látszik. A bevásárlólistán a mennyiségre koppintás a meglévő értéket szerkeszti. Az otthoni jelölés ettől független marad.

A bevásárlólista kategóriánként csoportosított, a csoportok nyitva indulnak. A katalógusban nem szereplő tétel az Egyéb csoportba kerül, a hozzáadott saját alapanyag a Saját tételek közé.

Ellenőrzés: böngészőben két koppintás → 2 kg krumpli; hosszú nyomás és 3 választása → 3 db fokhagyma; tej külön tejtermék-csoportba kerül. Mennyiség utólagos szerkesztése és újratöltés utáni megőrzése működik. Elmozdított érintés megszakítja a hosszú nyomás időzítőjét. 320 és 390 px szélességen nincs vízszintes túlcsordulás. Fizikai telefonon a hosszú nyomás még külön ellenőrizendő.

## Otthon / lista és alapértelmezett sorrend

Az alacsonyabb kártyák tetején balra házikó, középen alapanyagikon, jobbra plusz található. A házikó kapcsolja az otthoni jelölést. Az ikon vagy név balra húzása otthonra jelöl, jobbra húzása egy egységet ad a bevásárlólistához. A plusz hosszú nyomása továbbra is mennyiségválasztó. Az Otthon és Listán státusz egyszerre is megjelenik, a lista mennyiségével együtt.

A Van otthon nézet a bal oldali sávban a Minden felett van; a három felső szűrő megszűnt. A katalógus kategóriafejlécei csak Minden nézetben látszanak, keresés és kategórián belüli böngészés közben nem. A Van otthon szintén egyetlen rács. A bevásárlólista továbbra is kategorizált.

A categoryPriorityOrder és householdEssentials szerkesztett háztartási alapsorrend, nem felhasználói vagy piaci vásárlási statisztika. A gyakori alapok megelőzik a ritkábbakat. A kereső melletti ★/ABC kapcsoló fontosság és magyar ABC-rend között vált; a választás megmarad. Minden nézetben a csoportok háztartási prioritás szerint következnek, azon belül a kiválasztott rendezés érvényes. Kereséskor egyetlen, rendezett találati rács jelenik meg minden kategóriából; Van otthon nézetben a keresés az otthon jelöltekre szűkül.

Ellenőrizve: natív böngészős dragTo-val paradicsom → házikó, majd → plusz; mindkét státusz egyszerre helyes. Kategórián belüli és keresési fejlécek eltűnnek, ABC-rend és visszaváltás működik, a Van otthon csak jelölt alapanyagokat tartalmaz. Hosszú nyomás megnyitja a mennyiségválasztót. 320 és 390 px szélességen nincs vízszintes kilógás.

## Termékirány és szupermarket-katalógus

A [termékterv](PRODUCT-PLAN.md) rögzíti az alapverziót és a tervezett fizetős funkciókat. Ezekhez még nincs előfizetés vagy fizetési integráció. A 27 kategória élelmiszer, higiénia, baba, kisállat és háztartási kínálatot is tartalmaz. Az új nem élelmiszeres kategóriákat nem küldjük főzési alapanyagként az AI-nak. Az alsó menü sorrendje Készlet – kiemelt Lista – Ötletek.

## Vásárlás lezárása és törlés

A Vásárlás befejezése minden listatételt archivál és otthonra jelöl, a pipáktól függetlenül, majd kiüríti a listát. A Lista törlése külön megerősítést kér; nem archivál és nem változtatja a készletet. Sikertelen mentés esetén a lista megmarad. A korábban ürítéskor mentett archív bejegyzések továbbra is elérhetők.

## Lista kezelése és következő lépések

A kártyán + listára tesz, az aktív ✓ újabb koppintásra levesz. Hosszú nyomás a teljes mennyiséget szerkeszti. A bevásárlólistán külön −/+ gombok léptetik a mennyiséget; 1-nél a mínusz letiltott, törölni az × gombbal lehet. Az ismeretlenül begépelt termékek a Saját tételek kategóriába kerülnek. Korábbi vásárlás az archívumból újrafelhasználható, a mennyiségek a meglévőkhöz adódnak.

A teljes hiányzóikon-lista az ICON-AUDIT.md fájlban; a többeszközös, bejelentkezéses háztartás terve a HOUSEHOLD-PLAN.md fájlban van. A szinkron még nem működik, ehhez háttérszolgáltatást kell bekötni.

## Magyar / English és képek

A fejléc HU/EN gombjai váltanak nyelvet. A választás megmarad. A teljes 667 termékes katalógus, kategóriák, alapfelület és a hét beépített recept angol fordítást kapott. Magyarul és angolul is kereshetsz; az adatokban a korábbi magyar termékkulcsok maradnak. A saját beírt szövegek és AI-előzmények nem kapnak gépi fordítást. A generált készlet 85 képet tartalmaz; minden katalógustermék kap konkrét vagy ideiglenes családikont.

## Közös háztartás – első implementáció

A fejléc házikója nyitja a bejelentkezést/háztartáskezelést. Üres konfiguráció mellett őszinte „még nincs bekötve” állapot látszik. A bekötési útmutató: [supabase/SETUP.md](supabase/SETUP.md). A frontend, egyszer használható meghívók, termékenkénti verziózott közös mentés és 8 másodperces frissítés elkészült; éles Supabase-projekt nélkül a publikus app továbbra is helyi tárolást használ. A régebbi HOUSEHOLD-PLAN.md a célt írja le, a SETUP.md az aktuális megvalósítást és korlátait.

## Emailes link és vizuális finomítás

A belépés a Supabase alapértelmezett Sign in linkjét használja; nincs kódbeírás. A visszatérő tokeneket a címsorból eltávolítjuk, majd szerveroldalon ellenőriztetjük. Éles emailküldés továbbra is csak konfigurált Supabase-projekttel ellenőrizhető. A felület kevesebb keretet, generált kategóriaikonokat és visszafogott terrakotta hangsúlyokat kapott. Listára vételkor a kosár röviden mozdul; csökkentett mozgás beállítás mellett az animáció kikapcsol.

## Bekötött Supabase és külön helyi készlet

A felhasználó által megadott Supabase-projekt publikus konfigurációja beállítva. A projekt auth settings végpontja elérhető, az emailes belépés engedélyezett. A households tábla névtelen olvasása jogosultsági hibával tiltott, ahogy elvárjuk. Valódi emailes belépés és két felhasználós éles próba még szükséges.

Háztartásba lépéskor csak a közös készlet és lista töltődik be. A helyi adatok külön megmaradnak; nincs import vagy automatikus összefésülés.

## Gyors bevitel és készletürítés

A lista tetején a gépelés ajánlásokat mutat. Vessző, pontosvessző vagy Enter rögzíti a terméket; a teljes beillesztett felsorolás egy mentési csomag. Magyar és angol név, ékezet nélküli írás, néhány szinonima és kisebb elírás felismerhető. Bizonytalan egyezésnél saját tétel keletkezik. Ez helyi keresés, nem AI-hívás. A készlet címénél a ··· menüből megerősítéssel törölhető minden otthonjelölés, a lista és a termékkatalógus megtartásával.

## Emailes meghívások és Google-fiók

Elkészült az email-címhez kötött, appon belül elfogadható háztartásmeghívás, értesítési jelvénnyel, 7 napos lejárattal és tulajdonosi visszavonással. A Google-belépés a Supabase Google providerét használja, az emailes belépési link továbbra is elérhető. Az éles bekötéshez SQL-migráció és Google OAuth konfiguráció kell: [útmutató](supabase/EMAIL-GOOGLE-SETUP.md). A meghívó nem küld emailt vagy mobil push üzenetet.

## Receptötletek a saját ChatGPT-ben

Az Ötletek oldal és a Készlet ··· menü „Receptötletek ChatGPT-ben” gombja szerkeszthető kérést állít össze az aktuális helyi/közös készlet élelmiszereiből. Az elsődleges megnyitási link a szerkesztett kérést URL-kódolva a ChatGPT q paraméterében adja át. Ha ez nem működik (például a kliens nem kezeli vagy túl hosszú az URL), a „Másolás és ChatGPT megnyitása” tartalék gombbal beilleszthető a teljes kérés. Nincs API-kulcs vagy háttérben küldött AI-kérés. A telefon dönti el, hogy a https://chatgpt.com/ link böngészőben vagy alkalmazásban nyílik meg; automatikus promptkitöltést vagy elküldést nem garantálunk. Másolási vagy popup-tiltásnál kézi másolás és külön megnyitási link érhető el. Személyes beszélgetéseket, emailt, meghívásokat nem tartalmaz a készletkérés.

## Közvetlen belépés

A fejléc Belépés / Fiókom gombja email+jelszavas belépést és regisztrációt nyit. A regisztráció email-megerősítést kér a Supabase beállítása szerint. A korábbi linkes fiókhoz az „Elfelejtett / még nincs jelszavam” menüből kérhető jelszóbeállító levél. A recovery linket az app szerveroldali felhasználó-ellenőrzés után fogadja el, majd két egyező jelszót kér, és a Supabase felé menti. Jelszó nem kerül localStorage-ba. A Google-belépés továbbra is külön Supabase provider konfigurációt igényel. A sima email+jelszóhoz nincs új SQL-migráció.

## Készlet gyors felvétele

Alapnézet a Van otthon. A lebegő Keresés / felvétel gomb felső panelt nyit, automatikus inputfókusszal. Az ajánlások, az Enter és a vesszővel/pontosvesszővel/újsorral elválasztott tételek csak ideiglenes gyűjtést készítenek. A + Készlet és a kosár Lista gomb az egész gyűjtést a választott célra adja. A már listára átadott tételeket a gyűjtés megjegyzi; további gépelés nem növeli újra a mennyiségüket. A már meglévő aktív listatételek mennyisége is megmarad. A gyűjtés bezáráskor megmarad, újratöltéskor vagy háztartásváltáskor megszűnik. Az ismételt felvétel nem vesz le tételt, nem módosítja a bevásárlólistát; ismeretlen névből saját termék lesz. A meglévő helyi adatokat nem töröljük a mintakészlet megszüntetésekor.
