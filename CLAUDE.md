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
- `app.js` + `routes/` + `controllers/` + `models/` + `middlewares/`: la app en MVC (ver “Panel y rangos”).
- `public/`: Ñandutí Web (portada, login, registro) y las pantallas del panel, con el encarpetado de app-centralshop.
- `services/`: la conexión a la base por entorno y los webhooks (actualizaciones, link de la web).
- `prisma/` + `docker-compose.base.yml`: las tablas y la base, que va **aparte** de las salas.
- `tunel.js`, `actualizacion.js`, `sembrar.js`: los comandos sueltos (túnel de Cloudflare, novedades, sembrar la base).
- `pruebas/`: 17 pruebas que corren sin gastar tokens (ver “Probar sin gastar tokens”).

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

Ojo con el efecto de al lado: **el admin que se daba con `ClaveParaSerAdmin` (`!axeso5`) o a mano
también se cae a los 5 segundos**. Si hace falta un admin temporal, va en la tabla.

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
| no está registrado | juega normal, y cada 2 minutos le sale el cartelito de `!registrar ...` |

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
public/css/nanduti.css                estilo común (el panel trae el suyo aparte)
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

**Correo y recuperar la cuenta** (migración `20260917090000_usuarios_email`):

- `usuarios.email` (único, en minúsculas). La web lo **exige** (`SesionModel.registrar`); desde la
  sala no se pide, por eso en `UsuarioModel.registrar` es opcional. Los usuarios viejos quedan con `null`.
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
repetido), entrar, el rango de OWNER (agrega y saca el nick de `roles.json`, dejándolo como
estaba), la renovación del token y todo el circuito de recuperar la cuenta.

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

Bloque `🎽 SELECCIÓN POR TURNOS` (`parches/bloques/turnos.txt`). Los dos primeros espectadores pasan solos como capitanes y después se elige alternando: el capitán del equipo de turno escribe `!7` (o `!elegir 7`) en el chat. Si no elige en `SegundosParaElegir`, elige el bot.

Ya **no** se prende desde `hosts/*.json`: lo prende y lo apaga `aplicarModoDeEquipos()` (bloque 🔀 MODOS DE EQUIPOS) según el modo de la sala, y por eso los enganches del bloque se registran siempre (antes el IIFE cortaba con `if (!SeleccionPorTurnos) return`, y el modo no se podía cambiar en caliente). Exige `modoJueganTodos`, `modoJueganAlgunos` y `automatizadoActivado` en `false`: si el script acomoda jugadores por su cuenta, se pisan entre sí; de eso también se encarga ese bloque.

**El reloj del capitán**: `SegundosParaElegir` (15) con cuenta regresiva en el chat los últimos
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
| `ganasigue` | `!ganasigue` | `ganasigueEnabled`, sin turnos, y `modoJueganAlgunos` si la sala no acomoda sola |
| `elegir` | `!elegir` | `SeleccionPorTurnos` siempre; apaga gana-sigue, juegan-todos/algunos y automatizado |
| `combinado` | `!combinado` | Igual que `elegir` **solo si** `hayJugadoresDeMas()`; si no, acomoda y arranca solo |
| `config` | — | Valor de fábrica: no toca nada, manda `hosts/*.json` |

`!modo` (cualquiera) muestra el modo puesto. Los tres comandos son solo para admins e
interceptan el chat **antes** que el script: `!ganasigue` ya existía como interruptor del autor
(línea ~18498) y ahora lo pisa el comando de modo, que devuelve `false` para que no se ejecute
el toggle viejo.

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

**El webhook es una credencial** y `script.js` se sube a Git. El bloque acepta pisarlo desde
`.env`: `WEBHOOK_SALA_ABIERTA` → el lanzador lo inyecta como `window.__WEBHOOK_SALA` (junto a
`__RANGOS`) y el bloque lo prefiere. Si se filtra, se borra el webhook en Discord y se pone otro.

El parcheador también reemplaza dos cosas de la configuración del autor: `DiscordLink`
(`discord.gg/tDEUbJU8QB` → `discord.gg/TGRug4BGG`) y el webhook de `AnuncioHostAbierto`, que
era del autor y recibía el link de **nuestras** salas.

**La invitación en el chat**: `avisarDiscordEnElChat()` con un `setInterval` de
`MinutosEntreAvisos` (3). No habla con la sala vacía. Usa la misma `completarPlantilla()` que el
embed, así que `MensajeDiscordEnElChat` admite `{discord}`, `{sala}`, `{link}`…

Ojo: el script del autor ya trae un `setInterval` cada 10 minutos (dentro del `onRoomLink`
ofuscado, línea ~18142) que **nunca funcionó**: el callback espera un jugador
(`_0x1b3d6f.id`) y `setInterval` no le pasa ninguno, así que tira `Cannot read properties of
undefined` cada 10 minutos y sus dos anuncios no salen nunca. Se arregla mandando `null` en vez
de `_0x1b3d6f.id` (irían a toda la sala); por ahora se dejó como estaba.

`npm run prueba-discord` (`pruebas/aviso-discord.js`) dispara `onRoomLink` y revisa el embed. El
arnés `sala-falsa.js` guarda en `sala.webhooks` todo lo que el script manda por XMLHttpRequest,
así que también comprueba que el link no viaje a ningún webhook ajeno.

## ELO (lib/elo.js)

Puntaje por jugador, guardado en `datos/elo.json` **del lado de Node** (no en localStorage): así sobrevive al cierre de la sala y **las 4 salas comparten la tabla**. La clave es `auth:<PublicID>` y cae a `nick:<nombre>` solo si no hay auth.

Circuito: el bloque `📊 ELO Y DIVISIONES` del script anota quién está en cancha al arrancar, y en **`onTeamVictory`** empuja `{tipo:"elo-partido", red, blue, ganador, golesRed, golesBlue, mapa, goles}` a `window.__panelCola`. El launcher la vacía, llama a `aplicarPartido()`, guarda, y le devuelve la tabla a la página con `window.__eloActualizar()`. También anuncia los cambios en la sala.

**No volver a `onGameStop`**: ahí el partido ya no existe y `room.getScores()` devuelve `null`, así que en la sala de verdad nunca se mandaba nada (la prueba no lo veía porque disparaba `onGameStop` sin cortar el partido). Un partido cortado con Stop no cuenta.

**La base**: además de `elo.json`, `models/PartidoModel.js` guarda cada partido en `partidos` + `participaciones` y le suma a `usuarios` (elo, partidos, ganados, perdidos, empatados, goles). Si el nick no tiene usuario se le crea uno sin clave. Con la base apagada solo avisa por consola. El elo de la tabla `usuarios` es el que calculó `elo.json` (que va por auth), no se recalcula.

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

(En `views/index.html`.) `pintarSala()` calcula una **firma** del HTML y si no cambió no toca el DOM (si no, parpadea y se cierra el menú de kick/ban). Cuando sí redibuja, guarda `scrollTop` antes y lo restaura después: sin eso, cada refresco de 2 s mandaba al usuario arriba de todo. Solo salta al último mensaje si ya estaba abajo del todo.

## Probar sin gastar tokens

Son 17 y **todas tienen que quedar en verde antes de commitear**:

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
- `ClaveParaSerAdmin = "!axeso5"`: débil y visible.
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
2. `node --check script.js` y las **17 pruebas en verde**. No commitear con una en rojo: ya pasó
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
