'use client'

import { AuthGuard } from '@/components/AuthGuard'
import { WalletView } from '@/components/WalletView'

export default function WalletPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-bg-base">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <WalletView />
        </div>
      </main>
    </AuthGuard>
  )
}
