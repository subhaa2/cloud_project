# Use a lightweight Node image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY src src

# Expose the port used by your app
# EXPOSE 5000
EXPOSE 8080

# Start the whiteboard service
CMD ["npm", "start"]
