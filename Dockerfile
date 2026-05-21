FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN node_modules/.bin/next build && cp -r .next/static .next/standalone/.next/static

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/standalone/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
