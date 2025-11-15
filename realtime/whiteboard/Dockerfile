
FROM node:20-alpine

WORKDIR /app

COPY package*.json .
RUN npm install

# Copy any files/folders 
COPY . . 

# The port whiteboard_server listens on (8081)
EXPOSE 8081

CMD [ "node", "whiteboard_server.js" ]