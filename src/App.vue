<script setup lang="ts">
import { ref, computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { VueCropper } from 'vue-cropper'
import { processTransparentSticker, processBannerAndReward } from './utils/imageProcessor'
import { exportStickersZip } from './utils/zipExporter' // although Step 3 is next, we can leave the import

// === State & Types ===
const albumName = ref('')

interface StickerItem {
  id: string
  name: string
  thumbnailUrl: string
  mainBlob: Blob
  thumbBlob: Blob
}

const mainStickers = ref<StickerItem[]>([])

// 附加图类型
type ExtraAssetKey = 'cover' | 'icon' | 'banner' | 'artist' | 'guide' | 'thanks'

interface ExtraAssetConfig {
  key: ExtraAssetKey
  label: string
  w: number
  h: number
  type: 'png' | 'jpg'
  ratio: [number, number]
  maxKB: number
  desc?: string
}

const ASSET_CONFIGS: Record<ExtraAssetKey, ExtraAssetConfig> = {
  cover: { key: 'cover', label: '详情页封面', w: 240, h: 240, type: 'png', ratio: [1, 1], maxKB: 80, desc: '不传将默认取主图01' },
  icon: { key: 'icon', label: '聊天面板图标', w: 50, h: 50, type: 'png', ratio: [1, 1], maxKB: 30, desc: '不传将默认取主图01' },
  banner: { key: 'banner', label: '详情页横幅', w: 750, h: 400, type: 'jpg', ratio: [75, 40], maxKB: 80 },
  artist: { key: 'artist', label: '艺术家主页图', w: 750, h: 400, type: 'jpg', ratio: [75, 40], maxKB: 80 },
  guide: { key: 'guide', label: '赞赏引导图', w: 750, h: 560, type: 'jpg', ratio: [75, 56], maxKB: 90 },
  thanks: { key: 'thanks', label: '赞赏致谢图', w: 750, h: 750, type: 'jpg', ratio: [1, 1], maxKB: 200 }
}

interface ExtraImageState {
  blob: Blob | null
  preview: string
}

const extraImages = ref<Record<ExtraAssetKey, ExtraImageState>>({
  cover: { blob: null, preview: '' },
  icon: { blob: null, preview: '' },
  banner: { blob: null, preview: '' },
  artist: { blob: null, preview: '' },
  guide: { blob: null, preview: '' },
  thanks: { blob: null, preview: '' }
})

// === Cropper Modal State ===
const showCropperModal = ref(false)
const cropperTarget = ref<ExtraAssetKey>('banner')
const cropperImage = ref('')
const cropperRef = ref()
const isProcessingExtra = ref(false)

const currentCropperConf = computed(() => ASSET_CONFIGS[cropperTarget.value])

// === Actions: Main Stickers ===
const handleFiles = async (files: FileList | null) => {
  if (!files) return
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (!file.type.startsWith('image/')) continue
    
    // Step 1: Canvas Processor for transparent
    const resMain = await processTransparentSticker(file, 240, 2)
    const resThumb = await processTransparentSticker(file, 120, 0)
    
    const id = Date.now().toString() + Math.random().toString()
    mainStickers.value.push({
      id,
      name: file.name,
      thumbnailUrl: URL.createObjectURL(resThumb.blob),
      mainBlob: resMain.blob,
      thumbBlob: resThumb.blob,
    })
  }
}

const onDropMain = (e: DragEvent) => {
  e.preventDefault()
  handleFiles(e.dataTransfer?.files || null)
}

const onFileSelectMain = (e: Event) => {
  const input = e.target as HTMLInputElement
  handleFiles(input.files)
  input.value = ''
}

const removeSticker = (id: string) => {
  mainStickers.value = mainStickers.value.filter(s => s.id !== id)
}

// === Actions: Extra Images (Cropper) ===
const openCropperFor = (target: ExtraAssetKey) => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      cropperTarget.value = target
      const fileUrl = URL.createObjectURL(file)
      cropperImage.value = fileUrl
      showCropperModal.value = true
    }
  }
  input.click()
}

const confirmCrop = () => {
  if (isProcessingExtra.value) return
  isProcessingExtra.value = true

  cropperRef.value.getCropBlob(async (blob: Blob) => {
    try {
      const target = cropperTarget.value
      const conf = currentCropperConf.value
      let finalBlob: Blob

      // Routing through Step 1 logic
      if (conf.type === 'png') {
         // cover / icon are PNG with transparency required
         const result = await processTransparentSticker(blob, conf.w, 0)
         finalBlob = result.blob
      } else {
         // JPG promos with strict limit
         finalBlob = await processBannerAndReward(blob, conf.w, conf.h, conf.maxKB)
      }

      if (extraImages.value[target].preview) {
        URL.revokeObjectURL(extraImages.value[target].preview)
      }
      extraImages.value[target].blob = finalBlob
      extraImages.value[target].preview = URL.createObjectURL(finalBlob)

    } catch(e) {
      console.error(e)
      alert("裁剪与压缩失败！")
    } finally {
      isProcessingExtra.value = false
      showCropperModal.value = false
      URL.revokeObjectURL(cropperImage.value)
      cropperImage.value = ''
    }
  })
}

const cancelCrop = () => {
  if (isProcessingExtra.value) return
  showCropperModal.value = false
  URL.revokeObjectURL(cropperImage.value)
  cropperImage.value = ''
}

const removeExtra = (target: ExtraAssetKey) => {
  if (extraImages.value[target].preview) {
    URL.revokeObjectURL(extraImages.value[target].preview)
  }
  extraImages.value[target].blob = null
  extraImages.value[target].preview = ''
}

// === Export ===
const isExporting = ref(false)
const exportStickers = async () => {
  if (mainStickers.value.length === 0) {
    alert('最少需要一张主图才能进行打包！')
    return
  }
  
  try {
    isExporting.value = true
    
    await exportStickersZip({
      albumName: albumName.value,
      stickers: mainStickers.value.map(s => ({
        mainBlob: s.mainBlob,
        thumbBlob: s.thumbBlob
      })),
      extras: {
        cover: extraImages.value.cover.blob,
        icon: extraImages.value.icon.blob,
        banner: extraImages.value.banner.blob,
        artist: extraImages.value.artist.blob,
        guide: extraImages.value.guide.blob,
        thanks: extraImages.value.thanks.blob
      }
    })
  } catch(e: any) {
    console.error(e)
    alert(`打包失败: ${e.message}`)
  } finally {
    isExporting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-neutral-950 text-neutral-200 font-sans selection:bg-emerald-500/30 p-6 flex flex-col gap-6">
    <!-- Header -->
    <header class="flex flex-wrap items-center justify-between bg-neutral-900 p-5 rounded-2xl border border-neutral-800 shadow-xl relative overflow-hidden">
      <div class="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none"></div>
      
      <div class="flex items-center gap-5 flex-1 z-10">
        <div class="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center font-black text-neutral-900 text-2xl shadow-lg shadow-emerald-500/20">W</div>
        <div>
          <h1 class="text-2xl font-black tracking-tight text-white mb-0.5">WeSticker</h1>
          <p class="text-[11px] text-neutral-400 uppercase tracking-widest font-semibold">表情专辑极速工厂 / Pro</p>
        </div>
      </div>
      
      <div class="flex items-center gap-4 flex-1 justify-center z-10">
        <div class="flex flex-col w-full max-w-sm relative">
          <input 
            v-model="albumName"
            type="text" 
            placeholder="为您的专辑命名..." 
            class="bg-neutral-950 border border-neutral-800 rounded-xl px-4 pt-5 pb-2 min-w-[280px] focus:outline-none focus:border-emerald-500 transition-all placeholder:text-neutral-700 text-sm w-full font-bold shadow-inner text-emerald-100"
          />
          <label class="absolute text-[10px] text-emerald-500 font-bold tracking-wider left-4 top-2 pointer-events-none">ALBUM NAME</label>
        </div>
      </div>

      <div class="flex flex-1 justify-end z-10">
        <button 
          @click="exportStickers" 
          :disabled="isExporting"
          class="bg-white hover:bg-neutral-200 text-neutral-950 px-8 py-3 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] active:scale-95 disabled:opacity-50 flex items-center gap-2"
        >
          {{ isExporting ? 'PACKING...' : '打包免检 ZIP' }}
        </button>
      </div>
    </header>

    <!-- Main Workspace -->
    <main class="flex xl:flex-row flex-col gap-6 flex-1 items-stretch min-h-0">
      
      <!-- Core Zone: Main Stickers -->
      <section class="xl:w-1/2 flex flex-col bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
        <div class="px-6 py-4 border-b border-neutral-800 bg-neutral-900 flex justify-between items-center z-10 shadow-sm relative">
           <div class="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
           <h2 class="font-black text-lg tracking-wide text-white">
            1. 表情矩阵 <span class="text-xs font-normal text-neutral-500 ml-2">主图规范 / 240x240 GIFs</span>
          </h2>
          <span class="bg-neutral-800 px-3 py-1 rounded text-xs font-mono font-bold">{{ mainStickers.length }} MATRICES</span>
        </div>
        
        <!-- Upload Dropzone -->
        <div 
          @dragover.prevent 
          @drop="onDropMain"
          class="m-6 mb-2 border border-dashed border-neutral-700 rounded-xl hover:border-blue-500/50 hover:bg-blue-500/5 transition-all bg-neutral-950/50 relative overflow-hidden group cursor-pointer"
        >
          <input type="file" multiple accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer w-full h-full" @change="onFileSelectMain" />
          <div class="py-10 flex flex-col items-center">
            <div class="w-14 h-14 rounded-full bg-neutral-800 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-all text-neutral-500">
               <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
            </div>
            <p class="font-bold text-neutral-300">拖拽或点击上传图片</p>
            <p class="text-xs mt-1.5 text-neutral-600">将自动补齐 2px 透明安全区，极速压缩处理</p>
          </div>
        </div>

        <!-- Draggable Grid -->
        <div class="flex-1 overflow-y-auto p-6 pt-4">
          <VueDraggable 
            v-if="mainStickers.length > 0"
            v-model="mainStickers" 
            :animation="150" 
            handle=".drag-handle"
            class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
          >
            <div 
              v-for="(item, index) in mainStickers" 
              :key="item.id" 
              class="relative bg-neutral-950 p-3 rounded-xl border border-neutral-800 hover:border-neutral-600 transition-all group flex flex-col items-center justify-center"
            >
              <div class="absolute top-2 left-2 px-1.5 py-0.5 bg-neutral-800 text-neutral-400 rounded text-[10px] font-mono font-bold z-10 drag-handle cursor-grab hover:text-white">
                #{{ String(index + 1).padStart(2, '0') }}
              </div>
              <button @click="removeSticker(item.id)" class="absolute top-2 right-2 p-1 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded z-10 opacity-0 group-hover:opacity-100 transition-all">
                <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              
              <div class="w-20 h-20 rounded bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAGElEQVQYV2NkYGAQYKADGIEoUoAJkXIBAGfGAQFh1h3JAAAAAElFTkSuQmCC')] relative mt-3 mb-2 flex items-center justify-center">
                 <img :src="item.thumbnailUrl" class="w-full h-full object-contain filter drop-shadow-md" />
              </div>
              <div class="text-[10px] text-neutral-500 truncate w-full text-center">
                {{ item.name }}
              </div>
            </div>
          </VueDraggable>
          <div v-else class="h-full flex items-center justify-center">
            <p class="text-sm font-bold text-neutral-700">等待输入...</p>
          </div>
        </div>
      </section>

      <!-- Promo Assets Zone -->
      <section class="xl:w-1/2 flex flex-col bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
         <div class="px-6 py-4 border-b border-neutral-800 bg-neutral-900 flex justify-between items-center z-10 shadow-sm relative">
           <div class="absolute left-0 top-0 bottom-0 w-1 bg-orange-500"></div>
           <h2 class="font-black text-lg tracking-wide text-white">
            2. 运营图槽 <span class="text-xs font-normal text-neutral-500 ml-2">智能压制至官标限额以下</span>
          </h2>
        </div>

        <div class="p-6 overflow-y-auto flex-1 bg-neutral-950/30">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <!-- 遍历所有物料坑位 -->
            <div 
              v-for="conf in Object.values(ASSET_CONFIGS)" 
              :key="conf.key"
              class="flex flex-col gap-2 p-4 rounded-xl border transition-all"
              :class="extraImages[conf.key].preview ? 'bg-neutral-900 border-neutral-700 hover:border-neutral-600' : 'bg-neutral-900/50 border-neutral-800 border-dashed hover:border-neutral-600'"
            >
              <div class="flex justify-between items-start">
                <div>
                  <h3 class="font-bold text-sm text-neutral-200">{{ conf.label }}</h3>
                  <p v-if="conf.desc && !extraImages[conf.key].preview" class="text-[10px] text-orange-400 mt-0.5">{{ conf.desc }}</p>
                </div>
                <div class="flex gap-1">
                   <span class="text-[9px] font-mono font-bold bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-400 border border-neutral-700">{{ conf.w }}x{{ conf.h }}</span>
                   <span class="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border"
                         :class="conf.type==='png' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'"
                   >≤{{ conf.maxKB }}KB ({{ conf.type.toUpperCase() }})</span>
                </div>
              </div>

              <!-- 上传框 / 预览区 -->
              <div class="mt-2 w-full flex-1 flex flex-col items-center justify-center min-h-[140px] relative rounded-lg overflow-hidden group cursor-pointer"
                   @click="!extraImages[conf.key].preview ? openCropperFor(conf.key) : null"
                   :style="`aspect-ratio: ${conf.ratio[0]}/${conf.ratio[1]};`"
              >
                 <template v-if="!extraImages[conf.key].preview">
                    <!-- Blank state -->
                    <div class="absolute inset-0 bg-neutral-950/50 flex flex-col items-center justify-center group-hover:bg-neutral-800/80 transition-colors">
                      <div class="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center mb-2 group-hover:scale-110 transition-all text-neutral-500">
                         <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                      </div>
                      <span class="text-[10px] font-bold text-neutral-600">点击上传</span>
                    </div>
                 </template>
                 <template v-else>
                    <!-- Preview -->
                    <img :src="extraImages[conf.key].preview" class="w-full h-full object-cover"/>
                    <!-- Hover Actions -->
                    <div class="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button @click.stop="openCropperFor(conf.key)" class="w-8 h-8 bg-neutral-800 text-white rounded-full flex items-center justify-center hover:bg-white hover:text-black transition-all">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                      </button>
                      <button @click.stop="removeExtra(conf.key)" class="w-8 h-8 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                 </template>
              </div>
            </div>
          </div>
        </div>
      </section>

    </main>

    <!-- Unified Cropper Modal -->
    <div v-if="showCropperModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-6">
      <div class="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-4xl flex flex-col shadow-2xl overflow-hidden shadow-emerald-500/10">
        <div class="p-5 border-b border-neutral-800 flex justify-between items-center bg-neutral-950">
           <div class="flex items-center gap-3">
             <div class="w-8 h-8 bg-emerald-500/10 text-emerald-400 rounded flex items-center justify-center">
               <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
             </div>
             <div>
               <h3 class="font-black tracking-wide text-white">精确裁剪 · {{ currentCropperConf.label }}</h3>
               <p class="text-[10px] text-emerald-500 font-mono">严格限制为 {{ currentCropperConf.w }} × {{ currentCropperConf.h }} px, ≤{{ currentCropperConf.maxKB }}KB</p>
             </div>
           </div>
           
           <button @click="cancelCrop" class="w-10 h-10 rounded-full border border-neutral-700 flex items-center justify-center text-neutral-400 hover:bg-neutral-800 hover:text-white transition-all">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
           </button>
        </div>
        
        <div class="h-[60vh] bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAGElEQVQYV2NkYGAQYKADGIEoUoAJkXIBAGfGAQFh1h3JAAAAAElFTkSuQmCC')] relative">
          <vue-cropper
            ref="cropperRef"
            :img="cropperImage"
            :autoCrop="true"
            :fixed="true"
            :fixedNumber="currentCropperConf.ratio"
            :centerBox="true"
            :infoTrue="true"
            :full="true"
            :outputType="currentCropperConf.type === 'png' ? 'png' : 'jpeg'"
          ></vue-cropper>

          <!-- 内部覆盖层提示 -->
          <div v-if="isProcessingExtra" class="absolute inset-0 bg-neutral-950/80 backdrop-blur flex flex-col items-center justify-center z-10 transition-all">
             <div class="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
             <p class="text-white font-bold tracking-widest">极限压制中...</p>
             <p class="text-xs text-neutral-400 mt-2 font-mono">ENFORCING {{ currentCropperConf.maxKB }}KB LIMIT</p>
          </div>
        </div>
        
        <div class="p-5 bg-neutral-950 border-t border-neutral-800 flex justify-end gap-3 rounded-b-2xl">
          <button @click="cancelCrop" :disabled="isProcessingExtra" class="px-6 py-2.5 font-bold text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition-all disabled:opacity-50">放弃</button>
          <button @click="confirmCrop" :disabled="isProcessingExtra" class="px-8 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black tracking-wide rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center gap-2">
            确认并动态压制
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* 针对 vue-cropper 特定的覆盖可以写在这里 */
</style>
