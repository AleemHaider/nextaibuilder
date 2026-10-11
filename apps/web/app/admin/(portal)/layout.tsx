'use client'

import { AdminLayout } from '@/components/layout/AdminLayout'

export default function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>
}
