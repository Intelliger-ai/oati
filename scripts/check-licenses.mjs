#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const license = readFileSync(new URL("../LICENSE", import.meta.url), "utf8")
if (!license.includes("Apache License") || !license.includes("Version 2.0, January 2004")) throw new Error("Root LICENSE must contain Apache License 2.0")
const packageJson = JSON.parse(readFileSync(new URL("../sdk/typescript/package.json", import.meta.url), "utf8"))
if (packageJson.license !== "Apache-2.0") throw new Error("TypeScript package must declare Apache-2.0")
const pyproject = readFileSync(new URL("../sdk/python/pyproject.toml", import.meta.url), "utf8")
if (!/license\s*=\s*(?:"Apache-2.0"|\{\s*text\s*=\s*"Apache-2.0"\s*\})/.test(pyproject)) throw new Error("Python package must declare Apache-2.0")
for (const relative of ["../sdk/typescript/LICENSE", "../sdk/python/LICENSE", "../sdk/go/LICENSE", "../cli/LICENSE"]) {
  const packageLicense = readFileSync(new URL(relative, import.meta.url), "utf8")
  if (packageLicense !== license) throw new Error(`${relative} must contain the complete root Apache-2.0 licence`)
}

const modules = new URL("../sdk/typescript/node_modules/.pnpm", import.meta.url).pathname
const allowed = new Set(["Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "BlueOak-1.0.0", "ISC", "MIT", "Python-2.0", "0BSD", "CC0-1.0"])
const dependencies = new Map()
for (const relative of readdirSync(modules, { recursive: true, encoding: "utf8" })) {
  if (!relative.endsWith("package.json")) continue
  try {
    const manifest = JSON.parse(readFileSync(join(modules, relative), "utf8"))
    if (manifest.name && manifest.license) dependencies.set(`${manifest.name}@${manifest.version ?? "unknown"}`, manifest.license)
  } catch { /* package-manager metadata outside package manifests */ }
}
const incompatible = [...dependencies].filter(([, dependencyLicense]) => !allowed.has(dependencyLicense))
if (incompatible.length) throw new Error(`Dependencies require licence review: ${incompatible.map(([name, value]) => `${name} (${value})`).join(", ")}`)
if (dependencies.size === 0) throw new Error("No installed dependency manifests were available for licence review")
console.log("Apache-2.0 project and dependency licence checks passed")
