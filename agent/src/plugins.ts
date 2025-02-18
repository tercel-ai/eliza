import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';
import { elizaLogger } from "@elizaos/core";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PluginInfo {
  package: string;
  name: string;
  plugin: {
    [key: string]: {
      name: string;
      description?: string;
      [key: string]: any;
    }
  },
  document?: string;
}

async function getPluginInfo(pluginDir: string): Promise<PluginInfo | null> {
  try {
    // get package.json
    const packageJsonPath = path.join(pluginDir, 'package.json');
    elizaLogger.debug(`Reading package.json from: ${packageJsonPath}`);
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    
    // try to read README.md or readme.md
    let document;
    try {
      document = fs.readFileSync(path.join(pluginDir, 'README.md'), 'utf-8');
    } catch {
      try {
        document = fs.readFileSync(path.join(pluginDir, 'readme.md'), 'utf-8');
      } catch {
        // if no readme file, ignore
      }
    }

    // import plugin module to get plugin info
    elizaLogger.log(`Importing plugin module: ${packageJson.name}`);
    const pluginModule = await import(packageJson.name);
    const plugin = {};
    const pluginSuffix = 'Plugin';
    
    for (const [key, value] of Object.entries(pluginModule)) {
      if (key.endsWith(pluginSuffix) && typeof value === 'object') {
        const pluginName = key.slice(0, -pluginSuffix.length);
        plugin[key] = {
          name: value.name || pluginName,
          description: value.description
        };
      }
    }

    return {
      package: packageJson.name,
      name: packageJson.name.startsWith('@elizaos/plugin-') ? packageJson.name.slice(16) : packageJson.name,
      plugin,
      document,
    };
  } catch (error) {
    elizaLogger.error(`Error loading plugin from ${pluginDir}:`, error.message);
    return null;
  }
}

export async function getPlugins() {
  try {
    // Read package.json from the agent directory
    const packageJsonPath = path.resolve(__dirname, '../package.json');
    elizaLogger.log(`Reading package.json from: ${packageJsonPath}`);
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    
    // Get all plugin dependencies (starting with @elizaos/plugin-)
    const pluginPackages = Object.keys(packageJson.dependencies || {})
      .filter(dep => dep.startsWith('@elizaos/plugin-'))
      .sort();
    
    elizaLogger.info(`Found ${pluginPackages.length} plugin packages in package.json`);
    
    // Get plugin info for each package
    const pluginsInfo = await Promise.all(
      pluginPackages.map(async (packageName) => {
        try {
          // Import plugin module to get plugin info
          elizaLogger.log(`Importing plugin module: ${packageName}`);
          const pluginModule = await import(packageName);
          const plugin = {};
          const pluginSuffix = 'Plugin';
          
          for (const [key, value] of Object.entries(pluginModule)) {
            if (key.endsWith(pluginSuffix) && typeof value === 'object') {
              const pluginName = key.slice(0, -pluginSuffix.length);
              plugin[key] = {
                name: value.name || pluginName,
                description: value.description
              };
            }
          }

          // Try to read README.md from node_modules
          let document;
          const nodeModulesDir = path.resolve(__dirname, '../node_modules');
          const pluginDir = path.join(nodeModulesDir, packageName);
          try {
            const files = fs.readdirSync(pluginDir);
            const readmeFile = files.find(file => file.toLowerCase() === 'readme.md');
            if (readmeFile) {
              document = fs.readFileSync(path.join(pluginDir, readmeFile), 'utf-8');
            }
          } catch (error) {
            elizaLogger.debug(`No README.md found in ${pluginDir}`);
          }

          return {
            package: packageName,
            name: packageName.startsWith('@elizaos/plugin-') ? packageName.slice(16) : packageName,
            plugin,
            document,
          };
        } catch (error) {
          elizaLogger.error(`Error loading plugin ${packageName}:`, error.message);
          return null;
        }
      })
    );

    // Filter out plugins that failed to load
    const validPlugins = pluginsInfo.filter(Boolean);
    elizaLogger.info(`Successfully loaded ${validPlugins.length} plugins`);

    return validPlugins;
  } catch (error) {
    elizaLogger.error('Error getting plugins:', error);
    throw error;
  }
}
