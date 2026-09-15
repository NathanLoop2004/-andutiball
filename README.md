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

> ⚠️ **Antes de usarlo, lee [Problemas conocidos](#️-problemas-conocidos).**
> El `script.js` está **incompleto** y tiene un **webhook oculto** que envía datos de los jugadores.

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

### Una sola sala, sin Docker

```powershell
npm start        # usa HAXBALL_TOKEN y HOST_CONFIG de .env
```

### A mano, sin instalar nada

Entrá a <https://www.haxball.com/headless>, abrí la consola (`F12`), pegá el contenido de
`script.js` y dale Enter.

> 🔑 Los tokens de HaxBall **vencen a los pocos minutos** y cada sala necesita el suyo.
> Sacá tokens nuevos justo antes de arrancar: <https://www.haxball.com/headlesstoken>

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

### 1. 🔴 El `script.js` está cortado
Termina a mitad de `NumeroUnoFun` (línea 18290) y `node --check script.js` da
`SyntaxError`. Falta la parte que lee el chat (`onPlayerChat`), así que **ningún comando
funciona** y la sala no arranca. Hay que conseguir el archivo completo desde la fuente original.

### 2. 🔴 Webhook oculto que envía datos de los jugadores
En el bloque ofuscado (líneas 1119–1145) hay un webhook de Discord escondido. El `onPlayerJoin`
—que también está ofuscado— manda ahí el **nombre, la IP y el auth** de cada jugador que entra.
Ese webhook no es tuyo. Conviene borrar ese `fetch` o reescribir el `onPlayerJoin` sin ofuscar.

### 3. 🟠 Webhooks reales en el código
Las URLs de webhook del inicio son reales: cualquiera con el archivo puede escribir en esos
canales de Discord. Reemplazalas por las tuyas.

### 4. 🟡 Detalles
- `ClaveParaSerAdmin` viene como `"!axeso5"`: es fácil de adivinar.
- `.env` y `.env.example` tienen tokens y **sí se suben a Git**.
- Casi toda la lógica está minificada en líneas de miles de caracteres.
