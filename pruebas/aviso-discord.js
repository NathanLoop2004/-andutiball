// Prueba el aviso de sala abierta: cuando HaxBall entrega el link, tiene que salir UNA
// tarjeta al webhook de Discord, con el link adentro y sin datos del autor del script.
//
//   node pruebas/aviso-discord.js [hosts/3v3.json]

const { abrirSala } = require("./sala-falsa");

const hostConfig = process.argv[2] || "hosts/3v3.json";
const sala = abrirSala(hostConfig);
const { contexto, avanzar, webhooks } = sala;

const problemas = [];
function revisar(titulo, condicion, detalle) {
  console.log((condicion ? "  ✅ " : "  ❌ ") + titulo + (detalle ? "  (" + detalle + ")" : ""));
  if (!condicion) problemas.push(titulo);
}

const LINK = "https://www.haxball.com/play?c=PRUEBA123";
const avisos = () => webhooks.filter((w) => w.url === contexto.WebhookSalaAbierta);

console.log("⚙️  " + hostConfig + "\n");
revisar("El webhook está configurado", /^https:\/\/discord\.com\/api\/webhooks\//.test(contexto.WebhookSalaAbierta || ""), contexto.WebhookSalaAbierta);
revisar("El Discord de la sala es el nuestro", contexto.DiscordDeLaSala === "https://discord.gg/TGRug4BGG", contexto.DiscordDeLaSala);

console.log("\n🔗 HaxBall entrega el link de la sala:");
sala.disparar("onRoomLink", LINK);
avanzar(3000);

revisar("Se mandó un aviso (y uno solo)", avisos().length === 1, avisos().length + " avisos");

const enviado = avisos()[0];
const cuerpo = enviado ? JSON.parse(enviado.cuerpo) : null;
const embed = cuerpo && cuerpo.embeds && cuerpo.embeds[0];

revisar("Va como tarjeta (embed)", Boolean(embed), embed ? "sí" : "no");
if (embed) {
  console.log("     " + embed.title);
  console.log("     " + embed.description.replace(/\n+/g, " | "));
  console.log("     " + embed.fields.map((f) => f.name + ": " + f.value).join("  ·  "));
  console.log("     " + embed.footer.text);
  revisar("El título lleva el nombre de la sala", embed.title.indexOf(sala.ajustes.NombreHost) >= 0, embed.title);
  revisar("El link está en la tarjeta", embed.url === LINK && enviado.cuerpo.indexOf(LINK) >= 0);
  revisar("Muestra el mapa y el cupo", enviado.cuerpo.indexOf(sala.ajustes.MapaPorDefecto) >= 0 && enviado.cuerpo.indexOf(String(sala.ajustes.CantidadDeJugadores)) >= 0);
  revisar("Muestra el modo de equipos", embed.fields.some((f) => f.name.indexOf("Modo") >= 0 && f.value !== "—"), embed.fields.filter((f) => f.name.indexOf("Modo") >= 0).map((f) => f.value)[0]);
  revisar("El pie invita al Discord", embed.footer.text.indexOf("discord.gg/TGRug4BGG") >= 0, embed.footer.text);
  revisar("Avisa con @here", cuerpo.content === "@here", JSON.stringify(cuerpo.content));
}

// El mismo link no se avisa dos veces (onRoomLink puede volver a dispararse)
sala.disparar("onRoomLink", LINK);
avanzar(2000);
revisar("El mismo link no se avisa de nuevo", avisos().length === 1, avisos().length + " avisos");

// Ningún webhook del autor: el link de la sala no se le manda a nadie más
const ajenos = webhooks.filter((w) => /discord\.com\/api\/webhooks/.test(w.url || "") && w.url !== contexto.WebhookSalaAbierta && String(w.cuerpo || "").indexOf(LINK) >= 0);
revisar("El link no se manda a webhooks ajenos", ajenos.length === 0, ajenos.map((w) => w.url).join(", ") || "ninguno");

// ── El cartelito del Discord en el chat de la sala ──
console.log("\n💬 El aviso del Discord en el chat:");

// Ojo: el aviso para crear la cuenta también cae en el Discord cuando no hay web abierta,
// así que se cuenta el cartelito por su texto y no por el link.
// (ojo con copiar textos con ñ/í: no siempre son el mismo codepoint en los dos archivos)
const invitaciones = () => sala.anuncios.filter((a) => a.includes("Entrá al Discord")).length;

const sinGente = invitaciones();
avanzar(10 * 60 * 1000);
revisar("Con la sala vacía no habla solo", invitaciones() === sinGente, invitaciones() - sinGente + " avisos");

sala.entra(1, "Ana");
const antes = invitaciones();
avanzar(10 * 60 * 1000 + 5000);
revisar("A los 10 minutos invita al Discord", invitaciones() - antes === 1, invitaciones() - antes + " avisos");

avanzar(20 * 60 * 1000);
revisar("Y sigue cada 10 minutos", invitaciones() - antes === 3, invitaciones() - antes + " avisos en 30 minutos");

const invitacion = sala.anuncios.filter((a) => a.trim() === "🔗 " + contexto.DiscordDeLaSala).pop();
revisar("El mensaje lleva el link del Discord", Boolean(invitacion), invitacion);

// ── Los carteles de cada partido no llenan el chat (🔕 AVISOS SIN SPAM) ──
console.log("\n🔕 Avisos sin spam:\n");
const cuantos = (texto) => sala.anuncios.filter((a) => a === texto).length;
const anuncio = contexto.Anuncio;
const antesAnuncio = cuantos(anuncio);
for (let i = 0; i < 3; i++) { sala.room.sendAnnouncement(anuncio, null, 0xffffff, "bold", 0); avanzar(3 * 60 * 1000); }
revisar("El anuncio de cada partido sale una vez aunque haya 3 partidos en 9 minutos", cuantos(anuncio) - antesAnuncio === 1, cuantos(anuncio) - antesAnuncio + " veces");
avanzar(2 * 60 * 1000);
sala.room.sendAnnouncement(anuncio, null, 0xffffff, "bold", 0);
revisar("Pasados 10 minutos vuelve a salir", cuantos(anuncio) - antesAnuncio === 2, cuantos(anuncio) - antesAnuncio + " veces");
sala.room.sendAnnouncement(anuncio, 1, 0xffffff, "bold", 0);
revisar("Lo que se le manda a un solo jugador no se frena", cuantos(anuncio) - antesAnuncio === 3);
const equipos = "   🏆    E S T A N    J U G A N D O  :       Olimpia   vs   Cerro";
sala.room.sendAnnouncement(equipos, null, 0xffffff, "normal", 0);
avanzar(4 * 60 * 1000);
sala.room.sendAnnouncement(equipos, null, 0xffffff, "normal", 0);
avanzar(2 * 60 * 1000);
sala.room.sendAnnouncement(equipos, null, 0xffffff, "normal", 0);
revisar("\"Están jugando\" sale en cada partido", cuantos(equipos) === 3, cuantos(equipos) + " veces");
sala.room.sendAnnouncement("⚽ GOL de Ana", null, 0xffffff, "bold", 0);
sala.room.sendAnnouncement("⚽ GOL de Ana", null, 0xffffff, "bold", 0);
revisar("Los demás mensajes salen siempre", cuantos("⚽ GOL de Ana") === 2);

console.log("");
const unicos = [...new Set(sala.errores)];
if (unicos.length) console.log("⚠️  Errores del script durante la prueba:\n   " + unicos.slice(0, 8).join("\n   ") + "\n");
if (problemas.length) {
  console.log("❌ Falló: " + problemas.join(" | "));
  process.exit(1);
}
console.log("✅ Aviso de sala abierta OK: una tarjeta al Discord con el link, el mapa, el modo y el cupo");
