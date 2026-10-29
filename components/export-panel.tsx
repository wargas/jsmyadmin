"use client"

import { useState } from "react"
import { DownloadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const FORMATS = { sql: "SQL", csv: "CSV", json: "JSON" } as const

export function ExportPanel({ database, table }: { database: string; table?: string }) {
  const [format, setFormat] = useState<keyof typeof FORMATS>("sql")
  const [structure, setStructure] = useState(true)
  const [data, setData] = useState(true)

  const params = new URLSearchParams({ db: database, format, structure: structure ? "1" : "0", data: data ? "1" : "0" })
  if (table) params.set("table", table)

  return (
    <div className="flex max-w-md flex-col gap-4 rounded-xl border p-4">
      <div>
        <h2 className="font-medium">Exportar {table ? `a tabela ${table}` : `o banco ${database}`}</h2>
        <p className="text-sm text-muted-foreground">O arquivo é gerado no servidor e baixado em streaming.</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label>Formato</Label>
        <Select value={format} onValueChange={(v) => v && setFormat(v as keyof typeof FORMATS)}>
          <SelectTrigger className="w-40">
            <SelectValue>{(v: keyof typeof FORMATS) => FORMATS[v]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(FORMATS)
              .filter(([key]) => table || key === "sql")
              .map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
      {format === "sql" && (
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={structure} onCheckedChange={setStructure} /> Estrutura
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={data} onCheckedChange={setData} /> Dados
          </label>
        </div>
      )}
      <Button className="self-start" render={<a href={`/api/export?${params}`} download />} nativeButton={false}>
        <DownloadIcon />
        Exportar
      </Button>
    </div>
  )
}
