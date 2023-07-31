# ADR 03: A robust and versatile permissions system.

2023-07-30

Arc

# We have no permissions system

Currently, no permissions checks are run on commands. This means that every user can access every command. 

At minimum a permission system is a requirement to call the bot *functional*, let alone be what I want the bot to be. 

# Goals for a new permissions system

I consider command permissions something that should be controllable by administrators first, with developers second. While it may be nice for a dev to have the ability to hardcode in that someone needs to meet a certain requirement to run a command, a greater level of flexibility for admins can be achieved by having a standardized, config centric permissions system. 

Insight can be taken from TS's existing permissions system. One can see what it does well, and where points of friction are created. 

What TS gets right:

The ability to confine permissions to a particular role works well, and creates ergonomic error messages and contexts. Because roles are largely used as a way to control other permissions, configuring permissions with roles should be smooth, and easy. 

I'd like to look into having a defined "role hierarchy", for when there's a set of roles that linearly get more perms, eg regular -> trusted -> mod. This would mean that admins would only need to define the "lower" role that gets that permission, and then the "higher" roles could implicitly have those perms.

Where TS falls short:

The ability to restrict commands to particular contexts, EG channels/categories has proven that it would be nice in the future. Currently, commands are a hybrid of config based permissions, and hardcoded, per-extension permissions. I would like to have almost all permissions be config based, although the code that validates permissions could probably be written in a way that module devs could also make use of it.

Ideally, the below could be configured per module:
- Required permissions (kick, ban)
- Allowed/denied contexts (channels, categories)
- Allowed/denied users (admins, willz)

# Designing a new permissions system
Because a config for each module is *required*, that's the simplest place to put these perms.

```json
{
    // and whatever else a full perms list entails
    "requiredPerms": ["kick", "ban", "mute"],
    // Users takes the highest precedence, then role, then channel, than category
    // Denied takes precedence over allowed
    // if nothing is set, than all is enabled by default.
    // if there's an item in an allowlist, than anything that
    // doesn't have meet that requirement is denied
    // if there's an item in a denylist, than 
    // anything that doesn't match the list is still allowed
    // if a key is set for an allowlist, than it should not be set
    // for the deny list, and vice versa
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
    }
}
```

Validation could be broken down into very granular functions, and then stacked up into one function, maybe `meetsPermissionRequirements(interaction: ChatInputCommandInteraction, permissionObject: PermissionsConfig)`. The smaller functions could be stuff like `userHasRole()`, `interactionInCategory()`, `interactionInChannel()`, and so forth. This should be fairly maintainable, and module devs could cherry pick from the functions if needed.

Permission denied errors could be made to fit one of two boilerplates:

```
The ${user | role | category | channel} requirement was not met to execute this command. Missing requirements: ${list of missing requirements}
```

```
Execution for this command was has been disabled for the following ${users | roles | channels | categories}: ${list of reasons for execution block}
```

I can't think of a great way to handle permissions for subcommands. I thought of giving up and letting devs hardcode them, but we're just going to stick with *super deep* nesting. 

```jsonc
{
    // example module config
    "enabled": true,
    // permissions for this module
    "permissions": {
        "allowed": {
            "channels": ["111111111"]
        },
        "submodulePermissions": {
            // ideally, module permissions should be validated at every layer
            "foo": {
                "allowed": {
                    "roles": ["1231234"]
                },
                "denied": {
                    "users": ["92752544144572416"]
                }
            },
            // 3 layers deep 
            "submodulePermissions": {
                "bar": {
                    "subModulePermissions": {
                        "bat": {
                            "allowed": {
                                "categories": ["1111"]
                            }
                        }
                    }
                }
            }
        }
    }

}
```

# What's breaking?
This should require no changes to the module code, and the only changes to the core code will happen at the execution stage. They should be small, because the majority of change will be adding new code, not modifying existing code.