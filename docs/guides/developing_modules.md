This document assumes you have already [set up a development environment](./dev_environment.md), and am ready to start writing code.

# Getting Started
Before you begin, you'll need the following:
- Basic understanding of Git
- Ability to navigate a command line environment
- Rudimentary programming ability. Understanding Typescript and Javascript is nice to have, but not strictly necessary. 

## What's a module?
All slash commands in TuringBot are implemented as a `Module`. Modules are self contained sections of code and configuration data that are loaded by the core, and then registered as slash commands. When a slash command is called in Discord, the bot receives a [ChatInputCommand](https://discord.js.org/#/docs/discord.js/main/class/ChatInputCommandInteraction), determines which module is associated with that slash command, and runs code the module has defined in the module declaration.

## Hello World!
Here's a walkthrough explaining how to make a basic module. This module will register a slash command named `hello`, and respond to the user with `Hello $USER`, where `$USER` is the user's username.

You'll start by navigating to `src/modules/`, and creating a file named `hello.ts`. This file will contain all of the code for your module.

> Module files can be organized in one of a few ways. For modules that can be contained within a single file, you can create a `.ts` file in `src/modules/` and export the module by including `export default moduleDefinition`, where `moduleDefinition` is the name of the variable you used when defining a module (more on that below). If you would like to define multiple modules in a single file, they can be exported as an array (`export default [moduleOne, moduleTwo, moduleThree]`). For modules that you'd like to split across multiple files, you can create a new directory in `src/modules`, then create a `.ts` file in that directory with the same name as the directory. For example, if you were to create a folder named `hello`, you could export modules from `src/modules/hello/hello.ts`. `hello/hello.ts` can import modules or utility code from other files in `hello`, then re-export modules if needed.

For now, you can open `hello.ts`, and add some basic boilerplate that every module file should have.

```typescript
/**@file
 * This docstring is placed at the top of most files, and should contain a brief explanation of
 * the purpose of the file, as well as explain what modules are exported.
 * We're only exporting one module, so the list will look something like this:
 * Modules:
 *   {@link hello} 
 * You can click on a docstring link with ctrl + click to jump to the module definition.
 */
// You should use ES6 syntax instead of CommonJS syntax when writing code for TuringBot
// the difference shouldn't impact you a ton, but you can see below for more details
// https://medium.com/globant/exploring-node-js-modules-commonjs-vs-es6-modules-2766e838bea9
// `util` contains all exported code from the core, and most functionality you need can be found here.
import * as util from '../core/util.js';

// variables are declared by default using const
// this will be filled out later.
const hello; /* TODO: */

// Here's where the module is exported from the file, so that the core can load it at runtime
export default hello;
```

In this example, we define a docstring for the file that explains what modules are exported, import TuringBot's library code, create a placeholder for the module we're going to define, and export the module so that the core can load the module.

Now we can define the actual module. In the below example, `// ---SNIP---` indicates that parts of the file have been excluded from the example.

```typescript
// ---SNIP---

// RootModules are the most basic form of module.
// Each RootModule should have a unique config
// in config.jsonc.
const hello = new util.RootModule(
  // the first argument to the `RootModule` constructor is the name of the slash command.
  // This is what will be registered with discord, and what the core checks for when
  // loading the config for this module.
  'hello',
  // The next argument is a sub 100 character description of your command that will be displayed
  // under the command when it's called
  'Say hello to the bot',
  // The next argument is a list of dependencies. You won't need to know about these for now,
  // they'll be explained below.
  [],
  // The next is a list of options, things that you want the user to be able to enter as input.
  // Again, not needed for now.
  [],
  // This argument is the most important argument. It defines what code to run when your command is executed. If submodules are defined, this shouldn't be.
  // the first argument is a list of [CommandInteractionOptions](https://discord.js.org/#/docs/discord.js/main/typedef/CommandInteractionOption), and will contain any input the user provided to the slash command
  // the second argument, `interaction`, is a [ChatInputCommandInteraction](https://discord.js.org/#/docs/discord.js/main/class/ChatInputCommandInteraction). It's a reference
  // to the slash command that gets called
  async (args, interaction) => {
    // Get the username of the user who triggered the interaction
    const username = interaction.user.username;
    // respond to the user
    // replyToInteraction() is used here because it's more resilient 
    // to things like an interaction already being replied to
    // interaction.reply(); could be used in this example, but
    // util.replyToInteraction(); is generally preferred
    util.replyToInteraction(interaction, {embeds: [util.embed.infoEmbed(`Hello, ${username}!`)]});
  }

  // ---SNIP---
);
```

Now that our module code is defined and ready to go, we need to add a config for it in `config.jsonc`. Look for the `modules` section, and scroll down to the bottom. Create a new entry, using the name of the command you defined earlier. In this case, the command is named `hello`, so we'll use that

```jsonc
"hello": {
    // to be considered a valid config option, this is *needed*
    "enabled": true,
}
```

Now that the module is defined, and a config entry added, you can go ahead and start the bot.

## Starting the bot (bare metal)
Run `make start` from the project directory. This will compile the typescript code located in `src/` to javascript code stored in `target/`, then run `target/core/main.js` with Node.

# General
## Defining submodules
Submodules can be used to group functionality under a single command. For example, the `factoid` module has several submodules, including `get`, `remember`, and `forget`.
```typescript
// ---SNIP---

// definition of our root module
const factoid = new util.RootModule(
    // ---SNIP---
);

// well now we need a submodule
const get = new util.SubModule(
    // ---SNIP---
);

// now we can add the new `get` submodule to the `factoid` module
factoid.registerSubmodule(get);

// inlining submodule definitions is also acceptable.
factoid.registerSubmodule(new util.SubModule('get', 'blah', ...));

// ---SNIP---
```

## Using options to accept input
A slash command isn't very helpful if you can't give it input to process. Modules can accept input from users by defining options in the constructor. In this example, we can use the constructor for the `conch` module. It accepts one argument, in the form of a question to ask.

```typescript
const conch = new util.RootModule(
  'conch',
  'Asks a question to the magic conch (8ball)',
  // the conch module doesn't use any dependencies, so this is empty
  [],
  // here, we're stating that we want to take a string as an option.
  // the argument of type string (There are a few different option types,
  // see https://discordjs.guide/slash-commands/advanced-creation.html#option-types
  // for more
  [
    {
      type: util.ModuleOptionType.String,
      name: 'question',
      description: 'The question to ask',
      // if set to true, the user cannot submit the slash command unless they've entered something for this option
      required: true,
    },
  ],
  async (args, interaction) => {
    // here, you can now make use of `args`, and select the option
    const question: string = args
      // the exclamation mark at the end of this line says that
      // 'This value will never be null or undefined'.
      // Do not use it unless the option is required.
      .find(arg => arg.name === 'question')!
      .value!.toString();
    // ---SNIP---
  }
);
```

## Using MongoDB
MongoDB is the database of choice for this project, and it can be accessed by specifying it as a Dependency in the root module's constructor. This will disable your module if MongoDB is inaccessible.

Dependencies are beyond the scope of this particular heading, but they're just ways to ensure a particular resource exists before a command can be executed.

```typescript
const moduleWithMongo = new util.RootModule(
  'iusemongo',
  'this module makes use of mongodb',
  [util.mongo],
  // this module accepts no options
  [],
  // if you don't need to use options, or the interaction, you can 
  // use an underscore to indicate that
  (_, _) => {
    // fetchValue() throws an error if the dependency cannot be accessed
    // so don't use it anywhere unless it's already been validated that the dependency exists.
    // This validation occurs before a module is executed, so this is a "safe place" to use
    // fetchValue();
    const mongo = util.mongo.fetchValue();
  });

```