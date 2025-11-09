FROM node:20-alpine AS development-dependencies-env
RUN npm install -g pnpm
COPY . /app
WORKDIR /app
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS production-dependencies-env
RUN npm install -g pnpm
COPY ./package.json pnpm-lock.yaml /app/
WORKDIR /app
RUN pnpm install --frozen-lockfile --prod

FROM node:20-alpine AS build-env
RUN npm install -g pnpm
COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
RUN pnpm prisma generate
RUN pnpm run build

FROM node:20-alpine
RUN npm install -g pnpm
COPY ./package.json pnpm-lock.yaml /app/
COPY ./prisma /app/prisma
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
WORKDIR /app
RUN pnpm install
RUN pnpm prisma generate
EXPOSE 8080
CMD ["sh", "-c", "pnpm prisma db push && pnpm run start"]
