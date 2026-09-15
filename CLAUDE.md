# CLAUDE.md

Contexto para trabajar en este proyecto. La documentación para personas está en [README.md](README.md).

## Qué es

`script.js` es un script de sala para el **Host Headless de HaxBall** (base: "Real Soccer Revolution By GLH 3.1.0", ya parcheado como ÑandutíBall).

- Se ejecuta **en el navegador**: se pega en la consola de https://www.haxball.com/headless.
- Usa la API global `HBInit(roomConfig)` → objeto `room` (eventos `room.onPlayerJoin`, `room.onPlayerChat`, `room.onGameTick`…; métodos `room.sendAnnouncement`, `room.setCustomStadium`, `room.setPlayerTeam`…).
- Referencia de la API: https://github.com/haxball/haxball-issues/wiki/Headless-Host
- Tiene disponibles `localStorage`, `fetch`, `XMLHttpRequest`, `FormData` y `File`. **No es Node**: no hay `require` ni `fs`.
- Node sirve solo para validar sintaxis (`node --check script.js`) o descifrar strings. No sirve para ejecutar la sala.

## Archivos

- `script.js`: el script (~19.100 líneas, 1,5 MB). Es demasiado grande para leerlo entero: usa `offset`/`limit` o busca con Grep.
- `Real Soccer Revolution By GLH 3.1.0.txt`: el original completo del autor, sin parchar. De ahí sale `script.js` con `npm run parchar`.
- `README.md`: documentación de configuración, comandos y problemas.

## Despliegue (launcher.js)

- `launcher.js` + `package.json`: Puppeteer abre `haxball.com/headless`, envuelve `HBInit` para agregar `token` y ejecuta `script.js`.
- El token se pasa por la variable de entorno `HAXBALL_TOKEN` (de https://www.haxball.com/headlesstoken). **Vence a los pocos minutos** y solo sirve para crear la sala: hay que pedir uno nuevo en cada arranque. Nunca guardarlo en archivos del repositorio.
- El token se lee de `.env` (ignorado por Git); `.env.example` es la plantilla sin token.
- Docker: `Dockerfile` (imagen `ghcr.io/puppeteer/puppeteer`, con la misma versión que puppeteer en package-lock.json) + `docker-compose.yml` (`env_file: .env`, `shm_size: 1gb`, `script.js` montado como volumen). Arranque: `docker compose up -d --build`; logs y link de la sala: `docker compose logs -f`.
- Si el contenedor se reinicia, se necesita un token nuevo (por eso `restart: on-failure:3`).
- **Multihost:** un solo `script.js` y cuatro salas en compose (`host-3v3`, `host-4v4`, `host-todos`, `host-rs`). Cada una tiene `HOST_CONFIG=hosts/<sala>.json`, y el launcher reemplaza en el script la declaración (`var/let/const Nombre ...;`) de cada variable del JSON. Solo sirve para variables de config de una línea.
- Cada sala necesita su propio token: `TOKEN_3V3`, `TOKEN_4V4`, `TOKEN_TODOS`, `TOKEN_REALSOCCER` en `.env`. Para `npm start` (una sola sala) se usan `HAXBALL_TOKEN` + `HOST_CONFIG`.
- `npm run tokens` (`get-tokens.js`): abre headlesstoken en el navegador normal del usuario (Cloudflare Turnstile rechaza a Puppeteer con el error 600010); el usuario resuelve el captcha y copia el token, y el script lo lee del portapapeles y guarda los 3 tokens en `.env` (`-- --up` además hace `docker compose up`). No automatizar ni saltar el captcha.
- **`npm start` = `todas.js`**: sin argumentos levanta las 4 salas + el panel (un proceso hijo por sala, puertos 3001-3004, panel en 8080, prefija la salida con el nombre de cada sala, Ctrl+C corta todo). Con argumento (`npm start 4v4`) levanta solo esa. `npm run todas` es alias. Es la forma práctica acá, porque el usuario no tiene Docker.
- `npm run sala 4v4` llama directo a `launcher.js` (una sala, sin el panel unificado). `launcher.js` también acepta el nombre de sala como argumento y avisa si el puerto está ocupado.
- **Cuidado con los nombres**: la sala de futsal automático se llama `todos` (hosts/todos.json) y el comando de las 4 era `todas`. Por eso `npm start` sin argumentos levanta las 4: el usuario escribió `npm start todos` esperando las 4 y le salió una sola.
- No duplicar `script.js` por sala: los cambios por sala van en `hosts/*.json`.

## Panel y rangos

- `panel/index.html` (estado de las salas) y `panel/rangos.html` (administrar rangos). Los sirve tanto `panel/server.js` (Docker, puerto 8080, une las 4 salas) como el propio `launcher.js` (`npm start`, puerto `API_PORT`, solo su sala).
- API de cada sala: `GET /api/estado`, `GET /api/salas`, `GET|POST /api/rangos`.
- El launcher espía la sala con un Proxy sobre el objeto `room`: encadena el handler original y después registra el evento. **Nunca reemplazar un handler del script sin llamar al anterior.**
- `roles.json` = rangos + clave. `lib/rangos.js` lo lee y lo guarda; la clave nunca se manda al navegador (`sinClave`). El launcher lo inyecta como `window.__RANGOS` antes de correr el script y lo vigila con `fs.watch`: al cambiar llama a `window.__rangosActualizar` (recarga en caliente).
- El bloque `🎖️ RANGOS` del script le da el rango (y el admin si corresponde) a quien entre con un nick de `roles.json`. Ya no se pide clave.

## Estructura de script.js

| Líneas aprox. | Sección |
|---|---|
| 1 – 620 | Configuración editable (sala, admins, modos, moderación, anuncios, webhooks, roles) |
| 620 – 1115 | Variables internas, camisetas, banderas, coordenadas |
| 1119 – 1145 | Bloque ofuscado `_0x24f1` / `_0x2ffa` / `_0x3c81f9` (strings, un mapa, un webhook oculto) |
| 1145 – 1225 | Utilidades (`decryptHex` → IP desde `player.conn`, validación de admins) |
| 1226 – 17935 | Mapas `.hbs` como template strings, una función `getXxxMap()` por mapa |
| 17936 – final | Lógica minificada en líneas muy largas: creación de sala, clase `Game`, webhooks, stats, AFK, mute, bans, funciones de comandos (`helpFun`, `afkFun`…) |

## Estado del script

Desde el 15/09/2026 la base es **"Real Soccer Revolution By GLH 3.1.0"**: viene completo y válido, con `onGameTick` (motor de Real Soccer), `onTeamGoal`, `onPlayerChat`, `onPositionsReset`, `onTeamVictory` y `onGamePause/Unpause`. Reemplazó al archivo truncado anterior, al que le faltaban el árbitro y los comandos.

Sobre esa base, `npm run parchar` aplica lo de ÑandutíBall. Como el script ya trae su chat y su árbitro, el parcheador **salta** los bloques `💬 COMANDOS DEL CHAT` y `🧑‍⚖️ ARBITRAJE` (quedan en `parches/bloques/` por si vuelve a hacer falta).

**Webhook oculto → desactivado** en cada parcheo: `var webhookID=null` con el link comentado arriba (buscar `WEBHOOK OCULTO DEL AUTOR`) y el `fetch(webhookID,…)` fuera del `onPlayerJoin` ofuscado. **No reactivar**: enviaba nombre, IP (`player.conn`) y auth de cada jugador a un Discord ajeno.

Handlers ofuscados de esta versión: `0x1cb` onRoomLink · `0x1bc` onStadiumChange · `0x12f` onPlayerJoin · `0x138` onPlayerTeamChange · `0x19c` onGameTick.

## Parches (`npm run parchar`)

`parches/aplicar.js` reaplica **todo lo de ÑandutíBall** sobre cualquier `script.js`: corta la última línea si viene truncado, desactiva el webhook oculto, cambia la marca GLH → ÑandutíBall, pone las camisetas paraguayas (`parches/camisetas.js`), ajusta los umbrales del modo automático y agrega los bloques de `parches/bloques/` (compat, rangos, arbitraje, comandos, bienvenida).

Es idempotente y **condicional**: si el script nuevo ya trae `room.onPlayerChat` o `room.onTeamGoal`, no agrega esos bloques. `--ver` hace una pasada en seco. Guarda `script.anterior.js`.

**Al tocar los bloques, editarlos en `parches/bloques/` y correr `npm run parchar`** — no editar el final de `script.js` a mano, porque el parcheador lo reescribe.


## Mapas propios de futsal

`npm run generar-mapas` (`mapas/generar.js`) copia los mapas de futsal del autor desde `script.js`, les cambia el nombre y les deja la **pelota amarilla lisa** (saca las pintitas negras de la pelota "oveja"). Escribe `mapas/nanduti-futsal-x{3,4,5,7}.hbs`.

**Cuidado con los joints**: el template ata las pintitas a la pelota con joints. Si se borran los discos sin borrar esos joints, quedan atando la pelota a los postes del arco y la cancha se vuelve injugable — y `npm run prueba-mapas` lo da por bueno igual, porque HaxBall acepta el mapa. `pintarPelota()` borra discos y joints juntos y reindexa.

El parcheador inyecta los `.hbs` como `function getFutx3Map()` etc. **al final** de `script.js`: en JS gana la última declaración, así que pisan a las del autor sin editarlas. Orden: `npm run generar-mapas` y después `npm run parchar`.

Probar sin abrir sala: `node pruebas/render.js mapas/nanduti-futsal-x3.hbs vista.png [logo]` dibuja el mapa como imagen.

## Selección por turnos

Bloque `🎽 SELECCIÓN POR TURNOS` (`parches/bloques/turnos.txt`). Los dos primeros espectadores pasan solos como capitanes y después se elige alternando: el capitán del equipo de turno escribe el número del jugador en el chat (o `!elegir 7`). Si no elige en `SegundosParaElegir`, elige el bot.

Se prende con `"SeleccionPorTurnos": true` en `hosts/*.json`, y **exige** `modoJueganTodos`, `modoJueganAlgunos` y `automatizadoActivado` en `false`: si el script acomoda jugadores por su cuenta, se pisan entre sí. Está activo en 3v3 y 4v4.

`npm run prueba-turnos [hosts/4v4.json]` lo prueba con 8 jugadores simulados. El test **respeta los tiempos** de los setTimeout: si se corren todos de golpe, dispara el reloj de "elige el bot" y nunca se prueba la elección a mano.


## ELO (lib/elo.js)

Puntaje por jugador, guardado en `datos/elo.json` **del lado de Node** (no en localStorage): así sobrevive al cierre de la sala y **las 4 salas comparten la tabla**. La clave es `auth:<PublicID>` y cae a `nick:<nombre>` solo si no hay auth.

Circuito: el bloque `📊 ELO Y DIVISIONES` del script anota quién está en cancha al arrancar, y al terminar empuja `{tipo:"elo-partido", red, blue, ganador, goles}` a `window.__panelCola`. El launcher la vacía, llama a `aplicarPartido()`, guarda, y le devuelve la tabla a la página con `window.__eloActualizar()`. También anuncia los cambios en la sala.

Fórmula Elo clásica por equipos: se compara el promedio de cada lado, K=32 (48 en los primeros 10 partidos). Es de suma cero. Divisiones en `DIVISIONES` (Novato → Leyenda).

API: `GET /api/elo`. El panel lo muestra en la pestaña **ELO** (también viene en `/api/estado` como `estado.elo`).

**Color del nombre**: en el chat NO reescribimos el mensaje. Se envuelve `room.sendAnnouncement` solo mientras corre el handler del script, se detecta el anuncio que lleva el nombre + el texto del jugador, y se le cambia el color y se le agrega el emoji. Así se conservan los prefijos de rango, el mute y los comandos del autor. Se apaga con `ColorearNombrePorElo`. En el panel, el launcher le pega `elo/division/emoji/color` a cada jugador del evento `jugadores` y `nombreConElo()` los pinta.

`npm run prueba-elo` corre el cálculo (`pruebas/elo.js`) y el circuito completo (`pruebas/elo-integracion.js`, con `ELO_FILE` a un archivo temporal para no pisar la tabla real).

## Sin límite de espectadores

Dos parches, porque el script original echaba gente que solo miraba:
- `LugaresReservados = 0`: con la sala casi llena, `verificarReserva()` le ponía **contraseña** a la sala.
- `LimiteMaximoDeJugadoresAFK = 99`: `checkAutoKickAFKs()` echaba a todos los AFK de golpe, y un espectador cuenta como AFK a los 5 minutos.

El cupo de las 4 salas es 30 (`CantidadDeJugadores` en `hosts/*.json`), el máximo de HaxBall.

## Panel: no redibujar de más

`pintarSala()` calcula una **firma** del HTML y si no cambió no toca el DOM (si no, parpadea y se cierra el menú de kick/ban). Cuando sí redibuja, guarda `scrollTop` antes y lo restaura después: sin eso, cada refresco de 2 s mandaba al usuario arriba de todo. Solo salta al último mensaje si ya estaba abajo del todo.

## Probar sin gastar tokens

`npm run prueba` (`pruebas/simulador.js`) monta una sala falsa con la API de HaxBall, corre `script.js` entero en un `vm` y dispara los eventos (entrar, chatear, clave de rango, comandos, gol, salir). Atrapa los `X is not defined` que dejó el corte del archivo. **Correrlo después de cada cambio en script.js.**

El bloque `🧑‍⚖️ ARBITRAJE` también es nuestro: el corte se llevó `room.onTeamGoal` (no existía ningún anuncio de gol), el acomodo automático de jugadores y el arranque de partidos. Ahí están `acomodarEquipos`, `arrancarSiHayGente`, `revisarSala` (cada 5 s) y `puedeJugar` (excluye bot, AFK y rangos sin verificar).

Umbrales del modo automatizado (editados en las 3 copias del `if` minificado): ≤7 → x3, 8-9 → x4, 10-13 → x5, ≥14 → x7. Arranque en x3.

Piezas repuestas en el bloque `🩹 PIEZAS QUE FALTABAN` (se perdieron con el corte): `playerJoinTimes`, `connections`, `UsedNames`, `usedUsernames`, `playerIPs`, `avatarIntervals`, `mapVotes`, `playerGoalsReceived`, `playerCleanSheets`, `timeOnHalves`, `camisetaRedActual/BlueActual`, y las funciones `whisper`, `announce`, `displayAdminMessage`, `registerPlayerTime`, `RegisterPlayer`, `DeletePlayer`, `asignarCamisetaPorClave`, `elegirNuevaCamiseta`.

## Pendientes

- **Anuncios de gol groseros**: el script original trae ~15 mensajes subidos de tono ("orto", "rosca"…). Pendiente decidir si se reemplazan.
- **Webhooks reales en texto plano** al inicio del archivo, y `webhookPass` (sin uso). Son del autor original.
- `ClaveParaSerAdmin = "!axeso5"`: débil y visible.
- La clave de rangos está en texto plano en `roles.json`, que se sube a Git; el panel no pide autenticación.
- Fallo del script original: `ballCarrying` solo existe tras el primer `onGameStart`; el bloque compat le pone una red de seguridad.

## Cómo hacer cambios

- Antes de editar una zona minificada, léela con Grep y contexto (`-o` con `.{N}` alrededor), porque las líneas tienen miles de caracteres.
- Para descifrar strings ofuscados: copia las líneas 1119–1143 a un archivo temporal en el scratchpad, define antes `ColorFondoRS` y `NombreHost` y llama `_0x3c81f9(0xNNN)` con Node.
- Después de cada cambio, corre `node --check script.js` (sirve solo cuando el archivo esté completo).
- Respeta el estilo existente: comentarios y mensajes en español, emojis en los anuncios, config con `var`/`let`/`const` al inicio del archivo.
- Para probar de verdad hay que pegar el script en haxball.com/headless. Pídele al usuario que lo haga y te pase la salida de la consola.
- Si cambian la configuración, los comandos o los problemas conocidos, actualiza `README.md` y este archivo.
