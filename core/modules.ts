import { eventLogger } from "./logger.js";
import { botConfig } from "./config.js";
import { APIEmbed } from "discord.js";

/**
 * This allows extension of the bot's initial functionality
 */
export class Module {
    /**
     * The name you want to use to trigger the command. If the command was `foo`, you could type the configured prefix, followed by foo
     */
    command: string;
    /**
     * Any alternative phrases you want to trigger the command. If the command was `foobarbuzz` you could maybe use `fbb` or `f`
     */
    aliases: string[];
    /**
     * This message will be displayed when the `help` utility is called, and when a command that has subcommands is referenced
     */
    helpMessage: string;

    executeCommand;
    /**
     * If there are no subcommands specified, this will be called whenever the command is used. It can either return nothing,
     * or an embed that will be used to respond to the user. You don't need to make use of the response embed, it's there as a
     * quality of life feature
     */
    onCommandExecute(functionToCall: (args: string) => Promise<void | APIEmbed>) {
        this.executeCommand = functionToCall;
    }

    initialize: () => Promise<void>;
    /**
     * Set a function to call when first loading the module. If you want to have a module with daemon functionality, this would be one way to implement it
     */
    onInitialize(functionToInitializeWith: () => Promise<void>) {
        this.initialize = functionToInitializeWith;
    }
    /**
     * Subcommands are referenced by typing the base command, then the subcommand. If a command has subcommands, then onCall should not be defined.
     */
    submodules: Module[] = [];
    /**
     * Whether or not the command should be accessible. This can be set with `enableModule()` and `disableModule()` respectively
     */
    enabled: boolean;

    /**
     * Internal way to log events from within the class, don't use this externally, import the eventLogger object
     */

    constructor(command: string, helpMessage: string, onCommandExecute?: (args: string) => Promise<void | APIEmbed>) {
        this.command = command;
        this.helpMessage = helpMessage;
        this.executeCommand = onCommandExecute;
        eventLogger.logEvent({ category: "II", location: "core", description: `New module registered: ${command}` }, 3);
    }

    /**
     * Add a submodule to the current module
     * @param submoduleToRegister Submodule you'd like to add to the current Module or Submodule
     */
    registerSubmodule(submoduleToRegister: Module) {
        this.submodules.push(submoduleToRegister);
    }

    /**
     * Turn on the module
     */
    enable() {
        this.enabled = true;
        eventLogger.logEvent({ category: "II", location: "core", description: `${this.command} enabled` }, 3);
    }

    /**
     * Turn off the module
     */
    disable() {
        this.enabled = false;
        eventLogger.logEvent({ category: "II", location: "core", description: `${this.command} disabled` }, 3);
    }

    /**
     * Fetch the config for this module using the command name from config.jsonc
     */
    fetchConfig() {
        return botConfig.modules[this.command];
    }
}
