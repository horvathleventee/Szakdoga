'use client'
import QRCode from 'react-qr-code'

export default function QrBadge({ value, size = 128, caption }) {
  if (!value) return null
  return (
    <div style={{display:'inline-flex', flexDirection:'column', alignItems:'center', gap:8}}>
      <div style={{ background: 'white', padding: 8, borderRadius: 8 }}>
        <QRCode
          value={value}
          size={size}
          style={{ width: size, height: size }}
        />
      </div>
      {caption && <div className="subtle" style={{fontSize:12, textAlign:'center'}}>{caption}</div>}
    </div>
  )
}
