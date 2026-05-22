FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production=false

COPY . .

RUN npx prisma generate --schema=./prisma/schema.prisma
RUN npm run build

EXPOSE 4012

CMD ["node", "dist/apps/clinical-physio/src/main.js"]
