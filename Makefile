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

# Format whole project
format:
# https://github.com/google/gts
	npx gts fix

# look for formatting errors
lint:
	npx gts lint

# Compile the code, and start the bot with a profiler running.
profile: build
	npx 0x -o --output-dir profile_results.0x ./target/core/main.js

# Build a docker container (requires dev deps)
docker-build: build
	docker build . -t turingbot

# Start a pre-existing docker container in daemon mode
docker-start:
	docker run --rm -d turingbot turingbot

# Make a bot docker container and start it in daemon mode
docker-run: docker-build
	make docker-start

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
	docker run --rm -d -p 8080:80 --name turingdocs turingdocs