# Ügyfélaudit javításai — 2026. november 16.

Az átadott teljes audit MORZSA-UX-001–011 pontjaihoz készült javítások, a chat-kezdőképernyőről adott új visszajelzéssel együtt. Az eredeti audit és a lefagyasztott snapshot változatlan. Ez a jegyzék a helyi implementációt és ellenőrzést dokumentálja; nem éles kiadási igazolás.

## A képernyőn jelzett probléma

- A beviteli mező alatti két régi példakérés kikerült. A mező és az alsó menü között nincsenek további példagombok.
- A három beszélgetésindító 64 px magas lett mobilon. A bemutatkozó illusztráció és a függőleges térközök kisebbek.
- A „Megvan még?” cím, „Mind megvan” és bezárás egy sorban jelenik meg. A fő érintési célok legalább 44 px méretűek maradnak, a mentés is.
- Az aktív főzés belépője a készletellenőrzés után következik, hogy ne tolja azt lejjebb.
- 390×844 nézetben mindhárom ellenőrzendő termék és a mentés látható. Keskenyebb/rövidebb nézetben a tartalom görgethető.

## Auditpontok és bizonyítékok

| Jegy | Implementáció | Ellenőrzés |
|---|---|---|
| 001 | A szál hozzáférése („Csak te látod” / „Megosztva: …” / csak olvasható) külön szerepel a mentési/szinkronállapottól. Az utóbbi többé nem mondja azt, hogy „Privát”. A nyitott adatvédelmi rész, keresés és fókusz háttérfrissítéskor is megmarad. | A/B valódi PGlite/RLS: privát szál nem látható B-nek, megosztva olvasható, visszavonás után reload mellett sem fér hozzá. HU/EN, mobil és asztali feliratok. |
| 002 | A hiányzók jóváhagyása megmutatja a receptigényt és a tényleges listás mennyiséget, a kerekítés/alapcsomag/meglévő mennyiség okával. A listán a receptigény látható, nem csak tooltip. | 3 adagos recept: 1,5 banán → 2 db; 1,5 tk olaj → vásárlási alapmennyiség; ismételt hozzáadás és második recept egységtesztben. A recipeNeeds változatlanul megmarad. |
| 003 | Kompakt tál, rövid képernyőn egysoros választás. A chatmező válogatáskor „Kérdezek Morzsától” gombra csukódik, a szövegpiszkozat megmarad. | 0/1/6 tétel, 320×640 / 360×500 / 390×844 / 430×844 / 1440×900; látható kereső és receptindítás; hatos korlát, keresés, eltávolítás, drag, chat-kérdés, visszatérés. Készlet/lista nem változik a választástól. |
| 004 | A tizedesvessző/pont elfogadott. 0,5 l → 500 ml és 0,25 kg → 250 g, a meglévő 1–999 közötti tárolási szerződéssel. Érthető hiba üres, nulla, negatív, túl nagy értéknél. | Valódi UI-mentés és reload, megvett állapot, jegyzet és receptkapcsolat megmarad. A SQL-szerződésekhez nem kellett módosítás. |
| 005 | A hangképernyő közepe önállóan görgethető, az alsó vezérlők külön helyen maradnak. Rövid kijelzőn kisebb gömb és térközök. | Kontrollált mikrofonhiba HU/EN, 320×500 / 360×500 / 390×844 / 430×844: nincs gombátfedés. Audio/WebRTC infrastruktúracsere nélkül. |
| 006 | A timer editor nyitottsága, beírt értéke és fókusza szálhoz és lépéshez kötve megmarad. | Gyökérok: teljes chat-render törölte a DOM-állapotot; a másodperces tick önmagában nem. Redraw, 30 mp várakozás, saját összecsukás, hibás érték, indítás/megállítás, lépésváltás ellenőrizve. Reload után szándékosan a csukott alapérték jelenik meg; a már futó timer perzisztenciája változatlan. |
| 007 | A lezárás „Elkészítetted: 3 adag. Alaprecept: 2 adag.” nyugtát ment a meglévő result mezőbe. A kártya „Elkészített recept” címkét kap, és nem örökli a korábbi tál kontextusát. | A lefagyasztott UI-val valódi katalógus-palacsintán reprodukálva az „A TÁLADBÓL · 0/1” hiba; jelenlegi UI-val helyes címke. Adagszám és nyugta reload után is helyes. A recept összetevői változatlanok. |
| 008 | Áttekintésen és üres főchatben egy aktuális folytatási kártya, a legutóbbi aktív főzéssel és lépéssel. Több folyamatnál belépő az előzményekhez. | Helyes 2/2. lépés, visszatérés másik nézetből, reload, új chat, lezárt recept kizárása. Nincs új fő navigációs célpont. |
| 009 | A zárás minden megmaradó terméket számol. „A maradék X terméket is megvettem”, külön magyarázattal a ki nem pipált saját emlékeztetőkről. | Katalógus / saját / vegyes / mind kipipált esetek; meglévő vásárlás-visszavonás és saját tételek megtartása regressziós tesztben. |
| 010 | Címhez kötött dialognevek a history, mennyiség, útvonal, készlet, bevitel, receptrészletek, konyha, ízlés és hangfelületeken. Fotó, history, ellenőrzés és receptkapcsolat megfelelő célmérettel. | Natív dialog névfeloldás, Tab / Shift+Tab / Escape, history-fókusz visszatérése, mobil méretmérés. Ez nem helyettesít teljes képernyőolvasós auditot. |
| 011 | A tárolt egységkódok változatlanok, csak a címke lokalizált: pcs, pack, box, bottle, cup, tsp/tbsp. | HU↔EN nyelvváltás megőrzött mennyiséggel, szerkesztő, lista és receptigény; ismeretlen címkéhez biztonságos fallback. |

Az első használat külön kapujánál további hibát javítottunk: az érvényes bejelentkezés önmagában többé nem nyomja el a bemutatót, ha nincs korábbi helyi használat. A teszt a fixture „intro kész” előbeállítását kivette: nyelvválasztás és kihagyás megőrzése ellenőrizve.

## Futtatott ellenőrzések

- npm test: **279/279** egységteszt, **9 SQL-csomag** sikeres.
- Új böngészőtesztek: controls **101**, cooking **27**, sharing **32**, layout **36** sikeres állítás; külön provenance próba a régi és új változattal.
- Meglévő regressziós tesztek: audit-actions **35**, pantry-start **101**, chat-crafting **111** sikeres állítás.
- npm run build:web, npm run sync:frontend: web és natív frontendcsomag. Nem Xcode/Android bináris build.
- git diff --check.

Tesztkód: tests/customer-audit-*.browser.js, tests/quantity-model.test.cjs.
Géppel olvasható eredmény és képek: design/customer-audit-fixes-2026-11-16/.
A böngészős tesztekhez a tests/persistence-fixture.mjs futott helyben, 8850-es porton; a snapshot-összehasonlítás és külön layout próba 8892-n. A snapshot-összehasonlításhoz a lefagyasztott companion-ui.js másolata a tmp/audit-before-companion.js fájl. A snapshot eredetije nem módosult.

## Továbbra is külön ellenőrzést igényel

- **QA-SHARED:** a conversation és recipe fixture valódi SQL/RLS-t futtat; a készlet/lista UI-fixture bizonyos RPC-i stubok. A SQL-csomagok szerződés- és konkurenciatesztjei sikeresek, de ebből nem állítunk teljes éles A→B készletszinkron-próbát.
- **QA-LIVE-SERVICES:** ezekhez a javításokhoz nem történt fizetős AI/hanghívás, valódi meghívás vagy éles hitelesítési próba. A mesterséges tesztválasz nem bizonyítja az AI válaszminőségét.
- **QA-DEVICE-A11Y:** Chromiumos viewport-emuláció, nem fizikai iPhone/Safari vagy VoiceOver/TalkBack. Valódi mikrofonengedély, dinamikus rendszerbetű és fizikai safe area külön tesztelendő.
- A 30 mp-es timerpróba és teljes render mellett nem állítunk minden hálózati időzítésre külön tesztet. A hiba közös DOM-újrarenderelési oka javítva.
- Régebbi lezárási nyugtához, amely nem mentett tényleges adagszámot, nem találunk ki utólag adatot.

Éles közzététel ebben a körben nem történt.
