// =============================================================================
// WebhookActualizaciones — manda una novedad al canal de actualizaciones del Discord.
//
// La URL sale de WEBHOOK_ACTUALIZACIONES (.env). Si no está, no se manda nada y se
// avisa con un error claro en vez de fallar en silencio.
//
// El mensaje sale tal cual lo escribieron: acá no se le agrega jerga, ni nombres de
// archivos, ni nada técnico. Solo el título (si tiene) y el texto.
// =============================================================================

const COLOR = 0x00c853;
const NOMBRE = "ÑandutíHax 🇵🇾";
const TITULO_POR_DEFECTO = "📣 Novedades de ÑandutíHax";

function urlDelWebhook() {
  return (process.env.WEBHOOK_ACTUALIZACIONES || "").trim();
}

function hayWebhook() {
  return /^https:\/\/discord\.com\/api\/webhooks\//.test(urlDelWebhook());
}

// Devuelve { ok } o tira con un mensaje entendible
async function enviar({ titulo, mensaje }) {
  const url = urlDelWebhook();
  if (!hayWebhook()) throw new Error("Falta WEBHOOK_ACTUALIZACIONES en .env (el webhook del canal de actualizaciones)");
  if (!String(mensaje || "").trim()) throw new Error("La novedad no puede estar vacía");

  const cuerpo = {
    username: NOMBRE,
    // @here avisa a los que están conectados. allowed_mentions hace falta: sin eso Discord
    // muestra el texto pero no notifica a nadie ("everyone" cubre @everyone y @here)
    content: "@here",
    allowed_mentions: { parse: ["everyone"] },
    embeds: [{
      title: String(titulo || TITULO_POR_DEFECTO).slice(0, 250),
      description: String(mensaje).slice(0, 4000),
      color: COLOR,
      timestamp: new Date().toISOString(),
    }],
  };

  const respuesta = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => "");
    throw new Error(`Discord respondió ${respuesta.status}${detalle ? ": " + detalle.slice(0, 200) : ""}`);
  }
  return { ok: true };
}

module.exports = { enviar, hayWebhook, urlDelWebhook };
