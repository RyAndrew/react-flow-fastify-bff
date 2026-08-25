FROM node:24-trixie-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node . .

USER node

EXPOSE 3301

CMD ["node", "index.js"]
