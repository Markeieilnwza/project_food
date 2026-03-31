FROM node:18-alpine

WORKDIR /app

COPY backend/package*.json ./backend/

WORKDIR /app/backend
RUN npm ci --omit=dev

WORKDIR /app
COPY backend ./backend
COPY frontend ./frontend

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "backend/server.js"]