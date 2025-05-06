# Etapa 1: Build da aplicação (somente a última versão da main)
FROM node:20-alpine as builder

# Instala git e clona apenas o último commit da branch main
RUN apk add --no-cache git

WORKDIR /app
RUN git clone --depth=1 https://github.com/CodyTseng/jumble.git .

RUN npm install && npm run build

# Etapa 2: Container final com Nginx e config embutida
FROM nginx:alpine

# Copia apenas os arquivos estáticos gerados
COPY --from=builder /app/dist /usr/share/nginx/html

# Embute a configuração do Nginx diretamente
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
