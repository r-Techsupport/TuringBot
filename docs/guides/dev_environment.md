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

Run the setup workflow to install dependencies:
```
make prep
```
On Windows, you may need a makefile client. Or, you can manually copy paste commands from the makefile as needed.

# Filling out the config
Locate `config.default.jsonc`, and create a copy of it named `config.jsonc` in the same folder. 

Open the newly created config file, and copy the newly created auth token into the "authToken" key at the top of the json.

## Editing the code
VSCode is the supported editor for this project. Other editors are permitted, but VSCode is the recommended editor.
