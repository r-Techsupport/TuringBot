# TuringBot

A scaleable Discord bot, built as a replacement for https://github.com/r-Techsupport/TechSupportBot

# TODO LIST
- [ ] Decide on git commit guidelines

**main.ts**
- [ ] L23: Reorganize the core files to utilize [typescript namespaces](https://www.typescriptlang.org/docs/handbook/namespaces.html)
- [ ] L57: Move module imports to their own function
- [ ] L92: Unregister a slash command if it is disabled, detect such changes
- [ ] L95: Only listen if there is a prefix or slash commands are enabled
- [ ] L249: Move dependency resolving to its own function
- [ ] L277: Figure out if a reply has been sent, if so use editReply() or followup() for further messages (Since reply() can only be used once)

**modules.ts**
- [ ] L83: Autocomplete docstrings
- [ ] L195: Use botConfig.editConfigOption() and add a method to enable editing of the local config for a module without specifying its absolute path (This can be imagined as this.config vs botConfig.modules["$CONFIG_NAME"])
- [ ] L209: Add dpcstrings
- [ ] L210: Have an overload for a group and an overload for the executable version of the command

**channel_logging.ts**
- [ ] L315: Indicate if a logging channel exists

**factoids.ts**
- [ ] L76: Use deferreply for all functions in case a reply takes longer than 3 seconds
- [ ] L193: Allow plaintext factoids by taking everything after the json argument
- [ ] L195: Check if a factoid already exists before adding it


**Low priority**
- [ ] Config: Only assign the config if it hasn't beens et already
- [ ] Config: Write out a large interface for the config
- [ ] Discord: Consider using [this](https://discord.com/developers/docs/interactions/application-commands#create-guild-application-command) for registering slash commands
- [ ] Main: Use promise.all to speed up module imports
- [ ] Main: Exclude subcommands if there are none
- [ ] Modules: Separate help message and usage strings
- [ ] Channel logging: Add a max buffer size, this behavior can be implemented by over-writing data and shoving the read cursor forwards.
- [ ] Factoid_validation: Fill stuff out
- [ ] Factoid_validation: Look into supporting [link buttons](https://discord.com/developers/docs/interactions/message-components)
- [ ] Factoids: Implement an LRU cache
- [ ] 
