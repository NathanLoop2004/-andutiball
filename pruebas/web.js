// Prueba Ñandutí Web: la portada, registrarse, entrar, y que el panel sea solo de admins.
//
//   npm run prueba-web
//
// El usuario de la web es el MISMO que el de la sala (tabla `usuarios`): el que se
// registra acá después entra a HaxBall con !clave, y al revés.
// Si la base no está levantada, prueba las pantallas y saltea lo demás.

const fs = require("fs");
const path = require("path");
const { crearApp } = require("../app");
const { hayBase, base, cerrarBase } = require("../services/ConexionBase");
const SesionModel = require("../models/SesionModel");
const { ARCHIVO: ARCHIVO_RANGOS, leerRangos, guardarRangos } = require("../lib/rangos");

const problemas = [];
function revisar(titulo, condicion, detalle) {
  console.log((condicion ? "  ✅ " : "  ❌ ") + titulo + (detalle ? "  (" + detalle + ")" : ""));
  if (!condicion) problemas.push(titulo);
}

const escuchar = (app) => new Promise((listo) => {
  const servidor = app.listen(0, () => listo({ servidor, url: `http://127.0.0.1:${servidor.address().port}` }));
});
const pedir = async (url, opciones) => {
  const res = await fetch(url, opciones);
  const texto = await res.text();
  let datos;
  try { datos = JSON.parse(texto); } catch { datos = texto; }
  return { status: res.status, datos };
};
const json = (cuerpo, token) => ({
  method: "POST",
  headers: Object.assign({ "Content-Type": "application/json" }, token ? { Authorization: "Bearer " + token } : {}),
  body: JSON.stringify(cuerpo),
});

(async () => {
  const web = await escuchar(crearApp({ salas: [] }));

  console.log("🕸️  Las pantallas:\n");
  const portada = await pedir(web.url + "/");
  revisar("La portada dice Ñandutí Web", portada.status === 200 && /Ñandutí Web/.test(portada.datos), "HTTP " + portada.status);
  revisar("Y ofrece iniciar sesión o registrarte", /\/frm\/login\//.test(portada.datos) && /\/frm\/registro\//.test(portada.datos));

  for (const ruta of ["/frm/login", "/frm/registro", "/frm/panel", "/frm/rangos", "/frm/actualizaciones"]) {
    const r = await pedir(web.url + ruta);
    revisar("Abre " + ruta, r.status === 200 && /<html/.test(r.datos), "HTTP " + r.status);
  }

  const encarpetado = ["public/index.html", "public/frm/login/index.html", "public/frm/registro/index.html", "public/frm/panel/index.html", "public/css/nanduti.css", "public/js/sesion.js"];
  revisar("El encarpetado es el de centralshop (public/frm/<pantalla>/index.html)",
    encarpetado.every((f) => fs.existsSync(path.join(__dirname, "..", f))), encarpetado.length + " archivos");

  const panel = await pedir(web.url + "/frm/panel");
  revisar("El panel pide ser admin antes de mostrarse", /exigirAdmin/.test(panel.datos), "candado puesto");

  console.log("\n🔐 Sesión:\n");
  if (!(await hayBase())) {
    console.log("  ⏭️  La base no está levantada, salteamos el registro. 👉 npm run base\n");
  } else {
    const nick = "Web" + Date.now();
    const clave = "clave1234";

    const alta = await pedir(web.url + "/api/auth/registrar", json({ nick, clave }));
    revisar("Se puede crear la cuenta", alta.status === 201 && Boolean(alta.datos.token), "HTTP " + alta.status);
    revisar("Vuelve el usuario, nunca la clave", alta.datos.usuario.nick === nick && !("clave" in alta.datos.usuario), Object.keys(alta.datos.usuario).join(","));
    revisar("Un usuario nuevo no es admin", alta.datos.usuario.admin === false);

    const repetido = await pedir(web.url + "/api/auth/registrar", json({ nick, clave: "otra1234" }));
    revisar("No se puede robar un nombre ya registrado", repetido.status === 400, repetido.datos.error);

    const mal = await pedir(web.url + "/api/auth/entrar", json({ nick, clave: "equivocada" }));
    revisar("Con la clave equivocada no entra", mal.status === 400 && /incorrect/i.test(mal.datos.error), mal.datos.error);

    const bien = await pedir(web.url + "/api/auth/entrar", json({ nick, clave }));
    revisar("Con la clave correcta entra", bien.status === 200 && Boolean(bien.datos.token));

    const yo = await pedir(web.url + "/api/auth/yo", { headers: { Authorization: "Bearer " + bien.datos.token } });
    revisar("Con el token dice quién sos", yo.status === 200 && yo.datos.usuario.nick === nick, yo.datos.usuario?.nick);

    const sinToken = await pedir(web.url + "/api/auth/yo");
    revisar("Sin token no dice nada", sinToken.status === 401, "HTTP " + sinToken.status);

    // ── El token dura 1 h 30 y se renueva solo ──
    const jwt = require("jsonwebtoken");
    const leido = jwt.decode(bien.datos.token);
    const minutos = Math.round((leido.exp - leido.iat) / 60);
    revisar("El token vence a la hora y media", minutos === 90, minutos + " minutos");
    revisar("Recién firmado NO se renueva al toque", yo.datos.token === null || yo.datos.token === undefined, String(yo.datos.token));

    // Uno al que ya le queda poco: tiene que volver renovado
    const porVencer = jwt.sign({ nick, rango: null, admin: false, sid: "x" }, process.env.JWT_SECRET, { expiresIn: 60 * 20 });
    const renovado = await pedir(web.url + "/api/auth/yo", { headers: { Authorization: "Bearer " + porVencer } });
    revisar("Si le queda menos de 45 minutos, viene uno nuevo", Boolean(renovado.datos.token) && renovado.datos.token !== porVencer, "token cambiado");
    const nuevoLeido = jwt.decode(renovado.datos.token);
    revisar("Y el nuevo arranca de cero (otra hora y media)", Math.round((nuevoLeido.exp - nuevoLeido.iat) / 60) === 90 && nuevoLeido.sid !== "x", "sid nuevo");

    const vencido = jwt.sign({ nick, admin: false }, process.env.JWT_SECRET, { expiresIn: -10 });
    const conVencido = await pedir(web.url + "/api/auth/yo", { headers: { Authorization: "Bearer " + vencido } });
    revisar("Un token vencido no entra", conVencido.status === 401, conVencido.datos.error);

    // ── El rango sale de la tabla `rangos`: se lo damos y después se lo sacamos ──
    const RangoModel = require("../models/RangoModel");
    const rangos = await RangoModel.listar();
    const owner = rangos.find((r) => r.admin);
    try {
      await RangoModel.asignarNick({ nombreRango: owner.nombre, nick });

      const comoOwner = await pedir(web.url + "/api/auth/entrar", json({ nick, clave }));
      revisar("Con rango de OWNER entra como admin", comoOwner.datos.usuario.admin === true, comoOwner.datos.usuario.rango);
      revisar("El token también lo dice", SesionModel.leerToken(comoOwner.datos.token).admin === true);
    } finally {
      await RangoModel.quitarNick(nick);   // la tabla queda como estaba
    }

    revisar("Al sacarle el rango deja de ser admin", (await RangoModel.deNick(nick)) === null, "sin rango");

    // El mismo usuario sirve para la sala
    const UsuarioModel = require("../models/UsuarioModel");
    const enLaSala = await UsuarioModel.verificar({ nick, clave });
    revisar("Ese usuario también entra en la sala con !clave", enLaSala.ok === true);

    await base().usuario.delete({ where: { nick } });
  }

  web.servidor.close();
  await cerrarBase().catch(() => {});

  console.log("");
  if (problemas.length) {
    console.log("❌ Falló: " + problemas.join(" | "));
    process.exit(1);
  }
  console.log("✅ Ñandutí Web OK: portada, registro, sesión y el panel solo para admins");
})();
