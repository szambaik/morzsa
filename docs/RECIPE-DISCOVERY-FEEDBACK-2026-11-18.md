# Receptötletek, variációk és főzési visszajelzés

A nyitott receptkérés alapértelmezésben három különböző, teljes ötletet kér.
Az **Új ötlet** megtartja az eredeti igényeket és a választott finomításokat,
és kizárja a legutóbbi javaslatok címét. Ha kevesebb megfelelő alternatíva
lehetséges, az asszisztens röviden indokolhatja ezt. Kifejezetten egy ételre
vagy egy változatra irányuló kérés továbbra is egy receptet kér.

A receptkártyán és a recept részleteiben gyorsabb, olcsóbb, egészségesebb
és prémium változat kérhető. A változat külön beszélgetésben készül, az
eredeti recept és főzési menet megőrzésével. A kiválasztott adagszám, az
eredeti igények és a későbbi pontosítások bekerülnek a kérésbe. A
**Finomítanék** alatt kevesebb mosogatás, olcsóbb és több zöldség választható.

A készletből az **Ebből főzzünk valamit** megnyitja a meglévő
alapanyagválasztó tálat az adott hozzávalóval. Több alapanyag és egyedi
termék is kiválasztható. A receptötletek kérése nem írja át a készletet vagy
a listát. A kártyák a tényleges állapotból jelzik az otthon megjelölt, kevés,
hiányzó és ellenőrizendő hozzávalókat; a jelenlét nem bizonyít elegendő
mennyiséget.

A befejezett főzésből az **Újra megfőzöm** új előkészítést nyit a korábbi
adagszámmal. A régi menet és értékelés megmarad; ismételt indítás meglévő
aktív menetet folytat. Az opcionális **Finom volt**, **Túl sokáig tartott**,
**Több fűszer kellene** jelzések és a jegyzetek mentés után a későbbi
ajánlások kontextusába kerülnek. Az AI csak a felhasználó saját, befejezett
meneteinek legutóbbi nyolc visszajelzését kapja, legfeljebb 300 karakteres
jegyzettel. A háztartásból csak olvasható módon megosztott menetek nem
kerülnek ebbe a személyes kontextusba.

## Adatok és kompatibilitás

Nincs új SQL-migráció vagy RPC. A `recipeDiscovery` opcionális, 1-es
verziójú beszélgetési metaadat: eredeti kérés, finomítások, legfeljebb hat
későbbi pontosítás, valamint opcionális forrásrecept és variáció. A
visszajelzés a meglévő `cooking.feedback` mezőhöz ad `signals` és `savedAt`
adatokat. A régi mentések új mezők nélkül is betöltődnek; hibás új metaadat
elhagyható a beszélgetés és egyéb adatok megőrzésével. A `morzsa-v1`
visszaállítási útvonal változatlan.

A meglévő verzióellenőrzött beszélgetésszinkron menti az új mezőket.
A visszajelzések összevezetése mezőnként megőrzi a független módosításokat;
a jelzések független hozzáadása és eltávolítása is összevezethető.

## Ellenőrzés és kiadás

Az új Node-tesztek ellenőrzik a régi mentéseket, a metaadatok körútját, az
újrafőzést, a konkurens visszajelzéseket, a szolgáltatói bemeneteket, a
duplikált ötletek szűrését és a generálási vezérlők művelettilalmát.
A `design-audit/recipe-discovery.mjs` szintetikus SQL-adatokkal teszteli a
teljes felületi folyamatokat és a mobil szélességeket. Külső forgalmat blokkol,
fizetős AI-t és éles háztartási adatot nem használ. A kiadási kapu ezt is futtatja.

Élesítéskor a frontend mellett a `voice-command`, `plus-assistant` és
`recipe-ideas` Edge Function frissítése szükséges, az új gyökérszintű
`recipe-discovery.js` függőséggel. A változatok új receptként használják a
meglévő backend képtárat; a forrásrecept képe és azonosítója megmarad.
A tesztelt webes vagy natív bundle elkészítése önmagában nem élesítés.
