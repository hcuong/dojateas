type Props = {
  label: string
  value: string
  mediaUrl?: string | null
}

export function BatchDetailCard({ label, value, mediaUrl }: Props) {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="font-medium text-gray-800">{value}</p>
      {mediaUrl && (
        <img src={mediaUrl} alt={label} className="mt-2 rounded w-full max-h-48 object-cover" />
      )}
    </div>
  )
}
