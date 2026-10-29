"use client"

import { useState } from "react"
import { CircleStopIcon, PlusIcon, ShieldIcon, Trash2Icon } from "lucide-react"
import { useRows } from "@/lib/api"
import { execWithToast } from "@/lib/actions"
import { quoteIdent, quoteString } from "@/lib/sql"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useConfirm } from "@/components/confirm-dialog"
import { PageTitle } from "@/components/page-title"
import { QueryGrid } from "@/components/query-grid"
import { SqlPreview } from "@/components/sql-preview"

const PRIVILEGES = [
  "SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "DROP", "INDEX", "ALTER", "CREATE VIEW", "SHOW VIEW",
  "CREATE ROUTINE", "ALTER ROUTINE", "EXECUTE", "TRIGGER", "EVENT", "REFERENCES", "LOCK TABLES",
  "CREATE TEMPORARY TABLES",
]

const account = (user: string, host: string) => `${quoteString(user)}@${quoteString(host)}`

export function ServerView() {
  return (
    <div className="flex flex-col gap-4">
      <PageTitle title="Servidor" description="Status, variáveis, processos e contas de usuário" />
      <Tabs defaultValue="status">
        <TabsList>
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="variables">Variáveis</TabsTrigger>
          <TabsTrigger value="processes">Processos</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="engines">Engines</TabsTrigger>
          <TabsTrigger value="charsets">Charsets</TabsTrigger>
        </TabsList>
        <TabsContent value="status">
          <QueryGrid sql="SHOW GLOBAL STATUS" />
        </TabsContent>
        <TabsContent value="variables">
          <QueryGrid sql="SHOW GLOBAL VARIABLES" />
        </TabsContent>
        <TabsContent value="processes">
          <ProcessList />
        </TabsContent>
        <TabsContent value="users">
          <Users />
        </TabsContent>
        <TabsContent value="engines">
          <QueryGrid sql="SHOW ENGINES" />
        </TabsContent>
        <TabsContent value="charsets">
          <QueryGrid sql="SELECT COLLATION_NAME, CHARACTER_SET_NAME, ID, IS_DEFAULT, IS_COMPILED, SORTLEN FROM information_schema.COLLATIONS ORDER BY CHARACTER_SET_NAME, COLLATION_NAME" />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ProcessList() {
  const confirm = useConfirm()
  return (
    <QueryGrid
      sql="SHOW FULL PROCESSLIST"
      selectable
      toolbar={(selected) => (
        <Button
          variant="destructive"
          disabled={!selected.length}
          onClick={async () => {
            const sql = selected.map((row) => `KILL ${Number(row.c0)};`).join("\n")
            if (await confirm({ title: "Encerrar processos?", sql, destructive: true, confirmLabel: "Encerrar" }))
              await execWithToast(sql, { success: "Processos encerrados" })
          }}
        >
          <CircleStopIcon />
          Encerrar ({selected.length})
        </Button>
      )}
    />
  )
}

function Users() {
  const confirm = useConfirm()
  const [grantsFor, setGrantsFor] = useState<{ user: string; host: string } | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <QueryGrid
        sql="SELECT User, Host, plugin, account_locked, password_expired, password_last_changed FROM mysql.user ORDER BY User, Host"
        selectable
        className="h-[360px] w-full"
        toolbar={(selected) => {
          const one = selected.length === 1 ? { user: String(selected[0].c0), host: String(selected[0].c1) } : null
          return (
            <>
              <Button variant="outline" disabled={!one} onClick={() => setGrantsFor(one)}>
                <ShieldIcon />
                Privilégios
              </Button>
              <Button
                variant="destructive"
                disabled={!selected.length}
                onClick={async () => {
                  const sql = `DROP USER ${selected.map((r) => account(String(r.c0), String(r.c1))).join(", ")}`
                  if (await confirm({ title: "Excluir usuários?", sql, destructive: true, confirmLabel: "Excluir" }))
                    await execWithToast(sql, { success: "Usuários excluídos" })
                }}
              >
                <Trash2Icon />
                Excluir
              </Button>
              <CreateUserDialog />
            </>
          )
        }}
      />
      {grantsFor && <Grants user={grantsFor.user} host={grantsFor.host} />}
    </div>
  )
}

function PrivilegePicker({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const all = value.includes("ALL PRIVILEGES")
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm font-medium">
        <Checkbox checked={all} onCheckedChange={(checked) => onChange(checked ? ["ALL PRIVILEGES"] : [])} />
        ALL PRIVILEGES
      </label>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {PRIVILEGES.map((privilege) => (
          <label key={privilege} className="flex items-center gap-2 text-xs">
            <Checkbox
              disabled={all}
              checked={all || value.includes(privilege)}
              onCheckedChange={(checked) =>
                onChange(checked ? [...value, privilege] : value.filter((p) => p !== privilege))
              }
            />
            {privilege}
          </label>
        ))}
      </div>
    </div>
  )
}

function scopeClause(database: string) {
  return database === "*" ? "*.*" : `${quoteIdent(database)}.*`
}

function CreateUserDialog() {
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState("")
  const [host, setHost] = useState("%")
  const [password, setPassword] = useState("")
  const [database, setDatabase] = useState("*")
  const [privileges, setPrivileges] = useState<string[]>([])

  const masked = (pw: string) =>
    `CREATE USER ${account(user || "usuario", host)} IDENTIFIED BY ${pw};` +
    (privileges.length ? `\nGRANT ${privileges.join(", ")} ON ${scopeClause(database)} TO ${account(user || "usuario", host)};` : "")
  const sql = masked(quoteString(password))
  const preview = masked("'***'")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <PlusIcon />
        Novo usuário
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault()
            if (await execWithToast(sql, { success: `Usuário ${user} criado`, description: preview })) setOpen(false)
          }}
        >
          <DialogHeader>
            <DialogTitle>Criar usuário</DialogTitle>
            <DialogDescription>Cria a conta e, opcionalmente, concede privilégios.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Usuário</Label>
              <Input value={user} onChange={(e) => setUser(e.target.value)} required autoFocus />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Host</Label>
              <Input value={host} onChange={(e) => setHost(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Senha</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Escopo dos privilégios</Label>
              <DatabaseScopeInput value={database} onChange={setDatabase} />
            </div>
          </div>
          <PrivilegePicker value={privileges} onChange={setPrivileges} />
          <SqlPreview sql={preview} />
          <DialogFooter>
            <Button type="submit" disabled={!user}>
              Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DatabaseScopeInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { rows } = useRows<{ name: string }>("SELECT SCHEMA_NAME AS name FROM information_schema.SCHEMATA ORDER BY 1")
  return (
    <>
      <Input list="scope-databases" value={value} onChange={(e) => onChange(e.target.value)} placeholder="* = global" />
      <datalist id="scope-databases">
        <option value="*" />
        {rows?.map((r) => <option key={r.name} value={r.name} />)}
      </datalist>
    </>
  )
}

function Grants({ user, host }: { user: string; host: string }) {
  const [database, setDatabase] = useState("*")
  const [privileges, setPrivileges] = useState<string[]>([])
  const target = account(user, host)
  const list = privileges.join(", ")

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <h2 className="font-medium">
        Privilégios de <span className="font-mono">{user}@{host}</span>
      </h2>
      <QueryGrid sql={`SHOW GRANTS FOR ${target}`} className="h-[200px] w-full" />
      <div className="grid gap-3 sm:grid-cols-[16rem_1fr]">
        <div className="flex flex-col gap-2">
          <Label>Escopo</Label>
          <DatabaseScopeInput value={database} onChange={setDatabase} />
        </div>
        <PrivilegePicker value={privileges} onChange={setPrivileges} />
      </div>
      <div className="flex gap-2">
        <Button
          disabled={!privileges.length}
          onClick={() => execWithToast(`GRANT ${list} ON ${scopeClause(database)} TO ${target}`, { success: "Privilégios concedidos" })}
        >
          Conceder
        </Button>
        <Button
          variant="outline"
          disabled={!privileges.length}
          onClick={() => execWithToast(`REVOKE ${list} ON ${scopeClause(database)} FROM ${target}`, { success: "Privilégios revogados" })}
        >
          Revogar
        </Button>
      </div>
    </div>
  )
}
