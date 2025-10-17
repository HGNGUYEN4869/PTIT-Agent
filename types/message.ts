export interface Message {
  idMessage: string
  role: 'user' | 'assistant'
  content: string
}
