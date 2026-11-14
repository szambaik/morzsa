# Tartós receptkönyv és személyre szabott receptfeed

Tervezési állapot: 2026. november 14. Ez megvalósítási terv; az alábbi új recepttáblák még nem települtek.

## Döntés

A teljes elkészült receptet és a hozzá tartozó képeket tartósan mentsük. Új megnyitás, másik készülék, kedvencből indítás és ismételt főzés ne indítson új generálást. A recept új változatát csak érdemi módosítás vagy kifejezett kérés hozza létre. A recept ajánlhatósága, a hiányzó hozzávalók és a bevásárlási mennyiségek mindig az aktuális készletből számolódjanak.

A Receptek alapját egy központi, böngészhető, szerkesztett receptkatalógus adja, nem csak a felhasználó korábbi chatjei. Emellett megmarad a személyes és konyhán belüli receptkönyv. Külön háztartások között ne osszunk meg automatikusan privát receptet, fotót vagy beszélgetést; a közös katalógusba csak külön jóváhagyott tartalom kerül.

## Mi működik most

- `recipe_image_jobs` és a privát `recipe-images` Storage bucket már tárolja a kész képeket. A cache kulcsa felhasználóhoz kötött, és figyelembe veszi a recept tartalmát, a lépést, a modellt és a kép-prompt verzióját.
- Az atomikus `claim_recipe_image` egy generálási lease-t ad: egyidejű kérések esetén ugyanaz a felhasználó ugyanazért a képért nem indít több hívást.
- A képhez rövid élettartamú, jelenleg kétórás aláírt URL készül. A link lejárata nem a kép törlése; új link kérhető új generálás nélkül.
- A Plus képgenerálás is ezt a tárolási folyamatot használja; cache-találatnál nincs új OpenAI-generálás vagy Plus-keretfoglalás.
- A fő chat receptjei, a receptbeszélgetések és főzési haladás főként a helyi workspace-ben vannak (`companion-model.js`, `companion-ui.js`). A régebbi `recipe_idea_cache` az ötletkérés külön, lejáró cache-e; nem tartós receptkönyv. A közös konyha eseménynaplója receptindítást és befejezést rögzít, teljes receptet nem.

A jelenlegi képcache nem teszi ugyanazt a képet automatikusan elérhetővé a pár másik fiókjának, és a helyi recepttárolás önmagában nem biztosít készülékek közötti helyreállítást.

## Böngészhető induló katalógus

Első változat: a meglévő hét Morzsa-recept backendről olvasható seedként, majd 50–100 ellenőrzött, változatos alaprecept. Gyors vacsorák, egyszerű sütemények, vegetáriánus, családi és szezonális fogások. A bővítés egyszeri, költségkorlátos batch és ellenőrzés; a látogatók nem generáltatnak újra recepteket a feed megnyitásával. Külső receptoldalak másolása nem része a tervnek.

A szerkesztett katalógus bejelentkezés nélkül is olvasható. Publikus, jóváhagyott receptek és képek külön hozzáférést kapnak; személyes és közös konyhai receptek továbbra is privátak. A privát recept mentése nem publikálás. A katalógus írása/publikálása szerveroldali adminfeladat, a frontend csak olvas.

Additív metadata: publication_status (draft/published/withdrawn), címkék, stabil published_version_id és publikálási idő. Egy célzott, RLS-sel védett published_recipe_feed csak az azonosítót, címet, időt, adagot, címkéket, thumbnailt és fix receptverziót adja vissza. A teljes hozzávaló-/lépéslista csak megnyitáskor töltődik be. A privát tulajdonosi és chatadatok nem részei ennek az olvasási felületnek.

A kártya, a megnyitott recept és a főzési session ugyanarra a változatlan receptverzióra hivatkozik. Új megnyitáskor a cím, borítókép, hozzávalók és lépések azonosak. Egy kért helyettesítés/adagváltozat külön személyes vagy konyhai változat, nem írja át a katalógusreceptet vagy mások főzését.

## A Receptek felülete és a feed sorrendje

A meglévő Receptek menün belül három egyszerű nézet javasolt:

- **Neked:** az alapértelmezett receptfeed, az első használatkor is valódi tartalommal.
- **Böngészés:** keresés és néhány érthető szűrő, például gyors, édes, vegetáriánus, szezonális.
- **Saját receptek:** mentett, kedvenc, elkezdett és megfőzött receptek; a jelenlegi receptbeszélgetések megmaradnak.

A feed nem hív LLM-et minden betöltéskor. Először a megadott étkezési és kerülendő-összetevő preferenciák szűrnek, majd az otthoni alapanyagok, időkeret, kedvencek, megfőzött fogások és évszak rendeznek. A megnyitás gyenge jel; a kedvenc és a megfőzés erősebb. Kiindulásként kb. 70% ismerős, jól illeszkedő fogás, 30% megkötéseken belüli új ötlet. Ez hangolható termékhipotézis, nem már megtanult ajánló.

A sorrend egy böngészési alkalmon belül stabil maradjon: görgetéskor/visszalépéskor ne ugráljanak a kártyák. Lapozás, limitált oldalankénti elemszám és thumbnail lazy loading szükséges. Új felhasználónál a változatos induló sorrend működik, hosszú ízléskérdőív nélkül. A chat a katalógusból is ajánlhat, csak valóban új igénynél készít új receptet.

## Olcsó kép- és receptkiszolgálás

Kezdetben a már használt Supabase Postgres és Storage marad. A recept strukturált JSON és kereshető metadata a DB-ben; a kép fájl a Storage-ban, a DB-ben csak azonosító, útvonal, méret, hash és verzió. Ne tároljunk base64 képet vagy lejáró signed URL-t a tartós recept tartalmaként.

- A publikus katalógus saját recipe-catalog bucketet kap, adminfeltöltéssel. A jóváhagyott borító és thumbnail tartalmi hash-t tartalmazó, változatlan URL-en CDN/browser cache-ből kiszolgálható. Privát képet nem teszünk automatikusan publikussá.
- A személyes/konyhai kép a privát recipe-images tárolóban marad. Stabil artifactazonosító alapján friss signed URL kérhető; a link lejárta nem új képgenerálás.
- A borító egyszer készül. Kártyán kicsi thumbnail, nagyobb kép csak receptmegnyitáskor. Lépéskép csak a vizuálisan indokolt lépésekhez; a feed nem generáltat lépésképeket.
- Publikus katalóguskép minden olvasónak ugyanaz a fájl. Konyhai képek a jogosult tagok között újrafelhasználhatók; a jelenlegi felhasználónkénti képcache ehhez külön, kompatibilis bővítést igényel.
- Új képverzió kifejezett, költséges művelet. Modell-, nyelv-, kedvenc- vagy feed-sorrend-változás nem cseréli ki automatikusan a mentett képet.

Szemléltető kapacitás: 1000 recept × (180 KB borító + 30 KB thumbnail + átlagosan 2 × 120 KB lépéskép) ≈ **450 MB kép**, plusz körülbelül **10 MB receptszöveg**, ha egy recept átlagosan 10 KB. Ezek célméretek és feltételezések; WebP/AVIF export és tényleges mérés kell. A szolgáltatói díj, csomagkeret és adatforgalom külön kérdés. A nagyobb költség jellemzően a generálás, ezért jóváhagyott batch és költséglimit kell a katalógus bővítéséhez.

Az adatforgalmat mérjük: thumbnail, lazy loading, lapozás és hosszú HTTP cache a publikus változatlan képeknél. Ha később indokolt, a publikus assetek Cloudflare R2/CDN-re áttehetők egy asset-provider adapterrel. A stabil recept-/assetazonosító miatt ez ne változtassa meg a kliens receptadatait. Kezdetben nem szükséges két Storage rendszert fenntartani.

## Adatmodell

| Új entitás | Tartalom és feladat |
|---|---|
| `recipes` | Stabil receptazonosító; személyes tulajdonos vagy konyha; cím; aktuális verzió; létrehozó; archiválás/törlés állapota. |
| `recipe_versions` | Változatlan, validált teljes recept: adagok, hozzávalók és mennyiségek, elnevezett/kifejtett lépések, idők, képet igénylő lépések; tartalmi hash; nyelv; modell és séma/prompt verzió. |
| `recipe_library_entries` | Konyhánként/felhasználónként kedvenc, mentett/elkezdett/elkészült állapot; hivatkozás az adott receptverzióra. |
| `cooking_sessions` | Egy főzés: receptverzió, felhasználó/konyha, aktuális lépés, befejezett lépések, kezdés/befejezés, opcionális visszajelzés; optimistic concurrency verzió. |
| `recipe_assets` | Stabil képazonosító, Storage útvonal, SHA-256, MIME/méret, borító vagy stabil lépésazonosító; hozzáférési scope; provider/modell/quality/prompt verzió. |
| `recipe_asset_jobs` | `pending/ready/failed`, egyedi generálási kulcs, lease és lejárat, próbálkozások, hibaosztály; egyetlen aktív generálás. |

A recept immutable verziójára hivatkozunk főzés és export közben. Egy újragenerált recept nem írja át a már folyamatban lévő főzés lépéseit. Ugyanazt a receptet kétszer elkészítve két főzési esemény keletkezik. A chat és a recept kapcsolódhat, de a recept megnyitásához nem kell a teljes beszélgetést betölteni.

## Mentés és visszatérés

1. A chat szövege továbbra is streamel. Csak a végleges, validált receptet mentjük idempotens kliensazonosítóval; részleges választ nem teszünk a könyvtárba.
2. A „Főzzük meg” biztosítja a recept mentését, és létrehoz/folytat egy főzési sessiont. Minden elkezdett recept bekerül a Receptekbe, a kedvenc külön kapcsoló.
3. A borító egy aszinkron job; a recept rögtön olvasható. Releváns lépéskép a lépés megközelítésekor készül, legfeljebb egy következő lépést előkészítve. Nem generálunk minden kártyához minden lépésképet a listanézet megnyitásakor.
4. Újranyitáskor a receptverzió és képreferenciák töltődnek be, friss signed URL-lel. A lépések és hozzávalók már AI-hívás nélkül használhatók.
5. A készletjelölések és „Hiányzók a listára” az aktuális állapotból számolódnak, a meglévő verzióellenőrzött listamentésen keresztül. Régi recept megnyitása nem ismétel meg korábbi módosítást.
6. Offline helyi másolatból olvasunk; az outbox stabil azonosítókkal küldi a későbbi mentést. Szinkronhiba látható, a használható helyi recept megmarad.

## Cache-kulcs és újrafelhasználás

Képgenerálási kulcs: `SHA256(scope + visualRecipeHash + stableStepId/cover + provider + model + promptVersion + quality + size + format)`. A minőség és a felbontás is része legyen, mert egy fizetős kép nem helyettesíthető észrevétlenül egy ingyenes változattal. A teljes recept verzióját külön tároljuk; adagváltás önmagában ugyanazt a vizuális képet használhatja, ha a fogás megjelenése nem változik.

- Ugyanaz a recept és lépés ugyanabban a konyhában: egy kép, több engedélyezett olvasó.
- A Free és Plus képváltozat külön artifact; a már mentett Plus kép olvasását nem kötjük új generálási kerethez.
- Recept átnevezése, kedvenc vagy főzési haladás nem generál új képet. Más hozzávaló/technika külön verzió és szükség esetén új kép.
- Explicit „Új képet kérek” új változatot és költséget jelent; nem felülírás.
- Lejárt link, átmeneti letöltési hiba és modellváltás nem törli a korábban mentett képet. Előbb a meglévő artifactot kérjük le.
- A job lease megújítható, lejárat után visszavehető; elveszett klienskapcsolat ne indítson automatikusan második fizetős generálást.
- A „van még más ötlet?” valóban új ajánlást kapjon. Ne cache-eljünk teljes chatválaszt vagy háztartási műveletet pusztán hasonló kérdés alapján.

## Hozzáférés és élettartam

RLS minden új táblán, privát Storage. A személyes recept a tulajdonosé; a közös recepthez a jelenlegi konyhatagság szükséges. A kliens nem választ szabadon tulajdonost/scope-ot. Konyhaelhagyás után nincs új olvasás vagy signed URL; egy már kiadott link legfeljebb annak rövid lejártáig élhet. Az új rendszerben 15–60 perces linkek és automatikus megújítás javasolt.

A konyhába helyezés/másolás explicit művelet. Privát chatből származó személyes adatot vagy feltöltött fotót nem másolunk át a recepttel együtt. A receptváltozat átadja a szükséges főzési adatot; a beszélgetés külön marad.

Mentett, elkezdett és kedvenc recept, valamint a kapcsolódó képe ne járjon le automatikusan. Ideiglenes, el nem mentett generálások 30 nap után takaríthatók; hiba/job metadata rövidebb megőrzéssel. Törléskor csak hivatkozás nélkül maradt artifactot távolítunk el. Közös receptet személyes könyvtárból eltávolítva nem töröljük a többiek példányát.

## Kompatibilis bevezetés

1. **Tartós receptkönyv:** additív SQL + RLS + idempotens mentés/olvasás. A jelenlegi helyi struktúra és `morzsa-v1` fallback marad; új opcionális `recipeId/versionId` mezők. Bejelentkezésnél felajánlott, ismételhető helyi import, automatikus közös konyhai import nélkül.
2. **Képreferenciák:** a jelenlegi `recipe_image_jobs` működik a régi klienseknek. Új artifacttábla és kompatibilis endpoint; az elérhető régi képet újragenerálás nélkül regisztráljuk. Későbbi prompt/modell változás mellett is megmarad a régi referenciája.
3. **Konyhán belüli képfelhasználás és haladás:** jogosultságellenőrzés, per-session változat, realtime frissítés, konfliktuskezelés és offline outbox.
4. **Ajánlás és memória:** előbb a meglévő könyvtárból keresünk a preferenciák, közelmúlt, szezon és aktuális készlet alapján; ha kell, az AI új ötletet/változatot készít. A kedvenc/elkészített jel erősebb, mint egy véletlenül megnyitott kártya. Új ötleteknek marad hely.

## Költség és mérés

A generálás megtakarítása lényegesen fontosabb, mint a kis JSON tárolási díja. A tárolás és adatforgalom viszont nem korlátlanul ingyenes. Például 1000 recept × 3 kép × 300 KB ≈ **0,9 GB**, a tényleges képméret alapján kell kapacitást tervezni. Nagy képet csak főzésnél töltsünk; könyvtárba külön kisebb thumbnail.

Ha egy kép generálási ára `C`, ugyanazt `N` alkalommal nyitják meg, akkor az újrageneráláshoz képest a megtakarítás megközelítőleg `(N−1) × C`, mínusz tárolás és kiszolgálás. Példa: $0,05/kép és tíz megnyitás mellett $0,45/kép megtakarítás; ez szemléltető feltételezés, nem a jelenlegi modell ellenőrzött ára.

Mérjük: cache-találati arány, első/sokadik megnyitás ideje, generálások száma receptenként, tényleges provider usage, Storage méret/egress, sikertelen és beragadt jobok, offline/sync hibák. Cél: mentett recept újranyitásakor **0 text- és 0 image-generálás**, változatlan képre párhuzamos kéréseknél **1 provider-hívás**.

## Elfogadási ellenőrzés

- Régi helyi recept betöltése és ismételt import nem duplikál, nem veszít adatot.
- Másik készülék ugyanazt a receptet és saját főzési haladást helyreállítja.
- Két konyhatag egyidejű képkérése egy generálást indít.
- Lejárt signed URL frissül provider-generálás nélkül.
- Jogosulatlan user/konyha sem metadata-, sem kép-hozzáférést nem kap.
- Új receptverzió nem változtatja meg az aktív főzést.
- Free/Plus váltás, keretkimerülés vagy providerhiba mellett a mentett recept olvasható.
- Export és megosztás stabil receptverzióból készül; megosztás külön felhasználói döntés.

Első szállításként a publikus induló katalógus és az 1–2. fázis javasolt: készülékek közötti receptmentés és a meglévő képek stabil összekötése. Ez adja a leggyorsabban a megbízható visszatérést és a generálási költségcsökkenést.
