"use client"

import { toast } from "sonner"
import { exec, refreshAll } from "./api"

/** Executes generated SQL, reports the outcome as a toast and refreshes cached queries. */
export async function execWithToast(sql: string, options: { database?: string; success?: string; description?: string } = {}) {
  try {
    const result = await exec(sql, { database: options.database })
    toast.success(options.success ?? "Comando executado", {
      description: options.description ?? (sql.length > 200 ? sql.slice(0, 200) + "…" : sql),
    })
    await refreshAll()
    return result
  } catch (error) {
    toast.error("Falha ao executar", { description: (error as Error).message })
    return null
  }
}
