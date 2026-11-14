# Képernyőelemzés: megvalósítás

Forrás: a felhasználó Morzsa_kepernyoelemzes_es_UX_javaslatok.pdf dokumentuma (2026-11-15). A dokumentum szöveges értékelés; a hivatkozott öt képernyőkép nincs a PDF-be ágyazva. A javaslatokat a működő mobil- és asztali apphoz igazítottuk, az arculat és az adatkezelési szerződések megtartásával.

- **Lista:** másodlagos kategóriacímek, egyértelmű nyitás/csukás, 26px-es vizuális pipa 44px-es érintési felületen, 52px-es alap sor, diszkrét mennyiség. Megvásárolt tételek külön összecsukható részben, megvásárolt-only kategóriák nélkül a hátralévő listában. Hátralévő darabszám és meglévő visszavonás.
- **Vásárlás:** egyetlen indítás/folytatás gomb; jól látható 8px-es haladási sáv. Az alsó sáv alapból hozzáadás és befejezés, a beviteli mező a pluszra nyílik. Meglévő kategóriázás, munkamenet-megőrzés és befejezés előtti összesítés megmarad; a be nem pipált saját tételeket sem töröljük.
- **Első használat:** barátságos első kérdés és négy tényleges indulási út (készletfelvétel, listabevitel, receptböngészés, hang). Nyelvválasztás, kihagyás, opcionális interaktív bemutató és későbbi újranyitás megmarad. A bemutató példái nem hoznak létre készletet/listát.
- **Áttekintés:** a puszta készletméret helyett pótlandó/elfogyott/kevés és beszerzendő tételek. Négy konkrét pótlási sor, gyakori vásárlások alapján rendezve, egyérintéses listára vétellel; már listán lévő tétel nem duplázódik. Kompakt receptajánló, üres közös aktivitás és alsó composer/gyorsgombok nélkül.
- **Receptdöntés:** perc, otthoni hozzávalók, név szerint lenyitható hiányzó/ellenőrizendő/kevés lista; tényleges idő- és étrendpreferencia-egyezés indoklással. Ismeretlen készlet nem hiány. A feed és a személyes kártyák közös komponenst használnak. Ízlés mentése után az ajánlott feed újrarendeződik; mentett recepttartalom és kép nem változik.
- **Beszélgetés / művelet / főzés:** külön műveleti jóváhagyási terület a párbeszéd alatt. Semmi sem mentődik jóváhagyás előtt. Kevesebb ismétlődő composer-gyorsgomb és rövidebb ajánlókártya. A meglévő önálló receptolvasó/főzési fókusz, lépésnavigáció és hangvezérlés megmarad.
- **Hang:** a korábbi, már megvalósított kör alakú orb, valós mikrofon-/lejátszási állapotok, némítás, lezárás, timeout és újrapróbálás megfelel a P0 iránynak. Az audio infrastruktúrát nem cseréljük le.
- **Memória / proaktivitás:** meglévő tartós beszélgetések, receptelőzmények és konyhai preferenciák; a pótlási sorrend a valódi vásárlási előzményeket is használja. A hiányzó és bizonytalan készletet nem következtetjük át automatikusan, új fizetős AI-hívás nélkül.

## Ellenőrzés

228 Node-teszt és a teljes SQL-ellenőrzések. Új determinisztikus tesztek a bizonytalan készlet és hiány megkülönböztetésére, aliasduplikációra, preferencia-indoklásra és adatot nem módosító pótlási rangsorra.

MORZSA_QA_PORT=8836 node tests/persistence-fixture.mjs, majd tests/screen-review.browser.js Playwrightban: pipálás és undo, kategóriacsukás, megvásároltak leválasztása, kompakt dock, új vásárlás, folytatás/összesítés, pótlás és duplikációvédelem, receptinformációk, onboarding, nyelv, műveleti jóváhagyás, 320/430/1440px. Izolált adatok és helyettesített AI-válasz; nincs fizetős modellhívás.

npm run build:web és npm run sync:frontend: a webes és natív webcsomag elkészül. Új natív binárisokat a publikáláshoz tartozó GitHub Actions build fordítja.
