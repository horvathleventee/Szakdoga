import './globals.css'
import { WagmiWrapper } from '../providers/WagmiWrapper'
import Shell from '../components/Shell'

export const metadata = { title: 'CAC Demo' }

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <WagmiWrapper>
          {Shell ? <Shell>{children}</Shell> : children}
        </WagmiWrapper>
      </body>
    </html>
  )
}
