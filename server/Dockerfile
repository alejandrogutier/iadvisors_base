FROM node:20-bookworm AS base

WORKDIR /app

COPY package*.json ./

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && npm ci --omit=dev

COPY . .

ENV NODE_ENV=production

EXPOSE 5001

CMD ["npm", "run", "start"]
