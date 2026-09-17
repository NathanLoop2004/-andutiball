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
  revisar("La portada dice ÑandutíBall", portada.status === 200 && /ÑandutíBall/.test(portada.datos), "HTTP " + portada.status);
  revisar("Y ofrece iniciar sesión o registrarte", /\/frm\/login\//.test(portada.datos) && /\/frm\/registro\//.test(portada.datos));

  for (const ruta of ["/frm/login", "/frm/registro", "/frm/recuperar", "/frm/cuenta", "/frm/panel", "/frm/rangos", "/frm/actualizaciones"]) {
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

    const email = nick.toLowerCase() + "@prueba.nanduti";

    const sinEmail = await pedir(web.url + "/api/auth/registrar", json({ nick, clave }));
    revisar("Sin correo no se puede crear la cuenta", sinEmail.status === 400 && /correo/i.test(sinEmail.datos.error), sinEmail.datos.error);
    const emailMal = await pedir(web.url + "/api/auth/registrar", json({ nick, clave, email: "esto-no-es-un-mail" }));
    revisar("Un correo mal escrito se rechaza", emailMal.status === 400, emailMal.datos.error);

    // ── El correo tiene que existir ──
    const Correos = require("../lib/correos");
    revisar("Un Gmail imposible se rechaza al instante", !Correos.gmailValido("ab") && !Correos.gmailValido("juan..perez") && Correos.gmailValido("juan.perez+haxball"));
    Correos.usarResolver(async (dominio) => {
      if (dominio === "prueba.nanduti") return [{ exchange: "mx.prueba.nanduti", priority: 10 }];
      throw Object.assign(new Error("no existe"), { code: "ENOTFOUND" });
    });
    const gmailMal = await pedir(web.url + "/api/auth/registrar/codigo", json({ nick, clave, email: "ab@gmail.com" }));
    revisar("Si el Gmail no existe lo dice", gmailMal.status === 400 && /no existe/i.test(gmailMal.datos.error), gmailMal.datos.error);
    const dominioMal = await pedir(web.url + "/api/auth/registrar/codigo", json({ nick, clave, email: "alguien@gmial.com" }));
    revisar("Si el dominio no recibe correos dice que no existe", dominioMal.status === 400 && /no existe/i.test(dominioMal.datos.error), dominioMal.datos.error);

    const CorreoAlta = require("../services/Correo");
    const mailsAlta = [];
    CorreoAlta.usarEnvio(async (mail) => { mailsAlta.push(mail); return { ok: true }; });
    const sinCodigo = await pedir(web.url + "/api/auth/registrar", json({ nick, clave, email }));
    revisar("Sin el código del correo no se crea la cuenta", sinCodigo.status === 400 && /código/i.test(sinCodigo.datos.error), sinCodigo.datos.error);
    const pedidoAlta = await pedir(web.url + "/api/auth/registrar/codigo", json({ nick, clave, email: email.toUpperCase() }));
    const codigoAlta = ((mailsAlta[0] && mailsAlta[0].texto) || "").match(/\b(\d{6})\b/)?.[1];
    revisar("Manda un código de 6 números a ese correo", pedidoAlta.status === 200 && Boolean(codigoAlta) && mailsAlta[0].para === email, pedidoAlta.datos.error || pedidoAlta.datos.enviadoA);
    const otraVez = await pedir(web.url + "/api/auth/registrar/codigo", json({ nick, clave, email }));
    revisar("No deja pedir otro código enseguida", otraVez.status === 400 && /esper/i.test(otraVez.datos.error), otraVez.datos.error);
    const codigoMalo = await pedir(web.url + "/api/auth/registrar", json({ nick, clave, email, codigo: codigoAlta === "000000" ? "111111" : "000000" }));
    revisar("Con un código equivocado no se crea", codigoMalo.status === 400 && /incorrecto/i.test(codigoMalo.datos.error), codigoMalo.datos.error);
    const codigoOtroNick = await pedir(web.url + "/api/auth/registrar", json({ nick: nick + "x", clave, email, codigo: codigoAlta }));
    revisar("El código no sirve para otro nombre", codigoOtroNick.status === 400, codigoOtroNick.datos.error);
    CorreoAlta.usarEnvio(null);

    const alta = await pedir(web.url + "/api/auth/registrar", json({ nick, clave, email: email.toUpperCase(), codigo: codigoAlta }));
    revisar("Se puede crear la cuenta", alta.status === 201 && Boolean(alta.datos.token), "HTTP " + alta.status);
    revisar("Vuelve el usuario, nunca la clave", alta.datos.usuario.nick === nick && !("clave" in alta.datos.usuario), Object.keys(alta.datos.usuario).join(","));
    revisar("Un usuario nuevo no es admin", alta.datos.usuario.admin === false);
    const guardado = await base().usuario.findUnique({ where: { nick } });
    revisar("El correo queda guardado en minúsculas", guardado && guardado.email === email, guardado && guardado.email);

    const otroConEseCorreo = await pedir(web.url + "/api/auth/registrar", json({ nick: nick + "b", clave, email }));
    revisar("Dos cuentas no pueden tener el mismo correo", otroConEseCorreo.status === 400 && /correo/i.test(otroConEseCorreo.datos.error), otroConEseCorreo.datos.error);

    const repetido = await pedir(web.url + "/api/auth/registrar", json({ nick, clave: "otra1234", email: "ladron" + Date.now() + "@prueba.nanduti" }));
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

    // ── Recuperar la cuenta por correo (sin mandar mails de verdad) ──
    console.log("\n📧 Recuperar la cuenta:\n");
    const Correo = require("../services/Correo");
    const mandados = [];
    Correo.usarEnvio(async (mail) => { mandados.push(mail); return { ok: true }; });
    process.env.WEB_URL = "https://nanduti.prueba";
    try {
      const noExiste = await pedir(web.url + "/api/auth/recuperar", json({ email: "nadie" + Date.now() + "@prueba.nanduti" }));
      const siExiste = await pedir(web.url + "/api/auth/recuperar", json({ email: email.toUpperCase() }));
      revisar("Contesta lo mismo exista o no el correo (no se puede averiguar quién está)", noExiste.status === 200 && siExiste.status === 200 && noExiste.datos.mensaje === siExiste.datos.mensaje);
      revisar("Solo le manda mail al que existe", mandados.length === 1 && mandados[0].para === email, mandados.length + " mails");

      const mail = mandados[0] || { html: "", texto: "" };
      const link = (mail.texto.match(/https:\/\/nanduti\.prueba\/frm\/recuperar\/\?t=\S+/) || [])[0];
      revisar("El mail es HTML, con el botón y el link a la pantalla", /<a href="https:\/\/nanduti\.prueba\/frm\/recuperar\/\?t=/.test(mail.html) && /Cambiar mi contrase/.test(mail.html) && Boolean(link), link);
      const token = link ? decodeURIComponent(link.split("?t=")[1]) : "";

      const enBase = await base().usuario.findUnique({ where: { nick } });
      revisar("En la base no queda el link tal cual, solo su hash", enBase.recuperarHash && enBase.recuperarHash !== token && !JSON.stringify(enBase).includes(token));

      const revisado = await pedir(web.url + "/api/auth/recuperar?t=" + encodeURIComponent(token));
      revisar("La pantalla reconoce el link y de quién es", revisado.status === 200 && revisado.datos.nick === nick, revisado.datos.nick);
      const trucho = await pedir(web.url + "/api/auth/recuperar?t=" + "x".repeat(43));
      revisar("Un link inventado no sirve", trucho.status === 400, trucho.datos.error);

      const nueva = "nueva5678";
      const cambio = await pedir(web.url + "/api/auth/recuperar/cambiar", json({ token, clave: nueva }));
      revisar("Con el link se cambia la contraseña", cambio.status === 200, cambio.datos.error);
      const conVieja = await pedir(web.url + "/api/auth/entrar", json({ nick, clave }));
      const conNueva = await pedir(web.url + "/api/auth/entrar", json({ nick, clave: nueva }));
      revisar("La vieja ya no entra y la nueva sí", conVieja.status === 400 && conNueva.status === 200);

      const otraVez = await pedir(web.url + "/api/auth/recuperar/cambiar", json({ token, clave: "otra9999" }));
      revisar("El link sirve una sola vez", otraVez.status === 400, otraVez.datos.error);

      // Un link vencido tampoco
      await pedir(web.url + "/api/auth/recuperar", json({ email }));
      const token2 = decodeURIComponent((mandados[1] ? mandados[1].texto.match(/\?t=(\S+)/)[1] : ""));
      await base().usuario.update({ where: { nick }, data: { recuperarVence: new Date(Date.now() - 1000) } });
      const vencido2 = await pedir(web.url + "/api/auth/recuperar/cambiar", json({ token: token2, clave: "otra9999" }));
      revisar("Un link vencido no sirve", vencido2.status === 400 && Boolean(token2), vencido2.datos.error);

      const ficha = await pedir(web.url + "/api/auth/entrar", json({ nick, clave: nueva }));
      revisar("Lo que sale del servidor nunca trae el hash del link", !JSON.stringify(ficha.datos).includes("recuperar"));

      // ── Mi cuenta: cambiar la contraseña con un código por correo ──
      console.log("\n🔢 Mi cuenta: cambiar la contraseña con código:\n");
      const conToken = (token, cuerpo) => cuerpo === undefined
        ? { headers: { Authorization: "Bearer " + token } }
        : json(cuerpo, token);
      const tokenCuenta = ficha.datos.token;

      const sinSesion = await pedir(web.url + "/api/cuenta");
      revisar("Mi cuenta pide sesión", sinSesion.status === 401, "HTTP " + sinSesion.status);

      const miCuenta = await pedir(web.url + "/api/cuenta", conToken(tokenCuenta));
      revisar("Con sesión muestra tus datos y tu correo", miCuenta.status === 200 && miCuenta.datos.cuenta.nick === nick && miCuenta.datos.cuenta.email === email, miCuenta.datos.cuenta && miCuenta.datos.cuenta.emailTapado);
      revisar("Tus datos no traen hashes", !/scrypt|codigoHash|recuperarHash/.test(JSON.stringify(miCuenta.datos)));

      mandados.length = 0;
      const pedido = await pedir(web.url + "/api/cuenta/codigo", json({}, tokenCuenta));
      const codigo = mandados[0] ? (mandados[0].texto.match(/\b(\d{6})\b/) || [])[1] : null;
      revisar("Pide el código y le llega un mail con 6 números", pedido.status === 200 && Boolean(codigo) && mandados[0].para === email, pedido.datos.enviadoA);
      revisar("El mail del código es HTML", /<html/.test(mandados[0] ? mandados[0].html : "") && (mandados[0] ? mandados[0].html.includes(codigo.split("").join("&#8202;")) : false));
      const guardadoCodigo = await base().usuario.findUnique({ where: { nick } });
      revisar("En la base queda el hash del código, no el código", guardadoCodigo.codigoHash && !guardadoCodigo.codigoHash.includes(codigo));

      const otraVezYa = await pedir(web.url + "/api/cuenta/codigo", json({}, tokenCuenta));
      revisar("No deja pedir otro código enseguida", otraVezYa.status === 400 && /Esperá/.test(otraVezYa.datos.error), otraVezYa.datos.error);

      const otroCodigo = codigo === "000000" ? "111111" : "000000";
      const mal1 = await pedir(web.url + "/api/cuenta/clave", json({ codigo: otroCodigo, clave: "otra9999" }, tokenCuenta));
      revisar("Con un código equivocado no cambia y avisa cuántos intentos quedan", mal1.status === 400 && /quedan 4/.test(mal1.datos.error), mal1.datos.error);

      const claveFinal = "final4321";
      const bienCodigo = await pedir(web.url + "/api/cuenta/clave", json({ codigo, clave: claveFinal }, tokenCuenta));
      revisar("Con el código correcto cambia la contraseña", bienCodigo.status === 200, bienCodigo.datos.error);
      const entraFinal = await pedir(web.url + "/api/auth/entrar", json({ nick, clave: claveFinal }));
      const noEntraVieja = await pedir(web.url + "/api/auth/entrar", json({ nick, clave: nueva }));
      revisar("La nueva entra y la anterior no", entraFinal.status === 200 && noEntraVieja.status === 400);

      const reuso = await pedir(web.url + "/api/cuenta/clave", json({ codigo, clave: "otra9999" }, tokenCuenta));
      revisar("El código sirve una sola vez", reuso.status === 400, reuso.datos.error);

      // Cinco errores y el código se quema
      await base().usuario.update({ where: { nick }, data: { codigoPedido: new Date(Date.now() - 120000) } });
      mandados.length = 0;
      await pedir(web.url + "/api/cuenta/codigo", json({}, tokenCuenta));
      const codigo2 = mandados[0] ? (mandados[0].texto.match(/\b(\d{6})\b/) || [])[1] : null;
      const errado = codigo2 === "000000" ? "111111" : "000000";
      for (let i = 0; i < 5; i++) await pedir(web.url + "/api/cuenta/clave", json({ codigo: errado, clave: "otra9999" }, tokenCuenta));
      const quemado = await pedir(web.url + "/api/cuenta/clave", json({ codigo: codigo2, clave: "otra9999" }, tokenCuenta));
      revisar("Después de 5 errores ni el código correcto sirve", quemado.status === 400 && /muchas veces/.test(quemado.datos.error), quemado.datos.error);

      // Un código vencido tampoco
      await base().usuario.update({ where: { nick }, data: { codigoPedido: new Date(Date.now() - 120000) } });
      mandados.length = 0;
      await pedir(web.url + "/api/cuenta/codigo", json({}, tokenCuenta));
      const codigo3 = mandados[0] ? (mandados[0].texto.match(/\b(\d{6})\b/) || [])[1] : null;
      await base().usuario.update({ where: { nick }, data: { codigoVence: new Date(Date.now() - 1000) } });
      const vencidoCodigo = await pedir(web.url + "/api/cuenta/clave", json({ codigo: codigo3, clave: "otra9999" }, tokenCuenta));
      revisar("Un código vencido no sirve", vencidoCodigo.status === 400 && /venció/.test(vencidoCodigo.datos.error), vencidoCodigo.datos.error);

      // Agregar correo: pide la contraseña actual
      await base().usuario.update({ where: { nick }, data: { email: null } });
      const sinCorreo = await pedir(web.url + "/api/cuenta/codigo", json({}, tokenCuenta));
      revisar("Sin correo no se puede pedir código", sinCorreo.status === 400 && /correo/i.test(sinCorreo.datos.error), sinCorreo.datos.error);
      const emailMalaClave = await pedir(web.url + "/api/cuenta/email", json({ email, clave: "equivocada" }, tokenCuenta));
      revisar("Para agregar el correo hay que poner la contraseña actual", emailMalaClave.status === 400, emailMalaClave.datos.error);
      const emailBien = await pedir(web.url + "/api/cuenta/email", json({ email, clave: claveFinal }, tokenCuenta));
      revisar("Con la contraseña correcta se guarda el correo", emailBien.status === 200 && emailBien.datos.email === email);

      // ── Ranking público ──
      const tabla = await pedir(web.url + "/api/ranking?limite=5");
      revisar("El ranking público responde", tabla.status === 200 && Array.isArray(tabla.datos.ranking) && tabla.datos.ranking.length <= 5, tabla.datos.ranking.length + " jugadores");
      revisar("El ranking no muestra el auth de nadie", !/auth:|"clave"/.test(JSON.stringify(tabla.datos.ranking)) && !/auth:/.test(JSON.stringify(tabla.datos)));
      revisar("Trae las pestañas: general y cada sala", tabla.datos.salas[0].clave === "general" && tabla.datos.salas.some((s) => s.clave === "realsoccer" && s.nombre === "Real Soccer"), tabla.datos.salas.map((s) => s.nombre).join(" · "));
      const deSala = await pedir(web.url + "/api/ranking?sala=3v3");
      revisar("Se puede pedir el ranking de una sala", deSala.status === 200 && deSala.datos.sala === "3v3");
      const trucha = await pedir(web.url + "/api/ranking?sala=" + encodeURIComponent("../../.env"));
      revisar("Una sala inventada da error (no lee archivos raros)", trucha.status === 400, trucha.datos.error);
      revisar("Cada jugador trae puesto, ELO y goles", tabla.datos.ranking.every((j) => j.puesto && typeof j.elo === "number" && typeof j.goles === "number"));
    } finally {
      Correo.usarEnvio(null);
      delete process.env.WEB_URL;
    }

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
