# Step 1: Build the application
FROM node:20-alpine as builder

ARG VITE_PROXY_SERVER
ENV VITE_PROXY_SERVER=${VITE_PROXY_SERVER}

WORKDIR /app

# Copy package files first
COPY package*.json ./
RUN npm install

# Copy the source code to prevent invaliding cache whenever there is a change in the code
COPY . .
RUN npm run build

# Step 2: Final container with Nginx and embedded config
FROM nginx:alpine

# Copy only the generated static files
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
