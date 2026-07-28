import { mkdtemp, readdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

const manager = process.argv.slice(2).find((argument) => new Set(["npm", "pnpm"]).has(argument))
if (!new Set(["npm", "pnpm"]).has(manager)) throw new Error("usage: node scripts/test-package-install.mjs <npm|pnpm>")

const sdkRoot = fileURLToPath(new URL("..", import.meta.url))
const root = await mkdtemp(join(tmpdir(), "oati-typescript-install-"))
const artifacts = join(root, "artifacts")
const consumer = join(root, "consumer")
await Promise.all([
  import("node:fs/promises").then(({ mkdir }) => mkdir(artifacts)),
  import("node:fs/promises").then(({ mkdir }) => mkdir(consumer)),
])
await run("pnpm", ["pack", "--pack-destination", artifacts], sdkRoot)
const tarballs = (await readdir(artifacts)).filter((name) => name.endsWith(".tgz"))
if (tarballs.length !== 1) throw new Error(`expected one package tarball, found ${tarballs.join(", ")}`)
await writeFile(join(consumer, "package.json"), `${JSON.stringify({ name: "oati-fresh-consumer", private: true, type: "module" }, null, 2)}\n`)
const tarball = join(artifacts, tarballs[0])
await run(manager, manager === "npm"
  ? ["install", "--ignore-scripts", "--cache", join(root, "npm-cache"), tarball, "typescript@5.9.3"]
  : ["add", "--ignore-scripts", "--store-dir", join(root, "pnpm-store"), tarball, "typescript@5.9.3"], consumer)
await writeFile(join(consumer, "tsconfig.json"), `${JSON.stringify({ compilerOptions: { target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", strict: true, noEmit: true }, include: ["verify.ts"] }, null, 2)}\n`)
await writeFile(join(consumer, "verify.ts"), `
import { createMandate, type AgentMandate } from "@intelliger/oati"
import { OatiLookupClient, type LookupClientOptions } from "@intelliger/oati/lookup"
import type { VerificationPolicy } from "@intelliger/oati/crypto"

const mandate: AgentMandate = createMandate({ id: "oati:mandate:fresh:typed-1", issuer: "oati:issuer:fresh", subject: "oati:agent:fresh:buyer", purpose: "Compile package declarations", actions: ["api.call"], not_before: "2026-01-01T00:00:00Z", expires_at: "2027-01-01T00:00:00Z", status: "active" })
const options: LookupClientOptions = { resolverUrls: ["https://resolver.example/oati/v1"] }
const client = new OatiLookupClient(options)
const policy: VerificationPolicy | undefined = undefined
void [mandate, client, policy]
`)
const tsc = join(consumer, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc")
await run(tsc, ["-p", "tsconfig.json"], consumer)
await writeFile(join(consumer, "verify.mjs"), `
import { canonicalJson, createMandate, validateSchema } from "@intelliger/oati"
import { OatiLookupClient } from "@intelliger/oati/lookup"
import { verifyDocument } from "@intelliger/oati/crypto"
import { evaluateAuthority } from "@intelliger/oati/evaluator"
import { createOatiMiddleware } from "@intelliger/oati/middleware"
import { toOpaInput } from "@intelliger/oati/adapters"
import { DevelopmentIssuer } from "@intelliger/oati/development"
import { assertSchema } from "@intelliger/oati/validation"

const mandate = createMandate({ id: "oati:mandate:fresh:install-1", issuer: "oati:issuer:fresh", subject: "oati:agent:fresh:buyer", purpose: "Verify a clean package installation", actions: ["api.call"], resources: ["oati:service:fresh:test"], not_before: "2026-01-01T00:00:00Z", expires_at: "2027-01-01T00:00:00Z", status: "active" })
if (canonicalJson({ b: 2, a: 1 }) !== '{"a":1,"b":2}') throw new Error("canonical JSON export failed")
if (!validateSchema("mandate", mandate).valid) throw new Error("embedded schema validation failed")
assertSchema("mandate", mandate)
for (const value of [OatiLookupClient, verifyDocument, evaluateAuthority, createOatiMiddleware, toOpaInput, DevelopmentIssuer]) if (typeof value !== "function") throw new Error("package subpath export failed")
console.log("fresh TypeScript package consumer passed")
`)
await run(process.execPath, ["verify.mjs"], consumer)

function run(command, args, cwd) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit", shell: process.platform === "win32" })
    child.once("error", reject)
    child.once("exit", (code) => code === 0 ? resolveRun() : reject(new Error(`${command} exited with ${code}`)))
  })
}
