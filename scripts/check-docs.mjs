#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from "node:fs"
import { dirname, resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const required = [
  "docs/tutorials/verify-first-request.md",
  "docs/tutorials/issue-and-consume-mandate.md",
  "docs/tutorials/generate-and-verify-receipt.md",
  "docs/tutorials/paid-api-commerce.md",
  "docs/tutorials/rwa-controlled-mint.md",
  "docs/tutorials/mcp-and-a2a.md",
  "docs/tutorials/errors-and-revocation.md",
  "docs/MIGRATION_AND_COMPATIBILITY.md",
]

const failures = []
for (const relative of required) {
  const file = resolve(root, relative)
  if (!existsSync(file)) {
    failures.push(`${relative}: required documentation is missing`)
    continue
  }
  const source = readFileSync(file, "utf8")
  if (!source.startsWith("# ")) failures.push(`${relative}: one H1 title is required`)
  for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1].split("#", 1)[0]
    if (!target || /^(https?:|mailto:)/.test(target)) continue
    const resolved = resolve(dirname(file), decodeURIComponent(target))
    if (!resolved.startsWith(root + "/") || !existsSync(resolved)) failures.push(`${relative}: broken local link ${match[1]}`)
    else statSync(resolved)
  }
}

if (failures.length) {
  console.error(failures.join("\n"))
  process.exit(1)
}
console.log(`Developer documentation checks passed (${required.length} guides)`)
