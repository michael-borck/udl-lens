// @react-pdf/renderer ships no type declarations (no `types` field, no bundled
// .d.ts, and no @types/react-pdf__renderer package on npm). These ambient
// declarations cover exactly the API surface this project uses in
// components/PdfReport.tsx, typed accurately rather than as a blanket `any`.
declare module '@react-pdf/renderer' {
  import type { ReactElement, ReactNode } from 'react'

  /** A subset of the CSS-like style properties react-pdf accepts. Kept open
   *  (string | number) because react-pdf permits values like `'6 8'` and `'50%'`
   *  alongside numeric pixel values. */
  export interface Style {
    [property: string]: string | number | Style[keyof Style] | undefined
  }

  export type NamedStyles<T> = { [P in keyof T]: Style }

  export const StyleSheet: {
    create<T extends NamedStyles<T>>(styles: T): T
    absoluteFill: Style
  }

  export interface DocumentProps {
    title?: string
    author?: string
    subject?: string
    children?: ReactNode
  }
  export function Document(props: DocumentProps): ReactElement

  export interface PageProps {
    size?: string | { width: number; height?: number }
    orientation?: 'portrait' | 'landscape'
    style?: Style | Style[]
    wrap?: boolean
    children?: ReactNode
  }
  export function Page(props: PageProps): ReactElement

  export interface ViewProps {
    style?: Style | Style[]
    wrap?: boolean
    fixed?: boolean
    children?: ReactNode
  }
  export function View(props: ViewProps): ReactElement

  export interface TextProps {
    style?: Style | Style[]
    fixed?: boolean
    children?: ReactNode
  }
  export function Text(props: TextProps): ReactElement

  export interface ImageProps {
    src: string
    style?: Style | Style[]
  }
  export function Image(props: ImageProps): ReactElement

  export interface PDFDownloadLinkRenderProps {
    loading: boolean
    error: Error | null
    blob: Blob | null
    url: string | null
  }
  export interface PDFDownloadLinkProps {
    document: ReactElement
    fileName?: string
    style?: Style | Style[]
    className?: string
    children?: ReactNode | ((props: PDFDownloadLinkRenderProps) => ReactNode)
  }
  export function PDFDownloadLink(props: PDFDownloadLinkProps): ReactElement

  export const Font: {
    register(options: { family: string; src: string; fontWeight?: string | number }): void
  }
}
