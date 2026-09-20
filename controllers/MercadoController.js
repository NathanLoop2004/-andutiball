// MercadoController — lo que se muestra de cada cosa de la tienda: cómo se fue moviendo el
// precio, cuántos la compraron y a cuántos les gusta.
//
// La ficha es PÚBLICA (la lee la página de cada camiseta y de cada animación), pero de los
// favoritos solo sale el NÚMERO: nunca quiénes son. Marcar un favorito sí pide sesión, y el
// nick sale del token, nunca del cuerpo del pedido.
const MercadoModel = require("../models/MercadoModel");

const responder = (res, error) => {
  const sinBase = /No se pudo abrir la base|Can't reach database|ECONNREFUSED/i.test(error.message);
  res.status(sinBase ? 503 : 400).json({
    ok: false,
    error: sinBase ? "La base de datos no está levantada" : error.message,
  });
};

class MercadoController {
  static ficha = async (req, res) => {
    try {
      // El nick es opcional: con sesión, además dice si a esa persona le gusta
      const nick = req.usuario ? req.usuario.nick : null;
      res.json({ ok: true, ...(await MercadoModel.ficha(req.params.tipo, req.params.clave, nick)) });
    } catch (error) {
      // Sin base, la página se muestra igual pero sin estos datos
      if (/base de datos/i.test(error.message)) {
        return res.json({ ok: true, compraron: 0, favoritos: 0, esFavorito: false, historial: [] });
      }
      responder(res, error);
    }
  };

  static marcar = async (req, res) => {
    try {
      const { tipo, clave } = req.body || {};
      res.json({ ok: true, ...(await MercadoModel.marcarFavorito(req.usuario.nick, tipo, clave)) });
    } catch (error) { responder(res, error); }
  };

  static mios = async (req, res) => {
    try { res.json({ ok: true, favoritos: await MercadoModel.misFavoritos(req.usuario.nick) }); }
    catch (error) { responder(res, error); }
  };
}

module.exports = MercadoController;
