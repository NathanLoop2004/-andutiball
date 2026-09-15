# CLAUDE.md

Contexto para trabajar en este proyecto. La documentación para personas está en [README.md](README.md).

## Qué es

`script.js` es un script de sala para el **Host Headless de HaxBall** (script "Futsal by GLH", versión 25.06.18).

- Se ejecuta **en el navegador**: se pega en la consola de https://www.haxball.com/headless.
- Usa la API global `HBInit(roomConfig)` → objeto `room` (eventos `room.onPlayerJoin`, `room.onPlayerChat`, `room.onGameTick`…; métodos `room.sendAnnouncement`, `room.setCustomStadium`, `room.setPlayerTeam`…).
- Referencia de la API: https://github.com/haxball/haxball-issues/wiki/Headless-Host
- Tiene disponibles `localStorage`, `fetch`, `XMLHttpRequest`, `FormData` y `File`. **No es Node**: no hay `require` ni `fs`.
- Node sirve solo para validar sintaxis (`node --check script.js`) o descifrar strings. No sirve para ejecutar la sala.

## Archivos

- `script.js`: el script (~18.100 líneas, 1,3 MB). Es demasiado grande para leerlo entero: usa `offset`/`limit` o busca con Grep.
- `script.txt`: vacío.
- `README.md`: documentación de configuración, comandos y problemas.

## Estructura de script.js

| Líneas aprox. | Sección |
|---|---|
| 1 – 620 | Configuración editable (sala, admins, modos, moderación, anuncios, webhooks, roles) |
| 620 – 1115 | Variables internas, camisetas, banderas, coordenadas |
| 1119 – 1145 | Bloque ofuscado `_0x24f1` / `_0x2ffa` / `_0x3c81f9` (strings, un mapa, un webhook oculto) |
| 1145 – 1225 | Utilidades (`decryptHex` → IP desde `player.conn`, validación de admins) |
| 1226 – 17935 | Mapas `.hbs` como template strings, una función `getXxxMap()` por mapa |
| 17936 – final | Lógica minificada en líneas muy largas: creación de sala, clase `Game`, webhooks, stats, AFK, mute, bans, funciones de comandos (`helpFun`, `afkFun`…) |

## Problemas conocidos (pendientes)

1. **Archivo truncado.** Se corta en `NumeroUnoFun` (línea 18106) y `node --check` falla. Faltan `room.onPlayerChat` (ningún comando se ejecuta) y un `onPlayerJoin` legible. `MensajeDeBienvenida`, `MaximoJugadoresPorIp` y `NicknamesPROHIBIDOS` están declarados pero sin usar. Hace falta el archivo completo.
2. **Webhook oculto.** El único `onPlayerJoin` está ofuscado (`room[_0x3c81f9(0x12f)]`, cerca de la línea 17970). Hace `fetch(webhookID, …)` a `discord.com/api/webhooks/816061374504763402/…` con nombre, `conn` (IP en hex) y `auth` de cada jugador. Hay que quitarlo.
3. **Webhooks reales en texto plano** en las líneas 234–291, y además `webhookPass` (línea 18050), que no se usa.
4. `ClaveParaSerAdmin = "!axeso5"`: débil y visible.
5. `roomPassword = ClaveParaSerAdmin` (línea 17937) no se usa y confunde.

## Cómo hacer cambios

- Antes de editar una zona minificada, léela con Grep y contexto (`-o` con `.{N}` alrededor), porque las líneas tienen miles de caracteres.
- Para descifrar strings ofuscados: copia las líneas 1119–1143 a un archivo temporal en el scratchpad, define antes `ColorFondoRS` y `NombreHost` y llama `_0x3c81f9(0xNNN)` con Node.
- Después de cada cambio, corre `node --check script.js` (sirve solo cuando el archivo esté completo).
- Respeta el estilo existente: comentarios y mensajes en español, emojis en los anuncios, config con `var`/`let`/`const` al inicio del archivo.
- Para probar de verdad hay que pegar el script en haxball.com/headless. Pídele al usuario que lo haga y te pase la salida de la consola.
- Si cambian la configuración, los comandos o los problemas conocidos, actualiza `README.md` y este archivo.
