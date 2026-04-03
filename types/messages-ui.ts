/** UI models for the shared messages layout (coach + client). */

export interface MessagesUIConversation {
  id: string
  participantName: string
  participantAvatar?: string
  participantRole: 'coach' | 'student'
  lastMessage: string
  lastMessageTime: string
  unreadCount: number
  isOnline?: boolean
}

export interface MessagesUIChatMessage {
  id: string
  senderId: string
  text: string
  timestamp: string
  /** ISO time for grouping / spacing (optional; falls back to parsing timestamp) */
  sentAt?: string
  status?: 'sent' | 'delivered' | 'read'
}
