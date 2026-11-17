# Morzsa Plus chat és receptkártyák: mérés és gyorsítás

## Mi okozta a lassulást?

Két, 2026. november 17-i éles Plus-kérés tartalommentes naplójában a Supabase auth + foglalás 656 és 763 ms volt. Az OpenAI-hívás 17 768 és 26 467 ms-ig tartott; az első válaszszöveg 3619 és 8579 ms-nál érkezett. A modell GPT-6.1 Terra volt, 708/833 outputtokennel, 0/40 reasoning tokennel és cache-találat nélkül. Ebben a kis mintában az AI-szolgáltatói út dominált, nem az adatbázis. A provider idő hálózati várakozást is tartalmaz; ez nem kizárólag modell-számítási idő. A két minta nem p95, és a felhasználó eszközén végzett küldési előkészítést nem méri.

A receptkártya külön késleltetése determinisztikus volt: csak az answer mező streamelt, a cím/összefoglaló megvárta az összes részletes lépést, a teljes JSON-t, a lezáró könyvelést és a hálózati EOF-ot. A Plus ezenfelül egy 40–70 szavas angol képleírást is generált, amelyet a Plus képgenerátora nem használ. Az első answer elkészülte után azonos szöveget küldtünk ki újra a további JSON-deltáknál is.

## Implementált változások

- A gépelt Plus-chat és az egyedi receptek alapértelmezett modellje GPT-6 Luna, low reasoning. A fotót tartalmazó üzenetek és a heti terv kontextusa továbbra is GPT-6.1 Terra. A modellfelülírások és az összes meglévő auth-, tagsági, költségkeret- és műveleti ellenőrzés megmaradnak.
- A kész cím, rövid leírás, idő és adagszám korán megjelenik a chatben. A kártya jelzi, hogy a hozzávalók és a részletes lépések még készülnek. A részleges kártyából nincs mentés, képgenerálás vagy főzésindítás; a végleges válasz továbbra is szerveres és klienses ellenőrzésen megy át.
- A recipe_preview eseményt csak azt kifejezetten kérő új Plus-kliens kapja. Régi kliens változatlan answer/done protokollt kap; új kliens régi szerverrel is működik. A Free-útvonal nem kap új eseményt.
- A belső provider-séma a lépés címét és utasítását egy objektumba teszi. A szerver visszaalakítja a régi steps:string[] és stepTitles:string[] formára. Így a címek és lépések darabszáma nem csúszhat el. A részletes főzési útmutató, hőfok, állag és elkészülési jel követelménye megmarad. A recept-, lépés-, hozzávaló- és műveletszám korlátai a provider-sémában is szerepelnek.
- A Plus elhagyja a felesleges angol képleírást; a képgenerátor a teljes receptből továbbra is készít képet. A már mentett imagePrompt mezők és a Free képútvonala kompatibilisek maradnak.
- Azonos answer-részleteket nem küldünk újra. A kliens a done, a providerolvasó a response.completed után lezár; nincs további várakozás a transport EOF-ra. A költségkönyvelés továbbra is megelőzi a végleges done eseményt.
- A turn előkészítése friss megosztott előzményt és valódi szerveres lockot kap, de a régi fotók URL-aláírására nem vár. A már cache-elt fotó-URL-ek megjelenhetnek; a többit a szokásos frissítés tölti be, fiókellenőrzéssel.
- Helyi és szerveres, tartalommentes szakaszidőzítések: küldés előkészítése, első szöveg, első receptkártya, teljes befejezés, könyvelés. A kliens mérései a konzolban maradnak; nincs új telemetria-végpont.

## Valódi providerpróba

Kitalált készlettel és magyar kérdésekkel, a projekt Supabase-környezetéből az igazi OpenAI API-t hívtuk. A próba sem háztartási táblát, sem felhasználói beszélgetést nem olvasott vagy írt. Ideiglenes, véletlen titokkal és lejárattal védett próbaendpoint futott; jogosulatlan hívás 403-at kapott. A próbaendpoint a mérés után törölve lett. Ezek alacsony mintaszámú, egymás után futtatott mérések, eltérő cache-állapottal és sztochasztikus válaszokkal.

| Kérdés | Korábbi Terra: teljes válasz | Végleges Luna: teljes válasz | Végleges Luna: első szöveg | Végleges Luna: kártyacím |
|---|---:|---:|---:|---:|
| Krémes rántotta, rövid válasz | 5,57 s | 2,13 s | 1,08 s | — |
| Sütési hőfok, követő kérdés | 7,78 s | 3,40 s | 1,39 s | — |
| Részletes almás palacsinta | 22,16 s | 8,40 s; ismételve 11,81 s | 1,13 s; 3,34 s | 1,53 s; 4,22 s |
| Vegán almás süti | 17,28 s | 13,40 s | 5,03 s | 5,80 s |

A végleges szerződéssel 7/7 válasz ment át a valódi output-validátoron. Kézzel ellenőrizve: a receptek tartalmaznak hozzávalókat, részletes számozott lépéseket, hőt/időt és elkészülési jelzést; a vegán változat nem tartalmaz tejet/tojást. Az explicit tej-elfogyás és 2 literes listakérés pontosan két javaslatot adott, a megmaradt tojást nem törölte. A készletre vonatkozó kérdés nem adott műveletet. A követő kérdés nem generált új receptet.

Egy köztes, külön lépéscím-tömböt használó Luna-válasz hibás volt: két lépéshez négy címet adott. Ez a validátoron elbukott; nem ment ki kész receptként. Ez indokolta a belső párosított sémát. A thinking=none kísérlet a sima chatnél nem adott érdemi gyorsulást, ezért a végleges modell low reasoning maradt.

A gyorsulás nem garantál fix válaszidőt. A végleges vegán próbában például a reasoning 261 token volt, és az első szöveg öt másodperc után érkezett. Hosszabb kérések, terhelés, képek és heti tervek továbbra is tovább tarthatnak. A kártya-előnézet a részletes recept befejezése előtt már tájékoztatja a felhasználót.

Nyers, tartalommentes éles adatok: [production-before.json](chat-recipe-latency-2026-11-17/production-before.json). Szintetikus provider-mérések: [provider-benchmark.json](chat-recipe-latency-2026-11-17/provider-benchmark.json). A végső, kizárólag kitalált adatokból készült válaszok: [synthetic-final-outputs.json](chat-recipe-latency-2026-11-17/synthetic-final-outputs.json).

## Ellenőrzés és kompatibilitás

352 JavaScript-teszt és 10 SQL-csomag sikeres. A regressziók lefedik a JSON bármely karakterhatáron történő megszakítását, az escape-eket, a címek és számok részleges beérkezését, a protokoll egyeztetését, a provider lezárását nyitott transport mellett, a hibás végső receptet, a megszakítást, újrapróbálást, a régi publikus sémát, az explicit modellfelülírást és a modellhez tartozó költségkönyvelést. A meglévő saves/RPC szerződés nem változik, nincs adatbázis-migráció.

A design-audit/recipe-latency.mjs valódi böngészőben, helyi PGlite adatbázissal, tiltott külső hálózattal ellenőrzi a kártya megjelenését a befejezés előtt; a részleges recepthez tartozó mentési/főzési műveletek hiányát; a leállítást; az egyszeri újrapróbálást; a hibás végső recept eldobását; és a 320/390/1280 px széles elrendezést. A release gate része lett. A késleltetést itt a fixture adja, ez nem provider-benchmark.

A korábbi Plus-latenciaregresszió, a teljes audit, az akadálymentességi és natív vezérlő tesztek, a csomagolt webes ellenőrzés és a natív bundle-build is a kiadásellenőrzés része. A natív komponensekre való párhuzamos átállás aktuális main változataira épül a javítás.

## Telepítés és visszaállítás

A backend plus-assistant külön Supabase-telepítést igényel, a webfelület a kötelező Audit regression gate után jelenik meg. Régi telepített natív kliens már az új szerveres modellt kapja, de a korai kártya és a klienses várakozások javítása új natív build telepítését igényli.

Az OPENAI_TEXT_MODEL=gpt-6.1-terra secrettel a gépelt chat visszaállítható a korábbi modellre; az OPENAI_COMPLEX_TEXT_MODEL külön kezeli a fotókat és a heti terveket. A korábbi plus-assistant v16 forrása telepítés előtt le lett mentve, mind a 13 fájlja egyezett a main alapverziójával. A helyreállításhoz nincs felhasználói adat-visszatöltés vagy sémamigráció.

Források: [OpenAI latency optimization](https://developers.openai.com/api/docs/guides/latency-optimization), [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [GPT-6.1 Terra](https://developers.openai.com/api/docs/models/gpt-6.1-terra).
