#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const temporary = mkdtempSync(join(tmpdir(), "oati-doc-journeys-"))
const executable = join(temporary, process.platform === "win32" ? "oati.exe" : "oati")

try {
  const { DevelopmentIssuer, evaluateAuthority } = await import("../sdk/typescript/dist/index.js")
  const now = new Date("2026-07-29T10:00:00Z")
  const issuer = await DevelopmentIssuer.create({ slug: "docs-buyer", displayName: "Docs Buyer" }, now)
  const passport = await issuer.registerAgent({ slug: "purchasing", displayName: "Purchasing Agent", capabilities: ["catalog.read"] }, now)
  const mandate = await issuer.createMandate(passport.id, { purpose: "catalog_sync", actions: ["catalog.read"], resources: ["oati:service:seller:catalog"], expiresInSeconds: 300 }, now)
  const envelope = await issuer.signTransaction(passport.id, mandate, { action: "catalog.read", resource: "oati:service:seller:catalog", purpose: "catalog_sync", audience: "https://seller.example" }, new Date(now.getTime() + 1_000))
  const evaluation = evaluateAuthority({ oati_version: "1.0", evaluation_time: new Date(now.getTime() + 2_000).toISOString(), mandate, envelope, usage: { calls: 0 }, consumption: { calls: 1, idempotency_key: "catalog-sync-1" } })
  requireValue(evaluation.decision === "allow" && evaluation.next_usage?.calls === 1, "documented development issuance journey did not allow exactly one call")

  run("go", ["build", "-o", executable, "./cli/cmd/oati"])
  const help = run(executable, ["help"])
  for (const command of ["validate", "canonicalize", "lookup", "discover", "sign", "verify", "evaluate", "commerce", "rwa", "version"])
    requireValue(help.includes(command), `CLI help omitted documented command ${command}`)

  run(executable, ["validate", "passport", "./examples/passport.json"])
  run(executable, ["validate", "envelope", "./conformance/crypto/unsigned-envelope.json"])
  run(executable, ["commerce", "validate-offer", "./examples/commerce/merchant-service-profile.json"])
  run(executable, ["commerce", "validate-mandate", "./examples/commerce/purchase-mandate.json"])
  run(executable, ["commerce", "validate-receipt", "--mandate", "./examples/commerce/purchase-mandate.json", "./examples/commerce/commerce-receipt.json"])
  run(executable, ["rwa", "validate-asset", "./examples/rwa/asset-profile.json"])
  run(executable, ["rwa", "validate-state-claim", "./examples/rwa/asset-state-claim.json"])
  run(executable, ["rwa", "validate-mint-mandate", "--claim", "./examples/rwa/asset-state-claim.json", "./examples/rwa/mint-mandate.json"])
  run(executable, ["rwa", "validate-receipt", "--mandate", "./examples/rwa/mint-mandate.json", "./examples/rwa/rwa-receipt.json"])
  const verified = JSON.parse(run(executable, ["verify", "--trust-bundle", "./conformance/crypto/trust-bundle.json", "--audience", "https://merchant.example", "--replay-cache", join(temporary, "replay.json"), "--now", "2026-07-27T12:01:00Z", "./conformance/crypto/signed-envelope.json"]))
  requireValue(verified.verified === true, "documented signed Envelope did not verify")
  process.stdout.write("Executable documentation journeys passed\n")
} finally {
  rmSync(temporary, { recursive: true, force: true })
}

function run(command, args) { return execFileSync(command, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, GOCACHE: join(temporary, "go-cache") } }) }
function requireValue(condition, message) { if (!condition) throw new Error(message) }
