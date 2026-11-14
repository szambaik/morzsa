# Morzsa Plus · OpenAI bekötés

Implementálva: 2026. november 14. A Plus az alapértelmezett AI-mód. A chat beviteli mezője alatt választható az Ingyenes mód. A két mód ugyanazt a készletet, listát és előzményt használja. A Free szolgáltatók és RPC-k megmaradnak.

## Amit neked kell beállítanod

1. OpenAI API-projekt és API-kulcs: https://platform.openai.com/api-keys. Kapcsold be az API-számlázást/feltöltött keretet. A ChatGPT-előfizetés külön szolgáltatás. Kezdetnek kis feltöltés és projektszintű költségriasztás javasolt; a riasztás nem garantált hard limit.
2. A Supabase **Edge Functions → Secrets** oldalán add meg **OPENAI_API_KEY** néven: https://supabase.com/dashboard/project/cbgcugshwivxpaurzyqq/functions/secrets. A kulcsot ne tedd frontendbe, Gitbe vagy chatbe.
3. Adj pilot Plus-hozzáférést a saját fiókodnak vagy a közös konyhának az alábbi SQL-lel. Ezt később előfizetés-webhook válthatja ki. Jelenleg nincs Stripe/App Store/Play számlázás; az API-költséget a projekt tulajdonosa fizeti.

Saját fiók (cseréld az email-címet):

~~~sql
insert into public.morzsa_plus_entitlements(scope,monthly_cents)
select 'user:' || id::text, 1000 from auth.users where email='SAJAT_EMAIL_CIM'
on conflict(scope) do update set enabled=true, expires_at=null;
~~~

Közös konyha minden tagjának (cseréld a háztartás UUID-jét):

~~~sql
insert into public.morzsa_plus_entitlements(scope,monthly_cents)
values ('home:HAZTARTAS_UUID',1000)
on conflict(scope) do update set enabled=true, expires_at=null;
~~~

A backend ellenőrzi az aktuális konyhatagságot. Egy kliens által megadott csomagnév és a webes alapértelmezés önmagában nem jogosultság.

## Modellek

| Funkció | Alapértelmezett modell | Opcionális secret |
|---|---|---|
| Szöveg, receptek, fotóértelmezés | gpt-6.1-terra, low reasoning, valódi válaszstream | OPENAI_TEXT_MODEL |
| Recept- és indokolt lépéskép | gpt-image-2.6-flare, 1024×1024, medium | OPENAI_IMAGE_MODEL |
| Kétirányú hang | gpt-realtime-2.1-mini, WebRTC, marin | OPENAI_REALTIME_MODEL |

A Luna választható olcsóbb szöveges alternatíva (OPENAI_TEXT_MODEL=gpt-6-luna). Ismeretlen modell felülírásakor a költségkönyvelés konzervatív marad; a képméret/quality támogatását ellenőrizni kell.

## Telepítés

Az adatbázis és az Edge Function külön települ a GitHub Pages frontendtől. Már elvégzett telepítést státusz alapján ellenőrizz.

~~~sh
npx supabase db query --remote=cbgcugshwivxpaurzyqq --file supabase/migrations/20261114_plus_assistant.sql --yes
npx supabase functions deploy plus-assistant --project-ref cbgcugshwivxpaurzyqq --use-api --yes
npm run build:web
npm run sync:mobile
~~~

Helyi szervernél a VOICE_ORIGINS engedélyezett originjei közé fel kell venni a teszt originjét. Az éles alap: GitHub Pages + capacitor://localhost + https://localhost. Ne használj * CORS eredetet.

## Hang és műveletek

A Plus mikrofonja beszélgetést indít: automatikus beszédfordulók, válasz hanggal, félbeszakítás, némítás, átirat a fő chatben. Nem kell minden mondat után beküldeni egy felvételt.

Példa: „Elfogyott a tej, írd a listára.” Morzsa előkészíti a két módosítást. Egy új beszédfordulóban „mentheted”, „mentsd el” vagy „igen” menti; a chat Mentés gombja is használható. Két toolhívás ugyanabban a beszédfordulóban nem menthet. Ismeretlen termék vagy közben változott adat a chatben pontosítást igényel. A közös, verzióellenőrzött mentés és a visszavonás megmarad.

További eszközök: készlet/lista/recept olvasása, teljes receptkártya kérése, receptlépésre ugrás, hozzávalók megnyitása és egyszerű időzítő. A webes időzítő az app futásától függ; nem natív háttérriasztás.

**Első kiadás korlátja:** egy hangkör legfeljebb 110 másodperc. Ez belefér a Supabase Free Edge Function futásidejébe, és a szerver sideband kapcsolata ténylegesen bontja az OpenAI-hívást. Utána a mikrofonról folytatható, kontextussal. Hosszabb megszakításmentes híváshoz tartós voice gateway vagy hosszabb háttérfutás kell. Háttérbe küldéskor bezárul a mikrofon és a kapcsolat. Natív készülékes próba még szükséges.

## Keret

- Jogosultságonként alapértelmezett havi keret 1000 USD-cent ($10), 500 szövegkérés, 60 kép, 30 hangkör. Globális keret a global jogosultságsorban állítható.
- Atomikus foglalás hívás előtt: szöveg 12 cent, kép 25 cent, hangkör 30 cent. Azonos requestId nem indít még egy generálást. A képek privát cache-t és lease-t is használnak; cache-találat nem fogyaszt új keretet.
- Terra/Luna szöveg után tokenhasználat alapján, felfelé centre kerekített becslés kerül a keretbe. Kép/hang után jelenleg a teljes foglalás marad: ez kerettartalék, nem OpenAI-számla vagy ügyfélterhelés. A szolgáltatói számla eltérhet.
- A voice sideband válaszhasználatot is figyel, és küszöbnél bont. Egy válasz vagy háttérhiba túllépést okozhat; saját API-projektmonitoring is szükséges.
- A napló azonosítót, modellt, használati számokat, állapotot és hívásazonosítót tárol; nyers hangot, promptot vagy beszélgetést nem.
- Kulcs/keret/jogosultság hibánál nincs csendes váltás. Válaszd az Ingyenes módot; a kézi lista/készlet végig használható. A Free választás felhasználónként megmarad.

Források: [Responses](https://developers.openai.com/api/docs/guides/text), [WebRTC](https://developers.openai.com/api/docs/guides/realtime-webrtc), [szervervezérlés](https://developers.openai.com/api/docs/guides/realtime-server-controls), [hívásbontás](https://developers.openai.com/api/reference/resources/realtime/subresources/calls/methods/hangup), [képgenerálás](https://developers.openai.com/api/docs/guides/image-generation), [árak](https://developers.openai.com/api/docs/pricing).

## Tartós receptek és képek

A jelenlegi képcache már a backenden tárolja a képeket. A teljes receptkönyv, főzési haladás és konyhán belüli képfelhasználás additív bevezetési terve: [RECIPE-PERSISTENCE-PLAN.md](../docs/RECIPE-PERSISTENCE-PLAN.md). A recept újranyitásakor a cél nulla új text- és image-generálás.
