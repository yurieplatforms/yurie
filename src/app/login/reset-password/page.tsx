import { ResetPasswordForm } from './reset-password-form'
import { Metadata } from 'next'
import { Footer } from '@/components/layout/footer'

export const metadata: Metadata = {
  title: 'Reset Password',
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col items-center justify-center px-4 pb-24">
      <ResetPasswordForm />

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

