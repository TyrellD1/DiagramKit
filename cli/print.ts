export const EXIT = {
  ok: 0,
  error: 1,
  notFound: 2,
  notRunning: 3,
} as const

export type ExitCode = (typeof EXIT)[keyof typeof EXIT]

export function die(message: string, code: ExitCode = EXIT.error): never {
  console.error(`error: ${message}`)
  process.exit(code)
}

export function hint(message: string) {
  console.error(`hint: ${message}`)
}

export function formatIssues(issues: Array<{ file: string; path: string; message: string }>) {
  const lines: string[] = []
  for (const issue of issues) {
    lines.push(`  ${issue.file}  ${issue.path}`)
    lines.push(`    ${issue.message}`)
    lines.push('')
  }
  return lines.join('\n').trimEnd()
}
