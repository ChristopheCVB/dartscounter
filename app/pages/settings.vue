<template>
  <section class="grid gap-4">
    <h1 class="m-0">Settings</h1>

    <UCard class="grid max-w-[540px] gap-4">
      <h2 class="m-0 text-lg font-semibold">Match defaults</h2>
      <div>
        <label class="mb-1.5 block text-sm text-muted">Default start score</label>
        <USelect v-model="local.startScore" :items="startScoreItems" />
      </div>

      <div>
        <label class="mb-1.5 block text-sm text-muted">Default legs to win</label>
        <UInput v-model.number="local.legsTarget" type="number" min="1" max="11" />
      </div>

      <UCheckbox v-model="local.doubleIn" label="Default double in" />
      <UCheckbox v-model="local.doubleOut" label="Default double out" />

      <UButton @click="save">Save defaults</UButton>
      <UAlert v-if="saved" color="success" title="Saved" description="Default match settings updated." />
    </UCard>

    <UCard class="grid max-w-[540px] gap-4">
      <div class="flex items-center justify-between gap-3">
        <h2 class="m-0 text-lg font-semibold">Recent players</h2>
        <UButton
          v-if="playersStore.recentPlayers.length"
          color="error"
          variant="soft"
          size="sm"
          @click="playersStore.clearRecentPlayers()"
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
              @click="playersStore.removeRecentPlayer(row.original.id)"
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

const saved = ref(false)

function save() {
  settingsStore.update({
    startScore: local.startScore,
    doubleIn: local.doubleIn,
    doubleOut: local.doubleOut,
    legsTarget: local.legsTarget
  })
  saved.value = true
  window.setTimeout(() => {
    saved.value = false
  }, 1500)
}

function addRecentPlayer() {
  const next = newRecentName.value.trim()
  if (!next) {
    return
  }

  playersStore.addRecentPlayer(next)
  newRecentName.value = ''
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
  cancelEdit()
}
</script>
