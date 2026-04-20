FROM node:20

# Force git to use HTTPS instead of SSH — Railway has no SSH keys
RUN git config --global url."https://github.com/".insteadOf git+ssh://git@github.com/ && \
    git config --global url."https://github.com/".insteadOf ssh://git@github.com/ && \
    git config --global url."https://github.com/".insteadOf git://github.com/

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY src ./src

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s \
  CMD node -e "require('http').get('http://localhost:3001/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/index.js"]
