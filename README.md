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

320 választható tétel, 16 kategória; keresés ékezet nélkül is. A van otthon és bevásárlólistán jelölés független. Jobbra húzás is listára tesz. Nincs mennyiség, kevés állapot, lejárat vagy főzés utáni kötelező adminisztráció. Saját tétel hozzáadható. A v1 készlet, lista és kedvencek megmaradnak; a v2 állapota külön tárolódik.

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

Katalógus megjelenítés: háromoszlopos kis kártyarács. Mind a 16 kategória nyitva indul, natív details/summary elemmel külön összecsukható. Keresés alatt a találatok kategóriái nyitva látszanak. Egy munkameneten belül a kategóriák összecsukott állapota megmarad jelöléskor. Az ikonok ahol lehetséges alapanyagonként különböznek; rokon termékek közös ikont kaphatnak. Az otthoni és listás jelölés független maradt.

Kategórianavigáció: bal oldali sticky, külön görgethető ikon- és feliratsáv, mellette mobilon kétoszlopos alapanyagrács. Kategóriaválasztáskor a megfelelő csoport jelenik meg; a Minden gomb minden csoportot megmutat. Az összecsukható csoportfejlécek megmaradtak.

## GitHub Pages

A GitHub Pages kiadás a statikus mobilos felületet publikálja. A készlet, kedvencek és bevásárlólista ott is működik, az adott böngészőben tárolva. A Python AI-szerver nem fut GitHub Pages alatt; az AI-chathez a helyi server.py vagy később külön hosztolt backend szükséges. A .env fájl nincs a repóban. A weboldal az október 28-án felmért mintakészlettel indul, amit szabadon módosíthatsz.
