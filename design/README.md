# Morzsa – vizuális irány, 2026-10-30

## Aktuális irány, 2026-11-12

A felhasználó az első Kitchen Companion koncepciót választotta, a harmadik
Soft Glass meleg gradiensével. Az aktuális döntések és a megvalósítás:
[Kitchen Companion](kitchen-companion-2026-11-12/README.md).
Menüsorrend: Áttekintés, Készlet, Morzsa, Lista, Receptek; a középső Morzsa az
induló nézet. A későbbi döntések felülírják az alábbi korábbi indulóképernyő-leírásokat.

A felhasználó által átadott [design board](morzsa-design-board.png) az arculat forrása.

## Átvett elemek

- Cream #F8F3E9, Sage #E8EDDE, Forest #344638, Terracotta #BF4E2C, Wheat #D9AD76.
- Sora címek és márkanév; Inter felületi szövegek.
- Kerekített, finoman keretezett kártyák; zsálya háttér az otthon lévő termékeken.
- A meglévő, felhasználóval generált termékillusztrációk maradnak. A kabala a megadott board bal alsó, kanalas figurájából készült kivágás, háttéreltávolítással. A kis eredeti felbontás miatt 90 CSS px körül használjuk.
- Kompakt üdvözlő/összefoglaló, kategóriaikonok, tényleges aktív menü jelölése.

## Tudatos alkalmazás a működő termékre

Ez a board bevezetése a meglévő alkalmazásba, nem a rajta szereplő fiktív adatok másolata. A készlet továbbra is jelenlétet tárol: nem vezetünk be mennyiségeket vagy lejáratokat, és nem állítunk elő kitalált lejárati jelzéseket. A lista mennyiségei megmaradnak.

Mobilon három oszlop és kategóriánkénti csoportosítás segíti a felismerést és az érintést; a board négyszer négyes sűrű mintája helyett ez a korábban egyeztetett termékműködés. A teljes katalógus továbbra is elérhető, a Van otthon nézet kategóriasávja csak az otthon jelölt termékek kategóriáit tartalmazza.

Az alsó navigációban kizárólag az aktuális menü kap kiemelést, egységes stílussal. A mikrofon egy érintésre indítja a felvételt; a hangbevitel és a kompakt ellenőrző nézet alsó paneljén a beküldés és a mentés kézzel elérhető.

## Áttekintés és könnyebb készlet, 2026-11-09

Az Ötletek helyét az Áttekintés veszi át (a belső recipes útvonal megmarad).
Két élő számláló vezet a készlethez és a listához, külön belépő a jelenlét
ellenőrzéséhez, szöveges/hangos asszisztens és legfeljebb két kiemelt recept.
A teljes receptgyűjtemény, kedvencek és AI-kérés lenyitható; AI-ajánlás csak
kifejezett kérésre indul. A lista marad az induló képernyő.

A készletből kikerül az üdvözlő widget. A háromoszlopos termékkártyákon két
külön feliratos vezérlő jelzi az Otthon és Listán állapotot. A zöld otthonjelölés
és a terrakotta listajelölés egyszerre is aktív lehet. A listavezérlő hosszú
nyomására továbbra is a teljes mennyiség módosítható. Nincs adatformátum- vagy
háttérrendszer-változás, illetve automatikus készletimport.

Az alsó navigáció lebegő, áttetsző üveghatást kap; ez webes CSS, nem natív
Liquid Glass komponens. A termékeken nincs blur. Csökkentett áttetszőség vagy
mozgás esetén a navigáció egyszerűbb, olvasható felületre vált.

## Sunshine finomítás

Világosabb krém alap, barackos üdvözlőfelület, teltebb narancs műveletek.
A lebegő navigáció áttetszősége erősebb; csak ezen az egy kis felületen van
háttérelmosás. A fejléc szöveges nyila helyett méretezett chevron jelenik meg.
Az Áttekintés Lepj meg gombja a meglévő receptgyűjteményből választ a készlet
alapján, külön AI-hívás és adatváltoztatás nélkül. A következő választás a
hasonlóan jó találatok közt változik; egyetlen megfelelő találat ismétlődhet.
