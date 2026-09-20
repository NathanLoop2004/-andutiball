# CLAUDE.md

Contexto para trabajar en este proyecto. La documentación para personas está en [README.md](README.md).

## Qué es

`script.js` es un script de sala para el **Host Headless de HaxBall** (base: "Real Soccer Revolution By GLH 3.1.0", ya parcheado como ÑandutíHax).

- Se ejecuta **en el navegador**: se pega en la consola de https://www.haxball.com/headless.
- Usa la API global `HBInit(roomConfig)` → objeto `room` (eventos `room.onPlayerJoin`, `room.onPlayerChat`, `room.onGameTick`…; métodos `room.sendAnnouncement`, `room.setCustomStadium`, `room.setPlayerTeam`…).
- Referencia de la API: https://github.com/haxball/haxball-issues/wiki/Headless-Host
- Tiene disponibles `localStorage`, `fetch`, `XMLHttpRequest`, `FormData` y `File`. **No es Node**: no hay `require` ni `fs`.
- Node sirve solo para validar sintaxis (`node --check script.js`) o descifrar strings. No sirve para ejecutar la sala.

## Archivos

- `script.js`: el script (~19.100 líneas, 1,5 MB). Es demasiado grande para leerlo entero: usa `offset`/`limit` o busca con Grep.
- `Real Soccer Revolution By GLH 3.1.0.txt`: el original completo del autor, sin parchar. De ahí sale `script.js` con `npm run parchar`.
- `README.md`: documentación de configuración, comandos y problemas.
- `app.js` + `routes/` + `controllers/` + `models/` + `middlewares/`: la app en MVC (ver “Panel y rangos”).
- `public/`: Ñandutí Web (portada, login, registro) y las pantallas del panel, con el encarpetado de app-centralshop.
- `services/`: la conexión a la base por entorno y los webhooks (actualizaciones, link de la web).
- `prisma/` + `docker-compose.base.yml`: las tablas y la base, que va **aparte** de las salas.
- `tunel.js`, `actualizacion.js`, `sembrar.js`: los comandos sueltos (túnel de Cloudflare, novedades, sembrar la base).
- `pruebas/`: 27 pruebas que corren sin gastar tokens (ver “Probar sin gastar tokens”).

## Despliegue (launcher.js)

- `launcher.js` + `package.json`: Puppeteer abre `haxball.com/headless`, envuelve `HBInit` para agregar `token` y ejecuta `script.js`.
- El token se pasa por la variable de entorno `HAXBALL_TOKEN` (de https://www.haxball.com/headlesstoken). **Vence a los pocos minutos** y solo sirve para crear la sala: hay que pedir uno nuevo en cada arranque. Nunca guardarlo en archivos del repositorio.
- El token se lee de `.env`, que **ya no se sube a Git** (se destrackeó con `git rm --cached .env`);
  `.env.example` es la plantilla. Ojo: **los commits viejos todavía tienen el .env con tokens y
  webhooks adentro**, así que si el repo es público conviene rotarlos.
- Docker: `Dockerfile` (imagen `ghcr.io/puppeteer/puppeteer`, con la misma versión que puppeteer en package-lock.json) + `docker-compose.yml` (`env_file: .env`, `shm_size: 1gb`, `script.js` montado como volumen). Arranque: `docker compose up -d --build`; logs y link de la sala: `docker compose logs -f`.
- Si el contenedor se reinicia, se necesita un token nuevo (por eso `restart: on-failure:3`).
- **Multihost:** un solo `script.js` y cuatro salas en compose (`host-3v3`, `host-4v4`, `host-todos`, `host-rs`). Cada una tiene `HOST_CONFIG=hosts/<sala>.json`, y el launcher reemplaza en el script la declaración (`var/let/const Nombre ...;`) de cada variable del JSON. Solo sirve para variables de config de una línea.
- Cada sala necesita su propio token: `TOKEN_3V3`, `TOKEN_4V4`, `TOKEN_TODOS`, `TOKEN_REALSOCCER` en `.env`. Para `npm start` (una sola sala) se usan `HAXBALL_TOKEN` + `HOST_CONFIG`.
- `npm run tokens` (`get-tokens.js`): abre headlesstoken en el navegador normal del usuario (Cloudflare Turnstile rechaza a Puppeteer con el error 600010); el usuario resuelve el captcha y copia el token, y el script lo lee del portapapeles y guarda los 3 tokens en `.env` (`-- --up` además hace `docker compose up`). No automatizar ni saltar el captcha.
- **El orden en que abren las salas** (`TODAS` en `todas.js`, y los tokens en `get-tokens.js`):
  3v3 → automática → 4v4 → Real Soccer. Primero las dos que más se llenan, porque los tokens
  vencen a los pocos minutos: si uno se vence a mitad de camino, las que quedan afuera son las
  menos jugadas. Cada sala conserva **su** puerto (3001-3004), que no depende del orden.
- **`npm start` = `todas.js`**: es EL arrancador. Levanta Ñandutí Web + el panel + las 4 salas + el túnel de Cloudflare (un proceso hijo por sala, puertos 3001-3004, panel en 8080, prefija la salida con el nombre de cada sala, Ctrl+C corta todo). Con argumento (`npm start 4v4`) levanta solo esa. `npm run todas` es alias. Es la forma práctica acá, porque el usuario no tiene Docker.
- `npm run sala 4v4` llama directo a `launcher.js` (una sala, sin el panel unificado). `launcher.js` también acepta el nombre de sala como argumento y avisa si el puerto está ocupado.
- **Cuidado con los nombres**: la sala de futsal automático tiene clave `todos` (hosts/todos.json, TOKEN_TODOS), pero `npm start todos` levanta **las 4** (el usuario lo escribía esperando eso y le salía una sola). Esa sala sola se abre con `npm start futsal` (o `auto`), por el `alias` en `todas.js`. `npm run sala todos` (launcher.js directo) sigue siendo esa sala sola.
- No duplicar `script.js` por sala: los cambios por sala van en `hosts/*.json`.

## Base de datos (Postgres + Prisma)

La base tiene su propio compose y su propio ciclo de vida (los datos no se apagan con las salas),
**pero `npm start` la prende si está apagada** (`lib/preparar.js`, `docker compose up -d`: queda
aparte, Ctrl+C no la corta). Si no hay Docker o falla, avisa y arranca igual.

**`npm start` se autoaplica** (`prepararTodo()` en `todas.js` → `lib/preparar.js`), en este orden:

1. `prepararBase`: prende la base si hace falta y espera hasta 40 s a que conteste.
2. `prepararTablas`: `prisma migrate deploy` (solo aplica migraciones pendientes, **nunca borra**;
   no es `migrate dev`) y `prisma generate` **solo si cambió el schema** (hash en `datos/prisma.firma`).
3. `prepararScript`: si algo de `parches/` o `mapas/` es más nuevo que `script.js`, corre
   `parches/aplicar.js` + `node --check`. Si queda roto, vuelve a `script.anterior.js`.
4. `asegurarLaWeb`: si la web no está, la prende en segundo plano; si está y cambió
   `Web.firmaDelPanel()` (mtimes de app.js, routes, controllers, models, services, lib, middlewares,
   panel, el cliente de Prisma + el contenido del `.env`), deja `datos/web.recargar` y el
   supervisor **recarga solo el panel** con el `.env` releído (`util.parseEnv`). El túnel no se
   toca, así que el link no cambia. `public/` no cuenta: son estáticos y se leen del disco.

Lo que **no** se recarga solo: cambios en `web.js` o `tunel.js` (hace falta `npm run web:bajar`, y
el link cambia), y variables que se **borran** del `.env` (el supervisor las sigue teniendo).


Base **aparte de las salas**, con su propio compose para poder levantarla sola:

```
docker-compose.base.yml   Postgres 15.3 en el puerto 5432, datos en ./postgres (ignorada por Git)
prisma/schema.prisma      las tablas: jugadores, salas, partidos, participaciones, rangos
prisma7.config.ts         Prisma 7 saca la URL de acá, ya no del schema
services/ConexionBase.js  elige la base según DB_ENV (el enrutado dinámico)
services/ConexionPostgres{Produccion,Testing,Desarrollo}.js
```

**El enrutado dinámico por entorno** está calcado del `services/ConexionFirebird.js` del
Visualizador de facturas: `DB_ENV` (produccion | testing | desarrollo) decide qué archivo se
requiere, así **solo se abre la conexión del entorno activo**. Dos diferencias nuestras:

- El require es **perezoso** (`base()`), no al importar: el launcher y el panel siguen andando
  aunque Postgres esté apagado. Hoy la base es opcional, nada del host depende de ella.
- `hayBase()` responde true/false sin tirar, para que el panel pueda mostrarlo.

Cada entorno lee su `DB_<ENTORNO>_URL` y cae a `DATABASE_URL` si falta.

**Ojo con el 5432**: la máquina tenía un PostgreSQL 16 de Windows (servicio `postgresql-x64-16`)
escuchando ahí, y Prisma fallaba con `P1000: Authentication failed` porque se conectaba a ese y no
al contenedor. Ese servicio se detuvo y quedó en arranque **Manual**. Si vuelve a estar prendido,
el síntoma es el mismo P1000: o se lo para (`Stop-Service postgresql-x64-16`, como admin) o esta
base se mueve al 5433 en las tres puntas (compose, `.env` y `.env.example`).

**Prisma 7 cambió dos cosas** que conviene tener presentes:

1. `url = env("DATABASE_URL")` **ya no va en el schema**: la URL de las migraciones vive en
   `prisma7.config.ts`. Por eso los scripts corren el CLI con
   `node --env-file-if-exists=.env node_modules/prisma/build/index.js ...` (así toma el .env sin
   necesitar dotenv).
2. El cliente necesita un **adaptador**: `@prisma/adapter-pg` + `pg`, que es lo que arma
   `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`.
3. El generador nuevo (`provider = "prisma-client"`) escribe **TypeScript**, y este proyecto es
   CommonJS con `require`. Por eso el schema usa el clásico `prisma-client-js`, que escribe JS en
   `node_modules/@prisma/client`. Con `generatedFileExtension = "js"` el generador nuevo escribe
   TS adentro de archivos .js y explota al requerirlo — no volver a intentarlo.

Comandos: `npm run base` (levanta) · `base:bajar` · `base:generar` · `base:migrar` · `base:ver`
(Prisma Studio) · `npm run prueba-base`.

`pruebas/base.js` comprueba el enrutado (incluido que un `DB_ENV` inventado corte con un mensaje
claro y que se cargue **una sola** conexión) y, si la base está levantada, graba/lee/borra un
jugador. Si no está levantada **no falla**: avisa y sale bien.

## El kick por "nick en uso" (arreglado)

El script guarda en `usedUsernames[nick]` el auth del primero que usó ese nombre y echa al que
entre con ese nick y otro auth: **"🚫 Ese NICKNAME ya está en uso por otro jugador 🚫"**.

Solía echar a gente que era la dueña del nombre. Dos causas, las dos arregladas:

1. **El nick no se liberaba nunca.** El `onPlayerLeave` del autor solo hace
   `delete usedUsernames[player.name]` si ya no queda ninguna conexión con esa IP en
   `connections`… pero nada sacaba al que se iba de esa lista (nuestro `DeletePlayer` del bloque
   compat tampoco). Resultado: el nombre quedaba tomado para siempre, y al volver desde otro
   navegador o desde la compu (otro auth) te echaba. Ahora `soltarLaConexion()` saca la conexión
   **antes** de que corra el handler del script (el orden importa: el script mira la lista ahí).
2. **El kick no miraba si el nombre estaba en uso de verdad.** El parcheador le agrega a esa
   línea minificada un `room.getPlayerList().some(...)`: ahora solo echa si hay **otro jugador en
   la sala en ese momento** con el mismo nombre, que es lo que dice el mensaje.

`npm run prueba-nicks` cubre las dos puntas: volver a entrar con otro auth no te echa, y dos
personas con el mismo nombre a la vez sí.

Ojo al probar: `connections` y `usedUsernames` son `let` del script, **no** propiedades del
contexto del `vm` — en las pruebas se leen con `sala.leer("usedUsernames")`.

## Configuración de las salas desde el panel (parámetros y comandos)

Pantalla `public/frm/config/` (Configuración). La pueden usar **OWNER, CO-OWNER, HOSTER y
AYUDANTE**: `lib/permisos.js` → `puedeConfigurar()`, middleware `middlewares/puedeConfigurar.js`
(vuelve a mirar el rango en la tabla en cada pedido).

**Los rangos se comparan por palabra** (`palabraDelRango`: letras y guiones en mayúsculas).
Los nombres de la tabla traen emojis ("🗦👑🗧 OWNER") y antes `esOwner` comparaba el nombre
entero: **el OWNER de verdad no era OWNER** y la pantalla de usuarios lo rechazaba. Ojo:
"🔧 SUBAYUDANTE" da "SUBAYUDANTE", así que no cuenta como AYUDANTE.

**Parámetros** (`lib/parametros.js`, tabla `parametros_sala`): un catálogo de ~38 variables de
`script.js` con tipo, límites, grupo y `aplica`:

- `"reinicio"` (nombre, cupo, contraseña, mapa, intervalos): el launcher los escribe en el
  script al abrir la sala, igual que `hosts/*.json` y **pisándolos** (`Parametros.aplicarAlScript`).
- `"vivo"`: el launcher manda cada `SEGUNDOS_RANGOS` `window.__configSala({parametros, comandosApagados})`
  y el bloque `⚙️ CONFIGURACIÓN DESDE LA BASE` (`parches/bloques/config.txt`) aplica **solo lo que
  cambió** desde la última vez (`configVista`; el punto de partida es `window.__CONFIG_INICIAL`).
  Así un comando de la sala (`!ganasigue`) no queda pisado por la base cada 5 s.
- **De la sala a la base**: los interruptores de `ConfigSincronizada` (powerShotMode, combaMode,
  GolDeOroActivado, FairPlayActivado, cambioCami, CamisetasGanaSigue, ModoDeEquipos) se guardan en
  la base cuando un admin los cambia con un comando (`!powershot`…): el bloque compara el valor de
  verdad con `configVista`, empuja `{tipo:"config-sala"}` y el launcher hace `ConfigModel.guardar(...,
  "la sala")`. `configPorGuardar` evita que la lectura de los 5 s lo revierta antes de que la base
  lo devuelva (se larga a los 20 s). Si cambió en los dos lados a la vez, manda la web.
- **Para verlo**: cada guardado sale en `datos/web.log` (ConfigController), los rechazos 401/403
  también (`middlewares/puedeConfigurar.js`), y lo aplicado se anota en Mensajes del panel
  (evento `config`) y se le avisa por chat a los admins de la sala.
- La asignación es con `eval(nombre + " = ...")` **dentro del bloque**, porque varias son `let` del
  script (no son propiedades de `window`). El nombre se valida con regex y solo llegan los del catálogo.
- `TiempoDeJuego` / `LimiteDeGoles` llaman a `room.setTimeLimit/setScoreLimit`, que HaxBall solo
  acepta sin partido: si hay uno, quedan en `limitesPendientes` y se aplican en `onGameStop`.
- En la tabla **solo quedan los cambios**: volver al valor de fábrica borra la fila. Fábrica =
  `hosts/<sala>.json` y, si no está ahí, lo que dice la declaración en `script.js`.

**Comandos apagados** (tabla `comandos_apagados`, `sala = "*"` = todas): la lista sale de todos
los `"!algo"` que hay como texto en `script.js` (`comandosDelScript()`, ~180). El bloque envuelve
`onPlayerChat` **antes que 🤫 COMANDOS SIN ECO** (va justo antes en la lista del parcheador), así
corta el comando antes que cualquier otro bloque y que el script. `!clave` y `!login` no se pueden
apagar (`COMANDOS_PROTEGIDOS`).

API (`routes/ConfigRouter.js`): `GET /api/config/salas` · `GET|PUT|DELETE /api/config/:sala/parametros[/:nombre]`
· `GET|POST /api/config/:sala/comandos` (`{comando, activo, todas}`). El que cambia algo queda en
`cambiadoPor` / `apagadoPor`.

`npm run prueba-config` cubre los rangos por palabra, la sala aplicando en vivo (incluido un `let`,
el límite que espera al fin del partido y que la base no pise un cambio hecho en la sala), los
comandos apagados, el modelo contra la base y la API con permisos (sin sesión, sin rango,
SUBAYUDANTE, HOSTER). Deja las tablas como estaban.

## Vincular Discord (no es iniciar sesión)

En **Mi cuenta** (y un aviso en la portada) el que ya tiene sesión toca "Vincular con Discord":
OAuth2 con los scopes `identify guilds.join` (`services/Discord.js`, `models/DiscordModel.js`).

- `POST /api/cuenta/discord` (con sesión) arma un `state` al azar, guarda **su hash** en
  `usuarios.discordEstadoHash` (vence en 10 min, con la dirección de vuelta en `discordVuelta`)
  y devuelve la URL de Discord. La vuelta no trae el token de la web: **la cuenta sale del state**,
  que sirve una sola vez.
- `GET /api/discord/vuelta` canjea el código, pide `/users/@me`, guarda `discordId` (único: un
  Discord no queda en dos cuentas), `discordUsuario` y `discordAvatar`, y lo mete al servidor con
  `PUT /guilds/:guild/members/:id` usando el **bot** (201 agregado · 204 ya estaba). Siempre
  redirige a `/frm/cuenta/?discord=<resultado>`: vinculado · ya-estaba · sin-servidor · cancelado ·
  vencido · otra-cuenta · error.
- **No se guarda ningún token de Discord**: el access_token se usa y se descarta.
- `.env`: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`,
  y opcional `DISCORD_REDIRECT_URI`. Sin eso el botón queda deshabilitado y la API avisa.
- **Ojo con la dirección de vuelta**: Discord exige tenerla registrada tal cual en el portal. Por
  defecto es `<web>/api/discord/vuelta` (WEB_URL → túnel → localhost): con el link de Cloudflare
  que cambia, hay que actualizarla en el portal cada vez. **Por eso existe la página puente**
  (`puente-discord/index.html`, se sube una vez a GitHub Pages): en Discord se registra el puente
  (`DISCORD_REDIRECT_URI`), y la web manda su link actual adentro del `state`
  (`<al azar>.<base64url del link>`). El puente lo lee y reenvía a `<link>/api/discord/vuelta` con
  el mismo code/state. Solo reenvía a `DOMINIOS_PERMITIDOS` (trycloudflare.com) por https (o
  localhost), así no sirve de trampolín; y el code sin el secreto no sirve. El canje del code se
  hace con la vuelta guardada (`discordVuelta` = el puente), que es la que Discord exige.
- La tabla de **Usuarios** del OWNER muestra el Discord de cada cuenta y el buscador busca también
  por `discordUsuario`.

`npm run prueba-discord-vincular` simula Discord (`Discord.usarFetch`): el link, el state de un
solo uso, que no se guarden tokens, otra cuenta, cancelar, ya estaba, sin permiso del bot, código
malo, vencido, desvincular, la tabla de Usuarios y sin configurar.

## Carrusel de la portada

Tabla `imagenes_carrusel` (modelo `ImagenCarrusel`, migración `20260917160000_carrusel`): **la
imagen se guarda en la base** (`datos Bytes`), con título, texto, enlace, orden y `activa`.

- `models/CarruselModel.js` valida al subir: **se miran los primeros bytes** (`detectarTipo`),
  no solo el `Content-Type`; solo PNG/JPEG/WebP/GIF (**nada de SVG**, puede traer script); hasta
  3 MB; hasta 20 imágenes. El enlace solo puede ser `http(s)` (nada de `javascript:`).
- La subida va con la imagen **tal cual en el cuerpo** (`express.raw`, `Content-Type: image/…`) y
  los textos en la query. `express.json` global no la toca.
- `GET /api/carrusel/:id/imagen` sirve los bytes con `nosniff`, un CSP propio y cache de un día
  (`?v=<cambiada>` en la URL evita ver una imagen vieja).
- Público: `GET /api/carrusel` (solo activas; sin base devuelve lista vacía y la portada no se
  rompe). Panel (`puedeConfigurar`): `GET /api/carrusel/todas`, `POST /api/carrusel`,
  `POST /api/carrusel/orden {ids}`, `PUT|DELETE /api/carrusel/:id`.
- Pantalla `public/frm/carrusel/` (sección "Carrusel" del panel). La portada (`public/index.html`)
  muestra el carrusel **a todos**, con o sin sesión: pasa solo cada 6 s, se frena con el mouse
  encima, con el foco o con la pestaña oculta, se desliza con el dedo y respeta
  `prefers-reduced-motion`.

**La portada es pública**: carrusel y ranking los ve cualquiera; "Tu ELO" solo con sesión. El
ranking va **paginado de a 10** (`POR_PAGINA`), con buscador y "Ir a mi puesto".

`npm run prueba-carrusel` cubre la firma de los archivos, SVG disfrazado, tamaño, enlaces,
orden, lo que ve el público, `nosniff` y los permisos (sin sesión, jugador, AYUDANTE). Solo borra
lo que crea.

## Quién ve qué en el panel

| Sección | Quién | Dónde se controla |
|---|---|---|
| Salas (ver quién está y **expulsar**) | rangos con admin + OWNER, CO-OWNER, HOSTER, AYUDANTE | `Sesion.exigirSalas()` + `middlewares/puedeModerar.js` |
| **Banear** | OWNER, CO-OWNER, HOSTER (el AYUDANTE **no**) | `puedeModerar({ banear: true })` |
| Ajustes de la web | OWNER | `middlewares/soloOwner.js` |
| Configuración, Carrusel | OWNER, CO-OWNER, HOSTER, AYUDANTE | `middlewares/puedeConfigurar.js` |
| **Rangos** | **OWNER y CO-OWNER** | `middlewares/puedeVerRangos.js` (`GET|POST /api/rangos`, `GET /api/rangos/usuarios`) |
| Usuarios | OWNER | `middlewares/soloOwner.js` |

**Moderación (17/09/2026).** `/api/kick` y `/api/ban` **ya piden sesión** (eran la única parte
abierta del panel). `lib/permisos.js` → `puedeExpulsar` (OWNER, CO-OWNER, HOSTER, AYUDANTE) y
`puedeBanear` (los mismos menos AYUDANTE). El AYUDANTE entra al panel de Salas aunque su rango no
dé admin en HaxBall (son cosas distintas: admin de sala ≠ permiso del panel) y no ve el botón de
banear. El panel **reenvía el mismo `Authorization`** a la sala (`ModeracionModel.reenviar`), así
la sala vuelve a revisar el rango: protegerlo en un solo lado no alcanzaba, porque las dos puntas
usan el mismo `app.js`. La ficha de sesión trae `modera` y `banea`.

Todos vuelven a mirar el rango en la tabla en cada pedido. La ficha de sesión trae `admin`,
`configura`, `rangos` y `owner`, y `Sesion.pintarNavAdmin()` muestra solo lo que corresponde. En
Salas, la pestaña Rangos también se esconde para los demás.

**Dar un rango se hace eligiendo una cuenta**, no escribiendo el nick: `GET /api/rangos/usuarios?q=`
(`UsuarioModel.nicksParaElegir`) devuelve hasta 20 cuentas con clave y sin ban. Los nicks viejos
que no tienen cuenta se muestran con borde punteado.

**`pruebas/api.js` corre SIN `.env` a propósito**: su POST a `/api/rangos` hace
`rango.deleteMany({})` y, con la base prendida, borraría los rangos de verdad.

## Panel y modo oscuro

Todas las pantallas del panel (salas, configuración, rangos, usuarios, actualizaciones) usan
`nanduti.css` (antes cada una tenía su `<style>`). `Sesion.pintarNavAdmin(activo)` dibuja la barra
de secciones según lo que puede el usuario (`admin`, `configura`, `owner` vienen en la ficha de
sesión). Las pantallas anchas usan `.barra.ancha` + `.contenido.ancho` (1280 px).

**Modo claro/oscuro**: `public/js/tema.js` va en el `<head>` sin defer (así no parpadea), pone
`data-tema` en `<html>` desde `localStorage` y agrega el botón al final de cada `.barra`. En el CSS,
los tokens oscuros están dos veces: en `:root[data-tema="oscuro"]` y en
`@media (prefers-color-scheme: dark) { :root:not([data-tema="claro"]) }`. Si se toca un color
oscuro, hay que cambiarlo en los dos lugares.

La pantalla de rangos ya no tiene el recuadro "Clave para jugar": los rangos no piden clave
desde que salen de la base, y el POST sin `clave` conserva la que haya.

## Ajustes de la web (solo OWNER)

Pantalla `public/frm/ajustes/` + tabla `ajustes` (migración `20260917220000_ajustes`,
`models/AjustesModel.js`). Son interruptores para apagar cosas cuando algo de afuera se rompe —
nacieron porque Gmail bloqueó la cuenta y nadie podía registrarse:

| Clave | De fábrica | Qué apaga |
|---|---|---|
| `pedirCodigoDeCorreo` | true | El código de 6 números al crear la cuenta |
| `revisarQueExistaElCorreo` | true | Las reglas de Gmail y el MX del dominio (`lib/correos.js`) |
| `pedirCorreo` | true | Que el correo sea obligatorio |
| `permitirRegistro` | true | Crear cuentas nuevas (los que ya tienen entran igual) |
| `mostrarAnuncios` | **false** | La publicidad de la portada (ver “Anuncios”) |

Igual que los parámetros de las salas: en la tabla **solo queda lo que se cambió**. `valores()`
cachea 10 s y, si la base está apagada, devuelve los de fábrica (la web no se cae). `RegistroModel`
los mira en `revisarDatos()`. La pantalla de registro lee `GET /api/ajustes/publicos` (sin sesión)
y se adapta sola. `GET|PUT /api/ajustes` van con `soloOwner`.

**Ojo en las pruebas**: `prueba-web` los pone en fábrica y los deja como estaban al final. Si se
corta a la mitad, quedan los de fábrica.

## Rangos: manda la tabla (contra las inyecciones)

Los rangos salen de la tabla **`rangos`** (`models/RangoModel.js`), no de `roles.json`.
`roles.json` queda como **espejo**: se escribe junto con la tabla y se usa solo si la base está
apagada, para que una sala no se quede sin admins.

**El launcher relee la tabla cada 5 segundos** (`SEGUNDOS_RANGOS` en .env) y se la manda a la
página (`window.__RANGOS_TABLA` + `window.__rangosDeLaBase()`). El bloque `🎖️ RANGOS` recorre a
los que están en la sala y **deja a cada uno como dice la tabla**:

- el que tiene un rango con `admin` → `setPlayerAdmin(true)`;
- **el que no figura en la tabla → `setPlayerAdmin(false)`** (`SoloRangosDeLaBase`).

Por eso una inyección de javascript no sirve de nada: el que se pone admin a mano en la consola
lo pierde en la próxima ronda. Y al que le sacan el admin siendo OWNER, se le devuelve.

**No hay clave para hacerse admin** (se sacó `!axeso5` el 17/09/2026, a pedido del usuario): el
parcheador deja `ClaveParaSerAdmin = null`, borra el `if(message.includes(ClaveParaSerAdmin))` del
chat (daba admin a cualquier mensaje que la *contuviera*) y la saca del aviso de `llamarAdmins()`, que
la mandaba al Discord **del autor**. El admin sale solo de la tabla; si hace falta uno temporal, va
en la tabla. `prueba-rangos` lo cubre (y `sala-falsa.js` ahora guarda lo que se carga en `FormData`).

Red de seguridad: si la lista llega **vacía** no se toca a nadie. Así una base caída no deja la
sala sin admins.

`npm run base:sembrar` copia `roles.json` a la tabla la primera vez y crea al dueño:

```powershell
npm run base:sembrar                                      # JINDER con rango OWNER
npm run base:sembrar -- --usuario Otro --clave xxxx --rango CO-OWNER
```

Es idempotente. La pantalla de rangos del panel (`/api/rangos`) lee y escribe la tabla, y de paso
actualiza el espejo; si la base está apagada guarda en `roles.json` y lo avisa en la respuesta
(`aviso`), sin fallar.

`npm run prueba-rangos` cubre la ronda: pone a un jugador admin "a mano" (como haría una
inyección) y comprueba que a los 5 segundos se le cae, y que sin lista no se toca a nadie.

## Usuarios y claves

**Son usuarios, no jugadores**: la tabla es `usuarios` (modelo `Usuario`). Cada uno tiene su
clave atada al **nombre**, para que nadie le use el nick.

| Si el nombre… | Pasa esto |
|---|---|
| está registrado | se le pide la clave (`!clave ...`) y mira de afuera hasta ponerla; a los 90 s se lo echa |
| no está registrado | juega normal, y cada 5 minutos le sale el cartelito para crear la cuenta en la web (y al registrado sin clave se le recuerda cada 1 minuto) |

**Las cuentas se crean en Ñandutí Web, no en la sala.** El único comando que queda es `!clave`
(o `!login`), que solo verifica; `!registrar` y `!cambiarclave` contestan con el link de la web.
Desde el chat no se cargan datos en la base.

El link sale de `window.__WEB_URL`: `tunel.js` guarda la URL pública en `datos/tunel.json` y cada
launcher la lee cada 10 s y se la pasa a su sala (`refrescarLinkWeb()`). Sin túnel abierto, el
bloque manda al Discord.

**La clave nunca se guarda tal cual**: `lib/claves.js` la hashea con `scrypt` (viene con Node,
sin dependencias nuevas) y guarda `scrypt$<sal>$<hash>`. `UsuarioModel.sinClave()` saca el hash de
todo lo que sale del modelo.

**El puente**, porque el script corre en el navegador y la base está en Node (el mismo que usa el
ELO): el bloque `🔐 USUARIOS Y CLAVES` empuja `{tipo:"usuario", accion, id, nick, clave}` a
`window.__panelCola`; el launcher lo atiende en `atenderUsuario()` y contesta llamando a
`window.__usuarioRespuesta(...)`. La lista de nombres registrados viaja al revés:
`refrescarUsuarios()` deja `window.__USUARIOS` (y llama a `window.__usuariosActualizar`) antes de
correr el script y después cada 60 s.

**Si la base está apagada no se le pide clave a nadie**: `window.__USUARIOS` queda vacío y la sala
funciona como siempre. Nunca se traba una sala por culpa de Postgres.

El bloque **redefine `tieneRangoSinVerificar()`** (gana la última declaración) para devolver true
mientras falte la clave: con eso el arranque automático, la selección por turnos y el acomodo ya
lo dejan afuera solos, sin tocar esos bloques.

**Pero el acomodo del autor no la miraba**: `movePlayersIfNeeded` (modo automatizado, sala
`todos`) y los filtros de gana-sigue metían espectadores en cada tick salteando solo a los AFK
(`p.team===0&&!afkPlayerIDs.has(p.id)`). Nuestro `onPlayerTeamChange` lo sacaba y el script lo
volvía a meter: "JINDER was moved to Blue / to Spectators" sin parar. El parcheador le agrega
`tieneRangoSinVerificar(p)` a esos 7 filtros (`🔐 El acomodo del autor no mete al que le falta la
clave`). La sala falsa **no** dispara `onPlayerTeamChange` al hacer `setPlayerTeam` (HaxBall sí):
por eso no se veía, y `pruebas/usuarios.js` lo dispara a mano en la parte "sala automática".

`npm run prueba-usuarios` cubre las tres puntas: el hash, el flujo en la sala (con el puente
falseado) y el modelo contra la base.

## Actualizaciones para el Discord  ← **LEER ANTES DE COMMITEAR**

> **Cuando el usuario pide "hacé el anuncio" (o "la actualización") significa TODO esto, sin preguntar:**
>
> 1. Las pruebas en verde, **commit y push** de todo lo que esté hecho.
> 2. Cargar la novedad con **todo lo que se hizo desde el último anuncio** que la gente pueda notar,
>    contado de forma **sencilla**: que cualquiera que juega lo entienda a la primera, sin palabras
>    técnicas (ver "Cómo se escribe" más abajo). Con el hash del commit en la columna `commit`.
> 3. Queda **pendiente**: no se manda al Discord salvo que lo pida ("mandalo", "envialo").
> 4. Avisarle qué partes funcionan recién al reiniciar las salas.

Hay un canal de Discord donde se le cuenta a la gente qué cambió. **Cada vez que se hace un
commit**, se carga una novedad en la tabla `actualizaciones`:

```powershell
npm run actualizacion -- --commit "Ahora el partido arranca solo cuando hay 2 jugadores"
```

Queda **pendiente**. No sale al Discord hasta que alguien la manda desde el panel
(📣 Actualizaciones) o con `npm run actualizacion -- --enviar`. Esa es la idea: se lee antes de
que la vea la gente.

### Cómo se escribe (esto es lo importante)

El texto es **para el que juega**, no para el que programa. Se cuenta qué cambia **cuando entrás a
la sala**, en castellano común y en una o dos frases.

| ✅ Así | ❌ Así no |
|---|---|
| "Ahora el partido arranca solo cuando hay 2 jugadores despiertos." | "Se agregó el bloque ▶️ ARRANQUE AUTOMÁTICO a script.js con revisarArranque()." |
| "El que no elige en 10 segundos sale de la sala y elige el que sigue." | "seAcaboElTiempo() ahora llama a room.kickPlayer según EcharAlQueNoElige." |
| "Las camisetas de los clubes ahora cambian en cada partido." | "cambioCami pasó a true en hosts/*.json." |
| "Se puede escribir tranquilo en el chat: los comandos solo salen con !" | "afkKeywords quedó vacío (fix del includes)." |

**Nunca** va en la novedad: nombres de archivos, funciones o variables, el hash del commit,
palabras como refactor / bug / patch / deploy / MVC / endpoint, ni detalles de la base de datos.
Si un cambio no se nota jugando (refactors, pruebas, documentación), **no se carga novedad**.

El hash del commit se guarda aparte (columna `commit`) para saber de dónde salió, pero **nunca se
manda al Discord**.

### Las piezas

| Qué | Dónde |
|---|---|
| La tabla | `actualizaciones` (modelo `Actualizacion` en `prisma/schema.prisma`) |
| Guardar / enviar / listar | `models/ActualizacionModel.js` |
| El envío a Discord | `services/WebhookActualizaciones.js` (`WEBHOOK_ACTUALIZACIONES` en `.env`) |
| La API | `routes/ActualizacionesRouter.js` → `controllers/ActualizacionesController.js` |
| La pantalla | `views/actualizaciones.html` (link en el panel) |
| Desde la terminal | `npm run actualizacion` (`actualizacion.js`) |

Columnas: `titulo` (opcional), `mensaje`, `origen` (`manual` · `commit`), `commit`, `estado`
(`pendiente` · `enviada` · `error`), `error`, `creada`, `enviada`.

`npm run prueba-actualizaciones` comprueba el circuito **sin mandar nada al Discord de verdad**
(reemplaza el envío y revisa qué le habría llegado, incluido que no se cuele nada técnico).

## Afuera de localhost (Cloudflare)

`tunel.js` (`npm run tunel [puerto]`) abre un **quick tunnel** de Cloudflare al puerto del panel
y deja la web en una URL pública `https://…trycloudflare.com`. No hace falta cuenta ni dominio:
`cloudflared tunnel --url http://localhost:<puerto>`.

`cloudflared` ya está instalado en esta máquina (`C:\Program Files (x86)\cloudflared\`). Si falta:
`winget install Cloudflare.cloudflared`, o se le pasa la ruta con `CLOUDFLARED_BIN` en `.env`.
El link **cambia en cada arranque**: es la contra de los quick tunnels.

**La web (panel + túnel) vive APARTE de las salas** (`web.js`, desde el 17/09/2026). Antes
`todas.js` los lanzaba como hijos y Ctrl+C los cortaba junto con las salas: como las salas se
reinician seguido (vencen los tokens), el link cambiaba a cada rato y se rompían los links del
mail de recuperación. Ahora:

- `npm start` mira `Web.estado()` (pid en `datos/web.pid` vivo, o el puerto 8080 contesta). Si no
  está, `prenderEnSegundoPlano()` la lanza `detached` + `unref`, con la salida en `datos/web.log`;
  si está, no la toca. Ctrl+C corta solo las salas.
- `web.js --supervisor` prende `panel/server.js` (siempre con las 4 salas: la apagada sale en rojo)
  y `tunel.js` (salvo `TUNEL_WEB=no`), y **los vuelve a prender si se caen** (5 s, 10 s… hasta 1 min).
  Si el túnel vuelve con otro link, `tunel.js` edita el mensaje del Discord y las salas lo leen solas.
- `npm run web` (primer plano) · `web:bajar` (taskkill /T /F del árbol; como así `tunel.js` no alcanza
  a avisar, el mensaje de "apagada" lo manda `bajar`) · `web:estado`.
- La web relee el `.env` cuando `npm start` le recarga el panel (ver “Base de datos”): no hace
  falta bajarla para cambiar SMTP, JWT_SECRET o webhooks. Solo `WEBHOOK_WEB` (del túnel) necesita `web:bajar`.
- Probado a mano en el 18080 con `TUNEL_WEB=no`: sobrevive al proceso que la lanza, se levanta sola
  al matarle el panel y `bajar` la apaga. No tiene prueba automática (no se abre un túnel en los tests).

**El aviso al Discord es UN SOLO MENSAJE que se va actualizando** (`services/WebhookWeb.js`):

- la primera vez hace `POST <webhook>?wait=true` — el `?wait=true` es lo que hace que Discord
  devuelva el **id del mensaje**;
- ese id se guarda en `datos/tunel.json` (ignorado por Git) y de ahí en adelante se
  `PATCH <webhook>/messages/<id>`, así el canal no se llena de links viejos;
- si el PATCH vuelve 404 (alguien borró el mensaje) se publica uno nuevo y se guarda el id;
- lleva `@here` (igual que el de actualizaciones), con `allowed_mentions: { parse: ["everyone"] }`,
  que es lo que hace que Discord notifique. Solo suena al publicar: editar no vuelve a avisar;
- al cortar con Ctrl+C el mismo mensaje queda diciendo que la web está apagada.

El webhook va en `WEBHOOK_WEB` (.env). `npm run prueba-tunel` prueba todo el circuito con `fetch`
falseado: **no manda nada al Discord ni abre ningún túnel**.

## Ñandutí Web (public/)

La web pública, con el **encarpetado de app-centralshop**: estáticos en `public/`, una carpeta
por pantalla en `public/frm/<pantalla>/index.html`, y `css/` y `js/` compartidos.

```
public/index.html                     la portada (Ñandutí Web)
public/frm/login/index.html           iniciar sesión
public/frm/registro/index.html        crear cuenta
public/frm/panel/index.html           el panel de siempre  ← solo admins
public/frm/rangos/index.html          ← solo admins
public/frm/actualizaciones/index.html ← solo admins
public/frm/recuperar/index.html       recuperar la cuenta con un link por correo
public/frm/cuenta/index.html          Mi cuenta: datos y cambiar la contraseña con código
public/css/nanduti.css                estilo común (el panel trae el suyo aparte)
public/img/logo.png                   el logo
public/js/sesion.js                   la sesión: token, barra de arriba, candado
```

Las rutas las sirve `VistasRouter` → `VistasController`, y `app.js` publica `public/` con
`express.static`. Se dejaron los atajos viejos `/panel`, `/rangos` y `/actualizaciones`.

**El usuario de la web es el mismo que el de la sala**: tabla `usuarios`. El que hace
`!registrar` en HaxBall entra acá con eso, y el que se crea la cuenta acá después entra a la
sala con `!clave`.

**El rango sale de `roles.json`** (`SesionModel.rangoDe()`), que es donde vive hoy la lista de
OWNER / CO-OWNER / etc. El que tiene un rango con `admin: true` ve el botón del panel; el resto
ve la portada normal. La tabla `rangos` de la base existe pero todavía no se usa para esto.

**El token (JWT)** lo firma `SesionModel` con `JWT_SECRET` (.env):

- dura **90 minutos** (`MINUTOS_DE_VIDA`);
- cuando le quedan menos de 45 (`MINUTOS_PARA_RENOVAR`), `/api/auth/yo` devuelve **uno nuevo** y
  la web lo guarda — así el token va cambiando y nadie se cae de golpe;
- `Sesion.mantener()` lo pide cada 20 minutos mientras la pestaña esté abierta;
- cada token lleva un `sid` al azar, para que dos seguidos nunca salgan iguales.

Sin `JWT_SECRET` funciona igual, pero con una clave al vuelo: las sesiones se caen al reiniciar
(se avisa por consola).

**El candado del panel es del lado del navegador** (`Sesion.exigirAdmin()` redirige al login):
la API sigue abierta como hasta ahora. Está `middlewares/verificarToken.js` listo para cerrarla
(`verificarToken({ admin: true })`), pero antes hay que hacer que las pantallas del panel manden
el `Authorization` en cada pedido.

**Diseño (17/09/2026)**: `public/css/nanduti.css` es un sistema de tokens en `:root` con modo claro y
oscuro (`prefers-color-scheme`), fuente Inter (Google Fonts) y un solo acento azul. Sin emojis en la
interfaz: el logo es `public/img/logo.png`. Lo usan solo las pantallas públicas (portada, login,
registro, recuperar, cuenta); las del panel siguen con su `<style>` propio. Ojo: `[hidden]` va con
`!important` porque `.caja`/`.tarjeta` tienen `display`.

**La barra** (`Sesion.pintarBarra`): con sesión es un botón con avatar (`Sesion.inicial()`, la primera
letra o número del nick) que abre un menú: Inicio, Mi cuenta, Cambiar contraseña, Panel (si es
admin) y Cerrar sesión. Se cierra con clic afuera o Escape.

**La portada con sesión** muestra *Tu ELO* (`GET /api/cuenta` → `cuenta.elo`) y el ranking
(`GET /api/ranking?limite=100`) con buscador y tu fila marcada. El ELO sale de `elo.json`, que va
por auth: `EloModel.deNick()` busca por nombre y, si hay varias fichas, se queda con la de más
partidos. **`/api/ranking` no trae `clave`** (que es `auth:<PublicID>`): `/api/elo`, que sí la trae,
queda para el panel.

**Mi cuenta** (`public/frm/cuenta/`, migración `20260917120000_usuarios_codigo`): cambiar la
contraseña pide un **código de 6 números por correo** (`CuentaModel`):

- `POST /api/cuenta/codigo` → `crypto.randomInt`, guarda `sha256(id:codigo)` en `codigoHash`, vence
  a los 10 min (`codigoVence`), y no deja pedir otro antes de 60 s (`codigoPedido`). Si el mail no
  sale, borra el código para que pueda volver a pedir.
- `POST /api/cuenta/clave {codigo, clave}` → compara con `timingSafeEqual`; cada error suma
  `codigoIntentos` y a los 5 se quema. Al acertar pone la clave y borra el código **y** cualquier
  link de recuperación pendiente.
- `POST /api/cuenta/email {email, clave}` → para los que no tienen correo; pide la contraseña actual.
- Todo con `verificarToken()`: **el nick sale del token**, nunca del cuerpo del pedido.

**Correo y recuperar la cuenta** (migración `20260917090000_usuarios_email`):

- `usuarios.email` (único, en minúsculas). La web lo **exige** (`SesionModel.registrar`); desde la
  sala no se pide, por eso en `UsuarioModel.registrar` es opcional. Los usuarios viejos quedan con `null`.
- **El correo tiene que existir** (17/09/2026). Ningún servidor confirma que una casilla exista
  (Gmail no contesta eso), así que son dos capas:
  1. `lib/correos.js` → `revisarQueExista()`: formato, reglas del nombre de Gmail (6 a 30 letras,
     números y puntos, sin `..`) y registro **MX** del dominio (`gmial.com` → "Ese correo no existe").
     Si el DNS no contesta (sin internet) deja pasar. Las pruebas cambian el DNS con `usarResolver(fn)`.
  2. **Registro en dos pasos** (`models/RegistroModel.js`): `POST /api/auth/registrar/codigo`
     manda un código de 6 números; `POST /api/auth/registrar` con `codigo` crea la cuenta. Si el
     correo no existe, el código no llega y no hay cuenta. Lo pendiente vive **en memoria** (hash
     atado a correo + nick, 10 min, 5 intentos, 60 s entre pedidos); la clave no se guarda ahí.
  `CuentaModel.ponerEmail` usa la capa 1.
- `RecuperarModel`: `pedir({email})` genera 32 bytes al azar, guarda **solo el SHA-256** en
  `recuperarHash` con `recuperarVence` (30 min) y manda el mail; `revisar(t)` y `cambiar({token, clave})`
  lo usan y lo borran (una sola vez). `pedir` contesta **lo mismo** exista o no el correo.
- El link del mail sale de `WEB_URL` → la URL de `datos/tunel.json` → localhost. **Nunca del
  `Host` del pedido**: con un Host falso alguien haría que el mail apunte a su página.
- `sinClave()` saca también `recuperarHash`/`recuperarVence`.
- Rutas: `POST /api/auth/recuperar`, `GET /api/auth/recuperar?t=`, `POST /api/auth/recuperar/cambiar`;
  pantalla `public/frm/recuperar/` (sin `?t` pide el correo; con `?t` cambia la clave y borra el
  token de la barra con `history.replaceState`).
- `services/Correo.js` manda por SMTP con **nodemailer** (`SMTP_HOST/PORT/USUARIO/CLAVE`,
  `CORREO_REMITENTE`). Sin SMTP no falla: imprime el mail en la consola. Las pruebas lo cambian
  con `Correo.usarEnvio(fn)`, así **no sale ningún mail de verdad**. El HTML va con estilos en
  línea (los clientes de correo ignoran `<style>`).

`npm run prueba-web` cubre las pantallas, el encarpetado, registrarse (con y sin correo, correo
repetido), entrar, Mi cuenta (código, intentos, vencimiento, agregar correo), el ranking público, el rango de OWNER (agrega y saca el nick de `roles.json`, dejándolo como
estaba), la renovación del token y todo el circuito de recuperar la cuenta.

## Anuncios (AdSense)

Publicidad en la portada, **apagada de fábrica**. Hacen falta las dos cosas a la vez, si no no
sale nada: el interruptor `mostrarAnuncios` (panel → Ajustes, solo OWNER) **y** `ADSENSE_CLIENTE`
en el `.env`. Así se pueden apagar en el acto desde el panel, sin tocar código ni bajar la web.

| Pieza | Dónde |
|---|---|
| El interruptor | `mostrarAnuncios` en el CATALOGO de `models/AjustesModel.js` |
| Lo que ve el navegador | `GET /api/ajustes/publicos` → `anuncios: { activos, cliente, espacios }` |
| El que los dibuja | `public/js/anuncios.js` |
| El estilo | `.anuncio` en `public/css/nanduti.css` |
| Los huecos | `<div class="anuncio" data-anuncio="portada-arriba|abajo" hidden>` en `public/index.html` |

- **Con los anuncios apagados la página no habla con Google**: el `<script>` de AdSense se carga
  desde JavaScript y **solo** después de que `/api/ajustes/publicos` conteste `activos: true`.
  No es solo estética: sin eso, Google pondría cookies a todo el que entre aunque no haya avisos.
- **Dos modos**, los dos andan: con solo `ADSENSE_CLIENTE` funcionan los *Auto ads* (Google decide
  dónde); si además se cargan `ADSENSE_ESPACIO_PORTADA_ARRIBA` / `_ABAJO` (el número de cada
  bloque creado en AdSense), los avisos salen **solo** en los huecos que pusimos nosotros, que es
  lo preferible para no tapar el ranking ni la tienda.
- **Responsivos**: el `<ins>` va con `data-ad-format="auto"` y `data-full-width-responsive="true"`,
  así que el alto lo decide Google según el ancho. El CSS le reserva un mínimo (100 px en
  escritorio, 260 px en teléfono) para que la página **no pegue un salto** cuando el aviso carga.
- El hueco nace con `hidden` y se esconde solo si el `push()` falla (bloqueador de anuncios):
  nunca queda un recuadro vacío con el cartelito "Publicidad".
- **Nada de anuncios en el panel ni en las pantallas con sesión**: solo la portada. Además de que
  quedarían mal, AdSense no quiere avisos en páginas sin contenido propio.
- El identificador `ca-pub-…` **no es un secreto** (va escrito en el HTML que ve cualquiera);
  está en el `.env` para poder cambiarlo sin tocar código, no para esconderlo.

## Que Google la encuentre (y que el link se vea lindo)

Desde el 20/09/2026 la web vive en **https://nandutihax.com** (antes eran links de
`trycloudflare` que cambiaban en cada arranque, así que indexarla no tenía sentido: Google
habría guardado direcciones muertas). Con dominio fijo ya se puede.

| Archivo | Para qué |
|---|---|
| `public/robots.txt` | Deja pasar la portada, entrar y crear cuenta; cierra `/api/` y todas las pantallas del panel |
| `public/sitemap.xml` | Las 3 páginas públicas, declarado al final de `robots.txt` |
| `public/img/portada.png` | 1200×630, la imagen que sale al pegar el link en Discord/WhatsApp |

**Reglas al agregar una pantalla nueva en `public/frm/`:**

1. **¿Pide sesión? Entonces `noindex`.** Va `<meta name="robots" content="noindex, nofollow">`
   justo después del `<meta charset>`, **y** su `Disallow:` en `robots.txt`. Las dos cosas: el
   `noindex` saca la página de los resultados, el `Disallow` evita que la recorra al pedo. Ya lo
   tienen panel, cuenta, inventario, config, carrusel, equipos, rangos, actualizaciones, usuarios,
   ajustes y recuperar.
2. **¿Es pública? Entonces las cuatro cosas**, copiando el bloque de `public/frm/login/index.html`:
   `<title>` propio (`Qué es · ÑandutíHax`), `<meta name="description">` de una frase, `canonical`
   con la URL absoluta, y las etiquetas `og:` + `twitter:card`. Además hay que sumarla al
   `sitemap.xml`.
3. **Las URLs absolutas van con el dominio escrito** (`https://nandutihax.com/...`), no con
   `WEB_URL`: son archivos estáticos, no pasan por Node. Si algún día cambia el dominio hay que
   buscar y reemplazar en `public/` y en `sitemap.xml`.
4. **No inventar palabras clave ni repetir el nombre**: la descripción se escribe para el que
   la va a leer en el resultado de Google, igual que las novedades del Discord.

**La imagen para compartir** se regenera con Puppeteer si cambia el logo o el lema: el script de
un solo uso arma un HTML de 1200×630 (logo + título + lema + dominio, fondo `#0f172a` con el azul
de la marca) y le saca una captura. Tiene que medir **1200×630**: con el logo cuadrado de 512
Discord lo muestra como una miniatura chica al costado en vez de una tarjeta grande.

**Ojo con `robots.txt`**: Cloudflare mete uno propio (unos comentarios largos de "content
signals") **solo si el origen no sirve ninguno**. Desde que existe `public/robots.txt` manda el
nuestro; si alguna vez vuelve a aparecer el de Cloudflare, es que el archivo dejó de servirse.

**El HTTPS** (20/09/2026): la zona tenía `always_use_https` en `off`, así que `http://nandutihax.com`
contestaba 200 por HTTP pelado y Chrome mostraba "No es seguro" al que escribía el dominio sin
`https://`. Quedó en `on` (301 al https), con `min_tls_version` en 1.2 y `automatic_https_rewrites`
en `on`. **HSTS sigue apagado a propósito**: los navegadores se lo guardan por meses y no hay
forma de volver atrás rápido si el túnel se cae. Ninguna página de `public/` carga nada por
`http://`, así que no hay contenido mixto; **si se agrega algo de afuera, tiene que ser `https://`**.

**Lo que no depende del código**: darla de alta en Google Search Console (verificación por TXT en
Cloudflare), mandar el sitemap y pedir la indexación. Eso es a mano y con la cuenta del usuario, y
tarda de días a semanas. `public/` son estáticos: se leen del disco, así que **estos cambios no
necesitan recargar el panel**.

## Panel y rangos (MVC)

La capa HTTP está en **modelo–vista–controlador** con Express, copiando las convenciones de
`app-centralshop` (el otro proyecto del usuario): `XxxRouter.js` → `XxxController.js` (métodos
estáticos `(req, res, next)`, `_ctx(req)` para el contexto) → `XxxModel.js` (la lógica y los datos).

| Carpeta | Qué hay |
|---|---|
| `routes/` | EstadoRouter, SalasRouter, EloRouter, RangosRouter, ModeracionRouter, VistasRouter |
| `controllers/` | Uno por router; solo validan y responden |
| `models/` | EstadoModel, SalasModel, EloModel (envuelve `lib/elo.js`), RangosModel (envuelve `lib/rangos.js`), ModeracionModel |
| `public/frm/` | Las pantallas (el panel se movió a `public/frm/panel/index.html`) |
| `app.js` | `crearApp({ sala, salas })` arma la app; `panel/server.js` y `launcher.js` solo la levantan |

**Dos modos, una sola app**: `launcher.js` le pasa `sala` (un adaptador
`{ estado(), expulsar(id, motivo, banear) }` que habla con la página de Puppeteer) y
`panel/server.js` le pasa `salas` (las remotas, que consulta por HTTP). El contexto viaja en
`app.locals` y los controllers se lo pasan a los models con `_ctx(req)`: los models **no guardan
estado global**, por eso `pruebas/api.js` puede levantar la sala y el panel en el mismo proceso.

**Se conservaron las respuestas de siempre** (`/api/estado` devuelve el estado pelado, no un
envelope `{status, data}` como en app-centralshop): las pantallas del panel ya las leen así y
cambiarlas era romper la vista sin necesidad.

`EstadoModel.crear()` define la forma del estado y `EstadoModel.agregarMensaje()` recorta el log
a 500 mensajes. El launcher sigue escribiendo los campos (`estado.link`, `estado.jugadores`…)
desde el espía de Puppeteer: ese puente no es HTTP y quedó donde estaba.

**El espía del panel** (`lib/espia.js`, `crearSalaEspiada`): un Proxy sobre el objeto `room` que
mira los eventos sin reemplazar los handlers del script. El launcher se lo manda a la página con
`toString()` + `new Function` (en el navegador no hay `require`), por eso tiene que ser una
función autosuficiente: nada de closures ni de imports.

La capa que registra se instala **una sola vez por evento**; el handler de verdad se guarda en
`handlers[prop]` y las reasignaciones solo lo reemplazan. Leer `room.onX` devuelve ese handler
pelado, sin nuestra capa. Sin eso, cada reasignación agregaba una capa que registraba lo mismo:
como `onPlayerChat` lo tocan el script, la selección por turnos y los modos de equipos, **el panel
mostraba cada mensaje 3 veces** (y las entradas 5, por los 5 bloques que enganchan `onPlayerJoin`).

**Nunca reemplazar un handler del script sin llamar al anterior.**

`npm run prueba-espia` (`pruebas/espia.js`) encadena tres handlers a mano y después corre
`script.js` entero con `abrirSala(config, { espiar: true })`, comprobando que cada mensaje,
entrada, salida y arranque deje **un** evento.

`roles.json` = rangos + clave. `lib/rangos.js` lo lee y lo guarda; la clave nunca se manda al
navegador (`sinClave`). El launcher lo inyecta como `window.__RANGOS` antes de correr el script y
lo vigila con `fs.watch`: al cambiar llama a `window.__rangosActualizar` (recarga en caliente).

El bloque `🎖️ RANGOS` del script le da el rango (y el admin si corresponde) a quien entre con un
nick de `roles.json`. Ya no se pide clave.

**Express** es la única dependencia además de puppeteer. Por eso el servicio `panel` de
docker-compose ya no usa `node:22-alpine` pelado: construye la misma imagen que las salas
(que trae `node_modules`) y solo cambia el `command`.

`npm run prueba-api` (`pruebas/api.js`) levanta las dos apps con `listen(0)` y prueba los
endpoints contra HTTP de verdad. Usa `ROLES_FILE` y `ELO_FILE` apuntando a una carpeta temporal
— hay que definirlos **antes** de requerir `app.js`, porque `lib/` los lee al importarse.

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

Sobre esa base, `npm run parchar` aplica lo de ÑandutíHax. Como el script ya trae su chat y su árbitro, el parcheador **salta** los bloques `💬 COMANDOS DEL CHAT` y `🧑‍⚖️ ARBITRAJE` (quedan en `parches/bloques/` por si vuelve a hacer falta).

**Webhook oculto → desactivado** en cada parcheo: `var webhookID=null` con el link comentado arriba (buscar `WEBHOOK OCULTO DEL AUTOR`) y el `fetch(webhookID,…)` fuera del `onPlayerJoin` ofuscado. **No reactivar**: enviaba nombre, IP (`player.conn`) y auth de cada jugador a un Discord ajeno.

Handlers ofuscados de esta versión: `0x1cb` onRoomLink · `0x1bc` onStadiumChange · `0x12f` onPlayerJoin · `0x138` onPlayerTeamChange · `0x19c` onGameTick.

## Parches (`npm run parchar`)

`parches/aplicar.js` reaplica **todo lo de ÑandutíHax** sobre cualquier `script.js`: corta la última línea si viene truncado, desactiva el webhook oculto, cambia la marca GLH → ÑandutíHax, pone las camisetas paraguayas (`parches/camisetas.js`), ajusta los umbrales del modo automático y agrega los bloques de `parches/bloques/` (compat, rangos, arbitraje, comandos, bienvenida).

Es idempotente y **condicional**: si el script nuevo ya trae `room.onPlayerChat` o `room.onTeamGoal`, no agrega esos bloques. `--ver` hace una pasada en seco. Guarda `script.anterior.js`.

**Al tocar los bloques, editarlos en `parches/bloques/` y correr `npm run parchar`** — no editar el final de `script.js` a mano, porque el parcheador lo reescribe.


## Física de la pelota (solo futsal)

La pelota del autor se frenaba sola enseguida. Desde el 20/09/2026:

| | Autor | Ahora | Qué es |
|---|---|---|---|
| `damping` | 0.99 | **0.9888** | Cuánta velocidad conserva por tick (60/s). Lo que se siente es cuánto lejos llega, y eso va como 1/(1-damping): **0.9888 → 89** · 0.990 → 100 · 0.991 → 111 · 0.993 → 143 |
| `bCoef` | 0.4 | **0.5** | Cuánto rebota contra paredes y jugadores (0.5 es el normal de HaxBall) |
| `invMass` | 1.5 | 1.5 (igual) | El **peso**. No se tocó: cambia cuánto la mueve cada patada y cuánto la empujan al correr, que es otro problema |

**Va en DOS lugares y tienen que coincidir**, esta es la trampa:

1. `mapas/generar.js` → `FISICA_PELOTA`, que `pintarPelota()` le pone al disco 0 de los 4 mapas.
2. `parches/aplicar.js` → `⚽ Física de la pelota de futsal`, dos reemplazos (normal y powershot).

El segundo es imprescindible: el script **pisa** la pelota en vivo con
`room.setDiscProperties(0, {...})` cada vez que se prende o se apaga el powershot. Si solo se
cambia el mapa, la pelota vuelve a la vieja en el primer powershot. Si se cambia un lado solo,
el juego queda inconsistente según si hubo powershot o no.

**Real Soccer no se toca** (pedido del usuario): usa sus propios mapas y sus propias líneas
(`invMass:1.05`, `PelotaRS`). Al buscar en el script, las de futsal se reconocen por
`invMass:1.5` / `PotenciaPowerShot` y `PelotaFutsal`.

Bajó **dos veces** a pedido del usuario ("bajá un 20%" cada vez): 0.993 → 0.991 → 0.9888. Terminó
un poco **por debajo** de la del autor (89 contra 100), o sea que hoy la pelota se frena antes que
en el script original. Se le avisó y lo eligió así.

Si vuelve a pedir que sea "menos fuerte", el damping ya no es el problema: lo que queda es el
**rebote** (`bCoef` 0.5, era 0.4 en el original) o el **peso** (`invMass` 1.5 — más peso, o sea
un número más chico, la hace salir más lenta de cada patada).

**El parcheador busca el valor del autor Y los nuestros de antes** (`DAMPING_VIEJOS`): sin eso, al
cambiar el número no pasaba nada, porque `script.js` ya no tenía el texto original y el reemplazo
decía "no se encontró". Si se vuelve a cambiar, agregar el valor viejo a esa lista.

Orden para cambiarlo: tocar los dos lugares → `npm run generar-mapas` → `npm run parchar` →
`npm run prueba-mapas`. **Se nota recién al reiniciar las salas.**

## Mapas propios de futsal

`npm run generar-mapas` (`mapas/generar.js`) copia los mapas de futsal del autor desde `script.js`, les cambia el nombre y les deja la **pelota amarilla lisa** (saca las pintitas negras de la pelota "oveja"). Escribe `mapas/nanduti-futsal-x{3,4,5,7}.hbs`.

**Cuidado con los joints**: el template ata las pintitas a la pelota con joints. Si se borran los discos sin borrar esos joints, quedan atando la pelota a los postes del arco y la cancha se vuelve injugable — y `npm run prueba-mapas` lo da por bueno igual, porque HaxBall acepta el mapa. `pintarPelota()` borra discos y joints juntos y reindexa.

El parcheador inyecta los `.hbs` como `function getFutx3Map()` etc. **al final** de `script.js`: en JS gana la última declaración, así que pisan a las del autor sin editarlas. Orden: `npm run generar-mapas` y después `npm run parchar`.

Probar sin abrir sala: `node pruebas/render.js mapas/nanduti-futsal-x3.hbs vista.png [logo]` dibuja el mapa como imagen.

## Selección por turnos

Bloque `🎽 SELECCIÓN POR TURNOS` (`parches/bloques/turnos.txt`). Los dos primeros espectadores pasan solos como capitanes y después se elige alternando: el capitán del equipo de turno escribe **el número solo** (`7`) en el chat; también valen `!7` y `!elegir 7`. El número pelado se toma como elección **solo si a esa persona le toca elegir** (`puedeElegir`), así que para el resto de la sala un número sigue siendo un número. **El número es la posición entre los espectadores, sin el bot** (`!1` = el primer espectador de la lista), no el id de HaxBall: `espectadoresEnOrden()` / `numeroDe()`. Si esa posición es alguien AFK o sin clave, avisa y no lo elige. En las pruebas se calcula con `numero(j)`; ojo que con pocos jugadores la posición coincide con el id, por eso `pruebas/turnos.js` lo revisa cuando ya no coinciden. Si no elige en `SegundosParaElegir`, elige el bot.

Ya **no** se prende desde `hosts/*.json`: lo prende y lo apaga `aplicarModoDeEquipos()` (bloque 🔀 MODOS DE EQUIPOS) según el modo de la sala, y por eso los enganches del bloque se registran siempre (antes el IIFE cortaba con `if (!SeleccionPorTurnos) return`, y el modo no se podía cambiar en caliente). Exige `modoJueganTodos`, `modoJueganAlgunos` y `automatizadoActivado` en `false`: si el script acomoda jugadores por su cuenta, se pisan entre sí; de eso también se encarga ese bloque.

**El reloj del capitán**: `SegundosParaElegir` (35) con cuenta regresiva en el chat los últimos
`SegundosDeCuenta` (3). `prepararCuentaRegresiva()` arma un setTimeout por segundo y
`frenarReloj()` los limpia todos (si eligió, no se cuenta al pedo). Al vencer, `seAcaboElTiempo()`
echa al capitán (`EcharAlQueNoElige`, o lo manda a espectadores y al final de la fila) y
`revisarTurnos()` pone de capitán al que ya estaba en ese equipo, o a un espectador si quedó
vacío. A los admins y al bot no se los echa: ahí elige el bot, como antes.

Ojo con el motivo del kick: el bloque compat se traga los `kickPlayer` cuyo motivo hable de
AFK o INACTIVIDAD, así que el texto tiene que ser otro.

`draftPendiente()` dice si quedó una elección a medio hacer (turnos prendidos + espectadores listos + lugar libre). Lo usa el arranque automático para no arrancar el partido en el medio del draft. `elegirJugador()` no deja meter a nadie en un equipo lleno.

`npm run prueba-turnos [hosts/4v4.json]` usa el arnés con reloj virtual (`sala-falsa.js`) y cubre
las dos mitades: los capitanes eligiendo a tiempo y el que se cuelga (cuenta 3…2…1, lo echan y
sigue el que ya estaba). Dos trampas del arnés que costaron encontrar:

- **Los jugadores tienen que entrar espaciados** (`entran()` deja 700 ms entre uno y otro): el
  script echa al 5º que entra dentro de los mismos 2 segundos ("Demasiados ingresos en poco
  tiempo"). Vale para la sala de verdad: si cae una banda junta desde el Discord, a varios los rebota.
- **No usar los nombres "Jugador1"…"Jugador20"**: están en la `ListaDeJogadores` de ejemplo del
  autor con auths falsos (`authid_jugadorN`), y el anti-DU echa a cualquiera que se llame así.


## Arranque automático

Bloque `▶️ ARRANQUE AUTOMÁTICO` (`parches/bloques/autoarranque.txt`), activo en las 4 salas.
`revisarArranque()` corre cada 2 s y hace dos cosas:

- **Sin partido** (alguien le dio a Stop): arranca de nuevo pasados `SegundosTrasParar` (5 s, el
  respiro es para no pisar un cambio de mapa) si hay `JugadoresParaArrancar` (2) jugadores
  despiertos. Acomoda espectadores solo si la sala no usa `SeleccionPorTurnos`.
- **Partido pausado**: lo reanuda pasados `SegundosDePausaMaxima` (10 s), también con 2 despiertos.
- **Mientras los capitanes eligen** (`draftPendiente()`): si había partido en curso lo **pausa**
  y no lo reanuda hasta que los equipos estén completos; ahí vuelve enseguida, sin esperar los
  10 segundos de la pausa normal (`pausadoPorElDraft`).
- **Partido terminado** (`onTeamVictory`): lo cierra pasados `SegundosTrasVictoria` (8 s). Hace
  falta porque con `ganasigueEnabled` en `false` **el script no cierra nunca el partido** (el
  único `stopGame()` tras la victoria está en una definición vieja de `onTeamVictory`, pisada
  por la de la línea ~18899), y la sala se quedaba con el marcador final puesto. `onGameStart`
  borra la marca, así que si el gana-sigue ya arrancó otro partido no lo tocamos.
- **Mientras se elige** (`draftPendiente()`): no arranca, para no dejar afuera a los que esperan.

"Despierto" = `disponiblesParaJugar()`: sin el bot (id 0), sin AFK (`afkPlayerIDs`) y sin rangos a
medio verificar. Si uno de los dos está AFK no se arranca ni se reanuda.

**Cómo se detecta la pausa**: la API no lo dice, así que el bloque envuelve `onGameTick` y guarda
`ultimoTickVisto`. Si hay partido pero hace más de 1,5 s que no entra un tick, está pausado. Es
más confiable que esperar el evento `onGamePause`, que puede perderse si otro código pisa el
handler. `isGamePaused` (del script) y `pausadoDesde` quedan como respaldo.

`window.__acomodarSala` (bloque compat) **ya no arranca partidos** cuando `AutoArranque` está
prendido: arrancaba cada 2 s sin respetar el respiro después del Stop y podía meterse en medio de
un cambio de mapa (`stopGame` → `setCustomStadium` → `startGame`).

`npm run prueba-arranque` (`pruebas/autoarranque.js`, con `hosts/todos.json` y `hosts/3v3.json`)
usa el arnés de **reloj virtual** `pruebas/sala-falsa.js` (ver “Probar sin gastar tokens”).
Apaga `automatizadoActivado` antes de las pruebas de AFK: ese modo hace `stopGame`+`startGame`
cada vez que cambia la cantidad de jugadores despiertos y tapaba lo que se quería probar.

## Camisetas: el cambio automático venía apagado

`swapTeamColors()` corre dentro de `onGameStart` (línea ~18214) pero solo hace algo
`if (cambioCami)`, y el autor lo dejaba en `false` (línea 92) — por eso los equipos salían
siempre con la misma camiseta aunque el parche de camisetas paraguayas sí estuviera aplicado.
Las 4 salas lo prenden con `"cambioCami": true` en `hosts/*.json`.

La rotación en sí: `shuffleOptions()` elige una pareja de `opciones` (28 cruces, con `demanda`
como peso; Olimpia vs Cerro es el más pesado), evita repetir las últimas 5 y llama a
`opcion.partido()`, que hace los dos `room.setTeamColors` y fija `teamRed`/`teamBlue`.
Detalle del autor: `swapTeamColors()` vuelve a llamar a `partido()` después de `shuffleOptions()`,
así que la misma camiseta se aplica dos veces por partido. Es inofensivo.

`CamisetasGanaSigue` (`!togglecamisetas`) es el otro modo: el ganador mantiene la camiseta y solo
cambia el que pierde (en `handleTeamVictory`). Viene apagado y los dos comandos se apagan entre sí.

`npm run prueba-camisetas` arranca 8 partidos y comprueba que los clubes vayan cambiando. El arnés
`sala-falsa.js` guarda cada `setTeamColors` en `sala.camisetas`.

### La camiseta comprada le gana al sorteo

Bloque `👕 EQUIPOS` (`parches/bloques/equipos.txt`). El que compró una camiseta en la tienda se la
pone con `!camiseta <club>` y **su equipo juega con esa**, pisando el sorteo automático. Se aplica
en un `setTimeout(300)` colgado de `onGameStart`, o sea **después** de `swapTeamColors()`, que
corre sincrónico ahí adentro.

**Cuánto le dura** (20/09/2026): desde que la elige **hasta que se va de la sala o se cambia de
equipo**. Gana y sigue, cambia de partido, se apaga y se prende la elección: la camiseta queda.
Cuando se va, `olvidarCamisetaDe()` la borra y vuelve la del sorteo.

Eso obligó a **acordarse de quién la eligió** (`camisetaDelEquipo`: equipo → nick). Antes se
miraba `hayCapitanes()` (o sea `SeleccionPorTurnos`) en el momento de aplicarla, y en el modo
**combinado** eso se apaga solo entre partidos cuando no sobra gente: al arrancar el siguiente ya
no había capitán, no se aplicaba nada y salía la del sorteo. El comando prometía "la vas a usar en
el próximo partido" y era mentira. Ahora `duenoDeLaCamiseta(equipo)` devuelve al que la eligió si
**sigue en ese equipo**, y solo si no hay ninguno recordado cae al capitán de turno.

Quién puede cambiarla sigue igual: con la elección prendida, **solo el capitán** (`esCapitan`).

**Trampa al probar esto**: mandar a alguien a espectadores **no** lo saca del equipo. El acomodo
automático lo devuelve a la cancha apenas arranca el partido, así que su camiseta sigue mandando
(y está bien). Para probar que vuelve la del sorteo hay que sacarlo de la sala (`sala.sale(id)`).

## Avisos sin spam

Bloque `🔕 AVISOS SIN SPAM` (`parches/bloques/avisos.txt`, va antes de ⚙️ CONFIGURACIÓN). Envuelve
`room.sendAnnouncement` y frena los carteles **para toda la sala** que el autor manda en cada
partido (`LinkDelScript*`): "Escribe !help", `Anuncio`,
`Anuncio2` y el tutorial de YouTube cada 10 min (`ReglasDeAvisos`); "E S T A N  J U G A N D O" sale en cada partido (pedido del usuario). No se sacan, se espacian.
Lo que va a **un jugador** (destino con id) nunca se frena. Los avisos nuestros van por su variable:
clave (iniciar sesión) `SegundosEntrePedidosDeClave` = 60 (se revisa cada 5 s, así no queda en 2 min),
crear cuenta `MinutosEntreAvisosDeRegistro` = 5, Discord `MinutosEntreAvisos` = 10.
`prueba-discord` lo cubre.

## Los comandos no se ven en el chat

Bloque `🤫 COMANDOS SIN ECO` (`parches/bloques/comandos-sin-eco.txt`), **el último de todos**:
envuelve a los demás handlers, los deja trabajar y después se queda con el mensaje si empieza
con `!`. Así nadie ve la clave del otro cuando escribe `!clave loquesea`.

El script del autor devolvía `true` después de ejecutar un comando (`commands[...](); return !0`),
por eso los comandos se veían. Se apaga con `MostrarComandosEnElChat = true`.

Lo que no es comando sale normal, incluidas las formas de hablar del script: `t `, `ac ` y `@@`.

## Chat: comandos solo con `!`

El chat del autor tenía dos disparadores que se comían la charla normal:

1. `const afkKeywords=["mtm","meteme","volvi","estoy","listo"]` con `message.includes(keyword)`:
   cualquier frase con esas palabras prendía o apagaba el AFK (y adentro de esa rama vivía el
   anti-flood, que también comía mensajes). El parcheador lo deja en `const afkKeywords=[]`
   (`💬 Palabras sueltas que prendían el AFK` en `parches/aplicar.js`); el AFK queda solo en `!afk`.
2. Nuestro bloque de turnos tomaba cualquier número suelto como elección. Ahora el regex es
   `/^!(?:elegir\s*)?(\d{1,3})$/i`: se elige con `!7` o `!elegir 7`.

Lo único que queda sin `!` son formas de hablar, no comandos: `t ` (equipo), `ac ` (admins),
`@@nick` (privado). Los filtros que sí pueden frenar un mensaje son de admin: `palabrasSilenciadas`
(`!silenciar`), el mute y `chatPausado`.

Ojo al probar comandos seguidos: el script tiene `commandCooldown = 5000` por jugador (los admins
no esperan), así que en los tests hay que mover el reloj entre dos comandos del mismo jugador.

`npm run prueba-chat` (`pruebas/chat.js`) cubre las frases con esas palabras, el número suelto,
`!7`, `!elegir N` y que el mensaje igual se vea en el chat.

## Modos de equipos

Bloque `🔀 MODOS DE EQUIPOS` (`parches/bloques/modos.txt`), después del de arranque automático
porque prende y apaga sus interruptores. `ModoDeEquipos` vale:

| Modo | Comando | Qué deja prendido |
|---|---|---|
| `ganasigue` | `!ganasigue` | Rotación **nuestra** (`rotarGanaSigue`): el que gana se queda y pasa a **Red**, el que pierde sale al final de la fila y entran los que esperaban. Apaga `ganasigueEnabled`, `automatizadoActivado` y `modoJueganAlgunos` |
| `elegir` | `!elegir` | `SeleccionPorTurnos` siempre; apaga gana-sigue, juegan-todos/algunos y automatizado |
| `combinado` | `!combinado` | Igual que `elegir` **solo si** `hayJugadoresDeMas()`; si no, acomoda y arranca solo |
| `config` | — | Valor de fábrica: no toca nada, manda `hosts/*.json` |

`!modo` (cualquiera) muestra el modo puesto. Los tres comandos son solo para admins e
interceptan el chat **antes** que el script: `!ganasigue` ya existía como interruptor del autor
(línea ~18498) y ahora lo pisa el comando de modo, que devuelve `false` para que no se ejecute
el toggle viejo.

**El gana-sigue del autor (`ganasigueEnabled`) queda APAGADO a propósito** (19/09/2026): dejaba al
ganador en su lado, rellenaba el equipo perdedor con los que esperaban y reiniciaba el partido solo
(`if(ganasigueEnabled)` en la línea ~18898). Además `movePlayersIfNeeded` (que corre con
`modoJueganAlgunos`) equilibraba los equipos moviendo gente en pleno juego, así que el ganador nunca
se quedaba. Ahora los lugares libres los llena `llenarGanaSigue()`. La rotación usa **una foto de
los equipos tomada en `onTeamVictory` antes de llamar al handler del autor**, porque para cuando
corre (3,5 s después) ya hay gente movida.

**Con un partido en curso ahora sí se prende la elección** (`aplicarModoDeEquipos`): prender el
draft no mueve a nadie, y hace que el arranque automático **pause el partido** cuando queda lugar.
Antes había que esperar a que terminara y parecía un gana-sigue: la gente seguía jugando, no elegía
y se la echaba.

`hayJugadoresDeMas()` = jugadores despiertos > `maxPlayersPerTeam * 2` (más de 6 en la x3, más
de 8 en la x4). `aplicarModoDeEquipos()` corre cada 2 s, al entrar y al salir gente, y **no hace
nada con un partido en curso** salvo que se lo fuerce: si no, movería gente en pleno juego.

`rearmarTrasElPartido()` (3,5 s después de `onTeamVictory`): si el modo es con elección y hay
gente esperando, vacía la cancha y se vuelve a elegir. Llama a `aplicarModoDeEquipos(true)` **a
la fuerza** porque el partido recién terminado sigue "en curso" hasta que el arranque automático
lo cierra, y si no `modoJueganAlgunos` sigue prendido y `__acomodarSala` vuelve a llenar la
cancha al instante. Usa `room.reorderPlayers(ids, false)` para mandar al final de la fila a los
que acaban de jugar: así los capitanes salen de entre los que estaban esperando.

Las salas 3v3 y 4v4 traen `"ModoDeEquipos": "combinado"` en su JSON (reemplazó a
`"SeleccionPorTurnos": true`, que ya no se configura a mano). `npm run prueba-modos` lo prueba
con `hosts/3v3.json` y `hosts/4v4.json`.

## Aviso de sala abierta (Discord)

Bloque `📣 AVISO DE SALA ABIERTA` (`parches/bloques/aviso-discord.txt`). Publica una tarjeta
(embed) en el Discord de ÑandutíBall cuando HaxBall entrega el link.

**Cómo se engancha**: redeclara `sendLinkToDiscord()`, que el `onRoomLink` ofuscado llama con el
texto ya armado. Como es una *function declaration* y nuestro bloque va al final, gana la última
declaración (el mismo truco que los mapas) y no hay que tocar la zona minificada. El texto del
autor se descarta: el link sale de `roomLink` (variable global que el handler deja puesta), con
una regex de respaldo. Además se envuelve `room.onRoomLink` por si esa llamada desapareciera;
`ultimoLinkAvisado` evita el aviso doble.

La plantilla (`TituloSalaAbierta`, `MensajeSalaAbierta`, `BotonSalaAbierta`, `PieSalaAbierta`)
admite `{sala} {link} {mapa} {cupo} {modo} {ubicacion} {discord}`, que resuelve
`datosDeLaSala()`. `{modo}` sale de `nombreDelModo(ModoDeEquipos)` si el bloque de modos está.

**Desde la sala NO sale nada a Discord** (20/09/2026, a pedido del usuario: "no quiero que las
webhooks estén expuestas afuera en el juego"). La página corre en el navegador: cualquiera con la
consola abierta vería la credencial, así que ya no se le inyecta (`window.__WEBHOOK_SALA` se
eliminó). El bloque arma la tarjeta y la empuja a `window.__panelCola` como
`{tipo:"sala-abierta", link, cuerpo}`; el launcher (`avisarSalaAbierta`) la manda con
`WEBHOOK_SALA_ABIERTA` de `.env`. Ese webhook (llamado "Avisador") no está en ningún archivo del repo.

**Los webhooks del autor quedaron vacíos** (`🔒 Webhook del autor: …` en `parches/aplicar.js`):
llamar admins, mensajes del chat, boletero, estadísticas, fichajes, IPs, grabaciones (dos),
kicks/bans y `webhookPass`. Le mandaban el chat y las IP de **nuestras** salas a un Discord ajeno.
Además está el candado del bloque `🔒 NADA SE VA A DISCORD DESDE LA SALA`
(`parches/bloques/sin-webhooks.txt`): envuelve `fetch` y `XMLHttpRequest` y frena cualquier envío a
`discord.com/api/webhooks`, incluso de código que aparezca en una versión nueva del script. Lo
único que queda es la URL del webhook oculto **dentro del array ofuscado** (`_0x24f1`), que es texto
muerto: `webhookID=null`, el `fetch` fue quitado y el candado lo frena igual. **No tocar ese array**:
el IIFE que lo rota depende de su contenido.

**Ojo con los webhooks vacíos**: al dejarlos en `""`, el `fetch("", {method:"POST"})` del autor no
falla — se resuelve contra **la propia página de HaxBall** y manda un POST ahí, que contesta
`405 Method Not Allowed`. La consola se llenaba de 405 en cada entrada y salida. Por eso el candado
frena también los envíos **sin dirección** (`esEnvioSinDestino`), no solo los de Discord.

`prueba-discord` lo cubre: la sala no conoce ningún webhook, no manda nada por fetch ni por XHR
(ni a Discord ni a una URL vacía), y los del autor están vacíos.

El parcheador también reemplaza dos cosas de la configuración del autor: `DiscordLink`
(`discord.gg/tDEUbJU8QB` → `discord.gg/TGRug4BGG`) y el webhook de `AnuncioHostAbierto`, que
era del autor y recibía el link de **nuestras** salas.

**La invitación en el chat**: `avisarDiscordEnElChat()` con un `setInterval` de
`MinutosEntreAvisos` (10). No habla con la sala vacía. Usa la misma `completarPlantilla()` que el
embed, así que `MensajeDiscordEnElChat` admite `{discord}`, `{sala}`, `{link}`…

Ojo: el script del autor ya trae un `setInterval` cada 10 minutos (dentro del `onRoomLink`
ofuscado, línea ~18142) que **nunca funcionó**: el callback espera un jugador
(`_0x1b3d6f.id`) y `setInterval` no le pasa ninguno, así que tira `Cannot read properties of
undefined` cada 10 minutos y sus dos anuncios no salían nunca. **Arreglado el 20/09/2026**
(`📣 El cartel de la marca salía roto cada 10 minutos` en `parches/aplicar.js`): se le manda
`null` como destino, así van a toda la sala, y se pasó de 10 a 30 minutos (`0x927c0` →
`0x1b7740`), porque cada 10 ya sale la invitación al Discord y tres carteles juntos son spam.
Los dos textos (`0x1ab` y `0x180`) ya llevan nuestra marca, los pisó el parche de nombre.

`npm run prueba-discord` (`pruebas/aviso-discord.js`) dispara `onRoomLink` y revisa el embed. El
arnés `sala-falsa.js` guarda en `sala.webhooks` todo lo que el script manda por XMLHttpRequest,
así que también comprueba que el link no viaje a ningún webhook ajeno.

## ELO (lib/elo.js)

Puntaje por jugador, guardado en `datos/elo.json` **del lado de Node** (no en localStorage): así sobrevive al cierre de la sala y **las 4 salas comparten la tabla**. La clave es `auth:<PublicID>` y cae a `nick:<nombre>` solo si no hay auth.

Circuito: el bloque `📊 ELO Y DIVISIONES` del script anota quién está en cancha al arrancar, y en **`onTeamVictory`** empuja `{tipo:"elo-partido", red, blue, ganador, golesRed, golesBlue, mapa, goles}` a `window.__panelCola`. El launcher la vacía, llama a `aplicarPartido()`, guarda, y le devuelve la tabla a la página con `window.__eloActualizar()`. También anuncia los cambios en la sala.

**No volver a `onGameStop`**: ahí el partido ya no existe y `room.getScores()` devuelve `null`, así que en la sala de verdad nunca se mandaba nada (la prueba no lo veía porque disparaba `onGameStop` sin cortar el partido). Un partido cortado con Stop no cuenta.

**La base**: además de `elo.json`, `models/PartidoModel.js` guarda cada partido en `partidos` + `participaciones` y le suma a `usuarios` (elo, partidos, ganados, perdidos, empatados, goles). **Solo a los que tienen cuenta con clave** (creada en la web): al que no tiene cuenta no se le crea nada, ni usuario ni participación. Antes se le creaba un usuario sin clave y la tabla se llenó con 67 "cuentas" que nadie creó (se borraron el 17/09/2026, con respaldo en `datos/respaldo-usuarios-sin-clave-*.json`). Desde la sala tampoco se crean cuentas: `atenderUsuario()` del launcher solo acepta `verificar`. Con la base apagada solo avisa por consola. El elo de la tabla `usuarios` es el que calculó `elo.json` (que va por auth), no se recalcula.

**ELO por sala + general (17/09/2026).** Una tabla por sala (`elo_3v3`, `elo_4v4`, `elo_todos`,
`elo_realsoccer`) y `elo_general` (migración `20260917180000_elo_por_sala`):

- Cada partido actualiza **solo la tabla de su sala** (`EloSalasModel.procesarPartido`: lee la
  tabla, `aplicarPartido`, upsert de los que jugaron).
- El general **no se calcula a mano**: `CALL actualizar_elo_general(claves)` (procedimiento
  PL/pgSQL en la migración). `elo` = promedio de los ELO de las salas **pesado por los partidos**
  de cada una; partidos/ganados/empatados/perdidos/goles = suma; nombre = el último. Sin claves
  recalcula a todos, y saca del general a los que ya no están en ninguna sala.
- `lib/elo.js` → `calcularGeneral()` hace **la misma cuenta** en Node: se usa sin base, y
  `prueba-elo-salas` comprueba que da igual que el procedimiento.
- Los archivos `datos/elo.json` (general) y `datos/elo-<sala>.json` quedan como **espejo** (los
  leen la sala y la web, sincrónico). `EloSalasModel.espejar()` los escribe después de cada partido
  y `sincronizar()` al abrir la sala (si la tabla está vacía y el archivo tiene datos, sube el archivo).
- **Solo suman los que tienen cuenta y pusieron `!clave`** (17/09/2026). El bloque `📊 ELO` manda
  `verificado` (de `usuariosVerificados`) por cada jugador, y `EloSalasModel.conCuenta(evento)`
  busca en `usuarios` los verificados con `clave` no nula y sin ban. `aplicarPartido(tabla, partido,
  { cuenta })` los deja jugar a los demás como invitados con 1000 (para que la cuenta del partido sea
  justa), pero **no los agrega a la tabla ni a los cambios**. El launcher anuncia en la sala quiénes
  no sumaron (`sinCuenta`). La rama de sala sin tabla del launcher usa el mismo filtro.
- Sin base: **no suma nadie** (no se puede confirmar ninguna cuenta), no se escriben archivos y
  devuelve `enBase: false`. `calcularGeneral()` queda para las pruebas y como referencia.
- El nombre de la tabla va en SQL: sale **solo** de `EloSalasModel.TABLAS`. `archivoDe()` rechaza
  cualquier sala que no sea `[a-z0-9-]`. Una sala nueva en `hosts/` necesita su tabla (migración +
  `TABLAS`); mientras tanto usa solo el general.
- La sala recibe `window.__ELO = { sala, general }` (`eloParaLaPagina()` en el launcher). El color y
  la división del chat son los de la sala. `!elo` muestra sala y general; `!top` es de la sala y
  `!top general` el general. `paraLaSala()` ahora manda `nombre` (sin eso `!top` decía "undefined").
- La cuenta de la web (`usuarios.elo`) guarda el **general** (`PartidoModel.guardar(..., eloGeneral)`);
  las participaciones guardan el ELO de la sala. `/api/ranking?sala=3v3` y `/api/cuenta` →
  `eloPorSala`. La portada tiene pestañas General / cada sala.

Fórmula Elo clásica por equipos: se compara el promedio de cada lado, K=32 (48 en los primeros 10 partidos). Es de suma cero. Divisiones en `DIVISIONES` (Novato → Leyenda).

API: `GET /api/elo`. El panel lo muestra en la pestaña **ELO** (también viene en `/api/estado` como `estado.elo`).

**Color del nombre**: en el chat NO reescribimos el mensaje. Se envuelve `room.sendAnnouncement` solo mientras corre el handler del script, se detecta el anuncio que lleva el nombre + el texto del jugador, y se le cambia el color y se le agrega el emoji. Así se conservan los prefijos de rango, el mute y los comandos del autor. Se apaga con `ColorearNombrePorElo`. En el panel, el launcher le pega `elo/division/emoji/color` a cada jugador del evento `jugadores` y `nombreConElo()` los pinta.

`npm run prueba-elo` corre el cálculo (`pruebas/elo.js`) y el circuito completo (`pruebas/elo-integracion.js`, con `ELO_FILE` a un archivo temporal para no pisar la tabla real).

## Monedas (🪙)

Tablas `monedas` (nick → saldo) y `movimientos_monedas` (el historial), migración
`20260918090000_monedas`. **El saldo va en CENTÉSIMAS** (1 moneda = 100) para que 0,30 no arrastre
decimales rotos; `MonedasModel.enMonedas()` lo pasa a monedas y `aCentesimas()` al revés.

**Solo cobra el equipo que GANA**, y solo quien tiene cuenta en la web con la clave puesta (el
mismo filtro del ELO, `EloSalasModel.conCuenta`):

| Por | Paga | Tope por partido |
|---|---|---|
| Ganar el partido | 1 | — |
| Cada gol | 1 | 3 (el hat-trick) |
| Cada asistencia | 1 | 3 |
| Cada atajada | 0,30 | 3 |

`MonedasModel.calcular()` hace la cuenta (sin base) y `porPartido()` la guarda con su movimiento.
`acreditar()` sirve también para gastar (monto negativo) y **no deja saldo negativo**.

**Las atajadas las cuenta el bloque `🪙 MONEDAS`** (`parches/bloques/monedas.txt`): el script del
autor no las lleva. Es atajada cuando la pelota va al arco (`xspeed` ≥ `VelocidadParaAtajada` y
`|x|` ≥ `DistanciaAlArcoParaAtajada`) y la toca el arquero del equipo que defiende (el suyo más
cerca de su arco). No se cuentan dos seguidas del mismo (`SegundosEntreAtajadas`) y, si el gol entra
igual en 1,2 s, se descuenta. Rojo defiende la x negativa y azul la positiva.

El evento `elo-partido` ahora lleva también `asistencias` (del `playerAssists` del autor) y
`atajadas`. El launcher, después de guardar el partido, llama a `repartirMonedas()` y le manda a la
página `window.__monedasAviso(premios)`: **el detalle de lo que ganó cada uno va en privado** (a su
id) y solo el aviso general sale para todos. `refrescarMonedas()` deja `window.__MONEDAS` para que
`!monedas` conteste sin tocar la base.

En la web: `CuentaModel.ficha` trae `monedas`, `ganadas`, `gastadas` e `historial`; la portada
muestra "Tus monedas" con los últimos 5 movimientos y **Mi cuenta** tiene la sección Monedas con
la tabla completa. `npm run prueba-monedas` cubre el reparto, la sala y la base.

## Animaciones de gol (🎉)

Lo que le pasa al que hace el gol mientras se festeja. Se arman desde el panel y se venden con
monedas, **igual que las camisetas**: el circuito es el mismo (`AnimacionesModel` es hermano de
`TiendaModel`). Tablas `animaciones` y `animaciones_compradas` + `usuarios.animacion` (la puesta),
migración `20260920120000_animaciones`.

**Cada punto tiene su emoji Y su tamaño** (20/09/2026, migración
`20260920160000_animaciones_tamano_por_punto`): `cuadros String[]` y `tamanos Float[]` van **en
paralelo**, mismo largo y misma posición. Un cuadro vacío (`""`) es un punto que solo cambia el
tamaño, por eso `limpiarPuntos()` **no filtra los vacíos**: se perdería el orden. Así el que la
arma decide en qué momento el jugador se hace grande y cuánto.

`tamanoDesde`/`tamanoHasta` quedan **solo para las animaciones viejas**: si `tamanos` viene vacío,
el bloque usa el vaivén de seno de antes. Las nuevas siempre traen `tamanos`.

| Tipo | Qué hace |
|---|---|
| `secuencia` | Le van pasando los cuadros (emojis o letras) por el avatar |
| `tamano` | Cambia de tamaño (`setPlayerDiscProperties`, radio × el factor de ese punto) |
| `ambas` | Las dos cosas a la vez |

**El tipo no se elige**: lo deduce el modelo de lo que se cargó (hay emojis → `secuencia`, hay
tamaños ≠ 1 → `tamano`, las dos → `ambas`). Lo mismo hace la pantalla con `tipoDeAhora()`.

**Cómo se engancha en la sala** (`parches/bloques/animaciones.txt`): se **redeclara**
`avatarCelebration(id, emoji)`, que es la que el script del autor ya llama en cada gol (le hacía
parpadear un emoji). Gana la última declaración, así que no hay que tocar nada minificado. Si el
que hizo el gol no compró ninguna, se hace **exactamente lo de antes**.

**Un gol EN CONTRA no se festeja.** El script llama al mismo `avatarCelebration` cuando alguien
se la mete en su propio arco (con un emoji de autogol). El bloque envuelve `room.onTeamGoal` y
compara `game.lastKickerTeam` con el equipo que recibió el gol; tiene que marcarse **antes** de
llamar al handler del script, porque el festejo sale de adentro de ese handler.

**Solo la hace el que metió el gol.** El script llama a `avatarCelebration` **dos veces**: con
el goleador (`game.lastKickerId`) y con el de la asistencia (un 👟). El bloque compara contra
`game.lastKickerId`: el asistidor festeja como siempre aunque tenga una comprada.

**Cuánto dura**: hasta `duracionMs` (máximo 10 s), pero se corta sola en `onPositionsReset`,
`onGameStart` y `onGameStop`. O sea que **dura lo que dura el festejo y nunca se mete adentro del
juego**: nadie sigue jugando agrandado. `frenarAnimacion()` devuelve el radio original guardado,
no uno fijo.

**El bot espera a que termine** (`festejandoGol()`, `festejoHasta`). El acomodo automático metía a
todos en la cancha apenas entraba el gol y la animación se cortaba a la mitad. Ahora
`revisarArranque()`, `aplicarModoDeEquipos()` y `window.__acomodarSala()` **no hacen nada mientras
se festeja**. Los tres preguntan con `typeof festejandoGol === "function"`, así que si el bloque de
animaciones no está, siguen andando igual. El flag se libera en `frenarTodasLasAnimaciones()`, o
sea también cuando se saca del medio antes de tiempo.

**Los límites los pone el modelo, no la pantalla** (`AnimacionesModel.LIMITES`): hasta 10 cuadros,
`msPorCuadro` 60–2000, `duracionMs` 300–10000, tamaño 0.3×–3×. Lo que viene fuera de rango **se
recorta**, no se rechaza — salvo la clave (minúsculas, sin espacios) y "una de emojis sin ningún
emoji", que sí cortan. Cada cuadro se recorta a 2 caracteres: HaxBall no muestra más en el avatar.

**Quién puede qué**:

| | Quién | Dónde |
|---|---|---|
| Armarlas y ponerles precio | **OWNER y CO-OWNER** | `middlewares/puedeVerRangos` en `AnimacionesRouter` |
| Verlas en la tienda | cualquiera | `GET /api/animaciones` |
| Comprar, vender, elegir | con sesión | `verificarToken()` |

**Al vender se paga el 70% de lo que VALE HOY**, no de lo que pagó en su momento (`loQueVale()`,
en los dos modelos). Si al artículo le subieron o le bajaron el precio, el que lo vende cobra por
el de ahora — es lo que espera cualquiera. Si ya no tiene precio (lo sacaron de la tienda), se cae
a lo que había pagado, que es lo único que se sabe. El `vale` del inventario usa la misma cuenta,
así lo que dice la pantalla es lo que se va a cobrar.

**Cada cosa de la tienda tiene su propia URL**, no un modal (20/09/2026): `/frm/camiseta/?c=<clave>`
y `/frm/animacion/?c=<clave>` (`VistasController.camiseta` / `.animacion`). Así el link se puede
compartir, anda el botón de atrás y Google puede entrar — por eso además están en el `Allow` del
`robots.txt`. Las dos leen la vitrina pública (`/api/tienda`, `/api/animaciones`) y buscan la
clave; si no está, muestran un cartel en vez de romperse. La portada tiene **dos vidrieras** que se
mueven solas (camisetas y animaciones), y cada ítem es un `<a>` a esas páginas.

**La cancha de la vista previa es UN SOLO archivo**: `public/js/cancha-animacion.js`
(`CanchaAnimacion.crear(lienzo, opciones)`), que usan el editor del panel y la página pública. Así
lo que ve el que la arma es exactamente lo que ve el que la compra. Las opciones son funciones
(`puntos()`, `msPorCuadro()`, `congelado()`) porque el editor cambia mientras corre; `conSegundos:
false` saca los tiempos del cartel, que en la página pública no interesan. Ojo con `seguir()`:
tiene que volver a pedir cuadro **siempre**, porque al soltar el cabezal el bucle está cortado
aunque `corriendo` nunca se haya apagado (ya se rompió una vez por eso).

**En el inventario** (`public/frm/inventario/`) las animaciones tienen **su propio apartado**,
aparte del de camisetas: se prenden y se apagan con "Activar"/"Desactivar" (`POST
/api/animaciones/elegir`), se venden al 70% y se pueden **probar ahí mismo** — la vista previa usa
la misma cuenta que la sala. El panel de detalle es uno solo para las dos cosas: `tipoElegido`
decide a qué API le pega y qué muestra.

La pantalla del panel es `public/frm/animaciones/` (nav "Animaciones", visible con `u.rangos`).
La **tabla** muestra de cada una: nombre y descripción, los primeros 6 emojis con un `+N` (con 45
en la celda la fila se desarmaba), hasta cuánto crece, cuánto dura, el precio y unas etiquetas de
estado. En el teléfono se esconden las dos columnas del medio. El botón **Ver** abre un modal de
**previsualización** con la misma cancha que el editor y la ficha de la animación, y desde ahí se
puede pasar a editarla.
El candado del navegador es cosmético: el de verdad está en la API. El editor tiene dos partes:

- **La cancha en bucle** (un `<canvas>`): una jugada de verdad, **nadie queda quieto**
  (`AVANCE` → `PASE` → `REMATE` → festejo → `ESPERA`). Los dos rojos suben en diagonal desde su
  campo **mientras se pasan la pelota**, el que recibe **remata corriendo**, y después del gol
  **se va festejando al córner** con el compañero atrás. La clave: el pase y el remate se
  calculan entre las posiciones que tienen los jugadores **en ese instante** (`jugador`,
  `companiero`), no entre puntos fijos — por eso se ve natural. Todo con `suave()` para que
  arranque y frene como alguien corriendo. **Los discos no se pisan**, como en el juego: la
  pelota sale y llega al **borde** de cada jugador (`borde()`, no al centro) y si dos jugadores
  se juntan al festejar, se empujan hasta quedar tocándose. Y en el
  festejo corre la animación **con la misma cuenta que hace la sala**, así se ve tal cual va a
  quedar. Está dibujada con los colores del mapa de verdad (`mapas/nanduti-futsal-x3.hbs`): fondo
  `2a3a40`, líneas `b3b6b6`, áreas curvas `ff6363` y `0099ff`, palos `FFFF00`, pelota `FFD700`.
  **El emoji va ADENTRO del disco**, que es donde HaxBall muestra el avatar (no arriba).
  El festejo corre **en tiempo real**: si se ponen 10 s, el bucle festeja 10 s, y el cartel de
  abajo va diciendo "Festejando 3,4 / 10,0 s" con una barra de avance — así se comprueba de un
  vistazo. El botón Agrandar lo lleva a 840 px (clase `.grande`), que es cuando el emoji se lee
  bien: a tamaño normal el jugador es chico porque la cancha está a escala real.
  El bucle vive en `cuadro()` con `requestAnimationFrame`; `t0` se reinicia al abrir el editor.
- **La línea de tiempo, estilo editor de video**. La regla y los clips salen de la **misma base**:
  los puntos son `flex: 1 1 0` (reparten el ancho en partes iguales) y las marcas van en
  `i / n * 100%`, así **coinciden siempre**, con 3 puntos o con 10 y en cualquier ancho de
  pantalla. No hay scroll horizontal: con más puntos los clips se achican. Por eso el botón de
  agregar está **afuera** de la pista (si estuviera adentro se comería ancho y se desalinearía).
  Con más de 6 puntos las marcas se saltean para que no se pisen. Arriba una **regla con los segundos**, abajo los
  puntos como clips y un **cabezal rojo** que se mueve marcando el punto que se está viendo en la
  cancha (`marcarPunto()`). Cada clip muestra su emoji, una **barrita con su tamaño** (para ver de
  un vistazo dónde se hace grande) y su segundo. Se toca para editarlo, se arrastra para moverlo y
  la ✕ lo saca. Al elegir uno se abre abajo su editor: emoji (con teclado), **tamaño de ESE punto**,
  y los botones Sacarle el emoji / Duplicar / Borrar.
- **El cabezal se puede arrastrar** para ir viendo los puntos uno por uno: se agarra desde la
  regla o desde el cabezal (`puntoEnLaMano`), y mientras tanto la cancha queda **congelada** en
  ese punto en vez de seguir el bucle. Sobre un clip NO agarra, porque ahí manda el arrastre de
  reordenar. Al soltar, el bucle vuelve a correr solo.

**No se pide la clave**: es un dato interno y se genera sola del nombre (`claveDelNombre()`:
saca acentos, pasa a minúsculas, cambia lo que no sea letra o número por guiones y agrega `-2`,
`-3`… si ya existe). Al editar se conserva la que tenía. **Tampoco se elige el tipo**:
`tipoDeAhora()` lo deduce de lo que se cargó (puntos → `secuencia`, tamaño distinto de 1× →
`tamano`, las dos cosas → `ambas`), y los controles de tamaño están **siempre** a la vista. Antes
estaban escondidos detrás del selector de tipo y parecía que no se podía cambiar el tamaño.

**EL TIEMPO MANDA, y la secuencia NUNCA se repite.** La duración del festejo la elige el que la
arma, y los puntos se acomodan solos para llenarla: `cuántos puntos = duración × velocidad`
(`acomodarPuntos()`). Subir la velocidad **no acorta el festejo**: siguen siendo los mismos
segundos con más puntos adentro. El modelo guarda `duracionMs = cuadros.length * msPorCuadro`,
o sea exactamente lo que dura la secuencia, y el bloque hace `pasos = dura / paso` = una sola
pasada.

Antes eran dos números sueltos y la secuencia se repetía para llenar el tiempo: con 3 s de
festejo y 0,6 s de puntos se veía 5 veces, que no tenía sentido.

Como los puntos tienen tope (`MAX_CUADROS = 50`, antes 10 — con 10 no se llegaba ni a 3 s), lo
que se limita es **la velocidad**, no el festejo: `limitarVelocidad()` baja el máximo del control
a `50 / duración` (con 10 s, hasta 5 por segundo). Se prefiere recortar la velocidad antes que
los segundos que pidió el usuario.

**La sala reproduce EXACTAMENTE los puntos guardados**: `pasos = cuadros.length`, una sola
pasada. Antes salía de `duracionMs` (`pasos = duracion / paso`), y eso se despega apenas los dos
números no coinciden — si la duración quedaba recortada por el tope, la animación se cortaba a la
mitad sin que nadie se enterara. Los puntos son el dato de verdad; la duración es una consecuencia.

**EL TOPE ESTÁ EN DOS LADOS Y TIENEN QUE COINCIDIR**: `AnimacionesModel.MAX_CUADROS` (la base) y
`MaxCuadrosDeAnimacion` (el bloque de la sala). Al subirlo a 50 me olvidé del bloque y en la sala
salían **10 de 37**: se guardaba bien y se reproducía cortada. Si se vuelve a tocar, cambiar los dos.

Los puntos **no se agregan ni se borran a mano**: la cantidad la manda el tiempo. La ✕ y el botón
"Vaciar punto" lo dejan vacío (sin emoji y en 1×), y un punto vacío es tiempo en el que no se le
ve nada.

**Los dos controles van ARRIBA de la línea de tiempo** (`.mandos-tiempo`), porque son los que la
manejan. Estaban abajo y confundía: al abrir una animación guardada con poco tiempo (0,6 s) y
subir la velocidad a 16 salían 10 puntos, y parecía un tope de 10 cuando en realidad era
`0,6 × 16`. Con los controles a la vista se entiende de dónde sale el número.

**La velocidad se muestra en puntos por segundo**, no en milisegundos: `msDeFps()` / `fpsDeMs()`
convierten al guardar y al abrir. El modelo sigue guardando `msPorCuadro`. Abajo del control se
dice cuánto dura cada punto y **cuántas veces se repite la secuencia** con la duración elegida:
sirve para darse cuenta de que una secuencia larga con poco tiempo no se llega a ver entera.

En la sala: `!animaciones` (las que compró), `!animacion <nombre>` y `!animacion ninguna`. El
launcher deja `window.__ANIMACIONES` y `window.__MIS_ANIMACIONES` cada 20 s (`refrescarAnimaciones`)
y atiende `{tipo:"animacion"}` de la cola, igual que las camisetas.

`npm run prueba-animaciones` cubre las tres puntas: la sala (festeja, se agranda, se corta al sacar
del medio, y el que no tiene festeja como antes), el modelo contra la base (límites, compra, venta,
inventario) y la API con permisos. Para eso el arnés ahora guarda `sala.avatares` y `sala.radios`.

## Sin límite de espectadores

Dos parches, porque el script original echaba gente que solo miraba:
- `LugaresReservados = 0`: con la sala casi llena, `verificarReserva()` le ponía **contraseña** a la sala.
- `LimiteMaximoDeJugadoresAFK = 99`: `checkAutoKickAFKs()` echaba a todos los AFK de golpe, y un espectador cuenta como AFK a los 5 minutos.

El cupo de las 4 salas es 30 (`CantidadDeJugadores` en `hosts/*.json`), el máximo de HaxBall.

Y desde el 20/09/2026 tampoco se echa por compartir la conexión: `MaximoJugadoresPorIp` pasó de
**2 a 99** (`👥 Dejar entrar a varios desde la misma conexión` en `parches/aplicar.js`). Echaba al
tercero de una misma IP con "🚫 Sólo se permiten hasta 2 jugadores con la misma IP", y acá es
común que jueguen varios desde la misma casa o desde un ciber. El control **no se sacó**, se le
corrió el límite: sigue en el catálogo del panel (`lib/parametros.js`, grupo Moderación, con el
tope subido de 10 a 99), así que se le puede volver a poner un límite desde Configuración sin
tocar código. Ojo: **no es lo mismo que el anti-DU** ("Nick registrado, pero tu auth no coincide"),
que compara el auth con el nick registrado y quedó igual.

## Panel: no redibujar de más

(En `views/index.html`.) `pintarSala()` calcula una **firma** del HTML y si no cambió no toca el DOM (si no, parpadea y se cierra el menú de kick/ban). Cuando sí redibuja, guarda `scrollTop` antes y lo restaura después: sin eso, cada refresco de 2 s mandaba al usuario arriba de todo. Solo salta al último mensaje si ya estaba abajo del todo.

## Probar sin gastar tokens

Son 27 y **todas tienen que quedar en verde antes de commitear**:

| Comando | Qué mira |
|---|---|
| `prueba` | El script entero cargando y los eventos básicos (atrapa los `X is not defined`) |
| `prueba-api` | La API del panel (routes → controllers → models) contra HTTP real |
| `prueba-web` | Ñandutí Web: portada, registro, sesión, JWT y el panel solo para admins |
| `prueba-base` | El enrutado por `DB_ENV` y las tablas de Prisma |
| `prueba-usuarios` | Las claves: hash, el flujo en la sala y el modelo contra la base |
| `prueba-rangos` | Que la tabla mande y que un admin puesto a mano se caiga en 5 s |
| `prueba-nicks` | Que no te echen por tu propio nombre |
| `prueba-chat` | Hablar normal no dispara comandos, y los comandos no se ven |
| `prueba-turnos` | El draft: elegir a tiempo y el que se cuelga |
| `prueba-modos` | `!ganasigue` / `!elegir` / `!combinado` y la pausa mientras se elige |
| `prueba-arranque` | Stop, pausa, fin de partido y AFK |
| `prueba-camisetas` | Que los clubes roten en cada partido |
| `prueba-espia` | Un evento por cosa que pasa (el panel no repite) |
| `prueba-discord` | El aviso de sala abierta y el cartelito del chat |
| `prueba-tunel` | Un solo mensaje en Discord que se va actualizando |
| `prueba-actualizaciones` | Las novedades: se guardan primero, se mandan después |
| `prueba-elo` | El cálculo, el circuito y el color del nombre |
| `prueba-mapas` | Que HaxBall valide los 4 mapas |
| `prueba-config` | Parámetros y comandos desde el panel: en vivo, en la base y con permisos |
| `prueba-carrusel` | Las imágenes del carrusel: archivos seguros, portada pública y panel con permisos |
| `prueba-elo-salas` | ELO por sala: tablas separadas, el procedimiento del general y el modo sin base |
| `prueba-discord-vincular` | Vincular Discord: autorizar, entrar al servidor, sin guardar tokens |
| `prueba-monedas` | Las monedas: paga solo el que gana, los topes, las atajadas y el historial |
| `prueba-animaciones` | Las animaciones de gol: festeja solo el goleador, el bot espera, y el catálogo es de OWNER y CO-OWNER |

Las que hablan con la base **no fallan si está apagada**: avisan y saltean esa parte.


`npm run prueba` (`pruebas/simulador.js`) monta una sala falsa con la API de HaxBall, corre `script.js` entero en un `vm` y dispara los eventos (entrar, chatear, clave de rango, comandos, gol, salir). Atrapa los `X is not defined` que dejó el corte del archivo. **Correrlo después de cada cambio en script.js.**

`npm run prueba-api` (`pruebas/api.js`) prueba la capa MVC del panel contra HTTP de verdad; está explicado en “Panel y rangos”.

`pruebas/sala-falsa.js` es el arnés con **reloj virtual** que usan `autoarranque.js` y `modos.js`:
falsea `Date`, `setTimeout` y `setInterval`, dispara `onGameTick` mientras el partido corre y
mueve a los jugadores falsos en cada tick (si no, el detector de AFK del script los marca a los
15 s). `avanzar(ms)` decide cuánto tiempo pasa; sin eso no se puede probar “a los 5 segundos
arranca” ni “si el capitán no elige en 25 segundos elige el bot”. Ojo: las variables `let`/`const`
del script (`ganasigueEnabled`, `modoJueganAlgunos`…) **no** son propiedades del contexto del
`vm`; para leerlas está `sala.leer("ganasigueEnabled")`.

El bloque `🧑‍⚖️ ARBITRAJE` también es nuestro: el corte se llevó `room.onTeamGoal` (no existía ningún anuncio de gol), el acomodo automático de jugadores y el arranque de partidos. Ahí están `acomodarEquipos`, `arrancarSiHayGente`, `revisarSala` (cada 5 s) y `puedeJugar` (excluye bot, AFK y rangos sin verificar).

Umbrales del modo automatizado (editados en las 3 copias del `if` minificado): ≤7 → x3, 8-9 → x4, 10-13 → x5, ≥14 → x7. Arranque en x3.

Piezas repuestas en el bloque `🩹 PIEZAS QUE FALTABAN` (se perdieron con el corte): `playerJoinTimes`, `connections`, `UsedNames`, `usedUsernames`, `playerIPs`, `avatarIntervals`, `mapVotes`, `playerGoalsReceived`, `playerCleanSheets`, `timeOnHalves`, `camisetaRedActual/BlueActual`, y las funciones `whisper`, `announce`, `displayAdminMessage`, `registerPlayerTime`, `RegisterPlayer`, `DeletePlayer`, `asignarCamisetaPorClave`, `elegirNuevaCamiseta`.

## Pendientes

- **Anuncios de gol groseros**: el script original trae ~15 mensajes subidos de tono ("orto", "rosca"…). Pendiente decidir si se reemplazan.
- **Webhooks reales en texto plano** al inicio del archivo, y `webhookPass` (sin uso). Siguen siendo del autor original los de grabaciones, llamar admins, kicks/bans, mensajes del chat, entradas/salidas, estadísticas e IPs: los replays y el chat de nuestras salas se le mandan a su Discord. El de sala abierta ya es nuestro.
- **`WebhookSalaAbierta` está en `script.js`, que se sube a Git**: si el repo es público, esa llave queda expuesta. Se puede mover a `.env` (`WEBHOOK_SALA_ABIERTA`).
- La clave de rangos está en texto plano en `roles.json`, que se sube a Git.
- **La API no pide sesión**: el panel se protege del lado del navegador (`Sesion.exigirAdmin()`),
  pero `/api/estado`, `/api/kick`, `/api/rangos`… contestan a cualquiera que sepa la URL. Con el
  túnel de Cloudflare abierto eso queda en internet. Está `middlewares/verificarToken.js` listo;
  falta que las pantallas del panel manden el `Authorization` en cada pedido.
- El `sid` del token JWT no se guarda en ningún lado: no hay forma de invalidar una sesión suelta
  (solo cambiando `JWT_SECRET`, que las corta todas).
- Fallo del script original: `ballCarrying` solo existe tras el primer `onGameStart`; el bloque compat le pone una red de seguridad.

## Trampas con las que ya nos tropezamos

Cosas que costaron encontrar y conviene no volver a pisar:

- **Nunca escribir un archivo con un script que pueda fallar a mitad.** Un `io.open(p,"w")` de
  Python que revienta al escribir deja el archivo **vacío**: así se perdió `launcher.js` entero y
  hubo que reconstruirlo desde Git. Para textos con acentos o emojis conviene la herramienta Edit
  o un script de Node, y nunca escapes de emojis dentro de un heredoc de Python.
- **Los `\n` dentro de heredocs se convierten en saltos de línea reales** y rompen los strings de
  JavaScript. Si el archivo tiene mensajes con `\n`, editarlo con Edit.
- **Los textos con ñ/í no siempre son el mismo codepoint en dos archivos**: buscar por un pedazo
  sin acentos (le pasó a `pruebas/aviso-discord.js`, que contaba 0 avisos).
- **`npm install` puede romperse con `Cannot read properties of null (reading 'edgesOut')`**: se
  arregla con `npm install --package-lock-only` y volviendo a instalar.
- **Prisma 7 no es Prisma 6**: la URL salió del schema (va en `prisma7.config.ts`), el cliente
  necesita adaptador (`@prisma/adapter-pg`) y el generador nuevo escribe TypeScript. Este proyecto
  usa el generador clásico `prisma-client-js`.
- **`prisma migrate dev` no corre acá** (pide terminal interactiva): las migraciones se escriben a
  mano en `prisma/migrations/<fecha>_<nombre>/migration.sql` y se aplican con `migrate deploy`.
  Para renombrar una tabla, `ALTER TABLE ... RENAME` — si no, Prisma la borra y la vuelve a crear,
  y se pierden los datos.
- **El 5432 lo puede tener el PostgreSQL de Windows**: el síntoma es `P1000: Authentication failed`.
  Ese servicio quedó detenido y en arranque Manual.
- **Las pruebas con muchos jugadores tienen que entrar espaciados** (`entran()` deja 700 ms): el
  script echa al 5º que entra dentro de los mismos 2 segundos. Y **no usar los nombres
  `Jugador1`…`Jugador20`**: están en la `ListaDeJogadores` de ejemplo del autor y el anti-DU los echa.
- **La ronda de rangos le saca el admin a quien no esté en la tabla**, así que las pruebas que
  necesitan un admin de mentira ponen `contexto.SoloRangosDeLaBase = false`.
- El script tiene `commandCooldown = 5000` por jugador: entre dos comandos del mismo jugador hay
  que mover el reloj virtual.

## Cómo se cierra un cambio

1. Tocar los **bloques** en `parches/bloques/` (nunca el final de `script.js` a mano) y correr
   `npm run parchar`.
2. `node --check script.js` y las **27 pruebas en verde**. No commitear con una en rojo: ya pasó
   una vez de pushear con `prueba-discord` fallando.
3. Actualizar `README.md` (para la gente) y este archivo (para el que siga programando).
4. Commit y push.
5. Cargar la novedad para el Discord con `npm run actualizacion -- --commit "…"` siguiendo las
   reglas de “Actualizaciones para el Discord”. Queda **pendiente**: la manda el usuario desde el
   panel. Si después algo cambia, se carga una corrección — ya pasó con la novedad 22, que decía
   que la cuenta se creaba con `!registrar` cuando eso se movió a la web.

## Al tocar el script

- Antes de editar una zona minificada, léela con Grep y contexto (`-o` con `.{N}` alrededor), porque las líneas tienen miles de caracteres.
- Para descifrar strings ofuscados: copiá las líneas 1291–1309 (el array `_0x24f1`, `_0x2ffa` y el IIFE que lo rota) a un archivo del scratchpad, definí antes `ColorFondoRS` y `NombreHost`, y llamá `_0x3c81f9(0xNNN)` con Node.
- Para ubicar una línea del script minificado cuando algo falla en las pruebas: `STACK=1 node pruebas/<la que sea>.js` muestra el stack con el número de línea de `evalmachine`.
- Después de cada cambio, corré `node --check script.js` (sirve solo cuando el archivo esté completo).
- Respetá el estilo existente: comentarios y mensajes en español, emojis en los anuncios, config con `var`/`let`/`const` al inicio del archivo.
- **Redeclarar gana**: para pisar una función del autor sin tocar la zona minificada, se la vuelve a declarar en un bloque del final (así se hicieron los mapas, `sendLinkToDiscord` y `tieneRangoSinVerificar`).
- **Encadenar, nunca reemplazar**: si un bloque toma un handler (`room.onPlayerChat`, `onPlayerJoin`…), tiene que guardar el anterior y llamarlo.
- Para probar de verdad hay que pegar el script en haxball.com/headless, o levantar la sala con `npm start`. Pedile al usuario que lo haga y te pase la salida de la consola.
