import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { applyModSelection, scanModsDirectory, withSelectedState } from "./mods"

const tempDirs: string[] = []

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      await rm(dir, { recursive: true, force: true })
    }
  }
})

async function createTempModsDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "balatro-mm-"))
  tempDirs.push(dir)
  return dir
}

describe("scanModsDirectory", () => {
  test("只扫描根目录下定义了 SMODS.INIT 的 lua 文件", async () => {
    const modsDir = await createTempModsDir()

    await writeFile(
      join(modsDir, "EnabledMod.lua"),
      [
        "--- MOD_NAME: Enabled Mod",
        "--- MOD_DESCRIPTION: Root level mod",
        "",
        "function SMODS.INIT.EnabledMod()",
        "  return true",
        "end",
      ].join("\n"),
      "utf8",
    )

    await writeFile(join(modsDir, "Ignored.txt"), "not a mod", "utf8")

    await mkdir(join(modsDir, "Nested"), { recursive: true })
    await writeFile(
      join(modsDir, "Nested", "NestedMod.lua"),
      "function SMODS.INIT.NestedMod() end",
      "utf8",
    )

    const result = await scanModsDirectory(modsDir)

    expect(result.mods).toHaveLength(1)
    expect(result.mods[0]?.title).toBe("Enabled Mod")
    expect(result.mods[0]?.metadata.description).toBe("Root level mod")
    expect(result.ignoredFiles).toContain("Ignored.txt")
  })
})

describe("applyModSelection", () => {
  test("根据选择结果切换 lua 与 lua.disable 后缀", async () => {
    const modsDir = await createTempModsDir()

    await writeFile(
      join(modsDir, "ToggleMe.lua"),
      "function SMODS.INIT.ToggleMe() end",
      "utf8",
    )

    const scanned = await scanModsDirectory(modsDir)
    const toggled = withSelectedState(modsDir, scanned.mods[0]!, false)

    const result = await applyModSelection(modsDir, [toggled])

    expect(result.changed).toBe(1)

    const rescanned = await scanModsDirectory(modsDir)
    expect(rescanned.mods[0]?.fileName).toBe("ToggleMe.lua.disable")
    expect(rescanned.mods[0]?.enabled).toBe(false)
  })
})
