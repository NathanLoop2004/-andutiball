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

## Despliegue (launcher.js)

- `launcher.js` + `package.json`: Puppeteer abre `haxball.com/headless`, envuelve `HBInit` para agregar `token` y ejecuta `script.js`.
- El token se pasa por la variable de entorno `HAXBALL_TOKEN` (de https://www.haxball.com/headlesstoken). **Vence a los pocos minutos** y solo sirve para crear la sala: hay que pedir uno nuevo en cada arranque. Nunca guardarlo en archivos del repositorio.
- El token se lee de `.env` (ignorado por Git); `.env.example` es la plantilla sin token.
- Docker: `Dockerfile` (imagen `ghcr.io/puppeteer/puppeteer`, con la misma versión que puppeteer en package-lock.json) + `docker-compose.yml` (`env_file: .env`, `shm_size: 1gb`, `script.js` montado como volumen). Arranque: `docker compose up -d --build`; logs y link de la sala: `docker compose logs -f`.
- Si el contenedor se reinicia, se necesita un token nuevo (por eso `restart: on-failure:3`).
- **Multihost:** un solo `script.js` y tres salas en compose (`host-3v3`, `host-4v4`, `host-todos`). Cada una tiene `HOST_CONFIG=hosts/<sala>.json`, y el launcher reemplaza en el script la declaración (`var/let/const Nombre ...;`) de cada variable del JSON. Solo sirve para variables de config de una línea.
- Cada sala necesita su propio token: `TOKEN_3V3`, `TOKEN_4V4`, `TOKEN_TODOS` en `.env`. Para `npm start` (una sola sala) se usan `HAXBALL_TOKEN` + `HOST_CONFIG`.
- `npm run tokens` (`get-tokens.js`): abre headlesstoken en el navegador normal del usuario (Cloudflare Turnstile rechaza a Puppeteer con el error 600010); el usuario resuelve el captcha y copia el token, y el script lo lee del portapapeles y guarda los 3 tokens en `.env` (`-- --up` además hace `docker compose up`). No automatizar ni saltar el captcha.
- No duplicar `script.js` por sala: los cambios por sala van en `hosts/*.json`.
- Todavía no se probó: `script.js` está truncado y el launcher corta con error de sintaxis.

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
