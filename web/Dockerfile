# Dev-oriented image: the reviewer runs `docker compose up` and gets Vite's dev
# server with hot reload. A production build would be a multi-stage
# `vite build` + static server; not needed for this submission.
FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./

# Same reasoning as server/Dockerfile: npm 11 avoids a silent mid-install crash
# in the bundled npm 10, `npm ci` pins to the lockfile, and the final check
# turns a half-written node_modules into a build failure instead of a runtime one.
RUN npm install -g npm@11 \
 && npm ci --no-audit --no-fund \
 && node -e "for (const m of ['react','react-dom','vite']) require.resolve(m); console.log('dependencies verified')"

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
