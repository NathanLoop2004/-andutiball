// PublicoController — lo poco de las salas que se puede contar sin sesión.
// Lo lee la extensión de ÑandutíHax desde el navegador de cada jugador, así que lleva CORS
// abierto: es información que ya se ve entrando a la sala (marcador y quién está jugando).
const SalasModel = require("../models/SalasModel");
const PublicoModel = require("../models/PublicoModel");
const MomentosModel = require("../models/MomentosModel");

class PublicoController {
  static _ctx = (req) => req.app.locals;

  static salas = async (req, res, next) => {
    try {
      // Cualquier página puede leerlo: es público a propósito y es solo de lectura
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Cache-Control", "no-store");
      const salas = await SalasModel.listar(PublicoController._ctx(req));

      // Los carteles del arranque y de la victoria viajan acá porque la extensión necesita
      // los colores POR LETRA, y por el chat solo puede llegar un color. Sin base van en
      // null y no pasa nada.
      let inicio = null, victoria = null, tiempo = null;
      try {
        inicio = await MomentosModel.elPuesto("inicio");
        victoria = await MomentosModel.elPuesto("victoria");
        tiempo = await MomentosModel.elPuesto("tiempo");
      } catch (error) { /* sin base, sin carteles */ }

      res.json({
        ok: true,
        salas: PublicoModel.salas(salas),
        inicio: inicio && { colores: inicio.colores, color: inicio.color, estilo: inicio.estilo },
        victoria: victoria && { colores: victoria.colores, color: victoria.color, estilo: victoria.estilo },
        tiempo: tiempo && { colores: tiempo.colores, color: tiempo.color, estilo: tiempo.estilo },
        cuando: new Date().toISOString(),
      });
    } catch (error) { next(error); }
  };
}

module.exports = PublicoController;
