import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { homedir } from "node:os"
import type { AppConfig, ConfigPaths } from "./types"

const DEFAULT_CONFIG: AppConfig = {
  modsDir: null,
}

function getConfigPaths(): ConfigPaths {
  const configDir = join(homedir(), ".config", "BalatroMM")
  const configFile = join(configDir, "config.json")
  return { configDir, configFile }
}

export async function loadOrCreateConfig(): Promise<{
  config: AppConfig
  paths: ConfigPaths
}> {
  const paths = getConfigPaths()
  await mkdir(paths.configDir, { recursive: true })

  try {
    const raw = await readFile(paths.configFile, "utf8")
    const parsed = JSON.parse(raw) as Partial<AppConfig>
    return {
      config: {
        modsDir: parsed.modsDir ?? null,
      },
      paths,
    }
  } catch {
    await writeFile(paths.configFile, JSON.stringify(DEFAULT_CONFIG, null, 2), "utf8")
    return {
      config: { ...DEFAULT_CONFIG },
      paths,
    }
  }
}

export async function saveConfig(paths: ConfigPaths, config: AppConfig): Promise<void> {
  await mkdir(paths.configDir, { recursive: true })
  await writeFile(paths.configFile, JSON.stringify(config, null, 2), "utf8")
}
