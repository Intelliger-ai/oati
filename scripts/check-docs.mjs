#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, extname, relative, resolve, sep } from "node:path"
import { pathToFileURL } from "node:url"

export async function checkDocumentation(root = resolve(import.meta.dirname, "..")) {
  const failures = []
  const markdownFiles = walk(root).filter((file) => extname(file) === ".md")
  const packageJson = JSON.parse(readFileSync(resolve(root, "sdk/typescript/package.json"), "utf8"))
  const validPackages = new Set([packageJson.name, ...Object.keys(packageJson.exports).filter((key) => key !== ".").map((key) => `${packageJson.name}/${key.slice(2)}`)])
  const runtimeExports = new Map()
  for (const [subpath, declaration] of Object.entries(packageJson.exports)) {
    const packageName = subpath === "." ? packageJson.name : `${packageJson.name}/${subpath.slice(2)}`
    const modulePath = resolve(root, "sdk/typescript", declaration.import)
    if (existsSync(modulePath)) runtimeExports.set(packageName, new Set(Object.keys(await import(pathToFileURL(modulePath)))))
  }

  for (const file of markdownFiles) {
    const display = relative(root, file)
    const source = readFileSync(file, "utf8")
    const generatedApi = display.startsWith(`sdk${sep}typescript${sep}docs${sep}api${sep}`)
    if (!generatedApi && !source.startsWith("# ")) failures.push(`${display}: first line must be one H1 title`)
    if ((source.match(/^```/gm) ?? []).length % 2 !== 0) failures.push(`${display}: unclosed fenced code block`)
    const anchors = markdownAnchors(source)
    for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const rawTarget = match[1].trim().replace(/^<|>$/g, "")
      if (!rawTarget || /^(https?:|mailto:)/i.test(rawTarget)) continue
      const [targetPath, rawFragment] = rawTarget.split("#", 2)
      let target = targetPath ? resolve(dirname(file), decodeURIComponent(targetPath)) : file
      if (existsSync(target) && statSync(target).isDirectory() && rawFragment) target = resolve(target, "README.md")
      if (!inside(root, target) || !existsSync(target)) {
        failures.push(`${display}: broken local link ${rawTarget}`)
        continue
      }
      if (rawFragment && extname(target) === ".md") {
        const targetAnchors = target === file ? anchors : markdownAnchors(readFileSync(target, "utf8"))
        const fragment = decodeURIComponent(rawFragment).toLowerCase()
        if (!targetAnchors.has(fragment)) failures.push(`${display}: missing anchor #${rawFragment} in ${relative(root, target)}`)
      }
    }

    if (!generatedApi) {
      for (const block of fencedBlocks(source)) {
        if (!/^(?:ts|typescript|js|javascript)$/.test(block.language)) continue
        for (const imported of importsFrom(block.body)) {
          if (!validPackages.has(imported.packageName)) failures.push(`${display}: undocumented package entry point ${imported.packageName}`)
          const available = runtimeExports.get(imported.packageName)
          if (available) for (const name of imported.names) if (!available.has(name)) failures.push(`${display}: ${name} is not exported by ${imported.packageName}`)
        }
      }
    }
  }

  requiredJourneys(root, failures)
  validateCanonicalUrls(root, failures)
  validateRuntimeClaims(root, packageJson, failures)
  return { failures, files: markdownFiles.length }
}

function requiredJourneys(root, failures) {
  const required = [
    "README.md", "cli/README.md", "sandbox/README.md", "sdk/typescript/README.md", "sdk/python/README.md", "sdk/go/README.md",
    "docs/tutorials/verify-first-request.md", "docs/tutorials/issue-and-consume-mandate.md",
    "docs/tutorials/generate-and-verify-receipt.md", "docs/tutorials/paid-api-commerce.md",
    "docs/tutorials/rwa-controlled-mint.md", "docs/tutorials/mcp-and-a2a.md",
    "docs/tutorials/errors-and-revocation.md", "docs/MIGRATION_AND_COMPATIBILITY.md",
    "docs/PACKAGE_INSTALLATION_COMPATIBILITY.md",
  ]
  for (const path of required) if (!existsSync(resolve(root, path))) failures.push(`${path}: required developer journey is missing`)

  const promises = [
    ["README.md", ["./sandbox/oati-sandbox", "go run ./cli/cmd/oati validate passport ./examples/passport.json", "go install github.com/Intelliger-ai/oati/cli/cmd/oati@main"]],
    ["sandbox/README.md", ["./sandbox/oati-sandbox", "./sandbox/oati-sandbox test", "./sandbox/oati-sandbox down", "http://localhost:9080/oati/v1"]],
    ["docs/tutorials/verify-first-request.md", ["go build -o /tmp/oati ./cli/cmd/oati", "conformance/crypto/signed-envelope.json", "conformance/crypto/trust-bundle.json"]],
    ["sdk/typescript/README.md", ["pnpm add @intelliger/oati", "pnpm test:package-install -- npm", "pnpm test:package-install -- pnpm"]],
    ["sdk/python/README.md", ["python3 -m pip install -e sdk/python", "suite-v0.4.json"]],
    ["sdk/go/README.md", ["go test ./...", "suite-v0.4.json"]],
  ]
  for (const [path, fragments] of promises) {
    const source = readFileSync(resolve(root, path), "utf8")
    for (const fragment of fragments) if (!source.includes(fragment)) failures.push(`${path}: required journey command or path is missing: ${fragment}`)
  }
  for (const executable of ["sandbox/oati-sandbox"]) {
    const mode = statSync(resolve(root, executable)).mode
    if ((mode & 0o111) === 0) failures.push(`${executable}: one-command entry point is not executable`)
  }
  for (const path of ["cli/cmd/oati", "examples/passport.json", "conformance/crypto/signed-envelope.json", "conformance/crypto/trust-bundle.json", "sdk/typescript/scripts/test-package-install.mjs", "sdk/python/scripts/test_package_install.py", "sdk/go/scripts/test-package-install.go"])
    if (!existsSync(resolve(root, path))) failures.push(`${path}: documented command target is missing`)

  const cli = readFileSync(resolve(root, "cli/README.md"), "utf8")
  const cliSource = readFileSync(resolve(root, "cli/cmd/oati/main.go"), "utf8")
  const implementedCommands = new Set([...cliSource.matchAll(/case\s+((?:"[^"]+"(?:\s*,\s*)?)+):/g)].flatMap((match) => [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1])))
  const documentedCommands = [...cli.matchAll(/^oati\s+([a-z-]+)(?:\s+([a-z-]+))?/gm)]
  for (const [, command, subcommand] of documentedCommands) {
    if (!implementedCommands.has(command)) failures.push(`cli/README.md: undocumented CLI command implementation ${command}`)
    if (subcommand?.startsWith("validate-") && !cliSource.includes(`"${command}/${subcommand}"`)) failures.push(`cli/README.md: unsupported CLI subcommand ${command} ${subcommand}`)
  }
}

function validateCanonicalUrls(root, failures) {
  const expectedProfiles = new Map([
    ["specification/profiles/commerce/README.md", "https://specs.intelliger.ai/oati/profiles/commerce/v0.1"],
    ["specification/profiles/rwa/README.md", "https://specs.intelliger.ai/oati/profiles/rwa/v0.1"],
  ])
  for (const [path, url] of expectedProfiles) if (!readFileSync(resolve(root, path), "utf8").includes(url)) failures.push(`${path}: canonical profile URL is missing or changed`)
  const schemaIds = new Set()
  for (const file of walk(resolve(root, "schemas")).filter((item) => extname(item) === ".json")) {
    const value = JSON.parse(readFileSync(file, "utf8"))
    if (typeof value.$id !== "string" || !value.$id.startsWith("https://schemas.intelliger.ai/oati/")) failures.push(`${relative(root, file)}: canonical schema $id is missing or outside the public origin`)
    else if (schemaIds.has(value.$id)) failures.push(`${relative(root, file)}: duplicate schema $id ${value.$id}`)
    else schemaIds.add(value.$id)
  }
  const sdk = readFileSync(resolve(root, "sdk/typescript/README.md"), "utf8")
  if (!sdk.includes('"https://api.intelliger.ai/oati/v1"')) failures.push("sdk/typescript/README.md: canonical hosted resolver URL is missing")
  for (const file of walk(root).filter((item) => extname(item) === ".md")) {
    const source = readFileSync(file, "utf8")
    if (source.includes("https://api.intelliger.ai/oati/v1/") && !source.includes("https://api.intelliger.ai/oati/v1/status")) failures.push(`${relative(root, file)}: hosted API base URL must not gain a trailing slash`)
    if (source.includes("http://127.0.0.1:18080") || source.includes("http://localhost:18080")) failures.push(`${relative(root, file)}: stale lookup integration port 18080 is documented`)
  }
}

function validateRuntimeClaims(root, packageJson, failures) {
  const readme = readFileSync(resolve(root, "README.md"), "utf8")
  const goVersion = readFileSync(resolve(root, "go.work"), "utf8").match(/^go\s+(\S+)/m)?.[1]
  if (!goVersion || !readme.includes(`Go ${goVersion}+`)) failures.push(`README.md: Go requirement must match go.work (${goVersion ?? "missing"})`)
  if (!readFileSync(resolve(root, "sdk/typescript/README.md"), "utf8").includes(`Node.js ${packageJson.engines.node.replace(">=", "")}+`)) failures.push("sdk/typescript/README.md: Node requirement must match package.json engines")
  const python = readFileSync(resolve(root, "sdk/python/pyproject.toml"), "utf8").match(/requires-python\s*=\s*">=(\d+\.\d+)"/)?.[1]
  if (!python || !readFileSync(resolve(root, "sdk/python/README.md"), "utf8").includes(`Python ${python}+`)) failures.push("sdk/python/README.md: Python requirement must match pyproject.toml")
  const compatibility = readFileSync(resolve(root, "docs/PACKAGE_INSTALLATION_COMPATIBILITY.md"), "utf8")
  const packageWorkflow = readFileSync(resolve(root, ".github/workflows/package-install.yml"), "utf8")
  if (!compatibility.includes("all seven documented subpaths")) failures.push("docs/PACKAGE_INSTALLATION_COMPATIBILITY.md: TypeScript subpath compatibility claim is missing")
  if (Object.keys(packageJson.exports).length !== 8) failures.push(`sdk/typescript/package.json: expected root plus seven public subpaths, found ${Object.keys(packageJson.exports).length}`)
  for (const claim of ["Node.js 20, 22, and 24", "Python 3.11, 3.12, 3.13, and 3.14", "Go 1.25 and 1.26"]) if (!compatibility.includes(claim)) failures.push(`docs/PACKAGE_INSTALLATION_COMPATIBILITY.md: runtime matrix claim is missing: ${claim}`)
  for (const matrix of ["node: [20, 22, 24]", 'python: ["3.11", "3.12", "3.13", "3.14"]', 'go: ["1.25.12", "1.26.x"]']) if (!packageWorkflow.includes(matrix)) failures.push(`.github/workflows/package-install.yml: documented runtime matrix is not enforced: ${matrix}`)
}

function markdownAnchors(source) {
  const anchors = new Set(); const occurrences = new Map()
  for (const match of source.matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
    let slug = match[1].replace(/<[^>]+>/g, "").replace(/`/g, "").toLowerCase().trim()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s+/g, "-")
    const occurrence = occurrences.get(slug) ?? 0
    occurrences.set(slug, occurrence + 1)
    if (occurrence) slug = `${slug}-${occurrence}`
    anchors.add(slug)
  }
  return anchors
}
function fencedBlocks(source) {
  return [...source.matchAll(/^```([^\s`]*)[^\n]*\n([\s\S]*?)^```\s*$/gm)].map((match) => ({ language: match[1].toLowerCase(), body: match[2] }))
}
function importsFrom(source) {
  return [...source.matchAll(/import\s*{([\s\S]*?)}\s*from\s*["'](@intelliger\/oati(?:\/[a-z-]+)?)["']/g)].map((match) => ({
    packageName: match[2], names: match[1].split(",").map((name) => name.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]).filter(Boolean),
  }))
}
function walk(directory) {
  const output = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if ([".git", "node_modules", "dist", ".venv", "vendor"].includes(entry.name)) continue
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) output.push(...walk(path)); else output.push(path)
  }
  return output
}
function inside(root, path) { return path === root || path.startsWith(root + sep) }

async function main() {
  const result = await checkDocumentation()
  if (result.failures.length) { console.error(result.failures.join("\n")); process.exitCode = 1 }
  else console.log(`Developer documentation checks passed (${result.files} Markdown files)`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main()
