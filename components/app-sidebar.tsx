"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  ChevronRightIcon,
  DatabaseIcon,
  EyeIcon,
  HouseIcon,
  LogOutIcon,
  MonitorCogIcon,
  MoonIcon,
  RefreshCwIcon,
  SquareTerminalIcon,
  SunIcon,
  TableIcon,
} from "lucide-react"
import { refreshAll, useRows } from "@/lib/api"
import { databaseHref, tableHref } from "@/lib/routes"
import { Skeleton } from "@/components/ui/skeleton"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"

const NAV = [
  { href: "/", label: "Início", icon: HouseIcon },
  { href: "/sql", label: "SQL", icon: SquareTerminalIcon },
  { href: "/server", label: "Servidor", icon: MonitorCogIcon },
]

export function AppSidebar() {
  const pathname = usePathname()
  const [filter, setFilter] = useState("")
  const { rows: databases, isLoading } = useRows<{ name: string }>(
    "SELECT SCHEMA_NAME AS name FROM information_schema.SCHEMATA ORDER BY SCHEMA_NAME"
  )
  const visible = databases?.filter((db) => db.name.toLowerCase().includes(filter.toLowerCase()))

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <DatabaseIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">jsMyAdmin</span>
                <ServerLabel />
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {NAV.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  isActive={pathname === item.href}
                  tooltip={item.label}
                  render={<Link href={item.href} />}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Bancos de dados</SidebarGroupLabel>
          <SidebarGroupAction title="Atualizar" onClick={() => refreshAll()}>
            <RefreshCwIcon />
            <span className="sr-only">Atualizar</span>
          </SidebarGroupAction>
          <SidebarGroupContent className="flex flex-col gap-2">
            <SidebarInput placeholder="Filtrar…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <SidebarMenu>
              {isLoading &&
                Array.from({ length: 5 }, (_, i) => (
                  <SidebarMenuItem key={i} className="px-2 py-1.5">
                    <Skeleton className="h-4 w-full" />
                  </SidebarMenuItem>
                ))}
              {visible?.map((db) => (
                <DatabaseItem key={db.name} database={db.name} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <ThemeToggle />
          <LogoutButton />
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function ServerLabel() {
  const { rows } = useRows<{ user: string; version: string }>("SELECT CURRENT_USER() AS user, VERSION() AS version")
  const info = rows?.[0]
  return <span className="truncate text-xs text-muted-foreground">{info ? `${info.user} · ${info.version}` : "…"}</span>
}

function DatabaseItem({ database, pathname }: { database: string; pathname: string }) {
  const href = databaseHref(database)
  const inside = pathname === href || pathname.startsWith(href + "/")
  const [open, setOpen] = useState(inside)

  return (
    <Collapsible render={<SidebarMenuItem />} open={open || inside} onOpenChange={setOpen}>
      <SidebarMenuButton isActive={pathname === href} render={<Link href={href} />}>
        <DatabaseIcon />
        <span>{database}</span>
      </SidebarMenuButton>
      <CollapsibleTrigger
        render={<SidebarMenuAction className="transition-transform data-panel-open:rotate-90" />}
      >
        <ChevronRightIcon />
        <span className="sr-only">Mostrar tabelas</span>
      </CollapsibleTrigger>
      <CollapsibleContent>{(open || inside) && <TableList database={database} pathname={pathname} />}</CollapsibleContent>
    </Collapsible>
  )
}

function TableList({ database, pathname }: { database: string; pathname: string }) {
  const { rows, isLoading } = useRows<{ name: string; type: string }>(
    "SELECT TABLE_NAME AS name, TABLE_TYPE AS type FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME",
    [database]
  )
  return (
    <SidebarMenuSub>
      {isLoading && <Skeleton className="mx-2 my-1 h-4" />}
      {rows?.length === 0 && <li className="px-2 py-1 text-xs text-muted-foreground">Nenhuma tabela</li>}
      {rows?.map((table) => {
        const href = tableHref(database, table.name)
        const Icon = table.type === "VIEW" ? EyeIcon : TableIcon
        return (
          <SidebarMenuSubItem key={table.name}>
            <SidebarMenuSubButton isActive={pathname === href} render={<Link href={href} />}>
              <Icon />
              <span>{table.name}</span>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        )
      })}
    </SidebarMenuSub>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === "dark"
  return (
    <SidebarMenuItem>
      <SidebarMenuButton tooltip="Alternar tema" onClick={() => setTheme(dark ? "light" : "dark")}>
        {dark ? <SunIcon /> : <MoonIcon />}
        <span>{dark ? "Tema claro" : "Tema escuro"}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function LogoutButton() {
  const router = useRouter()
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip="Sair"
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" })
          router.replace("/login")
          router.refresh()
        }}
      >
        <LogOutIcon />
        <span>Sair</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
