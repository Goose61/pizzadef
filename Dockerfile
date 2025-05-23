# Use the official Node.js runtime as the base image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install ALL dependencies (including dev dependencies for build)
RUN npm ci

# Copy the rest of the application code
COPY . .

# Create public directory if it doesn't exist
RUN mkdir -p public

# Set production environment for webpack
ENV NODE_ENV=production

# Build the application
RUN npm run railway-build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Create directory for persistent data
RUN mkdir -p /app/public

# Expose the port the app runs on
EXPOSE 3000

# Define the command to run the application
CMD ["npm", "run", "railway-start"] 