# Imagen oficial de Puppeteer: trae Chrome y sus dependencias.
# Mantener la versión igual a la de puppeteer en package-lock.json.
FROM ghcr.io/puppeteer/puppeteer:23.11.1

# Chrome ya viene en la imagen, no volver a descargarlo
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    NODE_ENV=production

WORKDIR /home/pptruser/app

COPY --chown=pptruser:pptruser package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=pptruser:pptruser launcher.js script.js ./
COPY --chown=pptruser:pptruser hosts ./hosts

CMD ["node", "launcher.js"]
