# Multi-stage build: one small Node image serves the API; the Vite bundle can
# be deployed independently to a static CDN for the lowest-cost setup.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY frontend/package*.json frontend/
RUN npm ci --workspace frontend --include-workspace-root --ignore-scripts
COPY frontend frontend
RUN npm run build --workspace frontend

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY backend/package*.json backend/
RUN npm ci --workspace backend --include-workspace-root --omit=dev --ignore-scripts
COPY backend backend
COPY --from=build /app/frontend/dist frontend/dist
EXPOSE 5000
CMD ["npm", "run", "start", "--workspace", "backend"]
