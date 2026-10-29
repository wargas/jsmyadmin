"use client"

import { useState } from "react"
import { Loader2Icon, UploadIcon } from "lucide-react"
import { toast } from "sonner"
import { refreshAll, runSql } from "@/lib/api"
import type { StatementResult } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ResultView } from "@/components/result-view"

export function ImportPanel({ database }: { database?: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [running, setRunning] = useState(false)
  const [summary, setSummary] = useState<{ ok: number; failed?: StatementResult } | null>(null)

  async function run() {
    if (!file) return
    setRunning(true)
    setSummary(null)
    try {
      const results = await runSql(await file.text(), { database })
      const failed = results.find((r) => r.error)
      setSummary({ ok: results.filter((r) => !r.error).length, failed })
      if (!failed) toast.success(`Importação concluída: ${results.length} comandos`)
      await refreshAll()
    } catch (error) {
      toast.error("Falha na importação", { description: (error as Error).message })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4 rounded-xl border p-4">
      <div>
        <h2 className="font-medium">Importar arquivo SQL{database ? ` em ${database}` : ""}</h2>
        <p className="text-sm text-muted-foreground">
          Os comandos são executados em sequência e a importação para no primeiro erro.
        </p>
      </div>
      <Input type="file" accept=".sql,text/plain" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <Button className="self-start" disabled={!file || running} onClick={run}>
        {running ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
        Importar
      </Button>
      {summary && (
        <div className="flex flex-col gap-2 text-sm">
          <p>{summary.ok} comando(s) executado(s) com sucesso.</p>
          {summary.failed && <ResultView result={summary.failed} />}
        </div>
      )}
    </div>
  )
}
