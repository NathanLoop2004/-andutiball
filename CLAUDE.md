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

## Panel y rangos

- `panel/index.html` (estado de las salas) y `panel/rangos.html` (administrar rangos). Los sirve tanto `panel/server.js` (Docker, puerto 8080, une las 3 salas) como el propio `launcher.js` (`npm start`, puerto `API_PORT`, solo su sala).
- API de cada sala: `GET /api/estado`, `GET /api/salas`, `GET|POST /api/rangos`.
- El launcher espía la sala con un Proxy sobre el objeto `room`: encadena el handler original y después registra el evento. **Nunca reemplazar un handler del script sin llamar al anterior.**
- `roles.json` = rangos + clave. `lib/rangos.js` lo lee y lo guarda; la clave nunca se manda al navegador (`sinClave`). El launcher lo inyecta como `window.__RANGOS` antes de correr el script y lo vigila con `fs.watch`: al cambiar llama a `window.__rangosActualizar` (recarga en caliente).
- El bloque `🎖️ RANGOS CON CLAVE` del script exige la clave a los nicks con rango: quedan espectadores + AFK hasta escribirla.

## Estructura de script.js

| Líneas aprox. | Sección |
|---|---|
| 1 – 620 | Configuración editable (sala, admins, modos, moderación, anuncios, webhooks, roles) |
| 620 – 1115 | Variables internas, camisetas, banderas, coordenadas |
| 1119 – 1145 | Bloque ofuscado `_0x24f1` / `_0x2ffa` / `_0x3c81f9` (strings, un mapa, un webhook oculto) |
| 1145 – 1225 | Utilidades (`decryptHex` → IP desde `player.conn`, validación de admins) |
| 1226 – 17935 | Mapas `.hbs` como template strings, una función `getXxxMap()` por mapa |
| 17936 – final | Lógica minificada en líneas muy largas: creación de sala, clase `Game`, webhooks, stats, AFK, mute, bans, funciones de comandos (`helpFun`, `afkFun`…) |

## Estado del script (ya arreglado)

1. **Archivo truncado → cortado limpio.** Venía cortado a mitad de `NumeroUnoFun`; se quitó esa última línea y `node --check script.js` pasa.
2. **`room.onPlayerChat` faltaba → repuesto.** Al final del archivo está el bloque `💬 COMANDOS DEL CHAT — repuestos por ÑandutíBall`: mapea comandos a las funciones que sobrevivieron (`helpFun`, `MapasFun`, `afkFun`, `swapFun`, `pushMute`, `BanIpFun`…), maneja la clave de admin, el chat de equipo (`t `), `#`, mute y prefijos de rol. Es código propio, legible, no del autor original.
3. **Webhook oculto → desactivado.** `var webhookID=null` con el link **comentado** arriba (buscar `WEBHOOK OCULTO DEL AUTOR`) y el `fetch(webhookID,…)` eliminado del `onPlayerJoin` ofuscado. **No reactivar**: enviaba nombre, IP (`player.conn`) y auth de cada jugador a un Discord ajeno.

## Pendientes

- **Comandos sin recuperar** (sus funciones estaban en el pedazo perdido): estadísticas (`!me`, `!stats`, `!goleadores`, `!mvp`, rachas…), `!avatar`, `!size`, `!memide`, votaciones (`!expulsar`, `!admin`), `!llamaradmins`, `!votarmapa`, `!ofi`, `!firmar`. Están listados en `ComandosFaltantes` y la sala avisa que no existen. Para tenerlos hace falta el `script.js` completo del autor.
- `MensajeDeBienvenida`, `MaximoJugadoresPorIp` y `NicknamesPROHIBIDOS` siguen declarados pero sin usar (el `onPlayerJoin` ofuscado no los aplica).
- **Webhooks reales en texto plano** en las líneas 238–290, y `webhookPass` (sin uso).
- `ClaveParaSerAdmin = "!axeso5"`: débil y visible.
- `roomPassword = ClaveParaSerAdmin` no se usa y confunde.

## Cómo hacer cambios

- Antes de editar una zona minificada, léela con Grep y contexto (`-o` con `.{N}` alrededor), porque las líneas tienen miles de caracteres.
- Para descifrar strings ofuscados: copia las líneas 1119–1143 a un archivo temporal en el scratchpad, define antes `ColorFondoRS` y `NombreHost` y llama `_0x3c81f9(0xNNN)` con Node.
- Después de cada cambio, corre `node --check script.js` (sirve solo cuando el archivo esté completo).
- Respeta el estilo existente: comentarios y mensajes en español, emojis en los anuncios, config con `var`/`let`/`const` al inicio del archivo.
- Para probar de verdad hay que pegar el script en haxball.com/headless. Pídele al usuario que lo haga y te pase la salida de la consola.
- Si cambian la configuración, los comandos o los problemas conocidos, actualiza `README.md` y este archivo.
