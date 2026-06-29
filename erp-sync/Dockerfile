FROM node:20-alpine AS base
WORKDIR /app

# Instalar dependencias (incluyendo devDeps para tsx/TypeScript)
COPY package*.json ./
RUN npm ci

# Copiar código fuente y migraciones
COPY tsconfig.json ./
COPY src/ ./src/
COPY migrations/ ./migrations/

EXPOSE 3001

CMD ["npm", "start"]
