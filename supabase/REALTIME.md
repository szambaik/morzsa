# Közös háztartás – élő frissítések

A 20261030_household_realtime.sql a meglévő household_records táblát adja a Supabase Realtime publicationhöz. A korábbi RLS, rekordformátumok és verzióellenőrzött írások változatlanok maradnak.

A household-live.js a Supabase dokumentált Realtime WebSocket protokolljával, a bejelentkezett felhasználó tokenjével, az aktuális háztartás szűrőjére iratkozik fel. A kapott esemény csak ébresztés: a kliens a meglévő RLS-védett REST útvonalon olvassa újra az adatokat, és rövid visszajelzést ad a változásokról. Nem az eseményből ír közvetlenül a helyi készletbe.

- Normál használatkor rövid (350 ms) összevonás után frissít.
- Nyitott beviteli mező, dialógus vagy saját folyamatban lévő mentés közben vár, hogy ne vesszen el a felhasználó munkája.
- Háttérből visszatérve és hálózat helyreállásakor újra ellenőriz.
- WebSocket-hiba esetén a korábbi 8 másodperces lekérdezés tovább működik. A kapcsolat fokozatos visszalépéssel újrapróbálkozik.
- Háztartásváltás és kijelentkezés bezárja a korábbi előfizetést; tokenfrissítéskor az élő kapcsolat is megkapja az új tokent.
- A visszajelzés a változott terméket és állapotot mutatja, nem állítja bizonyíték nélkül, hogy konkrét személy módosította.

Forrás: https://supabase.com/docs/guides/realtime/protocol
