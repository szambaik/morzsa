# Hangos készletkezelés

A Készlet oldalon a kereső mellett lévő mikrofon indítja. Bejelentkezés után legfeljebb 30 másodperces üzenetet lehet rögzíteni. A felvétel végén vagy 30 másodpercnél az app elküldi az üzenetet a Google AI-nak. Bezárás a felvétel alatt megszakítja a rögzítést, nem küldi el.

## Használat

- „Vettem tejet és tojást.” → készletbe.
- „Elfogyott a vaj, írd a listára.” → kivétel a készletből és felírás a listára.
- „Két kiló krumpli kell.” → a listán a krumpli teljes mennyisége 2 kg lesz.

Az AI csak változtatási javaslatot ad. Az áttekintőben minden terméknév, művelet és listamennyiség javítható. A nem azonosított termékek nevét külön jóvá kell hagyni; ezek a Saját tételek kategóriába kerülnek. Módosítás kizárólag az Alkalmazás gombra történik, az aktuális készletben/háztartásban. Utána 8 másodpercig visszavonható. Az időközben módosított rekordokat a visszavonás megtartja; az egyedi terméknevek a katalógusban megmaradnak.

A készlet jelenlétet tárol; ott a mondott mennyiség nem indít részletes készletnyilvántartást. A listán a mennyiség beállítás, nem hozzáadás: ugyanaz a parancs nem halmozza a mennyiséget. Teljes ürítést, vásárlás befejezését és háztartás/fiókműveleteket hanggal ez a verzió nem végez.

## Bekötés / újratelepítés

1. A meglévő Google AI Studio kulcsot használja: Supabase → Edge Functions → Secrets → GEMINI_API_KEY. Ha a receptajánló már be van kötve, ezt nem kell újra felvenni. Titkos kulcs nem kerülhet frontendbe vagy GitHubra.
2. A Supabase SQL Editorban futtasd a [20261030_voice_commands.sql](migrations/20261030_voice_commands.sql) fájlt. Csak egy új kvótatáblát és függvényt ad hozzá, a meglévő háztartásadatokat és RPC-ket nem változtatja meg.
3. A projekt gyökerében:

   npx supabase functions deploy voice-command --project-ref cbgcugshwivxpaurzyqq

A supabase/config.toml kikapcsolja a platform JWT-ellenőrzését ennél a függvénynél, mert GET/OPTIONS publikus. Minden feldolgozó POST a Supabase Auth segítségével külön ellenőrzi a bejelentkezett felhasználót. A funkció nem ír készletadatokat; az app a meglévő jogosultság- és verzióellenőrzött háztartás-RPC-n keresztül ment.

Alapmodell: gemini-3.1-flash-lite; VOICE_MODEL titkos beállítással módosítható kompatibilis, hangot fogadó Gemini-modellre. Alap engedélyezett origin: https://szambaik.github.io. Helyi teszthez a VOICE_ORIGINS vesszővel tagolt listájába felvehető például http://localhost:8771.

## Korlátok és adatok

- Saját korlát: 30 kérés / felhasználó / UTC-nap, összesen 300 kérés / app / UTC-nap. A Google ingyenes kerete ezen felül is korlátozhat. Sikertelen feldolgozás is fogyaszthat keretet.
- Legfeljebb 3 MB hang és 30 felismert művelet egy kérésben.
- A Morzsa nem menti el a felvételt vagy az átiratot; a Supabase kvótatáblája csak felhasználói azonosítót, napot és darabszámot tárol. Az audio a Google szolgáltatásához kerül, amelyre annak adatkezelése és az adott régió/tier feltételei érvényesek. Az ingyenes API-adatkezelés eltérhet a fizetőstől.
- HTTPS, mikrofonengedély és MediaRecorder-támogatás kell. Safari/iOS esetén MP4-et, Chromium esetén Opus/WebM-et választunk, ha a böngésző támogatja. Telefonon a tényleges mikrofon és a magyar felismerés minőségét külön ki kell próbálni; a böngészős automatizált teszt szimulált felvétellel és szolgáltatóval fut.
- Ha nincs szolgáltatás vagy engedély, a szöveges felvétel továbbra is elérhető.

Források: [Google hangfeldolgozás](https://ai.google.dev/gemini-api/docs/audio), [árazás](https://ai.google.dev/gemini-api/docs/pricing).

## Szöveges beszélgetős bevitel

A készletnél a Morzsa-kabalára kattintva ugyanennek az asszisztensnek írhatsz is. A szöveget a voice-command függvény ugyanúgy ellenőrzött műveleti javaslatokra bontja, mint a hangot. A szöveges módhoz nem kell mikrofon. Az adatokat csak a szerkeszthető áttekintő jóváhagyása után mentjük. A szöveges és hangkérések közös napi keretet használnak.

A „Mit főzhetnék ezekből?” gomb a meglévő készletalapú receptötletekhez vezet. Pusztán valamennyi alapanyag felhasználásából az asszisztens nem következtethet arra, hogy teljesen elfogyott.

## Általános asszisztens és alapértékek

A kabalánál írásban, a mikrofonról hanggal kérdezni is lehet. Például: „Mit főzzek?”, „Mivel helyettesíthetem a tojást?” vagy egy általános kérdés. A válasz után szöveges vagy hangos következő kérés indítható. Egy kérdés önmagában nem kér adatmódosítást; vegyes kérésnél a válasz mellett külön jóváhagyásra váró tételek jelennek meg. Az asszisztensnek nincs webkeresése, és nem ellenőriz aktuális árakat.

A Google AI megkapja az aktuális háztartás jelenlévő termékneveit, a bevásárlólista neveit/mennyiségeit/egységeit és a nyitott beszélgetés utolsó három üzenetváltását. Régi receptcsevegést, archívumot, felhasználóazonosítót vagy fiókadatot nem adunk a modellnek. A beszélgetés csak memóriában él, a panel bezárásakor elvész. Ugyanaz a napi kvóta érvényes, mint a hangparancsokra.

Ha csak a termék neve szerepel, a készletnézetből indított kérés alapból készletbe vételt jelent; egy kifejezett cél („listára”) ezt felülírja. Kérdésből nem következtetünk változtatásra. A készlethez nincs szükség mennyiségre. Új listatételnél a hiányzó mennyiség 1, az egység a katalógus alapegysége (például krumpli: kg); egyedi terméknél db. Már listázott terméknél a meglévő mennyiség és egység marad, ha nincs új megadva. Kifejezetten más egység kérése mennyiség nélkül 1-re állít, nem értelmezi át a korábbi számot.

A kompakt áttekintő sorai érintésre szerkeszthetők; ismeretlen terméknél a névellenőrzés rögtön nyitva van. A háttérfüggvény új answer mezője és az opcionális context/history/destination bemenet visszafelé kompatibilis. Régi kliensnek a csak szöveges választ clarification mezőben is visszaadjuk. Nincs adatbázis-migráció.
