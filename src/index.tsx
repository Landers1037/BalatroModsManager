import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { App } from "./ui"

const debug = process.argv.includes("--debug")

const renderer = await createCliRenderer({
  exitOnCtrlC: false,
  clearOnShutdown: true,
})

createRoot(renderer).render(<App debug={debug} />)
