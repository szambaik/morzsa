# Morzsa Plus — szöveges válaszok késleltetése

A felhasználó a gépelt Plus-üzenet elküldését és a válasz megjelenését is lassúnak tapasztalta. A javítás az ab1ea37 main állapotra épül, a már összeolvasztott natív UI- és AI-beállítási változásokkal együtt. A kiadás előtt az újabb f71918c main állapot (receptképek helyreállítása navigáció és iOS-visszatérés után) is be lett olvasztva, majd a tesztek és a teljes release gate ismét lefutottak.

## Megtalált és javított késleltetések

1. A hálózaton már megérkezett szöveg mesterséges, karakterenkénti megjelenítése után a kész válasz akár további 6 másodpercig animálódott. A chat most a következő képkockán kiírja a teljes beérkezett szöveget, és a végleges választ nem animálja újra. A részleges szöveg továbbra sem menthető műveleti javaslatként.
2. A beszélgetés zárolása és az utolsó előzmények lekérése két egymást követő RPC volt. Az új begin_conversation_turn_page ugyanabban a tranzakcióban hívja a meglévő tulajdonosi zárolást és a conversation_page függvényt. A régi RPC-k és a 150 másodperces lease megmaradnak. Hiányzó új RPC esetén a kliens a régi szerződésre áll vissza; jogosultsági hiba vagy foglalt lock esetén nincs megkerülés.
3. A Plus előbb morzsa_plus_access-t, utána reserve_morzsa_plus-t hívott, miközben az utóbbi maga is ellenőrzi a jogosultságot és a limiteket. A chat most közvetlenül az atomi reservation checkre támaszkodik. A státusz-, kép- és hangfolyamat külön ellenőrzése megmarad.
4. A strukturált modellválasz a teljes begépelt kérdést újragenerálta transcript mezőként. Ez az OpenAI chat-sémából kimarad; a szerver az eredeti, validált szövegből állítja vissza a publikus válaszba. A kliensszerződés változatlan. Alapból egy receptet kérünk, kivéve kifejezett alternatívakérést vagy több receptes heti tervet.
5. Az engedélyezett origin CORS-előellenőrzése 10 percig cache-elhető. A tényleges kérések továbbra is végigmennek az origin-, auth- és jogosultságellenőrzésen.
6. A Plus auth- és providerútvonal megkapja a kliens megszakítását. Egy már elindult reservation írás eredményét megvárjuk, hogy egy későn megadott foglalást fel tudjunk szabadítani. Megszakítás után nem indul új modellhívás és nem keletkezhet kész javaslat.

A modell, a gondolkodási erősség és az output-tokenkeret nem változik. A fejlesztői útmutató alapján külön kell mérni a küldési előkészítést, az első látható szöveget és a teljes befejezést: [OpenAI latency optimization](https://developers.openai.com/api/docs/guides/latency-optimization).

## Mérési módszer és eredmények

A design-audit/plus-latency.mjs valódi böngészőt és helyi PostgreSQL/PGlite adatbázist használ, minden külső hálózati kérést blokkolva. A reduced-motion beállítás kifejezetten ki van kapcsolva, hogy az eredeti animációs késleltetés mérhető legyen. Az RPC-k 200 ms mesterséges késleltetést kapnak; az AI stream egy 1472 karakteres szövegrészt ad, majd 3,5 másodpercig nyitva marad. A szerverpróba az igazi Plus handlerrel fut, 120 ms-os szintetikus auth/DB- és 60 ms-os providerkésleltetéssel.

Az első összehasonlításban:

| Mérés | Előtte | Utána |
|---|---:|---:|
| Küldés → AI HTTP-kérés indítása | 636 ms | 432 ms |
| Beérkezett 1472 karakterből 450 ms után látszik | 110 | 1472 |
| Befejezett hálózati válasz után újabb animáció | igen | nincs |
| Plus handler → első szöveges előnézet | 436 ms | 311 ms |
| Plus handler teljes lefutása | 558 ms | 434 ms |

Ezek egy-egy szintetikus laborfutás adatai, nem éles OpenAI-latenciák vagy p95 értékek. A provider idejét a fixture adja; a számok az alkalmazás hozzáadott várakozásának változását mutatják. A CORS-cache hatását ez az azonos originű fixture nem méri. A nyers és végső ellenőrzési adatok az [evidence.json](plus-chat-latency-2026-11-17/evidence.json) fájlban és az ott hivatkozott helyi futáskönyvtárakban vannak.

## Ellenőrzés

339 JavaScript-teszt, 10 SQL-csomag, 9 Python-teszt és 26 audit-infrastruktúra teszt sikeres. A teljes release gate 32 axe-scant, 54 UX-ellenőrzést, 68 natív vezérlő- és 22 composer-ellenőrzést teljesített. A csomagolt web build külön böngészős ellenőrzése és a natív bundle összeállítása is sikeres.

A regressziók ellenőrzik a teljes beérkezett szöveg azonnali megjelenését; a régi és új lock közös viselkedését; a friss előzmény egyetlen RPC-ből történő átvételét; a hiányzó RPC-re visszaállást; a megosztott/idegen/anonim felhasználó elutasítását; a megszakított authot, a késői foglalást és a megszakított OpenAI-streamet. Az új migrációt kétszer alkalmazó SQL-teszt is fut.

A release gate része az új Plus-latenciateszt. A natív UI fájljaihoz nem tartozik módosítás; a natív böngészős tesztkiszolgáló ugyanazt az új RPC-t kapja meg, mint a többi szintetikus fixture.

Újrafuttatás a repository gyökerében:

~~~sh
npm test
python3 -m unittest discover -s tests -p 'test*.py'
npm --prefix design-audit test
node design-audit/check-release.mjs
node design-audit/plus-latency.mjs --check
node design-audit/performance/runner.mjs regression
npm run build:web
node design-audit/verify-web-build.mjs
npm run build:mobile
~~~

CI-ben MORZSA_AUDIT_BROWSER_CHANNEL=chromium választja a telepített böngészőt. A helyi alapérték izolált headless Chrome, személyes böngészőprofil használata nélkül.

## Kiadás és éles diagnosztika

A webes változtatás a kötelező audit után publikálható. A teljes gyorsításhoz az új 20261117_chat_turn_page.sql migráció és a plus-assistant Edge Function telepítése is szükséges. A migráció új függvényt ad hozzá, meglévő felhasználói rekordot, RLS-szabályt vagy régi RPC-t nem módosít. Egy régebbi natív kliens a régi RPC-ket használja tovább; a felületi gyorsításhoz új natív build kell.

A telepített Plus-függvény v15 forrása helyben le lett mentve összehasonlításhoz és visszaállításhoz. A chat-kódja megegyezett a mainnel; a behúzott képkezelő függőségei régebbiek voltak. Az új kiadás a main már tesztelt képkezelő függőségeit tartalmazza.

2026-11-17-én, külön felhasználói jóváhagyással élesítve lett az új RPC és a plus-assistant v16 a cbgcugshwivxpaurzyqq Supabase-projekten. A visszaolvasott SQL-definíció megfelel a migrációnak; az authenticated szerep futtathatja, az anon és PUBLIC szerep nem. A régi RPC-k változatlanok. Az Edge Function ACTIVE állapotú, és a letöltött 13 forrásfájl bájtról bájtra egyezik a helyi, tesztelt kóddal.

Az éles HTTP-ellenőrzésben a publikus GET 200, az OPTIONS 204 és 600 másodperces CORS-cache, a bejelentkezés nélküli POST 401, a tiltott origin 403 választ adott. A deployment ellenőrzése nem küldött modellkérést és nem módosított háztartási adatot. A verzió, forráshashek és HTTP-eredmények a [production-deployment.json](plus-chat-latency-2026-11-17/production-deployment.json) fájlban találhatók. A felületi változás a webes kiadással, telepített natív alkalmazásban új builddel válik elérhetővé.

Az új szervernaplók csak időzítést, modellnevet és token-darabszámokat tartalmaznak: morzsa_plus_chat_ready.preflightMs és morzsa_plus_text_timing.headersMs/firstTextMs/totalMs, valamint cachedInputTokens és reasoningTokens. Kérdés, válasz, fotó, hozzáférési token vagy felhasználóazonosító nem kerül ezekbe a naplókba. Így egy későbbi éles mintából elkülöníthető az alkalmazás várakozása a modell tényleges elsőszöveg-idejétől.
