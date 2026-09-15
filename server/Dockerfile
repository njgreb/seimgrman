# Built from the repo root (see railway.json) so the server can share src/score.ts with the game.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY server/package.json server/package-lock.json server/
RUN npm ci --prefix server --omit=dev
COPY server/*.ts server/
COPY src/score.ts src/config.ts src/
WORKDIR /app/server
CMD ["node", "index.ts"]
