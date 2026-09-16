# Imagen oficial de Puppeteer: trae Chrome y sus dependencias.
# Mantener la versión igual a la de puppeteer en package-lock.json.
FROM ghcr.io/puppeteer/puppeteer:23.11.1

# Chrome ya viene en la imagen, no volver a descargarlo
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    NODE_ENV=production

WORKDIR /home/pptruser/app

COPY --chown=pptruser:pptruser package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=pptruser:pptruser launcher.js app.js script.js ./
COPY --chown=pptruser:pptruser hosts ./hosts
COPY --chown=pptruser:pptruser lib ./lib
# La app: routes → controllers → models, y las pantallas en public/ (ver app.js)
COPY --chown=pptruser:pptruser routes ./routes
COPY --chown=pptruser:pptruser controllers ./controllers
COPY --chown=pptruser:pptruser models ./models
COPY --chown=pptruser:pptruser public ./public
COPY --chown=pptruser:pptruser services ./services
COPY --chown=pptruser:pptruser middlewares ./middlewares
COPY --chown=pptruser:pptruser prisma ./prisma
COPY --chown=pptruser:pptruser panel ./panel

EXPOSE 3000

CMD ["node", "launcher.js"]
