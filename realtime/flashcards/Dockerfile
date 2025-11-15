FROM node:20-alpine

WORKDIR /app

# 1. Copies package.json from the build context root
COPY package*.json .
RUN npm install

# 2. Copies the source files from the 'src' subdirectory
COPY src . 

# The port flashcards-server listens on (5080)
EXPOSE 5080

CMD [ "node", "flashcard-server.js" ]