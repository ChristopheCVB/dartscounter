<template>
  <section class="grid gap-4">
    <UPageHeader
      title="Settings"
      description="Tune defaults and manage your local player roster."
      headline="Control Room"
      class="arcade-reveal"
    />

    <UCard class="grid gap-5 arcade-glow arcade-reveal" :style="{ '--reveal-delay': '90ms' }">
      <h2 class="m-0 arcade-title text-sm">Match defaults</h2>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(12rem,14rem)_minmax(12rem,14rem)_auto] xl:items-end">
        <UFormField label="Default start score">
          <USelect v-model="local.startScore" :items="startScoreItems" />
        </UFormField>

        <UFormField label="Default legs to win">
          <UInputNumber v-model="local.legsTarget" :min="1" :max="11" />
        </UFormField>

        <div class="flex flex-col gap-3 rounded-xl border border-default p-3 md:col-span-2 md:flex-row md:gap-6 xl:col-span-1">
          <UCheckbox v-model="local.doubleIn" label="Default double in" />
          <UCheckbox v-model="local.doubleOut" label="Default double out" />
        </div>
      </div>

      <UButton class="w-full sm:w-auto" @click="save">Save defaults</UButton>
    </UCard>

    <UCard class="grid gap-4 arcade-reveal" :style="{ '--reveal-delay': '150ms' }">
      <div class="flex items-center justify-between gap-3">
        <h2 class="m-0 arcade-title text-sm">Recent players</h2>
        <UButton
          v-if="playersStore.recentPlayers.length"
          color="error"
          variant="soft"
          size="sm"
          @click="clearRecentPlayers"
        >
          Clear all
        </UButton>
      </div>

      <p v-if="!playersStore.recentPlayers.length" class="m-0 text-sm text-muted">
        No recent players yet. Names are saved after starting matches.
      </p>

      <div class="flex gap-2">
        <UInput
          v-model="newRecentName"
          class="flex-1"
          placeholder="Add player name"
          maxlength="24"
          @keydown.enter.prevent="addRecentPlayer"
        />
        <UButton color="neutral" variant="soft" @click="addRecentPlayer">
          Add
        </UButton>
      </div>
      <p class="m-0 text-xs text-muted">Renaming is a strict replacement and will not merge stats from other players with similar names.</p>

      <UTable
        v-if="playersStore.recentPlayers.length"
        :data="recentPlayerRows"
        :columns="recentPlayerColumns"
        class="rounded-lg border border-default"
      >
        <template #name-cell="{ row }">
          <UInput
            v-if="editingPlayerId === row.original.id"
            v-model="editingName"
            class="min-w-[180px]"
            maxlength="24"
            @keydown.enter.prevent="saveEdit"
            @keydown.esc.prevent="cancelEdit"
          />
          <span v-else>{{ row.original.name }}</span>
        </template>

        <template #actions-cell="{ row }">
          <div class="flex flex-wrap gap-1">
            <UButton
              v-if="editingPlayerId === row.original.id"
              color="primary"
              variant="soft"
              size="xs"
              @click="saveEdit"
            >
              Save
            </UButton>
            <UButton
              v-if="editingPlayerId === row.original.id"
              color="neutral"
              variant="soft"
              size="xs"
              @click="cancelEdit"
            >
              Cancel
            </UButton>
            <UButton
              v-else
              color="neutral"
              variant="soft"
              size="xs"
              @click="startEdit(row.original.id, row.original.name)"
            >
              Edit
            </UButton>
            <UButton
              color="error"
              variant="soft"
              size="xs"
              @click="removeRecentPlayer(row.original.id, row.original.name)"
            >
              Delete
            </UButton>
          </div>
        </template>
      </UTable>
    </UCard>
  </section>
</template>

<script setup lang="ts">
import { useHistoryStore } from '~/stores/history'
import { usePlayersStore } from '~/stores/players'
import { useSettingsStore } from '~/stores/settings'

type RecentPlayerRow = {
  id: string
  name: string
  matches: number
  wins: number
  average: string
  lastPlayed: string
  actions: string
}

const playersStore = usePlayersStore()
const historyStore = useHistoryStore()
const settingsStore = useSettingsStore()
const toast = useToast()
const startScoreItems = [301, 501]
const newRecentName = ref('')
const editingPlayerId = ref('')
const editingName = ref('')

const recentPlayerColumns = [
  { accessorKey: 'name', header: 'Player' },
  { accessorKey: 'matches', header: 'Matches' },
  { accessorKey: 'wins', header: 'Wins' },
  { accessorKey: 'average', header: '3-Dart Avg' },
  { accessorKey: 'lastPlayed', header: 'Last Played' },
  { accessorKey: 'actions', header: 'Actions' }
]

const recentPlayerRows = computed<RecentPlayerRow[]>(() => {
  return playersStore.recentPlayers.map((player) => {
    const name = player.name
    const key = name.trim().toLowerCase()
    const id = player.id
    const playerEntries = historyStore.entries.filter((entry) => {
      return entry.players.some((summaryPlayer) => {
        if (summaryPlayer.recentPlayerId) {
          return summaryPlayer.recentPlayerId === id
        }
        return summaryPlayer.name.trim().toLowerCase() === key
      })
    })

    const matches = playerEntries.length
    const wins = historyStore.entries.filter((entry) => {
      const winner = entry.players.find(summaryPlayer => summaryPlayer.playerId === entry.winnerId)
      if (!winner) {
        return entry.winnerName.trim().toLowerCase() === key
      }
      if (winner.recentPlayerId) {
        return winner.recentPlayerId === id
      }
      return winner.name.trim().toLowerCase() === key
    }).length

    const average = matches > 0
      ? (playerEntries.reduce((total, entry) => {
        const summaryPlayer = entry.players.find((p) => {
          if (p.recentPlayerId) {
            return p.recentPlayerId === id
          }
          return p.name.trim().toLowerCase() === key
        })
        return total + (summaryPlayer?.average || 0)
      }, 0) / matches).toFixed(2)
      : '-'

    const latest = playerEntries.reduce((max, entry) => Math.max(max, entry.finishedAt), 0)

    return {
      id: player.id,
      name,
      matches,
      wins,
      average,
      lastPlayed: latest ? new Date(latest).toLocaleDateString() : '-',
      actions: ''
    }
  })
})

const local = reactive({
  startScore: settingsStore.settings.startScore,
  doubleIn: settingsStore.settings.doubleIn,
  doubleOut: settingsStore.settings.doubleOut,
  legsTarget: settingsStore.settings.legsTarget
})

function save() {
  settingsStore.update({
    startScore: local.startScore,
    doubleIn: local.doubleIn,
    doubleOut: local.doubleOut,
    legsTarget: local.legsTarget
  })
  toast.add({
    title: 'Settings saved',
    description: 'Default match settings updated.',
    color: 'success'
  })
}

function addRecentPlayer() {
  const next = newRecentName.value.trim()
  if (!next) {
    return
  }

  playersStore.addRecentPlayer(next)
  newRecentName.value = ''
  toast.add({
    title: 'Player added',
    description: `${next} is now available in recent players.`,
    color: 'success'
  })
}

function startEdit(playerId: string, name: string) {
  editingPlayerId.value = playerId
  editingName.value = name
}

function cancelEdit() {
  editingPlayerId.value = ''
  editingName.value = ''
}

function saveEdit() {
  const playerId = editingPlayerId.value
  const original = playersStore.recentPlayers.find(player => player.id === playerId)
  const next = editingName.value.trim()

  if (!playerId || !next || !original) {
    return
  }

  historyStore.linkRecentPlayerByName(playerId, original.name)
  playersStore.renameRecentPlayer(playerId, next)
  toast.add({
    title: 'Player renamed',
    description: `${original.name} is now ${next}.`,
    color: 'success'
  })
  cancelEdit()
}

function removeRecentPlayer(playerId: string, playerName: string) {
  if (!playerId) {
    return
  }

  playersStore.removeRecentPlayer(playerId)
  toast.add({
    title: 'Player removed',
    description: `${playerName} was removed from recent players.`,
    color: 'error'
  })
}

function clearRecentPlayers() {
  if (!playersStore.recentPlayers.length) {
    return
  }

  playersStore.clearRecentPlayers()
  toast.add({
    title: 'Recent players cleared',
    description: 'All remembered players have been removed.',
    color: 'error'
  })
}
</script>
