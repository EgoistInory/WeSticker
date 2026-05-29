<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { VueCropper } from 'vue-cropper'
import { processTransparentSticker, processBannerAndReward, processAssetToSpec } from './utils/imageProcessor'
import { exportStickersZip } from './utils/zipExporter'
import studioHero from './assets/sticker-studio-hero.png'

type AssetType = 'png' | 'jpg'
type ExtraAssetKey = 'cover' | 'icon' | 'banner' | 'artist' | 'guide' | 'thanks'

interface AssetConf {
  key: ExtraAssetKey
  label: string
  w: number
  h: number
  type: AssetType
  maxKB: number
  desc?: string
}

const DEFAULT_SPECS = {
  main: { w: 240, padding: 2, maxKB: 500 },
  thumb: { w: 120, padding: 0, maxKB: 200 },
  assets: {
    cover: { key: 'cover', label: '详情页封面', w: 240, h: 240, type: 'png', maxKB: 80, desc: '不上传时默认取首张主图' } as AssetConf,
    icon: { key: 'icon', label: '聊天面板图标', w: 50, h: 50, type: 'png', maxKB: 30, desc: '不上传时默认由首张主图生成' } as AssetConf,
    banner: { key: 'banner', label: '详情页横幅', w: 750, h: 400, type: 'jpg', maxKB: 80 } as AssetConf,
    artist: { key: 'artist', label: '艺术家主页图', w: 750, h: 400, type: 'jpg', maxKB: 80 } as AssetConf,
    guide: { key: 'guide', label: '赞赏引导图', w: 750, h: 560, type: 'jpg', maxKB: 90 } as AssetConf,
    thanks: { key: 'thanks', label: '赞赏致谢图', w: 750, h: 750, type: 'jpg', maxKB: 200 } as AssetConf
  }
}

const sysSpecs = ref<typeof DEFAULT_SPECS>(JSON.parse(JSON.stringify(DEFAULT_SPECS)))
const showSettingsModal = ref(false)

onMounted(() => {
  const saved = localStorage.getItem('westicker_specs')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      const mergedAssets = Object.fromEntries(
        (Object.keys(DEFAULT_SPECS.assets) as ExtraAssetKey[]).map((key) => {
          const defaults = DEFAULT_SPECS.assets[key]
          const savedAsset = parsed.assets?.[key] || {}
          return [key, { ...defaults, w: savedAsset.w ?? defaults.w, h: savedAsset.h ?? defaults.h, maxKB: savedAsset.maxKB ?? defaults.maxKB }]
        })
      ) as typeof DEFAULT_SPECS.assets

      sysSpecs.value = {
        ...DEFAULT_SPECS,
        main: { ...DEFAULT_SPECS.main, ...(parsed.main || {}) },
        thumb: { ...DEFAULT_SPECS.thumb, ...(parsed.thumb || {}) },
        assets: mergedAssets
      }
    } catch (e) {
      console.warn('Failed to load saved WeSticker specs', e)
    }
  }
})

const saveSpecs = () => {
  localStorage.setItem('westicker_specs', JSON.stringify(sysSpecs.value))
  showSettingsModal.value = false
}

const resetSpecs = () => {
  sysSpecs.value = JSON.parse(JSON.stringify(DEFAULT_SPECS))
  localStorage.removeItem('westicker_specs')
}

const albumName = ref('')

interface StickerItem {
  id: string
  name: string
  thumbnailUrl: string
  mainBlob: Blob
  thumbBlob: Blob
}

const mainStickers = ref<StickerItem[]>([])

type ExtraImageStatus = 'idle' | 'selecting' | 'loading' | 'cropping' | 'processing' | 'error' | 'ready'

interface ExtraImageState {
  blob: Blob | null
  preview: string
  status: ExtraImageStatus
  error: string
  sourceName: string
}

const createExtraState = (): ExtraImageState => ({
  blob: null,
  preview: '',
  status: 'idle',
  error: '',
  sourceName: ''
})

const extraImages = ref<Record<ExtraAssetKey, ExtraImageState>>({
  cover: createExtraState(),
  icon: createExtraState(),
  banner: createExtraState(),
  artist: createExtraState(),
  guide: createExtraState(),
  thanks: createExtraState()
})

const showCropperModal = ref(false)
const cropperTarget = ref<ExtraAssetKey>('banner')
const cropperImage = ref('')
const cropperRef = ref()
const extraFileInputRef = ref<HTMLInputElement | null>(null)
const pendingExtraTarget = ref<ExtraAssetKey>('banner')
const isProcessingExtra = ref(false)
let cropperLoadFallbackTimer: number | null = null
let extraSelectResetTimer: number | null = null

const currentCropperConf = computed(() => sysSpecs.value.assets[cropperTarget.value])
const currentExtraState = computed(() => extraImages.value[cropperTarget.value])
const assetConfs = computed(() => Object.values(sysSpecs.value.assets))
const readyExtrasCount = computed(() => Object.values(extraImages.value).filter((item) => item.preview).length)

const handleFiles = async (files: FileList | null) => {
  if (!files) return
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (!file.type.startsWith('image/')) continue

    const { w: mw, padding: mp } = sysSpecs.value.main
    const { w: tw, padding: tp } = sysSpecs.value.thumb

    const resMain = await processTransparentSticker(file, mw, mp)
    const resThumb = await processTransparentSticker(file, tw, tp)

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

const openCropperFor = (target: ExtraAssetKey) => {
  pendingExtraTarget.value = target
  const state = extraImages.value[target]
  state.status = 'selecting'
  state.error = ''
  extraFileInputRef.value?.click()

  if (extraSelectResetTimer) {
    window.clearTimeout(extraSelectResetTimer)
  }

  extraSelectResetTimer = window.setTimeout(() => {
    const currentState = extraImages.value[target]
    if (currentState.status === 'selecting') {
      currentState.status = currentState.preview ? 'ready' : 'idle'
      currentState.error = ''
    }
    extraSelectResetTimer = null
  }, 1200)
}

const clearCropperLoadFallback = () => {
  if (cropperLoadFallbackTimer) {
    window.clearTimeout(cropperLoadFallbackTimer)
    cropperLoadFallbackTimer = null
  }
}

const clearCropperSource = () => {
  clearCropperLoadFallback()
  if (cropperImage.value) {
    URL.revokeObjectURL(cropperImage.value)
    cropperImage.value = ''
  }
}

const handleExtraFileSelect = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  const target = pendingExtraTarget.value
  const state = extraImages.value[target]
  input.value = ''

  if (extraSelectResetTimer) {
    window.clearTimeout(extraSelectResetTimer)
    extraSelectResetTimer = null
  }

  if (!file) {
    state.status = state.preview ? 'ready' : 'idle'
    return
  }

  if (!file.type.startsWith('image/')) {
    state.status = 'error'
    state.error = '请选择浏览器可读取的图片文件。'
    state.sourceName = file.name
    return
  }

  state.status = 'processing'
  state.error = ''
  state.sourceName = file.name

  try {
    const conf = sysSpecs.value.assets[target]
    const finalBlob = await processAssetToSpec(file, conf.w, conf.h, conf.type, conf.maxKB)

    if (state.preview) {
      URL.revokeObjectURL(state.preview)
    }

    state.blob = finalBlob
    state.preview = URL.createObjectURL(finalBlob)
    state.status = 'ready'
    state.error = ''
  } catch (error) {
    console.error(error)
    state.status = 'error'
    state.error = '图片处理失败，请换 JPG、PNG 或 WebP 再试。'
  }
}

const confirmCrop = () => {
  if (isProcessingExtra.value || currentExtraState.value.status !== 'cropping') return
  isProcessingExtra.value = true
  currentExtraState.value.status = 'processing'
  currentExtraState.value.error = ''

  cropperRef.value.getCropBlob(async (blob: Blob) => {
    const target = cropperTarget.value
    try {
      const conf = currentCropperConf.value
      let finalBlob: Blob

      if (conf.type === 'png') {
        const result = await processTransparentSticker(blob, conf.w, 0)
        finalBlob = result.blob
      } else {
        finalBlob = await processBannerAndReward(blob, conf.w, conf.h, conf.maxKB)
      }

      if (extraImages.value[target].preview) {
        URL.revokeObjectURL(extraImages.value[target].preview)
      }
      extraImages.value[target].blob = finalBlob
      extraImages.value[target].preview = URL.createObjectURL(finalBlob)
      extraImages.value[target].status = 'ready'
      extraImages.value[target].error = ''
    } catch (e) {
      console.error(e)
      extraImages.value[target].status = 'error'
      extraImages.value[target].error = '裁剪与压缩失败，请重新选择图片。'
    } finally {
      isProcessingExtra.value = false
      showCropperModal.value = false
      clearCropperSource()
    }
  })
}

const cancelCrop = () => {
  if (isProcessingExtra.value) return
  const state = currentExtraState.value
  state.status = state.preview ? 'ready' : 'idle'
  state.error = ''
  showCropperModal.value = false
  clearCropperSource()
}

const onCropperImageLoad = (status: string) => {
  const state = currentExtraState.value
  if (status === 'success') {
    clearCropperLoadFallback()
    state.status = 'cropping'
    state.error = ''
    return
  }

  // vue-cropper can emit an early error while its internal image state is
  // being swapped. Do not block the original flow; the fallback promotes the
  // image to cropping once the modal is mounted.
  if (!cropperImage.value) {
    state.status = 'error'
    state.error = '裁剪器无法加载这张图片，请重新选择。'
  }
}

const removeExtra = (target: ExtraAssetKey) => {
  if (extraImages.value[target].preview) {
    URL.revokeObjectURL(extraImages.value[target].preview)
  }
  extraImages.value[target] = createExtraState()
}

const isExporting = ref(false)
const exportStickers = async () => {
  if (mainStickers.value.length === 0) {
    alert('最少需要一张主图才能进行打包。')
    return
  }

  try {
    isExporting.value = true
    const currentIconSize = sysSpecs.value.assets.icon.w

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
      },
      dynamicIconSize: currentIconSize
    })
  } catch (e: any) {
    console.error(e)
    alert(`打包失败：${e.message}`)
  } finally {
    isExporting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-[#f7fbf6] text-[#17211d] selection:bg-[#11c36a]/20">
    <input
      ref="extraFileInputRef"
      type="file"
      accept="image/*"
      class="hidden"
      @change="handleExtraFileSelect"
    />

    <div class="mx-auto flex min-h-screen w-full max-w-[1480px] flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
      <header class="grid gap-4 border-b border-[#d9e8df] pb-5 lg:grid-cols-[1fr_minmax(360px,520px)_auto] lg:items-center">
        <div class="flex items-center gap-4">
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#17211d] text-xl font-black text-white shadow-sm">
            W
          </div>
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.22em] text-[#11a85d]">WeSticker Pro</p>
            <h1 class="mt-1 text-2xl font-black leading-tight text-[#17211d] sm:text-3xl">微信表情发布创作台</h1>
          </div>
        </div>

        <label class="group relative block">
          <span class="absolute left-4 top-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#5f756a]">Album Name</span>
          <input
            v-model="albumName"
            type="text"
            placeholder="给这套表情起个名字"
            class="h-16 w-full rounded-lg border border-[#cfe1d6] bg-white px-4 pb-2 pt-7 text-sm font-bold text-[#17211d] shadow-[0_1px_0_rgba(23,33,29,0.05)] outline-none transition focus:border-[#11c36a] focus:ring-4 focus:ring-[#11c36a]/15 placeholder:text-[#9aaa9f]"
          />
        </label>

        <div class="flex items-center gap-3 lg:justify-end">
          <button
            @click="showSettingsModal = true"
            class="flex h-12 w-12 items-center justify-center rounded-lg border border-[#cfe1d6] bg-white text-[#496156] shadow-sm transition hover:border-[#9ccab1] hover:text-[#17211d] focus:outline-none focus:ring-4 focus:ring-[#11c36a]/15"
            title="自定义微信发布规格"
            aria-label="打开规格设置"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.3 4.3c.4-1.7 2.9-1.7 3.4 0a1.7 1.7 0 0 0 2.5 1.1c1.5-.9 3.3.8 2.4 2.4a1.7 1.7 0 0 0 1.1 2.5c1.7.4 1.7 2.9 0 3.4a1.7 1.7 0 0 0-1.1 2.5c.9 1.5-.8 3.3-2.4 2.4a1.7 1.7 0 0 0-2.5 1.1c-.4 1.7-2.9 1.7-3.4 0a1.7 1.7 0 0 0-2.5-1.1c-1.5.9-3.3-.8-2.4-2.4a1.7 1.7 0 0 0-1.1-2.5c-1.7-.4-1.7-2.9 0-3.4a1.7 1.7 0 0 0 1.1-2.5c-.9-1.5.8-3.3 2.4-2.4a1.7 1.7 0 0 0 2.5-1.1Z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </button>

          <button
            @click="exportStickers"
            :disabled="isExporting"
            class="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#17211d] px-5 text-sm font-black text-white shadow-[0_12px_30px_rgba(23,33,29,0.16)] transition hover:-translate-y-0.5 hover:bg-[#0d1713] focus:outline-none focus:ring-4 focus:ring-[#17211d]/15 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55"
          >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            {{ isExporting ? '打包中...' : '一键打包 ZIP' }}
          </button>
        </div>
      </header>

      <section class="grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
        <div class="flex min-h-[270px] flex-col justify-between rounded-lg border border-[#d9e8df] bg-white p-5 shadow-[0_18px_45px_rgba(25,54,42,0.08)] sm:p-6">
          <div>
            <p class="inline-flex rounded-full bg-[#e6f8ef] px-3 py-1 text-xs font-black text-[#0a8f4d]">MVP 发布助手</p>
            <h2 class="mt-5 max-w-2xl text-3xl font-black leading-tight text-[#17211d] sm:text-4xl">
              把一组表情，整理成微信平台能直接检查的素材包。
            </h2>
            <p class="mt-4 max-w-2xl text-sm leading-7 text-[#5f756a]">
              上传主图、补齐封面与运营图槽、按官方尺寸裁切压缩，最后导出一个 ZIP。艺术家只需要看作品，规格由工具托底。
            </p>
          </div>

          <div class="mt-6 grid gap-3 sm:grid-cols-3">
            <div class="rounded-lg bg-[#f2f8f4] p-4">
              <p class="text-2xl font-black text-[#17211d]">{{ mainStickers.length }}</p>
              <p class="mt-1 text-xs font-bold text-[#5f756a]">主图已处理</p>
            </div>
            <div class="rounded-lg bg-[#fff7e9] p-4">
              <p class="text-2xl font-black text-[#17211d]">{{ readyExtrasCount }}/6</p>
              <p class="mt-1 text-xs font-bold text-[#8a6a2c]">运营图已补齐</p>
            </div>
            <div class="rounded-lg bg-[#eef8ff] p-4">
              <p class="text-2xl font-black text-[#17211d]">{{ sysSpecs.main.w }}</p>
              <p class="mt-1 text-xs font-bold text-[#4c6b7d]">当前主图规格</p>
            </div>
          </div>
        </div>

        <div class="relative min-h-[270px] overflow-hidden rounded-lg border border-[#d9e8df] bg-[#edf7f1]">
          <img :src="studioHero" alt="" class="h-full min-h-[270px] w-full object-cover" />
          <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white/90 to-transparent p-5">
            <p class="max-w-md text-sm font-bold leading-6 text-[#23352d]">干净的工作台、透明贴纸预览、尺寸标线，都已经准备好。</p>
          </div>
        </div>
      </section>

      <main class="grid flex-1 gap-5 xl:grid-cols-[1.04fr_0.96fr]">
        <section class="flex min-h-[620px] flex-col overflow-hidden rounded-lg border border-[#d9e8df] bg-white shadow-[0_18px_45px_rgba(25,54,42,0.07)]">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[#d9e8df] px-5 py-4">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.2em] text-[#11a85d]">Step 01</p>
              <h2 class="mt-1 text-xl font-black text-[#17211d]">表情矩阵</h2>
            </div>
            <div class="flex items-center gap-2">
              <span class="rounded-full bg-[#edf7f1] px-3 py-1 text-xs font-black text-[#365446]">{{ sysSpecs.main.w }}x{{ sysSpecs.main.w }}</span>
              <span class="rounded-full bg-[#17211d] px-3 py-1 text-xs font-black text-white">{{ mainStickers.length }} 张</span>
            </div>
          </div>

          <div
            @dragover.prevent
            @drop="onDropMain"
            class="m-5 overflow-hidden rounded-lg border border-dashed border-[#9ccab1] bg-[#f5fbf7] transition hover:border-[#11c36a] hover:bg-[#effaf3]"
          >
            <input type="file" multiple accept="image/*" class="absolute h-0 w-0 opacity-0" @change="onFileSelectMain" id="main-sticker-input" />
            <label for="main-sticker-input" class="grid min-h-[170px] cursor-pointer gap-4 p-5 sm:grid-cols-[1fr_180px] sm:items-center">
              <div>
                <div class="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-[#11a85d] shadow-sm">
                  <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v14m7-7H5" />
                  </svg>
                </div>
                <p class="mt-4 text-lg font-black text-[#17211d]">拖拽或点击上传主图</p>
                <p class="mt-2 max-w-xl text-sm leading-6 text-[#5f756a]">
                  自动生成 {{ sysSpecs.main.padding }}px 安全区主图与 {{ sysSpecs.thumb.w }}px 缩略图。上传后可拖动编号调整展示顺序。
                </p>
              </div>
              <img :src="studioHero" alt="" class="hidden h-32 w-full rounded-lg object-cover sm:block" />
            </label>
          </div>

          <div class="flex-1 overflow-y-auto px-5 pb-5">
            <VueDraggable
              v-if="mainStickers.length > 0"
              v-model="mainStickers"
              :animation="150"
              handle=".drag-handle"
              class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
            >
              <div
                v-for="(item, index) in mainStickers"
                :key="item.id"
                class="group relative flex min-h-[150px] flex-col items-center justify-center rounded-lg border border-[#d9e8df] bg-[#fbfdfb] p-3 transition hover:-translate-y-0.5 hover:border-[#9ccab1] hover:shadow-[0_14px_30px_rgba(25,54,42,0.08)]"
              >
                <div class="drag-handle absolute left-2 top-2 cursor-grab rounded bg-white px-2 py-1 text-[10px] font-black text-[#5f756a] shadow-sm transition hover:text-[#17211d]">
                  #{{ String(index + 1).padStart(2, '0') }}
                </div>
                <button @click="removeSticker(item.id)" class="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded bg-[#fff0f0] text-[#d64b4b] opacity-0 transition hover:bg-[#d64b4b] hover:text-white group-hover:opacity-100" title="移除主图" aria-label="移除主图">
                  <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>

                <div class="mt-6 flex h-24 w-24 items-center justify-center rounded-lg border border-[#e2ede6] bg-[linear-gradient(45deg,#eef3ef_25%,transparent_25%),linear-gradient(-45deg,#eef3ef_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#eef3ef_75%),linear-gradient(-45deg,transparent_75%,#eef3ef_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0]">
                  <img :src="item.thumbnailUrl" class="h-full w-full object-contain drop-shadow-sm" />
                </div>
                <p class="mt-3 w-full truncate text-center text-xs font-bold text-[#5f756a]">{{ item.name }}</p>
              </div>
            </VueDraggable>

            <div v-else class="flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-[#e3eee7] bg-[#fbfdfb] p-8 text-center">
              <img :src="studioHero" alt="" class="mb-5 h-28 w-44 rounded-lg object-cover opacity-95" />
              <p class="text-base font-black text-[#17211d]">等待第一张表情</p>
              <p class="mt-2 max-w-sm text-sm leading-6 text-[#6b7f74]">上传后这里会变成可拖拽的表情矩阵，顺序就是最终 ZIP 内的编号顺序。</p>
            </div>
          </div>
        </section>

        <section class="flex min-h-[620px] flex-col overflow-hidden rounded-lg border border-[#d9e8df] bg-white shadow-[0_18px_45px_rgba(25,54,42,0.07)]">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[#d9e8df] px-5 py-4">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.2em] text-[#d68614]">Step 02</p>
              <h2 class="mt-1 text-xl font-black text-[#17211d]">运营图槽</h2>
            </div>
            <span class="rounded-full bg-[#fff7e9] px-3 py-1 text-xs font-black text-[#8a5a0a]">智能裁切与压缩</span>
          </div>

          <div class="flex-1 overflow-y-auto p-5">
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div
                v-for="conf in assetConfs"
                :key="conf.key"
                class="flex flex-col rounded-lg border transition"
                :class="extraImages[conf.key].preview ? 'border-[#9ccab1] bg-[#fbfdfb]' : 'border-[#d9e8df] bg-white hover:border-[#9ccab1]'"
              >
                <div class="flex min-h-[78px] items-start justify-between gap-3 p-4">
                  <div>
                    <h3 class="text-sm font-black text-[#17211d]">{{ conf.label }}</h3>
                    <p v-if="conf.desc && !extraImages[conf.key].preview" class="mt-1 text-xs font-bold text-[#d68614]">{{ conf.desc }}</p>
                    <p v-else-if="extraImages[conf.key].sourceName" class="mt-1 max-w-[190px] truncate text-xs font-bold text-[#6b7f74]">{{ extraImages[conf.key].sourceName }}</p>
                    <p v-else class="mt-1 text-xs font-bold text-[#6b7f74]">{{ conf.type.toUpperCase() }} 输出</p>
                  </div>
                  <div class="flex shrink-0 flex-col items-end gap-1">
                    <span class="rounded bg-[#edf7f1] px-2 py-1 text-[10px] font-black text-[#365446]">{{ conf.w }}x{{ conf.h }}</span>
                    <span class="rounded bg-[#fff7e9] px-2 py-1 text-[10px] font-black text-[#8a5a0a]">≤{{ conf.maxKB }}KB</span>
                    <span
                      v-if="extraImages[conf.key].status !== 'idle'"
                      class="rounded px-2 py-1 text-[10px] font-black"
                      :class="{
                        'bg-[#e6f8ef] text-[#0a8f4d]': extraImages[conf.key].status === 'ready' || extraImages[conf.key].status === 'cropping',
                        'bg-[#eef8ff] text-[#3d6f8d]': extraImages[conf.key].status === 'selecting' || extraImages[conf.key].status === 'loading' || extraImages[conf.key].status === 'processing',
                        'bg-[#fff0f0] text-[#d64b4b]': extraImages[conf.key].status === 'error'
                      }"
                    >
                      {{
                        extraImages[conf.key].status === 'ready' ? '已生成' :
                        extraImages[conf.key].status === 'selecting' ? '选择中' :
                        extraImages[conf.key].status === 'loading' ? '读取中' :
                        extraImages[conf.key].status === 'cropping' ? '待确认' :
                        extraImages[conf.key].status === 'processing' ? '处理中' : '需重试'
                      }}
                    </span>
                  </div>
                </div>

                <div
                  class="group relative mx-4 mb-4 flex min-h-[140px] cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-[#e2ede6] bg-[#f5fbf7]"
                  @click="!extraImages[conf.key].preview ? openCropperFor((conf.key as ExtraAssetKey)) : null"
                  :style="`aspect-ratio: ${conf.w}/${conf.h};`"
                >
                  <template v-if="!extraImages[conf.key].preview">
                    <div class="absolute inset-0 flex flex-col items-center justify-center text-center transition hover:bg-[#eaf7ef]">
                      <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#11a85d] shadow-sm">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v14m7-7H5" />
                        </svg>
                      </div>
                      <span class="mt-3 text-xs font-black text-[#5f756a]">
                        {{
                          extraImages[conf.key].status === 'selecting' ? '等待选择图片' :
                          extraImages[conf.key].status === 'loading' ? '正在读取图片...' :
                          extraImages[conf.key].status === 'processing' ? '正在裁切压缩...' :
                          '选择图片并裁切'
                        }}
                      </span>
                      <span
                        class="mt-1 max-w-[80%] text-[11px] font-bold leading-5"
                        :class="extraImages[conf.key].status === 'error' ? 'text-[#d64b4b]' : 'text-[#6b7f74]'"
                      >
                        {{ extraImages[conf.key].status === 'error' ? extraImages[conf.key].error : '会按当前项尺寸裁切压缩' }}
                      </span>
                    </div>
                  </template>
                  <template v-else>
                    <img :src="extraImages[conf.key].preview" class="h-full w-full object-cover" />
                    <div class="absolute inset-0 flex items-center justify-center gap-3 bg-[#17211d]/70 opacity-0 backdrop-blur-sm transition group-hover:opacity-100 hover:opacity-100">
                      <button @click.stop="openCropperFor((conf.key as ExtraAssetKey))" class="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#17211d] transition hover:bg-[#e6f8ef]" title="重新选择并处理" aria-label="重新选择并处理">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m16.9 3.6 3.5 3.5M4 20h3.6L19.2 8.4a2.5 2.5 0 0 0-3.5-3.5L4 16.5V20Z" />
                        </svg>
                      </button>
                      <button @click.stop="removeExtra((conf.key as ExtraAssetKey))" class="flex h-9 w-9 items-center justify-center rounded-lg bg-[#fff0f0] text-[#d64b4b] transition hover:bg-[#d64b4b] hover:text-white" title="移除图片" aria-label="移除图片">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7 18.1 19.1A2 2 0 0 1 16.1 21H7.9a2 2 0 0 1-2-1.9L5 7m5 4v6m4-6v6M4 7h16m-3 0V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3" />
                        </svg>
                      </button>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>

    <div v-if="showSettingsModal" class="fixed inset-0 z-[100] flex items-center justify-center bg-[#17211d]/45 p-4 backdrop-blur-sm">
      <div class="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-[#cfe1d6] bg-white shadow-2xl">
        <div class="flex items-center justify-between border-b border-[#d9e8df] px-5 py-4">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.2em] text-[#11a85d]">Publishing Specs</p>
            <h3 class="mt-1 text-xl font-black text-[#17211d]">微信发布规格设置</h3>
          </div>
          <button @click="showSettingsModal = false" class="flex h-10 w-10 items-center justify-center rounded-lg text-[#5f756a] transition hover:bg-[#f1f7f3] hover:text-[#17211d]" title="关闭" aria-label="关闭设置">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="flex flex-col gap-5 overflow-y-auto p-5">
          <section class="rounded-lg border border-[#d9e8df] bg-[#fbfdfb] p-4">
            <h4 class="text-sm font-black text-[#17211d]">主图系统</h4>
            <div class="mt-4 grid gap-3 sm:grid-cols-3">
              <label class="text-xs font-bold text-[#5f756a]">
                主图长宽 px
                <input type="number" v-model="sysSpecs.main.w" class="mt-1 h-10 w-full rounded-lg border border-[#cfe1d6] bg-white px-3 text-sm font-black text-[#17211d] outline-none focus:border-[#11c36a] focus:ring-4 focus:ring-[#11c36a]/15" />
              </label>
              <label class="text-xs font-bold text-[#5f756a]">
                主图安全留白 px
                <input type="number" v-model="sysSpecs.main.padding" class="mt-1 h-10 w-full rounded-lg border border-[#cfe1d6] bg-white px-3 text-sm font-black text-[#17211d] outline-none focus:border-[#11c36a] focus:ring-4 focus:ring-[#11c36a]/15" />
              </label>
              <label class="text-xs font-bold text-[#5f756a]">
                缩略图长宽 px
                <input type="number" v-model="sysSpecs.thumb.w" class="mt-1 h-10 w-full rounded-lg border border-[#cfe1d6] bg-white px-3 text-sm font-black text-[#17211d] outline-none focus:border-[#11c36a] focus:ring-4 focus:ring-[#11c36a]/15" />
              </label>
            </div>
          </section>

          <section class="rounded-lg border border-[#d9e8df] bg-[#fbfdfb] p-4">
            <h4 class="text-sm font-black text-[#17211d]">附加素材规格</h4>
            <div class="mt-4 flex flex-col gap-2">
              <div v-for="asset in (Object.keys(sysSpecs.assets) as ExtraAssetKey[])" :key="asset" class="grid gap-2 rounded-lg border border-[#e2ede6] bg-white p-3 text-xs sm:grid-cols-[1fr_84px_84px_96px] sm:items-center">
                <div class="font-black text-[#17211d]">{{ sysSpecs.assets[asset].label }}</div>
                <input type="number" v-model="sysSpecs.assets[asset].w" placeholder="W" class="h-9 rounded-lg border border-[#cfe1d6] px-2 font-bold outline-none focus:border-[#11c36a]" title="Width" />
                <input type="number" v-model="sysSpecs.assets[asset].h" placeholder="H" class="h-9 rounded-lg border border-[#cfe1d6] px-2 font-bold outline-none focus:border-[#11c36a]" title="Height" />
                <label class="flex items-center gap-2 font-bold text-[#8a5a0a]">
                  <input type="number" v-model="sysSpecs.assets[asset].maxKB" class="h-9 w-full rounded-lg border border-[#cfe1d6] px-2 font-bold outline-none focus:border-[#11c36a]" title="Max KB Size" />
                  KB
                </label>
              </div>
            </div>
          </section>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-[#d9e8df] bg-[#f7fbf6] px-5 py-4">
          <button @click="resetSpecs" class="rounded-lg bg-[#fff0f0] px-4 py-2 text-sm font-black text-[#d64b4b] transition hover:bg-[#ffe4e4]">
            恢复微信官方参数
          </button>
          <button @click="saveSpecs" class="rounded-lg bg-[#11c36a] px-5 py-2 text-sm font-black text-white shadow-sm transition hover:bg-[#0fac5c]">
            保存到本地
          </button>
        </div>
      </div>
    </div>

    <div v-if="showCropperModal" class="fixed inset-0 z-50 flex items-center justify-center bg-[#17211d]/80 p-4 backdrop-blur-md">
      <div class="flex h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-[#cfe1d6] bg-white shadow-2xl">
        <div class="flex items-center justify-between border-b border-[#d9e8df] px-5 py-4">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.18em] text-[#11a85d]">Crop Studio</p>
            <h3 class="mt-1 text-lg font-black text-[#17211d]">精确裁切 · {{ currentCropperConf.label }}</h3>
            <p class="mt-1 text-xs font-bold text-[#5f756a]">目标：{{ currentCropperConf.w }} × {{ currentCropperConf.h }} px，限制 ≤{{ currentCropperConf.maxKB }}KB</p>
          </div>
          <button @click="cancelCrop" class="flex h-10 w-10 items-center justify-center rounded-lg border border-[#d9e8df] text-[#5f756a] transition hover:bg-[#f1f7f3] hover:text-[#17211d]" title="关闭" aria-label="关闭裁切">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="relative flex-1 bg-[linear-gradient(45deg,#eef3ef_25%,transparent_25%),linear-gradient(-45deg,#eef3ef_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#eef3ef_75%),linear-gradient(-45deg,transparent_75%,#eef3ef_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0]">
          <vue-cropper
            ref="cropperRef"
            :img="cropperImage"
            :autoCrop="true"
            :fixed="true"
            :fixedNumber="[currentCropperConf.w, currentCropperConf.h]"
            :centerBox="true"
            :infoTrue="true"
            :full="true"
            :outputType="currentCropperConf.type === 'png' ? 'png' : 'jpeg'"
            @img-load="onCropperImageLoad"
            @imgLoad="onCropperImageLoad"
          ></vue-cropper>

          <div v-if="currentExtraState.status === 'loading'" class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/85 backdrop-blur">
            <div class="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#11c36a] border-t-transparent"></div>
            <p class="font-black text-[#17211d]">正在载入图片...</p>
            <p class="mt-2 text-xs font-bold text-[#5f756a]">载入完成后即可裁切</p>
          </div>

          <div v-if="isProcessingExtra" class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/85 backdrop-blur">
            <div class="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#11c36a] border-t-transparent"></div>
            <p class="font-black text-[#17211d]">正在裁切压缩...</p>
            <p class="mt-2 text-xs font-bold text-[#5f756a]">目标体积 ≤{{ currentCropperConf.maxKB }}KB</p>
          </div>
        </div>

        <div class="flex justify-end gap-3 border-t border-[#d9e8df] bg-[#f7fbf6] px-5 py-4">
          <button @click="cancelCrop" :disabled="isProcessingExtra" class="rounded-lg px-5 py-2 text-sm font-black text-[#5f756a] transition hover:bg-white hover:text-[#17211d] disabled:opacity-50">
            放弃
          </button>
          <button @click="confirmCrop" :disabled="isProcessingExtra || currentExtraState.status !== 'cropping'" class="rounded-lg bg-[#17211d] px-6 py-2 text-sm font-black text-white shadow-sm transition hover:bg-[#0d1713] disabled:cursor-not-allowed disabled:opacity-50">
            确认裁切出片
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
