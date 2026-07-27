"use client"

import { FormEvent, useState } from "react"
import {
  BadgeCheckIcon,
  BookOpenIcon,
  BracesIcon,
  Code2Icon,
  ExternalLinkIcon,
  FingerprintIcon,
  KeyRoundIcon,
  SearchIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type LookupRecord = {
  type: string
  id: string
  display_name: string
  status: string
  issuer: string
  organisation_id: string
  issued_at: string
  expires_at: string
  assurance_level: string
  proof_status: string
  public_attributes: Record<string, string>
}

const lookupTypes = [
  ["organisation", "Organisation"],
  ["agent", "Agent or Passport"],
  ["mandate", "Mandate"],
  ["receipt", "Receipt"],
  ["issuer", "Issuer"],
  ["key", "Key"],
  ["revocation", "Revocation status"],
] as const

export function LookupConsole() {
  const [type, setType] = useState("agent")
  const [identifier, setIdentifier] = useState("oati:agent:intelliger:commerce-demo")
  const [record, setRecord] = useState<LookupRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/lookup?type=${encodeURIComponent(type)}&id=${encodeURIComponent(identifier)}`
      )
      const body = (await response.json()) as LookupRecord | { error: string }
      if (!response.ok || "error" in body) {
        throw new Error("error" in body ? body.error : "lookup_failed")
      }
      setRecord(body)
    } catch (lookupError) {
      setRecord(null)
      const code = lookupError instanceof Error ? lookupError.message : "lookup_failed"
      setError(
        code === "lookup_service_unavailable"
          ? "The lookup service is not available. Start the local Go service or try again later."
          : code === "record_not_found"
            ? "No public OATI record matches this identifier."
            : "The record could not be verified. Check the identifier and try again."
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-12">
      <header className="flex items-center justify-between gap-4">
        <a href="https://intelliger.ai/oati" className="flex items-center gap-3" aria-label="OATI home">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
            O
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-semibold tracking-tight">OATI</span>
            <span className="mt-1 text-xs text-muted-foreground">by Intelliger</span>
          </span>
        </a>
        <nav className="flex items-center gap-2" aria-label="Project links">
          <Button variant="ghost" size="sm" render={<a href="https://github.com/Intelliger-ai/oati" />}>
            <Code2Icon data-icon="inline-start" />
            <span className="hidden sm:inline">GitHub</span>
          </Button>
          <Button variant="outline" size="sm" render={<a href="https://intelliger.ai/oati/docs" />}>
            <BookOpenIcon data-icon="inline-start" />
            Docs
          </Button>
        </nav>
      </header>

      <section className="grid flex-1 items-center gap-10 py-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(32rem,1.1fr)] lg:py-24">
        <div className="flex max-w-xl flex-col gap-7">
          <Badge variant="outline" className="w-fit">
            <ShieldCheckIcon data-icon="inline-start" />
            Public verification service
          </Badge>
          <div className="flex flex-col gap-4">
            <h1 className="text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-5xl lg:text-6xl">
              Trust should resolve before an agent acts.
            </h1>
            <p className="max-w-lg text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
              Verify who owns an agent, whether its authority is current, and what evidence stands behind an OATI transaction.
            </p>
          </div>
          <div className="grid gap-4 border-l pl-5 text-sm sm:grid-cols-3">
            <div>
              <p className="font-medium">Current</p>
              <p className="mt-1 text-muted-foreground">Live status and revocation</p>
            </div>
            <div>
              <p className="font-medium">Verifiable</p>
              <p className="mt-1 text-muted-foreground">Issuer and proof checks</p>
            </div>
            <div>
              <p className="font-medium">Selective</p>
              <p className="mt-1 text-muted-foreground">Public fields only</p>
            </div>
          </div>
        </div>

        <Card className="overflow-hidden shadow-xl shadow-foreground/5">
          <CardHeader className="border-b bg-muted/40">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <CardTitle>Lookup an OATI record</CardTitle>
                <CardDescription>Public responses are rate-limited and privacy-filtered.</CardDescription>
              </div>
              <FingerprintIcon className="text-muted-foreground" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleLookup}>
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
                  <Field>
                    <FieldLabel htmlFor="record-type">Record type</FieldLabel>
                    <Select value={type} onValueChange={(value) => setType(value ?? "agent")}>
                      <SelectTrigger id="record-type" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {lookupTypes.map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="identifier">OATI identifier</FieldLabel>
                    <Input
                      id="identifier"
                      value={identifier}
                      onChange={(event) => setIdentifier(event.target.value)}
                      placeholder="oati:agent:organisation:agent-name"
                      spellCheck={false}
                      required
                    />
                  </Field>
                </div>
                <Field orientation="horizontal">
                  <Button type="submit" disabled={pending || !identifier.trim()}>
                    <SearchIcon data-icon="inline-start" />
                    {pending ? "Verifying…" : "Verify record"}
                  </Button>
                  <FieldDescription>Try the prefilled public demonstration Agent ID.</FieldDescription>
                </Field>
              </FieldGroup>
            </form>

            {error ? (
              <Alert variant="destructive" className="mt-6">
                <KeyRoundIcon />
                <AlertTitle>Verification unavailable</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {record ? <VerificationRecord record={record} /> : null}
          </CardContent>
        </Card>
      </section>

      <footer className="flex flex-col gap-4 border-t py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>OATI is an open standard by Intelliger. Licensed under Apache 2.0.</p>
        <a href="https://api.intelliger.ai/oati/v1" className="inline-flex items-center gap-1 hover:text-foreground">
          Machine API
          <ExternalLinkIcon aria-hidden="true" />
        </a>
      </footer>
    </div>
  )
}

function VerificationRecord({ record }: { record: LookupRecord }) {
  return (
    <div className="mt-7 flex flex-col gap-5" aria-live="polite">
      <Separator />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Verified record</p>
          <h2 className="mt-2 truncate text-xl font-semibold">{record.display_name}</h2>
          <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{record.id}</p>
        </div>
        <Badge variant="secondary">
          <BadgeCheckIcon data-icon="inline-start" />
          {record.status}
        </Badge>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Claim</TableHead>
            <TableHead>Public value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <Claim label="Organisation" value={record.organisation_id} mono />
          <Claim label="Issuer" value={record.issuer} />
          <Claim label="Assurance" value={record.assurance_level} />
          <Claim label="Proof" value={record.proof_status} />
          <Claim label="Valid until" value={new Date(record.expires_at).toLocaleString()} />
          {Object.entries(record.public_attributes).map(([label, value]) => (
            <Claim key={label} label={label.replaceAll("_", " ")} value={value} />
          ))}
        </TableBody>
      </Table>
      <Alert>
        <BracesIcon />
        <AlertTitle>Verification scope</AlertTitle>
        <AlertDescription>
          This result confirms the current public record and proof status. It does not authorise a transaction or prove an external claim is true.
        </AlertDescription>
      </Alert>
    </div>
  )
}

function Claim({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <TableRow>
      <TableCell className="capitalize text-muted-foreground">{label}</TableCell>
      <TableCell className={mono ? "font-mono text-xs" : undefined}>{value}</TableCell>
    </TableRow>
  )
}
