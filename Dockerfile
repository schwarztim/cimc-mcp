FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production
COPY dist/ ./dist/
EXPOSE 21488
CMD ["node", "dist/index.js"]
