# Step 1: Build the application
FROM node:20-alpine as builder

WORKDIR /app
COPY . .

RUN npm install && npm run build

# Step 2: Final container with Nginx and embedded config
FROM nginx:alpine

# Copy only the generated static files
COPY --from=builder /app/dist /usr/share/nginx/html

# Embed Nginx configuration directly
RUN printf "server {\n\
    listen 80;\n\
    server_name localhost;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    location / {\n\
        try_files \$uri \$uri/ /index.html;\n\
    }\n\
\n\
    location ~* \\.(?:js|css|woff2?|ttf|otf|eot|ico|jpg|jpeg|png|gif|svg|webp)\$ {\n\
        expires 30d;\n\
        access_log off;\n\
        add_header Cache-Control \"public\";\n\
    }\n\
\n\
    gzip on;\n\
    gzip_types text/plain application/javascript application/x-javascript text/javascript text/css application/json;\n\
    gzip_proxied any;\n\
    gzip_min_length 1024;\n\
    gzip_comp_level 6;\n\
}\n" > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
