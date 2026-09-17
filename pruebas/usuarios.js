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

  // El acomodo automático lo quiere meter cada 2 segundos: el cartel no tiene que salir cada vez
  const carteles = () => anuncios.filter((a) => a.includes("está registrado. Poné tu clave")).length;
  const antesDelSpam = carteles();
  for (let i = 0; i < 10; i++) {
    sala.room.setPlayerTeam(registrado.id, 1);
    sala.disparar("onPlayerTeamChange", registrado);
    avanzar(2000);
  }
  revisar("El cartel de la clave no se repite cada vez que lo sacan de la cancha", carteles() - antesDelSpam <= 1, (carteles() - antesDelSpam) + " carteles en 20 s");
  const antesDeEsperar = carteles();
  avanzar(65000);
  revisar("Pero se le vuelve a recordar al minuto", carteles() - antesDeEsperar >= 1, (carteles() - antesDeEsperar) + " en 65 s");

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

  // Las cuentas se crean en la WEB, no desde el chat
  contexto.__WEB_URL = "https://prueba.trycloudflare.com";
  contexto.__panelCola = [];
  chat(desconocido, "!registrar miclave99");
  revisar("!registrar no carga nada en la base", cola().filter((e) => e.tipo === "usuario").length === 0, "no mandó nada");
  revisar("Y manda a la página a crear la cuenta", dijo("https://prueba.trycloudflare.com/frm/registro/"), "con el link");
  revisar("La clave escrita no queda en el chat", !dijo("miclave99"), "no se filtró");

  // ── 2b) La sala automática no lo mete y lo saca sin parar ──
  // El modo automatizado del autor mete espectadores en cada tick. En HaxBall de verdad cada
  // setPlayerTeam dispara onPlayerTeamChange, y nuestro bloque lo volvía a sacar: un bucle.
  console.log("\n🔁 En la sala automática:\n");
  const sala3 = abrirSala("hosts/todos.json");
  sala3.contexto.__usuariosActualizar(["JINDER"]);
  const moverOriginal = sala3.room.setPlayerTeam;
  let movidas = 0, adentro = false, jinderId = null;
  sala3.room.setPlayerTeam = function (id, equipo) {
    const antes = sala3.room.getPlayer(id);
    const cambia = antes && antes.team !== equipo;
    const r = moverOriginal.apply(this, arguments);
    if (cambia && id === jinderId) movidas++;
    if (cambia && !adentro && sala3.room.onPlayerTeamChange) {
      adentro = true;
      try { sala3.room.onPlayerTeamChange(sala3.room.getPlayer(id), sala3.room.getPlayer(0)); } finally { adentro = false; }
    }
    return r;
  };
  sala3.entra(1, "Pibe1");
  sala3.avanzar(900);
  const jinder = sala3.entra(2, "JINDER");
  jinderId = jinder.id;
  sala3.avanzar(20000);
  revisar("Sin la clave, el acomodo automático no lo mete a la cancha", movidas === 0 && jinder.team === 0, movidas + " movidas en 20 s");
  sala3.contexto.__usuarioRespuesta({ id: jinder.id, accion: "verificar", ok: true });
  sala3.avanzar(10000);
  revisar("Con la clave puesta, lo mete a jugar", jinder.team !== 0, "equipo " + jinder.team);

  // ── 3) El aviso cada 5 minutos ──
  console.log("\n📝 El aviso para registrarse:\n");
  const sala2 = abrirSala("hosts/3v3.json");
  sala2.contexto.__usuariosActualizar([]);
  sala2.entra(1, "SinUsuario");
  sala2.contexto.__WEB_URL = "https://prueba.trycloudflare.com";
  const avisos = () => sala2.anuncios.filter((a) => a.includes("Creá tu cuenta en:")).length;
  const antes = avisos();
  sala2.avanzar(5 * 60 * 1000 + 2000);
  revisar("A los 5 minutos lo invita a registrarse en la web", avisos() - antes === 1, avisos() - antes + " avisos");
  revisar("Con el link de la página", sala2.anuncios.some((a) => a.includes("https://prueba.trycloudflare.com/frm/registro/")), "sí");
  sala2.avanzar(10 * 60 * 1000);
  revisar("Y sigue cada 5 minutos", avisos() - antes === 3, avisos() - antes + " avisos en 15 minutos");

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
