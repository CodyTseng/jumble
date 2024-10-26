export type TEmbeddedRenderer = {
  regex: RegExp
  render: (match: string, index: number) => JSX.Element
}
