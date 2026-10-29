# Receptajánló – megvalósítás állapota

A korábbi terv alapján elkészült a promptválasztó, a három receptet megjelenítő frontend, a Gemini Flash-Lite Edge Function, valamint a külön cache- és kvótamigráció.

Az élő modellhívás még nincs bekötve: Gemini API-kulcs, SQL-migráció és Supabase-függvénytelepítés szükséges.

A pontos, aktuális útmutató: [RECIPE-AI-SETUP.md](RECIPE-AI-SETUP.md).

A meglévő készlet-, lista- és háztartási adatformátumok változatlanok. A kulcs kizárólag szerveroldali secret. Az ajánló csak a beküldött készletnévlistával dolgozik; nem olvas más háztartások adataiból.
