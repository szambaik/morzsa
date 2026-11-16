# Felhasználói utak eredményei

2026. november 16. · rögzített alkalmazáspillanatkép · szintetikus helyi adatok.

| Út | Végrehajtás és állapot |
|---|---|
| J1 Indítás | 60 cold/warm mérés, 6 viewport, 4 hálózati profil, 4× CPU. Lassú profilban túllépés. |
| J2 Navigáció | Mind az öt nézet; 125 főváltás rövid ismételt sorban és 30 viewport/nézet-kombináció. Nagy adatokkal lassul. |
| J3 Készlet | Hozzáadás, állapotváltás, elfogyott jelölés, frissítés. Közös lassú mentési zárolás reprodukálva. |
| J4 Lista | Batch bevitel, tört mennyiség, törlés, vásárolt jelölés, lezárás, két kliens, offline/reconnect. Funkcionálisan sikeres. |
| J5 Receptek | SQL-feed, részletek, adagváltás, hiányok előnézete és listára tétele. Renderelési long task. |
| J6 AI | Rövid/hosszabb kérés, stream, más nézet használata, művelet jóváhagyása, 503/retry, Stop, csonkolás és valódi timeout. |
| J7 Hosszú használat | Külön közel hatperces munkamenet: AI, Realtime, polling, párbeszédek. Célzott képcache-retenció. |

A hosszú munkamenet 353.9 s-ig futott, 20 mintával, 140 nézetváltással, 20 párbeszédnyitással és 4 szintetikus AI-fordulóval. A GC utáni első/utolsó heap 4.11 / 4.69 MiB; DOM 606 / 828; listener 161 / 174; socket 2 / 2. A kis heap-növekedés a felgyűlt chatadatok és JIT miatt önmagában nem leak-bizonyíték. A kész-kép célzott tesztje ettől külön, konkrét DOM-retenciót igazolt.

## Sikertelen ellenőrzések

- large-pantry-and-list-stress — [bizonyíték](../../runs/2026-11-16T18-34-31.217Z-full/results.json)
- cache-read-not-blocked-by-prior-image — [bizonyíték](../../runs/2026-11-16T18-41-13.534Z-supplement/results.json)
- cached-image-releases-detached-dom — [bizonyíték](../../runs/2026-11-16T18-41-13.534Z-supplement/results.json)

## Képernyőjegyzék

### full

- [startup-320](../../runs/2026-11-16T18-34-31.217Z-full/screenshots/01-startup-320.png)
- [startup-375](../../runs/2026-11-16T18-34-31.217Z-full/screenshots/02-startup-375.png)
- [startup-390](../../runs/2026-11-16T18-34-31.217Z-full/screenshots/03-startup-390.png)
- [startup-768](../../runs/2026-11-16T18-34-31.217Z-full/screenshots/04-startup-768.png)
- [startup-1280](../../runs/2026-11-16T18-34-31.217Z-full/screenshots/05-startup-1280.png)
- [startup-1440](../../runs/2026-11-16T18-34-31.217Z-full/screenshots/06-startup-1440.png)
- [journey-overview](../../runs/2026-11-16T18-34-31.217Z-full/screenshots/07-journey-overview.png)
- [journey-pantry](../../runs/2026-11-16T18-34-31.217Z-full/screenshots/08-journey-pantry.png)
- [journey-shopping](../../runs/2026-11-16T18-34-31.217Z-full/screenshots/09-journey-shopping.png)
- [journey-recipes](../../runs/2026-11-16T18-34-31.217Z-full/screenshots/10-journey-recipes.png)
- [journey-chat](../../runs/2026-11-16T18-34-31.217Z-full/screenshots/11-journey-chat.png)
- [inventory-edited](../../runs/2026-11-16T18-34-31.217Z-full/screenshots/12-inventory-edited.png)
- [shopping-added](../../runs/2026-11-16T18-34-31.217Z-full/screenshots/13-shopping-added.png)
- [shopping-finish-review](../../runs/2026-11-16T18-34-31.217Z-full/screenshots/14-shopping-finish-review.png)
- [recipe-detail](../../runs/2026-11-16T18-34-31.217Z-full/screenshots/15-recipe-detail.png)
- [recipe-ingredients](../../runs/2026-11-16T18-34-31.217Z-full/screenshots/16-recipe-ingredients.png)
- [recipe-linked-shopping](../../runs/2026-11-16T18-34-31.217Z-full/screenshots/17-recipe-linked-shopping.png)
- [ai-stream-complete](../../runs/2026-11-16T18-34-31.217Z-full/screenshots/18-ai-stream-complete.png)
- [ai-failed-retry](../../runs/2026-11-16T18-34-31.217Z-full/screenshots/19-ai-failed-retry.png)
- [ai-retry-recovered](../../runs/2026-11-16T18-34-31.217Z-full/screenshots/20-ai-retry-recovered.png)
- [ai-cancelled](../../runs/2026-11-16T18-34-31.217Z-full/screenshots/21-ai-cancelled.png)
- [ai-preflight-800ms](../../runs/2026-11-16T18-34-31.217Z-full/screenshots/22-ai-preflight-800ms.png)
- [second-client-synced](../../runs/2026-11-16T18-34-31.217Z-full/screenshots/23-second-client-synced.png)
- [offline-outbox](../../runs/2026-11-16T18-34-31.217Z-full/screenshots/24-offline-outbox.png)
- [shared-pantry-saving](../../runs/2026-11-16T18-34-31.217Z-full/screenshots/25-shared-pantry-saving.png)
- [long-session-end](../../runs/2026-11-16T18-34-31.217Z-full/screenshots/26-long-session-end.png)

### supplement

- [responsive-overview-320](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/01-responsive-overview-320.png)
- [responsive-pantry-320](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/02-responsive-pantry-320.png)
- [responsive-shopping-320](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/03-responsive-shopping-320.png)
- [responsive-recipes-320](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/04-responsive-recipes-320.png)
- [responsive-chat-320](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/05-responsive-chat-320.png)
- [responsive-overview-375](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/06-responsive-overview-375.png)
- [responsive-pantry-375](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/07-responsive-pantry-375.png)
- [responsive-shopping-375](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/08-responsive-shopping-375.png)
- [responsive-recipes-375](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/09-responsive-recipes-375.png)
- [responsive-chat-375](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/10-responsive-chat-375.png)
- [responsive-overview-390](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/11-responsive-overview-390.png)
- [responsive-pantry-390](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/12-responsive-pantry-390.png)
- [responsive-shopping-390](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/13-responsive-shopping-390.png)
- [responsive-recipes-390](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/14-responsive-recipes-390.png)
- [responsive-chat-390](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/15-responsive-chat-390.png)
- [responsive-overview-768](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/16-responsive-overview-768.png)
- [responsive-pantry-768](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/17-responsive-pantry-768.png)
- [responsive-shopping-768](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/18-responsive-shopping-768.png)
- [responsive-recipes-768](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/19-responsive-recipes-768.png)
- [responsive-chat-768](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/20-responsive-chat-768.png)
- [responsive-overview-1280](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/21-responsive-overview-1280.png)
- [responsive-pantry-1280](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/22-responsive-pantry-1280.png)
- [responsive-shopping-1280](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/23-responsive-shopping-1280.png)
- [responsive-recipes-1280](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/24-responsive-recipes-1280.png)
- [responsive-chat-1280](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/25-responsive-chat-1280.png)
- [responsive-overview-1440](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/26-responsive-overview-1440.png)
- [responsive-pantry-1440](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/27-responsive-pantry-1440.png)
- [responsive-shopping-1440](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/28-responsive-shopping-1440.png)
- [responsive-recipes-1440](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/29-responsive-recipes-1440.png)
- [responsive-chat-1440](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/30-responsive-chat-1440.png)
- [empty-chat-after-poll](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/31-empty-chat-after-poll.png)
- [profile-shopping-50](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/32-profile-shopping-50.png)
- [profile-shopping-250](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/33-profile-shopping-250.png)
- [profile-shopping-667](../../runs/2026-11-16T18-41-13.534Z-supplement/screenshots/34-profile-shopping-667.png)

### faults

- [ai-action-preview](../../runs/2026-11-16T18-44-15.751Z-faults/screenshots/01-ai-action-preview.png)
- [ai-action-persisted](../../runs/2026-11-16T18-44-15.751Z-faults/screenshots/02-ai-action-persisted.png)
- [ai-stream-interrupted](../../runs/2026-11-16T18-44-15.751Z-faults/screenshots/03-ai-stream-interrupted.png)
- [ai-timeout-recovered](../../runs/2026-11-16T18-44-15.751Z-faults/screenshots/04-ai-timeout-recovered.png)

### soak

- [soak-0](../../runs/2026-11-16T18-45-56.672Z-soak/screenshots/01-soak-0.png)
- [soak-5](../../runs/2026-11-16T18-45-56.672Z-soak/screenshots/02-soak-5.png)
- [soak-10](../../runs/2026-11-16T18-45-56.672Z-soak/screenshots/03-soak-10.png)
- [soak-15](../../runs/2026-11-16T18-45-56.672Z-soak/screenshots/04-soak-15.png)
- [soak-complete](../../runs/2026-11-16T18-45-56.672Z-soak/screenshots/05-soak-complete.png)

A képernyőket megnyitva ellenőriztük; a 30 responsive képről kontaktlap is készült. A screenshot viewport-kivágat, nem hiányzó oldalrész bizonyítéka. Ez nem akadálymentességi megfelelőségi audit. A trace ZIP-ek Playwright Trace Viewerben, a cpuprofile fájlok Chrome DevToolsban nyithatók.
