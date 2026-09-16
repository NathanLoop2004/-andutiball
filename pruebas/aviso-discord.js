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

const invitaciones = () => sala.anuncios.filter((a) => a.includes("discord.gg/TGRug4BGG")).length;

const sinGente = invitaciones();
avanzar(10 * 60 * 1000);
revisar("Con la sala vacía no habla solo", invitaciones() === sinGente, invitaciones() - sinGente + " avisos");

sala.entra(1, "Ana");
const antes = invitaciones();
avanzar(3 * 60 * 1000 + 5000);
revisar("A los 3 minutos invita al Discord", invitaciones() - antes === 1, invitaciones() - antes + " avisos");

avanzar(6 * 60 * 1000);
revisar("Y sigue cada 3 minutos", invitaciones() - antes === 3, invitaciones() - antes + " avisos en 9 minutos");

const invitacion = sala.anuncios.filter((a) => a.includes("discord.gg/TGRug4BGG")).pop();
revisar("El mensaje lleva el link del Discord", Boolean(invitacion), invitacion);

console.log("");
const unicos = [...new Set(sala.errores)];
if (unicos.length) console.log("⚠️  Errores del script durante la prueba:\n   " + unicos.slice(0, 8).join("\n   ") + "\n");
if (problemas.length) {
  console.log("❌ Falló: " + problemas.join(" | "));
  process.exit(1);
}
console.log("✅ Aviso de sala abierta OK: una tarjeta al Discord con el link, el mapa, el modo y el cupo");
