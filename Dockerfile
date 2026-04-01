FROM node:22-alpine

# Install required OS dependencies
RUN apk add --no-cache openssl

EXPOSE 3000
WORKDIR /app
COPY . .

RUN npm install
RUN npm run build

# Copy your custom start script into the container
COPY start.sh ./
RUN chmod +x ./start.sh

# Start the app via your script
CMD ["./start.sh"]
