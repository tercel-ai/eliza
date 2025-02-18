import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';
import { elizaLogger } from "@elizaos/core";
import { getAndParseReadme } from "./document";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ClientInfo {
  package: string;
  name: string,
  env?: Record<string, string|number|boolean>;
  document?: string;
}

async function getClientInfo(clientDir: string): Promise<ClientInfo | null> {
  try {
    // get package.json
    const packageJsonPath = path.join(clientDir, 'package.json');
    elizaLogger.debug(`Reading package.json from: ${packageJsonPath}`);
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    
    // try to read README.md with case-insensitive search
    const {document, env} = await getAndParseReadme(clientDir);

    return {
      package: packageJson.name,
      name: packageJson.name.startsWith('@elizaos/client-') ? packageJson.name.slice(16) : packageJson.name,
      env,
      document,
    };
  } catch (error) {
    elizaLogger.error(`Error loading client from ${clientDir}:`, error.message);
    return null;
  }
}

export async function getClients() {
  try {
    // Read package.json from the agent directory
    const packageJsonPath = path.resolve(__dirname, '../package.json');
    elizaLogger.log(`Reading package.json from: ${packageJsonPath}`);
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    
    // Get all client dependencies (starting with @elizaos/client-)
    const clientPackages = Object.keys(packageJson.dependencies || {})
      .filter(dep => dep.startsWith('@elizaos/client-'))
      .sort();
    
    elizaLogger.info(`Found ${clientPackages.length} client packages in package.json`);
    
    // Get client info for each package
    const clientsInfo = await Promise.all(
      clientPackages.map(async (packageName) => {
        try {
          // Import client module to get client info
          elizaLogger.log(`load client: ${packageName}`);
          // Try to read README.md from node_modules
          const nodeModulesDir = path.resolve(__dirname, '../node_modules');
          const clientDir = path.join(nodeModulesDir, packageName);
          
          const {document, env} = await getAndParseReadme(clientDir);

          return {
            package: packageName,
            name: packageName.startsWith('@elizaos/client-') ? packageName.slice(16) : packageName,
            env, 
            document,
          };
        } catch (error) {
          elizaLogger.error(`Error loading client ${packageName}:`, error.message);
          return null;
        }
      })
    );

    // Filter out clients that failed to load
    const validClients = clientsInfo.filter(Boolean);
    elizaLogger.info(`Successfully loaded ${validClients.length} clients`);

    return validClients;
  } catch (error) {
    elizaLogger.error('Error getting clients:', error);
    throw error;
  }
}
