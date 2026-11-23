import { getNipCdExecutor } from '@/lib/nip-cd'
import { Node } from '@tiptap/core'

const invocationAttribute = 'data-nip-cd-invocation'
const executorNameAttribute = 'data-nip-cd-executor-name'

export const NipCdInvocation = Node.create({
  name: 'nipCdInvocation',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      invocation: {
        default: '',
        rendered: false,
        parseHTML: (element) => element.getAttribute(invocationAttribute)
      },
      executorName: {
        default: null,
        rendered: false,
        parseHTML: (element) => element.getAttribute(executorNameAttribute)
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: `span[${invocationAttribute}]`,
        getAttrs: (element) => {
          const invocation = element.getAttribute(invocationAttribute) ?? ''
          return !/\s/u.test(invocation) && getNipCdExecutor(invocation) ? null : false
        }
      }
    ]
  },

  renderHTML({ node }) {
    const { invocation, executorName } = node.attrs
    return [
      'span',
      { [invocationAttribute]: invocation, [executorNameAttribute]: executorName },
      invocation
    ]
  },

  renderText({ node }) {
    return node.attrs.invocation
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span')
      dom.className = 'nip-cd-invocation'
      dom.contentEditable = 'false'
      dom.dir = 'auto'
      dom.textContent = node.attrs.invocation.split('@', 1)[0]
      if (node.attrs.executorName) {
        const executor = document.createElement('bdi')
        executor.className = 'nip-cd-invocation-executor'
        executor.textContent = `@${node.attrs.executorName}`
        dom.append('\u2009', executor)
      }
      return { dom }
    }
  }
})
