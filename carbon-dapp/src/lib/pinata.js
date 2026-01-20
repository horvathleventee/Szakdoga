export async function pinJsonToIPFS(json, opts = {}) {
  const r = await fetch('/api/pin/json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: json,
      name: opts.name || '',
      keyvalues: opts.keyvalues || {},
    }),
  })
  if (!r.ok) throw new Error(await r.text())
  const { uri } = await r.json()
  return uri // ipfs://CID
}

export async function pinFileToIPFS(file, opts = {}) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('name', opts.name || '')
  fd.append('keyvalues', JSON.stringify(opts.keyvalues || {}))

  const r = await fetch('/api/pin/file', { method: 'POST', body: fd })
  if (!r.ok) throw new Error(await r.text())
  const { uri } = await r.json()
  return uri
}
