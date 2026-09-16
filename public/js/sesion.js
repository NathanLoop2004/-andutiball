// La sesión de Ñandutí Web, compartida por todas las pantallas.
//
// El token se guarda en localStorage y se manda en cada pedido a /api.
// El rango sale de roles.json: el que tiene un rango de admin ve el panel.

const Sesion = {
  LLAVE: "nanduti_sesion",

  guardar(token, usuario) {
    try { localStorage.setItem(Sesion.LLAVE, JSON.stringify({ token, usuario })); } catch (e) {}
  },

  leer() {
    try { return JSON.parse(localStorage.getItem(Sesion.LLAVE) || "null"); } catch (e) { return null; }
  },

  usuario() {
    const s = Sesion.leer();
    return s ? s.usuario : null;
  },

  esAdmin() {
    const u = Sesion.usuario();
    return Boolean(u && u.admin);
  },

  cerrar() {
    try { localStorage.removeItem(Sesion.LLAVE); } catch (e) {}
    location.href = "/";
  },

  // fetch con el token puesto
  async pedir(url, opciones = {}) {
    const s = Sesion.leer();
    const cabeceras = Object.assign({}, opciones.headers);
    if (s && s.token) cabeceras.Authorization = "Bearer " + s.token;
    if (opciones.body && !cabeceras["Content-Type"]) cabeceras["Content-Type"] = "application/json";

    const res = await fetch(url, Object.assign({}, opciones, { headers: cabeceras }));
    const datos = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(datos.error || "HTTP " + res.status);
    return datos;
  },

  // Vuelve a preguntar quién sos (por si te cambiaron el rango) y, si el token está por
  // vencer, el servidor manda uno nuevo: se guarda ese. El token dura 1 h 30.
  async refrescar() {
    const s = Sesion.leer();
    if (!s || !s.token) return null;
    try {
      const { usuario, token } = await Sesion.pedir("/api/auth/yo");
      Sesion.guardar(token || s.token, usuario);
      return usuario;
    } catch (error) {
      if (/sesión|Necesitás/i.test(error.message)) { try { localStorage.removeItem(Sesion.LLAVE); } catch (e) {} }
      return null;
    }
  },

  // Mientras la pestaña esté abierta, se pasa a buscar un token nuevo cada 20 minutos
  mantener(cada = 20 * 60 * 1000) {
    if (Sesion._reloj) clearInterval(Sesion._reloj);
    Sesion._reloj = setInterval(() => {
      Sesion.refrescar().then((usuario) => {
        if (!usuario && Sesion.leer() === null) location.href = "/frm/login/";
      });
    }, cada);
  },

  // Dibuja el sector de la derecha: entrar/registrarse, o el nombre con su menú
  pintarBarra(donde) {
    const caja = typeof donde === "string" ? document.getElementById(donde) : donde;
    if (!caja) return;
    const u = Sesion.usuario();

    if (!u) {
      caja.innerHTML = `
        <a class="boton" href="/frm/login/">Iniciar sesión</a>
        <a class="boton principal" href="/frm/registro/">Registrarte</a>`;
      return;
    }

    caja.innerHTML = `
      ${u.admin ? '<a class="boton principal" href="/frm/panel/">🎛️ Panel</a>' : ""}
      <span class="chapa">
        <b>${Sesion.escapar(u.nick)}</b>
        ${u.rango ? '<span class="rango">' + Sesion.escapar(u.rango) + "</span>" : ""}
        <button class="boton" id="salir">Salir</button>
      </span>`;
    const salir = document.getElementById("salir");
    if (salir) salir.onclick = Sesion.cerrar;
  },

  // Para las pantallas que son solo de admins
  exigirAdmin() {
    const u = Sesion.usuario();
    if (!u) { location.href = "/frm/login/?volver=" + encodeURIComponent(location.pathname); return false; }
    if (!u.admin) { location.href = "/?sinpermiso=1"; return false; }
    return true;
  },

  escapar(t) {
    return String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  },
};

window.Sesion = Sesion;
