FROM node:20-alpine

RUN apk add --no-cache python3 make g++ git

WORKDIR /app

COPY package.json ./
RUN npm install --production --prefer-online

COPY src ./src

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s \
  CMD node -e "require('http').get('http://localhost:3001/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/index.js"]
