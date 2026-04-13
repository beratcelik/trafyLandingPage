FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production

COPY . .

RUN mkdir -p db

EXPOSE 80

CMD ["node", "server.js"]
