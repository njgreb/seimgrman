# Built from the repo root (see railway.json): stage 1 builds the game, stage 2 serves it next to the API,
# so one Railway service hosts both and the leaderboard is same-origin.
# Debian (not alpine) for the build: the TypeScript 7 native binaries don't ship for musl.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html ./
COPY src src
COPY public public
# Railway exposes the commit as a build arg; the game tags submitted scores with it.
ARG RAILWAY_GIT_COMMIT_SHA=railway
ENV VITE_BUILD_SHA=$RAILWAY_GIT_COMMIT_SHA
# 'self' means "the server that served this page"
ENV VITE_LEADERBOARD_URL=self
# vite only: `npm run build` also typechecks, and CI already does that on every push.
RUN npx vite build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY server/package.json server/package-lock.json server/
RUN npm ci --prefix server --omit=dev
COPY server/*.ts server/
COPY src/score.ts src/config.ts src/
COPY --from=build /app/dist dist
WORKDIR /app/server
CMD ["node", "index.ts"]
