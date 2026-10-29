import { Suspense } from "react"
import { AppHeader } from "@/components/app-header"
import { AppSidebar } from "@/components/app-sidebar"
import { ConfirmProvider } from "@/components/confirm-dialog"
import { Sidebar, SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <ConfirmProvider>
      <SidebarProvider>
        {/* Sidebar and header read the pathname, which is only known at request time. */}
        <Suspense fallback={<Sidebar collapsible="icon" />}>
          <AppSidebar />
        </Suspense>
        <SidebarInset className="min-w-0">
          <Suspense fallback={<header className="h-12 shrink-0 border-b" />}>
            <AppHeader />
          </Suspense>
          <div className="flex min-w-0 flex-1 flex-col gap-4 p-4">
            <Suspense fallback={<Skeleton className="h-[480px] w-full" />}>{children}</Suspense>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ConfirmProvider>
  )
}
