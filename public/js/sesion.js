// La sesión de Ñandutí Web, compartida por todas las pantallas.
//
// El token se guarda en localStorage y se manda en cada pedido a /api.
// El rango sale de la tabla de rangos: el que tiene un rango de admin ve el panel.

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

  esOwner() {
    const u = Sesion.usuario();
    return Boolean(u && u.owner);
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

  // Dibuja el sector de la derecha: entrar/registrarse, o el botón del usuario con su menú
  // (Mi cuenta, el panel si es admin, cerrar sesión).
  pintarBarra(donde) {
    const caja = typeof donde === "string" ? document.getElementById(donde) : donde;
    if (!caja) return;
    const u = Sesion.usuario();
    const esc = Sesion.escapar;

    if (!u) {
      caja.innerHTML = `
        <a class="boton fantasma" href="/frm/login/">Iniciar sesión</a>
        <a class="boton principal" href="/frm/registro/">Crear cuenta</a>`;
      return;
    }

    const icono = {
      cuenta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
      clave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
      panel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>',
      inicio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/></svg>',
      salir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>',
      config: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
      flecha: '<svg class="flecha" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    };

    caja.innerHTML = `
      <div class="menu-usuario">
        <button type="button" id="botonUsuario" aria-haspopup="menu" aria-expanded="false" title="Tu cuenta">
          <span class="avatar">${esc(Sesion.inicial(u.nick))}</span>
          <span class="nick-barra">${esc(u.nick)}</span>
          ${icono.flecha}
        </button>
        <div class="menu-desplegable" id="menuUsuario" role="menu" hidden>
          <div class="quien">
            <b>${esc(u.nick)}</b>
            ${u.rango ? `<span class="rango-chip">${esc(u.rango)}</span>` : "<span>Jugador</span>"}
          </div>
          <a role="menuitem" href="/">${icono.inicio} Inicio</a>
          <a role="menuitem" href="/frm/cuenta/">${icono.cuenta} Mi cuenta</a>
          <a role="menuitem" href="/frm/cuenta/#seguridad">${icono.clave} Cambiar contraseña</a>
          ${u.admin ? `<a role="menuitem" href="/frm/panel/">${icono.panel} Panel de administración</a>` : ""}
          ${u.configura ? `<a role="menuitem" href="/frm/config/">${icono.config} Configuración de salas</a>` : ""}
          <div class="linea"></div>
          <button type="button" role="menuitem" class="peligro" id="salir">${icono.salir} Cerrar sesión</button>
        </div>
      </div>`;

    const boton = caja.querySelector("#botonUsuario");
    const menu = caja.querySelector("#menuUsuario");
    const abrir = (si) => { menu.hidden = !si; boton.setAttribute("aria-expanded", String(si)); };
    boton.onclick = (e) => { e.stopPropagation(); abrir(menu.hidden); };
    document.addEventListener("click", (e) => { if (!menu.hidden && !menu.contains(e.target)) abrir(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) { abrir(false); boton.focus(); } });
    caja.querySelector("#salir").onclick = Sesion.cerrar;
  },

  // La letra del avatar: la primera letra o número del nick (los nicks traen símbolos raros)
  inicial(nick) {
    const letra = String(nick || "").match(/[\p{L}\p{N}]/u);
    return letra ? letra[0] : "?";
  },

  // Para las pantallas que son solo de admins
  exigirAdmin() {
    const u = Sesion.usuario();
    if (!u) { location.href = "/frm/login/?volver=" + encodeURIComponent(location.pathname); return false; }
    if (!u.admin) { location.href = "/?sinpermiso=1"; return false; }
    return true;
  },

  // Para las pantallas que son solo del OWNER (la API igual lo vuelve a revisar)
  exigirOwner() {
    const u = Sesion.usuario();
    if (!u) { location.href = "/frm/login/?volver=" + encodeURIComponent(location.pathname); return false; }
    if (!u.owner) { location.href = "/?sinpermiso=1"; return false; }
    return true;
  },

  // Configuración de salas: OWNER, CO-OWNER, HOSTER y AYUDANTE (la API igual lo vuelve a revisar)
  exigirConfig() {
    const u = Sesion.usuario();
    if (!u) { location.href = "/frm/login/?volver=" + encodeURIComponent(location.pathname); return false; }
    if (!u.configura) { location.href = "/?sinpermiso=1"; return false; }
    return true;
  },

  // La barra de secciones del panel. Cada una aparece según lo que puede hacer el rango.
  // activo: "salas" | "config" | "rangos" | "usuarios" | "actualizaciones"
  pintarNavAdmin(activo) {
    const u = Sesion.usuario() || {};
    const i = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
    const secciones = [
      { id: "salas", href: "/frm/panel/", nombre: "Salas", ver: u.admin, icono: i('<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M12 4v14M3 11h18"/>') },
      { id: "config", href: "/frm/config/", nombre: "Configuración", ver: u.configura, icono: i('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>') },
      { id: "rangos", href: "/frm/rangos/", nombre: "Rangos", ver: u.admin, icono: i('<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>') },
      { id: "usuarios", href: "/frm/usuarios/", nombre: "Usuarios", ver: u.owner, icono: i('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>') },
      { id: "actualizaciones", href: "/frm/actualizaciones/", nombre: "Actualizaciones", ver: u.admin, icono: i('<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>') },
    ];
    let nav = document.querySelector(".admin-nav");
    if (!nav) {
      nav = document.createElement("nav");
      nav.className = "admin-nav";
      nav.setAttribute("aria-label", "Secciones del panel");
      const barra = document.querySelector(".barra");
      if (barra) barra.after(nav); else document.body.prepend(nav);
    }
    nav.innerHTML = secciones
      .filter((s) => s.ver)
      .map((s) => `<a href="${s.href}" class="${s.id === activo ? "activo" : ""}"${s.id === activo ? ' aria-current="page"' : ""}>${s.icono}${s.nombre}</a>`)
      .join("");
  },

  escapar(t) {
    return String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  },
};

window.Sesion = Sesion;
