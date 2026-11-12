# Morzsa: gyors szöveg és ingyenes receptképek — bekötési terv

Állapot: eredeti terv, 2026-11-11. A megvalósult első szakasz és a még hátralévő elemek: GROQ-CLOUDFLARE-SETUP.md (2026-11-12). Ez a dokumentum nem kapcsol át szolgáltatót,
nem aktivál fizetős csomagot, és nem módosít meglévő mentéseket.

## Döntési javaslat

- Szöveg: Groq, `openai/gpt-oss-120b`, alacsony reasoning effort.
  Ez a Groq által futtatott nyílt súlyú modell; nem OpenAI API-előfizetés.
- Kép: Cloudflare Workers AI, `@cf/black-forest-labs/flux-1-schnell`,
  Workers Free csomagban, kezdetben legfeljebb napi 50 új kép/app.
- A jelenlegi Gemini útvonal maradjon kapcsolható tartalék és az első
  fázisban a meglévő fotó-/hangbemenet kiszolgálója. A GPT-OSS szöveges modell.
- Későbbi OpenAI-migráció: külön text/image adapter cseréje; a beszélgetés,
  receptadatok, képtár és felhasználói műveletek formátuma maradjon azonos.

## Ellenőrzött keretek és becslés

Groq GPT-OSS 120B: $0.15 / 1M bemeneti és $0.60 / 1M kimeneti token.
5000 input + 1000 összes számlázott output token mellett 1000 kérés kb.
$1.35. Ez nem mért Morzsa-forgalom; reasoning, előzmény és retry növelheti.
A fizetős fiók tényleges limitjeit aktiválás előtt ellenőrizni kell.

Az ingyenes Groq keret jelenleg 30 kérés/perc, 1000 kérés/nap,
8000 token/perc és 200000 token/nap ennél a modellnél. A tokenlimit sokkal
szűkebb lehet, mint amit a kéréslimit sugall. Free csak pilot, nem SLA.

Cloudflare Workers AI: napi 10000 Neuron ingyen, fiókszinten összesítve.
A FLUX.1 Schnell ára 4.80 Neuron / 512x512 tile és 9.60 Neuron / lépés;
a modell alapbeállítása 4 lépés. A valós képfogyasztást mérjük; a napi
50 kép kezdeti saját korlát, nem szolgáltatói garancia. Workers Free
keret felett hibával megáll; automatikus fizetős képes fallback nem lesz.
A képtárolás és forgalom külön Supabase-kvóta, ezt is mérni kell.

## Hívási folyamat

1. A kliens egy azonosított kérést küld a meglévő, autentikált Supabase
   belépési pontra. Titkos API-kulcs nem kerül a webes/natív kliensbe.
2. A szövegadapter tömör rendszerutasítást, releváns készletet/listát,
   aktív receptet és korlátozott előzményt kap. A teljes katalógust nem küldjük.
   Főzési kérdésnél megmaradnak a fontos megkötések/allergiák; csonkítás
   nem írhatja át a mentett beszélgetést vagy a felhasználó szándékát.
3. A közönséges válasz valódi stream. Receptek és műveletek eszközhívásként
   érkezhetnek, végleges argumentumokkal és szerveroldali ellenőrzéssel.
   Nincs külön LLM-osztályozó hívás minden üzenet előtt.
4. Groq strict Structured Outputs és streaming jelenleg nem kombinálható.
   A streaming tool-call adatot ezért nem tekintjük garantáltan helyesnek:
   a jelenlegi mező-, mennyiség- és műveletkorlátok érvényesek.
   Ha egy útvonal strict JSON-t igényel, az nem streamel, és ezt külön mérjük.
5. Csak befejezett, ellenőrzött javaslat menthető, a meglévő megerősítéssel.
   Félbeszakadt válasz, újrapróbálás vagy modellváltás nem módosít készletet.
6. A recept szövege után külön képjob indul. A kép sosem blokkolja a választ.
   Canonical receptverzió + képtípus + stílus alapján deduplikált cache.
7. Először egy készételkép készül. Lépésképek csak főzés indításakor/kérésre,
   egyesével; a következő képet előre lehet készíteni. FLUX Schnell nem
   garantál konzisztens edényt/ételt több képen, ezért ezt külön vizuálisan
   teszteljük. Képek AI-illusztrációként jelölve.
8. Ingyenes képkvóta végén a chat működik tovább; nincs új kép, a mentettek
   elérhetők. Állapot: várakozik / készül / kész / most nem elérhető.

## Megbízhatóság

- Összesen legfeljebb két szolgáltatói próbálkozás egy felhasználói kérésre.
  Nincs egymásra rakódó kliens-, proxy- és SDK-retry.
- Összesített határidő; külön első-válasz és teljes-válasz mérés.
- HTTP és streamen belüli 429/503/timeout azonos szabályok szerint kezelve.
- Retry-After és tokenkeret tiszteletben tartása; napi keret elfogyására
  nincs azonnali újrapróbálás. A Gemini sem kerül végtelen ciklusba.
- Megosztott, szerveroldali cooldown és szolgáltatóállapot több eszközre;
  az Edge Function memóriája önmagában erre nem elegendő.
- Műveletenkénti request-id, ismételt kérés összefogása, egyszeri appkvóta.
  Cache csak megfelelő user/háztartás és teljes kontextusazonosság mellett.
- Számláló/mérés: szolgáltató, modell, latency, státuszkód, token/képkeret;
  teljes prompt, fotó, titkos kulcs és személyes naplózás nélkül.
- Szolgáltatónkénti konfigurációs kapcsoló és egyszerű visszaállás Geminire.

## Megvalósítás sorrendje és elfogadás

1. 30 magyar teszteset: egyszerű kérdések, recept, helyettesítés, bizonytalan
   készlet, lista/készlet műveletek, elutasítandó vagy kétértelmű parancsok.
   Tiszta szintetikus adatokkal Groq–Gemini összehasonlítás.
2. Text adapter és context budget. Cél: normál szövegnél p50 első látható
   token <1.5s, p95 <4s; recept p50 teljes válasz <6s. Ezek elfogadási
   célok, nem jelenleg mért eredmények vagy szolgáltatói garanciák.
3. Biztonsági/kompatibilitási tesztek: régi kliensek és mentések,
   félbeszakadt stream, retry, stop, egyetlen menthető végállapot,
   hibás tool argumentum, 429/503 és két párhuzamos felhasználó.
4. Képjob, napi atomikus kvóta, Storage-hozzáférés, cache és hozzáférésvédelem.
   10–15 magyar étel vizuális tesztje, fix stílus és angol képprompt.
5. Saját kétfős háztartásban pilot, majd 5–10 tesztelő. Egy hét mérés után
   tényleges sebesség, hibaarány és költség alapján döntés az alapértelmezésről.

## Ami a tulajdonostól kell majd

- Groq fiók és API-kulcs. Free teszttel kezdhető; a megbízhatóbb szöveges
  használathoz kis fizetős keret javasolt, a tényleges limitek ellenőrzésével.
- Cloudflare fiók, Workers AI hozzáférés, Account ID és minimális jogosultságú
  API-token a megadott fiókra. A kulcsok Supabase Secrets-be kerülnek.
- A jelenlegi Supabase projekt használható; új kliensoldali fiókrendszer nem kell.
- Kezdeti saját AI-szöveges költségkeret és kvóta jóváhagyása. A terv nem
  aktivál előfizetést és nem kér kulcsot a chatben.

## Hivatalos források (ellenőrizve: 2026-11-11)

- https://console.groq.com/docs/model/openai/gpt-oss-120b
- https://console.groq.com/docs/rate-limits
- https://console.groq.com/docs/structured-outputs
- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/

## Előkészítendő Supabase Secrets (2026-11-12)

Ezek a bekötéshez kijelölt nevek; a jelenlegi éles kód még nem olvassa őket.
A feltöltésük önmagában nem vált szolgáltatót.

| Név | Érték |
| --- | --- |
| GROQ_API_KEY | A Groq konzolban létrehozott API-kulcs |
| GROQ_MODEL | openai/gpt-oss-120b |
| CLOUDFLARE_ACCOUNT_ID | A kiválasztott Cloudflare-fiók Account ID-ja |
| CLOUDFLARE_API_TOKEN | A Workers AI REST API-hoz létrehozott token |
| CLOUDFLARE_IMAGE_MODEL | @cf/black-forest-labs/flux-1-schnell |

Cloudflare: Workers AI → Use REST API → Create a Workers AI API Token.
Egyéni tokennél a hivatalos útmutató Workers AI Read és Edit jogosultságot
ír elő; csak a kiválasztott fiókra korlátozva. Saját domain vagy külön Worker
telepítése nem szükséges a Supabase-ből indított REST API-híváshoz.

Groq: https://console.groq.com/keys
Cloudflare útmutató: https://developers.cloudflare.com/workers-ai/get-started/rest-api/
A meglévő GEMINI_API_KEY és VOICE_MODEL beállításokat egyelőre meg kell tartani.
