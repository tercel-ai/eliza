import {
    type Action,
    type ActionExample,
    composePrompt,
    type Content,
    type HandlerCallback,
    type IAgentRuntime,
    logger,
    type Memory,
    ModelTypes,
    parseJSONObjectFromText,
    type State,
} from '@elizaos/core';
import {
    createAssociatedTokenAccountInstruction,
    createTransferInstruction,
    getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import {
    Connection,
    PublicKey,
    SystemProgram,
    TransactionMessage,
    VersionedTransaction,
} from '@solana/web3.js';
import { getWalletKey } from '../keypairUtils';

interface TransferContent extends Content {
    tokenAddress: string | null; // null for SOL transfers
    recipient: string;
    amount: string | number;
}

function isTransferContent(content: any): content is TransferContent {
    logger.log('Content for transfer', content);

    // Base validation
    if (!content.recipient || typeof content.recipient !== 'string') {
        return false;
    }

    // SOL transfer validation
    if (content.tokenAddress === null) {
        return typeof content.amount === 'number';
    }

    // SPL token transfer validation
    if (typeof content.tokenAddress === 'string') {
        return typeof content.amount === 'string' || typeof content.amount === 'number';
    }

    return false;
}

const transferTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Example responses:
For SPL tokens:
\`\`\`json
{
    "tokenAddress": "BieefG47jAHCGZBxi2q87RDuHyGZyYC3vAzxpyu8pump",
    "recipient": "9jW8FPr6BSSsemWPV22UUCzSqkVdTp6HTyPqeqyuBbCa",
    "amount": "1000"
}
\`\`\`

For SOL:
\`\`\`json
{
    "tokenAddress": null,
    "recipient": "9jW8FPr6BSSsemWPV22UUCzSqkVdTp6HTyPqeqyuBbCa",
    "amount": 1.5
}
\`\`\`

{{recentMessages}}

Extract the following information about the requested transfer:
- Token contract address (use null for SOL transfers)
- Recipient wallet address
- Amount to transfer
`;

export default {
    name: 'TRANSFER_SOLANA',
    similes: [
        'TRANSFER_SOL',
        'SEND_TOKEN_SOLANA',
        'TRANSFER_TOKEN_SOLANA',
        'SEND_TOKENS_SOLANA',
        'TRANSFER_TOKENS_SOLANA',
        'SEND_SOL',
        'SEND_TOKEN_SOL',
        'PAY_SOL',
        'PAY_TOKEN_SOL',
        'PAY_TOKENS_SOL',
        'PAY_TOKENS_SOLANA',
        'PAY_SOLANA',
    ],
    validate: async (_runtime: IAgentRuntime, message: Memory) => {
        logger.log('Validating transfer from entity:', message.entityId);
        return true;
    },
    description: 'Transfer SOL or SPL tokens to another address on Solana.',
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback,
    ): Promise<boolean> => {
        logger.log('Starting TRANSFER handler...');

        let currentState = state;
        if (!currentState) {
            currentState = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.composeState(message, {}, ['RECENT_MEMORIES']);
        }

        const transferPrompt = composePrompt({
            state: currentState,
            template: transferTemplate,
        });

        const result = await runtime.useModel(ModelTypes.TEXT_LARGE, {
            prompt: transferPrompt,
        });

        const content = parseJSONObjectFromText(result);

        console.log('Content:', content);

        if (!isTransferContent(content)) {
            if (callback) {
                callback({
                    text: 'Need a valid recipient address and amount to transfer.',
                    content: { error: 'Invalid transfer content' },
                });
            }
            return false;
        }

        try {
            const { keypair: senderKeypair } = await getWalletKey(runtime, true);
            const connection = new Connection(
                runtime.getSetting('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com',
            );
            const recipientPubkey = new PublicKey(content.recipient);

            let signature: string;

            // Handle SOL transfer
            if (content.tokenAddress === null) {
                const lamports = Number(content.amount) * 1e9;

                const instruction = SystemProgram.transfer({
                    fromPubkey: senderKeypair.publicKey,
                    toPubkey: recipientPubkey,
                    lamports,
                });

                const messageV0 = new TransactionMessage({
                    payerKey: senderKeypair.publicKey,
                    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
                    instructions: [instruction],
                }).compileToV0Message();

                const transaction = new VersionedTransaction(messageV0);
                transaction.sign([senderKeypair]);

                signature = await connection.sendTransaction(transaction);

                if (callback) {
                    callback({
                        text: `Sent ${content.amount} SOL. Transaction hash: ${signature}`,
                        content: {
                            success: true,
                            signature,
                            amount: content.amount,
                            recipient: content.recipient,
                        },
                    });
                }
            }
            // Handle SPL token transfer
            else {
                const mintPubkey = new PublicKey(content.tokenAddress);
                const mintInfo = await connection.getParsedAccountInfo(mintPubkey);
                const decimals = (mintInfo.value?.data as any)?.parsed?.info?.decimals ?? 9;
                const adjustedAmount = BigInt(Number(content.amount) * 10 ** decimals);

                const senderATA = getAssociatedTokenAddressSync(
                    mintPubkey,
                    senderKeypair.publicKey,
                );
                const recipientATA = getAssociatedTokenAddressSync(mintPubkey, recipientPubkey);

                const instructions = [];

                const recipientATAInfo = await connection.getAccountInfo(recipientATA);
                if (!recipientATAInfo) {
                    instructions.push(
                        createAssociatedTokenAccountInstruction(
                            senderKeypair.publicKey,
                            recipientATA,
                            recipientPubkey,
                            mintPubkey,
                        ),
                    );
                }

                instructions.push(
                    createTransferInstruction(
                        senderATA,
                        recipientATA,
                        senderKeypair.publicKey,
                        adjustedAmount,
                    ),
                );

                const messageV0 = new TransactionMessage({
                    payerKey: senderKeypair.publicKey,
                    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
                    instructions,
                }).compileToV0Message();

                const transaction = new VersionedTransaction(messageV0);
                transaction.sign([senderKeypair]);

                signature = await connection.sendTransaction(transaction);

                if (callback) {
                    callback({
                        text: `Sent ${content.amount} tokens to ${content.recipient}\nTransaction hash: ${signature}`,
                        content: {
                            success: true,
                            signature,
                            amount: content.amount,
                            recipient: content.recipient,
                        },
                    });
                }
            }

            return true;
        } catch (error) {
            logger.error('Error during transfer:', error);
            if (callback) {
                callback({
                    text: `Transfer failed: ${error.message}`,
                    content: { error: error.message },
                });
            }
            return false;
        }
    },

    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Send 1.5 SOL to 9jW8FPr6BSSsemWPV22UUCzSqkVdTp6HTyPqeqyuBbCa',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'Sending SOL now...',
                    actions: ['TRANSFER_SOLANA'],
                },
            },
        ],
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'Send 69 $DEGENAI BieefG47jAHCGZBxi2q87RDuHyGZyYC3vAzxpyu8pump to 9jW8FPr6BSSsemWPV22UUCzSqkVdTp6HTyPqeqyuBbCa',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'Sending the tokens now...',
                    actions: ['TRANSFER_SOLANA'],
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
