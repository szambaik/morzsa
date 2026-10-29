# Közös háztartás – bekötési terv

Állapot: tervezett funkció, még nincs többeszközös szinkron. A felhasználó bejelentkezést és meghívásos tagságot választott. Javasolt háttér: Supabase Auth + PostgreSQL + Realtime. A szolgáltatás projektjét még nem kötöttük be.

## Felhasználói folyamat

1. Bejelentkezés e-mailes egyszer használatos kóddal vagy linkkel.
2. Új háztartás létrehozása vagy meghívás elfogadása.
3. A helyi készlet és lista egyszeri, előnézett importja a kiválasztott háztartásba. Üres helyi adat nem írhatja felül a közös adatot.
4. Meghívás megosztható, lejáró, egyszer felhasználható tokennel; elfogadás bejelentkezés után. A tulajdonos visszavonhat meghívást és tagságot.
5. Közösen frissülő készlet, bevásárlólista, saját termékek és archívum. Kedvencek és AI-chat alapból személyesek.

## Adatok és hozzáférés

Táblák: households, household_members, household_invites, custom_products, pantry_items, shopping_items, shopping_trips, shopping_trip_items. Minden közös rekord household_id-t kap, a tagságot soronkénti adatbázis-jogosultság védi. A böngészőben csak publikus projektazonosító és publikus kulcs szerepelhet; adminisztrációs titok nem.

Nem a teljes helyi JSON-t írjuk felül minden kattintáskor. Műveletenkénti írás, stabil termékazonosítók, rekordverziók és egyedi műveletazonosítók szükségesek. A +/- növelés atomi adatbázis-művelet; a teljes mennyiség átállítása verzióellenőrzéssel történik. A vásárlás lezárása egy tranzakció: archívum, készlet és aktív lista együtt változik. Ismételt kérés nem zárhatja le kétszer ugyanazt a vásárlást.

## Kapcsolatkimaradás

Jól látható offline / mentés folyamatban / szinkronizálva állapot. A függő változás nem tűnhet el, és nem jelenthető sikeresen szinkronizáltnak szerver-visszaigazolás nélkül. Újracsatlakozáskor műveletek egyeztetése, kilépéskor a háztartási gyorsítótár biztonságos leválasztása.

## Ellenőrzés bekötéskor

Két külön bejelentkezéssel és böngészővel tesztelendő: egyidejű mennyiségnövelés, egyik eszközön törlés/másikon módosítás, egyszeri vásárláslezárás, ismételt meghívás, visszavont tagság, más háztartás adatainak tiltása, offline újracsatlakozás, helyi adatok importja.
