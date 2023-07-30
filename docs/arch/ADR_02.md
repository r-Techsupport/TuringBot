# ADR 02: Dropping support for legacy commands and migrating to slash commands.

2023-07-04

Arc

# Interop between slash commands and legacy commands is hard.

As the codebase is currently set up, both slash commands and legacy commands are half supported. Neither is able to get first class support, and a lot of work went into making that even sort of functional. 

Dropping support for legacy commands entirely would enable module developers to take advantage of the rich support Discord-side for slash commands. Some obvious benefits would include functionality like options, and ephemeral replies.

I believe the attempted "dual" support for legacy commands and slash commands would only lead to a convoluted, frustrating codebase. The [ChatInputCommandInteraction](https://discord.js.org/docs#/docs/discord.js/main/class/ChatInputCommandInteraction) and [Message](https://discord.js.org/docs#/docs/discord.js/main/class/Message) objects are structured *very* differently, and so large chunks of boilerplate code is required to translate between the two. Even further, the only way to pass input to a slash command is with a [slash command option](https://discord.js.org/docs#/docs/builders/main/class/SharedSlashCommandOptions). If we try and adapt slash command options to have the same options work for *every single slash command*, the functionality of slash commands is significantly reduced. This limitation makes implementation of features like ephemeral replies impractical at best.

I could go the other way, and try to add option support to legacy commands, but *that's a lot of work*. I believe that it would turn into an unruly codebase that requires a lot of work to maintain, and is miserable to maintain.

# Work needed to migrate entirely to slash commands. 

To properly implement slash commands, very little will need to change for module development, but structures for defining and receiving arguments will need to be added.

```typescript
enum ModuleOptionType {
    // https://discord.js.org/docs#/docs/builders/main/class/SharedSlashCommandOptions
}

interface ModuleOption {
    type: ModuleOptionType;
    // needs to comply with that convoluted regex
    name: string;
    description: string;
    required?: boolean;
    choices?: APIApplicationCommandOptionChoice[];
    // when a permission system is implemented, remember to check the config for that before registering commands
}
```

To do this well, I'd also like to have some form of validation because the error messages thrown by discord.js's built in validator are vague and frustrating. 

# Consequences

This will completely shut off legacy commands, and so any initial hope I had for this being a 1:1 switchover between TS is dead. However, the added benefits provided by the slash command ecosystem feel well worth it in the long run. This will add a change to the module structure, but I think it will enable developers to make better modules.