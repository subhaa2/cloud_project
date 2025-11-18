# Stage 1: Build Stage (Optional, but good practice for dependency installation)
FROM node:20-alpine AS build

# Set the working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
# Install dependencies, including dev dependencies for any build steps
RUN npm install

# Stage 2: Production Stage
FROM node:20-alpine AS production

# Set the working directory
WORKDIR /app

# Copy only production dependencies from the build stage
COPY --from=build /app/node_modules ./node_modules

# Copy the application source code
COPY . .

# Expose the port listens on (5000)
EXPOSE 5000

# Command to run the application
CMD [ "npm", "start" ]