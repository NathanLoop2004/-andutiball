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
- `app.js` + `routes/` + `controllers/` + `models/` + `views/`: el panel en MVC (ver “Panel y rangos”).

## Despliegue (launcher.js)

- `launcher.js` + `package.json`: Puppeteer abre `haxball.com/headless`, envuelve `HBInit` para agregar `token` y ejecuta `script.js`.
- El token se pasa por la variable de entorno `HAXBALL_TOKEN` (de https://www.haxball.com/headlesstoken). **Vence a los pocos minutos** y solo sirve para crear la sala: hay que pedir uno nuevo en cada arranque. Nunca guardarlo en archivos del repositorio.
- El token se lee de `.env` (ignorado por Git); `.env.example` es la plantilla sin token.
- Docker: `Dockerfile` (imagen `ghcr.io/puppeteer/puppeteer`, con la misma versión que puppeteer en package-lock.json) + `docker-compose.yml` (`env_file: .env`, `shm_size: 1gb`, `script.js` montado como volumen). Arranque: `docker compose up -d --build`; logs y link de la sala: `docker compose logs -f`.
- Si el contenedor se reinicia, se necesita un token nuevo (por eso `restart: on-failure:3`).
- **Multihost:** un solo `script.js` y cuatro salas en compose (`host-3v3`, `host-4v4`, `host-todos`, `host-rs`). Cada una tiene `HOST_CONFIG=hosts/<sala>.json`, y el launcher reemplaza en el script la declaración (`var/let/const Nombre ...;`) de cada variable del JSON. Solo sirve para variables de config de una línea.
- Cada sala necesita su propio token: `TOKEN_3V3`, `TOKEN_4V4`, `TOKEN_TODOS`, `TOKEN_REALSOCCER` en `.env`. Para `npm start` (una sola sala) se usan `HAXBALL_TOKEN` + `HOST_CONFIG`.
- `npm run tokens` (`get-tokens.js`): abre headlesstoken en el navegador normal del usuario (Cloudflare Turnstile rechaza a Puppeteer con el error 600010); el usuario resuelve el captcha y copia el token, y el script lo lee del portapapeles y guarda los 3 tokens en `.env` (`-- --up` además hace `docker compose up`). No automatizar ni saltar el captcha.
- **`npm start` = `todas.js`**: es EL arrancador. Levanta Ñandutí Web + el panel + las 4 salas + el túnel de Cloudflare (un proceso hijo por sala, puertos 3001-3004, panel en 8080, prefija la salida con el nombre de cada sala, Ctrl+C corta todo). Con argumento (`npm start 4v4`) levanta solo esa. `npm run todas` es alias. Es la forma práctica acá, porque el usuario no tiene Docker.
- `npm run sala 4v4` llama directo a `launcher.js` (una sala, sin el panel unificado). `launcher.js` también acepta el nombre de sala como argumento y avisa si el puerto está ocupado.
- **Cuidado con los nombres**: la sala de futsal automático se llama `todos` (hosts/todos.json) y el comando de las 4 era `todas`. Por eso `npm start` sin argumentos levanta las 4: el usuario escribió `npm start todos` esperando las 4 y le salió una sola.
- No duplicar `script.js` por sala: los cambios por sala van en `hosts/*.json`.

## Base de datos (Postgres + Prisma)

La base **NO** la levanta `npm start`, a propósito: tiene su propio compose y su propio ciclo de
vida (los datos no se apagan con las salas). `todas.js` solo mira cómo está con `hayBase()` y lo
avisa; si está apagada, arranca igual.


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

Comandos en la sala: `!clave` (o `!login`), `!registrar`, `!cambiarclave vieja nueva`.

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

**Con `TUNEL_WEB=si` en `.env`, `npm start` lo levanta junto con las salas** (un proceso hijo más
en `todas.js`, igual que el panel).

**El aviso al Discord es UN SOLO MENSAJE que se va actualizando** (`services/WebhookWeb.js`):

- la primera vez hace `POST <webhook>?wait=true` — el `?wait=true` es lo que hace que Discord
  devuelva el **id del mensaje**;
- ese id se guarda en `datos/tunel.json` (ignorado por Git) y de ahí en adelante se
  `PATCH <webhook>/messages/<id>`, así el canal no se llena de links viejos;
- si el PATCH vuelve 404 (alguien borró el mensaje) se publica uno nuevo y se guarda el id;
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

`npm run prueba-web` cubre las pantallas, el encarpetado, registrarse, entrar, el rango de OWNER
(agrega y saca el nick de `roles.json`, dejándolo como estaba) y la renovación del token.

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

**El reloj del capitán**: `SegundosParaElegir` (10) con cuenta regresiva en el chat los últimos
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

(En `views/index.html`.) `pintarSala()` calcula una **firma** del HTML y si no cambió no toca el DOM (si no, parpadea y se cierra el menú de kick/ban). Cuando sí redibuja, guarda `scrollTop` antes y lo restaura después: sin eso, cada refresco de 2 s mandaba al usuario arriba de todo. Solo salta al último mensaje si ya estaba abajo del todo.

## Probar sin gastar tokens

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
- La clave de rangos está en texto plano en `roles.json`, que se sube a Git; el panel no pide autenticación.
- Fallo del script original: `ballCarrying` solo existe tras el primer `onGameStart`; el bloque compat le pone una red de seguridad.

## Cómo hacer cambios

- Antes de editar una zona minificada, léela con Grep y contexto (`-o` con `.{N}` alrededor), porque las líneas tienen miles de caracteres.
- Para descifrar strings ofuscados: copia las líneas 1119–1143 a un archivo temporal en el scratchpad, define antes `ColorFondoRS` y `NombreHost` y llama `_0x3c81f9(0xNNN)` con Node.
- Después de cada cambio, corre `node --check script.js` (sirve solo cuando el archivo esté completo).
- Respeta el estilo existente: comentarios y mensajes en español, emojis en los anuncios, config con `var`/`let`/`const` al inicio del archivo.
- Para probar de verdad hay que pegar el script en haxball.com/headless. Pídele al usuario que lo haga y te pase la salida de la consola.
- Si cambian la configuración, los comandos o los problemas conocidos, actualiza `README.md` y este archivo.
