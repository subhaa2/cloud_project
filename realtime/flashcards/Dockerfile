# Use a lightweight Node image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY . .

# Expose the port used by your app
EXPOSE 4000

# Start the whiteboard service
CMD ["npm", "start"]
