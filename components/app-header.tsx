"use client"

import { Fragment } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { databaseHref, tableHref } from "@/lib/routes"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

const TITLES: Record<string, string> = { "/sql": "SQL", "/server": "Servidor" }

function crumbs(pathname: string) {
  const items = [{ label: "Servidor", href: "/" }]
  const [, section, db, table] = pathname.split("/").map(decodeURIComponent)
  if (section === "db" && db) {
    items.push({ label: db, href: databaseHref(db) })
    if (table) items.push({ label: table, href: tableHref(db, table) })
  } else if (TITLES[pathname]) {
    items.push({ label: TITLES[pathname], href: pathname })
  }
  return items
}

export function AppHeader() {
  const items = crumbs(usePathname())
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />
      <Breadcrumb>
        <BreadcrumbList>
          {items.map((item, i) => (
            <Fragment key={item.href}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {i === items.length - 1 ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={item.href} />}>{item.label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  )
}
