import type { UUID } from "node:crypto";
import { v4 } from "uuid";
import { choiceAction } from "./actions/choice.ts";
import { followRoomAction } from "./actions/followRoom.ts";
import { ignoreAction } from "./actions/ignore.ts";
import { muteRoomAction } from "./actions/muteRoom.ts";
import { noneAction } from "./actions/none.ts";
import updateRoleAction from "./actions/roles.ts";
import { sendMessageAction } from "./actions/sendMessage.ts";
import updateSettingsAction from "./actions/settings.ts";
import { unfollowRoomAction } from "./actions/unfollowRoom.ts";
import { unmuteRoomAction } from "./actions/unmuteRoom.ts";
import { updateEntityAction } from "./actions/updateEntity.ts";
import { createUniqueUuid } from "./entities.ts";
import { goalEvaluator } from "./evaluators/goal.ts";
import { reflectionEvaluator } from "./evaluators/reflection.ts";
import { logger } from "./logger.ts";
import {
  composePrompt,
  messageHandlerTemplate,
  parseJSONObjectFromText,
  shouldRespondTemplate,
} from "./prompts.ts";
import { actionExamplesProvider } from "./providers/actionExamples.ts";
import { actionsProvider } from "./providers/actions.ts";
import { anxietyProvider } from "./providers/anxity.ts";
import { attachmentsProvider } from "./providers/attachments.ts";
import { capabilitiesProvider } from "./providers/capabilities.ts";
import { characterProvider } from "./providers/character.ts";
import { entitiesProvider } from "./providers/entities.ts";
import { evaluatorsProvider } from "./providers/evaluators.ts";
import { factsProvider } from "./providers/facts.ts";
import { knowledgeProvider } from "./providers/knowledge.ts";
import { optionsProvider } from "./providers/options.ts";
import { recentMemoriesProvider } from "./providers/recentMemories.ts";
import { relationshipsProvider } from "./providers/relationships.ts";
import { roleProvider } from "./providers/roles.ts";
import { settingsProvider } from "./providers/settings.ts";
import { timeProvider } from "./providers/time.ts";
import { TaskService } from "./services/taskService.ts";
import {
  ChannelType,
  type Content,
  type Entity,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  ModelTypes,
  type Plugin,
  Role,
  type Room,
  type World,
} from "./types.ts";

type ServerJoinedParams = {
  runtime: IAgentRuntime;
  world: any; // Platform-specific server object
  source: string; // "discord", "telegram", etc.
};

// Add this to your types.ts file
type ServerConnectedParams = {
  runtime: IAgentRuntime;
  world: World;
  rooms: Room[];
  users: Entity[];
  source: string;
};

type UserJoinedParams = {
  runtime: IAgentRuntime;
  user: any;
  serverId: string;
  entityId: UUID;
  channelId: string;
  channelType: ChannelType;
  source: string;
};

type MessageReceivedHandlerParams = {
  runtime: IAgentRuntime;
  message: Memory;
  callback: HandlerCallback;
};

const latestResponseIds = new Map<string, Map<string, string>>();

const messageReceivedHandler = async ({
  runtime,
  message,
  callback,
}: MessageReceivedHandlerParams) => {
  // Generate a new response ID
  const responseId = v4();
  // Get or create the agent-specific map
  if (!latestResponseIds.has(runtime.agentId)) {
    latestResponseIds.set(runtime.agentId, new Map());
  }
  const agentResponses = latestResponseIds.get(runtime.agentId)!;

  // Set this as the latest response ID for this agent+room
  agentResponses.set(message.roomId, responseId);

  // First, save the incoming message
  await Promise.all([
    runtime.getMemoryManager("messages").addEmbeddingToMemory(message),
    runtime.getMemoryManager("messages").createMemory(message),
  ]);

  if (message.entityId === runtime.agentId) return false;

  const agentUserState = await runtime.databaseAdapter.getParticipantUserState(
    message.roomId,
    runtime.agentId
  );

  if (
    agentUserState === "MUTED" &&
    !message.content.text
      .toLowerCase()
      .includes(runtime.character.name.toLowerCase())
  ) {
    console.log("Ignoring muted room");
    return false;
  }

  if (agentUserState === "FOLLOWED") {
    return true;
  }

  if (
    message.content.text
      .toLowerCase()
      .includes(runtime.character.name.toLowerCase())
  ) {
    return true;
  }

  let state = await runtime.composeState(message, {}, [
    "DYNAMIC_PROVIDERS",
    "SHOULD_RESPOND",
    "CHARACTER",
    "RECENT_MEMORIES",
    "ENTITIES",
  ]);

  if (!state.entities) {
    throw new Error("No entities found");
  }

  if (!state.agentName) {
    throw new Error("No agent name found");
  }

  if (!state.recentMessages) {
    throw new Error("No recent messages found");
  }

  const shouldRespondPrompt = composePrompt({
    state,
    template:
      runtime.character.templates?.shouldRespondTemplate ||
      shouldRespondTemplate,
  });

  const response = await runtime.useModel(ModelTypes.TEXT_SMALL, {
    prompt: shouldRespondPrompt,
  });

  console.log("shouldRespondPrompt", shouldRespondPrompt);

  const responseObject = parseJSONObjectFromText(response);

  const providers = responseObject.providers;

  const shouldRespond =
    responseObject?.action &&
    responseObject.action === "RESPOND";

  state = await runtime.composeState(message, {}, null, providers);

  if (shouldRespond) {
    const prompt = composePrompt({
      state,
      template:
        runtime.character.templates?.messageHandlerTemplate ||
        messageHandlerTemplate,
    });

    const response = await runtime.useModel(ModelTypes.TEXT_LARGE, {
      prompt,
    });

    const responseContent = parseJSONObjectFromText(response) as Content;

    // Check if this is still the latest response ID for this agent+room
    const currentResponseId = agentResponses.get(message.roomId);
    if (currentResponseId !== responseId) {
      logger.info(
        `Response discarded - newer message being processed for agent: ${runtime.agentId}, room: ${message.roomId}`
      );
      return;
    }

    responseContent.text = responseContent.text?.trim();
    responseContent.inReplyTo = createUniqueUuid(runtime, message.id);

    const responseMessages: Memory[] = [
      {
        id: v4() as UUID,
        entityId: runtime.agentId,
        agentId: runtime.agentId,
        content: responseContent,
        roomId: message.roomId,
        createdAt: Date.now(),
      },
    ];

    state = await runtime.composeState(message, {}, ["RECENT_MEMORIES"]);

    // Clean up the response ID
    agentResponses.delete(message.roomId);
    if (agentResponses.size === 0) {
      latestResponseIds.delete(runtime.agentId);
    }

    await runtime.processActions(message, responseMessages, state, callback);
  }

  await runtime.evaluate(message, state, shouldRespond, callback);
};

const reactionReceivedHandler = async ({
  runtime,
  message,
}: {
  runtime: IAgentRuntime;
  message: Memory;
}) => {
  try {
    await runtime.getMemoryManager("messages").createMemory(message);
  } catch (error) {
    if (error.code === "23505") {
      logger.warn("Duplicate reaction memory, skipping");
      return;
    }
    logger.error("Error in reaction handler:", error);
  }
};

/**
 * Syncs all users from a server into entities with smart handling for large servers
 */
const syncServerUsers = async (
  runtime: IAgentRuntime,
  server: any,
  source: string
) => {
  logger.info(`Syncing users for server: ${server.name || server.id}`);

  try {
    // Create/ensure the world exists for this server
    const worldId = createUniqueUuid(runtime, server.id);
    const ownerId = createUniqueUuid(runtime, server.ownerId);

    await runtime.ensureWorldExists({
      id: worldId,
      name: server.name || `Server ${server.id}`,
      agentId: runtime.agentId,
      serverId: server.id,
      metadata: {
        ownership: server.ownerId ? { ownerId } : undefined,
        roles: {
          [server.ownerId]: Role.OWNER,
        },
      },
    });

    // Always sync channels
    await syncServerChannels(runtime, server, source);

    // For Discord, use specialized sync based on server size
    if (source === "discord") {
      const guild = await server.fetch();

      if (guild.memberCount > 1000) {
        // Large server strategy - don't sync all users at once
        await syncLargeServerUsers(runtime, guild, source);
      } else {
        // Small/medium server - can sync all users
        await syncRegularServerUsers(runtime, guild, source);
      }
    } else if (source === "telegram") {
      // Telegram-specific handling
      // Telegram generally doesn't have the same scale issues
    }

    logger.success(
      `Successfully synced server structure for: ${server.name || server.id}`
    );
  } catch (error) {
    logger.error(
      `Error syncing server: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};

/**
 * Handles syncing for very large servers (>1000 members)
 * Uses progressive loading and focuses on active users only
 */
const syncLargeServerUsers = async (
  runtime: IAgentRuntime,
  guild: any,
  source: string
) => {
  logger.info(
    `Using large server sync strategy for ${guild.name} (${guild.memberCount} members)`
  );

  try {
    // 1. Only sync text channels first
    for (const [channelId, channel] of guild.channels.cache) {
      if (channel.type === 0) {
        // Text channel
        // 2. For each channel, only grab a small sample of most recent active users
        const messages = await channel.messages.fetch({ limit: 10 });

        // Create a set to track unique users
        const activeUsers = new Set();

        messages.forEach((msg) => {
          if (!msg.author.bot) {
            activeUsers.add({
              id: msg.author.id,
              username: msg.author.username,
              displayName: msg.author.displayName || msg.author.username,
            });
          }
        });

        // If we found active users, sync them
        if (activeUsers.size > 0) {
          await syncMultipleUsers(
            runtime,
            Array.from(activeUsers),
            guild.id,
            channelId,
            ChannelType.GROUP,
            source
          );
        }
      }
    }

    // 3. In the background, sync online members (with delay to avoid rate limits)
    setTimeout(async () => {
      try {
        // This gets presence data but only for online users
        const onlineMembers = guild.members.cache.filter(
          (member) => member.presence?.status === "online"
        );

        // Process in small batches
        const batchSize = 50;
        const onlineMembersArray = Array.from(onlineMembers.values());

        for (let i = 0; i < onlineMembersArray.length; i += batchSize) {
          const batch = onlineMembersArray.slice(i, i + batchSize);

          const users = batch.map((member: any) => ({
            id: member.id,
            username: member.user.username,
            displayName: member.displayName || member.user.username,
          }));

          // Don't sync to null channel with WORLD type - find a default channel instead
          const generalChannel =
            guild.channels.cache.find(
              (ch) => ch.name === "general" && ch.type === 0
            ) || guild.channels.cache.find((ch) => ch.type === 0);

          if (generalChannel) {
            await syncMultipleUsers(
              runtime,
              users,
              guild.id,
              generalChannel.id,
              ChannelType.GROUP,
              source
            );
          }

          // Add a delay between batches to avoid rate limits
          if (i + batchSize < onlineMembersArray.length) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }

        logger.success(
          `Completed background sync of ${onlineMembersArray.length} online users for ${guild.name}`
        );
      } catch (error) {
        logger.error(`Error in background sync: ${error.message}`);
      }
    }, 5000); // Start after 5 seconds

    logger.info(`Completed initial sync for large server ${guild.name}`);
  } catch (error) {
    logger.error(`Error in large server sync: ${error.message}`);
  }
};

/**
 * Syncs all channels from a server
 */
const syncServerChannels = async (
  runtime: IAgentRuntime,
  server: any,
  source: string
) => {
  try {
    if (source === "discord") {
      const guild = await server.fetch();
      const worldId = createUniqueUuid(runtime, guild.id);

      // Loop through all channels and create room entities
      for (const [channelId, channel] of guild.channels.cache) {
        // Only process text and voice channels
        if (channel.type === 0 || channel.type === 2) {
          // GUILD_TEXT or GUILD_VOICE
          const roomId = createUniqueUuid(runtime, channelId);
          const room = await runtime.databaseAdapter.getRoom(roomId);

          // Skip if room already exists
          if (room) continue;

          let channelType;
          switch (channel.type) {
            case 0: // GUILD_TEXT
              channelType = ChannelType.GROUP;
              break;
            case 2: // GUILD_VOICE
              channelType = ChannelType.VOICE_GROUP;
              break;
            default:
              channelType = ChannelType.GROUP;
          }

          await runtime.ensureRoomExists({
            id: roomId,
            name: channel.name,
            source: "discord",
            type: channelType,
            channelId: channel.id,
            serverId: guild.id,
            worldId,
          });
        }
      }
    }
  } catch (error) {
    logger.error(`Error syncing channels: ${error.message}`);
  }
};

/**
 * For smaller servers, we can sync all users more comprehensively
 */
const syncRegularServerUsers = async (
  runtime: IAgentRuntime,
  guild: any,
  source: string
) => {
  try {
    logger.info(`Syncing all users for guild ${guild.name}`);
    // We can fetch all members for smaller servers
    // Get members from cache first
    let members = guild.members.cache;
    // If cache is empty, fetch all members
    if (members.size === 0) {
      members = await guild.members.fetch();
    }
    logger.info(`Syncing ${members.size} members for guild ${guild.name}`);
    // Process in batches to avoid overwhelming the system
    const batchSize = 100;
    const membersArray = Array.from(members.values());

    // Find a default channel for user syncing
    const defaultChannel =
      guild.channels.cache.find(
        (ch) => ch.name === "general" && ch.type === 0
      ) || guild.channels.cache.find((ch) => ch.type === 0);

    if (!defaultChannel) {
      logger.warn(`No suitable text channel found for guild ${guild.name}`);
      return;
    }

    for (let i = 0; i < membersArray.length; i += batchSize) {
      const batch = membersArray.slice(i, i + batchSize);
      const users = batch.map((member: any) => ({
        id: member.id,
        username: member.user.username,
        displayName: member.displayName || member.user.username,
      }));

      // Use the default channel instead of null with WORLD type
      await syncMultipleUsers(
        runtime,
        users,
        guild.id,
        defaultChannel.id,
        ChannelType.GROUP,
        source
      );

      // Add a small delay between batches
      if (i + batchSize < membersArray.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    logger.success(
      `Completed sync of all ${membersArray.length} users for ${guild.name}`
    );
  } catch (error) {
    logger.error(`Error in regular server sync: ${error.message}`);
  }
};

/**
 * Syncs a single user into an entity
 */
const syncSingleUser = async (
  entityId: UUID,
  runtime: IAgentRuntime,
  user: any,
  serverId: string,
  channelId: string,
  type: ChannelType,
  source: string
) => {
  logger.info(`Syncing user: ${user.username || user.id}`);

  try {
    // Ensure we're not using WORLD type and that we have a valid channelId
    if (!channelId) {
      logger.warn(`Cannot sync user ${user.id} without a valid channelId`);
      return;
    }

    const roomId = createUniqueUuid(runtime, channelId);
    const worldId = createUniqueUuid(runtime, serverId);

    await runtime.ensureConnection({
      entityId,
      roomId,
      userName: user.username || user.displayName || `User${user.id}`,
      name: user.displayName || user.username || `User${user.id}`,
      source,
      channelId,
      serverId,
      type,
      worldId,
    });

    logger.success(`Successfully synced user: ${user.username || user.id}`);
  } catch (error) {
    logger.error(
      `Error syncing user: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};

/**
 * Handles standardized server data for both SERVER_JOINED and SERVER_CONNECTED events
 */
const handleServerSync = async ({
  runtime,
  world,
  rooms,
  users,
  source,
}: ServerConnectedParams) => {
  logger.info(`Handling server sync event for server: ${world.name}`);
  try {
    // Create/ensure the world exists for this server
    await runtime.ensureWorldExists({
      id: world.id,
      name: world.name,
      agentId: runtime.agentId,
      serverId: world.serverId,
      metadata: {
        ...world.metadata,
      },
    });

    // First sync all rooms/channels
    if (rooms && rooms.length > 0) {
      for (const room of rooms) {
        await runtime.ensureRoomExists({
          id: room.id,
          name: room.name,
          source: source,
          type: room.type,
          channelId: room.channelId,
          serverId: world.serverId,
          worldId: world.id,
        });
      }
    }

    // Then sync all users
    if (users && users.length > 0) {
      // Process users in batches to avoid overwhelming the system
      const batchSize = 50;
      for (let i = 0; i < users.length; i += batchSize) {
        const entityBatch = users.slice(i, i + batchSize);

        // check if user is in any of these rooms in rooms
        const firstRoomUserIsIn = rooms.length > 0 ? rooms[0] : null;

        // Process each user in the batch
        await Promise.all(
          entityBatch.map(async (entity: Entity) => {
            try {
              await runtime.ensureConnection({
                entityId: entity.id,
                roomId: firstRoomUserIsIn.id,
                userName: entity.metadata[source].username,
                name: entity.metadata[source].name,
                source: source,
                channelId: firstRoomUserIsIn.channelId,
                serverId: world.serverId,
                type: firstRoomUserIsIn.type,
                worldId: world.id,
              });
            } catch (err) {
              logger.warn(
                `Failed to sync user ${entity.metadata.username}: ${err}`
              );
            }
          })
        );

        // Add a small delay between batches if not the last batch
        if (i + batchSize < users.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    logger.success(
      `Successfully synced standardized world structure for ${world.name}`
    );
  } catch (error) {
    logger.error(
      `Error processing standardized server data: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};

/**
 * Syncs multiple users into entities at once
 */
const syncMultipleUsers = async (
  runtime: IAgentRuntime,
  users: any[],
  serverId: string,
  channelId: string,
  type: ChannelType,
  source: string
) => {
  if (!channelId) {
    logger.warn("Cannot sync users without a valid channelId");
    return;
  }

  logger.info(`Syncing ${users.length} users for channel ${channelId}`);

  try {
    const roomId = createUniqueUuid(runtime, channelId);
    const worldId = createUniqueUuid(runtime, serverId);
    // Process users in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (user) => {
          try {
            await runtime.ensureConnection({
              entityId: user.id,
              roomId,
              userName: user.username || `User${user.id}`,
              name:
                user.displayName || user.username || `User${user.id}`,
              source,
              channelId,
              serverId,
              type,
              worldId,
            });
          } catch (err) {
            logger.warn(`Failed to sync user ${user.id}: ${err}`);
          }
        })
      );
    }

    logger.success(
      `Successfully synced ${users.length} users for channel ${channelId}`
    );
  } catch (error) {
    logger.error(
      `Error syncing multiple users: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};

const events = {
  MESSAGE_RECEIVED: [
    async ({ runtime, message, callback }: MessageReceivedHandlerParams) => {
      await messageReceivedHandler({
        runtime,
        message,
        callback,
      });
    },
  ],
  VOICE_MESSAGE_RECEIVED: [
    async ({ runtime, message, callback }: MessageReceivedHandlerParams) => {
      await messageReceivedHandler({
        runtime,
        message,
        callback,
      });
    },
  ],
  REACTION_RECEIVED: [reactionReceivedHandler],

  // Both events now use the same handler function
  SERVER_JOINED: [handleServerSync],
  SERVER_CONNECTED: [handleServerSync],

  USER_JOINED: [
    async ({
      runtime,
      user,
      serverId,
      entityId,
      channelId,
      channelType,
      source,
    }: UserJoinedParams) => {
      await syncSingleUser(
        entityId,
        runtime,
        user,
        serverId,
        channelId,
        channelType,
        source
      );
    },
  ],
};

export const bootstrapPlugin: Plugin = {
  name: "bootstrap",
  description: "Agent bootstrap with basic actions and evaluators",
  actions: [
    followRoomAction,
    unfollowRoomAction,
    ignoreAction,
    noneAction,
    muteRoomAction,
    unmuteRoomAction,
    sendMessageAction,
    updateEntityAction,
    choiceAction,
    updateRoleAction,
    updateSettingsAction,
  ],
  events,
  evaluators: [reflectionEvaluator, goalEvaluator],
  providers: [
    timeProvider,
    factsProvider,
    optionsProvider,
    roleProvider,
    settingsProvider,
    relationshipsProvider,
    capabilitiesProvider,
    entitiesProvider,
    evaluatorsProvider,
    actionExamplesProvider,
    recentMemoriesProvider,
    actionsProvider,
    attachmentsProvider,
    characterProvider,
    knowledgeProvider,
    anxietyProvider,
  ],
  services: [TaskService],
};

export default bootstrapPlugin;
