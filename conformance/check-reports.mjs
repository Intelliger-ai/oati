#!/usr/bin/env node
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { canonicalJson, validateSchema } from "../sdk/typescript/dist/index.js"

export function checkConformanceReports(reports, expectedTotal = 73) {
  if (!Array.isArray(reports) || reports.length < 2) throw new Error("at least two conformance reports are required")
  const languages = new Set()
  let baseline
  let baselineSuite
  for (const report of reports) {
    const checked = validateSchema("conformanceReport", report)
    if (!checked.valid) throw new Error(`${report?.implementation?.language ?? "unknown"} report is schema-invalid: ${checked.issues.map((item) => item.code).join(",")}`)
    const language = report.implementation.language
    if (languages.has(language)) throw new Error(`duplicate implementation language ${language}`)
    languages.add(language)
    const suiteIdentity = `${report.standard_version}\0${report.suite_version}`
    if (baselineSuite === undefined) baselineSuite = suiteIdentity
    else if (suiteIdentity !== baselineSuite) throw new Error(`${language} report targets a different standard or suite version`)
    if (report.summary.total !== report.results.length || report.summary.passed + report.summary.failed !== report.summary.total) throw new Error(`${language} report summary is inconsistent`)
    if (report.summary.total !== expectedTotal) throw new Error(`${language} executed ${report.summary.total}, expected ${expectedTotal} cases`)
    if (report.summary.failed !== 0 || report.results.some((item) => item.status !== "pass")) throw new Error(`${language} did not pass the full suite`)
    if (new Set(report.results.map((item) => item.id)).size !== report.results.length) throw new Error(`${language} report contains duplicate case ids`)
    const comparable = report.results.map(({ id, category, expected_outcome, observed_outcome, codes }) => ({ id, category, expected_outcome, observed_outcome, codes }))
    const rendered = canonicalJson(comparable)
    if (baseline === undefined) baseline = rendered
    else if (rendered !== baseline) throw new Error(`${language} results differ from the cross-language baseline`)
  }
  return { languages: [...languages], total: expectedTotal, standardVersion: reports[0].standard_version, suiteVersion: reports[0].suite_version }
}

async function main(paths) {
  const reports = await Promise.all(paths.map(async (path) => JSON.parse(await readFile(resolve(path), "utf8"))))
  const result = checkConformanceReports(reports)
  process.stdout.write(`Cross-SDK conformance passed: OATI ${result.standardVersion}, suite ${result.suiteVersion}, ${result.languages.join(", ")} ${result.total}/${result.total}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main(process.argv.slice(2))
