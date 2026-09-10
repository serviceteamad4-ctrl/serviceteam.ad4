FROM node:18-alpine

WORKDIR /app

# Copy root package files
COPY package*.json ./

# Copy server package files
COPY server/package*.json ./server/

# Install root dependencies
RUN npm ci

# Install server dependencies
RUN cd server && npm ci

# Build frontend
RUN npm run build

# Set working directory to server
WORKDIR /app/server

# Expose port
EXPOSE 4001

# Start backend server
CMD ["node", "src/server.js"]
