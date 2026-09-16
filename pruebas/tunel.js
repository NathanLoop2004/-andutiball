// Prueba el aviso del link público: UN solo mensaje en el Discord que se va actualizando.
//
//   npm run prueba-tunel
//
// NO manda nada al Discord de verdad ni abre ningún túnel: se falsea fetch y se revisa
// qué pedidos habría hecho (POST la primera vez, PATCH siempre después).

const fs = require("fs");
const os = require("os");
const path = require("path");

const temporal = fs.mkdtempSync(path.join(os.tmpdir(), "nanduti-tunel-"));
process.env.TUNEL_FILE = path.join(temporal, "tunel.json");
process.env.WEBHOOK_WEB = "https://discord.com/api/webhooks/123/token-de-mentira";

const WebhookWeb = require("../services/WebhookWeb");

const problemas = [];
function revisar(titulo, condicion, detalle) {
  console.log((condicion ? "  ✅ " : "  ❌ ") + titulo + (detalle ? "  (" + detalle + ")" : ""));
  if (!condicion) problemas.push(titulo);
}

// fetch de mentira: guarda los pedidos y contesta lo que le digamos
const pedidos = [];
let siguienteRespuesta = { ok: true, status: 200, json: async () => ({ id: "111" }), text: async () => "" };
global.fetch = async (url, opciones) => {
  pedidos.push({ url, metodo: opciones.method, cuerpo: JSON.parse(opciones.body) });
  return siguienteRespuesta;
};

(async () => {
  console.log("🌐 El aviso del link de Ñandutí Web:\n");

  // ── 1) La primera vez publica ──
  const primera = await WebhookWeb.publicar({ url: "https://uno.trycloudflare.com", estado: "arriba" });
  revisar("La primera vez publica el mensaje", primera.editado === false && primera.mensajeId === "111", "id " + primera.mensajeId);
  revisar("Pide el id del mensaje (?wait=true)", pedidos[0].metodo === "POST" && /\?wait=true$/.test(pedidos[0].url), pedidos[0].url.split("/").pop());
  revisar("El mensaje lleva el link", JSON.stringify(pedidos[0].cuerpo).includes("https://uno.trycloudflare.com"));
  revisar("Y dice que está en línea", /en línea/.test(pedidos[0].cuerpo.embeds[0].title), pedidos[0].cuerpo.embeds[0].title);
  revisar("Se guarda el id para la próxima", JSON.parse(fs.readFileSync(process.env.TUNEL_FILE, "utf8")).mensajeId === "111");

  // ── 2) Las siguientes EDITAN ese mismo ──
  siguienteRespuesta = { ok: true, status: 200, json: async () => ({ id: "111" }), text: async () => "" };
  const segunda = await WebhookWeb.publicar({ url: "https://dos.trycloudflare.com", estado: "arriba" });
  revisar("La segunda vez NO publica otro: edita", segunda.editado === true, "editado");
  revisar("Edita el mensaje por su id", pedidos[1].metodo === "PATCH" && pedidos[1].url.endsWith("/messages/111"), pedidos[1].url.split("/webhooks/")[1]);
  revisar("Con el link nuevo", JSON.stringify(pedidos[1].cuerpo).includes("https://dos.trycloudflare.com"));
  revisar("Nunca se mandó un segundo POST", pedidos.filter((p) => p.metodo === "POST").length === 1, pedidos.filter((p) => p.metodo === "POST").length + " POST");

  // ── 3) Al apagarse, el mismo mensaje lo dice ──
  await WebhookWeb.publicar({ estado: "abajo" });
  revisar("Al apagarse edita el mismo y avisa", pedidos[2].metodo === "PATCH" && /apagada/.test(pedidos[2].cuerpo.embeds[0].title), pedidos[2].cuerpo.embeds[0].title);

  // ── 4) Si alguien borró el mensaje, publica uno nuevo ──
  siguienteRespuesta = { ok: false, status: 404, text: async () => "Unknown Message", json: async () => ({}) };
  const pedidosAntes = pedidos.length;
  siguienteRespuesta = {
    ok: false, status: 404, text: async () => "Unknown Message",
    json: async () => ({ id: "222" }),
  };
  // el PATCH da 404 y el POST que sigue tiene que salir bien
  let llamadas = 0;
  global.fetch = async (url, opciones) => {
    pedidos.push({ url, metodo: opciones.method, cuerpo: JSON.parse(opciones.body) });
    llamadas++;
    return llamadas === 1
      ? { ok: false, status: 404, text: async () => "Unknown Message", json: async () => ({}) }
      : { ok: true, status: 200, json: async () => ({ id: "222" }), text: async () => "" };
  };
  const rehecho = await WebhookWeb.publicar({ url: "https://tres.trycloudflare.com", estado: "arriba" });
  revisar("Si borraron el mensaje, publica uno nuevo", rehecho.editado === false && rehecho.mensajeId === "222", "id " + rehecho.mensajeId);
  revisar("Primero intentó editar y después publicó", pedidos[pedidosAntes].metodo === "PATCH" && pedidos[pedidosAntes + 1].metodo === "POST");

  // ── 5) Sin webhook configurado, avisa claro ──
  process.env.WEBHOOK_WEB = "";
  let aviso = "";
  try { await WebhookWeb.publicar({ url: "https://x.trycloudflare.com" }); } catch (error) { aviso = error.message; }
  revisar("Sin WEBHOOK_WEB lo dice con todas las letras", /WEBHOOK_WEB/.test(aviso), aviso);

  fs.rmSync(temporal, { recursive: true, force: true });

  console.log("");
  if (problemas.length) {
    console.log("❌ Falló: " + problemas.join(" | "));
    process.exit(1);
  }
  console.log("✅ Túnel OK: un solo mensaje en el Discord, que se va actualizando");
})();
