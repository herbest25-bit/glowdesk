FROM node:20-slim

RUN apt-get update -y && apt-get install -y --no-install-recommends \
    git python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN printf '[url "https://github.com/"]\n\tinsteadOf = git+ssh://git@github.com/\n\tinsteadOf = ssh://git@github.com/\n' > /root/.gitconfig \
 && npm install --production

COPY src ./src

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s \
  CMD node -e "require('http').get('http://localhost:3001/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/index.js"]
