# https://nodejs.org/en/docs/guides/nodejs-docker-webapp
# Defining what image we want to build from https://hub.docker.com/_/node
FROM node:20

# Create a directory for everything to be installed, this is the container working dir for future commands
WORKDIR /usr/src/turingbot

COPY package*.json .

# Install dependancies
RUN npm install --no-audit --omit=dev

# Copy code over
# COPY config.jsonc ./
COPY Makefile ./
COPY target/ ./target/



# Run it without compiling
CMD ["make", "prod-run"]