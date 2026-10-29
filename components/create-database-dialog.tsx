"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon } from "lucide-react"
import { useRows } from "@/lib/api"
import { execWithToast } from "@/lib/actions"
import { databaseHref } from "@/lib/routes"
import { collateClause, quoteIdent } from "@/lib/sql"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SqlPreview } from "@/components/sql-preview"

export function CollationInput(props: React.ComponentProps<typeof Input>) {
  const { rows } = useRows<{ name: string }>(
    "SELECT COLLATION_NAME AS name FROM information_schema.COLLATIONS ORDER BY COLLATION_NAME"
  )
  return (
    <>
      <Input list="collations" placeholder="Padrão do servidor" {...props} />
      <datalist id="collations">
        {rows?.map((c) => <option key={c.name} value={c.name} />)}
      </datalist>
    </>
  )
}

export function CreateDatabaseDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [collation, setCollation] = useState("utf8mb4_unicode_ci")
  const sql = `CREATE DATABASE ${quoteIdent(name || "nome")}${collateClause(collation)}`

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (await execWithToast(sql, { success: `Banco ${name} criado` })) {
      setOpen(false)
      router.push(databaseHref(name))
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <PlusIcon />
        Novo banco
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Criar banco de dados</DialogTitle>
            <DialogDescription>Define o nome e o agrupamento (collation) padrão.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="db-name">Nome</Label>
            <Input id="db-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="db-collation">Collation</Label>
            <CollationInput id="db-collation" value={collation} onChange={(e) => setCollation(e.target.value)} />
          </div>
          <SqlPreview sql={sql} />
          <DialogFooter>
            <Button type="submit" disabled={!name}>
              Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
