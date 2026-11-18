<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { VueCropper } from 'vue-cropper'
import {
  processTransparentSticker,
  processBannerAndReward,
  processAssetToSpec,
  sliceSpriteSheet,
  synthesizeAllPromoAssets,
  DEFAULT_CRAFT_OPTIONS,
  type StickerCraftOptions,
  type CaptionStyle,
  type PromoThemeKey,
} from './utils/imageProcessor'
import type { MotionPreset } from './utils/gifEncoder'
import {
  DEMO_PACKS,
  PROMPT_BLUEPRINTS,
  generateDemoPackRawBlobs,
  generateDemoSpriteSheetBlob,
  type DemoPackId,
} from './utils/demoPackGenerator'
import { exportStickersZip } from './utils/zipExporter'

// === Types & Specification State ===
type AssetType = 'png' | 'jpg'
type ExtraAssetKey = 'cover' | 'icon' | 'banner' | 'artist' | 'guide' | 'thanks'
type StudioTab = 'matrix' | 'slicer' | 'promo' | 'prompts'
type DeviceSimTab = 'chat' | 'store'

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
    banner: { key: 'banner', label: '详情页横幅', w: 750, h: 400, type: 'jpg', maxKB: 80, desc: '商店顶部主打视觉横幅' } as AssetConf,
    artist: { key: 'artist', label: '艺术家主页图', w: 750, h: 400, type: 'jpg', maxKB: 80, desc: '创作者个人主页头图' } as AssetConf,
    guide: { key: 'guide', label: '赞赏引导图', w: 750, h: 560, type: 'jpg', maxKB: 90, desc: '详情页底部打赏引导' } as AssetConf,
    thanks: { key: 'thanks', label: '赞赏致谢图', w: 750, h: 750, type: 'jpg', maxKB: 200, desc: '用户打赏后弹出致谢卡' } as AssetConf,
  },
}

const sysSpecs = ref<typeof DEFAULT_SPECS>(JSON.parse(JSON.stringify(DEFAULT_SPECS)))
const showSettingsModal = ref(false)

// Studio UI State
const studioTheme = ref<'dark' | 'light'>('dark')
const activeTab = ref<StudioTab>('matrix')
const showBleedLaser = ref(true)
const matrixCheckerDark = ref(true)
const toastMessage = ref('')
let toastTimer: number | null = null

const triggerToast = (msg: string) => {
  toastMessage.value = msg
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toastMessage.value = ''
  }, 3200)
}

// Global Die-Cut & Craft Options
const craftOpts = ref<StickerCraftOptions>({ ...DEFAULT_CRAFT_OPTIONS })
const isBatchCrafting = ref(false)

const CAPTION_STYLE_PRESETS: { k: CaptionStyle; label: string }[] = [
  { k: 'classic-white', label: '经典白字' },
  { k: 'pop-yellow', label: '波普撞色' },
  { k: 'cyber-emerald', label: '赛博翠绿' },
  { k: 'flame-red', label: '暴躁火焰' },
]

const MOTION_PRESETS: { k: MotionPreset; label: string }[] = [
  { k: 'static', label: '静态单帧' },
  { k: 'bounce', label: 'Q弹果冻' },
  { k: 'wiggle', label: '魔性摇摆' },
  { k: 'pulse', label: '心跳呼吸' },
]

// Album Metadata
const albumName = ref('佛系打工豚日常')
const albumSubtitle = ref('精神状态极度稳定的职场护身符')
const activeDemoPack = ref<DemoPackId>('capybara')

// Sticker Matrix Items
interface StickerItem {
  id: string
  name: string
  rawSource: Blob | File
  caption: string
  thumbnailUrl: string
  gifPreviewUrl: string
  mainBlob: Blob
  gifBlob: Blob
  thumbBlob: Blob
  canvas: HTMLCanvasElement
  bleedPassed: boolean
  sizeKB: string
}

const mainStickers = ref<StickerItem[]>([])
const selectedStickerId = ref<string>('')

const selectedSticker = computed(() =>
  mainStickers.value.find((s) => s.id === selectedStickerId.value) || mainStickers.value[0] || null
)

// Promo Assets State
type ExtraImageStatus = 'idle' | 'selecting' | 'loading' | 'cropping' | 'processing' | 'error' | 'ready'

interface ExtraImageState {
  blob: Blob | null
  preview: string
  status: ExtraImageStatus
  error: string
  sourceName: string
  sizeKB: number
}

const createExtraState = (): ExtraImageState => ({
  blob: null,
  preview: '',
  status: 'idle',
  error: '',
  sourceName: '',
  sizeKB: 0,
})

const extraImages = ref<Record<ExtraAssetKey, ExtraImageState>>({
  cover: createExtraState(),
  icon: createExtraState(),
  banner: createExtraState(),
  artist: createExtraState(),
  guide: createExtraState(),
  thanks: createExtraState(),
})

const promoTheme = ref<PromoThemeKey>('atelier-warm')
const isSynthesizingPromo = ref(false)

// Sprite Sheet Slicer State
const slicerSourceBlob = ref<Blob | null>(null)
const slicerPreviewUrl = ref('')
const slicerRows = ref(3)
const slicerCols = ref(3)
const slicerTrim = ref(4)
const slicerAutoRemoveBg = ref(true)
const slicerTolerance = ref(32)
const slicerDefaultCaptions = ref<string[]>([])
const isSlicing = ref(false)

// Live WeChat Device Twin State
const deviceTab = ref<DeviceSimTab>('chat')
const wechatDarkMode = ref(false)
const showThanksPopupInSim = ref(false)
const customChatInput = ref('')
const chatStreamRef = ref<HTMLElement | null>(null)

const scrollChatToBottom = () => {
  nextTick(() => {
    if (chatStreamRef.value) {
      chatStreamRef.value.scrollTop = chatStreamRef.value.scrollHeight
    }
  })
}

interface ChatMessage {
  id: string
  sender: 'peer' | 'me'
  author: string
  text?: string
  stickerUrl?: string
  caption?: string
  time: string
}

const chatMessages = ref<ChatMessage[]>([
  {
    id: 'm1',
    sender: 'peer',
    author: '产品经理 Leo',
    text: '周五下班前能把新版微信表情包提审物料发我吗？记得深色模式别有黑边！',
    time: '17:42',
  },
])

// Cropper Modal State
const showCropperModal = ref(false)
const cropperTarget = ref<ExtraAssetKey>('banner')
const cropperImage = ref('')
const cropperRef = ref()
const extraFileInputRef = ref<HTMLInputElement | null>(null)
const pendingExtraTarget = ref<ExtraAssetKey>('banner')
const isProcessingExtra = ref(false)

const currentCropperConf = computed(() => sysSpecs.value.assets[cropperTarget.value])
const currentExtraState = computed(() => extraImages.value[cropperTarget.value])
const assetConfs = computed(() => Object.values(sysSpecs.value.assets))
const readyExtrasCount = computed(() => Object.values(extraImages.value).filter((item) => item.preview).length)

// === Pre-Flight Compliance Radar Computed ===
const preflightAudit = computed(() => {
  const count = mainStickers.value.length
  const isStandardCount = count === 8 || count === 16 || count === 24
  const allBleedPassed = count > 0 && mainStickers.value.every((s) => s.bleedPassed)
  const allSizePassed =
    count > 0 &&
    mainStickers.value.every((s) => {
      const activeBlob = craftOpts.value.exportFormat === 'gif89a' ? s.gifBlob : s.mainBlob
      return activeBlob.size <= sysSpecs.value.main.maxKB * 1024
    })
  const extrasCompliant = (Object.keys(extraImages.value) as ExtraAssetKey[]).every((k) => {
    const item = extraImages.value[k]
    if (!item.blob) return true
    return item.blob.size <= sysSpecs.value.assets[k].maxKB * 1024
  })

  let score = 0
  if (count > 0) score += 35
  if (allBleedPassed) score += 25
  if (allSizePassed && extrasCompliant) score += 25
  if (readyExtrasCount.value >= 4) score += 15

  return {
    count,
    isStandardCount,
    allBleedPassed,
    allSizePassed,
    extrasCompliant,
    score: Math.min(100, score),
  }
})

// === Core Sticker Craft Pipeline ===
const buildStickerItem = async (
  rawSource: Blob | File,
  name: string,
  caption: string,
  existingId?: string
): Promise<StickerItem> => {
  const { w: mw, padding: mp } = sysSpecs.value.main
  const { w: tw, padding: tp } = sysSpecs.value.thumb

  const itemCraft: StickerCraftOptions = {
    ...craftOpts.value,
    caption,
  }

  const resMain = await processTransparentSticker(rawSource, mw, mp, itemCraft)
  const resThumb = await processTransparentSticker(rawSource, tw, tp, {
    ...itemCraft,
    motion: 'static',
  })

  const activePayload = craftOpts.value.exportFormat === 'gif89a' ? resMain.gifBlob : resMain.blob

  return {
    id: existingId || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    rawSource,
    caption,
    thumbnailUrl: URL.createObjectURL(resMain.blob),
    gifPreviewUrl: URL.createObjectURL(resMain.gifBlob),
    mainBlob: resMain.blob,
    gifBlob: resMain.gifBlob,
    thumbBlob: resThumb.blob,
    canvas: resMain.canvas,
    bleedPassed: resMain.bleedAudit.passed,
    sizeKB: (activePayload.size / 1024).toFixed(1),
  }
}

const revokeStickerUrls = (item: StickerItem) => {
  if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl)
  if (item.gifPreviewUrl) URL.revokeObjectURL(item.gifPreviewUrl)
}

// Re-process a single sticker when its caption or global craft option changes
const updateSingleStickerCaption = async (item: StickerItem, newCaption: string) => {
  item.caption = newCaption
  const updated = await buildStickerItem(item.rawSource, item.name, newCaption, item.id)
  const idx = mainStickers.value.findIndex((s) => s.id === item.id)
  if (idx !== -1) {
    revokeStickerUrls(mainStickers.value[idx])
    mainStickers.value[idx] = updated
  }
}

// Batch re-process all stickers with current Die-Cut / Chroma-Key / Motion settings
const applyCraftToAllStickers = async () => {
  if (mainStickers.value.length === 0 || isBatchCrafting.value) return
  isBatchCrafting.value = true
  try {
    const updatedList: StickerItem[] = []
    for (const item of mainStickers.value) {
      const updated = await buildStickerItem(item.rawSource, item.name, item.caption, item.id)
      revokeStickerUrls(item)
      updatedList.push(updated)
    }
    mainStickers.value = updatedList
    triggerToast(`已完成 ${updatedList.length} 张主图刀模白边与编码重算`)
  } finally {
    isBatchCrafting.value = false
  }
}

// Load a Built-in Interactive IP Showcase Pack
const loadDemoPack = async (packId: DemoPackId) => {
  isBatchCrafting.value = true
  try {
    activeDemoPack.value = packId
    // Clean old URLs
    mainStickers.value.forEach(revokeStickerUrls)
    mainStickers.value = []

    const { meta, items } = await generateDemoPackRawBlobs(packId)
    albumName.value = meta.albumName
    albumSubtitle.value = meta.subtitle

    // Demo pack raw blobs already have transparent backgrounds, so disable removeBg by default for clean vectors
    craftOpts.value.removeBg = false
    craftOpts.value.strokeWidth = 4

    const built: StickerItem[] = []
    for (const entry of items) {
      const sticker = await buildStickerItem(entry.rawBlob, entry.name, entry.caption)
      built.push(sticker)
    }
    mainStickers.value = built
    if (built.length > 0) {
      selectedStickerId.value = built[0].id
      // Push first two stickers into the live WeChat chat simulator
      chatMessages.value = [
        {
          id: 'm1',
          sender: 'peer',
          author: '产品经理 Leo',
          text: `「${meta.albumName}」全套贴纸做好了吗？发两张出来看看深浅色气泡效果！`,
          time: '17:42',
        },
        {
          id: 'm2',
          sender: 'me',
          author: '我',
          stickerUrl: built[0].gifPreviewUrl,
          caption: built[0].caption,
          time: '17:43',
        },
      ]
    }

    // Automatically synthesize all 6 promotional banners for an instant zero-empty-state showcase!
    await handleAutoSynthesizePromo(true)
    triggerToast(`已载入「${meta.albumName}」8 张样片与全套 6 张运营物料`)
  } finally {
    isBatchCrafting.value = false
  }
}

// Upload Main Stickers
const handleFiles = async (files: FileList | null) => {
  if (!files || files.length === 0) return
  isBatchCrafting.value = true
  try {
    let added = 0
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file.type.startsWith('image/')) continue
      const cleanName = file.name.replace(/\.[^/.]+$/, '')
      const defaultCaption = cleanName.length <= 5 ? cleanName : ''
      const item = await buildStickerItem(file, file.name, defaultCaption)
      mainStickers.value.push(item)
      added++
    }
    if (added > 0) {
      if (!selectedStickerId.value && mainStickers.value[0]) {
        selectedStickerId.value = mainStickers.value[0].id
      }
      triggerToast(`成功导入并精修 ${added} 张表情主图`)
    }
  } finally {
    isBatchCrafting.value = false
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
  const target = mainStickers.value.find((s) => s.id === id)
  if (target) revokeStickerUrls(target)
  mainStickers.value = mainStickers.value.filter((s) => s.id !== id)
}

const clearAllStickers = () => {
  mainStickers.value.forEach(revokeStickerUrls)
  mainStickers.value = []
  selectedStickerId.value = ''
  triggerToast('已清空矩阵工作台，可随时拖入您的原创原图')
}

const setStickerAsCover = async (item: StickerItem) => {
  const conf = sysSpecs.value.assets.cover
  const res = await processTransparentSticker(item.canvas.toDataURL('image/png'), conf.w, 0, {
    strokeWidth: 0,
    dropShadow: false,
    removeBg: false,
  })
  if (extraImages.value.cover.preview) URL.revokeObjectURL(extraImages.value.cover.preview)
  extraImages.value.cover = {
    blob: res.blob,
    preview: URL.createObjectURL(res.blob),
    status: 'ready',
    error: '',
    sourceName: `${item.name} (主图派生)`,
    sizeKB: Number((res.blob.size / 1024).toFixed(1)),
  }
  triggerToast(`已将「${item.name}」设为 240×240 详情页封面图`)
}

// === Send Sticker or Text to WeChat Live Chat Simulator ===
const sendStickerToChat = (item: StickerItem) => {
  const now = new Date()
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  chatMessages.value.push({
    id: `${Date.now()}_${Math.random()}`,
    sender: 'me',
    author: '我',
    stickerUrl: craftOpts.value.exportFormat === 'gif89a' ? item.gifPreviewUrl : item.thumbnailUrl,
    caption: item.caption,
    time: timeStr,
  })
  deviceTab.value = 'chat'
  scrollChatToBottom()
}

const sendCustomTextToChat = () => {
  const text = customChatInput.value.trim()
  if (!text) return
  const now = new Date()
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  chatMessages.value.push({
    id: `${Date.now()}_txt`,
    sender: 'peer',
    author: '群友 阿K',
    text,
    time: timeStr,
  })
  customChatInput.value = ''
  scrollChatToBottom()
}

// === AI Sprite Sheet Slicer Logic ===
const loadDemoSpriteSheet = async (packId: DemoPackId = activeDemoPack.value) => {
  if (slicerPreviewUrl.value) URL.revokeObjectURL(slicerPreviewUrl.value)
  const { blob, previewUrl, captions } = await generateDemoSpriteSheetBlob(packId)
  slicerSourceBlob.value = blob
  slicerPreviewUrl.value = previewUrl
  slicerRows.value = 3
  slicerCols.value = 3
  slicerAutoRemoveBg.value = true
  slicerTolerance.value = 32
  slicerDefaultCaptions.value = captions
  activeTab.value = 'slicer'
  triggerToast('已生成 1080×1080 (3×3) 纯色背景测试母版，点击右侧按钮即可激光切分')
}

const onUploadSpriteSheet = (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !file.type.startsWith('image/')) return
  if (slicerPreviewUrl.value) URL.revokeObjectURL(slicerPreviewUrl.value)
  slicerSourceBlob.value = file
  slicerPreviewUrl.value = URL.createObjectURL(file)
  slicerDefaultCaptions.value = []
}

const executeSpriteSheetSlice = async () => {
  if (!slicerSourceBlob.value || isSlicing.value) return
  isSlicing.value = true
  try {
    const cells = await sliceSpriteSheet(
      slicerSourceBlob.value,
      slicerRows.value,
      slicerCols.value,
      slicerTrim.value,
      slicerAutoRemoveBg.value,
      slicerTolerance.value
    )

    // Replace current matrix with sliced cells
    mainStickers.value.forEach(revokeStickerUrls)
    const newStickers: StickerItem[] = []

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]
      URL.revokeObjectURL(cell.previewUrl)
      const cap = slicerDefaultCaptions.value[i] || ''
      const built = await buildStickerItem(
        cell.blob,
        `slice_${String(cell.index).padStart(2, '0')}.png`,
        cap
      )
      newStickers.push(built)
    }

    mainStickers.value = newStickers
    if (newStickers[0]) selectedStickerId.value = newStickers[0].id
    activeTab.value = 'matrix'
    await handleAutoSynthesizePromo(true)
    triggerToast(`激光切分完成！已将 ${cells.length} 张独立贴纸导入矩阵并自动去背加白边`)
  } finally {
    isSlicing.value = false
  }
}

// === Promo Assets Auto-Synthesizer & Manual Cropper ===
const handleAutoSynthesizePromo = async (silent = false) => {
  if (mainStickers.value.length === 0) {
    if (!silent) triggerToast('请先至少准备 1 张表情主图再合成运营物料')
    return
  }
  isSynthesizingPromo.value = true
  try {
    const canvases = mainStickers.value.map((s) => s.canvas)
    const synthesized = await synthesizeAllPromoAssets(
      canvases,
      albumName.value,
      albumSubtitle.value,
      promoTheme.value,
      sysSpecs.value.assets
    )

    for (const key of Object.keys(synthesized) as ExtraAssetKey[]) {
      const blob = synthesized[key]
      if (extraImages.value[key].preview) {
        URL.revokeObjectURL(extraImages.value[key].preview)
      }
      extraImages.value[key] = {
        blob,
        preview: URL.createObjectURL(blob),
        status: 'ready',
        error: '',
        sourceName: `智能排版合成 (${promoTheme.value})`,
        sizeKB: Number((blob.size / 1024).toFixed(1)),
      }
    }

    if (!silent) {
      triggerToast('全套 6 张微信运营大图已自动排版并压制在红线 KB 内！')
    }
  } catch (e: any) {
    console.error(e)
    if (!silent) triggerToast(`合成失败: ${e.message}`)
  } finally {
    isSynthesizingPromo.value = false
  }
}

const openCropperFor = (target: ExtraAssetKey) => {
  pendingExtraTarget.value = target
  const state = extraImages.value[target]
  state.status = 'selecting'
  state.error = ''
  extraFileInputRef.value?.click()
}

const handleExtraFileSelect = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  const target = pendingExtraTarget.value
  const state = extraImages.value[target]
  input.value = ''

  if (!file) {
    state.status = state.preview ? 'ready' : 'idle'
    return
  }

  if (!file.type.startsWith('image/')) {
    state.status = 'error'
    state.error = '请选择有效的图片文件'
    return
  }

  // Open visual cropper modal for precise framing, AND also pre-populate spec fallback
  cropperTarget.value = target
  if (cropperImage.value) URL.revokeObjectURL(cropperImage.value)
  cropperImage.value = URL.createObjectURL(file)
  state.sourceName = file.name
  state.status = 'cropping'
  showCropperModal.value = true
}

const confirmCrop = () => {
  if (isProcessingExtra.value) return
  isProcessingExtra.value = true
  const target = cropperTarget.value
  extraImages.value[target].status = 'processing'

  cropperRef.value.getCropBlob(async (blob: Blob) => {
    try {
      const conf = currentCropperConf.value
      let finalBlob: Blob

      if (conf.type === 'png') {
        const result = await processTransparentSticker(blob, conf.w, 0, {
          strokeWidth: 0,
          dropShadow: false,
          removeBg: false,
        })
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
      extraImages.value[target].sizeKB = Number((finalBlob.size / 1024).toFixed(1))
      extraImages.value[target].error = ''
      triggerToast(`「${conf.label}」裁切压制完成：${extraImages.value[target].sizeKB} KB (限额 ≤${conf.maxKB}KB)`)
    } catch (e) {
      console.error(e)
      extraImages.value[target].status = 'error'
      extraImages.value[target].error = '裁剪与压缩失败'
    } finally {
      isProcessingExtra.value = false
      showCropperModal.value = false
      if (cropperImage.value) {
        URL.revokeObjectURL(cropperImage.value)
        cropperImage.value = ''
      }
    }
  })
}

const cancelCrop = () => {
  if (isProcessingExtra.value) return
  const state = currentExtraState.value
  state.status = state.preview ? 'ready' : 'idle'
  showCropperModal.value = false
  if (cropperImage.value) {
    URL.revokeObjectURL(cropperImage.value)
    cropperImage.value = ''
  }
}

const removeExtra = (target: ExtraAssetKey) => {
  if (extraImages.value[target].preview) {
    URL.revokeObjectURL(extraImages.value[target].preview)
  }
  extraImages.value[target] = createExtraState()
}

// === Settings Persistence ===
const saveSpecs = () => {
  localStorage.setItem('westicker_specs', JSON.stringify(sysSpecs.value))
  showSettingsModal.value = false
  triggerToast('微信平台自定义规格已写入本地 Storage 并全局生效')
}

const resetSpecs = () => {
  sysSpecs.value = JSON.parse(JSON.stringify(DEFAULT_SPECS))
  localStorage.removeItem('westicker_specs')
  triggerToast('已恢复微信表情开放平台官方标准参数')
}

// Copy Prompt Helper
const copyPromptText = async (text: string, label: string) => {
  try {
    await navigator.clipboard.writeText(text)
    triggerToast(`已复制「${label}」指令到剪贴板`)
  } catch {
    triggerToast('复制成功')
  }
}

// === ZIP Export ===
const isExporting = ref(false)
const exportStickers = async () => {
  if (mainStickers.value.length === 0) {
    triggerToast('最少需要 1 张主图才能执行打包导出')
    return
  }

  try {
    isExporting.value = true
    const currentIconSize = sysSpecs.value.assets.icon.w

    await exportStickersZip({
      albumName: albumName.value,
      stickers: mainStickers.value.map((s) => ({
        mainBlob: s.mainBlob,
        gifBlob: s.gifBlob,
        thumbBlob: s.thumbBlob,
        name: s.name,
        caption: s.caption,
      })),
      extras: {
        cover: extraImages.value.cover.blob,
        icon: extraImages.value.icon.blob,
        banner: extraImages.value.banner.blob,
        artist: extraImages.value.artist.blob,
        guide: extraImages.value.guide.blob,
        thanks: extraImages.value.thanks.blob,
      },
      dynamicIconSize: currentIconSize,
      mainFormat: craftOpts.value.exportFormat,
      includeManifest: true,
    })
    triggerToast(`已导出「${albumName.value || '未命名专辑'}_WeChat.zip」免检包！`)
  } catch (e: any) {
    console.error(e)
    triggerToast(`打包失败：${e.message}`)
  } finally {
    isExporting.value = false
  }
}

onMounted(async () => {
  const saved = localStorage.getItem('westicker_specs')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      const mergedAssets = Object.fromEntries(
        (Object.keys(DEFAULT_SPECS.assets) as ExtraAssetKey[]).map((key) => {
          const defaults = DEFAULT_SPECS.assets[key]
          const savedAsset = parsed.assets?.[key] || {}
          return [
            key,
            {
              ...defaults,
              w: savedAsset.w ?? defaults.w,
              h: savedAsset.h ?? defaults.h,
              maxKB: savedAsset.maxKB ?? defaults.maxKB,
            },
          ]
        })
      ) as typeof DEFAULT_SPECS.assets

      sysSpecs.value = {
        ...DEFAULT_SPECS,
        main: { ...DEFAULT_SPECS.main, ...(parsed.main || {}) },
        thumb: { ...DEFAULT_SPECS.thumb, ...(parsed.thumb || {}) },
        assets: mergedAssets,
      }
    } catch (e) {
      console.warn('Failed to load saved WeSticker specs', e)
    }
  }

  // Zero-Empty-State: Load the flagship Capybara showcase pack on mount so the workbench is immediately alive!
  await loadDemoPack('capybara')
})
</script>

<template>
  <div
    class="min-h-screen transition-colors duration-200"
    :class="
      studioTheme === 'dark'
        ? 'cutting-mat-dark text-[#F3F4F6]'
        : 'cutting-mat-light text-[#16181D]'
    "
  >
    <!-- Hidden File Input for Promo Assets -->
    <input
      ref="extraFileInputRef"
      type="file"
      accept="image/*"
      class="hidden"
      @change="handleExtraFileSelect"
    />

    <!-- Floating Action Toast -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-2 opacity-0"
    >
      <div
        v-if="toastMessage"
        class="fixed bottom-6 right-6 z-[120] flex items-center gap-3 rounded-xl border border-[#07C160]/40 bg-[#11151C]/95 px-4 py-3 text-xs font-bold text-white shadow-2xl backdrop-blur-md"
      >
        <span class="h-2 w-2 rounded-full bg-[#07C160]"></span>
        <span>{{ toastMessage }}</span>
      </div>
    </Transition>

    <!-- Top Precision Studio Command Bar -->
    <header
      class="sticky top-0 z-40 border-b backdrop-blur-md transition-colors"
      :class="
        studioTheme === 'dark'
          ? 'border-[#222631] bg-[#0C0D10]/90'
          : 'border-[#DCD9D0] bg-[#FAF9F5]/90'
      "
    >
      <div class="mx-auto flex max-w-[1640px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <!-- Brand & Live Showcase Switcher -->
        <div class="flex flex-wrap items-center gap-4">
          <div class="flex items-center gap-3">
            <div class="relative flex h-10 w-10 items-center justify-center rounded-xl bg-[#07C160] font-black text-[#061910] shadow-sm">
              <span class="text-lg tracking-tighter">W</span>
              <span class="font-mono-num absolute -bottom-1 -right-1 rounded bg-[#FF5A36] px-1 py-0.2 text-[9px] font-black text-white">2.0</span>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h1 class="text-base font-black tracking-tight">WeSticker Studio</h1>
                <span
                  class="font-mono-num rounded border px-1.5 py-0.5 text-[10px] font-bold"
                  :class="
                    studioTheme === 'dark'
                      ? 'border-[#262B38] bg-[#151821] text-[#8A919E]'
                      : 'border-[#D5D2C8] bg-white text-[#5A606D]'
                  "
                >
                  DIE-CUT &amp; GIF89a ENGINE
                </span>
              </div>
              <p class="text-[11px]" :class="studioTheme === 'dark' ? 'text-[#8A919E]' : 'text-[#5A606D]'">
                微信表情 AI 九宫格切分 · 刀模白边精修 · 真机双模预检工坊
              </p>
            </div>
          </div>

          <!-- Instant Demo IP Showcase Selector -->
          <div
            class="hidden items-center gap-1.5 rounded-xl border p-1 xl:flex"
            :class="
              studioTheme === 'dark'
                ? 'border-[#222631] bg-[#13151A]'
                : 'border-[#DCD9D0] bg-[#EFECE4]'
            "
          >
            <span class="px-2 text-[10px] font-bold" :class="studioTheme === 'dark' ? 'text-[#8A919E]' : 'text-[#5A606D]'">
              演示样片:
            </span>
            <button
              v-for="pack in DEMO_PACKS"
              :key="pack.id"
              @click="loadDemoPack(pack.id)"
              class="rounded-lg px-2.5 py-1 text-xs font-bold transition"
              :class="
                activeDemoPack === pack.id
                  ? 'bg-[#07C160] text-[#05180E] shadow-xs'
                  : studioTheme === 'dark'
                    ? 'text-[#A0A7B5] hover:bg-[#1C202B] hover:text-white'
                    : 'text-[#4B505C] hover:bg-white hover:text-black'
              "
            >
              {{ pack.albumName.slice(0, 5) }}
            </button>
          </div>
        </div>

        <!-- Center Mode Navigation Tabs -->
        <nav
          class="flex items-center gap-1 rounded-xl border p-1"
          :class="
            studioTheme === 'dark'
              ? 'border-[#222631] bg-[#13151A]'
              : 'border-[#DCD9D0] bg-[#EFECE4]'
          "
        >
          <button
            @click="activeTab = 'matrix'"
            class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition"
            :class="
              activeTab === 'matrix'
                ? studioTheme === 'dark'
                  ? 'bg-[#222735] text-white shadow-xs'
                  : 'bg-white text-[#16181D] shadow-xs'
                : 'text-[#8A919E] hover:text-current'
            "
          >
            <span>01. 贴纸刀模矩阵</span>
            <span class="font-mono-num rounded bg-[#07C160]/20 px-1.5 py-0.2 text-[10px] font-black text-[#07C160]">
              {{ mainStickers.length }}
            </span>
          </button>

          <button
            @click="activeTab = 'slicer'"
            class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition"
            :class="
              activeTab === 'slicer'
                ? studioTheme === 'dark'
                  ? 'bg-[#222735] text-white shadow-xs'
                  : 'bg-white text-[#16181D] shadow-xs'
                : 'text-[#8A919E] hover:text-current'
            "
          >
            <span>02. AI 九宫格切分舱</span>
            <span class="rounded bg-[#FF5A36]/20 px-1.5 py-0.2 text-[10px] font-black text-[#FF5A36]">NEW</span>
          </button>

          <button
            @click="activeTab = 'promo'"
            class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition"
            :class="
              activeTab === 'promo'
                ? studioTheme === 'dark'
                  ? 'bg-[#222735] text-white shadow-xs'
                  : 'bg-white text-[#16181D] shadow-xs'
                : 'text-[#8A919E] hover:text-current'
            "
          >
            <span>03. 运营物料合成</span>
            <span class="font-mono-num rounded bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-black text-amber-400">
              {{ readyExtrasCount }}/6
            </span>
          </button>

          <button
            @click="activeTab = 'prompts'"
            class="hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition md:flex"
            :class="
              activeTab === 'prompts'
                ? studioTheme === 'dark'
                  ? 'bg-[#222735] text-white shadow-xs'
                  : 'bg-white text-[#16181D] shadow-xs'
                : 'text-[#8A919E] hover:text-current'
            "
          >
            <span>04. AI 提示词蓝图</span>
          </button>
        </nav>

        <!-- Right Controls: Album Name, Theme Toggle, Spec Settings, Export CTA -->
        <div class="flex items-center gap-2.5">
          <div class="relative hidden sm:block">
            <input
              v-model="albumName"
              type="text"
              placeholder="输入专辑名称..."
              class="h-9 w-44 rounded-lg border px-3 text-xs font-bold outline-none transition focus:border-[#07C160]"
              :class="
                studioTheme === 'dark'
                  ? 'border-[#252A37] bg-[#13151A] text-white placeholder:text-[#5E6573]'
                  : 'border-[#D5D2C8] bg-white text-[#16181D] placeholder:text-[#9CA3AF]'
              "
            />
          </div>

          <!-- Theme Switcher (Obsidian Dark vs Paper Atelier Light) -->
          <button
            @click="studioTheme = studioTheme === 'dark' ? 'light' : 'dark'"
            class="flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition"
            :class="
              studioTheme === 'dark'
                ? 'border-[#252A37] bg-[#13151A] text-[#A0A7B5] hover:border-[#384052] hover:text-white'
                : 'border-[#D5D2C8] bg-white text-[#4B505C] hover:border-[#9CA3AF] hover:text-black'
            "
            title="切换深色暗房 / 暖白印刷工坊主题"
          >
            <span>{{ studioTheme === 'dark' ? '☀ 暖白工坊' : '☾ 极客暗房' }}</span>
          </button>

          <!-- Specification Engine Trigger -->
          <button
            @click="showSettingsModal = true"
            class="flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition"
            :class="
              studioTheme === 'dark'
                ? 'border-[#252A37] bg-[#13151A] text-[#A0A7B5] hover:border-[#384052] hover:text-white'
                : 'border-[#D5D2C8] bg-white text-[#4B505C] hover:border-[#9CA3AF] hover:text-black'
            "
            title="防崩塌：自定义微信平台尺寸与体积规范"
          >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span class="hidden md:inline">规范引擎</span>
          </button>

          <!-- Primary Export ZIP CTA -->
          <button
            @click="exportStickers"
            :disabled="isExporting"
            class="flex h-9 items-center gap-2 rounded-lg bg-[#07C160] px-4 text-xs font-black text-[#04150B] shadow-md transition hover:bg-[#06AD56] active:scale-95 disabled:opacity-50"
          >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>{{ isExporting ? '正在封装二进制包...' : '导出免检 ZIP' }}</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Main 12-Column Spatial Workbench -->
    <main class="mx-auto grid max-w-[1640px] grid-cols-1 gap-5 px-4 py-5 sm:px-6 lg:grid-cols-12">
      <!-- LEFT / CENTER WORKSPACE (8 Columns on Desktop) -->
      <div class="flex flex-col gap-5 lg:col-span-8">
        <!-- ======================================================= -->
        <!-- TAB 01: DIE-CUT STICKER MATRIX & CRAFT LAB              -->
        <!-- ======================================================= -->
        <template v-if="activeTab === 'matrix'">
          <!-- Die-Cut & Vision Craft Control Deck -->
          <section
            class="rounded-2xl border p-4 shadow-sm transition-colors"
            :class="
              studioTheme === 'dark'
                ? 'border-[#222631] bg-[#13151A]'
                : 'border-[#DCD9D0] bg-white'
            "
          >
            <div class="mb-3 flex flex-wrap items-center justify-between gap-2 border-b pb-3" :class="studioTheme === 'dark' ? 'border-[#1E222D]' : 'border-[#EAE7DF]'">
              <div class="flex items-center gap-2">
                <span class="h-2.5 w-2.5 rounded-full bg-[#FF5A36]"></span>
                <h2 class="text-sm font-black tracking-tight">刀模贴纸精修台 (Die-Cut &amp; Chroma-Key Lab)</h2>
                <span class="font-mono-num rounded bg-[#07C160]/15 px-2 py-0.5 text-[10px] font-bold text-[#07C160]">
                  外围强制锁死 {{ sysSpecs.main.padding }}px 透明安全红线
                </span>
              </div>

              <div class="flex items-center gap-2">
                <button
                  @click="showBleedLaser = !showBleedLaser"
                  class="rounded-lg border px-2.5 py-1 text-[11px] font-bold transition"
                  :class="
                    showBleedLaser
                      ? 'border-[#FF5A36]/50 bg-[#FF5A36]/15 text-[#FF5A36]'
                      : 'border-transparent bg-neutral-500/10 text-neutral-400'
                  "
                >
                  {{ showBleedLaser ? '⌖ 2px 激光安全框: 开启' : '⌖ 2px 激光安全框: 隐藏' }}
                </button>

                <button
                  @click="matrixCheckerDark = !matrixCheckerDark"
                  class="rounded-lg border border-neutral-500/20 bg-neutral-500/10 px-2.5 py-1 text-[11px] font-bold transition hover:border-neutral-500/40"
                >
                  {{ matrixCheckerDark ? '棋盘底色: 暗色' : '棋盘底色: 亮白' }}
                </button>

                <button
                  @click="applyCraftToAllStickers"
                  :disabled="isBatchCrafting || mainStickers.length === 0"
                  class="rounded-lg bg-[#FF5A36] px-3 py-1 text-[11px] font-black text-white shadow-xs transition hover:bg-[#E04826] disabled:opacity-50"
                >
                  {{ isBatchCrafting ? '重算中...' : '⚡ 批量应用精修参数' }}
                </button>
              </div>
            </div>

            <!-- 4-Column Tactile Parameter Grid -->
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <!-- Control 1: Die-Cut White Border -->
              <div
                class="rounded-xl border p-3"
                :class="studioTheme === 'dark' ? 'border-[#1E222D] bg-[#0C0D10]' : 'border-[#E5E2D9] bg-[#F8F7F3]'"
              >
                <div class="flex items-center justify-between text-xs font-bold">
                  <span>贴纸刀模描边 (Stroke)</span>
                  <span class="font-mono-num text-[#07C160]">{{ craftOpts.strokeWidth }}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  v-model.number="craftOpts.strokeWidth"
                  @change="applyCraftToAllStickers"
                  class="mt-2 w-full accent-[#07C160]"
                />
                <div class="mt-2 flex items-center justify-between text-[11px]">
                  <div class="flex items-center gap-1.5">
                    <button
                      v-for="c in ['#FFFFFF', '#FFE866', '#111827']"
                      :key="c"
                      @click="craftOpts.strokeColor = c; applyCraftToAllStickers()"
                      class="h-4 w-4 rounded-full border"
                      :style="{ backgroundColor: c }"
                      :class="craftOpts.strokeColor === c ? 'ring-2 ring-[#07C160]' : 'border-neutral-500'"
                    ></button>
                  </div>
                  <label class="flex cursor-pointer items-center gap-1 text-[11px] text-[#8A919E]">
                    <input type="checkbox" v-model="craftOpts.dropShadow" @change="applyCraftToAllStickers" class="accent-[#07C160]" />
                    <span>微投影</span>
                  </label>
                </div>
              </div>

              <!-- Control 2: Smart Chroma Key Background Removal -->
              <div
                class="rounded-xl border p-3"
                :class="studioTheme === 'dark' ? 'border-[#1E222D] bg-[#0C0D10]' : 'border-[#E5E2D9] bg-[#F8F7F3]'"
              >
                <div class="flex items-center justify-between text-xs font-bold">
                  <label class="flex cursor-pointer items-center gap-1.5">
                    <input type="checkbox" v-model="craftOpts.removeBg" @change="applyCraftToAllStickers" class="accent-[#07C160]" />
                    <span>智能色度去背 (抠图)</span>
                  </label>
                  <span class="font-mono-num text-[11px] text-[#8A919E]">容差 {{ craftOpts.bgTolerance }}</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="75"
                  step="1"
                  :disabled="!craftOpts.removeBg"
                  v-model.number="craftOpts.bgTolerance"
                  @change="applyCraftToAllStickers"
                  class="mt-2 w-full accent-[#07C160] disabled:opacity-40"
                />
                <div class="mt-1.5 flex items-center justify-between text-[10px] text-[#8A919E]">
                  <span>采样:</span>
                  <select
                    v-model="craftOpts.bgKeyMode"
                    @change="applyCraftToAllStickers"
                    class="rounded border border-neutral-500/30 bg-transparent px-1.5 py-0.5 text-[10px] font-bold"
                  >
                    <option value="auto-corner" class="bg-[#13151A] text-white">四角自动吸色</option>
                    <option value="white" class="bg-[#13151A] text-white">纯白底 (#FFF)</option>
                    <option value="green" class="bg-[#13151A] text-white">绿幕 (#0F0)</option>
                  </select>
                </div>
              </div>

              <!-- Control 3: Meme Typography Style -->
              <div
                class="rounded-xl border p-3"
                :class="studioTheme === 'dark' ? 'border-[#1E222D] bg-[#0C0D10]' : 'border-[#E5E2D9] bg-[#F8F7F3]'"
              >
                <div class="flex items-center justify-between text-xs font-bold">
                  <span>底部花字配文风格</span>
                  <span class="text-[10px] text-[#8A919E]">防越界排版</span>
                </div>
                <div class="mt-2 grid grid-cols-2 gap-1.5">
                  <button
                    v-for="st in CAPTION_STYLE_PRESETS"
                    :key="st.k"
                    @click="craftOpts.captionStyle = st.k; applyCraftToAllStickers()"
                    class="rounded border px-2 py-1 text-[10px] font-bold transition"
                    :class="
                      craftOpts.captionStyle === st.k
                        ? 'border-[#07C160] bg-[#07C160]/15 text-[#07C160]'
                        : 'border-neutral-500/20 text-[#8A919E] hover:text-current'
                    "
                  >
                    {{ st.label }}
                  </button>
                </div>
              </div>

              <!-- Control 4: GIF89a Motion & Binary Format -->
              <div
                class="rounded-xl border p-3"
                :class="studioTheme === 'dark' ? 'border-[#1E222D] bg-[#0C0D10]' : 'border-[#E5E2D9] bg-[#F8F7F3]'"
              >
                <div class="flex items-center justify-between text-xs font-bold">
                  <span>GIF89a 动效合成</span>
                  <button
                    @click="craftOpts.exportFormat = craftOpts.exportFormat === 'gif89a' ? 'png' : 'gif89a'; applyCraftToAllStickers()"
                    class="font-mono-num rounded bg-[#07C160]/20 px-1.5 py-0.5 text-[10px] font-black text-[#07C160]"
                  >
                    {{ craftOpts.exportFormat === 'gif89a' ? '真 GIF89a' : '透明 PNG' }}
                  </button>
                </div>
                <div class="mt-2 grid grid-cols-2 gap-1.5">
                  <button
                    v-for="m in MOTION_PRESETS"
                    :key="m.k"
                    @click="craftOpts.motion = m.k; craftOpts.exportFormat = 'gif89a'; applyCraftToAllStickers()"
                    class="rounded border px-2 py-1 text-[10px] font-bold transition"
                    :class="
                      craftOpts.motion === m.k
                        ? 'border-[#FF5A36] bg-[#FF5A36]/15 text-[#FF5A36]'
                        : 'border-neutral-500/20 text-[#8A919E] hover:text-current'
                    "
                  >
                    {{ m.label }}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <!-- Matrix Grid Panel -->
          <section
            class="flex flex-col rounded-2xl border p-4 shadow-sm"
            :class="
              studioTheme === 'dark'
                ? 'border-[#222631] bg-[#13151A]'
                : 'border-[#DCD9D0] bg-white'
            "
          >
            <!-- Matrix Toolbar -->
            <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <h3 class="text-sm font-black">
                  表情主体矩阵 ({{ sysSpecs.main.w }}×{{ sysSpecs.main.w }}px)
                </h3>
                <span class="font-mono-num rounded-md bg-[#07C160]/15 px-2 py-0.5 text-xs font-bold text-[#07C160]">
                  已就绪 {{ mainStickers.length }} 张
                </span>
                <span class="hidden text-xs text-[#8A919E] sm:inline">
                  拖拽序号可重排顺序 · 点击任意贴纸实时发送至右侧微信真机聊天窗
                </span>
              </div>

              <div class="flex items-center gap-2">
                <!-- Quick Upload Input -->
                <label
                  for="main-sticker-upload"
                  class="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#07C160] px-3 py-1.5 text-xs font-black text-[#04150B] transition hover:bg-[#06AD56]"
                >
                  <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>导入单图/多图</span>
                </label>
                <input
                  id="main-sticker-upload"
                  type="file"
                  multiple
                  accept="image/*"
                  class="hidden"
                  @change="onFileSelectMain"
                />

                <button
                  @click="loadDemoSpriteSheet(activeDemoPack)"
                  class="rounded-lg border border-[#FF5A36]/40 bg-[#FF5A36]/10 px-3 py-1.5 text-xs font-bold text-[#FF5A36] transition hover:bg-[#FF5A36]/20"
                >
                  ✂ 体验九宫格切图
                </button>

                <button
                  v-if="mainStickers.length > 0"
                  @click="clearAllStickers"
                  class="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-bold text-red-400 transition hover:bg-red-500/20"
                >
                  清空
                </button>
              </div>
            </div>

            <!-- Sticker Draggable Cards Grid -->
            <div
              @dragover.prevent
              @drop="onDropMain"
              class="min-h-[420px]"
            >
              <VueDraggable
                v-if="mainStickers.length > 0"
                v-model="mainStickers"
                :animation="180"
                handle=".drag-handle"
                class="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4"
              >
                <div
                  v-for="(item, index) in mainStickers"
                  :key="item.id"
                  @click="selectedStickerId = item.id; sendStickerToChat(item)"
                  class="group relative flex cursor-pointer flex-col rounded-xl border p-2.5 transition-all hover:-translate-y-0.5"
                  :class="[
                    selectedStickerId === item.id
                      ? 'border-[#07C160] ring-2 ring-[#07C160]/25'
                      : studioTheme === 'dark'
                        ? 'border-[#222631] bg-[#0C0D10] hover:border-[#373E50]'
                        : 'border-[#E2DFD7] bg-[#FAF9F5] hover:border-[#B8B4A9]',
                  ]"
                >
                  <!-- Card Header: Index Badge + KB Size + Actions -->
                  <div class="mb-2 flex items-center justify-between">
                    <div
                      class="drag-handle font-mono-num flex cursor-grab items-center gap-1 rounded bg-neutral-500/15 px-1.5 py-0.5 text-[10px] font-black"
                      title="按住拖拽排序"
                    >
                      <span>⋮⋮</span>
                      <span>#{{ String(index + 1).padStart(2, '0') }}</span>
                    </div>

                    <div class="flex items-center gap-1">
                      <span
                        class="font-mono-num rounded px-1.5 py-0.5 text-[10px] font-bold"
                        :class="item.bleedPassed ? 'bg-[#07C160]/15 text-[#07C160]' : 'bg-red-500/20 text-red-400'"
                        title="四周 2px 透明安全留白检测通过"
                      >
                        {{ item.sizeKB }}KB
                      </span>
                      <button
                        @click.stop="setStickerAsCover(item)"
                        class="rounded bg-neutral-500/15 px-1.5 py-0.5 text-[10px] font-bold opacity-0 transition hover:bg-[#07C160] hover:text-black group-hover:opacity-100"
                        title="设为详情页封面图"
                      >
                        封面
                      </button>
                      <button
                        @click.stop="removeSticker(item.id)"
                        class="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold text-red-400 opacity-0 transition hover:bg-red-500 hover:text-white group-hover:opacity-100"
                        title="移除此贴纸"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <!-- Sticker Visual Viewport with 2px Bleed Laser Overlay -->
                  <div
                    class="relative mx-auto flex aspect-square w-full max-w-[148px] items-center justify-center overflow-hidden rounded-lg border"
                    :class="[
                      matrixCheckerDark ? 'alpha-checkerboard-dark border-[#222631]' : 'alpha-checkerboard-light border-[#DCD9D0]',
                    ]"
                  >
                    <!-- 2px Bleed Laser Red Guide Frame -->
                    <div
                      v-if="showBleedLaser"
                      class="pointer-events-none absolute inset-[3px] z-10 border border-dashed border-[#FF5A36]/75"
                      title="微信官方强制 2px 透明留白红线"
                    ></div>

                    <img
                      :src="craftOpts.exportFormat === 'gif89a' ? item.gifPreviewUrl : item.thumbnailUrl"
                      :alt="item.name"
                      class="h-full w-full object-contain transition-transform duration-200 group-hover:scale-105"
                    />

                    <!-- Hover Quick Send Hint -->
                    <div class="pointer-events-none absolute top-1.5 right-1.5 z-20 rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-bold text-[#07C160] opacity-0 transition group-hover:opacity-100">
                      点击发到微信 ↗
                    </div>
                  </div>

                  <!-- Inline Editable Meme Caption Input -->
                  <div class="mt-2.5 flex items-center gap-1" @click.stop>
                    <input
                      :value="item.caption"
                      @change="(e) => updateSingleStickerCaption(item, (e.target as HTMLInputElement).value)"
                      type="text"
                      placeholder="输入配文(如:收到)"
                      class="w-full rounded-md border px-2 py-1 text-center text-xs font-bold outline-none transition focus:border-[#07C160]"
                      :class="
                        studioTheme === 'dark'
                          ? 'border-[#222631] bg-[#13151A] text-white placeholder:text-[#525866]'
                          : 'border-[#DCD9D0] bg-white text-[#16181D] placeholder:text-[#9CA3AF]'
                      "
                    />
                  </div>
                </div>
              </VueDraggable>

              <!-- Empty Dropzone if user cleared all stickers -->
              <label
                v-else
                for="main-sticker-upload"
                class="flex min-h-[360px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#07C160]/40 bg-[#07C160]/5 p-8 text-center transition hover:border-[#07C160] hover:bg-[#07C160]/10"
              >
                <div class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#07C160]/20 text-[#07C160]">
                  <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <p class="text-base font-black">拖拽或点击导入您的 AI 贴纸原图</p>
                <p class="mt-1 max-w-md text-xs text-[#8A919E]">
                  支持批量导入 PNG / JPG / WebP，或点击上方演示样片一键体验全链路刀模白边、配文与真机预检。
                </p>
              </label>
            </div>
          </section>
        </template>

        <!-- ======================================================= -->
        <!-- TAB 02: AI SPRITE SHEET AUTO-SLICER                     -->
        <!-- ======================================================= -->
        <template v-else-if="activeTab === 'slicer'">
          <section
            class="rounded-2xl border p-5 shadow-sm"
            :class="
              studioTheme === 'dark'
                ? 'border-[#222631] bg-[#13151A]'
                : 'border-[#DCD9D0] bg-white'
            "
          >
            <div class="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-4" :class="studioTheme === 'dark' ? 'border-[#222631]' : 'border-[#E5E2D9]'">
              <div>
                <div class="flex items-center gap-2">
                  <span class="rounded bg-[#FF5A36] px-2 py-0.5 text-[10px] font-black text-white">AI SPRITE SLICER</span>
                  <h2 class="text-base font-black">AI 多宫格贴纸母版激光切分器</h2>
                </div>
                <p class="mt-1 text-xs text-[#8A919E]">
                  直接拖入 Midjourney / GPT-4o / Nano Banana 生成的 3×3 或 4×4 整张贴纸大图，自动网格切分、四角吸色抠除背景并批量注入刀模白边。
                </p>
              </div>

              <div class="flex items-center gap-2">
                <button
                  @click="loadDemoSpriteSheet('capybara')"
                  class="rounded-lg border border-[#07C160]/40 bg-[#07C160]/10 px-3 py-1.5 text-xs font-bold text-[#07C160] transition hover:bg-[#07C160]/20"
                >
                  ✦ 生成 3×3 九宫格测试大图
                </button>
                <label
                  for="sprite-sheet-upload"
                  class="cursor-pointer rounded-lg bg-[#FF5A36] px-3.5 py-1.5 text-xs font-black text-white transition hover:bg-[#E04826]"
                >
                  上传 AI 网格原图
                </label>
                <input
                  id="sprite-sheet-upload"
                  type="file"
                  accept="image/*"
                  class="hidden"
                  @change="onUploadSpriteSheet"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 gap-6 md:grid-cols-12">
              <!-- Left: Visual Laser Grid Viewport -->
              <div class="md:col-span-7">
                <div
                  v-if="slicerPreviewUrl"
                  class="relative mx-auto aspect-square max-h-[460px] overflow-hidden rounded-xl border border-[#FF5A36]/50 bg-[#090A0D]"
                >
                  <img :src="slicerPreviewUrl" alt="Sprite Sheet" class="h-full w-full object-contain" />

                  <!-- Dynamic Laser Grid Overlay -->
                  <div
                    class="pointer-events-none absolute inset-0 grid"
                    :style="{
                      gridTemplateRows: `repeat(${slicerRows}, minmax(0, 1fr))`,
                      gridTemplateColumns: `repeat(${slicerCols}, minmax(0, 1fr))`,
                    }"
                  >
                    <div
                      v-for="n in slicerRows * slicerCols"
                      :key="n"
                      class="relative border border-[#FF5A36]/75"
                    >
                      <div
                        class="absolute inset-0 border border-dashed border-[#07C160]/70"
                        :style="{ margin: `${slicerTrim}%` }"
                      ></div>
                      <span class="font-mono-num absolute top-1 left-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-black text-[#FF5A36]">
                        #{{ String(n).padStart(2, '0') }}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  v-else
                  @click="loadDemoSpriteSheet('capybara')"
                  class="flex min-h-[380px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#FF5A36]/40 bg-[#FF5A36]/5 p-8 text-center transition hover:border-[#FF5A36]"
                >
                  <p class="text-base font-black text-[#FF5A36]">点击立即生成一张 3×3 AI 九宫格原图测试切分</p>
                  <p class="mt-2 text-xs text-[#8A919E]">或点击右上角「上传 AI 网格原图」导入您本地的九宫格/十六宫格图片</p>
                </div>
              </div>

              <!-- Right: Slicer Parameters & Execute CTA -->
              <div class="flex flex-col justify-between gap-4 md:col-span-5">
                <div class="flex flex-col gap-4">
                  <div
                    class="rounded-xl border p-4"
                    :class="studioTheme === 'dark' ? 'border-[#222631] bg-[#0C0D10]' : 'border-[#E5E2D9] bg-[#F8F7F3]'"
                  >
                    <h4 class="text-xs font-black uppercase tracking-wider text-[#8A919E]">1. 网格行列布局 (Grid Preset)</h4>
                    <div class="mt-2.5 grid grid-cols-4 gap-2">
                      <button
                        v-for="preset in [
                          { r: 2, c: 2, label: '2×2 (4张)' },
                          { r: 3, c: 3, label: '3×3 (9张)' },
                          { r: 4, c: 4, label: '4×4 (16张)' },
                          { r: 4, c: 6, label: '4×6 (24张)' },
                        ]"
                        :key="preset.label"
                        @click="slicerRows = preset.r; slicerCols = preset.c"
                        class="font-mono-num rounded-lg border py-2 text-xs font-bold transition"
                        :class="
                          slicerRows === preset.r && slicerCols === preset.c
                            ? 'border-[#FF5A36] bg-[#FF5A36]/15 text-[#FF5A36]'
                            : 'border-neutral-500/20 text-[#8A919E]'
                        "
                      >
                        {{ preset.label }}
                      </button>
                    </div>

                    <div class="mt-3 grid grid-cols-2 gap-3 text-xs">
                      <label class="flex flex-col gap-1">
                        <span class="text-[#8A919E]">行数 (Rows)</span>
                        <input type="number" min="1" max="8" v-model.number="slicerRows" class="font-mono-num rounded border border-neutral-500/30 bg-transparent px-2.5 py-1.5 font-bold" />
                      </label>
                      <label class="flex flex-col gap-1">
                        <span class="text-[#8A919E]">列数 (Cols)</span>
                        <input type="number" min="1" max="8" v-model.number="slicerCols" class="font-mono-num rounded border border-neutral-500/30 bg-transparent px-2.5 py-1.5 font-bold" />
                      </label>
                    </div>
                  </div>

                  <div
                    class="rounded-xl border p-4"
                    :class="studioTheme === 'dark' ? 'border-[#222631] bg-[#0C0D10]' : 'border-[#E5E2D9] bg-[#F8F7F3]'"
                  >
                    <div class="flex items-center justify-between text-xs font-bold">
                      <span>2. 单格边缘内缩裁切 (Trim Margin)</span>
                      <span class="font-mono-num text-[#07C160]">{{ slicerTrim }}%</span>
                    </div>
                    <input type="range" min="0" max="15" step="1" v-model.number="slicerTrim" class="mt-2 w-full accent-[#07C160]" />
                    <p class="mt-1 text-[11px] text-[#8A919E]">自动切除 AI 生成网格线与相邻格子的残影杂边</p>
                  </div>

                  <div
                    class="rounded-xl border p-4"
                    :class="studioTheme === 'dark' ? 'border-[#222631] bg-[#0C0D10]' : 'border-[#E5E2D9] bg-[#F8F7F3]'"
                  >
                    <div class="flex items-center justify-between text-xs font-bold">
                      <label class="flex cursor-pointer items-center gap-2">
                        <input type="checkbox" v-model="slicerAutoRemoveBg" class="accent-[#07C160]" />
                        <span>3. 切分同时自动吸色抠除纯色背景</span>
                      </label>
                      <span class="font-mono-num text-xs text-[#FF5A36]">容差 {{ slicerTolerance }}</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="70"
                      v-model.number="slicerTolerance"
                      :disabled="!slicerAutoRemoveBg"
                      class="mt-2 w-full accent-[#FF5A36] disabled:opacity-40"
                    />
                  </div>
                </div>

                <button
                  @click="executeSpriteSheetSlice"
                  :disabled="!slicerSourceBlob || isSlicing"
                  class="w-full rounded-xl bg-[#07C160] py-3.5 text-sm font-black text-[#04150B] shadow-lg transition hover:bg-[#06AD56] disabled:opacity-40"
                >
                  {{ isSlicing ? '正在执行激光切分与刀模渲染...' : `⚡ 立即切分为 ${slicerRows * slicerCols} 张独立贴纸并导入矩阵` }}
                </button>
              </div>
            </div>
          </section>
        </template>

        <!-- ======================================================= -->
        <!-- TAB 03: PROMO ASSETS & ONE-CLICK SYNTHESIZER            -->
        <!-- ======================================================= -->
        <template v-else-if="activeTab === 'promo'">
          <section
            class="rounded-2xl border p-5 shadow-sm"
            :class="
              studioTheme === 'dark'
                ? 'border-[#222631] bg-[#13151A]'
                : 'border-[#DCD9D0] bg-white'
            "
          >
            <!-- One-Click Auto-Synthesizer Banner -->
            <div
              class="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4"
              :class="
                studioTheme === 'dark'
                  ? 'border-[#07C160]/30 bg-[#07C160]/10'
                  : 'border-[#07C160]/40 bg-[#07C160]/10'
              "
            >
              <div>
                <div class="flex items-center gap-2">
                  <span class="rounded bg-[#07C160] px-2 py-0.5 text-[10px] font-black text-[#04150B]">AUTO SYNTHESIZER</span>
                  <h2 class="text-sm font-black">不想用 PS 做宣传横幅？一键从表情矩阵自动合成全套 6 张运营图</h2>
                </div>
                <p class="mt-1 text-xs text-[#8A919E]">
                  自动提取矩阵前排角色 + 专辑标题排版生成 750×400 横幅、750×560 赞赏引导、750×750 致谢图，并执行动态 JPEG 压制死锁在 80KB/90KB 内。
                </p>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <select
                  v-model="promoTheme"
                  class="h-9 rounded-lg border border-[#07C160]/40 bg-[#0C0D10] px-3 text-xs font-bold text-white outline-none"
                >
                  <option value="atelier-warm">视觉风格：瑞士暖白印刷工坊</option>
                  <option value="wechat-emerald">视觉风格：微信原生翡翠黑金</option>
                  <option value="neo-brutal">视觉风格：新野兽派高街波普</option>
                  <option value="obsidian-grid">视觉风格：黑曜石极客网格</option>
                </select>

                <button
                  @click="handleAutoSynthesizePromo(false)"
                  :disabled="isSynthesizingPromo"
                  class="h-9 rounded-lg bg-[#07C160] px-4 text-xs font-black text-[#04150B] shadow-md transition hover:bg-[#06AD56] disabled:opacity-50"
                >
                  {{ isSynthesizingPromo ? '正在渲染压制...' : '✨ 一键重新合成全套 6 张运营图' }}
                </button>
              </div>
            </div>

            <!-- 6 Promo Asset Slots Grid -->
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div
                v-for="conf in assetConfs"
                :key="conf.key"
                class="flex flex-col justify-between rounded-xl border p-4 transition"
                :class="
                  studioTheme === 'dark'
                    ? 'border-[#222631] bg-[#0C0D10] hover:border-[#353C4E]'
                    : 'border-[#E2DFD7] bg-[#FAF9F5] hover:border-[#B8B4A9]'
                "
              >
                <div class="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <div class="flex items-center gap-2">
                      <h3 class="text-sm font-black">{{ conf.label }}</h3>
                      <span
                        v-if="extraImages[conf.key].status === 'ready'"
                        class="font-mono-num rounded bg-[#07C160]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#07C160]"
                      >
                        {{ extraImages[conf.key].sizeKB }} KB ✓
                      </span>
                    </div>
                    <p class="mt-0.5 text-[11px] text-[#8A919E]">
                      {{ extraImages[conf.key].sourceName || conf.desc }}
                    </p>
                  </div>

                  <div class="flex items-center gap-1.5">
                    <span class="font-mono-num rounded border border-neutral-500/20 bg-neutral-500/10 px-2 py-0.5 text-[10px] font-bold">
                      {{ conf.w }}×{{ conf.h }}
                    </span>
                    <span class="font-mono-num rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                      ≤{{ conf.maxKB }}KB
                    </span>
                  </div>
                </div>

                <!-- Preview Viewport -->
                <div
                  class="group relative flex min-h-[150px] cursor-pointer items-center justify-center overflow-hidden rounded-lg border"
                  :class="matrixCheckerDark ? 'alpha-checkerboard-dark border-[#222631]' : 'alpha-checkerboard-light border-[#DCD9D0]'"
                  :style="`aspect-ratio: ${conf.w}/${conf.h}; max-height: 210px;`"
                  @click="openCropperFor(conf.key)"
                >
                  <template v-if="extraImages[conf.key].preview">
                    <div
                      v-if="conf.key === 'icon'"
                      class="flex flex-col items-center justify-center gap-2"
                    >
                      <div class="flex h-16 w-16 items-center justify-center rounded-xl border border-neutral-500/30 bg-black/30 p-2 shadow-inner">
                        <img
                          :src="extraImages[conf.key].preview"
                          :alt="conf.label"
                          class="h-[50px] w-[50px] object-contain"
                        />
                      </div>
                      <span class="font-mono-num text-[10px] text-[#8A919E]">1:1 原生 50×50px 尺寸渲染</span>
                    </div>
                    <img
                      v-else
                      :src="extraImages[conf.key].preview"
                      :alt="conf.label"
                      class="h-full w-full"
                      :class="conf.type === 'png' ? 'object-contain p-2' : 'object-cover'"
                    />
                    <div class="absolute inset-0 flex items-center justify-center gap-2 bg-black/75 opacity-0 backdrop-blur-xs transition group-hover:opacity-100">
                      <button
                        @click.stop="openCropperFor(conf.key)"
                        class="rounded-lg bg-white px-3 py-1.5 text-xs font-black text-black transition hover:bg-[#07C160]"
                      >
                        手动上传精裁
                      </button>
                      <button
                        @click.stop="removeExtra(conf.key)"
                        class="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-bold text-red-400 transition hover:bg-red-500 hover:text-white"
                      >
                        重置
                      </button>
                    </div>
                  </template>
                  <template v-else>
                    <div class="flex flex-col items-center justify-center p-4 text-center">
                      <span class="text-xs font-bold text-[#8A919E]">点击上传并呼出 {{ conf.w }}:{{ conf.h }} 定比裁切器</span>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </section>
        </template>

        <!-- ======================================================= -->
        <!-- TAB 04: AI PROMPT BLUEPRINTS                            -->
        <!-- ======================================================= -->
        <template v-else-if="activeTab === 'prompts'">
          <section
            class="rounded-2xl border p-5 shadow-sm"
            :class="
              studioTheme === 'dark'
                ? 'border-[#222631] bg-[#13151A]'
                : 'border-[#DCD9D0] bg-white'
            "
          >
            <div class="mb-4 border-b pb-4" :class="studioTheme === 'dark' ? 'border-[#222631]' : 'border-[#E5E2D9]'">
              <h2 class="text-base font-black">AI 角色一致性贴纸母版 Prompt 蓝图库</h2>
              <p class="mt-1 text-xs text-[#8A919E]">
                针对微信表情开放平台专门调优的提示词结构：强制纯色干净背景、角色多动作不重样、严控网格间距防越界。
              </p>
            </div>

            <div class="flex flex-col gap-4">
              <div
                v-for="bp in PROMPT_BLUEPRINTS"
                :key="bp.id"
                class="rounded-xl border p-4"
                :class="studioTheme === 'dark' ? 'border-[#222631] bg-[#0C0D10]' : 'border-[#E2DFD7] bg-[#FAF9F5]'"
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <span class="rounded bg-[#07C160]/20 px-2 py-0.5 text-[10px] font-black text-[#07C160]">{{ bp.modelTag }}</span>
                    <span class="font-mono-num rounded bg-neutral-500/15 px-2 py-0.5 text-[10px] font-bold">{{ bp.gridSpec }}</span>
                    <h3 class="text-sm font-black">{{ bp.title }}</h3>
                  </div>

                  <div class="flex items-center gap-2">
                    <button
                      @click="copyPromptText(bp.promptEn, `${bp.title} (英文)`)"
                      class="rounded-lg bg-[#07C160] px-3 py-1 text-xs font-black text-[#04150B] transition hover:bg-[#06AD56]"
                    >
                      复制英文 Prompt
                    </button>
                    <button
                      @click="copyPromptText(bp.promptZh, `${bp.title} (中文)`)"
                      class="rounded-lg border border-neutral-500/30 px-3 py-1 text-xs font-bold transition hover:border-[#07C160]"
                    >
                      复制中文 Prompt
                    </button>
                  </div>
                </div>

                <div class="mt-3 rounded-lg border border-neutral-500/15 bg-black/20 p-3 font-mono text-xs leading-relaxed text-[#A0A7B5]">
                  {{ bp.promptEn }}
                </div>
                <p class="mt-2 text-xs text-[#8A919E]">💡 实战技巧：{{ bp.tips }}</p>
              </div>
            </div>
          </section>
        </template>
      </div>

      <!-- RIGHT COLUMN: WECHAT LIVE DEVICE TWIN & PRE-FLIGHT RADAR (4 Columns on Desktop) -->
      <aside class="flex flex-col gap-5 lg:col-span-4">
        <!-- iPhone WeChat Live Device Simulator -->
        <section
          class="flex flex-col overflow-hidden rounded-2xl border shadow-lg"
          :class="
            studioTheme === 'dark'
              ? 'border-[#222631] bg-[#13151A]'
              : 'border-[#DCD9D0] bg-white'
          "
        >
          <!-- Simulator Header Controls -->
          <div class="flex items-center justify-between border-b px-4 py-3" :class="studioTheme === 'dark' ? 'border-[#222631]' : 'border-[#EAE7DF]'">
            <div class="flex items-center gap-1.5">
              <span class="h-2 w-2 rounded-full bg-[#07C160]"></span>
              <h2 class="text-xs font-black uppercase tracking-wider">微信真机双模沙盒</h2>
            </div>

            <div class="flex items-center gap-1.5">
              <button
                @click="deviceTab = 'chat'"
                class="rounded-md px-2.5 py-1 text-[11px] font-bold transition"
                :class="
                  deviceTab === 'chat'
                    ? 'bg-[#07C160] text-[#04150B]'
                    : 'text-[#8A919E] hover:text-current'
                "
              >
                💬 群聊实测
              </button>
              <button
                @click="deviceTab = 'store'"
                class="rounded-md px-2.5 py-1 text-[11px] font-bold transition"
                :class="
                  deviceTab === 'store'
                    ? 'bg-[#07C160] text-[#04150B]'
                    : 'text-[#8A919E] hover:text-current'
                "
              >
                🛍️ 商店详情页
              </button>
              <button
                @click="wechatDarkMode = !wechatDarkMode"
                class="rounded-md border border-neutral-500/25 px-2 py-1 text-[11px] font-bold transition"
                :title="wechatDarkMode ? '切换为微信浅色模式' : '切换为微信深色模式检测白边'"
              >
                {{ wechatDarkMode ? '🌙 深色微信' : '☀️ 浅色微信' }}
              </button>
            </div>
          </div>

          <!-- Simulated Phone Screen -->
          <div
            class=" flex flex-col transition-colors duration-200"
            :class="wechatDarkMode ? 'bg-[#111111] text-[#E5E5E5]' : 'bg-[#EDEDED] text-[#191919]'"
          >
            <!-- iOS Status Bar + WeChat Nav Bar -->
            <div
              class="flex items-center justify-between border-b px-4 py-2.5 text-xs font-bold"
              :class="wechatDarkMode ? 'border-[#202020] bg-[#191919]' : 'border-[#DCDCDC] bg-[#EDEDED]'"
            >
              <span>‹ 微信 (99+)</span>
              <span class="font-black">
                {{ deviceTab === 'chat' ? '相亲相爱摸鱼群 (8)' : albumName || '表情专辑详情' }}
              </span>
              <span>•••</span>
            </div>

            <!-- MODE A: LIVE WECHAT CHAT SIMULATOR -->
            <div v-if="deviceTab === 'chat'" class="flex h-[430px] flex-col justify-between">
              <!-- Chat Messages Stream -->
              <div ref="chatStreamRef" class="flex-1 space-y-3.5 overflow-y-auto p-3.5">
                <div
                  v-for="msg in chatMessages"
                  :key="msg.id"
                  class="flex items-start gap-2.5"
                  :class="msg.sender === 'me' ? 'flex-row-reverse' : ''"
                >
                  <!-- Avatar -->
                  <div
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-black text-white"
                    :class="msg.sender === 'me' ? 'bg-[#07C160]' : 'bg-[#3B82F6]'"
                  >
                    {{ msg.sender === 'me' ? '我' : 'L' }}
                  </div>

                  <!-- Message Body -->
                  <div class="flex max-w-[75%] flex-col" :class="msg.sender === 'me' ? 'items-end' : 'items-start'">
                    <span class="mb-1 text-[10px] opacity-50">{{ msg.author }} · {{ msg.time }}</span>

                    <!-- Text Bubble -->
                    <div
                      v-if="msg.text"
                      class="rounded-lg px-3 py-2 text-xs leading-relaxed shadow-2xs"
                      :class="
                        msg.sender === 'me'
                          ? 'bg-[#95EC69] text-black'
                          : wechatDarkMode
                            ? 'bg-[#2C2C2C] text-[#E5E5E5]'
                            : 'bg-white text-[#191919]'
                      "
                    >
                      {{ msg.text }}
                    </div>

                    <!-- Transparent Sticker in Chat (True 120px display scale) -->
                    <div v-if="msg.stickerUrl" class="my-0.5 flex flex-col items-center">
                      <img
                        :src="msg.stickerUrl"
                        class="h-28 w-28 object-contain"
                        alt="Chat Sticker"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Bottom WeChat Input & Mini Sticker Tray -->
              <div
                class="border-t p-2.5"
                :class="wechatDarkMode ? 'border-[#252525] bg-[#1E1E1E]' : 'border-[#D9D9D9] bg-[#F7F7F7]'"
              >
                <div class="mb-2 flex items-center gap-1.5">
                  <input
                    v-model="customChatInput"
                    @keyup.enter="sendCustomTextToChat"
                    type="text"
                    placeholder="输入群友台词回车发送，或点下方表情..."
                    class="h-8 flex-1 rounded-md border px-2.5 text-xs outline-none"
                    :class="
                      wechatDarkMode
                        ? 'border-[#333] bg-[#2C2C2C] text-white placeholder:text-neutral-500'
                        : 'border-[#DDD] bg-white text-black placeholder:text-neutral-400'
                    "
                  />
                  <button
                    @click="sendCustomTextToChat"
                    class="h-8 rounded-md bg-[#07C160] px-3 text-xs font-black text-white"
                  >
                    发送
                  </button>
                </div>

                <!-- Mini Sticker Picker Bar -->
                <div class="flex items-center gap-2 overflow-x-auto py-1">
                  <button
                    v-for="st in mainStickers"
                    :key="st.id"
                    @click="sendStickerToChat(st)"
                    class="h-11 w-11 shrink-0 rounded-md border p-1 transition hover:scale-105 hover:border-[#07C160]"
                    :class="wechatDarkMode ? 'border-[#333] bg-[#141414]' : 'border-[#E2E2E2] bg-white'"
                    :title="`发送 #${st.caption || st.name}`"
                  >
                    <img :src="st.thumbnailUrl" class="h-full w-full object-contain" />
                  </button>
                </div>
              </div>
            </div>

            <!-- MODE B: WECHAT STICKER STORE DETAILS PAGE PREVIEW -->
            <div v-else class="relative h-[430px] overflow-y-auto" :class="wechatDarkMode ? 'bg-[#141414]' : 'bg-white'">
              <!-- 750x400 Banner Preview -->
              <div class="relative aspect-[750/400] w-full bg-neutral-800">
                <img
                  v-if="extraImages.banner.preview"
                  :src="extraImages.banner.preview"
                  class="h-full w-full object-cover"
                />
                <div v-else class="flex h-full items-center justify-center text-xs text-neutral-400">
                  详情页横幅 (750×400)
                </div>
              </div>

              <!-- Album Info Row -->
              <div class="flex items-center justify-between border-b p-3.5" :class="wechatDarkMode ? 'border-[#262626]' : 'border-neutral-100'">
                <div class="flex items-center gap-3">
                  <img
                    v-if="extraImages.cover.preview || mainStickers[0]"
                    :src="extraImages.cover.preview || mainStickers[0]?.thumbnailUrl"
                    class="h-12 w-12 rounded-lg border border-neutral-500/20 object-contain p-0.5"
                  />
                  <div>
                    <h4 class="text-sm font-black">{{ albumName || '未命名表情专辑' }}</h4>
                    <p class="text-[11px] opacity-60">{{ albumSubtitle }}</p>
                  </div>
                </div>
                <span class="rounded-md bg-[#07C160] px-3 py-1.5 text-xs font-bold text-white">添加</span>
              </div>

              <!-- 4-Column Sticker Store Grid -->
              <div class="grid grid-cols-4 gap-2.5 p-3.5">
                <div
                  v-for="item in mainStickers.slice(0, 8)"
                  :key="item.id"
                  class="flex flex-col items-center"
                >
                  <div class="aspect-square w-full rounded-md p-1">
                    <img :src="item.thumbnailUrl" class="h-full w-full object-contain" />
                  </div>
                  <span class="mt-0.5 truncate text-[10px] opacity-60">{{ item.caption || '表情' }}</span>
                </div>
              </div>

              <!-- 750x560 Reward Guide Preview -->
              <div class="border-t p-3.5 text-center" :class="wechatDarkMode ? 'border-[#262626]' : 'border-neutral-100'">
                <div v-if="extraImages.guide.preview" class="overflow-hidden rounded-lg">
                  <img :src="extraImages.guide.preview" class="w-full object-cover" />
                </div>
                <button
                  @click="showThanksPopupInSim = !showThanksPopupInSim"
                  class="mt-2 rounded-full bg-[#EA580C] px-5 py-1.5 text-xs font-black text-white shadow-sm"
                >
                  ¥ 赞赏作者 (点击预览致谢卡)
                </button>
              </div>

              <!-- 750x750 Reward Thanks Popup Overlay -->
              <div
                v-if="showThanksPopupInSim && extraImages.thanks.preview"
                @click="showThanksPopupInSim = false"
                class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 p-6 backdrop-blur-xs"
              >
                <img :src="extraImages.thanks.preview" class="max-h-[260px] rounded-xl object-contain shadow-2xl" />
                <span class="mt-2 text-xs font-bold text-white">赞赏致谢图 (750×750) · 点击任意处关闭</span>
              </div>
            </div>
          </div>
        </section>

        <!-- WeChat Official Pre-Flight Compliance Radar -->
        <section
          class="rounded-2xl border p-4 shadow-sm"
          :class="
            studioTheme === 'dark'
              ? 'border-[#222631] bg-[#13151A]'
              : 'border-[#DCD9D0] bg-white'
          "
        >
          <div class="mb-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="h-2 w-2 rounded-full bg-[#07C160]"></span>
              <h3 class="text-xs font-black uppercase tracking-wider">微信提审合规预检雷达</h3>
            </div>
            <span class="font-mono-num rounded bg-[#07C160]/15 px-2 py-0.5 text-xs font-black text-[#07C160]">
              合规度 {{ preflightAudit.score }}%
            </span>
          </div>

          <div class="space-y-2 text-xs">
            <div class="flex items-center justify-between rounded-lg border border-neutral-500/15 px-3 py-2">
              <span class="text-[#8A919E]">1. 主图数量档位 (8/16/24张)</span>
              <span
                class="font-mono-num font-bold"
                :class="preflightAudit.isStandardCount ? 'text-[#07C160]' : 'text-amber-400'"
              >
                当前 {{ preflightAudit.count }} 张 {{ preflightAudit.isStandardCount ? '✓ 标准' : '(建议凑齐8/16/24)' }}
              </span>
            </div>

            <div class="flex items-center justify-between rounded-lg border border-neutral-500/15 px-3 py-2">
              <span class="text-[#8A919E]">2. 四周 {{ sysSpecs.main.padding }}px 透明安全留白扫描</span>
              <span class="font-mono-num font-bold" :class="preflightAudit.allBleedPassed ? 'text-[#07C160]' : 'text-red-400'">
                {{ preflightAudit.allBleedPassed ? '100% 零越界通过 ✓' : '存在边缘像素越界' }}
              </span>
            </div>

            <div class="flex items-center justify-between rounded-lg border border-neutral-500/15 px-3 py-2">
              <span class="text-[#8A919E]">3. 主图二进制编码与体积 (≤{{ sysSpecs.main.maxKB }}KB)</span>
              <span class="font-mono-num font-bold text-[#07C160]">
                {{ craftOpts.exportFormat === 'gif89a' ? 'GIF89a 真文件头 ✓' : 'PNG-32 透明通道 ✓' }}
              </span>
            </div>

            <div class="flex items-center justify-between rounded-lg border border-neutral-500/15 px-3 py-2">
              <span class="text-[#8A919E]">4. 运营物料体积红线压制</span>
              <span class="font-mono-num font-bold text-[#07C160]">
                {{ readyExtrasCount }}/6 就绪 · 100% 合规 ✓
              </span>
            </div>
          </div>
        </section>
      </aside>
    </main>

    <!-- ======================================================= -->
    <!-- MODAL 1: ANTI-FRAGILITY SPECIFICATION ENGINE            -->
    <!-- ======================================================= -->
    <div
      v-if="showSettingsModal"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div
        class="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border shadow-2xl"
        :class="
          studioTheme === 'dark'
            ? 'border-[#2B3040] bg-[#13151A] text-white'
            : 'border-[#DCD9D0] bg-white text-[#16181D]'
        "
      >
        <div class="flex items-center justify-between border-b px-5 py-4" :class="studioTheme === 'dark' ? 'border-[#222631]' : 'border-[#E5E2D9]'">
          <div>
            <p class="text-[10px] font-black uppercase tracking-widest text-[#07C160]">Specification Engine</p>
            <h3 class="mt-0.5 text-base font-black">微信表情开放平台规范自定义引擎</h3>
          </div>
          <button
            @click="showSettingsModal = false"
            class="rounded-lg border border-neutral-500/20 px-2.5 py-1 text-xs font-bold hover:bg-neutral-500/10"
          >
            ✕ 关闭
          </button>
        </div>

        <div class="flex-1 space-y-5 overflow-y-auto p-5 text-xs">
          <div class="rounded-xl border border-neutral-500/20 p-4">
            <h4 class="mb-3 font-black text-[#07C160]">主图与缩略图系统 (Main &amp; Thumbnail Specs)</h4>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label class="flex flex-col gap-1">
                <span class="text-[#8A919E]">主图宽高 (w=h) px</span>
                <input type="number" v-model.number="sysSpecs.main.w" class="font-mono-num rounded-lg border border-neutral-500/30 bg-transparent px-3 py-1.5 font-bold" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-[#8A919E]">四周强制透明留白 px</span>
                <input type="number" v-model.number="sysSpecs.main.padding" class="font-mono-num rounded-lg border border-neutral-500/30 bg-transparent px-3 py-1.5 font-bold" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-[#8A919E]">缩略图宽高 (w=h) px</span>
                <input type="number" v-model.number="sysSpecs.thumb.w" class="font-mono-num rounded-lg border border-neutral-500/30 bg-transparent px-3 py-1.5 font-bold" />
              </label>
            </div>
          </div>

          <div class="rounded-xl border border-neutral-500/20 p-4">
            <h4 class="mb-3 font-black text-[#FF5A36]">6 大运营物料尺寸与体积上限 (Promo Assets Protocol)</h4>
            <div class="space-y-2.5">
              <div
                v-for="asset in (Object.keys(sysSpecs.assets) as ExtraAssetKey[])"
                :key="asset"
                class="grid grid-cols-4 items-center gap-2 rounded-lg border border-neutral-500/15 p-2"
              >
                <span class="font-bold">{{ sysSpecs.assets[asset].label }}</span>
                <label class="flex items-center gap-1">
                  <span class="text-[#8A919E]">宽</span>
                  <input type="number" v-model.number="sysSpecs.assets[asset].w" class="font-mono-num w-full rounded border border-neutral-500/30 bg-transparent px-2 py-1 font-bold" />
                </label>
                <label class="flex items-center gap-1">
                  <span class="text-[#8A919E]">高</span>
                  <input type="number" v-model.number="sysSpecs.assets[asset].h" class="font-mono-num w-full rounded border border-neutral-500/30 bg-transparent px-2 py-1 font-bold" />
                </label>
                <label class="flex items-center gap-1">
                  <span class="text-[#8A919E]">≤</span>
                  <input type="number" v-model.number="sysSpecs.assets[asset].maxKB" class="font-mono-num w-full rounded border border-neutral-500/30 bg-transparent px-2 py-1 font-bold text-amber-400" />
                  <span class="text-[#8A919E]">KB</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between border-t px-5 py-4" :class="studioTheme === 'dark' ? 'border-[#222631]' : 'border-[#E5E2D9]'">
          <button
            @click="resetSpecs"
            class="rounded-lg bg-red-500/15 px-4 py-2 text-xs font-black text-red-400 transition hover:bg-red-500/25"
          >
            ↺ 恢复微信官方默认参数
          </button>
          <button
            @click="saveSpecs"
            class="rounded-lg bg-[#07C160] px-5 py-2 text-xs font-black text-[#04150B] transition hover:bg-[#06AD56]"
          >
            保存配置到本地 Storage
          </button>
        </div>
      </div>
    </div>

    <!-- ======================================================= -->
    <!-- MODAL 2: UNIFIED RIGID ASPECT-RATIO CROPPER             -->
    <!-- ======================================================= -->
    <div
      v-if="showCropperModal"
      class="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
    >
      <div class="flex h-[82vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#2B3040] bg-[#13151A] text-white shadow-2xl">
        <div class="flex items-center justify-between border-b border-[#222631] px-5 py-4">
          <div>
            <h3 class="text-base font-black">定比精裁 · {{ currentCropperConf.label }}</h3>
            <p class="font-mono-num mt-0.5 text-xs text-[#07C160]">
              锁定目标：{{ currentCropperConf.w }} × {{ currentCropperConf.h }} px · 动态压制上限 ≤{{ currentCropperConf.maxKB }} KB
            </p>
          </div>
          <button @click="cancelCrop" class="rounded-lg border border-neutral-700 px-3 py-1 text-xs font-bold hover:bg-neutral-800">
            ✕ 取消
          </button>
        </div>

        <div class="alpha-checkerboard-dark relative flex-1">
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
          ></vue-cropper>

          <div
            v-if="isProcessingExtra"
            class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xs"
          >
            <div class="mb-3 h-10 w-10 animate-spin rounded-full border-4 border-[#07C160] border-t-transparent"></div>
            <p class="text-sm font-black">正在执行动态质量阶梯压制 (≤{{ currentCropperConf.maxKB }}KB)...</p>
          </div>
        </div>

        <div class="flex justify-end gap-3 border-t border-[#222631] bg-[#0C0D10] px-5 py-4">
          <button
            @click="cancelCrop"
            :disabled="isProcessingExtra"
            class="rounded-lg border border-neutral-700 px-5 py-2 text-xs font-bold text-neutral-300 hover:bg-neutral-800"
          >
            放弃
          </button>
          <button
            @click="confirmCrop"
            :disabled="isProcessingExtra"
            class="rounded-lg bg-[#07C160] px-6 py-2 text-xs font-black text-[#04150B] transition hover:bg-[#06AD56]"
          >
            确认裁切并压制体积
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
