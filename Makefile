# https://stackoverflow.com/questions/3931741/why-does-make-think-the-target-is-up-to-date
.PHONY: docs

# Install NPM packages
prep:
	npm i

# Start the bot without typechecking, outside of docker
start:
	npx tsc --build --verbose
	node --enable-source-maps ./target/core/main.js 

# Compile the code, and start the bot with a profiler running.
profile:
	npx tsc
	npx 0x -o --output-dir profile_results.0x ./target/core/main.js

# Generate jsdoc documentation (https://github.com/ankitskvmdam/clean-jsdoc-theme-example)
docs:
	npx jsdoc --configure jsdoc.json --verbose

# Build JSDOC documentation, create an nginx docker container, and start the docker container
# (on port 8080)
docker-docs: docs
	docker build -t turingdocs .
	docker run -d -p 8080:80 --name turingdocs turingdocs


# Build a docker container us
docker-build:
	docker build . -t turingbot

# Start a pre-existing docker container in daemon mode
docker-start:
	docker run -d turingbot turingbot

# Make a bot docker container and start it in daemon mode
docker-run: docker-build
	make docker-start

# Format whole project
format:
	npx prettier -w .

# Check formatting for the whole project
check-formatting:
	npx prettier -c .