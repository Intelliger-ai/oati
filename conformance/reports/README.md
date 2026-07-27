# Versioned conformance reports

Reports in this directory are deterministic evidence for a specific implementation version and conformance-suite version. Do not overwrite a published report after release; generate a new filename when either version changes.

Reports must validate against [`conformance-report.schema.json`](../../schemas/conformance-report.schema.json). A passing report has `summary.failed` equal to zero and every result status equal to `pass`.
