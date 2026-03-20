import { useState } from 'react'

interface UseCounterOptions {
  initial?: number
}

export function useCounter({ initial = 0 }: UseCounterOptions = {}) {
  const [count, setCount] = useState(initial)

  return {
    count,
    increment: () => setCount((c) => c + 1),
    decrement: () => setCount((c) => c - 1),
    reset: () => setCount(initial),
  }
}
