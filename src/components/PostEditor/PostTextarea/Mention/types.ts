export type TMentionTarget =
  | { type: 'profile'; id: string }
  | { type: 'list'; id: string; title: string; count: number }

