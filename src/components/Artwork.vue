<script>
import { getArtworks, rows } from '../data/smk-api.js';

export default {
    name: 'Artwork Catalogue',
    components: {
    },
    data() {
        return {
            offset: 0,
            isLoading: false,
            hasMore: true,
            loadError: ''
        }
    },
    props: {
    },
    computed: {
        

    },
    methods: {
        async loadMore() {
            // If loading is active or there is no more art to list => return
            if (this.isLoading || !this.hasMore) return; 

            this.isLoading = true; // Loading is active
            this.loadError = ''; // Reset any previous errors

            try {
                const loadedCount = await getArtworks(this.offset);
                this.offset += loadedCount; // offset = offset + loaded (20)
                this.hasMore = loadedCount === rows; // hasMore is true, if loadedCount = 20 (rows)
            } catch (err) {
                console.error('Could not load more artworks:', err);
                this.loadError = 'Could not load more artworks, please try again.';
            } finally {
                this.isLoading = false;
            }
        }
    },
    watch: {
        
    },
    emits: [],
    mounted() {
        this.loadMore();
    }
}
</script>

<template>
    <section class = "banner"></section>
    
    <section id = "artwork">
        
    </section>
    <p v-if="loadError" role="alert">{{ loadError }}</p>
    <button @click="loadMore" :disabled="isLoading || !hasMore">
        {{ isLoading ? 'Loading...' : hasMore ? 'Load more' : 'Everything is loaded' }}
    </button>


</template>

<style scoped>
  .banner {
    position: relative;
    display: flex;
    align-items: center;
    flex-shrink: 0;
    width: calc(100% - 48px);
    min-height: 120px;
    margin: 24px auto 0;
    padding: 24px 30px;
    overflow: hidden;
    border-radius: 18px;
    background: linear-gradient(115deg, #123a5c, #1a4d78 68%, #b17c4a);
    box-shadow: 0 10px 24px rgba(18, 58, 92, 0.18);
  }

  .banner::before {
    position: absolute;
    top: -70px;
    right: -25px;
    width: 220px;
    height: 220px;
    border: 1px solid rgba(255, 255, 255, 0.22);
    border-radius: 50%;
    box-shadow: 0 0 0 24px rgba(255, 255, 255, 0.06),
      0 0 0 48px rgba(255, 255, 255, 0.04);
    content: "";
  }

  .banner::after {
    position: relative;
    color: #fff;
    content: "Kunstværker";
    font-size: clamp(1.4rem, 3vw, 2rem);
    font-weight: 700;
    letter-spacing: 0.01em;
  }

  #artwork {
    display: grid;
    flex-shrink: 0;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr));
    gap: 20px;
    width: 100%;
    padding: 24px;
  }

  #artwork :deep(.card) {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    min-width: 0;
    max-width: 420px;
    height: 100%;
    padding: 14px;
    border: 1px solid #e8e4de;
    border-radius: 16px;
    background: #fff;
    box-shadow: 0 5px 16px rgba(31, 41, 55, 0.08);
    transition: transform 180ms ease, box-shadow 180ms ease;
  }

  #artwork :deep(.card:hover) {
    transform: translateY(-4px);
    box-shadow: 0 12px 26px rgba(31, 41, 55, 0.14);
  }

  #artwork :deep(.cardImage) {
    order: -1;
    display: block;
    width: 100%;
    height: 230px;
    flex: 0 0 230px;
    margin-bottom: 14px;
    border-radius: 11px;
    background: #f3f0eb;
    object-fit: contain;
  }

  #artwork :deep(.cardTitle) {
    margin: 0 0 6px;
    color: #1f2937;
    font-size: 1.05rem;
    font-weight: 700;
    line-height: 1.35;
  }

  #artwork :deep(.cardAuthor) {
    margin: 0 0 10px;
    color: #5b6470;
    font-size: 0.92rem;
  }

  #artwork :deep(.cardYear) {
    order: 1;
    align-self: flex-start;
    margin: auto 0 0;
    padding: 5px 9px;
    border-radius: 999px;
    background: #eef4f8;
    color: #1a4d78;
    font-size: 0.75rem;
    font-weight: 700;
  }

  #artwork :deep(.cardDisplay) {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    width: fit-content;
    margin: 0 0 12px;
    padding: 6px 10px;
    border: 1px solid #d8dee4;
    border-radius: 999px;
    background: #f3f5f6;
    color: #525c66;
    font-size: 0.78rem;
    font-weight: 700;
    line-height: 1;
  }

  #artwork :deep(.cardDisplay::before) {
    width: 7px;
    height: 7px;
    flex: 0 0 7px;
    border-radius: 50%;
    background: currentColor;
    content: "";
  }

  #artwork :deep(.cardDisplay--on-display) {
    border-color: #c9e6d1;
    background: #edf7f0;
    color: #287044;
  }

  #artwork :deep(.cardDisplay:empty) {
    display: none;
  }

  #artwork :deep(.cardBtn) {
    order: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    margin-top: 8px;
    padding: 10px 14px;
    border-radius: 10px;
    background: #1a4d78;
    color: #fff;
    font-size: 0.9rem;
    font-weight: 700;
    text-align: center;
    text-decoration: none;
    transition: background-color 180ms ease, transform 180ms ease;
  }

  #artwork :deep(.cardBtn:hover) {
    transform: translateY(-1px);
    background: #123a5c;
  }

  #artwork :deep(.cardBtn:focus-visible) {
    outline: 3px solid #d5a56f;
    outline-offset: 3px;
  }

  #artwork :deep(.cardBtn[aria-disabled="true"]) {
    background: #8b9298;
    cursor: not-allowed;
    pointer-events: none;
  }

  @media (max-width: 520px) {
    .banner {
      width: calc(100% - 32px);
      min-height: 100px;
      padding: 20px;
    }

    #artwork {
      grid-template-columns: 1fr;
      gap: 16px;
      padding: 16px;
    }

    #artwork :deep(.card) {
      max-width: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    #artwork :deep(.card) {
      transition: none;
    }
  }
</style>