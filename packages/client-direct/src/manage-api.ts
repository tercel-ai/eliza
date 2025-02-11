import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

import {
    type AgentRuntime,
    elizaLogger,
    getEnvVariable,
    validateCharacterConfig,
    type UUID,
    type Character,
    type PaginationParams,
    AccountStatus,
    stringToUuid,
    settings,
} from "@elizaos/core";

import type { DirectClient } from ".";
import { validateUUIDParams } from ".";
import { md5, signToken, verifyToken } from "./auth";


async function verifyTokenMiddleware(req: any, res: any, next) {
    console.log("verifyTokenMiddleware", req.url);
    // if JWT is not enabled, skip verification
    if (!(settings.JWT_ENABLED && settings.JWT_ENABLED.toLowerCase() === 'true')) {
        next();
        return;
    }

    const url: string = req.url.split('?')[0];
    if (url.indexOf('/login') === 0) {
        next();
    } else {
        try {
            const { authorization } = req.headers;
            if (!authorization) throw new Error('no token');
            const token = authorization.startsWith('Bearer ') 
            ? authorization.split(' ')[1] 
            : authorization;
            const verified = await verifyToken(token);
            if (verified) {
                next();
            } else {
                throw new Error('fail to verify token');
            }
        } catch (err: any) {
            res.status(401).json({ error: err.message });
            return;
        }
    }
};


export function createManageApiRouter(
    agents: Map<string, AgentRuntime>,
    directClient: DirectClient
): express.Router {
    const router = express.Router();

    router.use(cors());
    router.use(bodyParser.json());
    router.use(bodyParser.urlencoded({ extended: true }));
    router.use(
        express.json({
            limit: getEnvVariable("EXPRESS_MAX_PAYLOAD") || "100kb",
        })
    );

    router.use(verifyTokenMiddleware);

    const changeAccountStatus = async (accountId: UUID, status: AccountStatus) => {
        const account = await directClient.db.getAccountById(accountId);
        if(account) {
            account.status = status;
            await directClient.db.updateAccount(account);
        }
    }

    router.post("/login", async (req, res) => {
        const { username, password } = req.body;
        const valid = username === settings.JWT_USERNAME && password === md5(settings.JWT_PASSWORD);
        if (valid) {
            const token = signToken({ username });
            res.json({ success: true, token: token });
        } else {
            res.status(400).json({ error: "Invalid username or password" });
        }
    });

    router.get("/accounts", async (req, res, next) => {
        try {
            const params: PaginationParams = {
                page: req.query.page ? Number(req.query.page) : 1,
                pageSize: req.query.pageSize ? Number(req.query.pageSize) : 10,
                where: req.query.where ? JSON.parse(req.query.where as string) : {},
                order: req.query.order ? JSON.parse(req.query.order as string) : {createdAt: 'DESC'},
            }
            const result = await directClient.db.paginate('accounts', params);
            if(result.total) {
                result.list = result.list.map((item: any) => {
                    if (typeof item.details === "string") {
                        item.details = item.details ? JSON.parse(item.details) : {};
                    }
                    return item;
                });
            }
            res.json(result);
        } catch (err) {
            elizaLogger.error('Error in accounts', err);
            res.status(400).json({
                error: err.message,
            });
        }
    });

    router.get("/account/:accountId", async (req, res) => {
        const accountId = req.params.accountId as UUID;
        const account = await directClient.db.getAccountById(accountId);
        res.json(account);
    });

    router.post("/account/update", async (req, res) => {
        const character = req.body;
        try {
            
            if(character.id) {
                const account = await directClient.db.getAccountById(character.id);
                if(!account) {
                    throw new Error('Account not found');
                }
                delete character.id;
                Object.assign(account.details, character);
                if('name' in character) account.name = character.name;
                if('email' in character) account.email = character.email;
                if('avatarUrl' in character) account.avatarUrl = character.avatarUrl;
                validateCharacterConfig(account.details);
                await directClient.db.updateAccount(account);
                elizaLogger.log(`${character.name} updated`);
                res.json({
                    success: true,
                    action: "update",
                    data: account,
                });
            } else {
                const userId = stringToUuid(character.username || character.name || uuidv4());
                let account = await directClient.db.getAccountById(userId);
                if(account) {
                    throw new Error('Account already exists');
                }
                account = {
                    id: userId,
                    name: character.name,
                    username: character.username || character.name,
                    email: character.email || userId,
                    avatarUrl: character.avatarUrl || "",
                    status: AccountStatus.PAUSED,
                    details: character,
                }
                validateCharacterConfig(account.details);
                await directClient.db.createAccount(account);
                elizaLogger.log(`${character.name} created`);
                res.json({
                    success: true,
                    action: "create",
                    data: account,
                });
            }
            
        } catch (e) {
            elizaLogger.error(`Error parsing character: ${e}`);
            res.status(400).json({
                error: e.message,
            });
            return;
        }
    });

    router.delete("/agents/:agentId", async (req, res) => {
        const { agentId } = validateUUIDParams(req.params, res) ?? {
            agentId: null,
        };
        if (!agentId) return;

        const agent: AgentRuntime = agents.get(agentId);

        if (agent) {
            agent.stop();
            directClient.unregisterAgent(agent);
            await changeAccountStatus(agentId, AccountStatus.DISABLED);
            res.status(204).json({ success: true });
        } else {
            res.status(404).json({ error: "Agent not found" });
        }
    });

    router.post("/agents/:agentId/set", async (req, res) => {
        const { agentId } = validateUUIDParams(req.params, res) ?? {
            agentId: null,
        };
        if (!agentId) return;

        let agent: AgentRuntime = agents.get(agentId);

        // update character
        if (agent) {
            // stop agent
            agent.stop();
            directClient.unregisterAgent(agent);
            // if it has a different name, the agentId will change
        }

        // stores the json data before it is modified with added data
        const characterJson = { ...req.body };

        // load character from body
        const character = req.body;
        try {
            validateCharacterConfig(character);
        } catch (e) {
            elizaLogger.error(`Error parsing character: ${e}`);
            res.status(400).json({
                success: false,
                message: e.message,
            });
            return;
        }

        // start it up (and register it)
        try {
            agent = await directClient.startAgent(character);
            elizaLogger.log(`${character.name} started`);
        } catch (e) {
            elizaLogger.error(`Error starting agent: ${e}`);
            res.status(500).json({
                success: false,
                message: e.message,
            });
            return;
        }

        if (process.env.USE_CHARACTER_STORAGE === "true") {
            try {
                const filename = `${agent.agentId}.json`;
                const uploadDir = path.join(
                    process.cwd(),
                    "data",
                    "characters"
                );
                const filepath = path.join(uploadDir, filename);
                await fs.promises.mkdir(uploadDir, { recursive: true });
                await fs.promises.writeFile(
                    filepath,
                    JSON.stringify(
                        { ...characterJson, id: agent.agentId },
                        null,
                        2
                    )
                );
                elizaLogger.info(
                    `Character stored successfully at ${filepath}`
                );
            } catch (error) {
                elizaLogger.error(
                    `Failed to store character: ${error.message}`
                );
            }
        }

        res.json({
            id: character.id,
            character: character,
        });
    });

    router.post("/agent/start", async (req, res) => {
        const { accountId, characterPath, characterJson } = req.body;
        try {
            let character: Character;
            if(accountId) {
                const account = await directClient.db.getAccountById(accountId);
                if(account) {
                    character = account.details as Character;
                    character.id = accountId;
                }
            } else if (characterJson) {
                character = await directClient.jsonToCharacter(
                    characterPath,
                    characterJson
                );
            } else if (characterPath) {
                character =
                    await directClient.loadCharacterTryPath(characterPath);
            } else {
                throw new Error("No character path or JSON provided");
            }
            await directClient.startAgent(character);
            await changeAccountStatus(character.id, AccountStatus.ACTIVE);
            elizaLogger.log(`${character.name} started`);

            res.json({
                id: character.id,
                character: character,
            });
        } catch (e) {
            elizaLogger.error(`Error parsing character: ${e}`);
            res.status(400).json({
                error: e.message,
            });
            return;
        }
    });

    router.post("/agents/:agentId/stop", async (req, res) => {
        const agentId = req.params.agentId as UUID;
        console.log("agentId", agentId);
        const agent: AgentRuntime = agents.get(agentId);

        // update character
        if (agent) {
            // stop agent
            agent.stop();
            await changeAccountStatus(agentId, AccountStatus.PAUSED);
            // if it has a different name, the agentId will change
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Agent not found" });
        }
    });

    return router;
}
