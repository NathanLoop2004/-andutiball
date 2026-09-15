# 🕸️ ÑandutíBall — Host de HaxBall

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
| `get-tokens.js` | Consigue los tokens y los guarda en `.env`. |
| `hosts/*.json` | Diferencias de cada sala (3v3, 4v4, automático, Real Soccer). |
| `docker-compose.yml`, `Dockerfile` | Las 4 salas en Docker. |
| `.env` | Tus tokens. |
| `mapas/` | Los mapas de futsal propios y el generador. |
| `datos/elo.json` | Los puntajes de los jugadores (se crea solo). |
| `CLAUDE.md` | Notas técnicas para seguir trabajando en el proyecto. |

---

## ▶️ Cómo levantar las salas

### Las 4 salas de una (sin Docker)

```powershell
npm install            # una sola vez
npm run tokens         # los 4 tokens
npm start              # levanta las 4 salas + el panel
```

Los links de las 4 van apareciendo en la terminal, cada uno con el nombre de su sala adelante.
El panel con las cuatro queda en <http://localhost:8080>. Se corta todo junto con `Ctrl+C`.

Cada sala usa su propio puerto: 3001 (3v3), 3002 (4v4), 3003 (automático) y 3004 (Real Soccer).

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
npm start 4v4          # 3v3 · 4v4 · todos · realsoccer
npm run tokens -- --una  # si te falta el token de esa sala
```

La sala levanta con su panel. Si el nombre está mal escrito, te dice cuáles hay.

### 🖥️ El panel

Muestra una tarjeta por sala, con luz **verde si está encendida** y **roja si no**, más los
jugadores, el mapa, el marcador y el link para entrar. Adentro tiene pestañas: **Cancha** (quién
está en cada equipo), **Mensajes** (chat, entradas, salidas, goles y expulsiones en vivo),
**Jugadores**, **ELO**, **Bans**, **Roles** y **Config**.

Se actualiza cada 2 segundos **sin moverte de donde estabas leyendo**: solo sigue al último
mensaje si ya estabas abajo del todo, y si no cambió nada no redibuja.

- Con Docker, las 4 salas juntas: <http://localhost:8080>
- Con `npm start 4v4` (una sola sala), su panel en <http://localhost:8080> también

Los bans que lista son los de la sesión en curso: HaxBall no permite pedirle la lista guardada.

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
npm run prueba-turnos    # los capitanes eligiendo por turnos
npm run prueba-elo       # el cálculo de puntajes y el circuito completo
npm run prueba-mapas     # HaxBall valida los 4 mapas
```

Monta una sala falsa, corre el script entero y simula jugadores que entran, usan comandos, hacen un gol y se van. Sirve para cazar errores antes de abrir la sala de
verdad. Conviene correrlo cada vez que se toca `script.js`.

### 🩹 Si reemplazás `script.js` por otro

Todo lo de ÑandutíBall (marca, camisetas paraguayas, rangos, arbitraje, webhook desactivado)
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
| **Futsal 3v3** | `hosts/3v3.json` | 12 | Futsal x3 | 3 min / 3 | Se elige por turnos |
| **Futsal 4v4** | `hosts/4v4.json` | 14 | Futsal x4 | 4 min / 3 | Se elige por turnos |
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

En esas dos salas el bot **ya no acomoda a todos de una**: los equipos se eligen por turnos.

1. Los dos primeros espectadores pasan solos a Red y Blue: son los **capitanes**.
2. El bot avisa de quién es el turno y lista a los espectadores con su número.
3. El capitán escribe **el número** en el chat (por ejemplo `7`) o `!elegir 7`.
4. Se alterna: Red elige uno, después Blue, hasta llenar los dos equipos.

Si el capitán no elige en 25 segundos, elige el bot y la ronda sigue. Los admins también pueden
elegir. Con `!turno` se vuelve a mostrar el cartel.

Se prende por sala con `"SeleccionPorTurnos": true` en `hosts/*.json`. La sala **Futsal automático**
y la de **Real Soccer** siguen llenando los equipos solas.

## 🗺️ Mapas propios de futsal

Las salas de futsal usan mapas nuestros: la misma cancha y la misma física del original, con el
nombre de ÑandutíBall y la **pelota amarilla lisa** (sin las pintitas negras).

```powershell
npm run generar-mapas    # escribe mapas/*.hbs
npm run parchar          # los mete en script.js
npm run prueba-mapas     # HaxBall los valida
```

Para ver un mapa sin abrir una sala: `node pruebas/render.js mapas/nanduti-futsal-x3.hbs vista.png`

## 📊 ELO y divisiones

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

**Comandos:** `!elo` (el tuyo o el de otro: `!elo Jinder`) · `!top` (los 10 mejores) · `!divisiones`

El puntaje va por **auth** (el Public ID de HaxBall, que no se puede falsear), no por nick: si
alguien se cambia el nombre, su puntaje lo sigue. Se guarda en `datos/elo.json` del lado de Node,
así sobrevive a que se cierre la sala, y **las 4 salas comparten la misma tabla**.

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

Con `!clubcolors` las camisetas cambian solas en cada partido: hay 28 cruces armados, y el
superclásico **Olimpia vs Cerro** es el que más sale. Cuando se enfrentan dos camisetas parecidas
(Olimpia vs Nacional, Guaraní vs Luqueño…), el equipo azul cambia automáticamente.

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
| `ClaveParaSerAdmin` | Palabra que, escrita en el chat, da admin. **Cambiala** |
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
`AnuncioHostAbierto` (aviso de sala abierta) · `WebhookGrabaciones` (replays y resúmenes) ·
`WebhookParaLlamarAdmins` · `AnuncioKicksBans` · `webhookMensajesJugadores` (chat) ·
`webhookBoletero` (entradas y salidas) · `webhookEstadisticasJugadores` · `webhookIPJugadores`

---

## 🏟️ Mapas

- **Real Soccer:** `!rs`, `!rs2`, `!rsevo`, `!rsoveja`, `!minirs`, `!entrenamiento`
- **Futsal:** `!futx2`, `!futx3`, `!futx4`, `!futx5`, `!futx5cesped`, `!futx7`, `!realfutsal`, `!entrenamientofutsal`
- **Penales:** `!pensred`, `!pensblue`
- **X-Man:** `!2man` … `!8man`
- **Otros:** `!basket`, `!handball`, `!voley2d`, `!voley3d`, `!tenis-ladrillo`, `!tenis-pasto`, `!tenis-cemento`, `!sk8`, `!escuela`, `!big`, `!campeones`, `!premios`

`!mapas` muestra la lista dentro de la sala.

---

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
| `!nv` | Salir de la sala |

### Admins
| Comando | Uso |
|---|---|
| `!rr`, `!swap`, `!random`, `!bb` | Reiniciar, intercambiar, mezclar, sacar a todos |
| `!mute ID`, `!unmute ID`, `!silenciar`, `!unmuteall` | Silenciar |
| `!banip IP`, `!unbanip IP`, `!clearbans`, `!kickafks` | Expulsiones |
| `!set_password clave`, `!clear_password` | Contraseña |
| `!ganasigue`, `!juegantodos`, `!juegan N`, `!auto_balance`, `!automatizado` | Modos |
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

### 5. 🟡 Detalles
- `ClaveParaSerAdmin` viene como `"!axeso5"`: es fácil de adivinar.
- `.env`, `.env.example` y `roles.json` tienen tokens y la clave de rangos, y **sí se suben a Git**.
- El panel no pide usuario ni contraseña: no lo publiques en internet.
