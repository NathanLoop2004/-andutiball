// Prueba que los rangos los mande la TABLA y que se vuelvan a aplicar cada pocos segundos.
//
//   npm run prueba-rangos
//
// Lo que se quiere evitar: que alguien se meta javascript en la página, se ponga admin a
// mano (room.setPlayerAdmin) y se quede así. Con la revisión cada 5 segundos, la sala
// vuelve a dejar a cada uno como dice la tabla.

const { abrirSala } = require("./sala-falsa");
const { hayBase, base, cerrarBase } = require("../services/ConexionBase");

const problemas = [];
function revisar(titulo, condicion, detalle) {
  console.log((condicion ? "  ✅ " : "  ❌ ") + titulo + (detalle ? "  (" + detalle + ")" : ""));
  if (!condicion) problemas.push(titulo);
}

(async () => {
  console.log("🎖️  Los rangos en la sala:\n");

  const sala = abrirSala("hosts/3v3.json");
  const { contexto, avanzar, entra } = sala;

  // Así se los manda el launcher, leídos de la tabla `rangos`
  contexto.__rangosDeLaBase([
    { nombre: "👑 OWNER", admin: true, nicks: ["JINDER"] },
    { nombre: "🧉 COLABORADOR", admin: false, nicks: ["Ayudante"] },
  ]);

  const dueño = entra(1, "JINDER");
  avanzar(700);
  const colaborador = entra(2, "Ayudante");
  avanzar(700);
  const cualquiera = entra(3, "Random");
  avanzar(2000);

  revisar("Al del rango con admin se le da admin", dueño.admin === true, "admin=" + dueño.admin);
  revisar("Al rango sin admin no", colaborador.admin === false, "admin=" + colaborador.admin);
  revisar("Al que no está en la tabla tampoco", cualquiera.admin === false, "admin=" + cualquiera.admin);
  revisar("Y se lo saluda con su rango", sala.anuncios.some((a) => a.includes("👑 OWNER") && a.includes("JINDER")), "sí");

  // ── La clave vieja (!axeso5) ya no da admin: el admin sale solo de la tabla ──
  console.log("\n🔑 La clave vieja para ser admin:\n");
  sala.chat(cualquiera, "!axeso5");
  revisar("Escribir !axeso5 no da admin, ni por un segundo", cualquiera.admin === false, "admin=" + cualquiera.admin);
  avanzar(6000);
  sala.chat(cualquiera, "hola !axeso5 jaja");
  revisar("Tampoco escondida adentro de un mensaje", cualquiera.admin === false, "admin=" + cualquiera.admin);
  revisar("La clave no está en la configuración", contexto.ClaveParaSerAdmin === null, String(contexto.ClaveParaSerAdmin));
  if (typeof contexto.llamarAdmins === "function") {
    const antes = (sala.webhooks || []).length;
    contexto.llamarAdmins("Random", "prueba");
    const enviados = JSON.stringify((sala.webhooks || []).slice(antes));
    revisar("El aviso de llamar admins no manda ninguna clave", !/CLAVE PARA SER ADMIN|axeso5/i.test(enviados), "sin clave");
  }

  // ── La inyección: alguien se pone admin a mano ──
  console.log("\n💉 Alguien se mete javascript y se pone admin:\n");
  sala.room.setPlayerAdmin(cualquiera.id, true);
  revisar("En el momento queda admin (la inyección funcionó)", cualquiera.admin === true);

  avanzar(6000);   // la ronda corre cada 5 segundos
  revisar("A los 5 segundos la tabla se lo saca", cualquiera.admin === false, "admin=" + cualquiera.admin);

  // Y al revés: le sacan el admin al dueño
  sala.room.setPlayerAdmin(dueño.id, false);
  avanzar(6000);
  revisar("Si le sacan el admin al OWNER, se lo devuelve", dueño.admin === true, "admin=" + dueño.admin);

  // ── La tabla manda: se le saca el rango y se le cae el admin ──
  console.log("\n🔄 Se cambia la tabla:\n");
  contexto.__rangosDeLaBase([{ nombre: "👑 OWNER", admin: true, nicks: ["OtroDistinto"] }]);
  avanzar(1000);
  revisar("Al que le sacaron el rango, se le cae el admin", dueño.admin === false, "admin=" + dueño.admin);

  contexto.__rangosDeLaBase([{ nombre: "👑 OWNER", admin: true, nicks: ["JINDER"] }]);
  avanzar(1000);
  revisar("Y si se lo devuelven, vuelve a tenerlo", dueño.admin === true, "admin=" + dueño.admin);

  // ── Sin lista no se toca a nadie (la base apagada no puede dejar la sala sin admins) ──
  console.log("\n🛟 Con la base apagada:\n");
  sala.room.setPlayerAdmin(dueño.id, true);
  contexto.__rangosDeLaBase([]);
  avanzar(6000);
  revisar("Sin rangos que aplicar, no le saca el admin a nadie", dueño.admin === true, "admin=" + dueño.admin);

  // ── La tabla de verdad ──
  console.log("\n🗄️  La tabla `rangos`:\n");
  if (!(await hayBase())) {
    console.log("  ⏭️  La base no está levantada, salteamos. 👉 npm run base\n");
  } else {
    const RangoModel = require("../models/RangoModel");
    const { rangos, desde } = await RangoModel.paraLaSala();
    revisar("Los rangos salen de la base", desde === "base" && rangos.length > 0, rangos.length + " rangos desde " + desde);
    revisar("Cada uno trae nombre, admin y nicks", rangos.every((r) => typeof r.nombre === "string" && typeof r.admin === "boolean" && Array.isArray(r.nicks)));

    const owner = await RangoModel.deNick("JINDER");
    revisar("JINDER es OWNER en la base", Boolean(owner) && owner.admin === true, owner ? owner.nombre : "sin rango");

    const UsuarioModel = require("../models/UsuarioModel");
    const entra = await UsuarioModel.verificar({ nick: "JINDER", clave: "Borjaelias2004" });
    revisar("Y entra con su clave", entra.ok === true, entra.motivo || "ok");

    const sinRango = await RangoModel.deNick("NadieDeNadie" + Date.now());
    revisar("Un nick que no está no tiene rango", sinRango === null);
  }
  await cerrarBase().catch(() => {});

  console.log("");
  if (problemas.length) {
    console.log("❌ Falló: " + problemas.join(" | "));
    process.exit(1);
  }
  console.log("✅ Rangos OK: manda la tabla y cualquier admin puesto a mano se cae en la próxima ronda");
})();
