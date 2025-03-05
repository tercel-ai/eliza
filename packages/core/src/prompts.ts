import handlebars from "handlebars";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { names, uniqueNamesGenerator } from "unique-names-generator";
import logger from "./logger.ts";
import type { Content, Entity, IAgentRuntime, Memory, State, TemplateType } from "./types.ts";
import { ModelTypes } from "./types.ts";

/**
 * Composes a context string by replacing placeholders in a template with corresponding values from the state.
 *
 * This function takes a template string with placeholders in the format `{{placeholder}}` and a state object.
 * It replaces each placeholder with the value from the state object that matches the placeholder's name.
 * If a matching key is not found in the state object for a given placeholder, the placeholder is replaced with an empty string.
 *
 * @param {Object} params - The parameters for composing the context.
 * @param {State} params.state - The state object containing values to replace the placeholders in the template.
 * @param {TemplateType} params.template - The template string or function containing placeholders to be replaced with state values.
 * @returns {string} The composed context string with placeholders replaced by corresponding state values.
 *
 * @example
 * // Given a state object and a template
 * const state = { userName: "Alice", userAge: 30 };
 * const template = "Hello, {{userName}}! You are {{userAge}} years old";
 *
 * // Composing the context with simple string replacement will result in:
 * // "Hello, Alice! You are 30 years old."
 * const contextSimple = composePrompt({ state, template });
 *
 * // Using composePrompt with a template function for dynamic template
 * const template = ({ state }) => {
 * const tone = Math.random() > 0.5 ? "kind" : "rude";
 *   return `Hello, {{userName}}! You are {{userAge}} years old. Be ${tone}`;
 * };
 * const contextSimple = composePrompt({ state, template });
 */

export const composePrompt = ({
    state,
    template,
}: {
    state: State;
    template: TemplateType;
}) => {
    const templateStr = typeof template === "function" ? template({ state }) : template

    const templateFunction = handlebars.compile(templateStr);
    return composeRandomUser(templateFunction(state), 10);
};

/**
 * Adds a header to a body of text.
 *
 * This function takes a header string and a body string and returns a new string with the header prepended to the body.
 * If the body string is empty, the header is returned as is.
 *
 * @param {string} header - The header to add to the body.
 * @param {string} body - The body to which to add the header.
 * @returns {string} The body with the header prepended.
 *
 * @example
 * // Given a header and a body
 * const header = "Header";
 * const body = "Body";
 *
 * // Adding the header to the body will result in:
 * // "Header\nBody"
 * const text = addHeader(header, body);
 */
export const addHeader = (header: string, body: string) => {
    return body.length > 0 ? `${header ? `${header}\n` : header}${body}\n` : "";
};

/**
 * Generates a string with random user names populated in a template.
 *
 * This function generates random user names and populates placeholders
 * in the provided template with these names. Placeholders in the template should follow the format `{{userX}}`
 * where `X` is the position of the user (e.g., `{{name1}}`, `{{name2}}`).
 *
 * @param {string} template - The template string containing placeholders for random user names.
 * @param {number} length - The number of random user names to generate.
 * @returns {string} The template string with placeholders replaced by random user names.
 *
 * @example
 * // Given a template and a length
 * const template = "Hello, {{name1}}! Meet {{name2}} and {{name3}}.";
 * const length = 3;
 *
 * // Composing the random user string will result in:
 * // "Hello, John! Meet Alice and Bob."
 * const result = composeRandomUser(template, length);
 */
export const composeRandomUser = (template: string, length: number) => {
    const exampleNames = Array.from({ length }, () =>
        uniqueNamesGenerator({ dictionaries: [names] })
    );
    let result = template;
    for (let i = 0; i < exampleNames.length; i++) {
        result = result.replaceAll(`{{user${i + 1}}}`, exampleNames[i]);
    }

    return result;
};

export const formatPosts = ({
    messages,
    actors,
    conversationHeader = true,
}: {
    messages: Memory[];
    actors: Entity[];
    conversationHeader?: boolean;
}) => {
    // Group messages by roomId
    const groupedMessages: { [roomId: string]: Memory[] } = {};
    messages.forEach((message) => {
        if (message.roomId) {
            if (!groupedMessages[message.roomId]) {
                groupedMessages[message.roomId] = [];
            }
            groupedMessages[message.roomId].push(message);
        }
    });

    // Sort messages within each roomId by createdAt (oldest to newest)
    Object.values(groupedMessages).forEach((roomMessages) => {
        roomMessages.sort((a, b) => a.createdAt - b.createdAt);
    });

    // Sort rooms by the newest message's createdAt
    const sortedRooms = Object.entries(groupedMessages).sort(
        ([, messagesA], [, messagesB]) =>
            messagesB[messagesB.length - 1].createdAt -
            messagesA[messagesA.length - 1].createdAt
    );

    const formattedPosts = sortedRooms.map(([roomId, roomMessages]) => {
        const messageStrings = roomMessages
            .filter((message: Memory) => message.entityId)
            .map((message: Memory) => {
                const actor = actors.find(
                    (actor: Entity) => actor.id === message.entityId
                );
                // TODO: These are okay but not great
                const userName = actor?.names[0] || "Unknown User";
                const displayName = actor?.names[0] || "unknown";

                return `Name: ${userName} (@${displayName})
ID: ${message.id}${message.content.inReplyTo ? `\nIn reply to: ${message.content.inReplyTo}` : ""}
Date: ${formatTimestamp(message.createdAt)}
Text:
${message.content.text}`;
            });

        const header = conversationHeader
            ? `Conversation: ${roomId.slice(-5)}\n`
            : "";
        return `${header}${messageStrings.join("\n\n")}`;
    });

    return formattedPosts.join("\n\n");
};

/**
 * Format messages into a string
 * @param {Object} params - The formatting parameters
 * @param {Memory[]} params.messages - List of messages to format
 * @param {Entity[]} params.actors - List of actors for name resolution
 * @returns {string} Formatted message string with timestamps and user information
 */
export const formatMessages = ({
  messages,
  actors,
}: {
  messages: Memory[];
  actors: Entity[];
}) => {
  const messageStrings = messages
    .reverse()
    .filter((message: Memory) => message.entityId)
    .map((message: Memory) => {
      const messageText = (message.content as Content).text;
      const messageActions = (message.content as Content).actions;
      const messageThought = (message.content as Content).thought
      const formattedName =
        actors.find((actor: Entity) => actor.id === message.entityId)?.names[0] ||
        "Unknown User";

      const attachments = (message.content as Content).attachments;

      const attachmentString =
        attachments && attachments.length > 0
          ? ` (Attachments: ${attachments
              .map((media) => `[${media.id} - ${media.title} (${media.url})]`)
              .join(", ")})`
          : "";

      const messageTime = new Date(message.createdAt);
      const hours = messageTime.getHours().toString().padStart(2, '0');
      const minutes = messageTime.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}`;

      const timestamp = formatTimestamp(message.createdAt);

      const shortId = message.entityId.slice(-5);

      return `${timeString} (${timestamp}) [${shortId}] ${formattedName}: ${messageThought ? `(thinking: *${messageThought}*) ` : ""}${messageText}${attachmentString}${
        messageActions && messageActions.length > 0 ? ` (actions: ${messageActions.join(", ")})` : ""
      }`;
    })
    .join("\n");
  return messageStrings;
};

export const formatTimestamp = (messageDate: number) => {
  const now = new Date();
  const diff = now.getTime() - messageDate;

  const absDiff = Math.abs(diff);
  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (absDiff < 60000) {
    return "just now";
  }if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  }if (hours < 24) {
    return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  }
    return `${days} day${days !== 1 ? "s" : ""} ago`;
};

const jsonBlockPattern = /```json\n([\s\S]*?)\n```/;

export const shouldRespondTemplate = `# Task: Decide on behalf of {{agentName}} whether they should respond to the message, ignore it or stop the conversation.
{{providers}}
# Instructions: Decide if {{agentName}} should respond to or interact with the conversation.
If the message is directed at or relevant to {{agentName}}, respond with RESPOND action.
If a user asks {{agentName}} to be quiet, respond with STOP action.
If {{agentName}} should ignore the message, respond with IGNORE action.
If responding with the RESPOND action, include a list of optional providers that could be relevant to the response.
Response format should be formatted in a valid JSON block like this:
\`\`\`json
{
    "name": "{{agentName}}",
    "action": "RESPOND" | "IGNORE" | "STOP",
    "providers": ["<string>", "<string>", ...]
}
\`\`\`
Your response should include the valid JSON block and nothing else.`;

export const messageHandlerTemplate = `# Task: Generate dialog and actions for the character {{agentName}}.
{{providers}}
# Instructions: Write the next message for {{agentName}}.
First, think about what you want to do next and plan your actions. Then, write the next message and include the actions you plan to take.
"thought" should be a short description of what the agent is thinking about and planning.
"actions" should be an array of the actions {{agentName}} plans to take based on the thought (if none, use IGNORE, if simply responding with text, use REPLY)
"providers" should be an optional array of the providers that {{agentName}} will use to have the right context for responding and acting
"evaluators" should be an optional array of the evaluators that {{agentName}} will use to evaluate the conversation after responding
"text" should be the next message you want to send, if any (don't send a message if using the IGNORE action).
These are the available valid actions: {{actionNames}}

Response format should be formatted in a valid JSON block like this:
\`\`\`json
{
    "thought": "<string>",
    "name": "{{agentName}}",
    "text": "<string>",
    "actions": ["<string>", "<string>", ...],
    "providers": ["<string>", "<string>", ...]
}
\`\`\`

Your response should include the valid JSON block and nothing else.`;

export const booleanFooter = "Respond with only a YES or a NO.";

/**
 * Parses a string to determine its boolean equivalent.
 *
 * Recognized affirmative values: "YES", "Y", "TRUE", "T", "1", "ON", "ENABLE"
 * Recognized negative values: "NO", "N", "FALSE", "F", "0", "OFF", "DISABLE"
 *
 * @param {string | undefined | null} value - The input text to parse
 * @returns {boolean} - Returns `true` for affirmative inputs, `false` for negative or unrecognized inputs
 */
export function parseBooleanFromText(value: string | undefined | null): boolean {
    if (!value) return false;

    const affirmative = ["YES", "Y", "TRUE", "T", "1", "ON", "ENABLE"];
    const negative = ["NO", "N", "FALSE", "F", "0", "OFF", "DISABLE"];

    const normalizedText = value.trim().toUpperCase();

    if (affirmative.includes(normalizedText)) {
        return true;
    }
    if (negative.includes(normalizedText)) {
        return false;
    }

    // For environment variables, we'll treat unrecognized values as false
    return false;
}

export const stringArrayFooter = `Respond with a JSON array containing the values in a valid JSON block formatted for markdown with this structure:
\`\`\`json
[
  'value',
  'value'
]
\`\`\`

Your response must include the valid JSON block.`;

/**
 * Parses a JSON array from a given text. The function looks for a JSON block wrapped in triple backticks
 * with `json` language identifier, and if not found, it searches for an array pattern within the text.
 * It then attempts to parse the JSON string into a JavaScript object. If parsing is successful and the result
 * is an array, it returns the array; otherwise, it returns null.
 *
 * @param text - The input text from which to extract and parse the JSON array.
 * @returns An array parsed from the JSON string if successful; otherwise, null.
 */
export function parseJsonArrayFromText(text: string) {
    let jsonData = null;

    // First try to parse with the original JSON format
    const jsonBlockMatch = text?.match(jsonBlockPattern);

    if (jsonBlockMatch) {
        try {
            // Only replace quotes that are actually being used for string delimitation
            const normalizedJson = jsonBlockMatch[1].replace(
                /(?<!\\)'([^']*)'(?=\s*[,}\]])/g,
                '"$1"'
            );
            jsonData = JSON.parse(normalizeJsonString(normalizedJson));
        } catch (_e) {
            logger.warn("Could not parse text as JSON, will try pattern matching");
        }
    }

    // If that fails, try to find an array pattern
    if (!jsonData) {
        const arrayPattern = /\[\s*(['"])(.*?)\1\s*\]/;
        const arrayMatch = text.match(arrayPattern);

        if (arrayMatch) {
            try {
                // Only replace quotes that are actually being used for string delimitation
                const normalizedJson = arrayMatch[0].replace(
                    /(?<!\\)'([^']*)'(?=\s*[,}\]])/g,
                    '"$1"'
                );
                jsonData = JSON.parse(normalizeJsonString(normalizedJson));
            } catch (_e) {
                logger.warn("Could not parse text as JSON, returning null");
            }
        }
    }

    if (Array.isArray(jsonData)) {
        return jsonData;
    }

    return null;
}

/**
 * Parses a JSON object from a given text. The function looks for a JSON block wrapped in triple backticks
 * with `json` language identifier, and if not found, it searches for an object pattern within the text.
 * It then attempts to parse the JSON string into a JavaScript object. If parsing is successful and the result
 * is an object (but not an array), it returns the object; otherwise, it tries to parse an array if the result
 * is an array, or returns null if parsing is unsuccessful or the result is neither an object nor an array.
 *
 * @param text - The input text from which to extract and parse the JSON object.
 * @returns An object parsed from the JSON string if successful; otherwise, null or the result of parsing an array.
 */
export function parseJSONObjectFromText(
    text: string
): Record<string, any> | null {
    let jsonData = null;
    const jsonBlockMatch = text.match(jsonBlockPattern);

    try {
        if (jsonBlockMatch) {
            // Parse the JSON from inside the code block
            jsonData = JSON.parse(jsonBlockMatch[1].trim());
        } else {
            // Try to parse the text directly if it's not in a code block
            jsonData = JSON.parse(normalizeJsonString(text.trim()));
        }
    } catch (_e) {
        logger.warn("Could not parse text as JSON, returning null");
        return null;
    }

    // Ensure we have a non-null object that's not an array
    if (jsonData && typeof jsonData === "object" && !Array.isArray(jsonData)) {
        return jsonData;
    }

    logger.warn("Could not parse text as JSON, returning null");

    return null;
}

/**
 * Extracts specific attributes (e.g., user, text, action) from a JSON-like string using regex.
 * @param response - The cleaned string response to extract attributes from.
 * @param attributesToExtract - An array of attribute names to extract.
 * @returns An object containing the extracted attributes.
 */
export function extractAttributes(
    response: string,
    attributesToExtract?: string[]
): { [key: string]: string | undefined } {
    const attributes: { [key: string]: string | undefined } = {};

    if (!attributesToExtract || attributesToExtract.length === 0) {
        // Extract all attributes if no specific attributes are provided
        const matches = response.matchAll(/"([^"]+)"\s*:\s*"([^"]*)"/g);
        for (const match of matches) {
            attributes[match[1]] = match[2];
        }
    } else {
        // Extract only specified attributes
        for (const attribute of attributesToExtract) {
            const match = response.match(
                new RegExp(`"${attribute}"\\s*:\\s*"([^"]*)"`, "i")
            );
            if (match) {
                attributes[attribute] = match[1];
            }
        }
    }

    return attributes;
}

/**
 * Normalizes a JSON-like string by correcting formatting issues:
 * - Removes extra spaces after '{' and before '}'.
 * - Wraps unquoted values in double quotes.
 * - Converts single-quoted values to double-quoted.
 * - Ensures consistency in key-value formatting.
 * - Normalizes mixed adjacent quote pairs.
 *
 * This is useful for cleaning up improperly formatted JSON strings
 * before parsing them into valid JSON.
 *
 * @param str - The JSON-like string to normalize.
 * @returns A properly formatted JSON string.
 */

export const normalizeJsonString = (str: string) => {
    // Remove extra spaces after '{' and before '}'
    str = str.replace(/\{\s+/, '{').replace(/\s+\}/, '}').trim();

    // "key": unquotedValue → "key": "unquotedValue"
    str = str.replace(
      /("[\w\d_-]+")\s*: \s*(?!"|\[)([\s\S]+?)(?=(,\s*"|\}$))/g,
      '$1: "$2"',
    );

    // "key": 'value' → "key": "value"
    str = str.replace(
      /"([^"]+)"\s*:\s*'([^']*)'/g,
      (_, key, value) => `"${key}": "${value}"`,
    );

    // "key": someWord → "key": "someWord"
    str = str.replace(/("[\w\d_-]+")\s*:\s*([A-Za-z_]+)(?!["\w])/g, '$1: "$2"');

    // Replace adjacent quote pairs with a single double quote
    str = str.replace(/(?:"')|(?:'")/g, '"');
    return str;
};

/**
 * Cleans a JSON-like response string by removing unnecessary markers, line breaks, and extra whitespace.
 * This is useful for handling improperly formatted JSON responses from external sources.
 *
 * @param response - The raw JSON-like string response to clean.
 * @returns The cleaned string, ready for parsing or further processing.
 */

export function cleanJsonResponse(response: string): string {
    return response
        .replace(/```json\s*/g, "") // Remove ```json
        .replace(/```\s*/g, "") // Remove any remaining ```
        .replace(/(\r\n|\n|\r)/g, "") // Remove line breaks
        .trim();
}

export const postActionResponseFooter = "Choose any combination of [LIKE], [RETWEET], [QUOTE], and [REPLY] that are appropriate. Each action must be on its own line. Your response must only include the chosen actions.";

type ActionResponse = {
    like: boolean;
    retweet: boolean;
    quote?: boolean;
    reply?: boolean;
}

export const parseActionResponseFromText = (
    text: string
): { actions: ActionResponse } => {
    const actions: ActionResponse = {
        like: false,
        retweet: false,
        quote: false,
        reply: false,
    };

    // Regex patterns
    const likePattern = /\[LIKE\]/i;
    const retweetPattern = /\[RETWEET\]/i;
    const quotePattern = /\[QUOTE\]/i;
    const replyPattern = /\[REPLY\]/i;

    // Check with regex
    actions.like = likePattern.test(text);
    actions.retweet = retweetPattern.test(text);
    actions.quote = quotePattern.test(text);
    actions.reply = replyPattern.test(text);

    // Also do line by line parsing as backup
    const lines = text.split("\n");
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === "[LIKE]") actions.like = true;
        if (trimmed === "[RETWEET]") actions.retweet = true;
        if (trimmed === "[QUOTE]") actions.quote = true;
        if (trimmed === "[REPLY]") actions.reply = true;
    }

    return { actions };
};

/**
 * Truncate text to fit within the character limit, ensuring it ends at a complete sentence.
 */
export function truncateToCompleteSentence(
    text: string,
    maxLength: number
): string {
    if (text.length <= maxLength) {
        return text;
    }

    // Attempt to truncate at the last period within the limit
    const lastPeriodIndex = text.lastIndexOf(".", maxLength - 1);
    if (lastPeriodIndex !== -1) {
        const truncatedAtPeriod = text.slice(0, lastPeriodIndex + 1).trim();
        if (truncatedAtPeriod.length > 0) {
            return truncatedAtPeriod;
        }
    }

    // If no period, truncate to the nearest whitespace within the limit
    const lastSpaceIndex = text.lastIndexOf(" ", maxLength - 1);
    if (lastSpaceIndex !== -1) {
        const truncatedAtSpace = text.slice(0, lastSpaceIndex).trim();
        if (truncatedAtSpace.length > 0) {
            return `${truncatedAtSpace}...`;
        }
    }

    // Fallback: Hard truncate and add ellipsis
    const hardTruncated = text.slice(0, maxLength - 3).trim();
    return `${hardTruncated}...`;
}

// Assuming ~4 tokens per character on average
const TOKENS_PER_CHAR = 4;
const TARGET_TOKENS = 3000;
const _TARGET_CHARS = Math.floor(TARGET_TOKENS / TOKENS_PER_CHAR); // ~750 chars

export async function splitChunks(
    content: string,
    chunkSize = 512,
    bleed = 20
): Promise<string[]> {
    logger.debug("[splitChunks] Starting text split");

    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: Number(chunkSize),
        chunkOverlap: Number(bleed),
    });

    const chunks = await textSplitter.splitText(content);
    logger.debug("[splitChunks] Split complete:", {
        numberOfChunks: chunks.length,
        averageChunkSize: chunks.reduce((acc, chunk) => acc + chunk.length, 0) / chunks.length,
    });

    return chunks;
}

/**
 * Trims the provided text prompt to a specified token limit using a tokenizer model and type.
 */
export async function trimTokens(
    prompt: string,
    maxTokens: number,
    runtime: IAgentRuntime
  ) {
    if (!prompt) throw new Error("Trim tokens received a null prompt");
    
    // if prompt is less than of maxtokens / 5, skip
    if (prompt.length < (maxTokens / 5)) return prompt;
  
    if (maxTokens <= 0) throw new Error("maxTokens must be positive");
  
    try {
        const tokens = await runtime.useModel(ModelTypes.TEXT_TOKENIZER_ENCODE, { prompt });
  
        // If already within limits, return unchanged
        if (tokens.length <= maxTokens) {
            return prompt;
        }
  
        // Keep the most recent tokens by slicing from the end
        const truncatedTokens = tokens.slice(-maxTokens);
  
        // Decode back to text
        return await runtime.useModel(ModelTypes.TEXT_TOKENIZER_DECODE, { tokens: truncatedTokens });
    } catch (error) {
        logger.error("Error in trimTokens:", error);
        // Return truncated string if tokenization fails
        return prompt.slice(-maxTokens * 4); // Rough estimate of 4 chars per token
    }
  }