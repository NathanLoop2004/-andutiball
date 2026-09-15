# Script de Host de HaxBall (GLH – "Futsal by GLH")

Script para crear una **sala (host) de HaxBall con bot árbitro**, basado en la
[Headless Host API](https://github.com/haxball/haxball-issues/wiki/Headless-Host) de HaxBall.
Versión indicada en el código: `25.06.18`.

> ⚠️ **Lee primero la sección [Problemas encontrados](#️-problemas-encontrados-en-la-revisión).**
> El archivo está **incompleto** (no funciona tal cual) y tiene un **webhook oculto** que
> envía datos de los jugadores a un tercero.

---

## 📁 Archivos

| Archivo      | Contenido |
|--------------|-----------|
| `script.js`  | El script completo (~18.100 líneas, 1,3 MB). |
| `script.txt` | Vacío. |

---

## ▶️ Cómo se usa

1. Entra a <https://www.haxball.com/headless>.
2. Abre la consola del navegador (`F12` → pestaña *Console*).
3. Pega el contenido de `script.js` y pulsa Enter.
4. Resuelve el captcha si lo pide. En la consola aparece el **link de la sala**
   (y, si hay webhook configurado, también se publica en Discord).
5. Deja la pestaña abierta: si la cierras, la sala se cierra.

Las estadísticas se guardan en el `localStorage` del navegador, así que se conservan entre
reinicios mientras uses el mismo navegador.

---

## 🗺️ Estructura del archivo

| Líneas aprox. | Sección |
|---------------|---------|
| 1 – 620       | **Configuración editable** (todo lo que normalmente cambias). |
| 620 – 1115    | Variables internas, camisetas de equipos, códigos de banderas, coordenadas por país. |
| 1119 – 1145   | **Bloque ofuscado** (`_0x24f1`, `_0x2ffa`…): textos, un mapa y un webhook escondido. |
| 1145 – 1225   | Utilidades: `decryptHex` (convierte `player.conn` en IP), validación de admins. |
| 1226 – 17935  | **Mapas** (`.hbs` embebidos como texto): una función `getXxxMap()` por mapa. |
| 17936 – final | **Lógica del bot** (minificada en líneas muy largas): creación de la sala, clase `Game` (saques, córners, arco en Real Soccer), webhooks, estadísticas, AFK, mute, baneos, comandos. |

---

## ⚙️ Configuración (inicio del archivo)

### Sala
| Variable | Qué hace | Valor actual |
|---|---|---|
| `NombreHost` | Nombre de la sala | `▶️▶️🟦🟩 UNETE Y JUEGA …` |
| `VisibilidadDelHost` | `true` pública / `false` privada | `true` |
| `CantidadDeJugadores` | Máximo de jugadores (1–30) | `16` |
| `PasswordDelHost` | Contraseña de la sala (`null` = sin contraseña) | `null` |
| `ReiniciarStats` | `"Si"` borra las estadísticas al iniciar | `"No"` |
| `UbicacionDelHost` / `BanderaDelHost` | Ubicación y bandera que muestra la sala | `myubication` / `Germany` |
| `ActivarReCaptcha` | Pedir captcha a quien entra | `true` |

### Administración
| Variable | Qué hace |
|---|---|
| `ClaveParaSerAdmin` | Palabra que, escrita en el chat, da admin (actual: `!axeso5`). **Cámbiala.** |
| `ListaDeAdmins` | Admins por `auth` (Public ID de haxball.com/playerauth) y nicks permitidos. |
| `contrasena`, `LugaresReservados` | Lugares reservados para admins. |
| `NickNamesRol1..10`, `NombreROL1..10`, `ColorDelChatROL1..10` | Roles con prefijo y color en el chat (OWNER, CO-OWNER, HOSTER…). |
| `ListaDeJogadores` | Jugadores registrados (auth + nicks). Ahora solo tiene ejemplos (`authid_jugador1`…). |

### Bot
`BotVisible` (si el bot aparece como jugador), `NombreBot`, `StatusBot` (`"activo"` / `"afk"`).

### Juego
| Variable | Qué hace |
|---|---|
| `MapaPorDefecto` | Mapa al iniciar (`"Real Soccer"`). Ver lista de mapas abajo. |
| `TiempoDeJuego`, `LimiteDeGoles` | Minutos y goles por partido (`5`, `0` = sin límite). |
| `TamanoMinimoPermitido`, `TamanoMaximoPermitido`, `CantidadCambiarTamano` | Límites del comando `!size`. |
| `camisetaRed`, `camisetaBlue`, `NombreEquipoRojo/Azul` | Camisetas por defecto (formato `/colors`). |
| `PelotaRS`, `PotenciaPowerShotRS`, `PelotaFutsal`, `PotenciaPowerShot`, `TipoPelotaFutsal` | Color y potencia de la pelota. |

### Modos de juego (`true` / `false`)
| Variable | Modo |
|---|---|
| `autoBalanceEnabled` | Equilibra la cantidad de jugadores por equipo. |
| `ganasigueEnabled` | Gana sigue: el ganador se queda, entran espectadores. |
| `CamisetasGanaSigue` | El ganador conserva la camiseta. |
| `cambioCami` | Cambia camisetas al azar en cada partido. |
| `modoJueganTodos` / `modoJueganAlgunos` + `maxPlayersPerTeam` | Mete a todos / a N por equipo automáticamente. |
| `powerShotMode`, `JabulaniMode`, `combaMode` | Disparo potente, potente con comba, solo comba. |
| `GolDeOroActivado` | Gol de oro en empate. |
| `FairPlayActivado` | Modo fair play. |
| `automatizadoActivado` | Cambia el mapa solo según la cantidad de jugadores (usa `TiempoFutsalxN` / `GolesFutsalxN`). |

### Moderación
| Variable | Qué hace |
|---|---|
| `LimiteMaximoDeJugadoresAFK`, `SegundosPermitidosAFK`, `MinutosPermitidosAFK` | Expulsión de AFK (15 s en cancha, 5 min en espectadores). |
| `MaximoJugadoresPorIp` | Jugadores por misma IP. |
| `PaisesProhibidos` | Países expulsados al entrar (actual: EE. UU. y Reino Unido). |
| `IpPlayers`, `MensajeBaneoPorIp` | IPs baneadas. |
| `NicknamesPROHIBIDOS` | Nicks no permitidos (`@everyone`, `@here`, `@`). |
| `MESSAGE_COOLDOWN`, `SPAM_LIMIT`, `COOLDOWN_TIME`, `KICK_THRESHOLD` | Anti-spam del chat. |
| `PorcentajeDeVotosBan/Admin`, `MIN_PLAYERS_FOR_*_VOTE`, `DURACION_VOTACION`, `COOLDOWN_COMANDOS` | Votaciones para expulsar o dar admin. |
| `maxAttempts`, `interval`, `cooldownTime` | Límite de kicks/bans seguidos por admin (anti-abuso). |
| `MostrarIps` | Mostrar IPs a los admins al entrar alguien. |

### Anuncios
`MensajeDeBienvenida` (lista de mensajes al entrar), `Anuncio` / `Anuncio2` (con minuto, segundo, color y tipo de letra),
`DiscordLink`, `YoutubeLink`, `TwitchLink`, `ChallongeLink`, `regla1..5`.

### 🌐 Webhooks de Discord
| Variable | Qué envía |
|---|---|
| `AnuncioHostAbierto` + `MensajeHostAbierto`, `TagHostAbierto` | Aviso de sala abierta con su link. |
| `WebhookGrabaciones`, `WebhookGrabacionesSalaCompleta`, `GrabarTodo` | Replays `.hbr2` y resumen de cada partido (o de toda la sesión). |
| `WebhookParaLlamarAdmins`, `RolAdminHost`, `tiempoEsperaAdminsEnMinutos` | Llamado a admins desde la sala. |
| `AnuncioKicksBans` | Registro de kicks y bans. |
| `webhookMensajesJugadores` | Chat de los jugadores. |
| `webhookBoletero` | Entradas y salidas (con cola y límite para no saturar Discord). |
| `webhookEstadisticasJugadores` | Estadísticas. |
| `WebhookParaFirmar` | Firmas en partidos oficiales. |
| `webhookIPJugadores` | IP del jugador al salir. |

---

## 🏟️ Mapas incluidos (comando para cargarlo)

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
| `!help` | Lista de comandos. |
| `t mensaje` | Chat privado con tu equipo. |
| `!afk`, `!afks` | Ponerse AFK / ver quién está AFK. |
| `!me`, `!stats ID` | Estadísticas propias o de otro. |
| `!goleadores`, `!asistidores`, `!vallas-invictas`, `!mvp`, `!racha-historica`, `!racha-actual`, `!viciosos`, `!ganadores`, `!presencias` | Rankings. |
| `!size N` | Cambia tu tamaño (dentro de los límites). |
| `!avatar a,b,c` | Avatar animado. |
| `!expulsar ID`, `!admin` | Votación para expulsar / para dar admin. `#` en el chat muestra los IDs. |
| `!nv` | Salir de la sala. |
| `!reglamento`, `!fixture`, `!resultados`, `!tutorial` | Info de torneo y del script. |

### Admins
| Comando | Uso |
|---|---|
| `!rr` / `!swap` / `!random` | Reiniciar partido / intercambiar equipos / equipos al azar. |
| `!bb` | Sacar a todos a espectadores. |
| `!mute ID`, `!unmute ID`, `!silenciar`, `!desilenciar`, `!unmuteall` | Silenciar jugadores o la sala. |
| `!banip IP`, `!unbanip IP`, `!unbanallips`, `!clearbans` | Baneos. |
| `!kickafks` | Expulsar a los AFK. |
| `!set_password clave`, `!clear_password` | Contraseña de la sala. |
| `!ganasigue`, `!juegantodos`, `!juegan N`, `!juegan-off`, `!auto_balance`, `!equilibrar`, `!automatizado` | Activar/desactivar modos. |
| `!powershot`, `!goldeoro`, `!fairplay` | Reglas especiales. |
| `!camisetas`, `!clubcolors`, `!swapcolors` | Camisetas. |
| `!publicidad`, `!minutos`, `!minutosllamada` | Anuncios y tiempos. |
| `!ofi` | Partido oficial. |

---

## ⚠️ Problemas encontrados en la revisión

### 1. 🔴 El archivo está cortado: no funciona tal como está
El archivo termina en medio de `NumeroUnoFun` (línea 18106), con un texto sin cerrar.
`node --check script.js` da `SyntaxError: Invalid or unexpected token`, así que al pegarlo en la
consola **no se ejecuta nada**.

Además falta todo lo que venía después:
- **No hay `room.onPlayerChat`**: ningún comando funciona. `helpFun`, `afkFun` y las demás funciones de comandos existen, pero nadie las llama.
- **No hay un `onPlayerJoin` normal**: `MensajeDeBienvenida`, `MaximoJugadoresPorIp` y `NicknamesPROHIBIDOS` se declaran pero no se usan en ningún lado.

➡️ Consigue el archivo completo desde la fuente original. Probablemente se cortó al copiarlo.

### 2. 🔴 Webhook oculto que envía datos de los jugadores a un tercero
En el bloque ofuscado (líneas 1119–1143) hay una URL de webhook escondida:
`https://discord.com/api/webhooks/816061374504763402/...`

El único `onPlayerJoin` del script está ofuscado. Cada vez que alguien entra, envía a ese webhook:

```
**NombreJugador -** [conn] - [auth]
```

`conn` es la **IP del jugador** en hexadecimal y `auth` su **Public ID**. Tú no controlas ese webhook,
así que las IPs de tus jugadores le llegan al autor del script sin aviso.

También hay otra URL sin uso (`webhookPass`, línea 18050) y una `superAdminCode` sin uso.

➡️ Si vas a usar el script, **quita ese envío** (el `fetch(webhookID, ...)` dentro de
`room[_0x3c81f9(0x12f)]`) o reescribe el `onPlayerJoin` sin ofuscar.

### 3. 🟠 Webhooks reales escritos en el código
Todas las URLs de webhook del inicio (`AnuncioKicksBans`, `webhookBoletero`, `webhookIPJugadores`, etc.)
son reales. Cualquiera que tenga el archivo puede escribir en esos canales de Discord.
➡️ Reemplázalas por webhooks tuyos y no compartas el archivo con ellas puestas.

### 4. 🟠 Datos personales
El script guarda y reenvía IPs (`webhookIPJugadores`, `MostrarIps`) y todo el chat (`webhookMensajesJugadores`).
Si no lo necesitas, deja esas URLs vacías.

### 5. 🟡 Detalles menores
- `ClaveParaSerAdmin = "!axeso5"` aparece en la lista de comandos y es fácil de adivinar. Cámbiala.
- En la línea 17937 se asigna `roomPassword = ClaveParaSerAdmin`. La variable no se usa (la sala usa `PasswordDelHost`), pero confunde.
- `PaisesProhibidos` va en minúsculas (`"united states"`), mientras que el comentario del ejemplo usa mayúsculas (`"Argentina"`). Revisa que coincida con el formato que compara el código.
- `ListaDeJogadores` solo tiene datos de ejemplo.
- Casi toda la lógica está minificada en líneas de miles de caracteres, lo que hace difícil mantenerla. Conviene formatearla (por ejemplo con Prettier) antes de modificarla.
