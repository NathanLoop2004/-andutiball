// Prueba vincular la cuenta de Discord desde Mi cuenta y meterlo al servidor.
//
//   npm run prueba-discord-vincular
//
// Discord está simulado (Discord.usarFetch): no se habla con Discord de verdad. Necesita la base
// (las cuentas viven ahí); si está apagada, avisa y sale bien.

process.env.DISCORD_CLIENT_ID = "111";
process.env.DISCORD_CLIENT_SECRET = "secreto-de-prueba";
process.env.DISCORD_BOT_TOKEN = "bot-de-prueba";
process.env.DISCORD_GUILD_ID = "999";
process.env.WEB_URL = "https://nanduti.prueba";
delete process.env.DISCORD_REDIRECT_URI;

const { crearApp } = require("../app");
const { hayBase, base, cerrarBase } = require("../services/ConexionBase");
const Discord = require("../services/Discord");
const SesionModel = require("../models/SesionModel");
const claves = require("../lib/claves");

const problemas = [];
function revisar(titulo, condicion, detalle) {
  console.log((condicion ? "  ✅ " : "  ❌ ") + titulo + (detalle !== undefined ? "  (" + detalle + ")" : ""));
  if (!condicion) problemas.push(titulo);
}

// ── Discord de mentira ──
let respuestaMiembro = 201;         // 201 = lo agregó · 204 = ya estaba · 403 = no pudo
let usuarioDiscord = { id: "5550001", username: "pepe_hax", global_name: "Pepe", avatar: "abc" };
let scopeDevuelto = "identify guilds.join";
const llamadas = [];
Discord.usarFetch(async (url, opciones = {}) => {
  llamadas.push({ url, opciones });
  const json = (status, datos) => ({ ok: status < 300, status, text: async () => (datos === undefined ? "" : JSON.stringify(datos)) });
  if (url.endsWith("/oauth2/token")) {
    const cuerpo = String(opciones.body);
    if (!cuerpo.includes("code=codigo-bueno")) return json(400, { error: "invalid_grant" });
    return json(200, { access_token: "token-de-acceso", scope: scopeDevuelto });
  }
  if (url.endsWith("/users/@me")) return json(200, usuarioDiscord);
  if (url.includes("/guilds/999/members/")) return json(respuestaMiembro, respuestaMiembro >= 300 ? { message: "Missing Permissions" } : undefined);
  return json(404, { message: "?" });
});

(async () => {
  console.log("🔗 Vincular Discord:\n");
  if (!(await hayBase())) {
    console.log("  ⏭️  La base no está levantada, salteamos. 👉 npm run base\n");
    return terminar();
  }

  const servidor = await new Promise((listo) => { const s = crearApp({ salas: [] }).listen(0, () => listo(s)); });
  const url = "http://127.0.0.1:" + servidor.address().port;
  const nick = "Disc" + Date.now();
  const otroNick = nick + "b";
  await base().usuario.create({ data: { nick, clave: claves.hashear("clave1234") } });
  await base().usuario.create({ data: { nick: otroNick, clave: claves.hashear("clave1234") } });
  const token = SesionModel.firmar({ nick, rango: null, admin: false });
  const tokenOtro = SesionModel.firmar({ nick: otroNick, rango: null, admin: false });
  const pedir = (ruta, opciones = {}, t = token) =>
    fetch(url + ruta, { redirect: "manual", ...opciones, headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" } });

  // Inicia y devuelve el state que Discord mandaría de vuelta
  const iniciar = async (t = token) => {
    const r = await pedir("/api/cuenta/discord", { method: "POST" }, t);
    const datos = await r.json();
    return { status: r.status, datos, state: datos.url ? new URL(datos.url).searchParams.get("state") : null };
  };
  const volver = async (query) => {
    const r = await fetch(url + "/api/discord/vuelta?" + new URLSearchParams(query), { redirect: "manual" });
    return { status: r.status, destino: r.headers.get("location") || "" };
  };

  try {
    const sinSesion = await fetch(url + "/api/cuenta/discord", { method: "POST" });
    revisar("Vincular pide haber iniciado sesión", sinSesion.status === 401, "HTTP " + sinSesion.status);

    const ini = await iniciar();
    const autorizar = ini.datos.url ? new URL(ini.datos.url) : null;
    revisar("Arma el link a Discord con la aplicación, la vuelta y los permisos", Boolean(autorizar) && autorizar.origin === "https://discord.com"
      && autorizar.searchParams.get("client_id") === "111"
      && autorizar.searchParams.get("redirect_uri") === "https://nanduti.prueba/api/discord/vuelta"
      && autorizar.searchParams.get("scope") === "identify guilds.join", autorizar && autorizar.searchParams.get("scope"));
    // ── La página puente (puente-discord/index.html, en GitHub Pages) ──
    const fuente = require("fs").readFileSync(require("path").join(__dirname, "..", "puente-discord", "index.html"), "utf8");
    const cuerpo = fuente.match(/function destinoDesdeElState[\s\S]*?\n}\n/)[0];
    const destinoDesdeElState = new Function("atob", "URL", cuerpo + "; return destinoDesdeElState;")((s) => Buffer.from(s, "base64").toString("binary"), URL);
    const permitidos = ["trycloudflare.com"];
    const armar = (web) => "x".repeat(43) + "." + Buffer.from(web).toString("base64url");
    const webDelState = Buffer.from(ini.state.split(".")[1], "base64url").toString();
    revisar("El state lleva el link actual de la web (para el puente)", webDelState === "https://nanduti.prueba", webDelState);
    revisar("El puente reenvía al link de Cloudflare que viaja en el state", destinoDesdeElState(armar("https://abc-def.trycloudflare.com"), permitidos) === "https://abc-def.trycloudflare.com/api/discord/vuelta");
    revisar("El puente no reenvía a otros sitios",
      [armar("https://malo.com"), armar("https://trycloudflare.com.malo.com"), armar("https://maltrycloudflare.com"), armar("http://abc.trycloudflare.com"), armar("javascript:alert(1)"), armar("https://user:pass@abc.trycloudflare.com"), "sin-punto", "corto.aGVsbG8"]
        .every((s) => destinoDesdeElState(s, permitidos) === null));

    const guardado = await base().usuario.findUnique({ where: { nick } });
    revisar("En la base queda solo el hash del state", guardado.discordEstadoHash && guardado.discordEstadoHash !== ini.state);

    const bien = await volver({ code: "codigo-bueno", state: ini.state });
    revisar("La vuelta termina en Mi cuenta con el resultado", bien.status === 302 && bien.destino === "/frm/cuenta/?discord=vinculado#discord", bien.destino);
    const vinculado = await base().usuario.findUnique({ where: { nick } });
    revisar("Guarda quién es en Discord", vinculado.discordId === "5550001" && vinculado.discordUsuario === "Pepe (@pepe_hax)" && /cdn\.discordapp\.com\/avatars\/5550001\/abc/.test(vinculado.discordAvatar), vinculado.discordUsuario);
    const alServidor = llamadas.find((l) => l.url.includes("/guilds/999/members/5550001"));
    revisar("Lo mete al servidor con el bot y su permiso", alServidor && alServidor.opciones.method === "PUT" && alServidor.opciones.headers.Authorization === "Bot bot-de-prueba" && JSON.parse(alServidor.opciones.body).access_token === "token-de-acceso");
    revisar("No guarda ningún token de Discord", !JSON.stringify(vinculado).includes("token-de-acceso"));

    const repetido = await volver({ code: "codigo-bueno", state: ini.state });
    revisar("El state sirve una sola vez", repetido.destino.includes("discord=vencido"), repetido.destino);
    const inventado = await volver({ code: "codigo-bueno", state: "x".repeat(43) });
    revisar("Un state inventado no vincula nada", inventado.destino.includes("discord=vencido"));

    const ficha = await (await pedir("/api/cuenta")).json();
    revisar("Mi cuenta muestra el Discord vinculado", ficha.cuenta.discord && ficha.cuenta.discord.usuario === "Pepe (@pepe_hax)" && ficha.cuenta.discordDisponible === true);
    revisar("Y no trae los datos internos del vínculo", !/discordEstadoHash|discordVuelta/.test(JSON.stringify(ficha)));

    // El mismo Discord en otra cuenta
    const iniOtro = await iniciar(tokenOtro);
    const otra = await volver({ code: "codigo-bueno", state: iniOtro.state });
    revisar("Un Discord no puede quedar en dos cuentas", otra.destino.includes("discord=otra-cuenta"), otra.destino);

    // Cancelar en Discord
    const iniCancel = await iniciar(tokenOtro);
    const cancelado = await volver({ error: "access_denied", state: iniCancel.state });
    revisar("Si cancela en Discord, avisa y no vincula", cancelado.destino.includes("discord=cancelado"));

    // Ya estaba en el servidor / no se pudo agregar / código malo / vencido
    usuarioDiscord = { id: "5550002", username: "otro", global_name: null, avatar: null };
    respuestaMiembro = 204;
    const iniYa = await iniciar(tokenOtro);
    const yaEstaba = await volver({ code: "codigo-bueno", state: iniYa.state });
    revisar("Si ya estaba en el servidor, lo dice", yaEstaba.destino.includes("discord=ya-estaba"));
    await base().usuario.update({ where: { nick: otroNick }, data: { discordId: null } });

    respuestaMiembro = 403;
    const iniNo = await iniciar(tokenOtro);
    const sinServidor = await volver({ code: "codigo-bueno", state: iniNo.state });
    const quedo = await base().usuario.findUnique({ where: { nick: otroNick } });
    revisar("Si el bot no lo puede agregar, queda vinculado igual y avisa", sinServidor.destino.includes("discord=sin-servidor") && quedo.discordId === "5550002");
    await base().usuario.update({ where: { nick: otroNick }, data: { discordId: null } });

    const iniMalo = await iniciar(tokenOtro);
    const malo = await volver({ code: "codigo-malo", state: iniMalo.state });
    revisar("Si Discord rechaza el código, no vincula", malo.destino.includes("discord=error") && !(await base().usuario.findUnique({ where: { nick: otroNick } })).discordId);

    const iniVence = await iniciar(tokenOtro);
    await base().usuario.update({ where: { nick: otroNick }, data: { discordEstadoVence: new Date(Date.now() - 1000) } });
    const vencido = await volver({ code: "codigo-bueno", state: iniVence.state });
    revisar("Pasados 10 minutos el link ya no sirve", vencido.destino.includes("discord=vencido"));

    // La tabla de Usuarios del OWNER muestra el Discord y se puede buscar por él
    const RangoModel = require("../models/RangoModel");
    const Permisos = require("../lib/permisos");
    const dueño = (await RangoModel.listar()).find((r) => Permisos.palabraDelRango(r.nombre) === "OWNER");
    const tokenDueño = SesionModel.firmar({ nick: dueño.nicks[0], rango: dueño.nombre, admin: true });
    const tabla = await (await pedir("/api/usuarios?q=pepe_hax", {}, tokenDueño)).json();
    const fila = (tabla.usuarios || []).find((u) => u.nick === nick);
    revisar("La tabla de Usuarios muestra el Discord de cada cuenta", fila && fila.discordUsuario === "Pepe (@pepe_hax)" && fila.discordId === "5550001", fila && fila.discordUsuario);
    revisar("Y el buscador encuentra por el nombre de Discord", Boolean(fila) && !/discordEstadoHash|clave\"/.test(JSON.stringify(tabla)));

    const des = await pedir("/api/cuenta/discord", { method: "DELETE" });
    const sinDiscord = await base().usuario.findUnique({ where: { nick } });
    revisar("Se puede desvincular", des.status === 200 && sinDiscord.discordId === null);

    // Sin configurar
    const guardadoId = process.env.DISCORD_CLIENT_ID;
    delete process.env.DISCORD_CLIENT_ID;
    const sinConfig = await iniciar();
    revisar("Sin configurar avisa en vez de mandar a Discord", sinConfig.status === 400 && /no está configurado/.test(sinConfig.datos.error), sinConfig.datos.error);
    process.env.DISCORD_CLIENT_ID = guardadoId;
  } finally {
    await base().usuario.deleteMany({ where: { nick: { in: [nick, otroNick] } } });
    servidor.close();
  }
  return terminar();
})().catch(async (error) => {
  console.error(error);
  problemas.push(error.message);
  await terminar();
});

async function terminar() {
  Discord.usarFetch(null);
  await cerrarBase().catch(() => {});
  console.log("");
  if (problemas.length) {
    console.log("❌ Falló: " + problemas.join(" | "));
    process.exit(1);
  }
  console.log("✅ Vincular Discord OK: autoriza, se guarda, entra al servidor y no guarda tokens");
  process.exit(0);
}
