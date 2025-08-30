import Sidebar from '@/components/Sidebar'
import ProtectedRoute from '@/components/ProtectedRoute'

export default function UsersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="pt-16 lg:pt-6 p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}