# Privát és háztartással megosztott beszélgetések

Megvalósítva: 2026. november 14. A privát beszélgetésszinkron, a lapozott előzmények és a háztartási megosztás elkészült. A tényleges állapot: [megvalósítási jegyzet](PERSISTENCE-IMPLEMENTATION.md).

## Termékdöntés

A bejelentkezett felhasználó ugyanazokat a saját beszélgetéseket lássa weben, iPhone-on és Androidon. Új chat és receptes albeszélgetés alapból privát. A közös konyha kiválasztása, háztartási meghívás elfogadása vagy recept megosztása nem teszi közössé a chatelőzményt.

A beszélgetés tulajdonosa a felhasználói fiók. A konyha a beszélgetés választható kontextusa; a hozzáférés külön beállítás. A felület nyelve sem hoz létre új előzményt: HU/EN váltás után ugyanazok a beszélgetések maradnak elérhetők, eredeti üzenetszöveggel.

## A jelenlegi tárolás korlátai

- A `companion-model.js` workspace-kulcsa felhasználó, aktív konyha és nyelv szerint képez helyi tárolót.
- A `companion-ui.js` `persist()` függvénye a teljes workspace-et `localStorage`-ba írja; ez nem készülékek közötti szinkron.
- Nincs beszélgetés- vagy üzenettábla a jelenlegi Supabase migrációkban. A háztartás készlet/lista szinkronja ettől külön működik.
- A helyi workspace legfeljebb 61 szálat normalizál, a receptes/korábbi szálak üzeneteiből legfeljebb 40-et őriz meg. A backend-archívumot ezért nem szabad ezen a normalizálón keresztül visszamenteni és levágni.
- A chatfotó helyben kicsi JPEG-előnézetként kerül az üzenetbe; a teljes kép más eszközön való eléréséhez külön privát fájlmentés szükséges.

## Felület és megosztási viselkedés

Az előzmények alapból a saját chateket mutatják; a háztartás által megosztottak külön csoportot kapnak. A privát jelölés legyen visszafogott. A beszélgetés menüjében legyen **Megosztás a háztartással**, megosztás után **Megosztás megszüntetése**. Ne kapjon minden üzenet új nagy gombokat.

Első változatban a megosztott beszélgetés élő, de a többi tag számára olvasható nézet: új végleges üzenetei is megjelennek. A megosztó tovább folytathatja. Másik tag **Saját beszélgetésként folytatom** művelettel privát másolatot indíthat. Ez a kiinduló döntés; a közösen írható chat külön későbbi funkció, szerzőjelöléssel és egyetlen aktív AI-válasz kezelésével.

Megosztás előtt rövid, konkrét összefoglaló szükséges: melyik háztartás, a teljes beszélgetés és a későbbi üzenetek láthatósága, csatolt fotók jelenléte. Egyetlen recept átadásához ott a receptmegosztás: az nem ad hozzáférést a beszélgetéshez. Receptes albeszélgetés megosztása nem osztja meg a szülőchatet; privát szülő címét/kivonatát sem mutatjuk a címzettnek.

Az archívum a felület rendezése, nem törlés. Az új chat 20–30 perc utáni ajánlása nem törli a régi beszélgetést. Aktív szál, görgetési hely, beviteli draft és eszközön futó hangsession helyben marad; a másik készülék nem rángatja el az éppen olvasott nézetet, és nem folytatja automatikusan a mikrofonfelvételt.

## Additív adatmodell

| Entitás | Szerep |
|---|---|
| `conversations` | Stabil UUID, `owner_id`, opcionális kontextuskonyha, típus (`chat`/`recipe`), cím, nyelv, privát alapláthatóság, receptverzió-referencia, létrehozás/frissítés, revision és törlési jelölés. |
| `conversation_messages` | Stabil kliens-UUID, szálazonosító, szerző, szerep, végleges szöveg, szerver által kiosztott sorrend, eredeti időbélyeg, válaszkapcsolat és állapot (`complete`/`interrupted`). |
| `conversation_shares` | Szál + megosztott háztartás, megosztó, aktív/visszavont állapot és jogosultsági revision. Első változat: read-only. |
| `conversation_attachments` | Privát Storage-objektum referenciája, üzenetazonosító, MIME/méret, előnézet; nincs base64 vagy tartós signed URL az üzenettáblában. |
| `conversation_user_state` | Felhasználónként olvasottság, saját archiválás/elrejtés és kedvenc; másik tag nem változtatja meg az én archívumomat. |
| `conversation_turns` | Egy logikai AI-kérés azonosítója, lease/fencing token, státusz és válaszüzenet-referencia; ismételt kliensmentés nem hoz létre még egy választ. |

Recepttartalom és képek a recept/asset táblákban élnek; az üzenet stabil receptverziókra hivatkozik. A receptes chat és a főzési haladás kapcsolódik a `cooking_sessions` rekordhoz. Egy beszélgetés backend-mentése önmagában nem teszi a kapcsolódó privát receptet nyilvánossá.

## Szinkron és költség

1. Az új felhasználói üzenet stabil UUID-val először helyi outboxba kerül, majd idempotens backend-mentésbe. Az AI-válasz streamje a helyi felületen jelenik meg.
2. A végleges AI-választ egyszer mentjük, és egyszer jelezzük a többi eszköznek. Nem írunk adatbázisba tokenenként, nem tárolunk Realtime audio-chunkokat. Félbeszakadt választ külön, egyértelmű állapottal lehet megőrizni; nem válik végrehajtott műveletté.
3. A sidebar csak lapozott cím/idő/típus listát kér. A megnyitott chat utolsó 30–50 üzenete töltődik be, a korábbiak felfelé görgetve. Archívum nem tölti le az összes fotót.
4. Realtime csak a jogosult listához és az aktív beszélgetéshez küld változásjelzést. A jelzés után revision/sorrend alapján letöltjük a hiányzó rekordokat. Reconnect és előtérbe kerülés delta-olvasást végez; ritka, látható állapothoz kötött polling a fallback.
5. Offline használat megmarad. Az outbox felhasználóhoz kötött; kijelentkezés/fiókváltás után nem küldjük az előző fiók rekordjait az új fiókhoz. Törlési tombstone és revízióakadály védi a szerveren törölt szálat az offline feltámasztástól.
6. Két saját eszköz egyidejű üzenete nem írhatja felül a teljes szálat. Append-only üzenetek és szerver-sorrend kellenek, a cím/megosztás módosítása revision-ellenőrzött. A generálási lease összehangolja a válaszokat; bizonytalan providerhiba után nincs vak automatikus újragenerálás.

A backendből történő újranyitás **nem AI-hívás**. A szinkron fő költsége a kis szöveges rekordok és csatolmányok tárolása/forgalma, nem új modellgenerálás. Szemléltetés: 1000 beszélgetés × 50 üzenet × átlagosan 2 KB ≈ 100 MB szöveg, indexek/metadata/backup és képek nélkül. A tényleges csomagkeretet és forgalmat mérni kell; ez nem korlátlan ingyenességi ígéret.

A megőrzött előzmény és az LLM-nek küldött kontextus külön kérdés. Válaszhoz friss üzenetablak, aktuális konyhai adatok és szükség esetén verziózott beszélgetés-kivonat vagy célzott előzménykeresés kell. A teljes archívumot nem küldjük minden kérésben. A privát chatből tanult személyes preferencia nem kerül automatikusan közös háztartási memóriába.

## Jogosultság és végrehajtás

Minden új táblán szerveroldali RLS és tényleges auth-azonosító alapú ellenőrzés szükséges. A háztartás tulajdonosa sem kap külön jogot más tag privát chatjének olvasására. Szálazonosító ismerete nem ad hozzáférést; listázás, üzenet, csatolmány és keresés ugyanazt a szabályt követi. Az API nem fogad el szabadon megadott `owner_id`-t.

A megosztás a tulajdonos külön művelete, a megosztott háztartás aktuális tagságát szerver ellenőrzi. Konyhaelhagyás/visszavonás után nincs új chatolvasás vagy signed URL; a kliens eltávolítja a már nem jogosult cache-t és bezárja a nézetet. Korábban letöltött tartalmat vagy képernyőképet nem lehet távolról visszavonni; a már kiadott kép-URL a rövid lejáratáig élhet.

A megosztott chat olvasása nem futtatja újra a korábbi AI-műveleteket. A készlet/lista módosításai továbbra is az aktuális konyhai jogosultságot, verziót és külön megerősítést igénylik. Régi megerősítésgomb másik készüléken nem válik új parancsengedéllyé; a műveletazonosító és a mentett végrehajtási státusz akadályozza az ismétlést.

Csatolt saját fotó privát bucketben marad. Megosztott szál olvasásakor csak a szál alapján jogosult tag kaphat rövid signed URL-t. Nyilvános receptkatalógusba chatfotó nem kerül át. Megosztott szál receptje/képe csak célzott hozzáférést kap; nincs publikus bucketbe másolás.

## Kompatibilis bevezetés

1. Új táblák, RLS, idempotens üzenetmentés és lapozott olvasás; privát fiókszintű sync adapter a meglévő helyi tároló mellé. Régi kliensek működnek, `morzsa-v1` és a companion-v1…v4 mentések megmaradnak.
2. A meglévő helyi előzmények importját egyszer felajánljuk a belépett tulajdonosnak. A nyelv/konyha szerinti kulcsokat külön forrásként feltérképezzük; importazonosító megakadályozza az ismételt import duplikációját. Azonos `morzsa-main` helyi ID önmagában nem globális azonosság. Tartalmi egyezés nem elég két külön főzés összevonásához. Régi kulcsokat nem törlünk.
3. Saját web/iPhone/Android sync, offline outbox és jogosultságváltás ellenőrzése. Új beszélgetések már automatikusan privát backend-mentést kapnak. Vendég mód helyi marad; nem létezik fiók nélküli készülékek közötti azonosság.
4. Explicit read-only háztartási megosztás, visszavonás és saját folytatás; képek és receptreferenciák hozzáférésének összekötése. Közös konyhába nincs automatikus előzményimport.
5. Később közösen írható chat, ha indokolt: szerzőjelölés, sorba rendezett fordulók, streamtulajdonos, AI-válasz-lease és művelet-jóváhagyó azonosító.

## Elfogadási ellenőrzés

- Ugyanazzal a fiókkal weben és mobilon ugyanazok a végleges üzenetek, receptverziók és archívum látszanak; nyelvváltás nem tüntet el chatet.
- Háztartástag és háztartás-admin sem listázhat privát szálat, még közvetlen REST-kéréssel sem.
- Megosztás csak a kiválasztott szálat teszi olvashatóvá; privát szülőchat, kapcsolódó más szál és személyes memória nem szivárog.
- Visszavonás, tag eltávolítása és fiókváltás után nincs új chat-/kép-hozzáférés.
- Helyi import ismétlése, offline retry és két eszköz appendje nem duplikál és nem veszít üzenetet.
- 61-nél több tárolt beszélgetés és 40-nél hosszabb receptes chat is megmarad a backendben, lapozva olvasható.
- Tokenstreamből nem lesz tokenenkénti adatbázisírás; csak végleges állapotváltások szinkronizálódnak.
- Régi AI-javaslat újranyitása, megosztása és importja nem hajt végre készlet-/listamódosítást.
- Kép-URL megújítása és chat újranyitása 0 provider-generálást indít.
- Törölt szálat offline kliens nem támaszt fel; a saját archiválás nem rejti el a szálat más tag elől.
