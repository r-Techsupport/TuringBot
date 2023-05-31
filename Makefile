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
	npx 0x ./target/core/main.js

# Build a docker container
dbuild:
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