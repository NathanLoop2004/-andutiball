// =============================================================================
// WebhookWeb — el aviso de que Ñandutí Web está en línea.
//
// Es UN SOLO mensaje que se va actualizando: la primera vez se publica (con ?wait=true,
// que es lo que devuelve el id del mensaje) y de ahí en adelante se EDITA ese mismo
// (PATCH /webhooks/<id>/<token>/messages/<idMensaje>). El link de Cloudflare cambia en
// cada arranque, así que el canal no se llena de links viejos.
//
// El id del mensaje se guarda en datos/tunel.json. Si alguien lo borra del Discord, la
// edición devuelve 404 y se publica uno nuevo.
// =============================================================================
const fs = require("fs");
const path = require("path");

const ARCHIVO = process.env.TUNEL_FILE || path.join(__dirname, "..", "datos", "tunel.json");
const COLORES = { arriba: 0x00c853, abajo: 0x9e9e9e, problema: 0xe74c3c };

function urlDelWebhook() {
  return (process.env.WEBHOOK_WEB || "").trim();
}

function hayWebhook() {
  return /^https:\/\/discord\.com\/api\/webhooks\//.test(urlDelWebhook());
}

function leerGuardado() {
  try {
    return JSON.parse(fs.readFileSync(ARCHIVO, "utf8"));
  } catch (error) {
    return {};
  }
}

function guardar(datos) {
  try {
    fs.mkdirSync(path.dirname(ARCHIVO), { recursive: true });
    fs.writeFileSync(ARCHIVO, JSON.stringify(datos, null, 2) + "\n");
  } catch (error) {
    console.warn("⚠️ No se pudo guardar " + ARCHIVO + ": " + error.message);
  }
}

const cuando = () => new Date().toLocaleString("es-PY", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// El único mensaje del canal, armado según cómo esté la web
function armarMensaje({ url, estado = "arriba", nota }) {
  const arriba = estado === "arriba";
  return {
    username: "ÑandutíBall 🇵🇾",
    // @here avisa a los conectados (allowed_mentions es lo que hace que Discord notifique).
    // Ojo: Discord solo notifica al publicar; al editar el mensaje no vuelve a sonar.
    content: "@here",
    allowed_mentions: { parse: ["everyone"] },
    embeds: [{
      title: arriba ? "🌐 Ñandutí Web está en línea" : "💤 Ñandutí Web está apagada",
      description: arriba
        ? `👉 **[Entrar a Ñandutí Web](${url})**\n${url}`
        : (nota || "Ahora mismo no hay ninguna sala abierta. Cuando vuelva, este mismo mensaje se actualiza."),
      color: COLORES[estado] || COLORES.abajo,
      footer: { text: "Se actualiza solo · " + cuando() },
      timestamp: new Date().toISOString(),
    }],
  };
}

// Publica la primera vez y después edita SIEMPRE el mismo mensaje
async function publicar({ url, estado = "arriba", nota } = {}) {
  if (!hayWebhook()) throw new Error("Falta WEBHOOK_WEB en .env (el webhook donde se avisa el link de la web)");

  const cuerpo = armarMensaje({ url, estado, nota });
  const guardado = leerGuardado();
  const base = urlDelWebhook();

  // ¿Ya hay un mensaje nuestro? Lo editamos
  if (guardado.mensajeId) {
    const res = await fetch(`${base}/messages/${guardado.mensajeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    if (res.ok) {
      guardar({ ...guardado, url: url || null, estado, actualizado: new Date().toISOString() });
      return { ok: true, editado: true, mensajeId: guardado.mensajeId };
    }
    if (res.status !== 404) {
      throw new Error(`Discord respondió ${res.status} al editar: ${(await res.text().catch(() => "")).slice(0, 160)}`);
    }
    // 404 = alguien lo borró, seguimos y publicamos uno nuevo
  }

  const res = await fetch(`${base}?wait=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  if (!res.ok) throw new Error(`Discord respondió ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}`);

  const mensaje = await res.json();
  guardar({ mensajeId: mensaje.id, url: url || null, estado, actualizado: new Date().toISOString() });
  return { ok: true, editado: false, mensajeId: mensaje.id };
}

module.exports = { publicar, armarMensaje, hayWebhook, urlDelWebhook, leerGuardado, ARCHIVO };
