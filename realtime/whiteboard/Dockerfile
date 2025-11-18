FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

# Copy any files/folders 
COPY . . 

# The port whiteboard_server listens on (Cloud Run sets PORT env var)
EXPOSE 8081

CMD [ "npm", "start" ]