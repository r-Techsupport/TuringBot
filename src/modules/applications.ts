/**
 * @file
 * This file contains the 'applications' module definition.
 */

import {
  ModalBuilder,
  Snowflake,
  TextInputStyle,
  Colors,
  TextChannel,
  BaseMessageOptions,
  User,
  Role,
  GuildMember,
  APIEmbedField,
} from 'discord.js';

import * as util from '../core/util.js';
import {Collection, Db, ObjectId} from 'mongodb';

interface userResponses {
  [question: string]: string;
}

// DB Application structure
interface Application {
  _id: string;
  user: Snowflake;
  responses: userResponses;
  date: string;
  status: string;
}

const APPLICATION_COLLECTION_NAME = 'applications';

/**
 * Formats the current date to YYYY-MM-DD HH:MM:SS
 * @param date The current date
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = (1 + date.getMonth()).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hour = date.getHours().toString().padStart(2, '0');
  const minute = date.getMinutes().toString().padStart(2, '0');
  const second = date.getSeconds().toString().padStart(2, '0');

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

/**
 * Function to get the modal fields from the questions set in the module config
 */
function getModalfields() {
  const modalFields = [];
  for (const question of apply.config.questions) {
    // Makes sure the question is valid
    if (typeof question !== 'string' && question.length > 45) {
      util.logEvent(
        util.EventCategory.Warning,
        'application',
        `Invalid question found in the config for applications! \`${question}\``,
        2
      );
      continue;
    }

    modalFields.push({
      id: question,
      label: question,
      style: TextInputStyle.Short,
      maxLength: 500,
    });
  }

  return modalFields;
}

/** The root apply command definition, meant for public use*/
const apply = new util.RootModule(
  'apply',
  'Creates an application',
  [util.mongo],
  [],
  async (_, interaction) => {
    // Defines the DB structures
    const db: Db = util.mongo.fetchValue();
    const applicationCollection: Collection<Application> = db.collection(
      APPLICATION_COLLECTION_NAME
    );

    // Makes sure the application channel exists
    const applicationChannel: TextChannel | null =
      (await util.client.channels.fetch(apply.config.channel)) as TextChannel;

    // The channel doesn't exist or is invalid, return early
    if (applicationChannel === null) {
      util.logEvent(
        util.EventCategory.Error,
        'apply',
        'The channel ID set in the config for the application channel is not valid!',
        2
      );
      return util.embed.errorEmbed(
        'Config error: The application channel is not set up!'
      );
    }

    // Checks if there are any existing pending applications present, returns early if so
    if (
      (await applicationCollection.findOne({
        user: interaction.user.id,
        status: 'Pending',
      })) !== null
    ) {
      await util.replyToInteraction(interaction, {
        embeds: [
          util.embed.errorEmbed('You already have a pending application!'),
        ],
        ephemeral: true,
      });
      return;
    }

    // Defines the modal and its fields, then pushes it to the user
    const modalFields = getModalfields();

    if (modalFields.length === 0) {
      util.logEvent(
        util.EventCategory.Error,
        'application',
        "There aren't any valid questions set in the config!",
        3
      );
      return util.embed.errorEmbed(
        'Config error: No valid questions found in the config!'
      );
    }

    const modal: ModalBuilder = util.generateModal({
      id: 'interestModal',
      title: 'Helper interest form',
      fields: modalFields,
    });

    // Pushes the modal to the user
    await interaction.showModal(modal);

    // Waits for a response, times out after 15 minutes
    const submittedModal = await interaction.awaitModalSubmit({
      time: 900_000,
      filter: i => i.user.id === interaction.user.id,
    });

    // Creates a dict of user responses
    const responses: userResponses = {};

    for (const question of apply.config.questions) {
      responses[question] = submittedModal.fields.getTextInputValue(question);
    }

    // Defines the Application object sent to the DB
    const userApplication: Application = {
      _id: new ObjectId().toHexString(),
      user: submittedModal.member!.user.id,
      responses: responses,
      date: formatDate(new Date()),
      status: 'Pending',
    };

    // Pushes the application to the DB
    await applicationCollection.insertOne(userApplication);

    // Defines the embed sent to the application channel and sends it
    const embedFields: APIEmbedField[] = [];

    for (const question of apply.config.questions) {
      embedFields.push({
        name: question,
        value: responses[question],
      });
    }

    const embed = util.embed.manualEmbed({
      color: Colors.Blurple,
      title: 'Application manager',
      description: `New application! User: \`${submittedModal.user.tag}\` Application ID: \`${userApplication._id}\``,
      footer: {text: 'Status: Pending'},
      fields: embedFields,
    });

    await applicationChannel.send({embeds: [embed]});

    await submittedModal.reply({
      embeds: [
        util.embed.successEmbed('Succesfully registered this application!'),
      ],
      ephemeral: true,
    });
  },
  // Won't deferrreply, since sending a modal requires the interaction to not be deferred or replied to
  false
);

// TODO: Make this admin only
/** The root application group definition, meant for admin use */
const application = new util.RootModule(
  'application',
  'Manage or fetch user applications',
  [util.mongo]
);

application.registerSubModule(
  new util.SubModule(
    'get',
    'Gets all applications for a user',
    [
      {
        type: util.ModuleOptionType.User,
        name: 'user',
        description: 'The user to get the applications of',
        required: true,
      },
    ],
    async (args, interaction) => {
      const userArg: string = args
        .find(arg => arg.name === 'user')!
        .value!.toString();
      const user: User = await util.client.users.fetch(userArg);

      // Defines the DB structures
      const db: Db = util.mongo.fetchValue();
      const applicationCollection: Collection<Application> = db.collection(
        APPLICATION_COLLECTION_NAME
      );

      const locatedApplications = await applicationCollection
        .find({user: user.id})
        .toArray();

      if (locatedApplications.length === 0) {
        return util.embed.errorEmbed(`\`${user.tag}\` has no applications!`);
      }

      // Creates all payloads for pagination
      const embeds: BaseMessageOptions[] = [];

      for (const entry of locatedApplications) {
        // Creates the embed fields dynamically from the responses
        // This allows the questions to be changed over time without breaking the embed
        const embedFields: APIEmbedField[] = [];

        for (const question in entry.responses) {
          embedFields.push({
            name: question,
            value: entry.responses[question],
          });
        }

        const embed = util.embed.manualEmbed({
          color: Colors.Blurple,
          title: `Applications for \`${user.tag}\``,
          description: `Application ID: \`${entry._id}\``,
          footer: {text: `Status: ${entry.status}`},
          fields: embedFields,
        });

        embeds.push({embeds: [embed]});
      }

      // Finally, send the payloads off to be paginated
      await util.paginatePayloads(interaction, embeds, 60, false);
    }
  )
);

application.registerSubModule(
  new util.SubModule(
    'approve',
    'Approves a user application',
    [
      {
        type: util.ModuleOptionType.User,
        name: 'user',
        description: 'The user to approve the latest application from',
        required: true,
      },
    ],
    async (args, interaction) => {
      // Verifies the role config is set up properly
      let role: Role | undefined;
      if (application.config.applyRoleOnApprove) {
        role = interaction.guild!.roles.cache.get(
          application.config.roleIdOnApprove
        );

        if (role === undefined) {
          return util.embed.errorEmbed(
            'The role Id set in the config is invalid!'
          );
        }
      }

      const userName: string = args
        .find(arg => arg.name === 'user')!
        .value!.toString();
      const member: GuildMember | undefined =
        interaction.guild!.members.cache.get(userName);

      if (member === undefined) {
        return util.embed.errorEmbed(`\`${userName}\` isn't in the guild!`);
      }

      // Defines the DB structures
      const db: Db = util.mongo.fetchValue();
      const applicationCollection: Collection<Application> = db.collection(
        APPLICATION_COLLECTION_NAME
      );

      // Gets the latest pending application
      const locatedApplication: Application | null =
        await applicationCollection.findOne({
          user: member.id,
          status: 'Pending',
        });

      if (locatedApplication === null) {
        return util.embed.errorEmbed(
          `\`${member.user.tag}\` has no pending applications!`
        );
      }

      // Sets the status to approved and pushes it to the db
      locatedApplication.status = 'Approved';
      await applicationCollection.deleteOne({_id: locatedApplication._id});
      await applicationCollection.insertOne(locatedApplication);

      // Catches all errors since the only possible one is that the user has disabled dms
      await member
        .send({
          embeds: [
            util.embed.successEmbed(
              `Your application from ${interaction.guild!.name} was approved!`
            ),
          ],
        })
        .catch(() => {});

      // Adds the role to the user
      if (application.config.applyRoleOnApprove) {
        // Non-null assertion - The role has been verified as valid already
        await member.roles.add(role!);
      }
      return util.embed.successEmbed('Application succesfully approved!');
    }
  )
);

application.registerSubModule(
  new util.SubModule(
    'deny',
    'Denies a user application',
    [
      {
        type: util.ModuleOptionType.User,
        name: 'user',
        description: 'The user to deny the latest application of',
        required: true,
      },
      {
        type: util.ModuleOptionType.Boolean,
        name: 'silent',
        description: 'Whether to silently deny the application',
        required: false,
      },
    ],
    async (args, interaction) => {
      const userName: string = args
        .find(arg => arg.name === 'user')!
        .value!.toString();

      const silentFlag =
        args.find(arg => arg.name === 'silent')?.value ?? false;

      const member: GuildMember | undefined =
        interaction.guild!.members.cache.get(userName);

      if (member === undefined) {
        return util.embed.errorEmbed(`\`${userName}\` isn't in the guild!`);
      }

      // Defines the DB structures
      const db: Db = util.mongo.fetchValue();
      const applicationCollection: Collection<Application> = db.collection(
        APPLICATION_COLLECTION_NAME
      );

      // Gets the latest pending application
      const locatedApplication: Application | null =
        await applicationCollection.findOne({
          user: member.id,
          status: 'Pending',
        });

      if (locatedApplication === null) {
        return util.embed.errorEmbed(
          `\`${member.user.tag}\` has no pending applications!`
        );
      }

      // Sets the status to denied and pushes it to the db
      locatedApplication.status = 'Denied';
      await applicationCollection.deleteOne({_id: locatedApplication._id});
      await applicationCollection.insertOne(locatedApplication);

      if (silentFlag !== true) {
        // Catches all errors since the only possible one is that the user has disabled dms
        await member
          .send({
            embeds: [
              util.embed.infoEmbed(
                `Your application from ${interaction.guild!.name} was denied!`
              ),
            ],
          })
          .catch(() => {});
      }
      return util.embed.successEmbed('Application succesfully denied!');
    }
  )
);

application.registerSubModule(
  new util.SubModule(
    'purge',
    'Purges all applications from an user',
    [
      {
        type: util.ModuleOptionType.User,
        name: 'user',
        description: 'The user to purge ALL applications of',
        required: true,
      },
    ],
    async (args, interaction) => {
      const userName: string = args
        .find(arg => arg.name === 'user')!
        .value!.toString();

      const user: User = util.client.users.cache.get(userName)!;

      // Confirms deletion
      switch (
        await util.embed.confirmEmbed(
          `Are you sure you want to delete ALL applications for \`${user.tag}\`?`,
          interaction
        )
      ) {
        case util.ConfirmEmbedResponse.Denied:
          return util.embed.successEmbed('No applications were deleted.');

        case util.ConfirmEmbedResponse.Confirmed:
          break;
      }

      // Defines the DB structures
      const db: Db = util.mongo.fetchValue();
      const applicationCollection: Collection<Application> = db.collection(
        APPLICATION_COLLECTION_NAME
      );

      // Deletes all applications from a user
      await applicationCollection.deleteMany({user: user.id});

      return util.embed.successEmbed(
        `All applications for \`${user.tag}\` succesfully deleted!`
      );
    }
  )
);

export default [apply, application];
