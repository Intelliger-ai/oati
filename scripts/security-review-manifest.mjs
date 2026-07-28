import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" })
if (dirty !== "") throw new Error("security review manifests require a clean checkout")
const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim()
const prefixes = ["specification/", "schemas/", "sdk/typescript/src/", "sdk/typescript/test/", "sdk/go/", "sdk/python/", "cli/cmd/oati/", "conformance/", "integrations/"]
const files = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).trim().split("\n")
  .filter((file) => prefixes.some((prefix) => file.startsWith(prefix)))
  .filter((file) => !file.includes("/docs/api/") && !file.endsWith("pnpm-lock.yaml"))
  .sort()
  .map((file) => {
    const content = fs.readFileSync(path.join(root, file))
    return { path: file, bytes: content.length, sha256: crypto.createHash("sha256").update(content).digest("hex") }
  })
const contentSha256 = crypto.createHash("sha256").update(JSON.stringify(files)).digest("hex")
process.stdout.write(JSON.stringify({ format: "oati-security-review-manifest-v2", repository: "https://github.com/Intelliger-ai/oati", commit, content_sha256: contentSha256, files }, null, 2) + "\n")
