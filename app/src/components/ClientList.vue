<template>
  <QCard>
    <QCardSection class="q-pa-none">
      <QList
        separator
      >
        <QItemLabel header>
          I detta rum:
        </QItemLabel>
        <QItem
          v-for="(client, clientKey) in clients"
          :key="clientKey"
        >
          <QItemSection>
            {{ client.username }}
            <template v-if="client.clientId === clientId">
              (du)
            </template>
          </QItemSection>
          <QItemSection side>
            <QIcon
              id="hand-icon"
              color="yellow"
              v-if="client.customProperties.handRaised"
              name="waving_hand"
            />
          </QItemSection>
        </QItem>
      </QList>
      <!-- <pre>
          {{ soupStore.roomState }}
        </pre> -->
    </QCardSection>
  </QCard>
</template>

<script setup lang="ts">
import { RoomState } from 'shared-types/CustomTypes';

defineProps<{
  clients: RoomState['clients'],
  clientId: string
}>();

</script>
<style lang="scss">
@keyframes wave {
  0% {
    transform: translate(0, 10%) rotate(-90deg);
  }
  100% {
    transform: translate(0, 10%) rotate(-10deg);
  }
}

#hand-icon {
  transform-origin: bottom left;
  animation: wave 0.5s linear 0s infinite alternate;
}
    </style>