#!/usr/bin/env node
import { cp, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, isAbsolute, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(import.meta.dirname, "..")
const schemaRoot = resolve(root, "schemas")
const canonicalOrigin = "https://schemas.intelliger.ai"

async function schemaFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...await schemaFiles(path))
    else if (entry.isFile() && entry.name.endsWith(".schema.json")) files.push(path)
  }
  return files.sort()
}

export async function buildSchemaSite(outputDirectory) {
  const output = resolve(outputDirectory)
  const existing = await readdir(output).catch((error) => error.code === "ENOENT" ? [] : Promise.reject(error))
  if (existing.length) throw new Error(`output directory must be empty: ${output}`)

  const files = await schemaFiles(schemaRoot)
  const routes = new Map()
  const schemas = []
  for (const file of files) {
    const source = await readFile(file, "utf8")
    const schema = JSON.parse(source)
    if (typeof schema.$id !== "string") throw new Error(`${relative(root, file)} has no $id`)
    const identifier = new URL(schema.$id)
    if (identifier.origin !== canonicalOrigin || identifier.search || identifier.hash || !identifier.pathname.startsWith("/oati/") || !identifier.pathname.endsWith(".schema.json")) {
      throw new Error(`${relative(root, file)} has an invalid canonical $id: ${schema.$id}`)
    }
    if (routes.has(identifier.pathname)) throw new Error(`duplicate canonical schema route: ${identifier.pathname}`)
    routes.set(identifier.pathname, file)
    schemas.push({ file, identifier, schema })
  }

  for (const { file, schema } of schemas) {
    for (const value of JSON.stringify(schema).matchAll(/https:\/\/schemas\.intelliger\.ai[^"\\]+/g)) {
      const reference = new URL(value[0])
      if (!routes.has(reference.pathname)) throw new Error(`${relative(root, file)} references an unpublished schema route: ${reference.pathname}`)
    }
  }

  for (const [pathname, file] of routes) {
    const destination = resolve(output, `.${pathname}`)
    const relativeDestination = relative(output, destination)
    if (relativeDestination.startsWith("..") || isAbsolute(relativeDestination)) throw new Error(`schema route escapes output directory: ${pathname}`)
    await mkdir(dirname(destination), { recursive: true })
    await cp(file, destination)
  }
  return routes.size
}

async function main() {
  const suppliedOutput = process.argv[2]
  const temporary = suppliedOutput ? undefined : await mkdtemp(resolve(tmpdir(), "oati-schema-site-"))
  const output = suppliedOutput ?? temporary
  try {
    const count = await buildSchemaSite(output)
    console.log(`Built ${count} canonical OATI schema routes${suppliedOutput ? ` in ${resolve(output)}` : ""}`)
  } finally {
    if (temporary) await rm(temporary, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
