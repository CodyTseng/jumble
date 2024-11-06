export function tagNameEquals(tagName: string) {
  return (tag: string[]) => tag[0] === tagName
}

export function replyETag([tagName, , , alt]: string[]) {
  return tagName === 'e' && alt === 'reply'
}

export function rootETag([tagName, , , alt]: string[]) {
  return tagName === 'e' && alt === 'root'
}
