interface Props {
  onConfirm: () => void
  onCancel: () => void
}

export function ResetModal({ onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-teal/30 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl border border-sand shadow-xl p-8 max-w-sm w-full mx-4">
        <h2 className="font-display text-xl text-teal mb-2">Start over?</h2>
        <p className="text-sm text-teal/60 mb-6">
          This will clear all assessments and checkpoint responses from this browser session. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-terracotta text-white py-2 text-sm font-medium hover:bg-terracotta-dark transition-colors"
          >
            Yes, start over
          </button>
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-sand text-teal py-2 text-sm hover:bg-sand transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
