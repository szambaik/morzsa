# Morzsa mobilapp: bekötés és publikálás

Állapot és díjak ellenőrizve: **2026. november 9.**

## Ami elkészült

- Capacitor iOS- és Android-projekt, saját Morzsa ikonnal, közös webes forrásból. A felület az appcsomagba kerül. A közös háztartás és AI internetet igényel; a hálózati betűtípus helyett offline rendszerbetűtípus jelenik meg.
- Szűkített mobil build: csak a futó felület és az assets illusztrációi kerülnek a dist mappába. Tesztek, SQL, dokumentumok, .env és backendkód nem.
- Natív Google-belépési alap: rendszerböngésző, PKCE, egyszer használható kód és visszatérési URL. Mikrofonengedély a két platformon.
- Készletellenőrzés: legfeljebb öt tétel, Van még / Elfogyott / Elfogyott, listára / Most kihagyom. A megerősítés közös. A régi készletet nem töröljük, és nem dátumozzuk át frissnek.
- A vásárláslezárás és a jóváhagyott „van/vettem” hangművelet a már jelen lévő terméket is újra megerősíti. Az AI a régen ellenőrzött tételeket bizonytalanként kapja.

**Ez fejlesztési alap, még nem aláírt, telefonon bevizsgált vagy áruházba beküldhető kiadás.** A helyi iOS Simulator build sikeresen lefordult. Az Xcode licence már elfogadva, de helyi szimulátorruntime még nincs telepítve. Android SDK nincs a vizsgált gépen. A natív belépés teljes körét, mikrofont és életciklust valódi telefonon még ellenőrizni kell; az alkalmazáskód és a natív adapterek automatizált próbái lefutottak.

## Ingyenes lehet?

| Terjesztés | Fejlesztői/áruházi díj |
|---|---|
| Webapp, böngészőből és kezdőképernyőre mentve | Nincs Apple-/Google-áruházi díj |
| Android APK közvetlen megosztása | Nincs Play-áruházi díj; kézi telepítés és külön engedélyezés |
| Google Play | **25 USD egyszeri** regisztráció |
| Apple App Store és TestFlight | **99 USD évente** |

Mindkét áruház alapdíja az első évben körülbelül **124 USD**, utána az Apple éves megújítása 99 USD; helyi pénznem, adó és árfolyam eltérhet. Az app ettől még ingyenesen letölthető lehet.

Az Apple meghatározott nonprofit, akkreditált oktatási és kormányzati szervezeteknek adhat díjmentességet. Ez magánszemélyként általában nem elérhető. Az ingyenes Xcode-eszközteszt nem jelent ingyenes App Store-kiadást. A backend, AI és domain díja külön kérdés: ingyenes kvótákon el lehet indulni, korlátlan ingyenességet nem ígérünk.

**Most még nem szükséges fizetni.** Előbb fejlesztői build és valódi telefonos próba következzen.

## Tőled mire van szükség most?

1. **Kiadó és fiókok:** magánszemély vagy cég? Van-e már Apple Developer / Play Console fiókod? Egyéni Apple-kiadásnál a jogi neved jelenik meg kiadóként; cégnél szervezeti ellenőrzés, jellemzően D‑U‑N‑S is szükséges. Az ideiglenes appazonosító `io.github.szambaik.morzsa`; az első áruházi regisztráció előtt véglegesítsük.
2. **Xcode első indítás:** nyisd meg a telepített Xcode-ot, olvasd el és fogadd el a licenceket, telepítsd a kért komponenseket. Settings → Locations → Command Line Tools: válaszd ki az Xcode-ot. A gépen Xcode 27.2 van, a licenc elfogadva. A helyi futtatáshoz Settings → Components alatt tölts le iOS Simulator runtime-ot. A parancssori buildhez szükség esetén DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer használható.
3. **Android:** Android Studio és SDK telepítése. Az android/variables.gradle fájlban megadott SDK-verziókat használd; Gradle JDK-nak elsőként a Studio támogatott beépített JDK-ját. Android-fordítást még nem végeztünk.
4. **Supabase:** Authentication → URL Configuration → Redirect URLs → Add URL. A natív visszatérési címet már hozzáadtam és visszaellenőriztem az élő projekten. Ezt most nem kell kézzel felvenned. A meglévő `https://szambaik.github.io/morzsa/` maradjon. A Site URL is maradhat a webapp.
5. **Telefonok:** egy iPhone és egy Android a kétplatformos próbához. Belépés, közös lista két taggal, hálózatvesztés, háttérbe kerülés, mikrofon, billentyűzet és nagyobb betűméret a próbakör.

**A Google Cloud Console Authorized redirect URI továbbra is a Supabase callbackje:** `https://cbgcugshwivxpaurzyqq.supabase.co/auth/v1/callback`. A natív URL a Supabase utáni visszatéréshez kell. A webes Google-belépés változatlan. Az email-megerősítés és jelszó-visszaállítás jelenleg a webes Morzsában fejeződik be; utána az appban emaillel/jelszóval lehet belépni.

Jelszót, aláírókulcsot vagy fiókbelépést nem kell chatben elküldened.

## Fejlesztői indítás

A repository gyökerében (Node 26.5.0-val ellenőrizve):

```sh
npm ci
npm test
npm run sync:mobile
npm run open:ios
# vagy
npm run open:android
```

A sync:mobile újraépíti és bemásolja a webes csomagot mindkét natív projektbe. A forrást a gyökérben módosítjuk, nem a generált dist vagy natív public mappákban.

Xcode Signing & Capabilities alatt válaszd ki a saját Team-et. Szimulátorhoz nem kell áruházi tagság; telefonos és terjesztési aláírás külön beállítás. Android Studióból fejlesztői APK építhető; a publikus Play-kiadás aláírt AAB és Play App Signing folyamat. Keystore fájlokat a Git figyelmen kívül hagyja.

Az AI-függvények engedélyezett eredeteinek alaplistájában szerepel a `capacitor://localhost` és `https://localhost`. Ha a VOICE_ORIGINS vagy RECIPE_AI_ORIGINS Supabase secretet egyedileg felülírtad, egészítsd ki ezekkel a webes origin megtartásával. A publishable key maradhat az appban; Gemini- vagy service-role kulcs nem kerülhet bele.

## Áruházi beküldés előtt

- Fiókok létrehozása, személyazonosság/cég ellenőrzése és szerződések elfogadása a te fiókodban.
- A 2023. november 13. után létrehozott személyes Play-fiókoknál legalább **12 tesztelő 14 folyamatos napig** zárt tesztben, utána production-hozzáférési kérelem. Az áruházi ellenőrzés további idő.
- iOS-en Sign in with Apple integrációt tervezünk a Google mellé az App Review 4.8 szerinti követelményhez. Ez még nincs megvalósítva.
- Natív session-tárolás véglegesítése Keychain/Keystore használatával, kijelentkezés és lejárt session tesztje. A natív session és PKCE már Keychain/Keystore tárolóban van; a régi natív localStorage-session egyszer, sikeres írás után migrálódik. Valódi telefonos ellenőrzés még szükséges.
- Appon belüli fióktörlés és közös háztartás tulajdonosi/adatmegőrzési szabályai; Google által kért webes törlési kérelem elérhetősége.
- Valós adatkezelési tájékoztató, támogatási elérhetőség. Tőled a kiadó/adatkezelő és support adatai kellenek. Az AI-hoz továbbított hang/készlet és szolgáltatói feltételek ellenőrzése is része ennek.
- Privacy/Data safety nyilatkozat, korhatár, képernyőképek, leírás és reviewer-tesztfiók.
- A Capacitor önmagában nem garantál App Store-elfogadást; a 4.2 szerinti hasznos appélményt is be kell mutatni.

A böngésző helyi készlete nem jelenik meg automatikusan a natív app külön tárolójában. A közös háztartás belépés után visszatöltődik. Csak helyi készletnél használd a meglévő, felhasználó által indított másolást a közös háztartásba; nincs automatikus összefésülés.

## Készletellenőrzés

A 20261109_pantry_reviews.sql migráció külön RLS-védett táblát és verzióellenőrző RPC-t ad hozzá; az élő projektre alkalmazva. A régi stock/cart formátum és RPC változatlan. Nincs visszamenőleges dátumfeltöltés vagy automatikus törlés. Új jelenlétre szerveroldali trigger tesz dátumot; már meglévő termék új vásárlását külön megerősítés rögzíti. Utóbbi hálózati hibájánál a vásárlás megmarad és a tétel később újra ellenőrizhető.

Induló idők: zöldség/gyümölcs/pékáru 5 nap; tej/hús/hal/növényi alapok 7 nap; fagyasztott 30 nap; más élelmiszer 60 nap. Ezek **adatellenőrzési időközök, nem lejárati vagy fogyaszthatósági határidők**. Még nincs telefonos push vagy automatikus heti értesítés; az emlékeztető az app készletoldalán jelenik meg.

## Hivatalos források

- [Apple Developer belépés és éves díj](https://developer.apple.com/programs/enroll/)
- [Apple díjmentesség](https://developer.apple.com/support/fee-waiver/)
- [Google Play regisztráció és díj](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en)
- [Play tesztkövetelmények](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Capacitor dokumentáció](https://capacitorjs.com/docs)


## Portolás: aktuális technikai ellenőrzés

A webes csomag külön is előáll: npm run build:web → web-dist. A webes felület a meglévő GitHub Pages címen marad. A telepítési manifest saját ikonnal kezdőképernyős indítást támogat; újratöltéshez internet kell, offline service worker még nincs.

A receptcsevegés, hangos asszisztens és receptajánló a közös Supabase hátteret használja mindhárom platformon. A recept alatti beszélgetés nem módosít készletet. Native Browser/Clipboard kezeli a külső AI megnyitását és másolást; Keyboard a billentyűzetet; App/Network az előtérbe visszatérés és hálózat helyreállásának frissítését. Háttérbe kerüléskor a folyamatban lévő felvétel bezárul és a mikrofon leáll.

A GitHub Actions „Mobile builds” workflow webtesztet, Android debug APK-t és iOS Simulator buildet készít. Az artifactok 14 napig elérhetők; a nyilvános repo normál GitHub-hosted runnerjein ez nem igényel áruházi tagságot. Az iOS smoke script már telepített szimulátorra telepít és indít; runtime-ot nem tölt le, OAuthot/mikrofont nem tesztel.

Az Android debug aláírókulcsot a workflow cache megőrzi az egymást követő tesztbuildekhez. Ez fejlesztői aláírás, nem kiadási kulcs. Cache-vesztés vagy helyi build esetén eltérhet: ilyen APK nem frissíthet rá a korábbira. Ilyenkor ne töröld az appot helyi adatok mentése nélkül; a végleges tesztterjesztéshez tartós kiadási aláírás szükséges.


## Telefonos próbakör

Androidon töltsd le a Mobile builds workflow morzsa-android-debug artifactját, bontsd ki, és az app-debug.apk fájlt nyisd meg a telefonon. Engedélyezd az adott böngésző/fájlkezelő számára a telepítést. Ez tesztcsomag, nem Play Store-kiadás. Ha a meglévő telepítést más kulcs írta alá, a frissítés visszautasítható; ne töröld a helyi készlet mentése nélkül.

iPhone-on Xcode-ból válaszd ki a csatlakoztatott telefont és a saját Apple Team-et, majd Run. A Simulator artifact nem telepíthető valódi iPhone-ra. A szimulátor indítása ingyenes; terjesztéshez később TestFlight-fiók szükséges.

A próba sorrendje: belépés → saját tesztháztartás → másik készüléken csatlakozás → lista gyors pipálása → hálózat ki/be → app háttérbe/elő → hangfelvétel és mentés → receptcsevegés → kijelentkezés és újraindítás. A böngésző helyi készletét belépéskor nem olvasztjuk a közös háztartásba.


Ellenőrzési eredmény (2026-11-09): a webes tesztcsomag, az Android debug build és a helyi iOS Simulator build sikeres. Az APK csomagazonosítóját és mikrofonengedélyeit a kész binárisból is ellenőriztük. Az iOS CI-indítás külön, időkorlátos, opcionális smoke lépés: a workflow összesített zöld állapota önmagában nem jelenti a szimulátoros indítás sikerét; ennek saját lépését és képét kell nézni. A ZIP-be csomagolt iOS artifact megőrzi az app futtatási jogosultságait.
