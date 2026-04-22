import { z } from 'zod'
import rawConfig from '../terminal-ai.config.json'

const ConfigSchema = z.object({
  app_name: z.string().min(1),
  framework: z.string().min(1),
  health_check_path: z.string().min(1),
  category: z.string().min(1),
  tier: z.string().min(1),
  credit_cost_per_use: z.number(),
  min_credits: z.number(),
})

const EnvSchema = z.object({
  TERMINAL_AI_GATEWAY_URL: z.string().url(),
})

export function validateConfig(): {
  config: z.infer<typeof ConfigSchema>
  env: z.infer<typeof EnvSchema>
} {
  const config = ConfigSchema.parse(rawConfig)
  const env = EnvSchema.parse(process.env)
  return { config, env }
}

export default rawConfig
