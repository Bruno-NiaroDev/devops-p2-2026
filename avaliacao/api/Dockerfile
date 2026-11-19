FROM node:20-alpine

WORKDIR /app

# Dependencias primeiro para aproveitar o cache de camadas
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY server.js ./

ENV PORT=3000
EXPOSE 3000

USER node

CMD ["node", "server.js"]
