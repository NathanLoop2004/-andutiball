// =============================================================================
// app.js — la aplicación Express del panel, en MVC (routes → controllers → models).
//
// La usan los dos procesos, con la misma API:
//   · launcher.js  → crearApp({ sala })   una sala, la que maneja con Puppeteer
//   · panel/server.js → crearApp({ salas })  varias salas remotas, por HTTP
//
// Las respuestas son las mismas de siempre (el panel las viene leyendo así):
//   GET  /api/estado        el estado de la sala local
//   GET  /api/salas         { salas: [ { clave, nombre, ok, estado } ] }
//   GET  /api/elo           { divisiones, ranking }
//   GET  /api/rangos        rangos sin la clave (solo OWNER y CO-OWNER)
//   POST /api/rangos        guarda y devuelve los rangos sin la clave
//   GET  /api/actualizaciones        las novedades para el Discord
//   POST /api/actualizaciones        guarda una (queda pendiente)
//   POST /api/actualizaciones/:id/enviar   la manda al Discord
//   POST /api/kick[/:sala]  { ok } | { ok:false, error }
//   POST /api/ban[/:sala]   idem
//   GET  /                        Ñandutí Web (la portada)
//   GET  /frm/login · /frm/registro   entrar y registrarse
//   GET  /frm/panel · /frm/rangos · /frm/actualizaciones   el panel (solo admins)
//   GET  /api/usuarios?q=&pagina=   usuarios de a 15 (solo OWNER)
//   POST /api/usuarios/:nick/banear · /desbanear · /clave      (solo OWNER)
//   GET  /api/ranking             los mejores ELO para la web (sin datos internos)
//   GET  /api/cuenta · POST /api/cuenta/codigo · /clave · /email   Mi cuenta (con sesión)
//   /api/config/:sala/parametros · /comandos   Configuración de las salas (OWNER, CO-OWNER, HOSTER, AYUDANTE)
//   /api/carrusel (público) · /api/carrusel/todas · POST|PUT|DELETE   el carrusel de la portada
//   GET  /frm/carrusel            la pantalla del carrusel
//   GET  /frm/config              la pantalla de Configuración
//   GET  /frm/cuenta              la pantalla de Mi cuenta
//   GET  /frm/usuarios            la pantalla de usuarios (solo OWNER)
// =============================================================================
const express = require("express");
const path = require("path");

const estadoRouter = require("./routes/EstadoRouter");
const salasRouter = require("./routes/SalasRouter");
const eloRouter = require("./routes/EloRouter");
const rangosRouter = require("./routes/RangosRouter");
const moderacionRouter = require("./routes/ModeracionRouter");
const actualizacionesRouter = require("./routes/ActualizacionesRouter");
const authRouter = require("./routes/AuthRouter");
const usuariosRouter = require("./routes/UsuariosRouter");
const cuentaRouter = require("./routes/CuentaRouter");
const configRouter = require("./routes/ConfigRouter");
const carruselRouter = require("./routes/CarruselRouter");
const ajustesRouter = require("./routes/AjustesRouter");
const equiposRouter = require("./routes/EquiposRouter");
const tiendaRouter = require("./routes/TiendaRouter");
const animacionesRouter = require("./routes/AnimacionesRouter");
const mercadoRouter = require("./routes/MercadoRouter");
const scoresRouter = require("./routes/ScoresRouter");
const momentosRouter = require("./routes/MomentosRouter");
const publicoRouter = require("./routes/PublicoRouter");
const vistasRouter = require("./routes/VistasRouter");

// sala: adaptador de la sala local { estado(), expulsar(id, motivo, banear) }
// salas: [{ clave, nombre, url }] de las salas remotas (solo el panel)
function crearApp({ sala = null, salas = [] } = {}) {
  const app = express();
  app.disable("x-powered-by");

  // El contexto de esta app. Los controllers lo leen con _ctx(req) y se lo pasan
  // a los models, así los models no guardan estado global y dos apps pueden
  // convivir en un mismo proceso (el test levanta la sala y el panel juntos).
  app.locals.sala = sala;
  app.locals.salas = salas;

  app.use(express.json({ limit: "1mb" }));

  // El panel puede estar en otro puerto (8080) que la sala (3001…), y nada se cachea
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "OPTIONS") return res.end();
    next();
  });

  app.use("/api", estadoRouter);
  app.use("/api", salasRouter);
  app.use("/api", eloRouter);
  app.use("/api", rangosRouter);
  app.use("/api", moderacionRouter);
  app.use("/api", actualizacionesRouter);
  app.use("/api", authRouter);
  app.use("/api", usuariosRouter);
  app.use("/api", cuentaRouter);
  app.use("/api", configRouter);
  app.use("/api", carruselRouter);
  app.use("/api", ajustesRouter);
  app.use("/api", equiposRouter);
  app.use("/api", tiendaRouter);
  app.use("/api", animacionesRouter);
  app.use("/api", mercadoRouter);
  app.use("/api", scoresRouter);
  app.use("/api", momentosRouter);
  app.use("/api", publicoRouter);

  // Todo lo estático sale de public/ (igual que app-centralshop)
  app.use(express.static(path.join(__dirname, "public")));
  app.use("/", vistasRouter);

  app.use((req, res) => res.status(404).send("not found"));

  // Un error en un controller no tiene que tumbar la sala
  app.use((error, req, res, _next) => {
    console.error("❌ Error en la API:", error.message);
    res.status(500).json({ ok: false, error: error.message });
  });

  return app;
}

module.exports = { crearApp };
