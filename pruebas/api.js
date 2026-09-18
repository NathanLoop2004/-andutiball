// Prueba la API del panel (routes → controllers → models) levantando de verdad las
// dos apps que usa el proyecto:
//
//   · la de una sala   (la que arma launcher.js, con su adaptador de sala)
//   · la del panel     (la que arma panel/server.js, que le pregunta a las salas)
//
//   node pruebas/api.js
//
// Los archivos de datos van a una carpeta temporal, así no se pisan roles.json ni
// datos/elo.json de verdad.
//
// OJO: esta prueba corre SIN el .env (sin base). No agregarle --env-file: el POST de
// /api/rangos reemplaza la tabla de rangos entera, y con la base prendida borraría los de verdad. Hay que ponerlos ANTES de cargar app.js, porque lib/
// los lee al importarse.

const fs = require("fs");
const os = require("os");
const path = require("path");

const temporal = fs.mkdtempSync(path.join(os.tmpdir(), "nanduti-api-"));
process.env.ROLES_FILE = path.join(temporal, "roles.json");
process.env.ELO_FILE = path.join(temporal, "elo.json");
fs.writeFileSync(process.env.ROLES_FILE, JSON.stringify({ clave: "secreta", roles: [
  { id: "owner", nombre: "OWNER", admin: true, nicks: ["Jinder"] },
  { id: "ayudante", nombre: "🛠️ AYUDANTE", admin: false, nicks: ["Ayu"] },
] }));
fs.writeFileSync(process.env.ELO_FILE, JSON.stringify({ "auth:a1": { nombre: "Ana", puntos: 1300, partidos: 12 } }));

const { crearApp } = require("../app");
const EstadoModel = require("../models/EstadoModel");

const problemas = [];
function revisar(titulo, condicion, detalle) {
  console.log((condicion ? "  ✅ " : "  ❌ ") + titulo + (detalle ? "  (" + detalle + ")" : ""));
  if (!condicion) problemas.push(titulo);
}

// ── La sala falsa que inyecta el launcher ──
const expulsados = [];
const estado = EstadoModel.crear({ sala: "Futsal 3v3", config: { MapaPorDefecto: "Futsal x3" }, divisiones: [] });
estado.encendida = true;
estado.link = "https://www.haxball.com/play?c=PRUEBA";
estado.jugadores = [{ id: 1, nombre: "Ana", equipo: 1, admin: false }];
EstadoModel.agregarMensaje(estado, "chat", "hola");

const salaFalsa = {
  estado: () => estado,
  expulsar: async (id, motivo, banear) => {
    if (id === 99) throw new Error("La sala todavía no está lista");
    expulsados.push({ id, motivo, banear });
  },
};

const escuchar = (app) => new Promise((listo) => {
  const servidor = app.listen(0, () => listo({ servidor, url: `http://127.0.0.1:${servidor.address().port}` }));
});

const pedir = async (url, opciones) => {
  const respuesta = await fetch(url, opciones);
  const texto = await respuesta.text();
  let datos = null;
  try { datos = JSON.parse(texto); } catch { datos = texto; }
  return { status: respuesta.status, datos };
};
const json = (cuerpo, token) => ({ method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: JSON.stringify(cuerpo) });
// Los rangos son solo de OWNER y CO-OWNER: una sesión de Jinder, que es OWNER en el roles.json de prueba
const tokenOwner = require("../models/SesionModel").firmar({ nick: "Jinder", rango: "OWNER", admin: true });
const conOwner = { headers: { Authorization: "Bearer " + tokenOwner } };
// El AYUDANTE ve las salas y expulsa, pero no banea
const tokenAyudante = require("../models/SesionModel").firmar({ nick: "Ayu", rango: "🛠️ AYUDANTE", admin: false });

(async () => {
  const sala = await escuchar(crearApp({ sala: salaFalsa }));
  const panel = await escuchar(crearApp({ salas: [{ clave: "3v3", nombre: "Futsal 3v3", url: sala.url }] }));

  console.log("🏠 La app de una sala (launcher):\n");

  let r = await pedir(`${sala.url}/api/estado`);
  revisar("GET /api/estado devuelve el estado", r.status === 200 && r.datos.sala === "Futsal 3v3" && r.datos.jugadores.length === 1, `HTTP ${r.status}`);

  r = await pedir(`${sala.url}/api/salas`);
  revisar("GET /api/salas devuelve solo esta sala", r.status === 200 && r.datos.salas.length === 1 && r.datos.salas[0].ok === true, JSON.stringify(r.datos.salas?.map((s) => s.nombre)));

  r = await pedir(`${sala.url}/api/elo`);
  revisar("GET /api/elo devuelve ranking y divisiones", r.status === 200 && Array.isArray(r.datos.ranking) && r.datos.ranking[0].nombre === "Ana", JSON.stringify(r.datos.ranking?.[0]?.nombre));

  r = await pedir(`${sala.url}/api/rangos`);
  revisar("GET /api/rangos sin sesión no deja ver los rangos", r.status === 401, `HTTP ${r.status}`);

  r = await pedir(`${sala.url}/api/rangos`, conOwner);
  revisar("GET /api/rangos no filtra la clave", r.status === 200 && r.datos.clave === undefined && r.datos.tieneClave === true, JSON.stringify(Object.keys(r.datos)));

  r = await pedir(`${sala.url}/api/rangos`, json({ roles: [
    { id: "owner", nombre: "OWNER", admin: true, nicks: ["Jinder", "Nathan"] },
    { id: "ayudante", nombre: "🛠️ AYUDANTE", admin: false, nicks: ["Ayu"] },
  ] }, tokenOwner));
  const guardado = JSON.parse(fs.readFileSync(process.env.ROLES_FILE, "utf8"));
  revisar("POST /api/rangos guarda y conserva la clave", r.status === 200 && guardado.clave === "secreta" && guardado.roles[0].nicks.length === 2, `clave=${guardado.clave}`);

  r = await pedir(`${sala.url}/api/kick`, json({ id: 1, motivo: "prueba" }));
  revisar("POST /api/kick sin sesión da 401", r.status === 401, `HTTP ${r.status}`);

  r = await pedir(`${sala.url}/api/kick`, json({ id: 1, motivo: "prueba" }, tokenOwner));
  revisar("POST /api/kick expulsa en la sala", r.status === 200 && r.datos.ok === true && expulsados.length === 1 && expulsados[0].banear === false, JSON.stringify(expulsados[0]));

  r = await pedir(`${sala.url}/api/ban`, json({ id: 2 }, tokenOwner));
  revisar("POST /api/ban banea con motivo por defecto", r.status === 200 && expulsados[1].banear === true && expulsados[1].motivo === "Baneado desde el panel", expulsados[1]?.motivo);

  // El AYUDANTE: expulsa sí, banea no
  const antesAyu = expulsados.length;
  r = await pedir(`${sala.url}/api/kick`, json({ id: 3, motivo: "lo echa el ayudante" }, tokenAyudante));
  revisar("Un AYUDANTE puede expulsar", r.status === 200 && expulsados.length === antesAyu + 1, `HTTP ${r.status}`);
  r = await pedir(`${sala.url}/api/ban`, json({ id: 3 }, tokenAyudante));
  revisar("Un AYUDANTE no puede banear", r.status === 403 && /no pueden banear/i.test(r.datos.error || ""), r.datos.error);
  revisar("Y el ban rechazado no llega a la sala", expulsados.length === antesAyu + 1, expulsados.length + " expulsados");

  r = await pedir(`${sala.url}/api/kick`, json({ motivo: "sin id" }, tokenOwner));
  revisar("POST /api/kick sin id da 400", r.status === 400 && r.datos.ok === false, `HTTP ${r.status} ${r.datos.error}`);

  r = await pedir(`${sala.url}/api/kick`, json({ id: 99 }, tokenOwner));
  revisar("Si la sala no está lista, 400 con el motivo", r.status === 400 && /todavía no está lista/.test(r.datos.error || ""), r.datos.error);

  r = await pedir(`${sala.url}/`);
  revisar("GET / sirve la pantalla del panel", r.status === 200 && String(r.datos).includes("<html"), `HTTP ${r.status}`);

  r = await pedir(`${sala.url}/rangos`);
  revisar("GET /rangos sirve la pantalla de rangos", r.status === 200 && String(r.datos).includes("<html"), `HTTP ${r.status}`);

  r = await pedir(`${sala.url}/no-existe`);
  revisar("Una ruta que no existe da 404", r.status === 404, `HTTP ${r.status}`);

  console.log("\n🖥️  La app del panel (varias salas):\n");

  r = await pedir(`${panel.url}/api/salas`);
  revisar("GET /api/salas junta las salas remotas", r.status === 200 && r.datos.salas.length === 1 && r.datos.salas[0].ok === true && r.datos.salas[0].estado.sala === "Futsal 3v3", JSON.stringify(r.datos.salas?.map((s) => s.clave)));

  r = await pedir(`${panel.url}/api/estado`);
  revisar("GET /api/estado da 404 (el panel no maneja salas)", r.status === 404, `HTTP ${r.status}`);

  const antes = expulsados.length;
  r = await pedir(`${panel.url}/api/kick/3v3`, json({ id: 7, motivo: "desde el panel" }, tokenAyudante));
  revisar("POST /api/kick/3v3 se reenvía a la sala (con la sesión del que lo pidió)", r.status === 200 && r.datos.ok === true && expulsados.length === antes + 1 && expulsados[antes].id === 7, JSON.stringify(expulsados[antes]));

  r = await pedir(`${panel.url}/api/ban/3v3`, json({ id: 7 }, tokenAyudante));
  revisar("Y el panel tampoco deja banear al AYUDANTE", r.status === 403, `HTTP ${r.status}`);

  r = await pedir(`${panel.url}/api/kick/noexiste`, json({ id: 7 }, tokenOwner));
  revisar("POST a una sala que no existe da 404", r.status === 404 && /no encontrada/.test(r.datos.error || ""), r.datos.error);

  r = await pedir(`${panel.url}/api/rangos`, conOwner);
  revisar("El panel también lee los rangos", r.status === 200 && r.datos.tieneClave === true, `HTTP ${r.status}`);

  // Una sala caída no puede romper el panel
  const panelCaido = await escuchar(crearApp({ salas: [{ clave: "muerta", nombre: "Sala muerta", url: "http://127.0.0.1:1" }] }));
  r = await pedir(`${panelCaido.url}/api/salas`);
  revisar("Una sala que no contesta vuelve con ok:false", r.status === 200 && r.datos.salas[0].ok === false, r.datos.salas?.[0]?.error);

  sala.servidor.close();
  panel.servidor.close();
  panelCaido.servidor.close();
  fs.rmSync(temporal, { recursive: true, force: true });

  console.log("");
  if (problemas.length) {
    console.log("❌ Falló: " + problemas.join(" | "));
    process.exit(1);
  }
  console.log("✅ API OK: la sala y el panel responden lo mismo de siempre, con routes → controllers → models");
})();
