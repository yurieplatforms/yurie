import { AuthForm } from './auth-form'
import { Metadata } from 'next'
import { Footer } from '@/components/layout/footer'

export const metadata: Metadata = {
  title: 'Authentication',
}

export default async function LoginPage(props: {
  searchParams: Promise<{ message?: string; error?: string }>
}) {
  const searchParams = await props.searchParams
  return (
    <div className="flex min-h-[calc(80vh-4rem)] flex-col items-center justify-center px-4">
      <AuthForm 
        message={searchParams?.message} 
        error={searchParams?.error} 
      />

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 w-full">
        <div className="pointer-events-auto mx-auto w-full max-w-screen-sm px-4">
           <div className="bg-background">
             <Footer className="mt-0" />
           </div>
        </div>
      </div>
    </div>
  )
}
