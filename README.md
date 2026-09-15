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
automática y avisos a Discord. Puede levantar **3 salas a la vez** (3v3, 4v4 y Juegan Todos).

> ⚠️ **Leé [Problemas conocidos](#️-problemas-conocidos).** El `script.js` original venía
> **cortado** y con un **webhook oculto**: los dos están arreglados, pero hay cosas que faltan.

---

## 📁 Archivos

| Archivo | Para qué |
|---|---|
| `script.js` | El script de la sala (~18.100 líneas). Se ejecuta dentro de HaxBall. |
| `launcher.js` | Abre la sala con Puppeteer y le aplica la configuración de cada host. |
| `get-tokens.js` | Consigue los tokens y los guarda en `.env`. |
| `hosts/*.json` | Diferencias de cada sala (3v3, 4v4, todos). |
| `docker-compose.yml`, `Dockerfile` | Las 3 salas en Docker. |
| `.env` | Tus tokens. |
| `CLAUDE.md` | Notas técnicas para seguir trabajando en el proyecto. |

---

## ▶️ Cómo levantar las salas

### Con Docker (las 3 salas)

```powershell
npm install                  # una sola vez
npm run tokens -- --up       # saca los 3 tokens y levanta todo
docker compose logs -f       # muestra los links de las salas
docker compose down          # cierra todo
```

`npm run tokens` abre la página de tokens en tu navegador. Resolvés el captcha, copiás el token
con Ctrl+C y el script lo guarda solo. Repite 3 veces, una por sala.

Para no tener que seleccionar el texto, instalá el marcador de [bookmarklet.js](bookmarklet.js):
después del captcha, un clic copia el token. El captcha siempre lo resolvés vos.

### Una sola sala, sin Docker

```powershell
npm start        # usa HAXBALL_TOKEN y HOST_CONFIG de .env
```

Levanta la sala **y su panel** en <http://localhost:3000> (cambiá el puerto con `API_PORT`).

### 🖥️ El panel

Muestra una tarjeta por sala, con luz **verde si está encendida** y **roja si no**, más los
jugadores, el mapa, el marcador y el link para entrar. Adentro tiene 5 pestañas: **Mensajes**
(chat, entradas, salidas, goles y expulsiones en vivo), **Jugadores**, **Bans**, **Roles** y
**Config**. Se actualiza cada 2 segundos.

- Con Docker, las 3 salas juntas: <http://localhost:8080>
- Con `npm start`, esa sala sola: <http://localhost:3000>

Los bans que lista son los de la sesión en curso: HaxBall no permite pedirle la lista guardada.

---

## 🎖️ Rangos con clave

Los jugadores con rango (OWNER, CO-OWNER, HOSTER…) tienen que **escribir una clave en el chat**
para poder jugar. Mientras no la escriban quedan como **espectadores y en AFK**. La gente sin
rango entra normal, sin que se le pida nada.

Cómo funciona cuando entra alguien con rango:

1. La sala le avisa en privado: *"Detectamos tu rango: 👑 OWNER"*.
2. Escribe la clave en el chat y da Enter. El mensaje no lo ve nadie más.
3. Sale del AFK, puede entrar a la cancha y —si el rol lo da— queda como administrador.
4. Si intenta pasar a Red o Blue antes, la sala lo devuelve a espectadores.

La configuración vive en [roles.json](roles.json) y se edita desde **la pantalla de rangos del
panel** (<http://localhost:8080/rangos>): agregar o quitar nicks, decidir qué rol da admin y
cambiar la clave. **Los cambios se aplican al toque en las salas encendidas, sin reiniciarlas.**

> ⚠️ La clave está en texto plano en `roles.json`, y ese archivo se sube a Git. El panel tampoco
> pide usuario ni contraseña: no publiques el puerto 8080 en internet.

### A mano, sin instalar nada

Entrá a <https://www.haxball.com/headless>, abrí la consola (`F12`), pegá el contenido de
`script.js` y dale Enter.

> 🔑 Los tokens de HaxBall **vencen a los pocos minutos** y cada sala necesita el suyo.
> Sacá tokens nuevos justo antes de arrancar: <https://www.haxball.com/headlesstoken>

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

## 🏠 Las 3 salas

| Sala | Archivo | Jugadores | Mapa | Tiempo / Goles | Modo |
|---|---|---|---|---|---|
| **3v3** | `hosts/3v3.json` | 12 | Futsal x3 | 3 min / 3 | Juegan Algunos, 3 por equipo |
| **4v4** | `hosts/4v4.json` | 14 | Futsal x4 | 4 min / 3 | Juegan Algunos, 4 por equipo |
| **Juegan Todos** | `hosts/todos.json` | 16 | Real Soccer | 5 min / sin límite | Juegan Todos |

Las tres usan el mismo `script.js`. Para cambiar algo de una sola, editá su JSON con cualquier
variable del inicio del script. Por ejemplo `"powerShotMode": true` o `"PasswordDelHost": "123"`.
Después basta con `docker compose restart`.

---

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

### 1. ✅ El archivo estaba cortado — arreglado a medias
El `script.js` que llegó terminaba a mitad de una línea y ni siquiera era JavaScript válido.
Se quitó esa línea incompleta (la función `NumeroUnoFun`, con símbolos raros del "1").

También faltaba **todo `room.onPlayerChat`**, así que ningún comando funcionaba. Al final del
archivo hay un bloque nuevo, **💬 COMANDOS DEL CHAT — repuestos por ÑandutíBall**, que vuelve a
conectar los comandos con las funciones que sí quedaron en el archivo.

**Comandos que NO se pudieron recuperar**, porque sus funciones estaban en el pedazo perdido:

```
!me  !stats  !goleadores  !asistidores  !vallas-invictas  !mvp  !racha-historica
!racha-actual  !viciosos  !ganadores  !presencias  !memide  !avatar  !size
!expulsar  !admin (votación)  !llamaradmins  !votarmapa  !ofi  !firmar
```

Si alguien los escribe, la sala avisa que no están disponibles. Para tenerlos hay que conseguir
el `script.js` completo del autor.

### 2. ✅ Webhook oculto — desactivado
En el bloque ofuscado había un webhook de Discord escondido: el `onPlayerJoin` mandaba ahí el
**nombre, la IP y el auth** de cada jugador que entraba, a un servidor que no es nuestro.

Ya no envía nada. Buscá `WEBHOOK OCULTO DEL AUTOR` en `script.js`: el link quedó **comentado**
ahí, junto a `var webhookID=null`, para acordarse de qué era. **No hay que volver a activarlo.**

### 3. 🟠 Webhooks reales en el código
Las URLs de webhook del inicio (líneas 238–290) son reales y son del autor original: cualquiera
con el archivo puede escribir en esos canales de Discord. Reemplazalas por las tuyas o vaciálas.

### 4. 🟡 Detalles
- `ClaveParaSerAdmin` viene como `"!axeso5"`: es fácil de adivinar.
- `.env` y `.env.example` tienen tokens y **sí se suben a Git**.
- Casi toda la lógica está minificada en líneas de miles de caracteres.
