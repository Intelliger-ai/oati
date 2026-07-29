import assert from "node:assert/strict"
import test from "node:test"
import { checkDocumentation } from "./check-docs.mjs"

test("developer documentation is internally resolvable and matches public packages", async () => {
  const result = await checkDocumentation()
  assert.equal(result.failures.length, 0, result.failures.join("\n"))
  assert.ok(result.files >= 40)
})
