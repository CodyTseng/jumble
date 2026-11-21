import type { ComponentProps } from 'react'
import type { ExtraProps } from 'react-markdown'

export default function MarkdownTable({
  node: _node,
  wrapperClassName = '',
  ...props
}: ComponentProps<'table'> & ExtraProps & { wrapperClassName?: string }) {
  return (
    <div className={`markdown-table-scroll ${wrapperClassName}`}>
      <table {...props} />
    </div>
  )
}
