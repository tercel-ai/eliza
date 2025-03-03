export const MESSAGE_CONSTANTS = {
    MAX_MESSAGES: 50,
    RECENT_MESSAGE_COUNT: 5,
    CHAT_HISTORY_COUNT: 10,
    DEFAULT_SIMILARITY_THRESHOLD: 0.6,
    DEFAULT_SIMILARITY_THRESHOLD_FOLLOW_UPS: 0.4,
    INTEREST_DECAY_TIME: 5 * 60 * 1000, // 5 minutes
    PARTIAL_INTEREST_DECAY: 3 * 60 * 1000, // 3 minutes
} as const;

export const TELEGRAM_CLIENT_NAME = 'telegram';
