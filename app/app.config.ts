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
    checkbox: { slots: { root: 'min-h-11 items-center' } },
    dropdownMenu: { slots: { item: 'min-h-11' } },
    card: {
      slots: {
        root: 'surface-card rounded-2xl'
      }
    }
  }
})
