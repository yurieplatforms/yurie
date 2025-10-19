import ChatClient from './api/playground/ChatClient'

export default function Page() {
  return (
    <section className="relative left-1/2 right-1/2 -mx-[50vw] w-screen flex-1 overflow-hidden">
      <ChatClient />
    </section>
  )
}
