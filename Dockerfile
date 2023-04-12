# https://nodejs.org/en/docs/guides/nodejs-docker-webapp
# Defining what image we want to build from https://hub.docker.com/_/node
FROM node:16

# Create a directory for everything to be installed, this is the container working dir for future commands
WORKDIR /usr/src/turing-bot

COPY package*.json ./

# Install dependancies
RUN npm install

# Copy source code over
COPY . .

# Run it
CMD ["make", "start"]