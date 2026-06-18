import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CategoryChart } from '@/components/dashboard/category-chart'
import { makeAnalysis } from '../utils/factories'

describe('CategoryChart', () => {
  it('renders without crashing when a category is unknown', () => {
    const analysis = makeAnalysis({ category_breakdown: { ['mystery' as never]: 500 } })
    expect(() => render(<CategoryChart analyses={[analysis]} isLoading={false} />)).not.toThrow()
  })
})
