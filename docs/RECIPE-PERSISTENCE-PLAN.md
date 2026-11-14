# Receptek és képek tartós mentése

Tervezési állapot: 2026. november 14. Ez megvalósítási terv; az alábbi új recepttáblák még nem települtek.

## Döntés

A teljes elkészült receptet és a hozzá tartozó képeket tartósan mentsük. Új megnyitás, másik készülék, kedvencből indítás és ismételt főzés ne indítson új generálást. A recept új változatát csak érdemi módosítás vagy kifejezett kérés hozza létre. A recept ajánlhatósága, a hiányzó hozzávalók és a bevásárlási mennyiségek mindig az aktuális készletből számolódjanak.

Első körben személyes és konyhán belüli újrafelhasználás legyen. Külön háztartások között ne osszunk meg automatikusan privát receptet, fotót vagy beszélgetést. Később külön, önkéntes publikálással létrejöhet szerkesztett közös receptkatalógus.

## Mi működik most

- `recipe_image_jobs` és a privát `recipe-images` Storage bucket már tárolja a kész képeket. A cache kulcsa felhasználóhoz kötött, és figyelembe veszi a recept tartalmát, a lépést, a modellt és a kép-prompt verzióját.
- Az atomikus `claim_recipe_image` egy generálási lease-t ad: egyidejű kérések esetén ugyanaz a felhasználó ugyanazért a képért nem indít több hívást.
- A képhez rövid élettartamú, jelenleg kétórás aláírt URL készül. A link lejárata nem a kép törlése; új link kérhető új generálás nélkül.
- A Plus képgenerálás is ezt a tárolási folyamatot használja; cache-találatnál nincs új OpenAI-generálás vagy Plus-keretfoglalás.
- A fő chat receptjei, a receptbeszélgetések és főzési haladás főként a helyi workspace-ben vannak (`companion-model.js`, `companion-ui.js`). A régebbi `recipe_idea_cache` az ötletkérés külön, lejáró cache-e; nem tartós receptkönyv. A közös konyha eseménynaplója receptindítást és befejezést rögzít, teljes receptet nem.

A jelenlegi képcache nem teszi ugyanazt a képet automatikusan elérhetővé a pár másik fiókjának, és a helyi recepttárolás önmagában nem biztosít készülékek közötti helyreállítást.

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

Első szállításként az 1–2. fázis javasolt: készülékek közötti receptmentés és a meglévő képek stabil összekötése. Ez adja a leggyorsabban a megbízható visszatérést és a generálási költségcsökkenést.
