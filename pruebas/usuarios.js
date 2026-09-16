// Prueba las claves de los usuarios, de las dos puntas:
//
//   · lib/claves.js + models/UsuarioModel.js  (la base, si está levantada)
//   · el bloque 🔐 USUARIOS del script         (la sala, siempre)
//
//   npm run prueba-usuarios
//
// El puente con el launcher se falsea: en la sala de mentira contestamos nosotros lo que
// contestaría Node después de mirar la base.

const claves = require("../lib/claves");
const { abrirSala } = require("./sala-falsa");
const { hayBase, base, cerrarBase } = require("../services/ConexionBase");

const problemas = [];
function revisar(titulo, condicion, detalle) {
  console.log((condicion ? "  ✅ " : "  ❌ ") + titulo + (detalle ? "  (" + detalle + ")" : ""));
  if (!condicion) problemas.push(titulo);
}

(async () => {
  // ── 1) Las claves ──
  console.log("🔐 Las claves:\n");
  const hash = claves.hashear("miClave123");
  revisar("La clave se guarda hasheada, nunca tal cual", hash.startsWith("scrypt$") && !hash.includes("miClave123"), hash.slice(0, 24) + "…");
  revisar("Dos veces la misma clave dan hashes distintos", claves.hashear("miClave123") !== hash, "con sal");
  revisar("La clave correcta entra", claves.verificar("miClave123", hash));
  revisar("Una equivocada no", !claves.verificar("miClave124", hash));
  revisar("Un hash roto no rompe nada", !claves.verificar("x", "cualquier cosa"));
  let corta = false;
  try { claves.hashear("ab"); } catch { corta = true; }
  revisar("Una clave muy corta se rechaza", corta);

  // ── 2) La sala ──
  console.log("\n🏟️  En la sala:\n");
  const sala = abrirSala("hosts/3v3.json");
  const { contexto, avanzar, entra, equipos, chat, anuncios } = sala;

  // El launcher deja la lista de nombres registrados
  contexto.__usuariosActualizar(["Registrado"]);

  const desconocido = entra(1, "Anonimo");
  avanzar(700);
  const registrado = entra(2, "Registrado");
  avanzar(3000);

  const dijo = (texto, id) => anuncios.some((a) => a.includes(texto));
  revisar("Al registrado se le pide la clave", dijo("está registrado. Poné tu clave"), "sí");
  revisar("Y queda mirando de afuera", registrado.team === 0 && contexto.tieneRangoSinVerificar(registrado) === true, "equipo " + registrado.team);
  revisar("Al que no tiene usuario no se le pide nada", contexto.tieneRangoSinVerificar(desconocido) === false);

  // Si el bot lo quiere meter a la cancha, lo saca de vuelta
  sala.room.setPlayerTeam(registrado.id, 1);
  sala.disparar("onPlayerTeamChange", registrado);
  revisar("No entra a la cancha hasta poner la clave", registrado.team === 0, "equipo " + registrado.team);

  // El pedido viaja por la cola, como al launcher
  const cola = () => contexto.__panelCola || [];
  contexto.__panelCola = [];
  chat(registrado, "!clave hola1234");
  const pedido = cola().find((e) => e.tipo === "usuario");
  revisar("!clave le pregunta a la base", Boolean(pedido) && pedido.accion === "verificar" && pedido.clave === "hola1234", pedido ? pedido.accion : "no preguntó");
  revisar("La clave no sale en el chat de la sala", !anuncios.some((a) => a.includes("hola1234")), "no se filtró");

  // Contestamos que la clave está mal
  contexto.__usuarioRespuesta({ id: registrado.id, accion: "verificar", ok: false, motivo: "clave-mal" });
  revisar("Con la clave equivocada avisa y sigue afuera", dijo("Esa no es la clave") && contexto.tieneRangoSinVerificar(registrado), "sigue afuera");

  // Y ahora que está bien
  contexto.__usuarioRespuesta({ id: registrado.id, accion: "verificar", ok: true });
  avanzar(1000);
  revisar("Con la clave correcta ya puede jugar", contexto.tieneRangoSinVerificar(registrado) === false, "adentro");

  // El que no tiene usuario se registra
  contexto.__panelCola = [];
  chat(desconocido, "!registrar miclave99");
  const alta = cola().find((e) => e.tipo === "usuario");
  revisar("!registrar manda el alta a la base", Boolean(alta) && alta.accion === "registrar" && alta.nick === "Anonimo", alta ? alta.accion : "no mandó");
  contexto.__usuarioRespuesta({ id: desconocido.id, accion: "registrar", ok: true });
  revisar("Le avisa que quedó guardado", dijo("tu nombre quedó guardado"), "sí");

  // ── 3) El aviso cada 2 minutos ──
  console.log("\n📝 El aviso para registrarse:\n");
  const sala2 = abrirSala("hosts/3v3.json");
  sala2.contexto.__usuariosActualizar([]);
  sala2.entra(1, "SinUsuario");
  const avisos = () => sala2.anuncios.filter((a) => a.includes("!registrar tu-contraseña")).length;
  const antes = avisos();
  sala2.avanzar(2 * 60 * 1000 + 2000);
  revisar("A los 2 minutos lo invita a registrarse", avisos() - antes === 1, avisos() - antes + " avisos");
  sala2.avanzar(4 * 60 * 1000);
  revisar("Y sigue cada 2 minutos", avisos() - antes === 3, avisos() - antes + " avisos en 6 minutos");

  // ── 4) La base de verdad ──
  console.log("\n🗄️  Contra la base:\n");
  if (!(await hayBase())) {
    console.log("  ⏭️  No está levantada, salteamos. 👉 npm run base\n");
  } else {
    const UsuarioModel = require("../models/UsuarioModel");
    const nick = "Prueba" + Date.now();
    try {
      const alta = await UsuarioModel.registrar({ nick, clave: "clave1234", auth: "auth-" + nick });
      revisar("Se registra el usuario", alta.nick === nick && alta.registrado === true, "id " + alta.id);
      revisar("La ficha nunca trae el hash", !("clave" in alta), Object.keys(alta).join(",").slice(0, 60));

      revisar("Entra con su clave", (await UsuarioModel.verificar({ nick, clave: "clave1234" })).ok === true);
      const mal = await UsuarioModel.verificar({ nick, clave: "otra" });
      revisar("Con otra clave no entra", mal.ok === false && mal.motivo === "clave-mal", mal.motivo);

      const nuevos = await UsuarioModel.nicksRegistrados();
      revisar("Aparece en la lista de registrados", nuevos.includes(nick), nuevos.length + " registrados");

      let repetido = false;
      try { await UsuarioModel.registrar({ nick, clave: "otra1234" }); } catch { repetido = true; }
      revisar("Nadie le puede robar el nombre", repetido, "ese nombre ya tiene clave");

      await UsuarioModel.cambiarClave({ nick, claveVieja: "clave1234", claveNueva: "nueva1234" });
      revisar("Puede cambiar su clave", (await UsuarioModel.verificar({ nick, clave: "nueva1234" })).ok === true);

      await base().usuario.delete({ where: { nick } });
    } catch (error) {
      revisar("La base contesta", false, error.message.split("\n")[0]);
    }
  }
  await cerrarBase().catch(() => {});

  console.log("");
  if (problemas.length) {
    console.log("❌ Falló: " + problemas.join(" | "));
    process.exit(1);
  }
  console.log("✅ Usuarios OK: al registrado se le pide la clave, al que no lo está se lo invita");
})();
