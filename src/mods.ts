import { readdir, readFile, rename } from "node:fs/promises"
import { basename, join } from "node:path"
import * as luaparse from "luaparse"
import type {
  ApplyResult,
  ModEntry,
  ModMetadata,
  ScanResult,
} from "./types"

const ENABLED_SUFFIX = ".lua"
const DISABLED_SUFFIX = ".lua.disable"

function isSupportedModFile(fileName: string): boolean {
  return fileName.endsWith(ENABLED_SUFFIX) || fileName.endsWith(DISABLED_SUFFIX)
}

function isEnabledFile(fileName: string): boolean {
  return fileName.endsWith(ENABLED_SUFFIX) && !fileName.endsWith(DISABLED_SUFFIX)
}

function buildTargetFileName(fileName: string, selected: boolean): string {
  if (selected) {
    return fileName.endsWith(DISABLED_SUFFIX)
      ? fileName.slice(0, -DISABLED_SUFFIX.length) + ENABLED_SUFFIX
      : fileName
  }

  return fileName.endsWith(ENABLED_SUFFIX) && !fileName.endsWith(DISABLED_SUFFIX)
    ? `${fileName}.disable`
    : fileName
}

export function withSelectedState(modsDir: string, mod: ModEntry, selected: boolean): ModEntry {
  const targetFileName = buildTargetFileName(mod.fileName, selected)
  return {
    ...mod,
    selected,
    targetFileName,
    targetFilePath: join(modsDir, targetFileName),
  }
}

function flattenMemberExpression(
  node: luaparse.Identifier | luaparse.MemberExpression | luaparse.Expression | null,
): string[] | null {
  if (!node) {
    return null
  }

  if (node.type === "Identifier") {
    return [node.name]
  }

  if (node.type === "MemberExpression" && node.indexer === ".") {
    const base = flattenMemberExpression(node.base)
    if (!base) {
      return null
    }

    return [...base, node.identifier.name]
  }

  return null
}

function getInitNameFromStatement(statement: luaparse.Statement): string | null {
  if (statement.type === "FunctionDeclaration") {
    const parts = flattenMemberExpression(statement.identifier)
    if (parts && parts.length >= 3 && parts[0] === "SMODS" && parts[1] === "INIT") {
      return parts[parts.length - 1] ?? null
    }
  }

  if (statement.type === "AssignmentStatement") {
    for (let index = 0; index < statement.variables.length; index += 1) {
      const variable = statement.variables[index]
      const init = statement.init[index]
      if (!variable) {
        continue
      }

      const parts = flattenMemberExpression(variable)

      if (
        parts &&
        parts.length >= 3 &&
        parts[0] === "SMODS" &&
        parts[1] === "INIT" &&
        init?.type === "FunctionDeclaration"
      ) {
        return parts[parts.length - 1] ?? null
      }
    }
  }

  return null
}

function extractLeadingComments(source: string): string[] {
  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/)
  const comments: string[] = []
  let foundLeadingComment = false

  for (const line of lines) {
    const trimmed = line.trim()

    if (!foundLeadingComment) {
      if (trimmed === "") {
        continue
      }

      if (trimmed.startsWith("--")) {
        foundLeadingComment = true
        comments.push(trimmed.replace(/^--+\s?/, ""))
        continue
      }

      break
    }

    if (trimmed === "") {
      continue
    }

    if (trimmed.startsWith("--")) {
      comments.push(trimmed.replace(/^--+\s?/, ""))
      continue
    }

    break
  }

  return comments
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .filter((line) => !/^[-=]{4,}$/.test(line))
}

function buildMetadata(commentLines: string[]): ModMetadata {
  const metadata: ModMetadata = {}

  for (const line of commentLines) {
    const match = line.match(/^([A-Z_]+)\s*:\s*(.+)$/)
    if (!match) {
      continue
    }

    const [, key, value] = match
    if (!value) {
      continue
    }

    const normalizedValue = value.trim()

    switch (key) {
      case "MOD_NAME":
        metadata.name = normalizedValue
        break
      case "MOD_ID":
        metadata.id = normalizedValue
        break
      case "MOD_AUTHOR":
        metadata.author = normalizedValue
        break
      case "MOD_DESCRIPTION":
        metadata.description = normalizedValue
        break
      case "DISPLAY_NAME":
        metadata.displayName = normalizedValue
        break
      default:
        break
    }
  }

  return metadata
}

async function parseModFile(modsDir: string, fileName: string): Promise<ModEntry | null> {
  const filePath = join(modsDir, fileName)
  const source = await readFile(filePath, "utf8")
  const enabled = isEnabledFile(fileName)

  let chunk: luaparse.Chunk
  try {
    chunk = luaparse.parse(source, {
      comments: true,
      locations: true,
      luaVersion: "LuaJIT",
    })
  } catch {
    return null
  }

  const initName = chunk.body
    .map((statement) => getInitNameFromStatement(statement))
    .find((value): value is string => Boolean(value))

  if (!initName) {
    return null
  }

  const commentLines = extractLeadingComments(source)
  const metadata = buildMetadata(commentLines)
  const title = metadata.displayName ?? metadata.name ?? initName
  const topComment = commentLines.join("\n") || "无顶部注释"

  return {
    fileName,
    filePath,
    targetFileName: fileName,
    targetFilePath: filePath,
    enabled,
    selected: enabled,
    title,
    initName,
    metadata,
    topComment,
    detailText: topComment,
  }
}

export async function scanModsDirectory(modsDir: string): Promise<ScanResult> {
  const entries = await readdir(modsDir, { withFileTypes: true })
  const candidateFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter(isSupportedModFile)

  const ignoredFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((fileName) => !isSupportedModFile(fileName))

  const mods = (
    await Promise.all(candidateFiles.map((fileName) => parseModFile(modsDir, fileName)))
  )
    .filter((mod): mod is ModEntry => mod !== null)
    .map((mod) => {
      const targetFileName = buildTargetFileName(mod.fileName, mod.selected)
      return {
        ...mod,
        targetFileName,
        targetFilePath: join(modsDir, targetFileName),
      }
    })
    .sort((left, right) =>
      left.title.localeCompare(right.title, "zh-CN", { sensitivity: "base" }),
    )

  return { mods, ignoredFiles }
}

export async function applyModSelection(modsDir: string, mods: ModEntry[]): Promise<ApplyResult> {
  const errors: string[] = []
  let changed = 0

  for (const mod of mods) {
    if (mod.selected === mod.enabled) {
      continue
    }

    const nextFileName = buildTargetFileName(mod.fileName, mod.selected)
    const nextFilePath = join(modsDir, nextFileName)

    try {
      await rename(mod.filePath, nextFilePath)
      changed += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${basename(mod.filePath)} -> ${basename(nextFilePath)}: ${message}`)
    }
  }

  return { changed, errors }
}

export function countPendingChanges(mods: ModEntry[]): number {
  return mods.filter((mod) => mod.selected !== mod.enabled).length
}
