# frontend/Dockerfile

# - TEMPORARILY Commented out completely ---
# FROM node:18-alpine as build
# WORKDIR /app
# COPY package*.json ./
# RUN npm install
# COPY . .
# RUN npm run build

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
