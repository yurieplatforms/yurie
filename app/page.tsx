import ChatClient from './api/chat/ChatClient'

export default function Page() {
  return (
    <section className="flex-1 overflow-hidden w-full">
      <ChatClient />
    </section>
  )
}
