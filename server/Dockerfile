# Debian slim rather than Alpine: bcrypt ships prebuilt binaries for glibc, so
# this avoids a native compile toolchain in the image.
FROM node:20-bookworm-slim

WORKDIR /app

# Dependencies are installed in their own layer so source edits do not
# reinstall node_modules on every rebuild.
COPY package*.json ./

# - npm 11: the npm 10 bundled with node:20 can die mid-install with
#   "Exit handler never called!" while still exiting 0, leaving a half-written
#   node_modules that only fails at runtime.
# - npm ci: installs exactly the lockfile, never a drifted resolution.
# - The final `node -e` is an assertion: if any dependency did not land, the
#   BUILD fails here with a clear message rather than the container at boot.
RUN npm install -g npm@11 \
 && npm ci --no-audit --no-fund \
 && node -e "for (const m of ['express','pg','zod','bcrypt','jsonwebtoken']) require(m); console.log('dependencies verified')"

COPY . .

ENV NODE_ENV=development
EXPOSE 4000

CMD ["npm", "run", "start"]
