# Use a lightweight Node image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy dependency files
# COPY package*.json ./ # [TEMPORARILY COMMENTED OUT]

# Install dependencies
# RUN npm install --production # [TEMPORARILY COMMENTED OUT]

# Copy source code
COPY . .

# Expose the port used by your app
EXPOSE 4000

# Start the whiteboard service
CMD ["npm", "start"]
