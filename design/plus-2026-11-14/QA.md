# Morzsa Plus és Lista · ellenőrzés

2026. november 14. A Free útvonal megmarad; Plus az alapértelmezett AI-választás.

## Élő integráció

Külön, rövid életű tesztfiókkal, üres készlet/lista kontextussal, valós felhasználói állapot módosítása nélkül.

- Plus státusz és hozzáférés: HTTP 200.
- OpenAI szöveg: HTTP 200; több `answer` stream-esemény, majd validált `done` eredmény. Korábbi próbák providerhibát adtak; a sikeres próba nem garantál hibamentes szolgáltatást.
- OpenAI kép: HTTP 200, JPEG 159757 byte, 8575 ms. Mentett Storage objektum betöltött; ismételt cache-only kérés `ready`, új generálás nélkül. Ez képszállítási próba; a fotó recept-/technikapontossága további termékellenőrzést igényel.
- Realtime: valódi SDP-csere HTTP 200, WebRTC `connected`, adatcsatorna `open`. Valódi `response.output_audio_transcript.delta`, audioindítás/-befejezés és `response.done: completed` események. Explicit bontás után peer/audio bezárva. Mesterséges néma audioforrás, nem emberi mikrofon.
- Beszédfelismerés, barge-in és natív háttérviselkedés felhasználói készülékes próbája még szükséges. Hívásonként 110 másodperces szerverkorlát.

## Felület és biztonság

- Playwright HU/EN, 320/390/1366 px; nincs vízszintes overflow vagy JS-hiba.
- Lista vásárlási gomb 44×44 px; javított normál lista grid: 44 px első oszlop, 10 px rés a terméknévig.
- Normál lista és Shopping Mode ugyanazt a sorrenderelőt használja. Megvásárolt tétel külön szakaszban, showAll mellett is egyszer. Név/mennyiség ugyanazt a szerkesztőt nyitja.
- Mock Realtime eszközpróba: javaslat nem ment ugyanabban a beszédfordulóban; külön megerősítés ment, duplikált confirm nem ismétli meg. Hívás lezárása leállítja a trackeket. Ez kliensbiztonsági próba, nem élő beszédfelismerési eredmény.
- Plus backend auth, konyhatagság, privát jogosultság/keret, atomikus requestId-foglalás és meglévő privát képlease.

## Automatizált ellenőrzések

- Teljes JS tesztfutás: 205 teszt; SQL: 8 suite; Python: 8 teszt sikeres.
- Providerhibák legutóbbi módosítása után célzott Plus/kép/stream tesztek sikeresek.
- Web bundle és Capacitor Android/iOS sync sikeres. Ez nem natív készülékes audio- vagy store-kiadási próba.
- `git diff --check` sikeres.

A receptbackend új táblái külön [terv](../../docs/RECIPE-PERSISTENCE-PLAN.md), ebben a kiadásban még nem implementáltak. Valós előfizetés/payment nincs; pilot jogosultság admin-granttel adható.
