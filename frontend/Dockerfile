# ...
FROM nginx:alpine

# ...
RUN rm /etc/nginx/conf.d/default.conf

# 1. Adds your custom configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 2. Adds all your clients' static files
COPY public /usr/share/nginx/html

# 3. Documents the internal port (matching listen 8080 in nginx.conf)
EXPOSE 8080 