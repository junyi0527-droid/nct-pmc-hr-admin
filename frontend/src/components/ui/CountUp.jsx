import { useEffect, useState } from 'react'

export default function CountUp({ value }) {
  const [display, setDisplay] = useState(value)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value)
      return
    }
    let frame
    const start = performance.now()
    function tick(now) {
      const progress = Math.min(1, (now - start) / 650)
      setDisplay(Math.round(value * (1 - (1 - progress) ** 3)))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return (
    <span aria-label={String(value)}>
      <span aria-hidden="true">{display}</span>
    </span>
  )
}
