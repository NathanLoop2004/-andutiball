// Lee del script la configuración de roles y de administradores, para mostrarla en el panel.

const leerLista = (texto, nombre) => {
  const m = texto.match(new RegExp(`(?:var|let|const)\\s+${nombre}\\s*=\\s*\\[([^\\]]*)\\]`));
  if (!m) return [];
  return [...m[1].matchAll(/["'`]([^"'`]+)["'`]/g)].map((x) => x[1]);
};

const leerTexto = (texto, nombre) => {
  const m = texto.match(new RegExp(`(?:var|let|const)\\s+${nombre}\\s*=\\s*["'\`]([^"'\`]*)["'\`]`));
  return m ? m[1] : "";
};

function leerRoles(script) {
  const roles = [];
  for (let i = 1; i <= 10; i++) {
    const nicks = leerLista(script, `NickNamesRol${i}`);
    const nombre = leerTexto(script, `NombreROL${i}`) || `ROL ${i}`;
    if (nicks.length) roles.push({ nombre, nicks });
  }

  // Admins fijos: ListaDeAdmins = [{ auth: "...", nicks: ["..."] }, ...]
  const admins = [];
  const bloque = script.match(/(?:var|let|const)\s+ListaDeAdmins\s*=\s*\[([\s\S]*?)\n\];/);
  if (bloque) {
    for (const entrada of bloque[1].matchAll(/\{\s*auth:\s*["']([^"']*)["'][^}]*nicks:\s*\[([^\]]*)\]/g)) {
      const nicks = [...entrada[2].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]);
      if (entrada[1] || nicks.length) admins.push({ auth: entrada[1], nicks });
    }
  }

  return {
    roles,
    admins,
    claveAdmin: leerTexto(script, "ClaveParaSerAdmin"),
    registrados: (script.match(/auth:\s*["'][^"']+["']\s*,\s*nicks:/g) || []).length,
  };
}

module.exports = { leerRoles };
