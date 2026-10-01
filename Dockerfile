FROM node:22-bookworm-slim
WORKDIR /app
RUN useradd --uid 10001 --create-home --shell /usr/sbin/nologin meridian
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
ENV NITRO_PRESET=node-server
ENV HOST=0.0.0.0
ENV PORT=8080
RUN npm run build && chown -R meridian:meridian /app
USER 10001
EXPOSE 8080
CMD ["node", ".output/server/index.mjs"]
