# Appon belüli receptajánló – bekötési útmutató

A promptválasztók már használhatók a külső AI-knál. A beépített ajánló kódja elkészült, de API-kulcs és Supabase-telepítés nélkül még nem működik. A frontend felismeri a bekötést; később nem kell külön átírni a webappot.

## 1. Ingyenes Gemini API-kulcs

1. Nyisd meg: https://aistudio.google.com/api-keys
2. Jelentkezz be, majd **Create API key**. Hozz létre vagy válassz egy külön Google Cloud projektet a Morzsának.
3. Ingyenes használathoz maradj **Free tier** besorolásnál, ne kapcsolj fizetős számlázást a projekthez. Egy már fizetős projekt kulcsa nem garantál ingyenes hívásokat.
4. Másold ki a kulcsot a következő lépéshez. Ne tedd chatbe, GitHubra vagy frontendfájlba.

Alapmodell: **gemini-3.1-flash-lite**. A 2026-10-29-én ellenőrzött Google-díjszabás ingyenes szöveges bemenetet és kimenetet jelöl a Free tierben. Ez kvótás szolgáltatás, nem korlátlan vagy garantáltan mindig elérhető API. A projekt aktuális kvótája az AI Studióban látható.

A Google díjszabása az ingyenes szintnél termékfejlesztési adatfelhasználást is jelez; ellenőrizd a régiódra vonatkozó aktuális feltételeket. A Morzsa hozzávalóneveket, nyelvet és ételpreferenciát küld, emailt és korábbi beszélgetést nem.

Források: https://ai.google.dev/gemini-api/docs/pricing és https://ai.google.dev/gemini-api/docs/rate-limits

## 2. Kulcs a Supabase-ben

A **cbgcugshwivxpaurzyqq** projektben: **Edge Functions → Secrets**. Új secret:

- Name: `GEMINI_API_KEY`
- Value: az AI Studióból kimásolt kulcs

Opcionális: `GEMINI_MODEL=gemini-3.1-flash-lite` (ez az alapérték). A többi szerveroldali kulcs a Supabase automatikus Edge Function környezeti változóiból jön. Service-role kulcsot soha ne másolj a webappba.

## 3. Cache és napi korlát

**SQL Editor → New query**: másold be és futtasd a `migrations/20261029_recipe_ideas.sql` teljes tartalmát. Újrafuttatható, két új táblát és egy új függvényt hoz létre; a meglévő háztartási adatokat nem módosítja.

Korlát: felhasználónként napi 10, az app egészében napi 100 új generálás (UTC-nap szerint). A Google kvótája ettől függetlenül szigorúbb lehet. A 24 órás cache azonos felhasználó + normalizált készlet + nyelv + preferencia + modell esetén megspórolja az új hívást. A hibás szolgáltatói próbálkozás is fogyaszthat kvótaegységet.

## 4. A függvény feltöltése

Terminálban a repository `konyha-app` könyvtárából:

```sh
npx supabase login
npx supabase functions deploy recipe-ideas --project-ref cbgcugshwivxpaurzyqq
```

A Supabase bejelentkezési tokent csak a CLI-nek add meg. A repó `supabase/config.toml` fájljában `verify_jwt=false` szerepel: a GET/OPTIONS publikus, de minden POST modellhívás a függvényen belül ellenőrzi a felhasználói tokent a Supabase `/auth/v1/user` végpontján.

Források: `functions/recipe-ideas/index.ts` és `functions/recipe-ideas/handler.mjs`. A GitHub Pages publikálás ezeket nem telepíti Supabase-re.

## 5. Próba

1. Jelentkezz be a Morzsába, jelölj otthonra néhány élelmiszert.
2. Ötletek → **Újraellenőrzés**, ha még a régi elérhetőségi állapot látszik.
3. Például **Gyors + Édes** → **Kérek 3 ötletet**.
4. A három kinyitható AI-receptben hozzávalók, mennyiségek és rövid lépések jelennek meg. Az app összeveti a hozzávalóneveket az aktuális készlettel.

Csak a ténylegesen visszaérkező, ellenőrzött válasz igazolja az élő bekötést. Hibás vagy időközben más készlethez tartozó választ nem jelenítünk meg új ajánlatként.

Ha a gomb inaktív: ellenőrizd a készletet, a deployt és a secret nevét. „Bekötése még nincs kész”: jellemzően a SQL-migráció hiányzik. „Mai keret elfogyott”: a Morzsa vagy a Google kvótája telt be. Egyéb hiba: Supabase Edge Function logok; az app nem jelenít meg nyers szolgáltatói hibát vagy kulcsot.

Helyi teszthez opcionális secret: `RECIPE_AI_ORIGINS=https://szambaik.github.io,http://localhost:8770`.

## Működési határok

A szerver a kliens által beküldött élelmiszerlistából dolgozik, nem olvas más háztartási táblákból. A cache felhasználónként elkülönül. A beépített ajánló nem állítja, hogy az otthoni mennyiség elegendő vagy az alapanyag friss; a recepteket érdemes ellenőrizni. A pontos névegyezésen alapuló hiányjelölés szinonimák esetén konzervatív lehet.
