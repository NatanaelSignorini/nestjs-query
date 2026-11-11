FROM node:24

WORKDIR /app

COPY examples/federation-v2-e2e/e2e-test/package*.json ./
RUN npm install --legacy-peer-deps

COPY examples/federation-v2-e2e/e2e-test/jest.config.js ./
COPY examples/federation-v2-e2e/e2e-test/tsconfig.json ./
COPY examples/federation-v2-e2e/e2e-test/e2e ./e2e

CMD ["npm", "test"]
