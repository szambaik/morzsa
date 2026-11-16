# Gyökérok és bizonyosság

2026. november 16. · rögzített alkalmazáspillanatkép · szintetikus helyi adatok.

## Bizonyított lokális mechanizmusok

**PERF-001** — A shoppingGroupHeader minden csoporthoz újraszűri a teljes listát. A productCategory minden összehasonlításnál új tömböt épít, kisbetűsít és lineárisan keres. A CPU-profil forró pontja app.js:15.

**PERF-002** — recipe-library.cards → discoverySections → recipeChoice → resolve → QuickEntry.match. A ranked minden katalógusnévre Levenshtein-távolságot számol akkor is, amikor a név pontosan egyezik.

**PERF-003** — send előbb await-eli a beginTurn műveletet; a busy és renderChat később fut. A beginTurn flush/refresh, zárolás és történetolvasás láncot végez. Globális focusout további frissítést indíthat.

**PERF-004** — openPantryDetails minden gombot letilt és a cancel eseményt blokkolja, amíg updatePantryAvailability a saveVoiceState → household.push → fetchRows és PantryReview.confirm láncot végigvárja. Ez műveleti zárolás, nem általános JavaScript-fagyás.

**PERF-005** — Nincs alkalmazásbundle, minifikálás vagy kódfelosztás a web buildben. A klasszikus globális scriptfüggőségek és a sok erőforrás több hálózati kört igényelnek.

**PERF-006** — A household.refresh minden alkalommal teljes ellenőrzött fetchRows-t, majd pantry/kitchen/shopping frissítéseket indít. A 8 s-os poll egészséges Realtime mellett is marad; a perzisztencia 15 s-os és globális focusout-frissítése hozzáadódik.

**PERF-007** — A belső feltétel csak can_read_conversation(id), előzetes owner/shared jelöltszűrés nélkül. A meglévő owner-index ebben a tervben minden kulcsot végigolvas, a jogosultság soronként értékelődik.

**PERF-008** — Egyetlen modul-szintű Promise queue fogja össze az összes load feladatot, a független cache-only olvasásokat is.

**PERF-009** — entry.views erős referenciát tart a hostra és paint closure-re. A leválasztott elemeket csak későbbi refresh/paint takarítja; egy kész, nem frissülő képnél ez elmaradhat.

**PERF-010** — A Gemini ág auth/quota/generate hívásai saját határidőjelet kapnak, de nem az ügyfél Request.signal jelét.

## Hipotézis

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

A felhasználó konkrét éles megakadása nincs egy ismert eseménynaplóhoz, adatmennyiséghez, eszközhöz vagy providerhíváshoz kötve. A bizonyított mechanizmusok hozzájárulhatnak, de az arányuk a valós panaszban innen nem mérhető. Kis háztartási adatokkal általános, véglegesen beragadt UI nem reprodukálódott.
