# Tartós receptek, képek és beszélgetések

Megvalósítás: 2026. november 14. A korábbi tervek későbbi lehetőségeket is leírnak; az alábbiak a tényleges első szállítás.

## Elkészült

- **Receptfeed:** 31 saját Morzsa-alaprecept Supabase-ben, stabil UUID-val és tartalommal. Neked, kereshető/szűrhető Böngészés és Saját receptek. A kedvencek, elkezdett és megfőzött receptek fiókszintű könyvtárba kerülnek. 24 receptes lapozás; a korábbi kártyák sorrendje a következő oldal betöltésekor megmarad.
- **Ajánlás:** étrend és kerülendő alapanyagok szűrnek; készlet, kedvencek, közelmúlt, elkészítési idő és évszak rendeznek. Minden negyedik hely megkötéseken belüli új ötletet mutat. Szabályalapú első változat, külön LLM-hívás nélkül.
- **Tartós receptek/képek:** azonos saját recepttartalom ismételt mentése azonos ID-t ad. A képreferencia receptazonosító + borító/lépés. A publikus receptképet minden látogató közösen használja. Modellváltás nem cseréli le a mentett képet. Korábbi saját képcache újragenerálás nélkül átvehető.
- **Beszélgetések:** privát, fiókszintű előzmény web/iOS/Android között. Konyha- és nyelvváltás nem hoz létre másik előzményt. Vendégként helyi tárolás marad. A korábbi companion-v1…v4 saját mentések stabil import-ID-kkal automatikusan átkerülnek; az eredeti helyi kulcsokat megőrizzük. Közös készlet/lista importja nem része a migrációnak.
- **Megosztás:** teljes szál és későbbi üzenetek egy konkrét háztartással, visszavonhatóan. Más tag olvasható nézetet kap, és saját privát folytatást indíthat. Privát szülőszál külön védett táblában marad. A címzett archiválása nem változtatja a tulajdonos példányát. Saját folytatás szöveget és recepteket másol; a forrásszál csatolt fotóit nem másolja át.
- **Chatfotók:** privát chat-media bucket, rövid aláírt link, szálhoz kötött olvasási jog. Az üzenettábla fájlreferenciát tárol. Privát chatfotó nem kerül a publikus katalógusba.
- **Szinkron:** helyi outbox, idempotens üzenet-UUID, 50 üzenetes és 100 szálas lapozás. Realtime mellett látható ablakban 15 másodperces fallback. Fiókváltás, tokenfrissítés, gépelés, AI-válasz és hangsession védett. AI-forduló előtt frissül az aktív előzmény. Egy szálban két saját eszköz nem indíthat párhuzamos választ. Régi AI-javaslat nem válik új végrehajtási engedéllyé.

## Költségvédelem

A feed görgetése csak adatbázis-/fájlolvasás, nem generál képet. Borító az első receptmegnyitáskor, indokolt lépéskép az adott lépéshez érve készülhet. Új generálást csak bejelentkezett kérés indít; a kész publikus képet vendég is olvashatja.

A katalógus új képei alapból Cloudflare/Groq útvonalon készülnek, Free/Plus kapcsolótól függetlenül. CATALOGUE_IMAGE_PROVIDER=openai szerverbeállítás külön engedi az OpenAI utat és Plus-keretellenőrzését. A személyes Plus receptek OpenAI-képgenerálást használnak, a Free mód megmarad. Elkészült képhez egyik módváltás sem indít új generálást.

Az új képreferencia-rendszer napi korlátja összesen **50 új kép**, fiókonként **20 új kép**; személyes és katalógusképek együtt. A korábbi végpontok/Plus-keretek saját védelmei megmaradnak. Párhuzamos kérések egy atomikus jobhoz csatlakoznak. Hibánál egyperces cooldown; bizonytalan providerbefejezés után nincs vakon második fizetős hívás. Már feltöltött fájlból helyreállítható a kész állapot.

A katalógus borítója mellé 320 pixel széles JPEG-thumbnail készül, a feed ezt tölti lazy módban. Privát kép-/fotólink kb. 30 percig él, a fájl nem jár le. Új aláírt linkhez nincs generálás. A fő tárolási költség a képek és a forgalmuk, nem a recept JSON-ja.

## Bekötés és ellenőrzés

1. supabase/migrations/20261114_persistent_library.sql: additív táblák, RLS, RPC-k, bucketek és Realtime.
2. supabase/seeds/recipe-catalog.sql: 31 saját recept, ismételhető import. A seed-recipe-catalog.mjs script nem hív modellt.
3. recipe-image és a közös kódot használó plus-assistant Edge Function telepítése.
4. npm test és npm run build:web. Gyors felületi iteráció: npm run sync:frontend, amely a natív webes bundle-t másolja a meglévő iOS/Android projektekbe, a generált pluginfájlok megtartásával. Natív plugin/config változásakor teljes npm run sync:mobile szükséges. A mostani teljes Capacitor CLI-szinkron megakadt; natív bináris fordítás ebben a körben nincs igazolva.
5. Izolált SQL-alapú UI-próba: MORZSA_QA_PORT=8835 node tests/persistence-fixture.mjs; utána tests/persistence.browser.js a Playwright tesztböngészőben. Nincs külső modellhívás vagy valódi felhasználói adat.

Tesztek: háztartás-admin privát izolációja, megosztás/visszavonás, privát szülőszál, üzenetdeduplikáció, hosszú lapozás, egyetlen képgenerálás, stale receipt, fiókváltás, mentés közbeni új üzenet, gépelés alatti frissítés, offline törlési védelem, kedvencek/receptkezdések készülékek között, 320 pixeles nézet.

## Később

Közösen írható chat, külön személyes felhő-ízlésprofil, katalógusszerkesztő/publikálási folyamat, általános előzménykereső és az elárvult Storage-objektumok takarítója későbbi fejlesztés. Jelenleg nincs automatikus képtörlés; mentett receptek képei megmaradnak. Privát tartalom nem kerül automatikusan a publikus feedbe.

Éles ellenőrzés: 7 Supabase-ellenőrzés sikerült ideiglenes tesztfiókokkal, a tesztadatok takarításával. Emellett a Krémes almás zabkása publikus borítója egyszer valóban elkészült Cloudflare-rel; a kép és a 320 pixeles thumbnail regisztrált Storage-objektum lett. Az ImageScript Deno-változata csak thumbnail-készítéskor töltődik: a Node-codec Supabase-en nem támogatott, ezért nem használjuk. 226 teszt és a két fiókos, három böngészőkontextusos mobil/asztali UI-próba sikerült.
