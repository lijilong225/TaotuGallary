FROM node:22-alpine

RUN apk add --no-cache libarchive-tools ffmpeg

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

COPY . .

ENV NODE_ENV=production
ENV PORT=8080
ENV GALLERY_ROOT=/gallery

EXPOSE 8080

VOLUME ["/gallery"]

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/ping',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "src/server.js"]