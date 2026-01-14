import '@testing-library/jest-dom'

// Mock matchMedia for components that use media queries
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

// Mock ResizeObserver
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Use globalThis for cross-environment compatibility
globalThis.ResizeObserver = ResizeObserverMock

// Mock crypto for Web Crypto API tests (only if not already available)
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      subtle: {
        generateKey: async () => ({ type: 'secret' }),
        encrypt: async () => new ArrayBuffer(0),
        decrypt: async () => new ArrayBuffer(0),
        exportKey: async () => new ArrayBuffer(0),
        importKey: async () => ({ type: 'secret' }),
        deriveBits: async () => new ArrayBuffer(0),
        deriveKey: async () => ({ type: 'secret' }),
      },
      getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
        if (array) {
          const bytes = new Uint8Array(
            array.buffer,
            array.byteOffset,
            array.byteLength
          )
          for (let i = 0; i < bytes.length; i++) {
            bytes[i] = Math.floor(Math.random() * 256)
          }
        }
        return array
      },
    },
  })
}
