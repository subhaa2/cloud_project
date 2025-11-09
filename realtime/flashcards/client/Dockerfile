# Use lightweight Node image
FROM node:18-alpine AS runtime

# Set working directory
WORKDIR /app

# Copy HTML + JS files into container
COPY . .

# Install static file server
RUN npm install -g serve

# Expose port 8080 for Cloud Run
EXPOSE 8080

# Serve static files
CMD ["serve", "-s", ".", "-l", "8080"]
