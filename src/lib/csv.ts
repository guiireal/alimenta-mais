type Cell = string | number | null | undefined

const escapeCell = (cell: Cell): string => {
  const text = cell == null ? '' : String(cell)
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** CSV com ponto e vírgula, que o Excel em português abre sem configuração. */
export const toCsv = (rows: Cell[][]): string => rows.map((r) => r.map(escapeCell).join(';')).join('\r\n')

export function downloadCsv(filename: string, rows: Cell[][]): void {
  const blob = new Blob(['\uFEFF' + toCsv(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = window.document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
