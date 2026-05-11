import { stat } from "node:fs/promises"
import { basename } from "node:path"
import type { ScrollBoxRenderable } from "@opentui/core"
import { useEffect, useRef, useState } from "react"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import { loadOrCreateConfig, saveConfig } from "./config"
import {
  applyModSelection,
  countPendingChanges,
  scanModsDirectory,
  withSelectedState,
} from "./mods"
import type { ConfigPaths, ModEntry } from "./types"

type Phase = "loading" | "setup" | "list" | "detail" | "confirm"

function clampCursor(index: number, total: number): number {
  if (total <= 0) {
    return 0
  }

  return Math.max(0, Math.min(index, total - 1))
}

function stripWrappingQuotes(value: string): string {
  return value.trim().replace(/^"(.*)"$/, "$1")
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function ensureDirectoryExists(path: string): Promise<void> {
  const details = await stat(path)
  if (!details.isDirectory()) {
    throw new Error("提供的路径不是目录。")
  }
}

function getCurrentMod(mods: ModEntry[], cursor: number): ModEntry | null {
  return mods[cursor] ?? null
}

function formatStatus(mod: ModEntry): string {
  return mod.selected ? "启用" : "禁用"
}

function formatOriginalStatus(mod: ModEntry): string {
  return mod.enabled ? "启用" : "禁用"
}

function buildSummary(mod: ModEntry | null): string {
  if (!mod) {
    return "当前没有扫描到符合规则的模组文件。"
  }

  return [
    `名称: ${mod.title}`,
    `INIT: ${mod.initName}`,
    `当前状态: ${formatOriginalStatus(mod)}`,
    `目标状态: ${formatStatus(mod)}`,
    `文件: ${mod.fileName}`,
    `应用后文件: ${mod.targetFileName}`,
    mod.metadata.id ? `MOD_ID: ${mod.metadata.id}` : null,
    mod.metadata.author ? `作者: ${mod.metadata.author}` : null,
    mod.metadata.description
      ? `说明: ${mod.metadata.description}`
      : `说明: ${mod.topComment.split("\n")[0] ?? "无顶部注释"}`,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n")
}

export function App({ debug = false }: { debug?: boolean }) {
  const renderer = useRenderer()
  const { width, height } = useTerminalDimensions()
  const modsScrollRef = useRef<ScrollBoxRenderable | null>(null)

  const [phase, setPhase] = useState<Phase>("loading")
  const [configPaths, setConfigPaths] = useState<ConfigPaths | null>(null)
  const [modsDir, setModsDir] = useState<string | null>(null)
  const [modsDirInput, setModsDirInput] = useState("")
  const [mods, setMods] = useState<ModEntry[]>([])
  const [cursor, setCursor] = useState(0)
  const [busy, setBusy] = useState(false)
  const [statusMessage, setStatusMessage] = useState("正在加载配置...")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const currentMod = getCurrentMod(mods, cursor)
  const pendingChanges = countPendingChanges(mods)
  const visibleMods = mods.slice(Math.max(0, cursor - 20), Math.min(mods.length, cursor + 20))

  useEffect(() => {
    void bootstrap()
  }, [])

  useEffect(() => {
    if (!debug) {
      return
    }

    // Only for debugging; keep it out of the render path.
    void Bun.write(
      "debug.log",
      JSON.stringify(
        {
          phase,
          modsDir,
          cursor,
          modsCount: mods.length,
          mods,
        },
        null,
        2,
      ),
    )
  }, [cursor, debug, mods.length, modsDir, phase, visibleMods])

  useEffect(() => {
    if (phase !== "list") {
      return
    }

    modsScrollRef.current?.scrollChildIntoView(`mod-row-${cursor}`)
  }, [cursor, phase])

  async function bootstrap() {
    setBusy(true)
    setErrorMessage(null)
    setStatusMessage("正在加载配置...")

    try {
      const { config, paths } = await loadOrCreateConfig()
      setConfigPaths(paths)

      if (!config.modsDir) {
        setModsDir(null)
        setModsDirInput("")
        setMods([])
        setPhase("setup")
        setStatusMessage("首次启动，请先设置全局 Mods 目录。")
        return
      }

      setModsDir(config.modsDir)
      setModsDirInput(config.modsDir)
      await loadMods(config.modsDir, paths, "扫描完成。")
    } catch (error) {
      setPhase("setup")
      setMods([])
      setStatusMessage("初始化失败，请重新输入 Mods 目录。")
      setErrorMessage(getErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  async function loadMods(dir: string, paths: ConfigPaths, successMessage: string) {
    setBusy(true)
    setErrorMessage(null)

    try {
      await ensureDirectoryExists(dir)
      const result = await scanModsDirectory(dir)
      setModsDir(dir)
      setConfigPaths(paths)
      setMods(result.mods)
      setCursor((current) => clampCursor(current, result.mods.length))
      setPhase("list")
      setStatusMessage(
        `已扫描 ${result.mods.length} 个模组，忽略 ${result.ignoredFiles.length} 个非目标文件。`,
      )

      if (successMessage) {
        setStatusMessage(
          `${successMessage} 已扫描 ${result.mods.length} 个模组，忽略 ${result.ignoredFiles.length} 个非目标文件。`,
        )
      }
    } catch (error) {
      setPhase("setup")
      setMods([])
      setStatusMessage("Mods 目录无效，请重新输入。")
      setErrorMessage(getErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  async function submitModsDirectory() {
    if (!configPaths) {
      return
    }

    const input = stripWrappingQuotes(modsDirInput)
    if (!input) {
      setErrorMessage("请输入一个有效的 Mods 目录。")
      return
    }

    setBusy(true)
    setErrorMessage(null)

    try {
      await ensureDirectoryExists(input)
      await saveConfig(configPaths, { modsDir: input })
      setModsDirInput(input)
      await loadMods(input, configPaths, "全局 Mods 目录已保存。")
    } catch (error) {
      setPhase("setup")
      setErrorMessage(getErrorMessage(error))
      setStatusMessage("保存失败，请检查目录路径。")
      setBusy(false)
    }
  }

  async function applyChanges() {
    if (!modsDir || !configPaths) {
      return
    }

    setBusy(true)
    setErrorMessage(null)

    try {
      const result = await applyModSelection(modsDir, mods)
      const resultMessage =
        result.errors.length > 0
          ? `已修改 ${result.changed} 个模组，${result.errors.length} 个失败。`
          : `已成功应用 ${result.changed} 个模组状态。`

      await loadMods(modsDir, configPaths, resultMessage)
      setPhase("list")

      if (result.errors.length > 0) {
        setErrorMessage(result.errors.join("\n"))
      }
    } catch (error) {
      setPhase("list")
      setErrorMessage(getErrorMessage(error))
      setStatusMessage("应用失败。")
      setBusy(false)
    }
  }

  function moveCursor(delta: number) {
    setCursor((current) => clampCursor(current + delta, mods.length))
  }

  function toggleCurrentMod() {
    if (!modsDir || !currentMod) {
      return
    }

    setMods((current) =>
      current.map((mod, index) =>
        index === cursor ? withSelectedState(modsDir, mod, !mod.selected) : mod,
      ),
    )
  }

  useKeyboard((key) => {
    if (key.ctrl && key.name === "c") {
      renderer.destroy()
      return
    }

    if (busy) {
      return
    }

    if (phase === "setup") {
      if (key.name === "escape") {
        renderer.destroy()
      }
      return
    }

    if (phase === "detail") {
      if (key.name === "escape" || key.name === "left") {
        setPhase("list")
        setStatusMessage("已返回模组列表。")
      }
      return
    }

    if (phase === "confirm") {
      if (key.name === "escape") {
        setPhase("list")
        setStatusMessage("已取消应用。")
        return
      }

      if (key.name === "enter" || key.name === "return") {
        void applyChanges()
      }
      return
    }

    if (phase === "list") {
      if (key.name === "escape") {
        renderer.destroy()
        return
      }

      if (key.name === "up" || key.name === "k") {
        moveCursor(-1)
        return
      }

      if (key.name === "down" || key.name === "j") {
        moveCursor(1)
        return
      }

      if (key.name === "space") {
        toggleCurrentMod()
        return
      }

      if ((key.name === "right" || key.name === "l") && currentMod) {
        setPhase("detail")
        return
      }

      if (key.name === "r") {
        if (modsDir && configPaths) {
          void loadMods(modsDir, configPaths, "已重新扫描。")
        }
        return
      }

      if (key.name === "m") {
        setPhase("setup")
        setStatusMessage("请输入新的全局 Mods 目录。")
        setErrorMessage(null)
        return
      }

      if (key.name === "enter" || key.name === "return") {
        if (pendingChanges <= 0) {
          setStatusMessage("当前没有待应用的变更。")
          return
        }

        setPhase("confirm")
      }
    }
  })

  const currentSummary = buildSummary(currentMod)
  const inputWidth = Math.max(36, Math.min(width - 10, 100))

  if (phase === "loading") {
    return (
      <box
        width={width}
        height={height}
        justifyContent="center"
        alignItems="center"
        backgroundColor="#111827"
      >
        <box border borderColor="#f59e0b" padding={2} width={Math.min(72, width - 4)}>
          <text fg="#f8fafc">{statusMessage}</text>
        </box>
      </box>
    )
  }

  if (phase === "setup") {
    return (
      <box
        width={width}
        height={height}
        flexDirection="column"
        backgroundColor="#111827"
        padding={1}
        gap={1}
      >
        <box border borderColor="#f59e0b" padding={1} flexDirection="column" gap={1}>
          <ascii-font text="BALATRO MM" font="block" color="#fbbf24" />
          <text fg="#e5e7eb">
            Balatro Mods Manager
            <br />
            首次启动需要保存一个全局 Mods 目录，配置文件会写入
            <span fg="#93c5fd"> %USERPROFILE%/.config/BalatroMM/config.json</span>
          </text>
        </box>

        <box border borderColor="#60a5fa" padding={1} flexDirection="column" gap={1}>
          <text fg="#e5e7eb">
            请输入 Balatro 的 Mods 根目录路径。程序只扫描该目录根级别的
            <span fg="#fcd34d"> .lua</span> 和
            <span fg="#fcd34d"> .lua.disable</span>
            文件，不会进入任何子目录。
          </text>
          <input
            value={modsDirInput}
            onChange={setModsDirInput}
            onSubmit={() => {
              void submitModsDirectory()
            }}
            placeholder="例如: D:\\Games\\Balatro\\Mods"
            focused
            width={inputWidth}
            backgroundColor="#0f172a"
            focusedBackgroundColor="#1e293b"
            textColor="#f8fafc"
            placeholderColor="#94a3b8"
            cursorColor="#fbbf24"
          />
          <text fg="#cbd5e1">
            回车保存并开始扫描，Esc 退出。
          </text>
        </box>

        <box border borderColor="#475569" padding={1}>
          <text fg={errorMessage ? "#fca5a5" : "#cbd5e1"}>
            {errorMessage ?? statusMessage}
          </text>
        </box>
      </box>
    )
  }

  if (phase === "detail" && currentMod) {
    return (
      <box
        width={width}
        height={height}
        flexDirection="column"
        backgroundColor="#111827"
        padding={1}
        gap={1}
      >
        <box border borderColor="#f59e0b" padding={1} flexDirection="column" gap={1}>
          <text fg="#f8fafc">
            <strong>{currentMod.title}</strong>
          </text>
          <text fg="#cbd5e1">
            INIT: {currentMod.initName}
            <br />
            当前状态: {formatOriginalStatus(currentMod)}
            <br />
            目标状态: {formatStatus(currentMod)}
            <br />
            文件名: {currentMod.fileName}
            <br />
            应用后文件名: {currentMod.targetFileName}
          </text>
        </box>

        <box border borderColor="#60a5fa" padding={1} flexDirection="column" flexGrow={1}>
          <text fg="#f8fafc">
            <strong>顶部注释说明</strong>
          </text>
          <text fg="#e5e7eb">{currentMod.detailText}</text>
        </box>

        <box border borderColor="#475569" padding={1}>
          <text fg="#cbd5e1">Esc 返回列表，Left 也可返回。</text>
        </box>
      </box>
    )
  }

  if (phase === "confirm") {
    return (
      <box
        width={width}
        height={height}
        justifyContent="center"
        alignItems="center"
        backgroundColor="#111827"
      >
        <box
          border
          borderColor="#f59e0b"
          padding={2}
          width={Math.min(96, width - 4)}
          flexDirection="column"
          gap={1}
        >
          <text fg="#f8fafc">
            <strong>确认应用模组状态变更</strong>
          </text>
          <text fg="#e5e7eb">
            待应用变更数量: {pendingChanges}
            <br />
            启用代表文件后缀为 <span fg="#fcd34d">.lua</span>
            ，禁用代表文件后缀为 <span fg="#fcd34d">.lua.disable</span>。
          </text>
          <box border borderColor="#334155" padding={1}>
            <text fg="#cbd5e1">{mods.filter((mod) => mod.selected !== mod.enabled).map((mod) => `${basename(mod.fileName)} -> ${basename(mod.targetFileName)}`).join("\n") || "没有待应用的变更。"}</text>
          </box>
          <text fg="#cbd5e1">按 Enter 确认执行，按 Esc 取消。</text>
        </box>
      </box>
    )
  }

  return (
    <box
      width={width}
      height={height}
      flexDirection="column"
      backgroundColor="#111827"
      padding={1}
      gap={1}
    >
      <box border borderColor="#f59e0b" padding={1} flexDirection="column" gap={1}>
        <ascii-font text="BALATRO MM" font="block" color="#fbbf24" />
        <text fg="#e5e7eb">
          Balatro Mods Manager
          <br />
          上下方向键选择模组，空格切换启用/禁用，右方向键查看详情，Enter 二次确认后应用，Esc 退出。
          <br />
          附加快捷键: R 重新扫描，M 修改全局 Mods 目录。
        </text>
      </box>

      <box flexDirection="row" gap={1} flexGrow={1}>
        <box border borderColor="#60a5fa" padding={1} flexGrow={3} flexDirection="column">
          <text fg="#f8fafc">
            <strong>Mods 列表</strong>
          </text>
          <text fg="#94a3b8">
            目录: {modsDir ?? "未设置"}
          </text>
          <text fg="#94a3b8">
            已扫描: {mods.length} 个模组 | 待应用: {pendingChanges}
          </text>
          <scrollbox
            ref={modsScrollRef}
            flexGrow={1}
            width="100%"
            marginTop={1}
            viewportOptions={{ backgroundColor: "#0f172a" }}
            contentOptions={{ backgroundColor: "#0f172a" }}
            scrollbarOptions={{
              showArrows: true,
              arrowOptions: {
                foregroundColor: "#93c5fd",
                backgroundColor: "#0f172a",
              },
              trackOptions: {
                foregroundColor: "#60a5fa",
                backgroundColor: "#1e293b",
              },
            }}
          >
            {mods.length > 0 ? (
              mods.map((mod, index) => {
                const selected = index === cursor
                const changed = mod.selected !== mod.enabled
                const rowBackground = selected ? "#1d4ed8" : "#0f172a"
                const rowTextColor = selected ? "#eff6ff" : "#e5e7eb"

                return (
                  <box
                    id={`mod-row-${index}`}
                    key={mod.filePath}
                    height={1}
                    width="100%"
                    paddingX={1}
                    backgroundColor={rowBackground}
                    flexDirection="row"
                  >
                    <text fg={rowTextColor}>
                      {selected ? ">" : " "} {mod.selected ? "●" : "○"} {mod.title}{" "}
                    </text>
                    <text fg={mod.selected ? "#86efac" : "#fca5a5"}>
                      [{formatStatus(mod)}]
                    </text>
                    {changed ? (
                      <text fg="#fcd34d"> *</text>
                    ) : (
                      <text fg={rowBackground}>  </text>
                    )}
                    <text fg={rowBackground}> </text>
                  </box>
                )
              })
            ) : (
              <box width="100%" paddingX={1} backgroundColor="#0f172a">
                <text fg="#cbd5e1">
                  当前目录没有扫描到符合规则的模组。
                  <br />
                  只会识别根目录下定义了 SMODS.INIT 的 .lua / .lua.disable 文件。
                </text>
              </box>
            )}
          </scrollbox>
        </box>

        <box border borderColor="#34d399" padding={1} flexGrow={2} flexDirection="column">
          <text fg="#f8fafc">
            <strong>当前模组</strong>
          </text>
          <text fg="#e5e7eb">{currentSummary}</text>
        </box>
      </box>

      <box border borderColor="#475569" padding={1}>
        <text fg={errorMessage ? "#fca5a5" : "#cbd5e1"}>
          {errorMessage ?? statusMessage}
        </text>
      </box>
    </box>
  )
}
