import '@testing-library/jest-dom'

// Mock ResizeObserver for Recharts (ResponsiveContainer uses it)
global.ResizeObserver = class ResizeObserver {
  observe() {
    return undefined
  }

  unobserve() {
    return undefined
  }

  disconnect() {
    return undefined
  }
}
