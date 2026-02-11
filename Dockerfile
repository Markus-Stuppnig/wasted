FROM node:latest

WORKDIR /app

RUN npm install -g @expo/ngrok

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 8081

CMD ["npx", "expo", "start", "--tunnel"]
