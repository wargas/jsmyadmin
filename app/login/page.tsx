"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { DatabaseIcon, Loader2Icon } from "lucide-react"
import { databaseHref } from "@/lib/routes"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Mode = "fields" | "url"

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("fields")
  const [tls, setTls] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    // Inactive tab panels are unmounted, so the form only holds the current mode's fields.
    const form = Object.fromEntries(new FormData(event.currentTarget))
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mode === "url" ? { url: form.url } : { ...form, tls: tls ? "on" : undefined }),
    })
    const body = await response.json().catch(() => ({}))
    if (response.ok) {
      router.replace(body.database ? databaseHref(body.database) : "/")
      router.refresh()
      return
    }
    setError(body.error ?? "Não foi possível conectar")
    setPending(false)
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <DatabaseIcon className="size-5" />
          </div>
          <CardTitle className="text-xl">jsMyAdmin</CardTitle>
          <CardDescription>Conecte-se a um servidor MySQL</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Tabs value={mode} onValueChange={(value) => (setMode(value as Mode), setError(null))}>
              <TabsList className="w-full">
                <TabsTrigger value="fields">Campos</TabsTrigger>
                <TabsTrigger value="url">URL</TabsTrigger>
              </TabsList>

              <TabsContent value="fields" className="flex flex-col gap-4 pt-2">
                <div className="grid grid-cols-[1fr_6rem] gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="host">Host</Label>
                    <Input id="host" name="host" defaultValue="localhost" required autoFocus />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="port">Porta</Label>
                    <Input id="port" name="port" type="number" defaultValue={3306} min={1} max={65535} required />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="user">Usuário</Label>
                  <Input id="user" name="user" defaultValue="root" autoComplete="username" required />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input id="password" name="password" type="password" autoComplete="current-password" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="database">
                    Banco de dados <span className="font-normal text-muted-foreground">(opcional)</span>
                  </Label>
                  <Input id="database" name="database" placeholder="Todos os bancos" />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={tls} onCheckedChange={setTls} />
                  Usar SSL/TLS
                </label>
              </TabsContent>

              <TabsContent value="url" className="flex flex-col gap-2 pt-2">
                <Label htmlFor="url">URL de conexão</Label>
                <Input
                  id="url"
                  name="url"
                  required
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="mysql://usuario:senha@host:3306/banco"
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Banco é opcional. Use <code>?ssl=true</code> para TLS; caracteres especiais na senha devem ser
                  codificados (ex.: <code>@</code> → <code>%40</code>).
                </p>
              </TabsContent>
            </Tabs>

            {error && (
              <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={pending} className="w-full">
              {pending && <Loader2Icon className="animate-spin" />}
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
