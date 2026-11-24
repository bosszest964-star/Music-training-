const startupLimitMs = 3000

export async function resumeAudio(context: AudioContext) {
  if (context.state !== 'running') {
    let timeout = 0
    try {
      // Call resume during the button gesture. An interrupted context can leave it pending.
      const resume = context.resume()
      const deadline = new Promise<never>((_, reject) => {
        timeout = window.setTimeout(() => reject(new Error('Audio startup timed out')), startupLimitMs)
      })
      await Promise.race([resume, deadline])
    } finally {
      window.clearTimeout(timeout)
    }
  }
  if (context.state !== 'running') throw new Error('Audio context did not start')
}
