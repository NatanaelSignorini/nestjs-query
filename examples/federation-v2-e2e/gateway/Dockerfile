# Gateway Service Dockerfile
# Apollo Gateway for Federation V2
# Gateway doesn't need nestjs-query packages, simple single-stage build

FROM node:24

WORKDIR /app

# Copy package files
COPY examples/federation-v2-e2e/gateway/package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY examples/federation-v2-e2e/gateway/src ./src
COPY examples/federation-v2-e2e/gateway/tsconfig.json ./
COPY examples/federation-v2-e2e/gateway/nest-cli.json ./

# Build NestJS application
RUN npm run build

# Expose port
EXPOSE 3000

# Start the service
CMD ["node", "dist/main.js"]
