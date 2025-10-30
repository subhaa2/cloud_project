"""
This file is for the main APIs:
    1. auth
    2. storage
    3. logic
    4. DB access
"

# backend/Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
