/**
 * @file
 * This file contains the code used to validate permissions during command execution
 */

// commented shit out because npm fix was complaining, uncomment and boilerplatify once needed
// -172

/*
import {
  ChatInputCommandInteraction,
  PermissionsBitField,
  Snowflake,
  User,
} from 'discord.js';

type PermissionConfig =
  | 'timeout'
  | 'kick'
  | 'ban'
  | 'manage_users'
  | 'administrator';
*/

/** A validator that checks to see if a provided interaction meets provided permission criteria*/
//class SlashCommandPermissionValidator {
//constructor(readonly interaction: ChatInputCommandInteraction) {}
/**
 * Check to see if the user that executed that slash command has the provided role
 * @param role The ID of the role to check against
 */
//async userHasRole(role: Snowflake) {}
/**
 * Check to see if the slash command was executed in the provided channel
 * @param channel The ID of the channel to check against
 */
//async isInChannel(channel: Snowflake) {}
/**
 * Check to see if the slash command was executed in the provided category
 * @param category The ID of the channel to check against
 */
//async isInCategory(category: Snowflake) {}
/**
 * Check to see if the user that executed the command has the provided user permission
 * @param permission check to see if the user has one of a few permissions.
 */
//async userHasPerm(permission: PermissionConfig) {}
//}

/** Convert an {@link PermissionConfig} to be of type {@link PermissionsBitFlag} */
/*function permissionConfigToBitFlag(permission: PermissionConfig) {
  // have fun!
  switch (permission) {
    case 'timeout':
      return PermissionsBitField.Flags.ModerateMembers;
  }
}
*/
