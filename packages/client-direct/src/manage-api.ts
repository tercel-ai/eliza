import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import os from "os";

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
    ModelProviderName,
} from "@elizaos/core";

import type { DirectClient } from ".";
import { validateUUIDParams } from ".";
import { md5, signToken, verifyToken } from "./auth";

type SystemMetrics = {
    pid: number; // process id
    hostname: string; // hostname
    uptime: number; // uptime in seconds
    platform: string; // operating system
    nodeVersion: string; // node.js version
    memoryUsage: {
      rss: number; // resident set size in bytes
      heapTotal: number; // total heap size in bytes
      heapUsed: number; // used heap size in bytes
      external: number; // external memory usage in bytes
      arrayBuffers: number; // array buffer memory usage in bytes
      heapUsageRatio: number; // heap usage ratio
      heapIncrease: number; // heap increase in bytes
      totalMemory: number; // total memory in bytes
      freeMemory: number; // free memory in bytes
    },
    cpuUsage: {
      cores: number; // number of cores
      model: string; // cpu model
      speed: number; // cpu speed in MHz
      loadAvg: number[]; // load average in 1, 5, 15 minutes
      usage: {
        user: number; // user time in milliseconds
        system: number; // system time in milliseconds
        percentage: number; // cpu usage percentage
      }
    },
    diskSpace: {
        total: number; // total disk space in bytes
        free: number; // free disk space in bytes
        used: number; // used disk space in bytes
        usedPercent: number; // used disk space percentage
    }
    [key: string]: any;
}

const { heapUsed } = process.memoryUsage();
let lastHeapUsed = heapUsed;

async function verifyTokenMiddleware(req: any, res: any, next) {
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
            const verified = await verifyToken(token);
            res.json({ success: true, token: token, exp: verified.exp });
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
                for (const item of result.list) {
                    if (typeof item.details === "string") {
                        item.details = item.details ? JSON.parse(item.details) : {};
                    }
                    const agent = agents.get(item.id);
                    if(!agent && item.status === AccountStatus.ACTIVE) {
                        item.status = AccountStatus.PAUSED;
                        await changeAccountStatus(item.id, AccountStatus.PAUSED);
                    }
                }
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
        const agent = agents.get(accountId);
        if(!agent && account.status === AccountStatus.ACTIVE) {
            account.status = AccountStatus.PAUSED;
            await changeAccountStatus(accountId, AccountStatus.PAUSED);
        }
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
                    throw new Error(`Account already exists, username is not unique: ${character.username}`);
                }
                account = {
                    id: userId,
                    name: character.name || character.username,
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

    router.get("/plugins", async (req, res) => {
        try {
            res.json(directClient.plugins);
        } catch (err) {
            elizaLogger.error('Error getting plugins:', err);
            res.status(500).json({
                error: "Failed to get plugins list",
                message: err.message
            });
        }
    });

    router.get("/memories", async (req, res, next) => {
        try {
            const params: PaginationParams = {
                page: req.query.page ? Number(req.query.page) : 1,
                pageSize: req.query.pageSize ? Number(req.query.pageSize) : 10,
                where: req.query.where ? JSON.parse(req.query.where as string) : {},
                order: req.query.order ? JSON.parse(req.query.order as string) : {createdAt: 'DESC'},
            }
            const result = await directClient.db.paginate('memories', params);
            if(result.total) {
                result.list = result.list.map((item: any) => {
                    if (typeof item.content === "string") {
                        item.content = item.content ? JSON.parse(item.content) : {};
                    }
                    delete item.embedding;
                    return item;
                });
            }
            res.json(result);
        } catch (err) {
            elizaLogger.error('Error in memories', err);
            res.status(400).json({
                error: err.message,
            });
        }
    });

    router.get("/clients", async (req, res) => {
        try {
            res.json(directClient.clients);
        } catch (err) {
            elizaLogger.error('Error getting clients:', err);
            res.status(500).json({
                error: "Failed to get clients list",
                message: err.message
            });
        }
    });

    router.get("/providers", async (req, res) => {
        const providers = Object.values(ModelProviderName);
        res.json(providers);
    });

    router.get("/logs/stream", (req, res) => {
        const clientId = uuidv4();
        let now = new Date().getTime();
        
        // Set headers for SSE
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        // Send initial connection message
        res.write(`data: {"level":30,"time":${now},"msg":"${clientId} connected"}\n\n`);

        // Setup heartbeat
        const heartbeatInterval = setInterval(() => {
            try {
                now = new Date().getTime();
                res.write(`data: {"level":30,"time":${now},"msg":"heartbeat"}\n\n`);
            } catch (err) {
                cleanup();
            }
        }, 30000);

        // Subscribe to logs
        const unsubscribe = elizaLogger.subscribe((logData) => {
            try {
                res.write(`data: ${logData}\n\n`);
            } catch (err) {
                cleanup();
            }
        });

        // Cleanup function
        const cleanup = () => {
            clearInterval(heartbeatInterval);
            unsubscribe();
        };

        // Handle client disconnect
        req.on('close', cleanup);
        req.on('error', cleanup);

        // Set connection timeout
        const connectionTimeout = setTimeout(() => {
            now = new Date().getTime();
            res.write(`data: {"level":30,"time":${now},"msg":"Connection timed out after 4 hours"}\n\n`);
            res.end();
            cleanup();
        }, 4 * 60 * 60 * 1000); // 4 hours

        // Cleanup timeout on disconnect
        req.on('close', () => {
            clearTimeout(connectionTimeout);
        });
    });

    router.get("/system/metrics", async (req, res) => {
        // get more detailed CPU info
        const getCPUInfo = async() => {
            const cpus = os.cpus();
            const startUsage = process.cpuUsage();
            
            // wait a short time to calculate CPU usage
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const endUsage = process.cpuUsage(startUsage);
            const totalTime = endUsage.user + endUsage.system;
            const percentage = (totalTime / (0.1 * os.cpus().length * 1e6)) * 100;

            return {
                cores: cpus.length,
                model: cpus[0].model,
                speed: cpus[0].speed, // MHz
                loadAvg: os.loadavg(), // 1, 5, 15 minutes average load
                usage: {
                    ...endUsage,
                    percentage
                }
            };
        }

        const checkHeapUsageRatio= (usage: any) => {
            
            // calculate heap usage ratio
            const heapUsageRatio = usage.heapUsed / usage.heapTotal;
            
            // set warning threshold
            if (heapUsageRatio > 0.95) {
                elizaLogger.warn(`High heap usage: ${(heapUsageRatio * 100).toFixed(2)}%`);
            }
            
            // convert to MB for easier reading
            const rssInMB = usage.rss / 1024 / 1024;
            // physical memory threshold 
            const RSS_THRESHOLD_MB = (os.totalmem() / 1024 / 1024) * 0.7;
            if (rssInMB > RSS_THRESHOLD_MB) {
                elizaLogger.warn(`High memory usage: ${rssInMB.toFixed(2)}MB`);
            }
            
            return heapUsageRatio;
        }

        const memoryHeapIncrease = (usage: any) => {
            // check if heap memory is growing
            let increase = 0;
            if(lastHeapUsed > 0) {
                increase = usage.heapUsed - lastHeapUsed;
                lastHeapUsed = usage.heapUsed;
                return increase;
            }
            lastHeapUsed = usage.heapUsed;
            return increase;
        }

        const memoryInfo = () => { 
            const usage = process.memoryUsage();
            return {
                ...usage,
                heapUsageRatio: checkHeapUsageRatio(usage),
                heapIncrease: memoryHeapIncrease(usage),
                totalMemory: os.totalmem(),
                freeMemory: os.freemem(),
            };
        }

        const getDiskSpace = async (path: string = '/'): Promise<{
            total: number;
            free: number;
            used: number;
            usedPercent: number;
        }> => {
            try {
                const stats = await fs.promises.statfs(path);
                const total = stats.blocks * stats.bsize;
                const free = stats.bfree * stats.bsize;
                const used = total - free;
                const usedPercent = used / total;
        
                return {
                    total,
                    free,
                    used,
                    usedPercent: Number(usedPercent.toFixed(2))
                };
            } catch (error) {
                elizaLogger.error('Error getting disk space:', error);
                throw error;
            }
        }
        
        try {
            const metrics: SystemMetrics = {
                pid: process.pid,
                hostname: os.hostname(),
                uptime: process.uptime(),
                platform: process.platform,
                nodeVersion: process.version,
                memoryUsage: memoryInfo(),
                cpuUsage: await getCPUInfo(),
                diskSpace: await getDiskSpace(),
            }
            res.json(metrics);
        } catch (err) {
            elizaLogger.error('Error getting system info:', err);
            res.status(500).json({
                error: "Failed to get system info",
                message: err.message
            });
        }
    });

    return router;
}
