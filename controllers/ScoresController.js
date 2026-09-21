// ScoresController — los carteles de gol.
// El catálogo lo arman SOLO el OWNER y el CO-OWNER (puedeVerRangos); comprar, vender y
// elegir piden sesión, y el nick sale del token, nunca del cuerpo del pedido.
const ScoresModel = require("../models/ScoresModel");

const responder = (res, error) => {
  const sinBase = /No se pudo abrir la base|Can't reach database|ECONNREFUSED/i.test(error.message);
  res.status(sinBase ? 503 : 400).json({
    ok: false,
    error: sinBase ? "La base de datos no está levantada" : error.message,
  });
};

class ScoresController {
  static vitrina = async (_req, res) => {
    try { res.json({ ok: true, scores: await ScoresModel.vitrina() }); }
    catch (error) {
      if (/base/i.test(error.message)) return res.json({ ok: true, scores: [] });
      responder(res, error);
    }
  };

  static mios = async (req, res) => {
    try { res.json({ ok: true, ...(await ScoresModel.deLaCuenta(req.usuario.nick)) }); }
    catch (error) { responder(res, error); }
  };

  static comprar = async (req, res) => {
    try { res.json({ ok: true, ...(await ScoresModel.comprar(req.usuario.nick, (req.body || {}).clave)) }); }
    catch (error) { responder(res, error); }
  };

  static vender = async (req, res) => {
    try { res.json({ ok: true, ...(await ScoresModel.vender(req.usuario.nick, (req.body || {}).clave)) }); }
    catch (error) { responder(res, error); }
  };

  static elegir = async (req, res) => {
    try { res.json({ ok: true, ...(await ScoresModel.elegir(req.usuario.nick, (req.body || {}).clave)) }); }
    catch (error) { responder(res, error); }
  };

  // ── Solo OWNER y CO-OWNER ──
  static catalogo = async (_req, res) => {
    try {
      res.json({
        ok: true,
        scores: await ScoresModel.catalogo(),
        huecos: ScoresModel.HUECOS,
        estilos: ScoresModel.ESTILOS,
        largoMaximo: ScoresModel.LARGO_MAXIMO,
        ejemplo: ScoresModel.PLANTILLA_DE_EJEMPLO,
      });
    } catch (error) { responder(res, error); }
  };

  static guardar = async (req, res) => {
    try {
      const quien = req.usuario ? req.usuario.nick : null;
      res.json({ ok: true, score: await ScoresModel.guardar(req.params.clave, req.body || {}, quien) });
    } catch (error) { responder(res, error); }
  };

  static borrar = async (req, res) => {
    try { res.json({ ok: true, ...(await ScoresModel.borrar(req.params.clave)) }); }
    catch (error) { responder(res, error); }
  };
}

module.exports = ScoresController;
