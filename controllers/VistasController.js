// VistasController — las pantallas. El encarpetado sigue el de app-centralshop:
// public/frm/<pantalla>/index.html, y la portada en public/index.html.
const path = require("path");

const PUBLICO = path.join(__dirname, "..", "public");
const pantalla = (...partes) => (req, res) => res.sendFile(path.join(PUBLICO, ...partes, "index.html"));

class VistasController {
  static portada = pantalla();                            // Ñandutí Web
  static login = pantalla("frm", "login");
  static registro = pantalla("frm", "registro");
  static recuperar = pantalla("frm", "recuperar");
  static carrusel = pantalla("frm", "carrusel");     // imágenes del carrusel de la portada
  static config = pantalla("frm", "config");         // parámetros de las salas y comandos
  static ajustes = pantalla("frm", "ajustes");       // ajustes de la web (solo OWNER)
  static camiseta = pantalla("frm", "camiseta");         // la ficha de una camiseta (con su URL)
  static animacion = pantalla("frm", "animacion");       // la ficha de una animación (con su URL)
  static animaciones = pantalla("frm", "animaciones");   // animaciones de gol (OWNER y CO-OWNER)
  static equipos = pantalla("frm", "equipos");       // camisetas de los clubes y clásicos
  static inventario = pantalla("frm", "inventario"); // las camisetas que compró cada uno
  static cuenta = pantalla("frm", "cuenta");         // Mi cuenta (la pantalla pide sesión)   // pedir el mail y cambiar la clave con el link

  // Las de siempre, ahora bajo /frm (se dejan los atajos viejos)
  static panel = pantalla("frm", "panel");
  static rangos = pantalla("frm", "rangos");
  static actualizaciones = pantalla("frm", "actualizaciones");
  static usuarios = pantalla("frm", "usuarios");
}

module.exports = VistasController;
