FROM node:20-bookworm AS builder
WORKDIR /app

ARG SERVICE_NAME

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY package-lock.json* ./
COPY tsconfig.base.json ./
COPY libs ./libs
COPY services ./services

RUN npm install
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app

ARG SERVICE_NAME
ENV SERVICE_NAME=${SERVICE_NAME}

COPY --from=builder /app /app

CMD node services/${SERVICE_NAME}/dist/main.js
