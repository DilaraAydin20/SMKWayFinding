<script>
import OSMMap from '../components/OSMMap.vue'
import VisitInformation from '../components/VisitInformation.vue'

export default {
  name: 'Homepage',
  components: { OSMMap, VisitInformation }
}
</script>

<template>
  <main class="app-main">
    <section id="map" class="content-section" :aria-label="$t('app.map')">
      <OSMMap />
    </section>

    <VisitInformation />
  </main>
</template>

<style>
.site-shell {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.app-main {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: min(calc(100% - 32px), 1600px);
  margin: 20px auto 0;
}

.content-section {
  min-width: 0;
}

@media (max-width: 480px) {
  .app-main {
    width: min(calc(100% - 24px), 1600px);
    margin-top: 12px;
  }

}

@media (min-width: 1024px) {
  .app-main {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(280px, 340px);
    align-items: start;
    gap: 24px;
    margin-top: 24px;
  }

}
</style>
