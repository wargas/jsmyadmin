/**
 * Splits a SQL script into individual statements, honouring quotes, comments
 * and `DELIMITER` directives (as found in mysqldump files).
 */
export function splitSql(text: string): string[] {
  const statements: string[] = []
  let delimiter = ";"
  let current = ""
  let i = 0

  const push = () => {
    const statement = current.trim()
    if (statement) statements.push(statement)
    current = ""
  }

  while (i < text.length) {
    const ch = text[i]
    const atLineStart = current.trim() === ""

    if (atLineStart && /^delimiter\s/i.test(text.slice(i, i + 10))) {
      const end = text.indexOf("\n", i)
      const line = text.slice(i, end === -1 ? text.length : end)
      delimiter = line.trim().split(/\s+/)[1] || ";"
      current = ""
      i = end === -1 ? text.length : end + 1
      continue
    }

    if (ch === "'" || ch === '"' || ch === "`") {
      let j = i + 1
      while (j < text.length) {
        if (text[j] === "\\" && ch !== "`") {
          j += 2
          continue
        }
        if (text[j] === ch) {
          if (text[j + 1] === ch) {
            j += 2
            continue
          }
          break
        }
        j++
      }
      current += text.slice(i, j + 1)
      i = j + 1
      continue
    }

    if ((ch === "-" && text[i + 1] === "-" && /\s/.test(text[i + 2] ?? " ")) || ch === "#") {
      const end = text.indexOf("\n", i)
      i = end === -1 ? text.length : end + 1
      current += "\n"
      continue
    }

    if (ch === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2)
      const stop = end === -1 ? text.length : end + 2
      // Keep MySQL executable comments (/*! ... */), drop regular ones.
      if (text[i + 2] === "!") current += text.slice(i, stop)
      else current += " "
      i = stop
      continue
    }

    if (text.startsWith(delimiter, i)) {
      push()
      i += delimiter.length
      continue
    }

    current += ch
    i++
  }

  push()
  return statements
}
