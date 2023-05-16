# Install NPM packages
prep:
	npm i

# Start the bot without typechecking, outside of docker
start:
	npx tsc
	node --enable-source-maps ./target/core/main.js 

# Build a docker container
build:
	docker build . -t arc/turingbot

# Start a pre-existing docker container in daemon mode
dstart:
	docker run -d arc/turingbot

# Make a docker container and start it in daemon mode
drun:
	docker build . -t arc/turingbot
	docker run -d arc/turingbot

# Format whole project
format:
	npx prettier -w .

# Check formatting for the whole project
check-formatting:
	npx prettier -c .