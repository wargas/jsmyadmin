import { cn } from "@/lib/utils"

export function SqlPreview({ sql, className }: { sql: string; className?: string }) {
  return (
    <pre
      className={cn(
        "max-h-60 overflow-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs whitespace-pre-wrap break-all",
        className
      )}
    >
      {sql}
    </pre>
  )
}
