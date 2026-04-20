FROM node:20-slim

RUN apt-get update && apt-get install -y \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 \
    python3 make g++ \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --production --ignore-scripts=false

COPY src ./src

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s \
  CMD node -e "require('http').get('http://localhost:3001/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/index.js"]
