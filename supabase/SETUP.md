# Közös háztartás bekötése

Az implementáció első verziója elkészült; a publikus app felhőbeállítása üres. Nincs még éles Supabase-telepítés vagy valódi emailes belépési teszt.

## 1. Supabase-projekt

Hozz létre saját Supabase-projektet, lehetőleg EU-régióban. A szolgáltatás aktuális csomagját és korlátait a létrehozáskor ellenőrizd. A projekt adatbázis-jelszava és secret/service_role kulcsa nem kerülhet a frontendbe vagy Gitbe.

## 2. Adatbázis

Egy új projekt SQL Editorában futtasd a supabase/schema.sql fájlt. Ez egyszeri kezdeti migráció, nem ismételhető reset script. Táblák: households, household_members, household_invites, household_records. Az adatbázis tárolja a termékenkénti készlet/lista/saját adatokat és a vásárlási előzményeket. A bejelentkezett felhasználó is csak a saját háztartásait olvashatja; írás csak ellenőrzött RPC-n keresztül lehetséges.

## 3. Belépési email

Authentication alatt engedélyezd az emailes belépést. A Magic link or OTP email sablon maradhat alapállapotban: a felhasználó a levél Sign in linkjére kattint. Nem szükséges kódot beírni vagy a sablont szerkeszteni.

Site URL és Redirect URLs: https://szambaik.github.io/morzsa/. Az app a saját pontos alapcímét küldi redirect_to értékként. Helyi teszteléshez a használt localhost címet is engedélyezni kell a Redirect URLs alatt.

A visszatéréskor az app azonnal eltávolítja a belépési adatokat a címsorból, ellenőrzi az access tokent a Supabase user végpontján, és csak sikeres ellenőrzés után menti a munkamenetet. Hibás vagy lejárt linknél új link kérhető. A háztartáskezelő automatikusan megnyílik.

Az alap emailküldés címzett- és küldési korlátait ez nem oldja fel. Ha a szolgáltató nem engedi a kívánt címre küldést, külön SMTP-konfiguráció szükséges a Supabase aktuális feltételei szerint.

## 4. Publikus konfiguráció

A household-config.js fájlban add meg a projekt HTTPS URL-jét és a frontendhez kiadott publishable kulcsot. Ez a két érték a böngészőből látható; ezért szükséges a migrációban szereplő jogosultságvédelem. Sem admin-, sem adatbázis-titkot nem kér a konfiguráció.

## 5. Két eszközös próba

- A készülék: belépés, háztartás létrehozása, kiválasztása. Az új közös háztartás üresen indul.
- A felső házikó alatt külön előnézett művelet a helyi készlet/lista importja. Meglévő közös listatételeket nem dupláz; a közös készletállapot elsőbbséget kap.
- Tulajdonosként készíts meghívókódot; külön csatornán add át a másik felhasználónak. A kód 2 napig érvényes és egyszer használható. Függő kódok visszavonhatók.
- B készülék: külön emaillel belépés, kód elfogadása.
- Adj hozzá terméket, állíts mennyiséget, zárj le vásárlást. Az első kiadás 8 másodpercenként olvas friss adatokat; fókuszált mező vagy nyitott párbeszéd közben vár. Ez polling, nem Realtime WebSocket.
- Próbálj ugyanarra a tételre ütköző módosítást. A második elavult írás hibát kap, a felület frissül és újrapróbálást kér. Nem írjuk felül automatikusan a másik fél változtatását.
- Visszatérés a helyi készlethez megőrzi az eredeti helyi adatokat. Újratöltéskor egyelőre ismét ki kell választani a háztartást.

## Mentés és adatvédelem

A mentés termékenkénti diffet küld, egy tranzakcióban. A törölt rekordok verziószáma megmarad, ezért egy régi kliens nem hozhatja vissza észrevétlenül a törölt terméket. Mentés közben az adatbevitelt röviden blokkoljuk. Hibánál a legutóbb visszaigazolt közös állapot áll vissza; a sikertelen próbálkozás helyi másolata morzsa-pending-<háztartásazonosító> alatt megmarad. Nincs automatikus offline újrajátszás ebben a verzióban; a műveletet újra kell próbálni. A státuszsor jelzi a folyamatban lévő vagy hibás szinkront.

A kedvencek, AI-beszélgetések és nyelvválasztás személyesek, nem kerülnek a közös rekordokba. A munkamenet ezen a böngészőn tárolódik; kijelentkezés törli a belépési tokent. A tulajdonos tagságot a remove_household_member RPC-vel vonhat vissza; a tagkezelő felület következő lépés.

## Ellenőrzések és korlátok

npm install, majd npm test: termékképek/fordítások, közösadat-diff, privát mezők kizárása, SQL RLS-izoláció, meghívó egyszeri használata, tiltott közvetlen írás, verzióütközés, tranzakciós rollback, visszavont tagság. A SQL-tesztek helyi PGlite PostgreSQL-t használnak, teszt-auth környezettel. A böngészős közösmentés helyettesített hálózattal lett ellenőrizve. Éles email, két fizikai készülék, szolgáltatói konfiguráció és terhelés még külön ellenőrzendő.
