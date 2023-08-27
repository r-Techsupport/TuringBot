# https://stackoverflow.com/questions/3931741/why-does-make-think-the-target-is-up-to-date
.PHONY: docs

# Install NPM packages
prep:
	npm i

# Build the code with tsc npx = Node Package Execute
build:
# --build is needed to use --verbose, --verbose is needed so that tsc isn't totally silent
	npx tsc --build --verbose


# Run the already compiled code
run:
	node --enable-source-maps ./target/core/main.js

# Start the bot without typechecking, outside of docker
start: build
# --enable-source-maps uses the `.map` files to make stack traces point towards the typescript files
# instead of the compiled js
	node --enable-source-maps ./target/core/main.js 

# Compile code and run unit tests https://nodejs.org/api/test.html#test-runner
test: build
	node --test ./target/tests

# Format whole project
format:
# https://github.com/google/gts
	npx prettier -w src/ && npx eslint --fix src/

# look for formatting errors
lint:
	npx gts lint

# start the bot with a profiler running.
profile: 
	npx 0x -o --output-dir profile_results.0x ./target/core/main.js

# Build a docker container (requires dev deps)
docker-build: build
	docker build . -t turingbot

# Start a pre-existing docker container in daemon mode
# This may not work on windows, try copy pasting the command directly into powershell
docker-run:
# --rm: remove the container once it finishes running
# --name: docker will randomly generate a name if not manually specified
# -d: run in daemon mode and start in the background
# --mount type=bind...: take the config file in this directory, and mount it to the equivalent directory in the docker container
# turingbot: the container to run
	docker run --rm --name turingbot -d --mount type=bind,source=$(pwd)/config.jsonc,target=/usr/src/turingbot/config.jsonc turingbot

# Make a bot docker container and start it in daemon mode
docker-start: docker-build
	make docker-run

# Generate jsdoc documentation (https://github.com/ankitskvmdam/clean-jsdoc-theme-example)
docs:
	npx jsdoc --configure jsdoc.json --verbose

# Build JSDOC documentation, create an nginx docker container, and start the docker container
# (on port 8080)
docker-docs: docs
# -t assigns the tag to turingdocs, ./docs/ indicates where the dockerfile is located
	docker build -t turingdocs ./docs/
# --rm removes the container once it's finished running,
# -d means to run in daemon mode, -p 8080:80 indicates that we want to
# take port 80 inside the container and map it to port 8080 on the outside
	docker run --rm -d -p 8080:80 turingdocs