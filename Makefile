# Install NPM packages
prep:
	npm i

# Start the bot with typechecking, but outside of docker
start:
	cp ./config.jsonc ./target/config.jsonc
	npx tsc
	cd target; \
	node ./core/main.js

# Start the bot without typechecking. Faster, but not recommended when 
# troubleshooting or starting a prod instance.
fstart:
	npx ts-node --transpileOnly ./core/main.ts

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