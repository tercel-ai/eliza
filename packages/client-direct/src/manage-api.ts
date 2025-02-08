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
    type UUID,
    validateCharacterConfig,
    ServiceType,
    type Character,
    type PaginationParams,
    AccountStatus,
    stringToUuid
} from "@elizaos/core";

import type { TeeLogQuery, TeeLogService } from "@elizaos/plugin-tee-log";
import { REST, Routes } from "discord.js";
import type { DirectClient } from ".";

export function createManageApiRouter(
    agents: Map<string, AgentRuntime>,
    directClient: DirectClient
) {
    const router = express.Router();

    router.use(cors());
    router.use(bodyParser.json());
    router.use(bodyParser.urlencoded({ extended: true }));
    router.use(
        express.json({
            limit: getEnvVariable("EXPRESS_MAX_PAYLOAD") || "100kb",
        })
    );

    router.get("/accounts", async (req, res) => {
        const params: PaginationParams = {
            page: req.query.page ? Number(req.query.page) : 1,
            pageSize: req.query.pageSize ? Number(req.query.pageSize) : 10,
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
    });

    router.post("/account/update", async (req, res) => {
        const character: any = {...req.body};
        try {
            const userId = character.id || stringToUuid(character.username || character.name || uuidv4());
            let account = await directClient.db.getAccountById(userId);
            if(account) {
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

    return router;
}
