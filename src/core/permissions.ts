/**
 * @file
 * This file contains the code used to validate permissions during command execution
 */
import {
  ChatInputCommandInteraction,
  GuildMember,
  GuildTextBasedChannel,
  PermissionsBitField,
  Snowflake,
} from 'discord.js';

// i hate everything about this entire file, i have been writing poorly formed boilerplate
// for the past 8 hours - arc

/**
 * one of the permission types specifiable in permission config.
 * while it's possible for this to be a string, it's considered
 * an invalid permission and handled accordingly
 */
type ManagementPermission =
  | 'timeout'
  | 'kick'
  | 'ban'
  | 'manage_roles'
  | 'administrator';

/**
 * The structure in a module config that enables restriction of a command
 * based on the context.
 *
 * - When nothing is set, everything is allowed by default.
 *
 * - If an item in the allowlist is set, then everything that doesn't
 * meet that requirement is denied.
 *
 * - If an item in the denylist is set, everything that doesn't meet the filter is allowed
 *
 * - If an item in both lists are set, the less granular setting is applied first.
 *
 * Ex: if you deny everything from a category, to allow situations where the command is usable in that category,
 * the allowlist would need to specify a particular channel, role, or user to allow.
 * User filters take the highest precedence, then role, then channel, then category with the lowest.
 *
 * - Items of the same type should not be set in the allow and deny lists.
 *
 */
export interface PermissionConfig {
  /**
   * If set, then the interaction will be denied if the user does not
   * have the specified permission.
   */
  requiredPerms?: ManagementPermission[];
  /**
   * If any of these values are set, then everything *but* an interaction
   * that meets the specified requirements will be considered bad
   */
  allowed?: ContextBlock;
  /** If any of these values are set, then everything *but* an interaction that meets the set filter will be allowed */
  denied?: ContextBlock;
  /**
   * Enable nested permission support
   */
  submodulePermissions?: {[key: string]: PermissionConfig};
}

/**
 * Containing optional lists of users, roles, channels, and categories,
 * this is used in a permissions config object to specify allowed/denied attributes
 * for an interaction.
 */
interface ContextBlock {
  /** A list of user IDs */
  users?: Snowflake[];
  /** A list of role IDs */
  roles?: Snowflake[];
  /** A list of channel IDs */
  channels?: Snowflake[];
  /** A list of category IDs */
  categories?: Snowflake[];
}

/** A validator that checks to see if a provided interaction meets provided permission criteria*/
class SlashCommandPermissionValidator {
  private readonly interaction: ChatInputCommandInteraction;
  private readonly guildMember: GuildMember;

  /**
   * make a new validator
   * @param interaction The interaction to validate against
   */
  constructor(interaction: ChatInputCommandInteraction) {
    this.interaction = interaction;
    // it's possible for this value to be null if someone dms the bot a global slash command
    // because all slash commands are registered as server commands, this should never be null.
    // i don't know why it's possible for this to be an api guild member, the docs say nothing
    // and the source code did not provide an easy answer. I'm just going to assume it's a
    // nonissue
    this.guildMember = interaction.member! as GuildMember;
  }

  /**
   * Check to see if the user that executed the slash command matches the provided user id
   */
  interactionByUser(user: Snowflake): boolean {
    if (this.guildMember.id === user) {
      return true;
    } else {
      return false;
    }
  }

  /**
   * Check to see if the user that executed that slash command has the provided role
   * @param role The ID of the role to check against
   */
  userHasRole(role: Snowflake): boolean {
    if (this.guildMember.roles.cache.get(role) !== undefined) {
      // user has role if get did not return undefined
      return true;
    } else {
      return false;
    }
  }
  /**
   * Check to see if the slash command was executed in the provided channel
   * @param channel The ID of the channel to check against
   */
  isInChannel(channel: Snowflake): boolean {
    if (this.interaction.channelId === channel) {
      return true;
    } else {
      return false;
    }
  }
  /**
   * Check to see if the slash command was executed in the provided category
   * @param category The ID of the channel to check against
   */
  isInCategory(category: Snowflake): boolean {
    // TextBasedChannel can either be a dm channel or a guild text channel
    // because slash commands can only take place in the server, this is asserted
    if (
      (this.interaction.channel as GuildTextBasedChannel).parentId === category
    ) {
      return true;
    } else {
      return false;
    }
  }
  /**
   * Check to see if the user that executed the command has the provided user permission
   * @param permission check to see if the user has one of a few permissions.
   */
  userHasPerm(permission: ManagementPermission): boolean {
    const bitFlagPerm = permissionConfigToBitFlag(permission);
    if (this.guildMember.permissions.has(bitFlagPerm)) {
      return true;
    } else {
      return false;
    }
  }
}

/**
 * Check and see if an interaction meets the permission requirements
 * @param interaction interaction to check
 * @param config the config to see if the interaction meets
 * @returns A list of every reason the command should not be executed. If this list is empty, the user is
 * allowed to execute the command
 */
export function checkInteractionAgainstPermissionConfig(
  interaction: ChatInputCommandInteraction,
  config: PermissionConfig
): string[] {
  /** A list of reasons that the interaction should not proceed. It may include reasons like "user cannot ban members", or "this category was blocked". */
  const reasons: string[] = [];
  const validator = new SlashCommandPermissionValidator(interaction);

  // check to see if the author of the interaction has the perms listed in requiredPerms
  const missingPerms: string[] = [];
  // check to see if the user is missing any of the defined perms, if so, add them to the array
  if (config.requiredPerms !== undefined) {
    for (const permission of config.requiredPerms) {
      if (!validator.userHasPerm(permission)) {
        missingPerms.push(permission);
      }
    }
  }
  // format the missing perms into a nice string, then add them to the returned reasons list
  if (missingPerms.length > 0) {
    reasons.push(
      `You are missing the required permissions: *${missingPerms.join(', ')}*`
    );
    // at this point, you could technically return early, but i don't so that *every*
    // reason a user couldn't run the thing is displayed
  }

  // if neither allowlist or denylist are defined, allow everything (there's no reasons to add)
  // language clarification: the ?? {} is just a cheeky shortcut to avoid needing to have
  // a bunch of undefined check boilerplate
  if (
    Object.keys(config.allowed ?? {}).length === 0 &&
    Object.keys(config.denied ?? {}).length === 0
  ) {
    return reasons;
  }
  // these lists get pushed the unformatted issues, for formatting later
  /**
   * If an allowlist setting was defined in the config, and the interaction does not meet those requirements,
   * an item will be added here. The first item is the category the check failed on, EG "users" or "roles",
   * and the second item is the list of things that *are* allowed, EG `1234545234, 489759837459`.
   */
  const unformattedAllowReasons: [string, string][] = [];
  /**
   * If a denylist setting was defined in the config, and the interaction should be denied because it matches
   * the setting made, an item will be added here. The first item is the category that matched the setting, eg
   * "users", or "roles", and the second item is a list of things that are denied, eg `232342342, 3245234134`.
   **/
  const unformattedDenyReasons: [string, string][] = [];

  // check for matches for the allow and denylists, then "mesh" the two based on priority
  /** If a whitelist is set, this is a list of things that do not fit the whitelist */
  const allowMatches = checkContextBlockForInteraction(
    interaction,
    config.allowed ?? {}
  );
  /** If a blacklist is set, this is a list of things that hit the blacklist */
  const denyMatches = checkContextBlockForInteraction(
    interaction,
    config.denied ?? {}
  );

  /**
   * If undefined, then no setting has been encountered that allows/denies *yet*.
   * Reasons should only be added if this is not set to true. If this is set to true,
   * then a higher priority setting has already been applied, and it believes the interaction
   * has permission to continue, given that a validation issue has not already taken place
   */
  let allowed: boolean | undefined;

  //  stage one: check the user setting. If the user setting is set,
  // it overrides any other settings, because it's the highest priority setting
  // if a value is defined in the match list, it means that that category was a match
  if (allowMatches.users) {
    // the highest level, this person is definitely allowed to do the thing
    allowed = true;
  }

  // if a decision was not already made regarding whether or not the interaction should proceed,
  // and the allowedMatches.users filter did not match the author of the interaction,
  // but a config key was defined, then add a reason, because the user is not one of a few
  // allowed users specified in the config.
  if (
    allowed !== true &&
    allowMatches.users === undefined &&
    config.allowed?.users !== undefined
  ) {
    allowed = false;
    unformattedAllowReasons.push([
      'users',
      config.allowed.users.map(user => `<@!${user}>`).join(', '),
    ]);
  }

  if (allowed !== true && denyMatches.users) {
    allowed = false;
    unformattedDenyReasons.push([
      'users',
      denyMatches.users.map(user => `<@!${user}>`).join(', '),
    ]);
  }

  // stage two: check the role setting if a decision hasn't already been made
  // when checking higher priority issues
  // first check to see if the interaction isn't already allowed to proceed
  if (allowed !== true && allowMatches.roles) {
    allowed = true;
  }
  // then check if the interaction doesn't meet the requirements set forth by the allowlist (if they're set)
  if (
    allowed !== true &&
    allowMatches.roles === undefined &&
    config.allowed?.roles !== undefined
  ) {
    allowed = false;
    unformattedAllowReasons.push([
      'roles',
      config.allowed.roles.map(role => `<@&${role}>`).join(', '),
    ]);
  }
  // then check to see if the interaction matches the filter set by the denylist
  if (allowed !== true && denyMatches.roles) {
    allowed = false;
    unformattedDenyReasons.push([
      'roles',
      denyMatches.roles.map(role => `<@&${role}>`).join(', '),
    ]);
  }

  // stage three: same as above, for channels
  if (allowed !== true && allowMatches.channels) {
    allowed = true;
  }

  if (
    allowed !== true &&
    allowMatches.channels === undefined &&
    config.allowed?.channels !== undefined
  ) {
    unformattedAllowReasons.push([
      'channels',
      config.allowed.channels.map(channel => `<#${channel}>`).join(', '),
    ]);
  }

  if (allowed !== true && denyMatches.channels) {
    allowed = false;
    unformattedDenyReasons.push([
      'channels',
      denyMatches.channels.map(channel => `<#${channel}>`).join(', '),
    ]);
  }

  // stage four, same as above for categories
  if (allowed !== true && allowMatches.categories) {
    allowed = true;
  }

  if (
    allowed !== true &&
    allowMatches.categories === undefined &&
    config.allowed?.categories !== undefined
  ) {
    unformattedAllowReasons.push([
      'categories',
      config.allowed.categories.map(category => `<#${category}>`).join(', '),
    ]);
  }

  if (allowed !== true && denyMatches.categories) {
    allowed = false;
    unformattedDenyReasons.push([
      'categories',
      denyMatches.categories.join(', '),
    ]);
  }

  // format the denyReasons into full strings, then add them to the returned list of reasons
  for (const entry of unformattedDenyReasons) {
    reasons.push(
      `Execution of command is disabled for the following ${entry[0]}: *${entry[1]}*`
    );
  }
  // same for blocks caused by the allowlist
  for (const entry of unformattedAllowReasons) {
    reasons.push(`Allowed ${entry[0]}: *${entry[1]}*`);
  }
  // return a list of reasons
  return reasons;
}

// someone should clean this up if they feel so inclined, i think you could nest a lot less deeply
/**
 * @param interaction The interaction to check against the context block
 * @param contextBlock The block to check when comparing against the interaction
 * @returns A context block, where any key that's set is the key the check caught,
 * and the value is the same as the context block passed in the function declaration. So if you
 * passed an interaction where the user id was "foo", and the {@link ContextBlock} had "foo" in the list of users,
 * the returned value would look like `{ users: ['foo'] }`
 */
function checkContextBlockForInteraction(
  interaction: ChatInputCommandInteraction,
  contextBlock: ContextBlock
): ContextBlock {
  const validator = new SlashCommandPermissionValidator(interaction);
  /**
   * If the interaction meets the requirements set out in the passed block for a certain key, the key and value are added
   * to this block
   */
  const matchingBlockParts: ContextBlock = {};
  // user validation
  if (contextBlock.users !== undefined) {
    for (const user of contextBlock.users) {
      // if the user matches, add the key to the final 'what caught the filter' block
      if (validator.interactionByUser(user)) {
        matchingBlockParts.users = contextBlock.users;
      }
    }
  }
  // role validation
  if (contextBlock.roles !== undefined) {
    for (const role of contextBlock.roles) {
      if (validator.userHasRole(role)) {
        matchingBlockParts.roles = contextBlock.roles;
      }
    }
  }
  // channel validation
  if (contextBlock.channels !== undefined) {
    for (const channel of contextBlock.channels) {
      if (validator.isInChannel(channel)) {
        matchingBlockParts.channels = contextBlock.channels;
      }
    }
  }
  // category validation
  if (contextBlock.categories !== undefined) {
    for (const category of contextBlock.categories) {
      if (validator.isInCategory(category)) {
        matchingBlockParts.categories = contextBlock.categories;
      }
    }
  }
  return matchingBlockParts;
}

/** Convert an {@link ManagementPermission} to be of type {@link PermissionsBitFlag} */
function permissionConfigToBitFlag(permission: ManagementPermission | string) {
  // have fun!
  switch (permission) {
    case 'timeout':
      return PermissionsBitField.Flags.ModerateMembers;
    case 'administrator':
      return PermissionsBitField.Flags.Administrator;
    case 'manage_roles':
      return PermissionsBitField.Flags.ManageRoles;
    case 'ban':
      return PermissionsBitField.Flags.BanMembers;
    case 'kick':
      return PermissionsBitField.Flags.KickMembers;
  }

  throw new Error(
    `Config permission "${permission}" is not a valid configurable permission`
  );
}
