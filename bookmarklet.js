// Bookmarklet para copiar el token de HaxBall con un clic.
// Vos resolvés el captcha; esto solo copia el token que ya apareció en la página.
//
// CÓMO INSTALARLO (una sola vez):
//   1. En el navegador: Ctrl+Shift+O (Chrome/Edge) para abrir los marcadores.
//   2. Agregar un marcador nuevo, nombre: "Copiar token HaxBall".
//   3. En la URL, pegar la línea larga que está abajo (la que empieza con javascript:).
//
// CÓMO USARLO:
//   1. Corré "npm run tokens" (abre la página del token).
//   2. Resolvé el captcha.
//   3. Clic en el marcador "Copiar token HaxBall" -> el token queda copiado.
//   4. La terminal lo detecta sola y sigue con la sala siguiente.

// ── Versión legible ──
(() => {
  const token = (document.body.innerText.match(/thr1\.[A-Za-z0-9_\-.]+/) || [])[0];
  if (!token) return alert("Todavía no aparece el token. Resolvé el captcha primero.");
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(token);
    } catch {
      // Respaldo para cuando el navegador no permite el portapapeles desde un marcador
      const ta = document.createElement("textarea");
      ta.value = token;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    alert("Token copiado ✅\n\n" + token);
  };
  copiar();
})();

/* ── Línea para pegar en la URL del marcador ──

javascript:(()=>{const t=(document.body.innerText.match(/thr1\.[A-Za-z0-9_\-.]+/)||[])[0];if(!t)return alert("Todavía no aparece el token. Resolvé el captcha primero.");const f=()=>{const a=document.createElement("textarea");a.value=t;document.body.appendChild(a);a.select();document.execCommand("copy");a.remove();alert("Token copiado ✅\n\n"+t)};navigator.clipboard?navigator.clipboard.writeText(t).then(()=>alert("Token copiado ✅\n\n"+t),f):f()})();

*/
