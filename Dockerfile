FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive \
    BUN_INSTALL=/root/.bun \
    PATH="/root/.bun/bin:${PATH}"

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      git \
      python3 \
      unzip \
      build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://bun.sh/install | bash

WORKDIR /app

COPY package.json bun.lockb turbo.json ./
COPY apps ./apps
COPY packages ./packages
COPY docs ./docs
COPY README.md ./

RUN bun install
RUN bun run build

CMD ["bun", "run", "start"]
