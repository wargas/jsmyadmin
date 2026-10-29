"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { EraserIcon, Trash2Icon } from "lucide-react"
import { useRows } from "@/lib/api"
import { execWithToast } from "@/lib/actions"
import { databaseHref, tableHref } from "@/lib/routes"
import { collateClause, qualified, quoteString } from "@/lib/sql"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useConfirm } from "@/components/confirm-dialog"
import { CollationInput } from "@/components/create-database-dialog"

type Status = { engine: string | null; collation: string | null; comment: string; autoIncrement: number | null }

const MAINTENANCE = [
  ["CHECK", "Verificar"],
  ["ANALYZE", "Analisar"],
  ["OPTIMIZE", "Otimizar"],
  ["REPAIR", "Reparar"],
  ["CHECKSUM", "Checksum"],
] as const

function Section({ title, children, danger }: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <div className={`flex flex-col gap-3 rounded-xl border p-4 ${danger ? "border-destructive/40" : ""}`}>
      <h2 className={`font-medium ${danger ? "text-destructive" : ""}`}>{title}</h2>
      {children}
    </div>
  )
}

function DatabasePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { rows } = useRows<{ name: string }>("SELECT SCHEMA_NAME AS name FROM information_schema.SCHEMATA ORDER BY 1")
  return (
    <select className="h-8 rounded-lg border bg-transparent px-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
      {rows?.map((r) => (
        <option key={r.name} value={r.name}>
          {r.name}
        </option>
      ))}
    </select>
  )
}

export function OperationsTab({ database, table, isView }: { database: string; table: string; isView: boolean }) {
  const router = useRouter()
  const confirm = useConfirm()
  const target = qualified(database, table)
  const { rows } = useRows<Status>(
    "SELECT ENGINE AS engine, TABLE_COLLATION AS collation, TABLE_COMMENT AS comment, AUTO_INCREMENT AS autoIncrement FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
    [database, table]
  )
  const status = rows?.[0]

  const [moveDb, setMoveDb] = useState(database)
  const [moveName, setMoveName] = useState(table)
  const [copyDb, setCopyDb] = useState(database)
  const [copyName, setCopyName] = useState(`${table}_copia`)
  const [copyData, setCopyData] = useState(true)
  const [options, setOptions] = useState<{ engine?: string; collation?: string; comment?: string; autoIncrement?: string }>({})

  const optionsSql = [
    options.engine && `ENGINE=${options.engine.replace(/\W/g, "")}`,
    options.collation && collateClause(options.collation).trim(),
    options.comment !== undefined && `COMMENT=${quoteString(options.comment)}`,
    options.autoIncrement && `AUTO_INCREMENT=${Number(options.autoIncrement)}`,
  ].filter(Boolean)

  return (
    <div className="grid max-w-5xl gap-4 lg:grid-cols-2">
      <Section title="Mover / renomear">
        <div className="grid grid-cols-2 gap-2">
          <DatabasePicker value={moveDb} onChange={setMoveDb} />
          <Input value={moveName} onChange={(e) => setMoveName(e.target.value)} />
        </div>
        <Button
          className="self-start"
          disabled={!moveName || (moveDb === database && moveName === table)}
          onClick={async () => {
            const sql = `RENAME TABLE ${target} TO ${qualified(moveDb, moveName)}`
            if (await execWithToast(sql, { success: "Tabela movida" })) router.replace(tableHref(moveDb, moveName))
          }}
        >
          Aplicar
        </Button>
      </Section>

      {!isView && (
        <Section title="Copiar tabela">
          <div className="grid grid-cols-2 gap-2">
            <DatabasePicker value={copyDb} onChange={setCopyDb} />
            <Input value={copyName} onChange={(e) => setCopyName(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={copyData} onCheckedChange={setCopyData} /> Copiar também os dados
          </label>
          <Button
            className="self-start"
            disabled={!copyName}
            onClick={async () => {
              const copy = qualified(copyDb, copyName)
              const sql = `CREATE TABLE ${copy} LIKE ${target};` + (copyData ? `\nINSERT INTO ${copy} SELECT * FROM ${target};` : "")
              if (await execWithToast(sql, { success: "Tabela copiada" })) router.push(tableHref(copyDb, copyName))
            }}
          >
            Copiar
          </Button>
        </Section>
      )}

      {!isView && status && (
        <Section title="Opções da tabela">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Engine</Label>
              <Input defaultValue={status.engine ?? ""} onChange={(e) => setOptions({ ...options, engine: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Collation</Label>
              <CollationInput defaultValue={status.collation ?? ""} onChange={(e) => setOptions({ ...options, collation: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Comentário</Label>
              <Input defaultValue={status.comment} onChange={(e) => setOptions({ ...options, comment: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>AUTO_INCREMENT</Label>
              <Input
                type="number"
                defaultValue={status.autoIncrement ?? ""}
                onChange={(e) => setOptions({ ...options, autoIncrement: e.target.value })}
              />
            </div>
          </div>
          <Button
            className="self-start"
            disabled={!optionsSql.length}
            onClick={async () => {
              if (await execWithToast(`ALTER TABLE ${target} ${optionsSql.join(" ")}`, { success: "Opções alteradas" })) setOptions({})
            }}
          >
            Salvar opções
          </Button>
        </Section>
      )}

      {!isView && (
        <Section title="Manutenção">
          <div className="flex flex-wrap gap-2">
            {MAINTENANCE.map(([command, label]) => (
              <Button key={command} variant="outline" onClick={() => execWithToast(`${command} TABLE ${target}`, { success: `${label}: concluído` })}>
                {label}
              </Button>
            ))}
          </div>
        </Section>
      )}

      <Section title="Zona de perigo" danger>
        <div className="flex flex-wrap gap-2">
          {!isView && (
            <Button
              variant="outline"
              onClick={async () => {
                const sql = `TRUNCATE TABLE ${target}`
                if (await confirm({ title: `Esvaziar ${table}?`, description: "Todas as linhas serão apagadas.", sql, destructive: true, confirmLabel: "Esvaziar" }))
                  await execWithToast(sql, { success: "Tabela esvaziada" })
              }}
            >
              <EraserIcon />
              Esvaziar (TRUNCATE)
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={async () => {
              const sql = `DROP ${isView ? "VIEW" : "TABLE"} ${target}`
              if (!(await confirm({ title: `Excluir ${table}?`, sql, destructive: true, confirmLabel: "Excluir" }))) return
              if (await execWithToast(sql, { success: `${table} excluída` })) router.replace(databaseHref(database))
            }}
          >
            <Trash2Icon />
            Excluir {isView ? "view" : "tabela"}
          </Button>
        </div>
      </Section>
    </div>
  )
}
