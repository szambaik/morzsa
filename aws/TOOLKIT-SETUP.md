# AWS Agent Toolkit – ellenőrzött telepítési állapot

Ellenőrizve: 2026-11-18, macOS, Codex. Ez a Toolkit telepítése; nem az önálló
AWS-alkalmazásbackend telepítésének igazolása.

## Beállítás

- AWS CLI: 2.41.0.
- CLI-profil: morzsa.
- AWS experience: new, projektalapú.
- Kiválasztott régió: eu-north-1.
- Agent Toolkit konfigurációs szolgáltatása: us-east-1, az útmutató szerint.
- Magyarázati szint: MEDIUM.
- Böngészős bejelentkezés: sikeres; az STS get-caller-identity ellenőrzés is sikeres.
- 25 alap AWS skill telepítve. A távoli katalógus 126 skillt adott vissza.

A CLI-hozzáférés az útmutató szerint 12 óráig érvényes, és 90 napig
megújítható új böngészős hitelesítés nélkül. Titkos kulcs, session token és
exportált credential nem kerül a repóba.

## MCP és utasítások

Az aws-mcp bejegyzések AWS_MCP_PROXY_PROFILES értéke morzsa a következő
eszközöknél: Codex, Claude Code, Cline, Gemini CLI. A profil hozzáadása után
ellenőrizve lett, hogy minden más konfigurációs érték változatlan maradt,
beleértve a telepítő által létrehozott command/args/timeout/transport értékeket.

Az új AWS experience útmutatója stabil BEGIN/END AWS Agent Toolkit rules
jelölők között került a projekt utasításfájljaiba: AGENTS.md, CLAUDE.md,
GEMINI.md, .clinerules/aws-agent-toolkit.md. A korábbi AGENTS.md tartalma
változatlan előtagként megmaradt; az ismételt szabályfrissítés nem duplikálja
a blokkot. A projekt saját kompatibilitási és release-szabályai elsőbbséget élveznek.

## Új session és hook

A Toolkit telepítője új session indítását kéri, hogy az új MCP-eszközök és
skillek betöltődjenek. Ebben a telepítési sessionben az AWS MCP-eszközök még
nem kerültek a hívható eszközlistába; ez nem egy sikeresen végrehajtott
MCP tool-call igazolása. A CLI és a távoli Toolkit-katalógus elérése ellenőrzött.

A telepítő Codex skillfrissítő hookot is létrehozott, és azt írta, hogy a
/hooks felületen kell megbízhatónak jelölni. Ezt a kézi bizalmi lépést nem
helyettesítettük automatikus jóváhagyással.

Másik AWS-projekthez: jelentkezz be külön profilnévvel az aws login --profile
név paranccsal, add a nevet az AWS_MCP_PROXY_PROFILES szóközzel elválasztott
listájához az érintett MCP-konfigurációban, majd indítsd újra az AI-eszközt.

## Morzsa állapota

Az AWS út továbbra is teljes, önálló alternatív backendként készül.
A Supabase-kód, a jelenlegi publikus konfiguráció és a felhasználói adatok
nem változtak a Toolkit telepítése miatt. AWS-alkalmazáserőforrást még nem
hoztunk létre, és valódi SnapStart runtime-mérés sem történt.

A regionális runtime-próba eu-north-1-re lett állítva, helyi tesztjei sikeresek.
Az origin/main merge után a teljes design-audit/check-release.mjs is sikeres:
32 accessibility scan, 54 célzott audit-regresszió, valamint a további
household/mobile/recipe/shopping ellenőrzések.

Az új sessionben először az AWS MCP agent_skills keresésével és a megfelelő
skill betöltésével kell ellenőrizni a projekt szolgáltatás-elérhetőségét,
csomagját és a SnapStart-próba telepíthetőségét. Nincs automatikus paid-plan
váltás vagy Supabase-adatátállás.

## Követett hivatalos források

- https://raw.githubusercontent.com/aws/agent-toolkit-for-aws/refs/heads/main/setup-instructions/setup.md
- https://raw.githubusercontent.com/aws/agent-toolkit-for-aws/refs/heads/main/setup-instructions/setup-troubleshooting.md
- https://raw.githubusercontent.com/aws/agent-toolkit-for-aws/refs/heads/main/rules/aws-starter-rules.md
