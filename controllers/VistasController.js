// VistasController — las pantallas. El encarpetado sigue el de app-centralshop:
// public/frm/<pantalla>/index.html, y la portada en public/index.html.
const path = require("path");

const PUBLICO = path.join(__dirname, "..", "public");
const pantalla = (...partes) => (req, res) => res.sendFile(path.join(PUBLICO, ...partes, "index.html"));

class VistasController {
  static portada = pantalla();                            // Ñandutí Web
  static login = pantalla("frm", "login");
  static registro = pantalla("frm", "registro");

  // Las de siempre, ahora bajo /frm (se dejan los atajos viejos)
  static panel = pantalla("frm", "panel");
  static rangos = pantalla("frm", "rangos");
  static actualizaciones = pantalla("frm", "actualizaciones");
}

module.exports = VistasController;
