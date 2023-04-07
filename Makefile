

# Start the bot with typechecking, but outside of docker
start:
	npx ts-node ./core/main.ts

# Start the bot without typechecking. Faster, but not recommended when 
# troubleshooting or starting a prod instance.
fstart:
	npx ts-node --transpileOnly ./core/main.ts

# Build a docker container
build:
	docker build . -t arc/turingbot

# Start a pre-existing docker container in daemon mode
docker-start:
	docker run -d arc/turingbot

# Format whole project
format:
	npx prettier -w .

# Check formatting for the whole project
check-formatting:
	npx prettier -c .