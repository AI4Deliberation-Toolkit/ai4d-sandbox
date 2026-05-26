import { useEffect, useState } from 'react'

function LoadingIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    'Filtering relevant comments',
    'Extracting positions & arguments',
    'Clustering positions',
    'Generating summary',
  ]

  return (
    <div style={{ padding: '1.5rem', border: '1px solid #eee', borderRadius: '8px', marginTop: '16px' }}>
      <p style={{ fontWeight: 500 }}>Processing your request...</p>
      <p style={{ color: '#888', fontSize: '13px' }}>This might take a few minutes</p>
      {steps.map((label, i) => (
        <div key={i} style={{ opacity: i > currentStep ? 0.3 : 1, display: 'flex', gap: '8px', marginTop: '8px', fontSize: '14px' }}>
          <span>{i < currentStep ? '✅' : i === currentStep ? '⏳' : '○'}</span>
          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}

export default LoadingIndicator