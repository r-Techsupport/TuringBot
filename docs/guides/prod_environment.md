# Setting up a production deployment of TuringBot
This guide will explain how to obtain all necessary API keys, populate the config, and deploy an instance of TuringBot, running in docker. TuringBot uses `.jsonc` files as the primary configuration format, they're [JSON](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Objects/JSON) files, but with comments.

## Creating a project directory
TuringBot relies on two separate files for functionality, `config.jsonc`, and `secrets.jsonc`. For convenience, these can be placed in a project directory.

In this directory, create a file named `config.jsonc`, and open the repository, and copy the contents of `config.default.jsonc` into this `config.jsonc`. There's a few important keys that need to be addressed, but the defaults for most settings are usually fine. In the `logging` object, you can adjust the level at which messages will be logged, and specify a logging channel, and recipients for DM logging. `.logging.directMessageLogging.UserIds` contains an array of users that will receive DM logs, set `verboseLevel` to `0` if you do not want any users to receive logs. `.logging.loggingChannel.loggingChannelId` should be set to a channel you'd like to designate for bot events. If you do not want events logged to a channel, then set `verboseLevel` to `0`. 

> **All IDs should be set as a `"string"`, not a number.**

- 0: No logging, no events will be logged

- 1: Very minimalist logging, will log important errors and warnings.

- 2: Slightly more verbose logging, a safe choice.

- 3: The most verbose level of logging, includes all events.

Scrolling down to the `modules` section, you can find a list of every module, and settings for each module. 
### Module settings
- Logging:<br>
If the `loggingCategory` key is set to the ID of a category, you can use `/logging populate` to fill out the `channelMap` section of the config, and generate new logging channels if needed. Otherwise, you can manually define logging channels by setting a new key in `channelMap` to the ID of the actual channel you'd like to log, and the value to the channel you'd like to log messages to. Optionally, `channelBlacklist` can be filled out to contain a list of channel IDs that you *do not want* logged, and they'll be unselected by default when running `/logging populate`.

- Application:<br>
Set the `channel` key to the channel you'd like applications to be sent to. `questions` contains a list of prompts that the user will be asked about.

- Autopaste:<br>
    You can update `pasteFooterContent` to customize the autopaste embed footer to your liking. `pasteApi` should point to a valid linx paste server.

### API keys
#### Discord
Go to https://discord.com/developers/applications, and sign in to your Discord account if necessary.

Click on "New Application", enter a name, and click "Create".

Under the left menu, select "Bot", and then select "Add Bot"

Under the "Bot" menu, select "Reset Token", and then keep careful note of this token, you'll need it later, *do not share it*.

Turn on "Privileged Gateway Intents", and toggle on "Guild", "MessageContent", and "Guild Messages". More may be needed as the bot receives updates, add them accordingly.

To add the bot to a server, go to "OAuth2" -> "URL Generator"; Then select "bot" under "Scopes", and then toggle "Administrator". The generated link will be at the bottom of the page.

#### MongoDB
MongoDB Atlas is the recommended database for a production environment. Running a local MongoDB instances is not (yet, as of 2023-09-08) supported in production, nor is it recommended to run a local DB instance. 

Please refer to the [guide](./mongodb_atlas_setup.md).

#### Google/Youtube
Please refer to the [guide](./google_setup.md).

## Permissions
Slash command permissions can be configured per module, under the `permissions` key. 

Restriction of slash commands via permission level can be set via the `permissions.requiredPerms` key. It accepts an array of permissions, where the user must have *all* listed permissions to execute the command. Valid options are `kick`, `ban`, `timeout`, `manage_roles`, and `administrator`. They must be specified in that *exact format*, as a string. 

Permissions can also be controlled with the `allowed` and `denied` keys. If a setting is made under the `allowed` key, then only execution contexts that *meet* that requirement will be able to execute. If a setting is made under the `denied` key, execution will be allowed unless that setting matches the execution context. Under the `denied` and `allowed` keys, you can specify `users`, `roles`, `channels`, or `categories`. 

```jsonc
{
    "users": [],
    "roles": [],
    "channels": [],
    "categories": [],
}
```

Each key accepts a list of IDs, again, specified as a string.

If you'd like to restrict subcommand permissions, scroll down to the example.



### Examples
#### Restricting execution to users with the `administrator` permission.
```jsonc
"permissions": {
    "requiredPerms": ["administrator"]
}
```

#### Restricting the command to a particular category
```jsonc
"permissions": {
    "allowed": {
        "categories": ["your_category_id_here"]
    }
}
```

#### Preventing a specific user from executing a command
```jsonc
"permissions": {
    "denied": {
        "users": ["that_user_id_here"]
    }
}
```

#### Restricting the permissions for a particular subcommand
> In this example, the subcommand is named `foo`, and we're restricting it to a particular channel. Replace that with the submodule you'd like to restrict. This can be set with the same sort of structure used for standard module permissions, so you can configure things like `requiredPerms`, `allowed`, and `denied`, the same way you'd configure base level command permissions.
```jsonc
"permissions": {
    "submodulePermissions": {
        "foo": {
            "allowed": {
                "channels": ["your_channel_id_here"]
            }
        }
    }
}
```

#### Restricting a sub-sub-command
> In this example, we're restricting the sub-sub-command `bar` to a particular user, for the subcommand `foo`. The structure is similar to restricting a subcommand, it's just repeated.
```jsonc
"permissions": {
    "submodulePermissions": {
        "foo": {
            "submodulePermissions": {
                "allowed": {
                    "users": ["your_user_id_here"]
                }
            }
        }
    }
}
```


```jsonc
  "permissions": {
    // a list of all possible permission restrictions
    "requiredPerms": ["kick", "ban", "timeout", "manage_roles", "administrator"],
    // **ALL IDs MUST BE STRINGS (not numbers)**
    "allowed": {
        // list of user IDs
        "users": [],
        // list of role IDs (or names? needs to be discussed)
        "roles": [],
        // list of channel IDs
        "channels": [],
        // a list of category IDs
        "categories": [],
    },
    "denied": {
        // a list of user IDs
        "users": [],
        // a list of role IDs
        "roles": [],
        // a list of channel IDs
        "channels": [],
        // a list of category IDs.
        "categories": [],
    },
    // if you also want to restrict permissions per submodule, it can be done as below
    "submodulePermissions": {
      // each key in this object is the name of a submodule, so for a command like `/factoid all`, 
      // you could restrict it with a key named `"all"`.
      "<submodule_name>": {
        // the same structure can be nested
        "requiredPerms": [],
        // you can also nest submodulePermissions to restrict a command 3 layers deep, like "/factoid all html"
        "submodulePermissions": {
          "<submodule_name>": {}
        }
      }
    }
  }
    ```

## Administration