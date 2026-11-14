# Morzsa a saját iPhone-on

2026. november 14. Saját telefonos fejlesztői próba ingyenes Apple-fiókkal is elvégezhető. A legutóbbi web-, Android- és iOS-szimulátor CI-build sikeres; a saját iPhone aláírását a te Xcode-fiókod adja.

## A most látott hiba

„Signing for App requires a development team”: nincs csapat kiválasztva az **App targethez**. A „Provisioning Profile: Xcode Managed Profile” és „Signing Certificate: Apple Development” felirat önmagában nem jelenti, hogy a Team is be van állítva.

1. **Xcode → Settings → Accounts → + → Apple Account**: add hozzá a saját Apple-fiókodat, ha még nincs felvéve.
2. Bal oldalt kattints a kék **App** projektikonra. Középen a **TARGETS** alatt válaszd az **App** elemet.
3. **Signing & Capabilities → Automatically manage signing** legyen bekapcsolva.
4. A **Team** mezőben válaszd a neved mellett szereplő **Personal Team** csapatot, vagy a meglévő fizetős fejlesztői csapatodat. A Debug konfigurációra is vonatkozzon.
5. A bundle identifier alapból **io.github.szambaik.morzsa**. Az Xcode létrehozza a szükséges fejlesztői tanúsítványt és profilt.

Az Apple-fiók hitelesítését a saját Xcode-ablakodban végezd el. Ehhez nem kell App Store-előfizetést vásárolni.

## Friss appcsomag

A projekt mappájában:

~~~sh
cd '/Users/I769428/Documents/ChatGPT/Főzés/konyha-app'
npm run sync:mobile
npm run open:ios
~~~

A webes új verzió önmagában nem frissíti a telefonra bemásolt felületet. Kódfrissítés után ismét sync és Run szükséges. Az AI backend ugyanaz a Supabase-projekt marad.

## Telepítés és indítás

1. Csatlakoztasd USB-vel az iPhone-t a Machez, oldd fel, és a telefonon válaszd a **Trust / Megbízom** lehetőséget. A Macen is engedélyezd a csatlakozást, ha kéri.
2. Xcode felső eszközválasztójában az App scheme mellett válaszd a **saját iPhone-odat**, a szimulátor helyett. Az első párosítást a **Window → Devices and Simulators** alatt is ellenőrizheted.
3. Ha a telefon kéri: **Beállítások → Adatvédelem és biztonság → Fejlesztői mód / Developer Mode** → bekapcsolás → újraindítás → megerősítés. Ez az opció az Xcode-párosítás után jelenhet meg.
4. Xcode-ban **Run ▶︎ / Cmd+R**. A fordítás után a Morzsa települ és elindul a telefonon.
5. Ha a telefon „Untrusted Developer” hibát mutat: **Beállítások → Általános → VPN és eszközfelügyelet** → a saját fejlesztői profilod → **Megbízás**.
6. Jelentkezz be ugyanazzal a Morzsa-fiókkal, válaszd ki a közös konyhát, majd engedélyezd a mikrofont az első hangpróbánál.

Ingyenes Personal Team esetén a fejlesztői aláírás általában **7 napig** érvényes. Utána Xcode-ból újra Run. Ez saját eszközös tesztelés; mások kényelmes teszteléséhez később TestFlight és Apple Developer Program szükséges. A GitHub Actions iOS Simulator ZIP-je valódi iPhone-ra nem telepíthető.

A böngészőben mentett helyi chat/készlet külön tárolóban van. A közös konyha bejelentkezés után visszatöltődik, a csak böngészőben lévő adatok nem másolódnak át automatikusan.

## Első telefonos ellenőrzés

Google-belépés és visszatérés az appba → megfelelő konyha → lista/készlet → hangmód → „Mi van otthon?” → egy teszttétel felvétele, külön „mentheted” megerősítéssel → Befejezés → átirat a chatben. Hangpróba közben maradjon előtérben az app; háttérbe küldéskor a mikrofon biztonságosan leáll. Egy hangkör jelenleg legfeljebb 110 másodperc.

Források: [Apple ingyenes fejlesztői hozzáférés és Personal Team](https://developer.apple.com/support/compare-memberships/), [Apple Developer Mode](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device).
