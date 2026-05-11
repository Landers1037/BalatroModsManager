export interface AppConfig {
  modsDir: string | null
}

export interface ConfigPaths {
  configDir: string
  configFile: string
}

export interface ModMetadata {
  name?: string
  id?: string
  author?: string
  description?: string
  displayName?: string
}

export interface ModEntry {
  fileName: string
  filePath: string
  targetFileName: string
  targetFilePath: string
  enabled: boolean
  selected: boolean
  title: string
  initName: string
  metadata: ModMetadata
  topComment: string
  detailText: string
}

export interface ScanResult {
  mods: ModEntry[]
  ignoredFiles: string[]
}

export interface ApplyResult {
  changed: number
  errors: string[]
}
