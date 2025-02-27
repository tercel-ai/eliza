import path from "path";
import fs from "fs";
import { elizaLogger } from "@elizaos/core";

export async function getReadme(dir: string) {
    // try to read README.md with case-insensitive search
    try {
        const files = fs.readdirSync(dir);
        const readmeFile = files.find(file => file.toLowerCase() === 'readme.md');
        if (readmeFile) {
            return fs.readFileSync(path.join(dir, readmeFile), 'utf-8');
        }
    } catch (error) {
        elizaLogger.debug(`No README.md found in ${dir}`);
        return null;
    }
}

export async function getAndParseReadme(dir: string) {
    const document = await getReadme(dir);
    const env: Record<string, string|number|boolean> = {};
    if (!document) {
        return {document: null, env: {}};
    }
    const envMatch = document.match(/```env\n([\s\S]*?)\n```/);
    if (envMatch) {
        const envLines = envMatch[1].split('\n').map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('#') && !line.startsWith(' #'));
        for (const line of envLines) {
            // remove comment
            const lineWithoutComment = line.split('#')[0].trim();
            const [key, ...valueParts] = lineWithoutComment.split('=');
            let value:any = valueParts.join('=').trim(); // handle value with =
            
            // handle number
            if (/^\d+$/.test(value)) {
                value = Number.parseInt(value, 10);
            }
            // else if (value.toLowerCase() === "true") {
            //     value = true;
            // } else if (value.toLowerCase() === "false") {
            //     value = false;
            // } 
            
            if (key) {
                env[key.trim()] = value;
            }
        }
    }
    return {document, env};
}