export function audibleTime(
  now: number, event: number, contextTime: number, latency: number, output?: AudioTimestamp,
) {
  if (output?.performanceTime && Number.isFinite(output.contextTime)) {
    return (output.contextTime ?? 0) + (event - output.performanceTime) / 1000
  }
  return contextTime + (event - now) / 1000 - Math.max(0, latency)
}
