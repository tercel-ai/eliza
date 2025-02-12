import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';
import { elizaLogger } from "@elizaos/core";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PluginInfo {
  package: string;
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
    // get packages directory
    const packagesDir = path.resolve(__dirname, '../../packages');
    elizaLogger.log(`Looking for plugins in: ${packagesDir}`);
    
    // Verify the directory exists
    if (!fs.existsSync(packagesDir)) {
      elizaLogger.error(`Packages directory not found: ${packagesDir}`);
      return [];
    }

    // Read directory contents
    const entries = fs.readdirSync(packagesDir);
    // elizaLogger.debug(`Found entries in packages dir:`, entries);
    
    // find all plugin-* directories
    const pluginDirs = entries
      .filter(entry => {
        const fullPath = path.join(packagesDir, entry);
        const isDir = fs.statSync(fullPath).isDirectory();
        const isPlugin = entry.startsWith('plugin-');
        elizaLogger.debug(`Entry ${entry}: isDir=${isDir}, isPlugin=${isPlugin}`);
        return isDir && isPlugin;
      })
      .map(entry => path.join(packagesDir, entry));

    pluginDirs.sort((a, b) => a.localeCompare(b));
    elizaLogger.info("Found plugin directories:", pluginDirs);
    
    // get all plugin info
    const pluginsInfo = await Promise.all(
      pluginDirs.map(dir => getPluginInfo(dir))
    );

    // filter out plugins that failed to load
    const validPlugins = pluginsInfo.filter(Boolean);
    elizaLogger.info(`Successfully loaded ${validPlugins.length} plugins`);

    return validPlugins;
  } catch (error) {
    elizaLogger.error('Error getting plugins:', error);
    throw error;
  }
}
