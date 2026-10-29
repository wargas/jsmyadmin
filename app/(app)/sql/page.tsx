import { PageTitle } from "@/components/page-title"
import { SqlConsole } from "@/components/sql-console"

export default function SqlPage() {
  return (
    <>
      <PageTitle title="Console SQL" description="Execute consultas em qualquer banco do servidor" />
      <SqlConsole />
    </>
  )
}
