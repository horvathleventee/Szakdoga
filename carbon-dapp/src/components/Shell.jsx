'use client'
import Sidebar from './Sidebar'

export default function Shell({ children }){
  return (
    <div className="app">
      <Sidebar />
      <main className="main">{children}</main>
    </div>
  )
}
