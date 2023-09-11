# ADR 04: Adding multi-guild support for all configuration and database records

2023-09-11

Ajax

# This bot is currently incapable of being used in multiple guilds with the same instance

Currently, everything is assumed from one guild. This means that from config to stored data, every guild is treated the same.

The potential downsides to this are:
 - In the event our needs ever change, this bots lack of versatility could kill it.
 - Makes the bot harder to test with known good configuration.
 - Makes the bot less useful if anyone else ever wants to use it for their own reasons.
 - Causes a potential security problem if people get the bot to join their own server. This may be unlikely but cannot be ignored.

# Major goals for a multi-guild capable system

TS's existing multi-guild system has everything paired with a guild_id in all of the databases, and forces all of the extensions to do guild comparisons. While this is a perfectly functional system, it creates a lot of complexity when developing extensions, and it makes manually getting just what belongs to a certain guild rather challenging. 

With a multi-guild permission system, we should, in theory, be able to run the bot in unlimited guilds.
This will allow development guilds, testing guilds, social guilds, running multiple primary guilds, and the easy ability to migrate to a different guild should a need ever arise.

There are two major considerations for the multi-guild system—configuration, and data.

The only thing that needs to be considered is ensuring that everywhere that needs config or database access is either:
- Passed those items directly
- Passed a guild or a way to get a guild

As every interaction will contain a guild item, I see no major obstacles to ensuring that a guild can always be accessed.

## Config
There are two sections of config. Bot-wide config, currently served by secrets.jsonc. Even though this has a clear focus on secrets right now, if some bot-wide config that isn't secrets ever has to be made, this is where it should be served from.

Additionally, it could be possible that a different file for non-secret but still bot-wide config exists. Allowing only the owner, or specific people, to modify these config items from within Discord.

Then, there is the guild config, currently served by config.jsonc. This config should be moved into a "configs/" folder, and read from there. Inside of this, there should be the json file for all of the guild configs. An example structure may look something like this:

```
configs/
    config-1234.jsonc
    config-4254.jsonc
    config-5483.jsonc
```

However, there should still be a config.jsonc file in the root of the bot repo. This should be used as the template for which to register new guilds and apply config. This allows no change in the way the config is set up by the user, and any single server deployments will see no change in the initial setup. Additionally, this will allow migration of the config without any user interaction.

For accessing these files, there are two feasible ways:
- Moving botConfig to be a function instead of a constant. This would look something like `botConfig(guild).logging`
- Moving the guild config under botConfig.{guild_id}. This would look something like `botConfig.guild.logging`

I believe the second option is more versatile and reliable. However, it could create a large slowdown in the event the bot is in a very large number of servers.

As both of these require guild, as will any multi-guild config system, any non-guild-based configs need to be added somewhere else. Putting them in secrets, or redefining secrets, might be more confusing but would make fewer changes.

Adding another config file and putting it under botConfig.guildless, or even just accessing it directly, like botConfig.item, would work. This would increase the complexity of config but would keep secrets as just secrets and allow guildless config to be created, as it inevitably will need to be. Handling secrets, currently stored in botConfig.secrets, should be maintained this way until the secrets/guild config separation has to be rethought.

## Data

As there is nothing bot-wide stored in the database, this section is very simple.

Instead of having a hardcoded database name, which would currently be under the protocol, make a database prefix as a separate config option. Thus, a new database can be created for every guild.

Accessing the database will be barely changed. Instead of getting a db directly, you can get a selector. Then, prior to getting the collection, you use the selector function to get the right db.

For example:
```ts
const dbSelector: (arg1: string) => Db = util.mongo.fetchValue();
const db: Db = dbSelector(guildId);
const records: Collection<userRecord> = db.collection(NOTE_COLLECTION_NAME);
```

The rest of the database usage and information would be exactly the same.

# Everything else that will be impacted

## Other positives that can be reached with this:
 - Discord limits us to 5 scopeless context menu actions and five additional guild scoped context menu actions. Thus, if we create more than ten context menu options, this allows an easy way to pick what is needed for each guild, at least for the last 5. And if multiple guilds are used, it can be better customized to that specific guild.
 - If, for any reason, our needs change, and we have a demand to run more than one guild, the longer we wait to do this, the far less useful this bot will be. Our community has changed how it's operating before, and when/how it will again is an unknown.

## Impacts (or lack thereof) for other parts of the code:
 - Unit tests
    - Writing unit tests for this should only impact the db/config creation and fetching functions and not the modules themselves.
    - If everything is done simply, these are the only two where guild-specific comparisons will ever have to happen.
 - Command registration
    - Command registration can be done at a scopeless (all guilds), or a per guild basis. For the most part, everything should always be registered everywhere and can be disabled either by bot config or integration permissions on Discord's side.
    - However, if any special cases ever come up, this will allow the ability to have app commands only enabled on certain guilds. Such as, for example, dev commands are only enabled on the dev servers specified in the config somewhere.
 - Module creation
    - Module creation will be largely not impacted. Only having to remember to put a guild id in for access to config/database. With a more transparent system, there will be no need to compare to a database guild_id column anywhere.
    - And, due to the more centralized system of multi-guild, there will be no need to test multi-guild support for every module, as it's support will just be baked in.

# Consquences
This will, like literally every feature ever, increase complexity. And will require a touch more care when developing modules.

However, if done correctly, multi-guild support will barely increase complexity for the regularly maintained code of extensions, in favour for a bit of additional complexity when loading and accessing config/databases, and add a helpful feature.

# Conclusion
While I do not believe that multi-guild support is the most important change possible, I see no reason just not to do it. It can be implemented with ease and grace and could be potentially incredibly useful one day.
