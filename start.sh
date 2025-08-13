#!/bin/bash

# Navigate to frontend directory
cd frontend

# Install dependencies with retry logic
echo "Installing dependencies..."
yarn install --network-timeout 100000 --retry 3

# Build the application
echo "Building application..."
yarn build

# Start the server with proper port binding
echo "Starting server on port $PORT..."
npx serve -s build -l $PORT -H 0.0.0.0

# If serve fails, try alternative
if [ $? -ne 0 ]; then
    echo "Serve failed, trying alternative..."
    node_modules/.bin/serve -s build -l $PORT -H 0.0.0.0
fi