import { readdir } from "node:fs";

import { eventLogger } from "./logger";
import { DiscordEmbed } from "./embed";

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
    /**
     * If there are no subcommands specified, this will be called whenever the command is used. It can either return nothing, 
     * or an embed that will be used to respond to the user. You don't need to make use of the response embed, it's there as a 
     * quality of life feature
     */
    onCall: (args: string) => Promise<void | DiscordEmbed>;
    /**
     * Called when the module is loaded. If you want to have a module with daemon functionality, this would be one way to implement it
    */
   initialize: () => Promise<void>;
    /**
     * Subcommands are referenced by typing the base command, then the subcommand. If a command has subcommands, then onCall should not be defined. 
     */
    submodules: Module[] = [];
    /**
     * Whether or not the command should be accessible. This can be set with `enableModule()` and `disableModule()` respectively
     */
    enabled: boolean;

    constructor(command: string, helpMessage: string, onCall?: (args: string) => Promise<void | DiscordEmbed>) {
        this.command = command;
        this.helpMessage = helpMessage;
        this.onCall = onCall;
        eventLogger.logEvent({category: "II", location: "core", description: `New module registered: ${command}`}, 3)
    }

    /**
     * Add a submodule to the current module
     * @param submoduleToRegister Submodule you'd like to add to the current Module or Submodule
     */
    registerSubmodule(submoduleToRegister: Module) {
        this.submodules.push(submoduleToRegister)
    }

    /**
     * Turn on the module
     */
    enable() {
      this.enabled = true;
      eventLogger.logEvent({category: "II", location: "core", description: `${this.command} enabled`}, 3);
    }

    /**
     * Turn off the module
     */
    disable() {
      this.enabled = false;
      eventLogger.logEvent({category: "II", location: "core", description: `${this.command} disabled`}, 3);
    }

}


let modules: Module[] = [];

readdir('../modules/', (err, files) => {
 files.forEach(file => {
  const importedModule = import('./' + file).then(m =>
    console.log("gnowo")
  );
  });
});