import { useEffect, useState } from 'react'

export default function AnimatedNumber({ value, duration = 950 }) {
  const [shown, setShown] = useState(value)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); return }
    let frame
    const start = performance.now()
    const tick = (time) => {
      const progress = Math.min((time - start) / duration, 1)
      setShown(Math.round(value * (1 - (1 - progress) ** 3)))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])
  return <>{shown}</>
}
