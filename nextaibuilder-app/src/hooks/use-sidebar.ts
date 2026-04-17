import { createContext, useContext } from 'react'

export type SidebarState = 'expanded' | 'collapsed'

interface SidebarContextValue {
  state: SidebarState
  toggle: () => void
  open: () => void
  close: () => void
}

export const SidebarContext = createContext<SidebarContextValue | null>(null)

export function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebar must be used within SidebarProvider')
  return ctx
}
