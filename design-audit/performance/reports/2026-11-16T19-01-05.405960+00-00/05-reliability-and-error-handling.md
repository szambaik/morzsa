# Megbízhatóság és helyreállás

2026. november 16. · rögzített alkalmazáspillanatkép · szintetikus helyi adatok.

### PERF-004 — A közös készlet teljes hálózati lánca lezárja a párbeszédablakot

P1 · confirmed · bizonyosság: high

Az összes gomb, a bezárás is tiltott; a művelet 2952 ms-ot vett igénybe.

**Ok:** openPantryDetails minden gombot letilt és a cancel eseményt blokkolja, amíg updatePantryAvailability a saveVoiceState → household.push → fetchRows és PantryReview.confirm láncot végigvárja. Ez műveleti zárolás, nem általános JavaScript-fagyás.

**Reprodukció:**

1. Közös háztartásban Rizs-részletek megnyitása.
2. Minden REST-válasz késleltetése 450 ms-mal.
3. Van otthon választása, majd a bezáró- és műveleti gombok ellenőrzése.

**Forrás:** pantry-library.js:28, pantry-library.js:44, pantry-library.js:51, household.js:144, household.js:111

**Bizonyíték:** [bizonyíték](../../runs/2026-11-16T18-34-31.217Z-full/results.json) — sharedPantry · [bizonyíték](../../runs/2026-11-16T18-34-31.217Z-full/results.json) — sharedPantryPending · [bizonyíték](../../runs/2026-11-16T18-34-31.217Z-full/screenshots/25-shared-pantry-saving.png) · [bizonyíték](../../runs/2026-11-16T18-34-31.217Z-full/traces/shared.zip)

**Javaslat:** Bezárható párbeszédablak, helyi pending állapot és mentési nyugta külön kezelése. A mutációs válasz adhassa vissza a megerősített új állapotot, ahol ez biztonságos.

**Elfogadás:**

- 450 ms-os hálózatnál a vezérlők azonnal visszajeleznek és az ablak bezárható.
- Sikeres mentés csak szervernyugta után látszik.
- Hibánál a felhasználói szándék és az újrapróbálás megmarad.

### PERF-011 — Átmeneti conversation_page 400 a chat életciklusában

P3 · hypothesis · bizonyosság: low

A teljes futásban három 400-as válasz; a részletes naplózásnál egy Conversation access denied. Három egymás utáni üres chat külön próbája nem reprodukálta.

**Ok:** Lehetséges még nem perzisztált thread körüli frissítési verseny; a pontos ok nem bizonyított. A későbbi mentések sikerültek.

**Reprodukció:**

1. A teljes és kiegészítő run conversation_page kéréseinek ellenőrzése.
2. Új, üres beszélgetés és az első mentett turn körüli időzítés reprodukálása.

**Forrás:** persistence.js:73, persistence.js:88, persistence.js:104

**Bizonyíték:** [bizonyíték](../../runs/2026-11-16T18-34-31.217Z-full/results.json) — network · [bizonyíték](../../runs/2026-11-16T18-41-13.534Z-supplement/results.json) — fixtureCalls · [bizonyíték](../../runs/2026-11-16T18-41-13.534Z-supplement/results.json) — emptyChatRequests

**Javaslat:** Korrelált trace az üres → mentett thread átmenetről; a loadThread feltétel csak bizonyított reprodukció után változzon.

**Elfogadás:**

- Indokolatlanul tiltott olvasás ne induljon üres threadre.
- Valódi jogosultság-visszavonás továbbra is hibaként kezelendő.

## Pozitív eredmények és kudarcok

A helyi és közös készlet/lista mentését tényleges visszaolvasás és újratöltés igazolta. Az offline outbox megmaradt és újracsatlakozás után szinkronizálódott. A 503, csonkolt stream, Stop és 60 s-os timeout után a felület helyreállt. Nem animációból vagy toastból következtettünk perzisztenciára.

Nem találtunk igazolt P0 adatvesztést; ez nem általános adatvesztés-mentességi garancia. A 2000 tételes kattintási timeout valódi stresszteszt-kudarc. Az első soak hibás fixture-előkészítés miatt nem találta a Tojás kontrollt; ezt infrastruktúrahibaként őriztük meg, majd közvetlen, determinisztikus SQL-seedeléssel sikeresen újrafuttattuk. Az eredeti run nincs törölve.
