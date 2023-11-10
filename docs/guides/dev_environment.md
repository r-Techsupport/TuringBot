# Setting up a development environment for TuringBot
There are several ways the bot is able to run, at varying levels of complexity. 

## Bare Metal
## Prerequisites
The following is needed to compile, build, run the bot, and interface with version control. This does not account for containerization, or cluster functionality. 
- Git
- Node (roughly version 20), as well as the node toolchain that comes with most distributions of node. (npm, npx)

### Creating a Discord bot and adding it to the server
Go to https://discord.com/developers/applications, and sign in to your Discord account if necessary.

Click on "New Application", enter a name, and click "Create".

Under the left menu, select "Bot", and then select "Add Bot"

Under the "Bot" menu, select "Reset Token", and then keep careful note of this token, you'll need it later, *do not share it*.

Turn on "Privileged Gateway Intents", and toggle on "Guild", "MessageContent", and "Guild Messages". More may be needed as the bot receives updates, add them accordingly.

To add the bot to a server, go to "OAuth2" -> "URL Generator"; Then select "bot" under "Scopes", and then toggle "Administrator". The generated link will be at the bottom of the page.



## Cloning the code and installing dependencies
Remember to make a fork of the code if you do not have write access to the `TuringBot` repository. 

Navigate to the directory where you'd like to store this project, and then clone the repository:
```
git clone https://github.com/zleyyij/TuringBot
``` 
You may need to change the URL to reflect the location of the repository you'd like to clone.

Makefile support is assumed. If you're on Windows, you may need to manually install makefile utilities. If you do not wish to use `make`, you can open the makefile and copy commands from each entry. There should be comments explaining what each makefile command does.

Run the setup workflow to install dependencies and perform other work needed for development:
```sh
make prep
```

# Filling out the config
Locate `config.default.jsonc`, and create a copy of it named `config.jsonc` in the same folder. 
Locate `secrets.default.jsonc` and create a copy of it named `secrets.jsonc` in the same folder. 

Open `secrets.jsonc` and fill the"discordAuthToken" key near the top of the page with your discord *bot* token 

If you're receiving an error where its exclaiming `Value "" is not snowflake.` The easiest fix at the moment is to open `confic.jsonc` locate "directMessageLogging" enter *your* discord ID inside of the array then set "verboseLevel" to `0` Read through the rest of the config file, and edit as you see fit.

## Editing the code
VSCode is the supported editor for this project. Other editors may be used, but VSCode is the recommended editor. The source code for the bot is stored in `src/`, with all module code stored in `src/modules`, and the heart of the bot and utilities used for development in `src/core`.

## Starting the bot
### Bare metal
The simplest way to start the bot is with `make start`. It will compile all of the typescript code in `src/` into javascript code, stored in `target/`, then run `target/core/main.js`.

### Docker
Docker engine needs to be *installed*, and *running* to deploy the bot in docker. 

You can run `make docker-start` to build the bot into a docker container, and run the docker container, mounting the config file located in the project root.

### Kubernetes
Bot infrastructure for Kubernetes is not complete, deploying to Kubernetes is not currently supported.