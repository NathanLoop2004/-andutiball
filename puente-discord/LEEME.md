# Puente de Discord de ÑandutíBall

Discord pide registrar una dirección de vuelta **fija**, y el link de la web cambia. Esta página
tiene una dirección fija y reenvía al jugador al link actual de la web.

## Cómo subirla (una sola vez)

1. En GitHub: **New repository** → nombre `nanduti-discord` → **Public** → Create.
2. **Add file → Upload files** → subí el `index.html` de esta carpeta → Commit.
3. **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main` / `(root)` → Save.
4. A los 1-2 minutos queda en `https://<tu-usuario>.github.io/nanduti-discord/`.
5. En el portal de Discord → OAuth2 → **Redirects**: agregá esa dirección tal cual (con la `/` final).
6. En el `.env` de ÑandutíBall: `DISCORD_REDIRECT_URI=https://<tu-usuario>.github.io/nanduti-discord/`

Si algún día ÑandutíBall tiene dominio propio, agregalo en `DOMINIOS_PERMITIDOS` del `index.html`.
