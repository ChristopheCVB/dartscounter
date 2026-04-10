# Page Layout

Build public-facing pages — landing, blog, changelog, pricing — using the Header + Main + Footer shell with Page components.

## App shell

```vue [app.vue]
<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const items = computed<NavigationMenuItem[]>(() => [{
  label: 'Features',
  to: '#features'
}, {
  label: 'Pricing',
  to: '/pricing'
}, {
  label: 'Blog',
  to: '/blog'
}])
</script>

<template>
  <UApp>
    <UHeader>
      <template #title>
        <Logo class="h-6 w-auto" />
      </template>

      <UNavigationMenu :items="items" />

      <template #right>
        <UColorModeButton />
        <UButton label="Sign in" color="neutral" variant="ghost" />
        <UButton label="Get started" />
      </template>

      <template #body>
        <UNavigationMenu :items="items" orientation="vertical" class="-mx-2.5" />
      </template>
    </UHeader>

    <UMain>
      <NuxtPage />
    </UMain>

    <UFooter>
      <template #left>
        <p class="text-muted text-sm">Copyright © {{ new Date().getFullYear() }}</p>
      </template>
      <template #right>
        <UButton icon="i-simple-icons-github" color="neutral" variant="ghost" to="https://github.com" target="_blank" />
      </template>
    </UFooter>
  </UApp>
</template>
```

## Landing page

```vue [pages/index.vue]
<template>
  <UPageHero
    title="Build faster with Nuxt UI"
    description="A comprehensive Vue UI component library."
    :links="[
      { label: 'Get started', to: '/docs', icon: 'lucide:square-play' },
      { label: 'Learn more', color: 'neutral', variant: 'subtle', trailingIcon: 'lucide:arrow-right' }
    ]"
    orientation="horizontal"
  >
    <img src="/hero-image.png" alt="App screenshot" class="rounded-lg shadow-2xl ring ring-default" />
  </UPageHero>

  <UPageSection
    id="features"
    headline="Features"
    title="Everything you need"
    description="A comprehensive suite of components and utilities."
    :features="[
      { title: 'Accessible', description: 'Built on Reka UI with full ARIA support.', icon: 'lucide:accessibility' },
      { title: 'Customizable', description: 'Tailwind Variants theming with full control.', icon: 'lucide:palette' },
      { title: 'Responsive', description: 'Mobile-first components.', icon: 'lucide:monitor-smartphone' }
    ]"
  />

  <UPageCTA
    title="Trusted by thousands of developers"
    description="Join the community and start building today."
    :links="[
      { label: 'Get started', color: 'neutral' },
      { label: 'Star on GitHub', color: 'neutral', variant: 'subtle', trailingIcon: 'lucide:arrow-right' }
    ]"
  />

  <UPageSection id="pricing" headline="Pricing" title="Simple, transparent pricing">
    <UPricingPlans
      :plans="[
        { title: 'Free', price: '$0', description: 'For personal projects', features: ['10 components', 'Community support'] },
        { title: 'Pro', price: '$99', description: 'For teams', features: ['All components', 'Priority support'], highlight: true },
        { title: 'Enterprise', price: 'Custom', description: 'For large teams', features: ['Custom components', 'Dedicated support'] }
      ]"
    />
  </UPageSection>
</template>
```

## Blog listing

```vue [pages/blog/index.vue]
<script setup lang="ts">
const { data: posts } = await useAsyncData('posts', () => queryCollection('posts').all())
</script>

<template>
  <UPage>
    <UPageHero title="Blog" description="The latest news and updates from our team." />

    <UPageBody>
      <UContainer>
        <UBlogPosts>
          <UBlogPost
            v-for="(post, index) in posts"
            :key="index"
            v-bind="post"
            :to="post.path"
          />
        </UBlogPosts>
      </UContainer>
    </UPageBody>
  </UPage>
</template>
```

## Blog article

```vue [pages/blog/[slug].vue]
<script setup lang="ts">
const route = useRoute()

const { data: post } = await useAsyncData(route.path, () => {
  return queryCollection('posts').path(route.path).first()
})
</script>

<template>
  <UPage>
    <UPageHeader :title="post.title" :description="post.description" />

    <UPageBody>
      <ContentRenderer :value="post" />
    </UPageBody>

    <template #right>
      <UContentToc :links="post.body.toc.links" />
    </template>
  </UPage>
</template>
```

## Changelog

```vue [pages/changelog.vue]
<script setup lang="ts">
const { data: versions } = await useAsyncData('versions', () => queryCollection('changelog').all())
</script>

<template>
  <UPage>
    <UPageHero title="Changelog" />

    <UPageBody>
      <UContainer>
        <UChangelogVersions>
          <UChangelogVersion v-for="(version, index) in versions" :key="index" v-bind="version" />
        </UChangelogVersions>
      </UContainer>
    </UPageBody>
  </UPage>
</template>
```

## Key components

### Page sections

- `UPageHero` — Hero with title, description, links, and optional media (`orientation`: horizontal/vertical)
- `UPageSection` — Content section with headline, title, description, and `features` grid
- `UPageCTA` — Call to action block
- `UPageHeader` — Page title and description
- `UPageBody` — Main content area with prose styling

### Grids & cards

- `UPageGrid` / `UPageColumns` — Grid layouts
- `UPageCard` — Content card for grids
- `UPageFeature` — Individual feature item
- `UPageLogos` — Logo wall

### Blog & changelog

- `UBlogPosts` — Responsive grid of posts (`orientation`: horizontal/vertical)
- `UBlogPost` — Individual post card
- `UChangelogVersions` / `UChangelogVersion` — Changelog entries

### Pricing

- `UPricingPlans` — Pricing plan cards
- `UPricingTable` — Feature comparison table

### Footer

- `UFooterColumns` — Multi-column footer with link groups

## Variations

### Alternating sections

```vue
<UPageSection title="Feature A" orientation="horizontal">
  <img src="/feature-a.png" />
</UPageSection>

<UPageSection title="Feature B" orientation="horizontal" reverse>
  <img src="/feature-b.png" />
</UPageSection>
```

### Feature grid

```vue
<UPageSection headline="Features" title="Why choose us">
  <UPageGrid>
    <UPageCard v-for="feature in features" :key="feature.title" v-bind="feature" />
  </UPageGrid>
</UPageSection>
```

### Blog with sidebar

```vue [layouts/blog.vue]
<template>
  <UPage>
    <template #left>
      <UPageAside>
        <UNavigationMenu
          :items="[
            { label: 'All posts', to: '/blog', icon: 'lucide:newspaper' },
            { label: 'Tutorials', to: '/blog/tutorials', icon: 'lucide:graduation-cap' },
            { label: 'Announcements', to: '/blog/announcements', icon: 'lucide:megaphone' }
          ]"
          orientation="vertical"
        />
      </UPageAside>
    </template>

    <slot />
  </UPage>
</template>
```
