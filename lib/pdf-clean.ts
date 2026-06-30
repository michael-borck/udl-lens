// @react-pdf <Text> has no Markdown support, so model output like **bold**,
// `code`, [links](url), "- " bullets, or "1. " numbering would render as LITERAL
// characters in the report. The PDF also prepends its own "{n}." before each
// suggestion, so a model "1. foo" would render as "1. 1. foo". Strip the common
// artifacts and normalise whitespace.
//
// Pure (string in -> string out) so it can be unit-tested directly; see
// pdf-clean.test.ts. PdfReport imports this as `clean`.
export function cleanMarkdown(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // [text](url) links -> text
    .replace(/\*\*(.*?)\*\*/g, '$1') // **bold**
    .replace(/\*(.*?)\*/g, '$1') // *italic*
    .replace(/_(.*?)_/g, '$1') // _italic_
    .replace(/`([^`]*)`/g, '$1') // `code`
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '') // # headers
    .replace(/^[ \t]*>[ \t]?/gm, '') // > blockquotes
    .replace(/^[ \t]*[-*+][ \t]+/gm, '') // - * + bullets
    .replace(/^[ \t]*\d+[.)][ \t]+/gm, '') // 1. / 1) numbering (the PDF adds its own)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
