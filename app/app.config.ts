export default defineAppConfig({
  ui: {
    colors: {
      primary: 'orange',
      neutral: 'slate'
    },
    button: {
      defaultVariants: {
        size: 'md'
      }
    },
    card: {
      slots: {
        root: 'surface-card rounded-2xl'
      }
    }
  }
})
