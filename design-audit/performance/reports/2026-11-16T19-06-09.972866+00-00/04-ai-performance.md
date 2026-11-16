# AI, streaming és képek

2026. november 16. · rögzített alkalmazáspillanatkép · szintetikus helyi adatok.

### PERF-003 — Az AI előkészítése látható folyamatjelzés nélkül vár

P1 · confirmed · bizonyosság: high

800 ms-nál az üzenet még a mezőben áll, a Küldés gomb aktív, nincs thinking és Stop. Az azonnali helyi AI-válasz is csak 3338 ms körül látható.

**Ok:** send előbb await-eli a beginTurn műveletet; a busy és renderChat később fut. A beginTurn flush/refresh, zárolás és történetolvasás láncot végez. Globális focusout további frissítést indíthat.

**Reprodukció:**

1. Új chat egy szintetikus bejelentkezett fiókkal.
2. Minden RPC-válasz 600 ms mesterséges késleltetést kap.
3. Küldés után 800 ms-nál képernyő és vezérlőállapot rögzítése.

**Forrás:** [companion-ui.js:199](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/companion-ui.js:199), [companion-ui.js:201](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/companion-ui.js:201), [companion-ui.js:206](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/companion-ui.js:206), [persistence.js:44](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/persistence.js:44), [persistence.js:102](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/persistence.js:102), [persistence.js:104](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/persistence.js:104)

**Bizonyíték:** [bizonyíték](../../runs/2026-11-16T18-34-31.217Z-full/results.json) — aiPreflight · [bizonyíték](../../runs/2026-11-16T18-34-31.217Z-full/screenshots/22-ai-preflight-800ms.png) · [bizonyíték](../../runs/2026-11-16T18-34-31.217Z-full/traces/journeys.zip)

**Javaslat:** Az egész előkészítési szakasz kapjon azonnali, megszakítható sending állapotot. A zárolási/mentési garanciák mellett a fölösleges olvasások összevonása.

**Elfogadás:**

- Küldés után ≤ 100 ms-on belül látható állapotváltozás.
- Előkészítés közben működő megszakítás.
- Dupla küldés nem indít két modelligényt.
- Másik eszköz turn-lockja továbbra is érvényes.

### PERF-008 — Egy lassú kép más képek cache-olvasását is feltartja

P2 · confirmed · bizonyosság: high

A második cache-kérés csak 2019.6 ms-nál indul. A korábbi, sorrendet nem garantáló próba önmagában nem volt bizonyító; a rendezett ismétlés igen.

**Ok:** Egyetlen modul-szintű Promise queue fogja össze az összes load feladatot, a független cache-only olvasásokat is.

**Reprodukció:**

1. Az első kép kérésének elindítása és ennek megvárása.
2. Csak ezután a második RecipeImages.mount hívás.
3. Az első lokális válasz 2000 ms-ot vár, a második azonnali lenne.

**Forrás:** [recipe-images.js:3](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/recipe-images.js:3), [recipe-images.js:49](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/recipe-images.js:49), [recipe-images.js:70](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/recipe-images.js:70)

**Bizonyíték:** [bizonyíték](../../runs/2026-11-16T18-41-13.534Z-supplement/results.json) — orderedImageQueue

**Javaslat:** Külön cache-olvasási út és kis párhuzamossági korlát, képenkénti deduplikációval. A generálás kvótája és idempotenciája maradjon védett.

**Elfogadás:**

- A második cache-olvasás ≤ 200 ms-on belül elindul a másik generálás mellett.
- Ugyanazon képhez nincs dupla generálás.

### PERF-010 — A Gemini handler kliensmegszakítás után is elindíthat providerhívást

P2 · confirmed · bizonyosság: high

A megszakítás után is 1 providerhívás indult, a handler kb. 399 ms-nál teljes tesztválaszt adott.

**Ok:** A Gemini ág auth/quota/generate hívásai saját határidőjelet kapnak, de nem az ügyfél Request.signal jelét.

**Reprodukció:**

1. Tényleges voice-command handler injektált fetch-csel.
2. Request.signal megszakítása 30 ms-nál, auth/quota 120–120 ms.
3. Providerhívások és válasz ellenőrzése.

**Forrás:** [supabase/functions/voice-command/handler.mjs:87](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/supabase/functions/voice-command/handler.mjs:87), [supabase/functions/voice-command/handler.mjs:90](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/supabase/functions/voice-command/handler.mjs:90), [supabase/functions/voice-command/handler.mjs:94](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/supabase/functions/voice-command/handler.mjs:94), [supabase/functions/voice-command/provider.mjs:6](/Users/I769428/Documents/ChatGPT/Főzés/morzsa-performance-audit-20261116T182653Z/supabase/functions/voice-command/provider.mjs:6)

**Bizonyíték:** [bizonyíték](../../provider-runs/2026-11-16T18-37-26.468Z/providers.json) — cases

**Javaslat:** Az ügyfél abortjelének összefűzése minden előkészítő/provider határidővel. Megszakítás után ne induljon új kísérlet vagy fallback.

**Elfogadás:**

- Auth közbeni megszakítás után 0 quota- és providerhívás.
- Provider-várakozás közbeni megszakítás lezárja az olvasót; nincs fallback.
- UI timeout/retry továbbra is helyreáll.

## Injektált provider-esetek

- healthy: 415.0 ms; providerkísérlet 1; sikeres tesztválasz
- overload-fallback: 400.6 ms; providerkísérlet 2; sikeres tesztválasz
- header-stall-default: 8398.6 ms; providerkísérlet 2; sikeres tesztválasz
- cancelled-client-preflight: 398.9 ms; providerkísérlet 1; sikeres tesztválasz
- malformed-stream: 398.4 ms; providerkísérlet 1; VOICE_INVALID_RESPONSE

A 8.4 s-os header-stall eset a default Gemini primary 8 s-os várakozását reprodukálja, nem Google-latenciát. A Groq ág saját 12 s-os próbát és 35 s-os összhatáridőt, a Plus OpenAI text 45 s-ot használ. A frontend aktuális kontextust és legfeljebb 12 chatüzenetet küld; a voice más lapozott történetet használ. Valódi tokenhasználatot nem találtunk ki.

A UI stream, más nézetre navigálás, 503/retry és Stop működött. A csonkolt stream és a valódi 60 s-os klienshatáridő után a beviteli mező újra aktív. Mért timeout: 60975.6 ms. A hosszabb kérésből származó AI-javaslat csak jóváhagyás után írta a közös listát, amit reload igazolt.

[bizonyíték](../../runs/2026-11-16T18-44-15.751Z-faults/results.json) · [bizonyíték](../../provider-runs/2026-11-16T18-37-26.468Z/providers.json)
