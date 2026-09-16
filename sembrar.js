// Deja la base lista para usar: los rangos y el usuario dueño del host.
//
//   npm run base:sembrar
//   npm run base:sembrar -- --usuario JINDER --clave miClave --rango "OWNER"
//
// Es idempotente: si los rangos ya están, no los duplica; si el usuario ya existe, solo
// le acomoda el rango (y le cambia la clave si se la pasan).

const RangoModel = require("./models/RangoModel");
const UsuarioModel = require("./models/UsuarioModel");
const { base, cerrarBase, entornoActivo } = require("./services/ConexionBase");
const claves = require("./lib/claves");

const args = process.argv.slice(2);
const bandera = (nombre, porDefecto) => {
  const i = args.indexOf(nombre);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : porDefecto;
};

const NICK = bandera("--usuario", "JINDER");
const CLAVE = bandera("--clave", "Borjaelias2004");
const RANGO = bandera("--rango", "OWNER");

(async () => {
  console.log(`🌱 Sembrando la base (${entornoActivo})\n`);

  // ── Los rangos ──
  const { sembrados, yaHabia } = await RangoModel.sembrarDesdeJson();
  console.log(sembrados ? `🎖️  Rangos copiados de roles.json: ${sembrados}` : `🎖️  Rangos: ya había ${yaHabia}, no se tocaron`);

  const rangos = await RangoModel.listar();
  // El rango pedido puede venir escrito a medias ("OWNER" contra "🗦👑🗧 OWNER")
  const elegido = rangos.find((r) => r.nombre.toLowerCase().includes(String(RANGO).toLowerCase()));
  if (!elegido) {
    console.error(`\n❌ No hay ningún rango que se parezca a "${RANGO}".`);
    console.error(`   Hay: ${rangos.map((r) => r.nombre).join(" · ")}\n`);
    process.exitCode = 1;
    return;
  }

  // ── El usuario ──
  const existente = await UsuarioModel.buscarPorNick(NICK);
  if (!existente) {
    await UsuarioModel.registrar({ nick: NICK, clave: CLAVE });
    console.log(`👤 Usuario creado: ${NICK}`);
  } else if (!existente.clave) {
    await UsuarioModel.registrar({ nick: NICK, clave: CLAVE });
    console.log(`👤 ${NICK} ya estaba, se le puso la clave`);
  } else {
    await base().usuario.update({ where: { nick: NICK }, data: { clave: claves.hashear(CLAVE), claveCambiada: new Date() } });
    console.log(`👤 ${NICK} ya estaba: se le actualizó la clave`);
  }

  // ── El rango del usuario ──
  await RangoModel.asignarNick({ nombreRango: elegido.nombre, nick: NICK });
  const usuario = await UsuarioModel.buscarPorNick(NICK);
  await base().usuario.update({ where: { id: usuario.id }, data: { rangoId: elegido.id } });

  const puesto = await RangoModel.deNick(NICK);
  console.log(`🎖️  ${NICK} ahora es ${puesto.nombre}${puesto.admin ? " (con admin)" : ""}`);

  console.log(`\n✅ Listo. ${NICK} entra a la sala con !clave y a la web con su usuario.`);
})()
  .catch((error) => {
    console.error("❌ " + error.message);
    process.exitCode = 1;
  })
  .finally(() => cerrarBase().catch(() => {}));
