export class Resend {
  emails = {
    send: async (content: unknown) => ({ data: { id: 'test-email', content }, error: null })
  }
}
