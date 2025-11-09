# Use a lightweight Node image
# Use lightweight Node
FROM node:18-alpine

# Set work directory
WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY src ./src

# Expose app port
EXPOSE 8080

# Start server
CMD ["npm", "start"]
