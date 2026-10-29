"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { DatabaseIcon, Loader2Icon } from "lucide-react"
import { databaseHref } from "@/lib/routes"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const form = Object.fromEntries(new FormData(event.currentTarget))
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
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
