declare module 'probe-image-size' {
  interface ProbeResult {
    width: number
    height: number
    type?: string
    mime?: string
    length?: number
    [key: string]: unknown
  }
  declare function probe(streamOrUrl: string | Buffer | NodeJS.ReadableStream): Promise<ProbeResult>

  declare namespace probe {
    function sync(bufferOrStream: Buffer | NodeJS.ReadableStream): ProbeResult
  }

  export default probe
}
