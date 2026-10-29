"use client"

import { useMemo } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { MySQL, sql, type SQLNamespace } from "@codemirror/lang-sql"
import { useTheme } from "next-themes"

type SqlEditorProps = {
  value: string
  onChange: (value: string) => void
  onRun?: () => void
  schema?: SQLNamespace
  defaultSchema?: string
  height?: string
  autoFocus?: boolean
}

export function SqlEditor({ value, onChange, onRun, schema, defaultSchema, height = "220px", autoFocus }: SqlEditorProps) {
  const { resolvedTheme } = useTheme()
  const extensions = useMemo(
    () => [sql({ dialect: MySQL, schema, defaultSchema, upperCaseKeywords: true })],
    [schema, defaultSchema]
  )

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      height={height}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      extensions={extensions}
      autoFocus={autoFocus}
      // Captured before CodeMirror's own keymap so Mod-Enter runs instead of inserting a line.
      onKeyDownCapture={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          event.preventDefault()
          event.stopPropagation()
          onRun?.()
        }
      }}
      basicSetup={{ foldGutter: false, highlightActiveLineGutter: true }}
      className="overflow-hidden rounded-lg border text-sm [&_.cm-editor]:outline-none"
    />
  )
}
