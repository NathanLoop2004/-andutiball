# 🕸️ ÑandutíHax — Host de HaxBall

```
 ▄▀▄▀                                  ▄▀
░█▄─░█ ─█▀▀█ ░█▄─░█ ░█▀▀▄ ░█─░█ ▀▀█▀▀ ▀█▀
░█░█░█ ░█▄▄█ ░█░█░█ ░█─░█ ░█─░█ ─░█── ─█─
░█──▀█ ░█─░█ ░█──▀█ ░█▄▄▀ ─▀▄▄▀ ─░█── ▄█▄

░█▀▀█ ─█▀▀█ ░█─── ░█───
░█▀▀▄ ░█▄▄█ ░█─── ░█───
░█▄▄█ ░█─░█ ░█▄▄█ ░█▄▄█
```

**El host paraguayo de HaxBall, hecho por Jinder** 🇵🇾

Sala de HaxBall con bot árbitro, basada en la
[Headless Host API](https://github.com/haxball/haxball-issues/wiki/Headless-Host).
Trae 35 mapas, camisetas de todos los clubes paraguayos, estadísticas, moderación
automática y avisos a Discord. Puede levantar **4 salas a la vez**: tres de Futsal y una de Real Soccer.

> ⚠️ **Leé [Problemas conocidos](#️-problemas-conocidos).** El `script.js` original venía
> **cortado** y con un **webhook oculto**: los dos están arreglados, pero hay cosas que faltan.

---

## 📁 Archivos

| Archivo | Para qué |
|---|---|
| `script.js` | El script de la sala (~19.100 líneas). Se ejecuta dentro de HaxBall. |
| `launcher.js` | Abre la sala con Puppeteer y le aplica la configuración de cada host. |
| `app.js` | La app del panel (Express). Arma las rutas y la usan el launcher y `panel/server.js`. |
| `docker-compose.base.yml` | La base de datos (Postgres), aparte de las salas. |
| `actualizacion.js` | Carga novedades para el Discord desde la terminal. |
| `prisma/schema.prisma` | Las tablas. `services/ConexionBase.js` elige la base según `DB_ENV`. |
| `routes/`, `controllers/`, `models/` | La app en MVC: rutas → controladores → modelos. |
| `public/` | Ñandutí Web: la portada, el login y las pantallas del panel. |
| `get-tokens.js` | Consigue los tokens y los guarda en `.env`. |
| `hosts/*.json` | Diferencias de cada sala (3v3, 4v4, automático, Real Soccer). |
| `docker-compose.yml`, `Dockerfile` | Las 4 salas en Docker. |
| `.env` | Tus tokens. |
| `mapas/` | Los mapas de futsal propios y el generador. |
| `datos/elo.json` | Los puntajes de los jugadores (se crea solo). |
| `CLAUDE.md` | Notas técnicas para seguir trabajando en el proyecto. |

---

## ▶️ Cómo levantar las salas

### Todo junto (sin Docker)

```powershell
npm start        # todo junto: la base, las tablas, el script, la web y las 4 salas
```

**`npm start` se encarga solo de todo**, no hay que correr nada antes:

- si la **base** está apagada, la prende (queda prendida aparte);
- aplica los **cambios de las tablas** que falten (nunca borra datos);
- si se tocó algo de los **parches**, vuelve a parchar `script.js`;
- si la **web** ya estaba prendida y cambió su código o el `.env`, la recarga **sin cambiar el link**.

Si algo de eso falla, te avisa y arranca igual.

**La web y el túnel quedan prendidos aparte**, en segundo plano: podés reiniciar las salas todas
las veces que quieras y **el link público no cambia**. Si el túnel o la web se caen, se vuelven a
prender solos (y el Discord se actualiza). Lo que va pasando queda en `datos/web.log`.

    npm run web:estado   # ¿está prendida? ¿cuál es el link?
    npm run web:bajar    # apagarla
    npm run web          # prenderla en esta terminal, sin salas

**`npm start` levanta las salas** y Ctrl+C corta solo las salas. Te avisa al arrancar si la
base está prendida o no (si está apagada arranca igual: las salas no piden clave y la web no
deja entrar, pero se puede jugar).

```
npm start todos  lo mismo que npm start: las 4
npm start 4v4    todo, pero con una sola sala (3v3 · 4v4 · futsal · realsoccer)
```

La **base va aparte a propósito**: tiene su propio compose y sus datos no se apagan con las
salas. Se levanta una vez con `npm run base` y se olvida.

| | Puerto |
|---|---|
| Ñandutí Web y el panel | <http://localhost:8080> |
| Cada sala (su API) | 3001 · 3002 · 3003 · 3004 |
| La base (Postgres) | 5432 |
| El link público | sale en la consola y en el Discord |

### Con Docker (las 4 salas)

```powershell
npm install                  # una sola vez
npm run tokens -- --up       # saca los 4 tokens y levanta todo
docker compose logs -f       # muestra los links de las salas
docker compose down          # cierra todo
```

`npm run tokens` abre la página de tokens en tu navegador. Resolvés el captcha, copiás el token
con Ctrl+C y el script lo guarda solo. Repite 4 veces, una por sala.

Para no tener que seleccionar el texto, instalá el marcador de [bookmarklet.js](bookmarklet.js):
después del captcha, un clic copia el token. El captcha siempre lo resolvés vos.

### Una sola sala

```powershell
npm start 4v4          # 3v3 · 4v4 · futsal · realsoccer ("todos" levanta las 4)
npm run tokens -- --una  # si te falta el token de esa sala
```

La sala levanta con su panel. Si el nombre está mal escrito, te dice cuáles hay.

### 🖥️ El panel

Muestra una tarjeta por sala, con luz **verde si está encendida** y **roja si no**, más los
jugadores, el mapa, el marcador y el link para entrar. Adentro tiene pestañas: **Cancha** (quién
está en cada equipo), **Mensajes** (chat, entradas, salidas, goles y expulsiones en vivo),
**Jugadores**, **ELO**, **Bans** y **Rangos**. Arriba tiene las secciones del panel: Salas,
Configuración, Rangos, Usuarios (solo el OWNER) y Actualizaciones.

Se actualiza cada 2 segundos **sin moverte de donde estabas leyendo**: solo sigue al último
mensaje si ya estabas abajo del todo, y si no cambió nada no redibuja.

- Con Docker, las 4 salas juntas: <http://localhost:8080>
- Con `npm start 4v4` (una sola sala), su panel en <http://localhost:8080> también

Los bans que lista son los de la sesión en curso: HaxBall no permite pedirle la lista guardada.

#### Cómo está armado (MVC)

El panel sigue el patrón **modelo – vista – controlador**, con Express:

```
routes/       Qué URL llama a qué método        EstadoRouter.js, SalasRouter.js, RangosRouter.js…
controllers/  Reciben el pedido y responden       EstadoController.js, ModeracionController.js…
models/       La lógica y los datos               EstadoModel.js, SalasModel.js, EloModel.js…
views/        Las pantallas                       index.html, rangos.html
app.js        Arma la app con todo lo anterior
```

La misma app la usan los dos procesos, con distinta configuración:

| | Quién la levanta | Qué recibe | Qué hace |
|---|---|---|---|
| **Una sala** | `launcher.js` | la sala que maneja con Puppeteer | responde con su propio estado y expulsa jugadores |
| **El panel** | `panel/server.js` | la lista de salas (`SALAS`) | le pregunta a cada sala y reenvía los kicks |

Endpoints: `GET /api/estado` · `GET /api/salas` · `GET /api/elo` · `GET|POST /api/rangos` ·
`POST /api/kick[/sala]` · `POST /api/ban[/sala]`.

`npm run prueba-api` levanta las dos apps de verdad y prueba todos los endpoints.

---

## 🎖️ Rangos

Si alguien entra con un nick que figura en [roles.json](roles.json), la sala le pone su rango
automáticamente (OWNER, CO-OWNER, HOSTER…) y le da admin si ese rol lo tiene. No se pide clave.

Se administra desde **la pantalla de rangos del panel** (<http://localhost:8080/rangos>):
agregar o quitar nicks y decidir qué rol da admin. **Los cambios se aplican al toque en las
salas encendidas, sin reiniciarlas.**

> ⚠️ El rango va por nick, y en HaxBall los nicks no son únicos: cualquiera puede ponerse
> "Jinder" y quedar de admin. El panel tampoco pide usuario ni contraseña: no publiques el
> puerto 8080 en internet.

### A mano, sin instalar nada

Entrá a <https://www.haxball.com/headless>, abrí la consola (`F12`), pegá el contenido de
`script.js` y dale Enter.

> 🔑 Los tokens de HaxBall **vencen a los pocos minutos** y cada sala necesita el suyo.
> Sacá tokens nuevos justo antes de arrancar: <https://www.haxball.com/headlesstoken>

### 🧪 Probar sin gastar un token

```powershell
npm run prueba           # la sala entera: entrar, chatear, comandos, gol, salir
npm run prueba-api       # la API del panel (rutas, controladores y modelos)
npm run prueba-base      # la base de datos (enrutado por entorno y tablas)
npm run prueba-actualizaciones  # las novedades del Discord (sin mandar nada)
npm run prueba-usuarios  # las claves: en la sala y contra la base
npm run prueba-nicks     # que no te echen por tu propio nombre
npm run prueba-rangos    # que un admin puesto a mano se caiga solo
npm run prueba-web       # la portada, el login y el panel solo para admins
npm run prueba-config    # parámetros y comandos desde el panel, con permisos
npm run prueba-carrusel  # el carrusel: imágenes seguras y permisos
npm run prueba-elo-salas # el ELO de cada sala y el general
npm run prueba-discord-vincular  # vincular Discord (simulado)
npm run prueba-tunel     # el aviso del link (un mensaje que se actualiza)
npm run prueba-espia     # que el panel no repita los mensajes
npm run prueba-chat      # hablar normal no dispara comandos
npm run prueba-camisetas # que los clubes cambien en cada partido
npm run prueba-turnos    # los capitanes eligiendo por turnos
npm run prueba-arranque  # que el partido vuelva solo del Stop y de la pausa
npm run prueba-modos     # los 3 modos y la espera mientras se elige
npm run prueba-discord   # el aviso de sala abierta al Discord
npm run prueba-elo       # el cálculo de puntajes y el circuito completo
npm run prueba-mapas     # HaxBall valida los 4 mapas
```

Monta una sala falsa, corre el script entero y simula jugadores que entran, usan comandos, hacen un gol y se van. Sirve para cazar errores antes de abrir la sala de
verdad. Conviene correrlo cada vez que se toca `script.js`.

### 🩹 Si reemplazás `script.js` por otro

Todo lo de ÑandutíHax (marca, camisetas paraguayas, rangos, arbitraje, webhook desactivado)
está guardado como parches. Después de poner un `script.js` nuevo:

```powershell
npm run parchar -- --ver    # muestra qué haría, sin tocar nada
npm run parchar             # lo aplica (guarda copia en script.anterior.js)
npm run prueba              # comprueba que quedó sano
```

El parcheador es cuidadoso: si el script nuevo ya trae su propio chat (`onPlayerChat`) o su
propio árbitro (`onTeamGoal`), **no los pisa** y avisa que los saltó. También arregla solo el
archivo si viene cortado a la mitad.

### 🔴 Si el token falla

La sala avisa sola. Si a los 40 segundos no salió el link, mira la página y te dice qué pasó:

```
❌ EL TOKEN VENCIÓ O NO SIRVE: HAXBALL ESTÁ PIDIENDO EL CAPTCHA
   Los tokens duran pocos minutos y se usan una sola vez.
   👉 Sacá uno nuevo con 'npm run tokens' y volvé a arrancar enseguida.
```

Si el problema es otro (internet caído, HaxBall caído), avisa
`LA SALA NO DIO SU LINK A TIEMPO`. En los dos casos cierra el navegador pero **deja el panel
prendido**, con la luz en rojo y el motivo escrito en la tarjeta. Se corta con `Ctrl+C`.

El tiempo de espera se cambia con `ESPERA_LINK_MS` (por defecto 40000).

---

## 🏠 Las 4 salas

Tres son de **Futsal** y una aparte es de **Real Soccer**, que es otro juego: cancha grande,
saques de banda, córners y saques de arco.

| Sala | Archivo | Jugadores | Mapa | Tiempo / Goles | Modo |
|---|---|---|---|---|---|
| **Futsal 3v3** | `hosts/3v3.json` | 12 | Futsal x3 | 3 min / 3 | Combinado (`!ganasigue` / `!elegir`) |
| **Futsal 4v4** | `hosts/4v4.json` | 14 | Futsal x4 | 4 min / 3 | Combinado (`!ganasigue` / `!elegir`) |
| **Futsal automático** | `hosts/todos.json` | 16 | Futsal x3 → x4 → x5 → x7 | según el mapa | Automático |
| **Real Soccer** | `hosts/realsoccer.json` | 16 | Real Soccer | 6 min / sin límite | Juegan Todos |

La sala **Futsal automático** arranca en **Futsal x3** y va cambiando de cancha sola según
cuánta gente esté jugando (sin contar a los AFK ni al bot):

| Jugadores | Mapa | Por equipo | Goles | Minutos |
|---|---|---|---|---|
| hasta 7 | Futsal x3 | 3 | 3 | 3 |
| 8 o 9 | Futsal x4 | 4 | 3 | 4 |
| 10 a 13 | Futsal x5 | 5 | 3 | 4 |
| 14 o más | Futsal x7 | 7 | 3 | 5 |

El cambio solo ocurre en los primeros 30 segundos del partido (`tiempoLimiteCambio`), para no
cortar un partido empezado.

Las cuatro usan el mismo `script.js`. Para cambiar algo de una sola, editá su JSON con cualquier
variable del inicio del script. Por ejemplo `"powerShotMode": true` o `"PasswordDelHost": "123"`.
Después basta con `docker compose restart`.

---


## 🎽 Cómo se arman los equipos (3v3 y 4v4)

Hay **tres modos**. Los cambia un admin escribiendo un comando en el chat, y cualquiera
puede ver cuál está puesto con `!modo`.

| Comando | Modo | Qué hace |
|---|---|---|
| `!ganasigue` | 🏆 Gana sigue | El que **gana se queda y pasa a Red**; el que pierde sale y va al final de la fila, y entran los que estaban esperando, de Blue. |
| `!elegir` | 🎽 Elegir | Siempre eligen los capitanes por turnos, y el partido **no arranca** hasta que terminen. |
| `!combinado` | 🔀 Combinado | Si no sobra nadie, el bot arma y arranca solo. Si hay más gente de la que entra en la cancha, eligen los capitanes y el partido espera. |

Las salas de **Futsal 3v3 y 4v4** arrancan en **combinado** (`"ModoDeEquipos"` en `hosts/*.json`).
Las otras dos salas vienen en `"config"`: el modo no toca nada y manda la configuración de la sala.

### Cuándo se elige

"Sobra gente" quiere decir que hay más jugadores despiertos que lugares en la cancha:
más de 6 en la x3, más de 8 en la x4. Los AFK no cuentan.

1. Los dos primeros espectadores pasan solos a Red y Blue: son los **capitanes**.
2. El bot avisa de quién es el turno y lista a los espectadores con su número.
3. El capitán escribe **el número solo**: `2`. El número es el **lugar en la lista de espectadores**
   (`1` el primero, `2` el segundo…), sin contar al bot. El cartel del turno muestra cada número con
   su nombre. También valen `!2` y `!elegir 2`. **Solo cuenta como elección si es tu turno**: para el
   resto de la sala, un número sigue siendo hablar.
4. Se alterna: Red elige uno, después Blue, hasta llenar los dos equipos.

**El partido se pausa mientras se elige.** Cuando hay gente esperando y queda lugar en la cancha,
el bot pausa el partido y avisa: así nadie sigue jugando sin darse cuenta de que tiene que elegir.
Cuando los equipos quedan completos, se sigue jugando enseguida.

**El que no elige, deja el lugar.** El capitán tiene **35 segundos**; sobre el final el bot
cuenta en el chat:

```
⏳ Pibe1 elige en 3…
⏳ Pibe1 elige en 2…
⏳ Pibe1 elige en 1…
⏳ Pibe1 no eligió en 15 segundos. Elige el que sigue.
```

Y sale de la sala. La elección pasa al que ya estaba en su equipo; si el equipo queda vacío,
entra de capitán el primero que estaba esperando. A los **admins no se los echa**: por ellos
elige el bot y la ronda sigue.

Se configura arriba del bloque `🎽 SELECCIÓN POR TURNOS`: `SegundosParaElegir` (15),
`SegundosDeCuenta` (3) y `EcharAlQueNoElige`. Con `EcharAlQueNoElige = false` no lo echa de la
sala: lo manda a espectadores y al final de la fila.

Los admins también pueden elegir. Con `!turno` se vuelve a mostrar el cartel.

**Mientras se elige no se juega**: si había un partido en curso queda en pausa hasta que los dos
equipos estén completos (3v3 o 4v4, según la sala), y ahí sigue solo.

Cuando termina un partido y hay gente esperando, se vacía la cancha y **se vuelve a elegir**:
los que acaban de jugar pasan al final de la fila, así los capitanes salen de entre los que
estaban esperando. En pleno partido no se mueve a nadie.

## ▶️ El partido arranca (y se reanuda) solo

Ningún admin tiene que apretar nada:

- **Con 2 jugadores despiertos ya se juega.** Si la sala está sin partido, el bot lo arranca.
- **Si alguien le da a Stop**, a los 5 segundos vuelve a arrancar (ese respiro es para no pisar
  un cambio de mapa).
- **Si el partido queda en pausa**, a los 10 segundos se reanuda solo.
- **Cuando alguien gana**, a los 8 segundos se cierra el partido para que empiece el siguiente
  (con el gana-sigue apagado el script lo dejaba abierto para siempre).
- **Mientras los capitanes eligen**, el partido espera: arrancar antes dejaría afuera a los que
  están esperando su turno.

Arrancar y reanudar piden lo mismo: 2 jugadores que **no estén AFK**. Si uno de los dos está AFK
no cuenta, así que el partido no arranca ni se reanuda hasta que vuelva (con `!afk`) o entre otro.

Se configura arriba del bloque `▶️ ARRANQUE AUTOMÁTICO` de `script.js`: `AutoArranque`,
`JugadoresParaArrancar` (2), `SegundosDePausaMaxima` (10), `SegundosTrasParar` (5) y
`SegundosTrasVictoria` (8).

## 📣 Aviso al Discord cuando abre una sala

Apenas HaxBall entrega el link, el bot publica una tarjeta en el Discord de
**[ÑandutíBall](https://discord.gg/TGRug4BGG)** con el nombre de la sala, el mapa, el modo, el
cupo, la ubicación y el botón para entrar. Cada sala manda la suya, así que al levantar las 4
salen 4 tarjetas. El mismo link no se avisa dos veces.

Se configura arriba del bloque `📣 AVISO DE SALA ABIERTA` de `script.js`:

| Variable | Para qué |
|---|---|
| `AvisoSalaAbierta` | `false` para no avisar nada |
| `WebhookSalaAbierta` | El webhook de Discord al que se manda |
| `DiscordDeLaSala` | El link de invitación que aparece en el pie y en el chat |
| `TagSalaAbierta` | `"@here"`, `"@everyone"`, un ID de rol, o `""` para no pinguear a nadie |
| `TituloSalaAbierta`, `MensajeSalaAbierta`, `BotonSalaAbierta`, `PieSalaAbierta` | La plantilla |
| `ColorSalaAbierta`, `NombreDelAvisador` | Color de la tarjeta y nombre con el que firma el bot |

En la plantilla se pueden usar `{sala}`, `{link}`, `{mapa}`, `{cupo}`, `{modo}`, `{ubicacion}`
y `{discord}`. Por ejemplo:

```js
var TituloSalaAbierta = "🟢 ¡{sala} está abierta!";
var MensajeSalaAbierta = "⚽ Ya se puede entrar a jugar. ¡Te esperamos en la cancha!";
```

### La invitación al Discord en el chat

Cada **3 minutos** el bot escribe en el chat de la sala:

```
💬 ¿Buscás equipo, torneos o querés pasar tus quejas? Entrá al Discord de ÑandutíBall 🇵🇾
🔗 https://discord.gg/TGRug4BGG
```

Con la sala vacía no habla solo. Se configura con `MinutosEntreAvisos` (10),
`MensajeDiscordEnElChat` (las líneas, admiten `{discord}`, `{sala}`, `{link}`…) y
`AvisoDiscordEnElChat` (`false` para apagarlo), todo arriba del mismo bloque.

**Sin spam en el chat.** Ningún cartel se sacó, pero cada uno sale cada tanto según lo importante:

| Cartel | Cada |
|---|---|
| Poné tu clave (iniciar sesión) | 1 minuto |
| Creá tu cuenta en la web | 5 minutos |
| Están jugando X vs Y | cada partido |
| Invitación al Discord · Escribí !help · Anuncio de la sala · Cómo expulsar · Tutorial | 10 minutos |

Los tiempos de los carteles de cada partido están en `ReglasDeAvisos` (bloque `🔕 AVISOS SIN SPAM`).

> 🔒 **Desde la sala no sale nada a ningún Discord.** El aviso lo manda la computadora que
> levanta el host, no el juego: así la llave del canal no queda a la vista de nadie.
>
> ⚠️ **El webhook es una llave.** Cualquiera que lo tenga puede escribir en ese canal, y
> `script.js` se sube a GitHub. Si el repositorio es público, conviene poner el webhook en `.env`
> (`WEBHOOK_SALA_ABIERTA=...`, ignorado por Git): el lanzador lo inyecta y pisa al del script.
> Si alguna vez se filtra, se borra en Discord (Editar canal → Integraciones → Webhooks) y se
> crea uno nuevo.

## 🌍 Sacar la web afuera de localhost

Con **Cloudflare** la página sale a internet sin abrir puertos ni contratar nada:

```powershell
npm run tunel            # túnel al panel (puerto 8080)
npm run tunel -- 3001    # a otro puerto
```

Te devuelve una dirección tipo `https://algo-algo.trycloudflare.com` y **la avisa en el Discord**.

En el canal se publica **un solo mensaje, que se va actualizando**: cuando el link cambia (cambia
en cada arranque) se edita ese mismo mensaje, y cuando cortás con Ctrl+C queda diciendo que la
web está apagada. Así el canal nunca se llena de links viejos que ya no andan.

Con `TUNEL_WEB=si` en el `.env`, **`npm start` lo levanta solo** junto con las salas.

El webhook del canal va en `WEBHOOK_WEB`. `cloudflared` ya está instalado; si alguna vez falta:
`winget install Cloudflare.cloudflared`.

> ⚠️ Con el túnel abierto, **cualquiera con el link entra a la web**. El panel pide sesión de
> admin, pero la API todavía no: no dejes el túnel abierto si no lo estás usando.

## 🕸️ Ñandutí Web

La página de ÑandutíBall: <http://localhost:8080> (o el puerto de la sala).

- Arriba a la derecha: **Iniciar sesión** o **Crear cuenta**.
- Es la **misma cuenta que en la sala**: te la creás en la web y después entrás a la sala con `!clave`.
- Con sesión, la portada muestra **Tu ELO** (puntaje, división, cuánto te falta para subir, puesto,
  partidos, efectividad y goles) y el **ranking** de los mejores con sus goles, con buscador.
- Tocando **tu nombre** arriba a la derecha se abre tu menú: **Mi cuenta**, **Cambiar contraseña**,
  el **Panel** (si tu rango es de admin) y **Cerrar sesión**.

### 🔢 Cambiar la contraseña (Mi cuenta)

1. En **Mi cuenta** tocás **Enviar código**: te llega un mail con un **código de 6 números**.
2. Escribís el código y la contraseña nueva. El código vence en **10 minutos**, sirve una sola vez
   y se quema a los **5 intentos** equivocados. Para pedir otro hay que esperar 60 segundos.

Si tu cuenta es de antes y no tiene correo, Mi cuenta te pide agregarlo primero (con tu contraseña
actual). La web tiene modo claro y oscuro: sigue lo que tenga puesto tu celular o tu compu.

La sesión dura **1 hora y media** y se renueva sola mientras tengas la página abierta.

### 📧 Correo y "¿Olvidaste tu contraseña?"

Para crear la cuenta se pide **correo electrónico** (dos cuentas no pueden tener el mismo), y
**tiene que existir**: si el Gmail es imposible o el dominio no recibe correos (por ejemplo
`gmial.com`) la página dice que no existe, y si pasa ese control se manda un **código de 6 números**
que hay que poner para terminar de crear la cuenta. Sin el código no hay cuenta. Si te olvidás la
contraseña:

1. En el login tocás **¿Olvidaste tu contraseña?** y escribís tu correo.
2. Te llega un mail con el botón **Cambiar mi contraseña**. El link vence en **30 minutos** y
   sirve **una sola vez**.
3. Te lleva a la página para elegir la nueva. Es la misma que usás en la sala con `!clave`.

La página contesta lo mismo aunque el correo no esté registrado, así nadie puede averiguar qué
correos tienen cuenta. Los que se registraron antes de esto no tienen correo: el OWNER les puede
poner una clave nueva desde la pantalla de usuarios.

Para que el mail salga de verdad hay que poner el SMTP en `.env` (ver `.env.example`). Con Gmail:
verificación en 2 pasos + una **contraseña de aplicación** en
<https://myaccount.google.com/apppasswords>. Sin eso la web anda igual y el mail (con el link) se
muestra en la consola.

Las pantallas viven en `public/frm/<pantalla>/index.html` (el mismo encarpetado que usa
app-centralshop), con `public/css/` y `public/js/` compartidos.

### 💰 Anuncios en la web

La publicidad de la portada está **apagada de fábrica**. Para que salga hacen falta dos cosas:

1. `ADSENSE_CLIENTE=ca-pub-…` en el `.env` (tu identificador de Google AdSense).
2. Prender **"Mostrar anuncios en la web"** en el panel → **Ajustes** (solo el OWNER).

Con eso ya andan los *Auto ads*: Google decide dónde ponerlos. Si preferís elegir vos el lugar,
creá en AdSense un bloque por espacio y poné su número en `ADSENSE_ESPACIO_PORTADA_ARRIBA` y
`ADSENSE_ESPACIO_PORTADA_ABAJO`: así los avisos salen solo arriba (debajo del carrusel) y abajo
(después del ranking), y no tapan nada.

Los avisos se adaptan solos al ancho de la pantalla, y con los anuncios apagados la página **no
carga nada de Google** (ni siquiera cookies). Para sacarlos en cualquier momento alcanza con
apagar el interruptor del panel: no hay que tocar código ni reiniciar nada.

### 🔎 Que la encuentren en Google

La web está en **https://nandutihax.com**. Para que los buscadores la tomen bien:

- `public/robots.txt` deja mirar la portada, entrar y crear cuenta, y cierra el panel y la API.
- `public/sitemap.xml` lista las páginas públicas.
- Cada página pública tiene título, descripción y las etiquetas para compartir, así que **cuando
  pegás el link en el Discord o en WhatsApp sale la tarjeta con el logo** (`public/img/portada.png`,
  1200×630) en vez del link pelado.

Falta un paso que es a mano: dar de alta el sitio en **Google Search Console**
(<https://search.google.com/search-console>), verificarlo con el registro TXT que te da Google
(se carga en el DNS de Cloudflare), mandarle `https://nandutihax.com/sitemap.xml` y pedir la
indexación de la portada. Desde que Google la ve por primera vez hasta que aparece buscando el
nombre pasan de varios días a un par de semanas: es normal, no está roto.

## 🔗 Vincular Discord

Con la sesión iniciada, en **Mi cuenta** (y en un aviso en la portada) está el botón **Vincular con
Discord**. Discord pide permiso para ver tu usuario y sumarte al servidor; al aceptar, la cuenta queda
vinculada y **entrás solo al servidor de ÑandutíHax**. No es para iniciar sesión y nunca se ve tu
contraseña de Discord. En la tabla de **Usuarios** del panel se ve el Discord de cada cuenta.

Para activarlo hay que crear una aplicación con bot en el portal de Discord y completar
`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN` y `DISCORD_GUILD_ID` en `.env`
(los pasos están en `.env.example`). La dirección de vuelta que se registra en Discord es
`<link de la web>/api/discord/vuelta`: si el link de la web cambia, hay que actualizarla. Para no tener que
hacerlo nunca, está la **página puente** (`puente-discord/`): se sube una vez a GitHub Pages, se registra
esa dirección en Discord y en `DISCORD_REDIRECT_URI`, y reenvía sola al link que tenga la web en ese
momento. Los pasos están en `puente-discord/LEEME.md`.

## 🖼️ Carrusel de la portada

Arriba de todo en la portada pasan las imágenes que se cargan desde el panel, en la sección
**Carrusel** (OWNER, CO-OWNER, HOSTER y AYUDANTE):

- Se sube arrastrando o eligiendo la imagen: **PNG, JPG, WebP o GIF, hasta 3 MB**. Se ve mejor
  apaisada, por ejemplo 1600×600.
- Cada una puede tener título, un texto y un enlace (al tocarla, lleva ahí).
- Se pueden activar o desactivar, ordenar con las flechas y borrar.

La imagen se guarda en la base (`imagenes_carrusel`). La portada la ve cualquiera, con o sin
cuenta. El ranking de la portada va de a 10 jugadores por página, con buscador.

## 🛠️ Ajustes de la web (solo el OWNER)

En el panel, la sección **Ajustes** tiene los interruptores de lo que se le pide a la gente para
crear su cuenta. Solo los ve y los cambia el OWNER, y se aplican al instante:

| Interruptor | Para qué |
|---|---|
| Pedir el código por correo | Apagalo si el correo deja de andar: la cuenta se crea sin confirmar la dirección |
| Revisar que el correo exista | Apaga el control de las reglas de Gmail y del dominio |
| Pedir correo electrónico | Apagado, se puede crear la cuenta sin correo (después no se puede recuperar) |
| Dejar crear cuentas nuevas | Apagado, nadie se registra; los que ya tienen cuenta entran igual |

## 👮 Quién puede expulsar y banear

El panel de **Salas** (ver quién está conectado en cada sala) y el botón de **expulsar** los tienen
OWNER, CO-OWNER, HOSTER y **AYUDANTE**. **Banear** lo pueden todos esos **menos el AYUDANTE**: el
botón ni le aparece, y si lo intenta por otro lado, el servidor lo rechaza.

El AYUDANTE también entra a **Configuración** y **Carrusel**. Lo único que no puede es **banear**,
ni entrar a Rangos, Usuarios o Ajustes.

## ⚙️ Configuración de las salas

En el panel, la sección **Configuración** deja cambiar los parámetros de juego de cada sala y
apagar comandos. La pueden usar **OWNER, CO-OWNER, HOSTER y AYUDANTE**.

- **Parámetros**: minutos por partido, límite de goles, modo de equipos, jugadores por equipo,
  segundos para elegir, arranque automático, cupo, nombre de la sala y más, agrupados. Se guardan
  solos al cambiarlos.
  - Los marcados **en vivo** llegan a la sala en unos segundos, sin reiniciarla. Los minutos y el
    límite de goles se aplican desde el próximo partido.
  - Los marcados **al reiniciar la sala** (nombre, cupo, contraseña, mapa inicial…) se usan la
    próxima vez que se abra.
  - Cada cambio queda con el nombre de quien lo hizo, y se puede **volver al valor de fábrica**.
- **Comandos**: un interruptor por comando, para una sala o para todas. Al que escribe un comando
  apagado, el bot le avisa que está desactivado. `!clave` y `!login` no se pueden apagar.
  > ⚠️ **Apagar un comando no apaga la función.** Apagar `!powershot` solo impide escribir ese
  > comando en el chat; para prender o apagar el disparo potente está **Parámetros → Partido →
  > Disparo potente**.

**Las dos puntas quedan iguales.** Lo que un admin cambia con un comando adentro de la sala
(`!powershot`, `!comba`, `!ganasigue`, `!combinado`, `!elegir`, las camisetas…) **se guarda solo en
la web**, y aparece en Configuración con el autor "la sala". Y lo que cambiás en la web llega a la
sala en unos segundos. Si se cambia en los dos lados casi al mismo tiempo, gana la web.

Todo se guarda en la base (`parametros_sala` y `comandos_apagados`). Si la base está apagada, las
salas abren con lo de `hosts/*.json`, como siempre.

**Modo oscuro**: todas las pantallas (la web y el panel) tienen un botón arriba a la derecha para
cambiar entre claro y oscuro. Lo que elegís queda guardado en tu navegador.

## 🎖️ Rangos

**Solo OWNER y CO-OWNER** ven la sección Rangos del panel. Para darle un rango a alguien se busca
y se elige su **cuenta** (las creadas en la web), en vez de escribir el nick a mano.

Los rangos (OWNER, CO-OWNER, HOSTER, AYUDANTE…) viven en la tabla **`rangos`** de la base y se
administran desde el panel. **La sala los revisa cada 5 segundos** y deja a cada uno como dice la
tabla:

- el que tiene un rango con admin, es admin;
- **el que no está en la tabla, no es admin** — aunque se lo haya dado alguien a mano.

Eso es lo que corta las inyecciones de javascript: si alguien se mete en la consola y se pone
admin, a los 5 segundos lo pierde. Y si te sacan el admin siendo OWNER, te vuelve solo.

Para dejar la base lista la primera vez:

```powershell
npm run base:sembrar     # copia los rangos de roles.json a la tabla y crea al dueño
```

Si la base está apagada se usa `roles.json` como respaldo, y si no hay ningún rango cargado no se
le saca el admin a nadie (para no quedarte afuera de tu propia sala).

## 🔐 Usuarios con clave

Para que nadie te use el nombre, cada usuario tiene su clave:

- **Si entrás con un nombre registrado**, el bot te pide la clave y mirás de afuera hasta que la
  pongas: `!clave tu-contraseña`. Si no la ponés en 90 segundos te saca (podés volver a entrar).
- **Si tu nombre no está registrado**, jugás normal, y cada 5 minutos te aparece un cartelito
  con el **link de Ñandutí Web** para que te crees la cuenta ahí.
- **Las cuentas se crean en la web, no en el chat.** Desde la sala solo se pone la clave
  (`!clave`): no se cargan datos por el chat. Si escribís `!registrar`, el bot te pasa el link.
- Para cambiar la contraseña, también en la web.

Las claves se guardan **hasheadas** en la tabla `usuarios`: ni en la base ni en el chat aparece
la contraseña de nadie. Si la base está apagada, la sala funciona como siempre y no se le pide
clave a nadie.

## 📣 Actualizaciones (novedades para el Discord)

En el panel hay una pantalla **📣 Actualizaciones** para contarle a la gente qué cambió.

1. Se escribe la novedad ahí (o se carga sola cada vez que se toca el bot).
2. Queda **esperando**: no sale a ningún lado todavía.
3. Cuando le das **Enviar al Discord**, recién ahí se publica en el canal de actualizaciones.

Así nada sale sin que lo hayas leído antes. Las novedades se guardan en la tabla
**`actualizaciones`** de la base, con su estado (esperando · enviada · error) y la fecha.

También se pueden cargar desde la terminal:

```powershell
npm run actualizacion -- "Ahora el partido arranca solo cuando hay 2 jugadores"
npm run actualizacion -- --lista      # ver las últimas
npm run actualizacion -- --enviar     # mandar todas las que estén esperando
```

El webhook del canal va en `.env`, en `WEBHOOK_ACTUALIZACIONES`. Sin eso se pueden guardar
novedades pero no enviarlas (el panel lo avisa).

Las novedades se escriben **como se las contarías a alguien que entra a jugar**: qué cambia en la
sala, sin nombres de archivos ni palabras técnicas.

## 🗄️ La base de datos

Postgres en Docker, **aparte de las salas** (tiene su propio compose, así se puede levantar sola):

```powershell
npm run base            # levanta Postgres        (docker compose -f docker-compose.base.yml up -d)
npm run base:migrar     # crea/actualiza las tablas
npm run base:ver        # Prisma Studio, para mirar los datos
npm run prueba-base     # comprueba que todo enchufe
npm run base:bajar      # la baja (los datos quedan en ./postgres)
```

La base se llama **nandutihax**, escucha en el **5432** y los datos quedan en la carpeta
`./postgres` (ignorada por Git).

> El PostgreSQL 16 que tenías instalado en Windows (servicio `postgresql-x64-16`) ocupaba ese
> puerto: quedó **detenido y en arranque Manual**. Si alguna vez lo necesitás de vuelta:
> `Start-Service postgresql-x64-16` (como administrador) y esta base pasala al 5433.

### A qué base le habla

Como en el Visualizador de facturas: una variable decide el entorno y **solo se abre esa conexión**.

```
DB_ENV=desarrollo        # produccion | testing | desarrollo
DB_DESARROLLO_URL=postgresql://postgres:postgres@localhost:5432/nandutihax?schema=public
DB_TESTING_URL=
DB_PRODUCCION_URL=
```

`services/ConexionBase.js` requiere `ConexionPostgres<Entorno>.js` según `DB_ENV`; si falta la URL
de ese entorno usa `DATABASE_URL`. La conexión se abre recién cuando alguien la pide, así que
**el host y el panel andan igual con la base apagada** — todavía no dependen de ella.

### Las tablas

| Tabla | Qué guarda |
|---|---|
| `usuarios` | nick (único), su clave (hasheada), auth, ELO, partidos, goles, asistencias |
| `salas` | las 4 salas (clave y nombre) |
| `partidos` | sala, mapa, goles de cada lado, ganador, inicio y fin |
| `participaciones` | quién jugó qué partido, de qué lado, con cuánto ELO antes y después |
| `actualizaciones` | las novedades para el Discord (esperando · enviada · error) |
| `rangos` | los rangos que hoy viven en `roles.json` |

Es la primera versión y la vamos a ir cambiando: se toca `prisma/schema.prisma` y se corre
`npm run base:migrar`.

## 🎉 Animaciones de gol

Cuando hacés un gol podés festejar con una animación que compraste con monedas. Hay dos cosas
que puede hacer, y se pueden combinar: **pasarte emojis o letras** por encima (hasta 10, uno atrás
del otro) y **hacerte grande y chico**.

- **Solo festeja el que hizo el gol.** El que dio la asistencia no, aunque tenga una comprada.
- **Dura lo que dura el festejo**: se corta sola cuando se saca del medio, así que nadie sigue
  agrandado jugando. Y el bot **espera** a que termine antes de acomodar a la gente en la cancha.
- Se prenden y se apagan desde **Mi inventario**, que tiene un apartado propio para animaciones,
  aparte del de camisetas. Ahí también las podés probar y venderlas al 70%.
- En la sala: `!animaciones` para ver las tuyas, `!animacion <nombre>` para ponértela y
  `!animacion ninguna` para sacártela.

**Para crearlas** (solo el OWNER y el CO-OWNER): panel → **Animaciones**. El editor tiene:

- **Una cancha igual a la del juego** que se repite sola: le pasan la pelota, el jugador remata,
  entra el gol y ahí se ve tu animación tal como va a salir en la sala, con el emoji **adentro del
  jugador** (que es donde HaxBall lo muestra). Se puede **pausar** y **agrandar** — agrandala para
  ver bien el emoji, porque a tamaño normal la cancha está a escala real y el jugador es chico.
- **El festejo dura lo que vos pongas**: si ponés 10 segundos, el bucle festeja 10 segundos. Abajo
  te va marcando "Festejando 3,4 / 10,0 s" con una barra.
- **Una línea de tiempo** con los puntos de la animación, uno al lado del otro. Tocá un punto para
  cambiarlo, arrastralo para moverlo de lugar, la ✕ para sacarlo y el **+** para agregar. Abajo hay
  un teclado de emojis para ir armándola rápido. Cada punto te dice en qué segundo aparece.
- **La velocidad en puntos por segundo** (no en milisegundos), y te avisa cuántas veces se va a
  repetir la secuencia con la duración que pusiste.
- **El tamaño se toca siempre**: dejá los dos en 1× si no querés que el jugador crezca. No hace
  falta elegir "tipo" de animación: sale solo de lo que cargues.

## 👕 La camiseta que compraste

Si compraste camisetas en la tienda, las ves con **`!camisetas`** y te ponés una con
**`!camiseta nacional`** (o el club que sea). Tu equipo juega con esa, en vez de la del sorteo.

- La elige **el capitán** del equipo: el que armó el equipo en la elección.
- **Le dura hasta que se vaya de la sala o se cambie de equipo.** Si gana y sigue, sigue con la
  suya, partido tras partido. Cuando se va, el equipo vuelve a la camiseta del sorteo.
- `!camiseta ninguna` te la saca y volvés a la del sorteo.

## ⚽ La pelota de futsal

La pelota se frenaba demasiado rápido y quedaba muerta contra las paredes. Ahora conserva más
velocidad y rebota como corresponde. **Real Soccer quedó igual**, esto es solo para las salas de
futsal (3v3, 4v4 y la automática).

Si querés afinarlo, son dos números y hay que cambiarlos **en los dos lugares**:

- `mapas/generar.js` → `FISICA_PELOTA` (la pelota del mapa)
- `parches/aplicar.js` → `⚽ Física de la pelota de futsal` (porque el script la vuelve a
  configurar cada vez que se usa el powershot)

| Número | Ahora | Qué hace |
|---|---|---|
| `damping` | 0.993 | Cuánto sigue rodando. Más cerca de 1 = llega más lejos. Arriba de 0.995 se vuelve un jabón |
| `bCoef` | 0.5 | Cuánto rebota al chocar. Más alto = más viva contra las paredes |

Después: `npm run generar-mapas`, `npm run parchar`, `npm run prueba-mapas`. **El cambio se
siente recién cuando reiniciás las salas.**

## 🗺️ Mapas propios de futsal

Las salas de futsal usan mapas nuestros: la misma cancha y la misma física del original, con el
nombre de ÑandutíHax y la **pelota amarilla lisa** (sin las pintitas negras).

```powershell
npm run generar-mapas    # escribe mapas/*.hbs
npm run parchar          # los mete en script.js
npm run prueba-mapas     # HaxBall los valida
```

Para ver un mapa sin abrir una sala: `node pruebas/render.js mapas/nanduti-futsal-x3.hbs vista.png`

## 🪙 Monedas

Cada cuenta tiene sus **monedas**, que se ganan jugando. **Solo cobra el equipo que gana el
partido**: si perdés o empatás no se suma nada, aunque hayas hecho goles.

| Por | Ganás | Máximo por partido |
|---|---|---|
| Ganar el partido | 1 moneda | — |
| Cada gol | 1 moneda | 3 (el hat-trick es el tope) |
| Cada asistencia | 1 moneda | 3 |
| Cada atajada del arquero | 0,30 monedas | 3 |

Al terminar el partido, **a cada uno le llega en privado** lo que ganó y cuánto le quedó; el resto
solo ve el aviso general. En la sala, `!monedas` te dice tu saldo.

Las monedas se ven en la **portada** ("Tus monedas", con los últimos movimientos) y en **Mi cuenta →
Monedas**, con todo el historial: cuándo, por qué y el saldo que quedó.

Solo suman las cuentas de la web que pusieron su `!clave` en la sala, igual que el ELO.

## 📊 ELO y divisiones

**Cada sala tiene su propio ELO** (Futsal 3v3, 4v4, automático y Real Soccer), y además hay un
**ELO general**, que es el promedio de tus ELO de cada sala pesado por los partidos que jugaste en
cada una (si jugaste mucho más en 3v3, el 3v3 pesa más). Cada partido suma o resta solo en la sala
donde se jugó; el general lo recalcula la base sola.

**Solo suman los que tienen cuenta** (creada en la web) **y pusieron su `!clave` en la sala.** Los
demás juegan igual, pero no ganan ni pierden puntos, y al terminar la sala avisa quiénes no
sumaron. Si la base está apagada, ese partido no suma a nadie.

- En la sala: `!elo` muestra el de esa sala y el general · `!top` los mejores de esa sala ·
  `!top general` los mejores de todas.
- En la web: el ranking tiene pestañas **General** y una por sala, y "Tu ELO" muestra el general
  y el de cada sala.

Cada jugador tiene un **puntaje** que sube si gana y baja si pierde. Ese puntaje lo ubica en una
división, así se ve de una quién recién empieza y quién juega bien.

| División | Desde | | División | Desde |
|---|---|---|---|---|
| 🥉 Novato | 0 | | 🟠 Crack | 1350 |
| 🟢 Amateur | 900 | | 🔴 Pro | 1500 |
| 🔵 Regular | 1050 | | 🏆 Leyenda | 1700 |
| 🟣 Avanzado | 1200 | | | |

Todos arrancan en **1000**. Al terminar cada partido, el bot reparte los puntos y avisa en la sala:

```
📊 Jinder +18 · Chelato +18 · Romerito -18 · Kuñataí -18
⬆️ Jinder ahora es 🔴 Pro
```

**Cómo se reparten:** se compara el promedio de puntaje de cada equipo. Ganarle a un equipo mejor
que el tuyo suma más, y perder contra uno peor descuenta más. Un empate contra alguien de menos
puntaje también te hace bajar. Los primeros 10 partidos mueven más el puntaje, para ubicar rápido
al que recién llega.

**En el chat, el nombre sale con el color de su división** y con su emoji adelante:

```
🔴 【👑】 Jinder :    dale que ganamos
🥉 【🔵】 Pynandi :   recién arranco
```

En el panel pasa lo mismo: los nombres de la pestaña **Cancha** y de **Jugadores** van pintados
con el color de su división. Si pasás el mouse por encima te dice el puntaje.

**Comandos:** `!elo` (el tuyo o el de otro: `!elo Jinder`) · `!top` (los 10 mejores) · `!divisiones`

El puntaje va por **auth** (el Public ID de HaxBall, que no se puede falsear), no por nick: si
alguien se cambia el nombre, su puntaje lo sigue. Se guarda en `datos/elo.json` del lado de Node,
así sobrevive a que se cierre la sala, y **las 4 salas comparten la misma tabla**.

Solo cuentan los partidos que **termina un equipo ganando**: si un admin le da a Stop o se cambia
el mapa, nadie suma ni pierde puntos. Si la base está levantada, cada partido también queda en
las tablas `partidos` y `participaciones`, y a cada jugador se le suma en `usuarios` (ELO,
partidos, ganados, perdidos, goles). Solo se guarda a los que tienen cuenta (creada en la página): al que juega sin cuenta no se le crea nada, y su puntaje queda igual en `datos/elo.json`.

En el panel hay una pestaña **ELO** con la tabla completa: puesto, división, puntos, partidos
jugados y el historial de ganados-empatados-perdidos.


## 👀 Sin límite de espectadores

Las salas admiten **30 personas**, el máximo que permite HaxBall, y **nadie que solo mire va a
ser echado**. Para eso se sacaron dos cosas del script original:

- **Lugares reservados:** cuando la sala se llenaba casi del todo, el script le ponía **contraseña**
  y no entraba nadie más. Ahora `LugaresReservados` va en 0.
- **Expulsión por AFK:** echaba de golpe a todos los AFK cuando eran 4 o más, y alguien que solo
  mira cuenta como AFK a los 5 minutos. Ahora ese límite está en 99, así que no echa a nadie.

Los jugadores que estén AFK **dentro de la cancha** se siguen mandando a espectadores, que es lo
que corresponde para que no traben el partido.

## ⚽ Camisetas paraguayas

El script trae las camisetas de los **28 clubes profesionales** más la Selección.

**Primera División:** Olimpia · Cerro Porteño · Libertad · Guaraní · Nacional · Sportivo Luqueño ·
Recoleta · Rubio Ñu · Sportivo Trinidense · Sportivo Ameliano · Sportivo San Lorenzo · 2 de Mayo

**División Intermedia:** 12 de Junio · 3 de Noviembre · Atlético Tembetary · Benjamín Aceval ·
Deportivo Capiatá · Deportivo Santaní · Encarnación FC · Fernando de la Mora · General Caballero JLM ·
Guaireña · Independiente CG · Paraguarí · Resistencia · Sol de América · Sportivo Carapeguá · Tacuary

**Las camisetas cambian solas en cada partido**: hay 28 cruces armados, y el superclásico
**Olimpia vs Cerro** es el que más sale. Cuando se enfrentan dos camisetas parecidas
(Olimpia vs Nacional, Guaraní vs Luqueño…), el equipo azul cambia automáticamente.

Eso lo maneja `cambioCami`, que el script del autor traía **apagado** (por eso los equipos
quedaban siempre con la misma camiseta). Las 4 salas lo traen prendido con `"cambioCami": true`
en `hosts/*.json`. En vivo se prende y se apaga con `!clubcolors` (admin).

Aparte está `!togglecamisetas` (`CamisetasGanaSigue`): el que gana **mantiene** su camiseta y
solo cambia el que pierde o empata. Viene apagado; los dos modos no se usan juntos.

Para agregar un club, copiá una entrada de `camisetasEquipos` (línea 688) con el formato
`/colors <equipo> <ángulo> <color del número> <franja1> <franja2> <franja3>`.

---

## ⚙️ Configuración (inicio de `script.js`)

### Sala
| Variable | Qué hace |
|---|---|
| `NombreHost` | Nombre de la sala (lo pisa el JSON de cada host) |
| `VisibilidadDelHost` | `true` pública / `false` privada |
| `CantidadDeJugadores` | Máximo de jugadores (1–30) |
| `PasswordDelHost` | Contraseña de la sala (`null` = sin contraseña) |
| `ReiniciarStats` | `"Si"` borra las estadísticas al iniciar |
| `UbicacionDelHost`, `BanderaDelHost` | Ubicación y bandera que muestra la sala |
| `ActivarReCaptcha` | Pedir captcha a quien entra |

### Administración
| Variable | Qué hace |
|---|---|
| `ClaveParaSerAdmin` | Ya no se usa: el admin se da solo desde la tabla de rangos del panel |
| `ListaDeAdmins` | Admins por `auth` (de haxball.com/playerauth) y nicks |
| `contrasena`, `LugaresReservados` | Lugares reservados para admins |
| `NickNamesRol1..10`, `NombreROL1..10` | Roles con prefijo y color en el chat |
| `ListaDeJogadores` | Jugadores registrados |

### Juego
| Variable | Qué hace |
|---|---|
| `MapaPorDefecto` | Mapa al iniciar |
| `TiempoDeJuego`, `LimiteDeGoles` | Minutos y goles por partido |
| `camisetaRed`, `camisetaBlue` | Camisetas por defecto (Olimpia y Cerro) |
| `TamanoMinimoPermitido`, `TamanoMaximoPermitido` | Límites de `!size` |
| `PelotaRS`, `PotenciaPowerShot`, `TipoPelotaFutsal` | Color y potencia de la pelota |

### Modos de juego
`autoBalanceEnabled` (equilibrar equipos) · `ganasigueEnabled` (gana sigue) ·
`CamisetasGanaSigue` · `cambioCami` (camisetas al azar) · `modoJueganTodos` /
`modoJueganAlgunos` + `maxPlayersPerTeam` · `powerShotMode`, `JabulaniMode`, `combaMode` ·
`GolDeOroActivado` · `FairPlayActivado` · `automatizadoActivado` (cambia el mapa según cuántos hay)

### Moderación
| Variable | Qué hace |
|---|---|
| `LimiteMaximoDeJugadoresAFK`, `SegundosPermitidosAFK`, `MinutosPermitidosAFK` | Expulsión de AFK |
| `MaximoJugadoresPorIp` | Jugadores por misma IP |
| `PaisesProhibidos`, `IpPlayers`, `NicknamesPROHIBIDOS` | Bloqueos de acceso |
| `MESSAGE_COOLDOWN`, `SPAM_LIMIT`, `KICK_THRESHOLD` | Anti-spam del chat |
| `PorcentajeDeVotosBan/Admin`, `DURACION_VOTACION` | Votaciones |

### Webhooks de Discord
`WebhookSalaAbierta` (**el nuestro**: avisa cuando abre una sala) · `WebhookGrabaciones` (replays
y resúmenes) · `WebhookParaLlamarAdmins` · `AnuncioKicksBans` · `webhookMensajesJugadores`
(chat) · `webhookBoletero` (entradas y salidas) · `webhookEstadisticasJugadores` ·
`webhookIPJugadores`

Todos menos `WebhookSalaAbierta` siguen siendo **los del autor original** (ver Problemas conocidos).

---

## 🏟️ Mapas

- **Real Soccer:** `!rs`, `!rs2`, `!rsevo`, `!rsoveja`, `!minirs`, `!entrenamiento`
- **Futsal:** `!futx2`, `!futx3`, `!futx4`, `!futx5`, `!futx5cesped`, `!futx7`, `!realfutsal`, `!entrenamientofutsal`
- **Penales:** `!pensred`, `!pensblue`
- **X-Man:** `!2man` … `!8man`
- **Otros:** `!basket`, `!handball`, `!voley2d`, `!voley3d`, `!tenis-ladrillo`, `!tenis-pasto`, `!tenis-cemento`, `!sk8`, `!escuela`, `!big`, `!campeones`, `!premios`

`!mapas` muestra la lista dentro de la sala.

---

## 💬 En el chat se habla de todo

Los comandos **solo se disparan con `!`**. Todo lo demás es una charla y el bot no se mete.

Antes no era así y molestaba:

- El script ponía y sacaba del AFK a cualquiera que escribiera **estoy**, **listo**, **volvi**,
  **mtm** o **meteme** en medio de una frase (“estoy re picante hoy” te sacaba de la cancha).
  Ahora el AFK se maneja **solo con `!afk`**.
- Con el draft prendido, escribir un número elegía a ese jugador, le tocara o no. Ahora el número
  **solo elige si es tu turno de elegir**: el resto puede escribir “3 - 1 vamos” tranquilo.

**Los comandos no se ven en el chat.** Si escribís `!clave loquesea`, el bot lo entiende pero
nadie lo ve: tu contraseña no queda a la vista de la sala.

Siguen andando los prefijos de siempre, que no son comandos sino formas de hablar:
`t mensaje` (a tu equipo), `ac mensaje` (entre admins) y `@@nick mensaje` (privado).

Lo único que puede frenar un mensaje es la moderación de los admins: `!silenciar palabra`,
`!mute` y `!pausechat`.

`npm run prueba-chat` lo verifica: frases con esas palabras, números sueltos y `!7`.

## 💬 Comandos

### Jugadores
| Comando | Uso |
|---|---|
| `!help` | Lista de comandos |
| `!elo`, `!elo NOMBRE` | Tu puntaje y división, o el de otro |
| `!top` | Los 10 mejores del ranking |
| `!divisiones` | Qué puntaje hace falta para cada división |
| `t mensaje` | Chat privado con tu equipo |
| `!afk`, `!afks` | Ponerse AFK / ver quién está AFK |
| `!me`, `!stats ID` | Estadísticas |
| `!goleadores`, `!asistidores`, `!vallas-invictas`, `!mvp`, `!racha-actual`, `!viciosos`, `!ganadores` | Rankings |
| `!size N`, `!avatar a,b,c` | Tamaño y avatar animado |
| `!expulsar ID`, `!admin` | Votaciones (`#` muestra los IDs) |
| `!modo` | Ver cómo se arman los equipos ahora |
| `!nv` | Salir de la sala |

### Admins
| Comando | Uso |
|---|---|
| `!rr`, `!swap`, `!random`, `!bb` | Reiniciar, intercambiar, mezclar, sacar a todos |
| `!mute ID`, `!unmute ID`, `!silenciar`, `!unmuteall` | Silenciar |
| `!banip IP`, `!unbanip IP`, `!clearbans`, `!kickafks` | Expulsiones |
| `!set_password clave`, `!clear_password` | Contraseña |
| `!ganasigue`, `!elegir`, `!combinado` | **Cómo se arman los equipos** (ver abajo) |
| `!juegantodos`, `!juegan N`, `!auto_balance`, `!automatizado` | Otros modos del script |
| `!powershot`, `!goldeoro`, `!fairplay` | Reglas especiales |
| `!camisetas`, `!clubcolors`, `!swapcolors` | Camisetas |

---

## ⚠️ Problemas conocidos

### 1. ✅ El script completo — resuelto
La primera versión que teníamos venía cortada y sin árbitro ni comandos. Ahora la base es
**Real Soccer Revolution By GLH 3.1.0**, que está completa: trae el motor de Real Soccer
(saques, córners, tiempo añadido), los anuncios de gol, las estadísticas y todos los comandos.

### 2. ✅ Webhook oculto — desactivado
El script del autor manda el **nombre, la IP y el auth** de cada jugador que entra a un Discord
que no es nuestro. `npm run parchar` lo desactiva: buscá `WEBHOOK OCULTO DEL AUTOR` en
`script.js` y vas a ver el link comentado, al lado de `var webhookID=null`. **No lo reactives.**

### 3. 🟠 Anuncios de gol groseros
El script trae unos 15 mensajes de gol subidos de tono. Si la sala es para jugar con cualquiera,
conviene cambiarlos.

### 4. 🟠 Webhooks del autor en el código
Las URLs de webhook del inicio son reales y son del autor original: cualquiera con el archivo
puede escribir en esos canales de Discord. Reemplazalas por las tuyas o vaciálas.

El de **sala abierta** ya está cambiado por el nuestro (`WebhookSalaAbierta`), pero siguen siendo
del autor los de **grabaciones**, **llamar admins**, **kicks y bans**, **mensajes del chat**,
**entradas y salidas**, **estadísticas** e **IPs**: eso quiere decir que los replays y los
mensajes de la sala se le siguen mandando a su Discord.

### 5. 🟡 Detalles
- ✅ Ya no hay clave para hacerse admin (`!axeso5`): el admin sale solo de la tabla de rangos.
- `.env`, `.env.example` y `roles.json` tienen tokens y la clave de rangos, y **sí se suben a Git**.
- El panel no pide usuario ni contraseña: no lo publiques en internet.
