#!/usr/bin/env node
import { readFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const json = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"))
const policy = await json("compatibility/policy.json")
const semver = /^\d+\.\d+\.\d+(?:-(?:dev|alpha|beta|rc)(?:\.\d+)?)?$/
const errors = []
const requireValue = (condition, message) => { if (!condition) errors.push(message) }

requireValue(policy.policy_version === 1, "unsupported compatibility policy version")
requireValue(/^\d+\.\d+$/.test(policy.core_version), "core_version must be major.minor")
requireValue(Number.isInteger(policy.api_major) && policy.api_major >= 1, "api_major must be positive")
requireValue(Number.isInteger(policy.predecessor_support_days) && policy.predecessor_support_days >= 180, "migration window cannot be shorter than 180 days")
for (const [name, version] of Object.entries(policy.packages)) requireValue(semver.test(version), `${name} package version is not semantic`)
for (const [path, expected] of Object.entries(policy.immutable_artifacts)) {
  const digest = createHash("sha256").update(await readFile(resolve(root, path))).digest("hex")
  requireValue(digest === expected, `${path} changed after its compatibility snapshot was frozen`)
}

const packageJson = await json("sdk/typescript/package.json")
const pyproject = await readFile(resolve(root, "sdk/python/pyproject.toml"), "utf8")
const cli = await readFile(resolve(root, "cli/cmd/oati/main.go"), "utf8")
requireValue(packageJson.version === policy.packages.typescript, "TypeScript package version differs from compatibility policy")
requireValue(pyproject.includes(`version = "${policy.packages.python.replace("-dev.", ".dev")}"`), "Python package version differs from compatibility policy")
requireValue(cli.includes(`const version = "${policy.packages.cli}"`), "CLI version differs from compatibility policy")

let previous
const inheritedIds = new Set()
for (const path of policy.conformance_chain) {
  const suite = await json(path)
  requireValue(semver.test(suite.suite_version), `${path} suite_version is not semantic`)
  requireValue(suite.standard_version === policy.core_version, `${path} targets the wrong core version`)
  const fullBaseline = policy.full_conformance_baselines.includes(suite.suite_version)
  if (fullBaseline) { requireValue(suite.extends === undefined, `${path} full baseline cannot extend another suite`); inheritedIds.clear() }
  else requireValue(previous && suite.extends === previous.path.replace("conformance/", ""), `${path} must extend ${previous?.path ?? "its predecessor"}`)
  for (const item of suite.cases) {
    requireValue(!inheritedIds.has(item.id), `${path} redefines inherited case ${item.id}`)
    inheritedIds.add(item.id)
  }
  previous = { path, version: suite.suite_version }
}
requireValue(previous?.version === policy.current_conformance_suite, "current conformance suite differs from chain tip")

for (const path of ["api/lookup.openapi.yaml", "compatibility/platform-lookup.openapi.yaml"]) {
  const contract = await readFile(resolve(root, path), "utf8")
  const version = contract.match(/^info:\n(?:  .*\n)*?  version:\s*([^\s]+)/m)?.[1]?.replace(/-draft$/, "") ?? ""
  requireValue(semver.test(version), `${path} info.version is not semantic`)
  requireValue(Number(version.split(".")[0]) === policy.api_major, `${path} API major differs from policy`)
  requireValue(/\n\s+OatiVersion:\n\s+name:\s*OATI-Version\b/.test(contract), `${path} must define OATI-Version negotiation`)
  requireValue(/\n\s+UnsupportedVersion:\n/.test(contract), `${path} must define a structured unsupported-version response`)
  const operations = [...contract.matchAll(/^    (get|post|put|patch|delete|options|head|trace):/gm)].length
  const negotiationRefs = [...contract.matchAll(/\$ref:\s*["']?#\/components\/parameters\/OatiVersion/g)].length
  const unsupportedResponses = [...contract.matchAll(/^        ["']?406["']?:/gm)].length
  requireValue(negotiationRefs >= operations, `${path} has operations without version negotiation`)
  requireValue(unsupportedResponses >= operations, `${path} has operations without a 406 response`)
}

if (errors.length) throw new Error(`Compatibility policy failed:\n- ${errors.join("\n- ")}`)
console.log(`Compatibility policy passed: core ${policy.core_version}, API v${policy.api_major}, suite ${policy.current_conformance_suite}, ${inheritedIds.size} inherited cases`)
