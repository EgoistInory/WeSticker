/**
 * Procedural Vector-Canvas IP Character Generator & Demo Sprite Sheet Synthesizer
 * Provides an instant, zero-empty-state interactive showcase experience on page load or 1-click trigger.
 */

export type DemoPackId = 'capybara' | 'cybershiba' | 'inkcat' | 'panda';

export interface DemoPackMeta {
  id: DemoPackId;
  albumName: string;
  subtitle: string;
  badge: string;
  accent: string;
  expressions: {
    name: string;
    caption: string;
    mood: 'happy' | 'chill' | 'shock' | 'cool' | 'love' | 'rage' | 'sleep' | 'rich';
  }[];
}

export const DEMO_PACKS: DemoPackMeta[] = [
  {
    id: 'capybara',
    albumName: '佛系打工豚日常',
    subtitle: '精神状态极度稳定的职场护身符',
    badge: '热门 IP 样片',
    accent: '#FF5A36',
    expressions: [
      { name: '01_收到', caption: '收到!', mood: 'happy' },
      { name: '02_情绪稳定', caption: '情绪稳定', mood: 'chill' },
      { name: '03_摸鱼中', caption: '带薪摸鱼', mood: 'sleep' },
      { name: '04_包的', caption: '包的!', mood: 'cool' },
      { name: '05_CPU烧了', caption: 'CPU干烧', mood: 'shock' },
      { name: '06_准点下班', caption: '光速下班', mood: 'love' },
      { name: '07_打钱', caption: '搞快打钱', mood: 'rich' },
      { name: '08_勿cue', caption: '已老实', mood: 'rage' },
    ],
  },
  {
    id: 'cybershiba',
    albumName: '赛博程序员阿柴',
    subtitle: '专治各种需求变更与线上告警',
    badge: '极客联名款',
    accent: '#07C160',
    expressions: [
      { name: '01_LGTM', caption: 'LGTM', mood: 'cool' },
      { name: '02_本地能跑', caption: '我这能跑', mood: 'chill' },
      { name: '03_线上崩了', caption: 'P0告警!', mood: 'shock' },
      { name: '04_在改了', caption: '在改了!', mood: 'happy' },
      { name: '05_加需求', caption: '又改需求?', mood: 'rage' },
      { name: '06_发版成功', caption: '0报错发版', mood: 'love' },
      { name: '07_年终奖', caption: '暴富自由', mood: 'rich' },
      { name: '08_关机休眠', caption: '拒绝加班', mood: 'sleep' },
    ],
  },
  {
    id: 'inkcat',
    albumName: '傲娇玄猫大王',
    subtitle: '高冷喵星人的全方位社交嘴替',
    badge: '国潮插画风',
    accent: '#F59E0B',
    expressions: [
      { name: '01_贴贴', caption: '贴贴~', mood: 'love' },
      { name: '02_暗中观察', caption: '盯——', mood: 'chill' },
      { name: '03_就这', caption: '就这?', mood: 'cool' },
      { name: '04_气鼓鼓', caption: '哄不好了', mood: 'rage' },
      { name: '05_投喂我', caption: '快投喂!', mood: 'happy' },
      { name: '06_瞳孔地震', caption: '大震惊!', mood: 'shock' },
      { name: '07_招财猫', caption: '日进斗金', mood: 'rich' },
      { name: '08_困成猫饼', caption: '晚安玛卡', mood: 'sleep' },
    ],
  },
  {
    id: 'panda',
    albumName: '魔性打工熊猫滚滚',
    subtitle: '纯白脸部防抠穿特调 · 专治各种职场内耗',
    badge: '白脸护盾实测',
    accent: '#10B981',
    expressions: [
      { name: '01_收到', caption: '收到!', mood: 'happy' },
      { name: '02_吃竹摸鱼', caption: '吃瓜看戏', mood: 'chill' },
      { name: '03_礼貌微笑', caption: '你礼貌吗', mood: 'cool' },
      { name: '04_抱大腿', caption: '富婆贴贴', mood: 'love' },
      { name: '05_黑眼圈加重', caption: '熬夜肝图', mood: 'shock' },
      { name: '06_掀桌', caption: '不干了!', mood: 'rage' },
      { name: '07_竹笋暴富', caption: '搞快打钱', mood: 'rich' },
      { name: '08_躺平', caption: '彻底躺平', mood: 'sleep' },
    ],
  },
];

/**
 * Draws a rich, high-res character illustration on a transparent or solid canvas
 */
function drawCharacterIllustration(
  ctx: CanvasRenderingContext2D,
  size: number,
  packId: DemoPackId,
  mood: DemoPackMeta['expressions'][number]['mood'],
  solidBackground?: string
) {
  ctx.clearRect(0, 0, size, size);
  if (solidBackground) {
    ctx.fillStyle = solidBackground;
    ctx.fillRect(0, 0, size, size);
  }

  const cx = size / 2;
  const cy = size / 2 - size * 0.02;
  const r = size * 0.31;

  ctx.save();

  // Character palette
  let bodyFill = '#C68B59';
  let bodyStroke = '#3E2723';
  let snoutFill = '#A16638';
  let blushColor = 'rgba(255, 107, 107, 0.55)';

  if (packId === 'cybershiba') {
    bodyFill = '#F4A261';
    bodyStroke = '#1D2432';
    snoutFill = '#FFF8F0';
    blushColor = 'rgba(255, 90, 54, 0.5)';
  } else if (packId === 'inkcat') {
    bodyFill = '#2B2D42';
    bodyStroke = '#0F111A';
    snoutFill = '#434663';
    blushColor = 'rgba(244, 114, 182, 0.6)';
  } else if (packId === 'panda') {
    bodyFill = '#FFFFFF';
    bodyStroke = '#141619';
    snoutFill = '#F4F4F6';
    blushColor = 'rgba(255, 115, 140, 0.58)';
  }

  ctx.lineWidth = Math.max(5, size * 0.026);
  ctx.strokeStyle = bodyStroke;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Ears
  if (packId === 'capybara' || packId === 'panda') {
    // Round ears (black for panda, brown for capybara)
    for (const dir of [-1, 1]) {
      ctx.fillStyle = packId === 'panda' ? '#141619' : snoutFill;
      ctx.beginPath();
      ctx.ellipse(
        cx + dir * r * 0.72,
        cy - r * 0.72,
        r * (packId === 'panda' ? 0.28 : 0.22),
        r * (packId === 'panda' ? 0.26 : 0.16),
        dir * 0.4,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.stroke();
    }
  } else {
    // Pointed Shiba / Cat ears
    for (const dir of [-1, 1]) {
      ctx.fillStyle = bodyFill;
      ctx.beginPath();
      ctx.moveTo(cx + dir * r * 0.32, cy - r * 0.65);
      ctx.lineTo(cx + dir * r * 0.92, cy - r * 1.15);
      ctx.lineTo(cx + dir * r * 0.88, cy - r * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner ear
      ctx.fillStyle = packId === 'inkcat' ? '#F472B6' : '#FFE3D3';
      ctx.beginPath();
      ctx.moveTo(cx + dir * r * 0.44, cy - r * 0.64);
      ctx.lineTo(cx + dir * r * 0.80, cy - r * 0.98);
      ctx.lineTo(cx + dir * r * 0.78, cy - r * 0.38);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Torso / Shoulders
  ctx.fillStyle = packId === 'cybershiba' ? '#07C160' : packId === 'inkcat' ? '#E11D48' : '#3B82F6';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.88, r * 0.78, r * 0.42, 0, Math.PI, Math.PI * 2, true);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Main Head (Squircle / Chubby cheeks)
  ctx.fillStyle = bodyFill;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.98, r * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Snout / Muzzle patch
  ctx.fillStyle = snoutFill;
  ctx.beginPath();
  if (packId === 'capybara') {
    ctx.ellipse(cx, cy + r * 0.14, r * 0.48, r * 0.36, 0, 0, Math.PI * 2);
  } else {
    ctx.ellipse(cx, cy + r * 0.22, r * 0.56, r * 0.38, 0, 0, Math.PI * 2);
  }
  ctx.fill();
  if (packId === 'capybara') ctx.stroke();

  // Blush cheeks
  ctx.fillStyle = blushColor;
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.62, cy + r * 0.15, r * 0.16, r * 0.1, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + r * 0.62, cy + r * 0.15, r * 0.16, r * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  // Iconic Black Eye Patches for Panda
  if (packId === 'panda') {
    ctx.fillStyle = '#181A1F';
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + dir * r * 0.42, cy - r * 0.14, r * 0.23, r * 0.18, dir * -0.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Eyes & Facial Expressions by Mood
  const eyeY = cy - r * 0.16;
  const eyeOffsetX = r * 0.44;
  ctx.strokeStyle = packId === 'inkcat' ? '#FBBF24' : packId === 'panda' ? '#FFFFFF' : bodyStroke;
  ctx.fillStyle = packId === 'inkcat' ? '#FBBF24' : packId === 'panda' ? '#FFFFFF' : bodyStroke;

  if (mood === 'chill' || mood === 'sleep') {
    // Calm horizontal dash eyes
    ctx.lineWidth = Math.max(5, size * 0.028);
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + dir * eyeOffsetX - r * 0.15, eyeY);
      ctx.lineTo(cx + dir * eyeOffsetX + r * 0.15, eyeY);
      ctx.stroke();
    }
    // Cute Tangerine / Bubble on head
    if (mood === 'chill') {
      ctx.fillStyle = '#FF9F1C';
      ctx.strokeStyle = bodyStroke;
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.96, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#2EC4B6';
      ctx.beginPath();
      ctx.ellipse(cx + r * 0.08, cy - r * 1.18, r * 0.12, r * 0.06, -0.4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Sleep snot bubble
      ctx.fillStyle = 'rgba(125, 211, 252, 0.78)';
      ctx.strokeStyle = '#0284C7';
      ctx.beginPath();
      ctx.arc(cx + r * 0.42, cy + r * 0.05, r * 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else if (mood === 'happy' || mood === 'love') {
    // Happy curved arcs or hearts
    for (const dir of [-1, 1]) {
      const ex = cx + dir * eyeOffsetX;
      if (mood === 'love') {
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(ex - r * 0.06, eyeY, r * 0.09, 0, Math.PI * 2);
        ctx.arc(ex + r * 0.06, eyeY, r * 0.09, 0, Math.PI * 2);
        ctx.moveTo(ex - r * 0.14, eyeY + r * 0.03);
        ctx.lineTo(ex, eyeY + r * 0.2);
        ctx.lineTo(ex + r * 0.14, eyeY + r * 0.03);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(ex, eyeY + r * 0.05, r * 0.14, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
    }
  } else if (mood === 'cool') {
    // Pixel / Aviator Sunglasses
    ctx.fillStyle = '#111827';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.fillRect(cx - r * 0.72, eyeY - r * 0.14, r * 0.58, r * 0.28);
    ctx.fillRect(cx + r * 0.14, eyeY - r * 0.14, r * 0.58, r * 0.28);
    ctx.fillRect(cx - r * 0.16, eyeY - r * 0.08, r * 0.32, r * 0.08);
    // Specular glint
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(cx - r * 0.62, eyeY - r * 0.08, r * 0.12, r * 0.16);
    ctx.fillRect(cx + r * 0.24, eyeY - r * 0.08, r * 0.12, r * 0.16);
  } else if (mood === 'shock') {
    // Wide shocked eyes + sweat drop
    for (const dir of [-1, 1]) {
      const ex = cx + dir * eyeOffsetX;
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = bodyStroke;
      ctx.beginPath();
      ctx.arc(ex, eyeY, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(ex, eyeY, r * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
    // Blue sweat drop
    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.arc(cx + r * 0.78, cy - r * 0.28, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
  } else if (mood === 'rage') {
    // Angry slanted brows + fiery eyes
    for (const dir of [-1, 1]) {
      const ex = cx + dir * eyeOffsetX;
      ctx.fillStyle = packId === 'inkcat' ? '#FBBF24' : '#111827';
      ctx.beginPath();
      ctx.arc(ex, eyeY + r * 0.03, r * 0.11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = bodyStroke;
      ctx.lineWidth = Math.max(5, size * 0.028);
      ctx.beginPath();
      ctx.moveTo(ex - dir * r * 0.16, eyeY - r * 0.08);
      ctx.lineTo(ex + dir * r * 0.18, eyeY - r * 0.22);
      ctx.stroke();
    }
  } else if (mood === 'rich') {
    // Sparkle coin eyes
    ctx.fillStyle = '#F59E0B';
    ctx.strokeStyle = '#78350F';
    for (const dir of [-1, 1]) {
      const ex = cx + dir * eyeOffsetX;
      ctx.beginPath();
      ctx.arc(ex, eyeY, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FEF3C7';
      ctx.font = `900 ${Math.round(r * 0.24)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('¥', ex, eyeY + 1);
      ctx.fillStyle = '#F59E0B';
    }
  }

  // Nose & Mouth
  ctx.strokeStyle = bodyStroke;
  ctx.fillStyle = bodyStroke;
  ctx.lineWidth = Math.max(4, size * 0.022);
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.06, r * 0.06, 0, Math.PI * 2);
  ctx.fill();

  if (mood === 'shock') {
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.26, r * 0.12, r * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    // Cute W mouth
    ctx.beginPath();
    ctx.arc(cx - r * 0.09, cy + r * 0.16, r * 0.09, 0, Math.PI);
    ctx.arc(cx + r * 0.09, cy + r * 0.16, r * 0.09, 0, Math.PI);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Generates raw PNG Blobs for a chosen Demo IP Pack so it can be run through the full WeSticker Studio pipeline.
 */
export async function generateDemoPackRawBlobs(
  packId: DemoPackId
): Promise<{
  meta: DemoPackMeta;
  items: { name: string; caption: string; rawBlob: Blob }[];
}> {
  const meta = DEMO_PACKS.find((p) => p.id === packId) || DEMO_PACKS[0];
  const items: { name: string; caption: string; rawBlob: Blob }[] = [];

  for (const exp of meta.expressions) {
    const canvas = document.createElement('canvas');
    canvas.width = 360;
    canvas.height = 360;
    const ctx = canvas.getContext('2d')!;
    drawCharacterIllustration(ctx, 360, meta.id, exp.mood);

    const rawBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Demo blob failed'))), 'image/png');
    });
    items.push({
      name: `${exp.name}.png`,
      caption: exp.caption,
      rawBlob,
    });
  }

  return { meta, items };
}

/**
 * Generates a 3x3 (1080x1080) AI-Style Sprite Sheet with a solid cream background (#F6F3E9)
 * so users can test the "AI 大图智能切分 + 自动色度抠图" workflow with 1 click!
 */
export async function generateDemoSpriteSheetBlob(packId: DemoPackId = 'capybara'): Promise<{
  blob: Blob;
  previewUrl: string;
  captions: string[];
}> {
  const meta = DEMO_PACKS.find((p) => p.id === packId) || DEMO_PACKS[0];
  const sheetSize = 1080;
  const cellSize = 360;
  const canvas = document.createElement('canvas');
  canvas.width = sheetSize;
  canvas.height = sheetSize;
  const ctx = canvas.getContext('2d')!;

  // Solid warm cream background typical of Midjourney / GPT-4o sticker sheet outputs
  ctx.fillStyle = '#F6F3E9';
  ctx.fillRect(0, 0, sheetSize, sheetSize);

  const moods: DemoPackMeta['expressions'][number]['mood'][] = [
    'happy', 'chill', 'cool',
    'love', 'shock', 'rich',
    'rage', 'sleep', 'happy',
  ];
  const captions = [
    ...meta.expressions.map((e) => e.caption),
    '冲鸭!',
  ];

  const cellCanvas = document.createElement('canvas');
  cellCanvas.width = cellSize;
  cellCanvas.height = cellSize;
  const cellCtx = cellCanvas.getContext('2d')!;

  for (let i = 0; i < 9; i++) {
    const r = Math.floor(i / 3);
    const c = i % 3;
    const bgHex = packId === 'panda' ? '#FFFFFF' : '#F6F3E9';
    drawCharacterIllustration(cellCtx, cellSize, meta.id, moods[i], bgHex);

    // For panda test sheet: simulate a realistic 3px broken line-art gap on #1 (i===0) and #3 (i===2)
    // to prove that our Morphological Gap-Closing + Interior White-Face Shield prevents face hollowing!
    if (packId === 'panda' && (i === 0 || i === 2)) {
      cellCtx.fillStyle = '#FFFFFF';
      cellCtx.fillRect(cellSize / 2 - 2, cellSize * 0.21, 4, 16);
    }

    ctx.drawImage(cellCanvas, c * cellSize, r * cellSize);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Sprite sheet failed'))), 'image/png');
  });

  return {
    blob,
    previewUrl: URL.createObjectURL(blob),
    captions,
  };
}

/**
 * Curated AI Prompt Blueprints & Interactive AI Co-Pilot Compiler for generating WeChat-ready Sticker Sheets
 */
export type AIModelPlatform = 'doubao' | 'nano-banana' | 'gpt4o' | 'midjourney' | 'local-flux';
export type BgColorStrategy = 'pure-white' | 'chroma-green' | 'warm-cream';
export type TextRenderStrategy = 'studio-vector' | 'ai-native';

export interface StoryboardCell {
  index: number;
  caption: string;
  actionZh: string;
  actionEn: string;
}

export interface StoryboardBatchPreset {
  id: 'batch-work' | 'batch-social' | 'batch-meme';
  label: string;
  badge: string;
  desc: string;
  cells: StoryboardCell[];
}

export const STORYBOARD_BATCH_PRESETS: StoryboardBatchPreset[] = [
  {
    id: 'batch-work',
    label: 'Batch A · 职场打工人高频 9 连 (第 1~9 张)',
    badge: '必做首图包',
    desc: '覆盖 80% 微信工作群高频回复，切分后直接作为专辑前 9 张主力表情',
    cells: [
      { index: 1, caption: '收到!', actionZh: '双手敬礼，眼神坚定干练，竖起大拇指', actionEn: 'saluting enthusiastically with a crisp thumbs up, confident smile' },
      { index: 2, caption: '情绪稳定', actionZh: '头顶放着一颗橘子，闭眼淡定喝保温杯枸杞水', actionEn: 'balancing a tangerine on head, eyes closed, calmly sipping from a mug' },
      { index: 3, caption: '带薪摸鱼', actionZh: '戴着墨镜趴在工位上偷偷喝奶茶，一脸惬意', actionEn: 'wearing cool pixelated sunglasses, slacking off sipping boba tea happily' },
      { index: 4, caption: '包的!', actionZh: '拍着胸脯打包票，自信挑眉比出 OK 手势', actionEn: 'patting chest confidently, winking and making an OK hand gesture' },
      { index: 5, caption: 'CPU干烧', actionZh: '双眼转圈圈晕头转向，头顶冒出缕缕白烟', actionEn: 'dizzy spiral eyes, cartoon steam puffing out from top of head, overloaded' },
      { index: 6, caption: '光速下班', actionZh: '背着小书包残影狂奔，满脸开心飞起', actionEn: 'wearing a backpack and sprinting away at lightning speed with joy' },
      { index: 7, caption: '搞快打钱', actionZh: '两眼放光变成金币符号，伸出双手搓手期待', actionEn: 'sparkling coin-shaped eyes, rubbing hands together eagerly' },
      { index: 8, caption: '已老实', actionZh: '乖巧端坐双手放膝盖，头顶冒出一滴冷汗', actionEn: 'sitting super obediently with hands on knees, a single sweat drop on forehead' },
      { index: 9, caption: '在改了!', actionZh: '疯狂敲击发红的笔记本电脑键盘，满头大汗', actionEn: 'frantically typing on a glowing laptop keyboard with sweat drops flying' },
    ],
  },
  {
    id: 'batch-social',
    label: 'Batch B · 日常聊天/情侣闺蜜 9 连 (第 10~18 张)',
    badge: '凑齐16/18张',
    desc: '适合作为第 2 轮对话续画指令，与 Batch A 拼接即可凑齐微信 16 张标准专辑',
    cells: [
      { index: 1, caption: '贴贴~', actionZh: '张开双臂扑过来索要拥抱，周围飘满粉红爱心', actionEn: 'arms wide open for a warm hug, surrounded by floating pink hearts' },
      { index: 2, caption: '暗中观察', actionZh: '从墙角探出半个脑袋，拿着望远镜偷偷吃瓜', actionEn: 'peeking halfway from behind a wall with binoculars, curious expression' },
      { index: 3, caption: '就这?', actionZh: '双手抱胸，半眯着眼露出一脸嫌弃与不屑', actionEn: 'arms crossed, half-lidded unimpressed eyes with a sassy smirk' },
      { index: 4, caption: '哄不好了', actionZh: '背对镜头蹲在角落画圈圈，脸颊气鼓鼓像河豚', actionEn: 'pouting with puffed-up cheeks, sulking grumpy expression' },
      { index: 5, caption: '快投喂!', actionZh: '手里举着空碗和勺子，嘴角流下亮晶晶口水', actionEn: 'holding an empty bowl and spoon, drooling with sparkling hungry eyes' },
      { index: 6, caption: '大震惊!', actionZh: '下巴惊掉双手抱头，瞳孔地震难以置信', actionEn: 'jaw dropped, hands on cheeks in total exaggerated shock' },
      { index: 7, caption: '暴富自由', actionZh: '戴着大金链子墨镜，潇洒撒出一把金元宝', actionEn: 'wearing gold chain and sunglasses, tossing gold coins in the air' },
      { index: 8, caption: '晚安玛卡', actionZh: '盖着小被子抱着月亮抱枕酣睡，鼻涕泡一呼一吸', actionEn: 'tucked in a cozy blanket hugging a pillow, sleeping with a snot bubble' },
      { index: 9, caption: '冲鸭!', actionZh: '系着红色奋斗头带，握拳向前热血冲锋', actionEn: 'wearing a red headband, pumping fist forward with fiery determination' },
    ],
  },
  {
    id: 'batch-meme',
    label: 'Batch C · 阴阳怪气/群聊斗图 9 连 (第 19~24+ 张)',
    badge: '凑齐24张满配',
    desc: '高传播度玩梗表情，三批合一即可选出最完美的 24 张满配微信专辑',
    cells: [
      { index: 1, caption: '你礼貌吗', actionZh: '优雅端着咖啡杯，却翻了一个大大的白眼', actionEn: 'holding a teacup politely while rolling eyes dramatically' },
      { index: 2, caption: '搬小板凳', actionZh: '坐在小板凳上津津有味啃着大西瓜看戏', actionEn: 'sitting on a tiny stool munching on a slice of watermelon, watching drama' },
      { index: 3, caption: '你急了?', actionZh: '笑眯眯指着对方，一脸看破不说破的欠揍表情', actionEn: 'pointing forward with a teasing smug grin' },
      { index: 4, caption: '塌房了', actionZh: '整个人石化裂开成灰白色雕塑，秋风扫落叶', actionEn: 'turning into a cracked grey stone statue in despair' },
      { index: 5, caption: '泰酷辣!', actionZh: '脚踩滑板比出摇滚手势，身边炸开彩色闪电', actionEn: 'making rock-and-roll hand sign with electric sparks around' },
      { index: 6, caption: '栓Q', actionZh: '双手合十苦笑，欲哭无泪的礼貌微笑', actionEn: 'hands pressed together in a forced polite smile with a tear in eye' },
      { index: 7, caption: '退!退!退!', actionZh: '拿着桃木剑或扫帚做击剑防御姿势，气场全开', actionEn: 'fencing stance holding a small broom to ward off bad luck' },
      { index: 8, caption: '尊嘟假嘟', actionZh: '歪着脑袋眨巴着超大星星眼，一脸天真好奇', actionEn: 'tilting head with giant anime starry eyes, curious O-shaped mouth' },
      { index: 9, caption: '溜了溜了', actionZh: '拉起拉链把自己藏进纸箱里，脚底抹油开溜', actionEn: 'hiding inside a cardboard box and tiptoeing away' },
    ],
  },
];

export interface PromptCompilerConfig {
  platform: AIModelPlatform;
  subjectZh: string;
  subjectEn: string;
  stylePreset: 'diecut-vector' | '3d-clay' | 'crayon-doodle' | 'anime-cel';
  bgStrategy: BgColorStrategy;
  textStrategy: TextRenderStrategy;
  isFollowUpTurn: boolean;
  cells: StoryboardCell[];
}

const STYLE_DESCRIPTORS: Record<
  PromptCompilerConfig['stylePreset'],
  { label: string; zh: string; en: string }
> = {
  'diecut-vector': {
    label: '粗线扁平矢量贴纸 (最易抠图)',
    zh: '可爱粗黑轮廓线扁平矢量插画风，高饱和明快配色，类似 Line Friends 贴纸质感，边缘干净锐利无杂色',
    en: 'kawaii flat vector sticker illustration, bold clean dark outlines, vibrant pop colors, crisp sharp silhouette edges, Line Friends sticker aesthetic',
  },
  '3d-clay': {
    label: '泡泡玛特 3D 盲盒粘土风',
    zh: '泡泡玛特盲盒 3D 软陶粘土渲染质感，柔和摄影棚顶光，表面微哑光触感，外轮廓边缘清晰独立',
    en: 'Pop Mart 3D blind box vinyl toy render, cute claymation texture, soft studio lighting, crisp isolated outer silhouette',
  },
  'crayon-doodle': {
    label: '治愈系蜡笔手绘肌理风',
    zh: '温暖治愈的儿童绘本蜡笔水彩手绘风，保留柔和笔触感，但角色外部轮廓干净独立不粘连',
    en: 'warm cozy pastel crayon and gouache illustration style, charming hand-drawn feel with clean isolated character boundaries',
  },
  'anime-cel': {
    label: '日系赛璐璐二次元 Q 版',
    zh: '日系二次元 Q 版二头身赛璐璐平涂画风，大眼睛高光丰富，动漫周边贴纸质感',
    en: '2-head chibi anime cel-shaded sticker style, expressive big glossy eyes, clean line art, official anime merch sticker look',
  },
};

const BG_DESCRIPTORS: Record<
  BgColorStrategy,
  { label: string; hex: string; zh: string; en: string; tip: string }
> = {
  'pure-white': {
    label: '纯白无影底 (#FFFFFF)',
    hex: '#FFFFFF',
    zh: '100% 纯白无暇平涂背景（#FFFFFF），绝对不要任何地面阴影、渐变或环境杂物',
    en: '100% flat solid pure white background (#FFFFFF), zero cast shadows on ground, no background gradients or props',
    tip: '适合毛发/衣服非纯白的角色，配合本工坊「边缘漫水去背」可保护白眼仁不被抠穿。',
  },
  'chroma-green': {
    label: '影视级绿幕底 (#00FF00)',
    hex: '#00FF00',
    zh: '100% 纯正荧光绿幕平涂背景（#00FF00 Chroma Key Green），方便后期一键色度抠图',
    en: '100% flat solid chroma key bright green background (#00FF00), studio green screen for clean alpha extraction',
    tip: '强烈推荐用于【白猫、白兔、熊猫头、穿白衬衫】等自带大量白色的角色，抠图零误伤！',
  },
  'warm-cream': {
    label: '柔和暖米灰底 (#F4F1EA)',
    hex: '#F4F1EA',
    zh: '均匀纯净的浅暖米色背景（#F4F1EA），无渐变无纹理',
    en: 'uniform flat solid warm cream background (#F4F1EA), no texture or vignette',
    tip: '适合已经让 AI 自带一圈白色贴纸描边（Die-cut white border）的生图场景。',
  },
};

export { STYLE_DESCRIPTORS, BG_DESCRIPTORS };

/**
 * Compiles a battle-tested, model-specific prompt from the user's visual storyboard config.
 */
export function compileMasterStickerPrompt(cfg: PromptCompilerConfig): {
  mainPrompt: string;
  negativePrompt?: string;
  workflowChecklist: string[];
} {
  const style = STYLE_DESCRIPTORS[cfg.stylePreset];
  const bg = BG_DESCRIPTORS[cfg.bgStrategy];

  const followUpPrefixZh = cfg.isFollowUpTurn
    ? '【多轮续画强约束】：请严格承接上一张图的同一个角色！保持 100% 完全一致的五官比例、毛色/肤色、服装配饰与画风，仅更换以下 9 个全新表情动作：\n\n'
    : '';

  const followUpPrefixEn = cfg.isFollowUpTurn
    ? '[FOLLOW-UP TURN CONSISTENCY LOCK]: Strictly keep the EXACT SAME character from the previous image (100% identical facial features, outfit, color palette, and art style). Only change the 9 expressions/poses as specified below:\n\n'
    : '';

  if (cfg.platform === 'doubao') {
    const cellLines = cfg.cells
      .map((c) =>
        cfg.textStrategy === 'ai-native'
          ? `  - 格子${c.index}：${c.actionZh}，画面底部配醒目简体中文粗体贴纸字：“${c.caption}”`
          : `  - 格子${c.index}：${c.actionZh}（纯动作神态表现，不要任何文字）`
      )
      .join('\n');

    const textRule =
      cfg.textStrategy === 'ai-native'
        ? '4. 【文字规范】：每个格子底部包含引号内对应的简体中文短句，采用醒目圆润粗体字+白边描边，字形工整严禁错别字。'
        : '4. 【零文字纯享规范（极其重要）】：画面中严禁出现任何中文、英文、字母、对话框或标点符号！保持纯角色插画，文字将由后期工程软件统一矢量合成。';

    return {
      mainPrompt: `${followUpPrefixZh}请为我绘制一套用于微信表情开放平台的【3×3 九宫格角色表情包母版大图】（1:1 正方形画布）：

1. 【角色基因锁（9格必须100%同一个人/动物）】：
   - 主体设定：${cfg.subjectZh}
   - 画风质感：${style.zh}。9个格子里的角色五官、头身比、服装颜色必须完全统一，严禁变脸或换装！

2. 【无框负空间排版（防裁切核心纪律）】：
   - 整张图按 3行 × 3列 均匀排列共 9 个独立造型。
   - ❗严禁画出黑色的九宫格分割线或方框！每个角色周围必须保留充足的空白呼吸边距（Knolling 排列），耳朵、手脚、头顶道具绝对不能碰到格子边缘或互相重叠！
   - 背景要求：${bg.zh}。

3. 【9格分镜动作明细】：
${cellLines}

${textRule}`,
      workflowChecklist: [
        '在【豆包 / 即梦】中粘贴上方指令（如有参考图可同时垫入 1 张角色正脸图）',
        '生成满意的 3×3 大图后，直接在豆包网页上【右键 -> 复制图片】',
        '切回本工坊任意位置直接按【Ctrl + V】，系统将自动切分 9 图并一键贴入您设定的 9 句配文！',
      ],
    };
  }

  if (cfg.platform === 'gpt4o') {
    const cellLines = cfg.cells
      .map((c) =>
        cfg.textStrategy === 'ai-native'
          ? `  - Tile ${c.index}: ${c.actionZh} (${c.actionEn}), with bold sticker caption "${c.caption}" at bottom.`
          : `  - Tile ${c.index}: ${c.actionZh} (${c.actionEn}). NO TEXT.`
      )
      .join('\n');

    return {
      mainPrompt: `${followUpPrefixZh}Create a 1:1 square **3x3 Sticker Sheet Master Image** containing 9 separate stickers arranged in 3 rows and 3 columns:

[1. CHARACTER IDENTITY LOCK]:
- Character: ${cfg.subjectZh} (${cfg.subjectEn})
- Art Style: ${style.en} (${style.zh}).
- Every single tile from Tile 1 to Tile 9 MUST depict the exact same character with identical proportions, colors, and outfit.

[2. SPATIAL GRID & ANTI-CLIPPING RULES]:
- Arrange the 9 poses in an invisible, mathematically uniform 3x3 grid (knolling layout).
- DO NOT draw visible black grid lines, boxes, or comic borders.
- Leave at least 15% empty margin around each character inside its virtual cell so ears, hands, and props are NEVER cropped or touching neighbors.
- Background: ${bg.en}.

[3. 9-TILE EXPRESSION STORYBOARD]:
${cellLines}

[4. TYPOGRAPHY CONSTRAINT]:
${
  cfg.textStrategy === 'ai-native'
    ? '- Render the exact Chinese caption in bold rounded sticker typography at the bottom of each tile.'
    : '- STRICTLY NO TEXT, NO LETTERS, NO SPEECH BUBBLES anywhere in the image. Pure character illustrations only.'
}`,
      workflowChecklist: [
        '在 ChatGPT (GPT-4o) 对话框粘贴此结构化指令（如需湊齐 18 张，生完第 1 张后开启上方「多轮续画锁脸模式」切换 Batch B 继续发）',
        '右键生成的图片选择【复制图片 (Copy Image)】',
        '回到本页面直接按【Ctrl + V】，即可触发激光切分与配文自动注入！',
      ],
    };
  }

  if (cfg.platform === 'nano-banana') {
    const cellLines = cfg.cells
      .map((c, idx) => {
        const r = Math.floor(idx / 3) + 1;
        const col = (idx % 3) + 1;
        return `  * [Row ${r}, Col ${col} - #0${c.index}]: ${c.actionEn} (${c.actionZh})${
          cfg.textStrategy === 'ai-native' ? ` | Caption: "${c.caption}"` : ''
        }`;
      })
      .join('\n');

    return {
      mainPrompt: `${followUpPrefixEn}[TASK]: Generate a production-ready 3x3 character sticker sheet (9 distinct stickers on one 1:1 canvas).

[IDENTITY LOCK]: ${cfg.subjectEn} (${cfg.subjectZh}). Maintain 100% strict facial structure, color palette, and outfit across all 9 tiles.

[LAYOUT & NEGATIVE SPACE]:
- Clean 3 rows by 3 columns uniform arrangement.
- Separated by generous negative space; DO NOT draw visible grid lines or panel frames.
- Every character bust/full-body must stay fully inside its cell with zero edge clipping.
- Background: ${bg.en}.

[TILE-BY-TILE VARIATIONS]:
${cellLines}

[FINISH]: ${style.en}. ${
        cfg.textStrategy === 'studio-vector'
          ? 'Strictly NO text, NO typography, NO speech bubbles.'
          : 'Include crisp Chinese caption text per tile as specified.'
      }`,
      workflowChecklist: [
        '在 Gemini / AI Studio (Nano Banana) 中发送上方指令，建议如有角色立绘先上传一张立绘作为首图锚点',
        '出图后右键【复制图像】，回到本工坊按【Ctrl + V】秒速切开并自动套入刀模白边与配文',
      ],
    };
  }

  if (cfg.platform === 'midjourney') {
    const actionsEn = cfg.cells.map((c) => `(${c.index}) ${c.actionEn}`).join(', ');
    return {
      mainPrompt: `A clean 3x3 grid sticker sheet of ${cfg.subjectEn}, 9 distinct exaggerated expressions and poses arranged in 3 rows and 3 columns: ${actionsEn}. ${style.en}, knolling layout with generous spacing between characters, ${bg.en}, complete silhouettes with no cropped ears or hands --ar 1:1 --niji 6 --style raw --no grid lines, comic panel borders, frames, text, letters, watermark, cropped edges`,
      workflowChecklist: [
        '在 Midjourney 中使用 `--niji 6 --style raw` 生成；若已有满意角色单图，强烈建议在末尾加上 `--cref <角色图URL> --cw 100` 锁死脸部与服装！',
        'Midjourney 挑选满意的一张 Upscale (U1~U4) 后右键复制图片，回本工坊按【Ctrl + V】切分并自动打上中文花字！',
      ],
    };
  }

  // local-flux / SDXL
  const actionsEn = cfg.cells.map((c) => `tile ${c.index}: ${c.actionEn}`).join('; ');
  return {
    mainPrompt: `3x3 grid sticker sheet, 9 separate chibi stickers arranged in 3 rows and 3 columns, ${cfg.subjectEn}, consistent character identity across all 9 tiles (${actionsEn}), ${style.en}, ${bg.en}, wide empty margin between stickers, no visible grid lines, no text`,
    negativePrompt:
      'visible grid lines, comic panel borders, black frames, cropped head, cropped hands, overlapping characters, text, watermark, signature, blurry, inconsistent clothes, multiple different characters, gradients in background, cast shadow',
    workflowChecklist: [
      '在本地 ComfyUI / Forge (Flux.1 Dev 或 SDXL) 中设置分辨率为 `1024×1024` 或 `1536×1536`',
      '将正/反向提示词分别填入，生成后直接拖拽或复制粘贴（Ctrl+V）至本工坊切分舱',
    ],
  };
}

export interface PromptBlueprint {
  id: string;
  title: string;
  modelTag: string;
  gridSpec: string;
  promptEn: string;
  promptZh: string;
  tips: string;
}

export const PROMPT_BLUEPRINTS: PromptBlueprint[] = [
  {
    id: 'mj-3x3-sheet',
    title: '3×3 九宫格 IP 角色一致性贴纸母版',
    modelTag: 'Midjourney v6.1 / Niji 6',
    gridSpec: '3×3 Grid (1:1)',
    promptEn:
      'A 3x3 grid sticker sheet of a cute chubby capybara office worker, 9 distinct exaggerated expressions (thumbs up, sipping coffee, shocked, crying, angry typing, sleeping, rich with coins, heart eyes, saluting), die-cut vector illustration style, thick clean outlines, flat solid pure white background #FFFFFF, generous spacing between characters, no cropped edges, no text --ar 1:1 --niji 6 --style raw --no grid lines, panel borders, text',
    promptZh:
      '3x3 九宫格表情贴纸矩阵，一只可爱的圆润打工水豚，9种夸张且互不相同的表情动作（点赞收到、淡定喝咖啡、瞳孔地震、委屈流泪、暴躁敲键盘、趴桌酣睡、撒币暴富、比心贴贴、敬礼下班），扁平矢量插画风，粗线条勾勒，纯白无暇背景 #FFFFFF，每个角色之间留有充足间距，严禁画网格黑线，严禁裁切边缘，不要带乱码文字',
    tips: '生成后直接右键复制图片，在本工坊按 Ctrl+V 即可一键切分出 9 张独立透明贴纸并自动匹配配文。',
  },
  {
    id: 'gpt4o-4x4-sheet',
    title: '4×4 十六宫格全套微信日常高频表情矩阵',
    modelTag: 'GPT-4o / Nano Banana / 豆包',
    gridSpec: '4×4 Grid (1:1)',
    promptEn:
      'Create a 4x4 grid containing 16 separate kawaii cyber shiba inu stickers arranged in 4 rows and 4 columns with equal negative space padding. Each cell shows the exact same character with a different daily chat emotion. Pure solid #00FF00 chroma green or #FFFFFF white background, no visible grid lines, no overlapping between grid cells, high contrast sticker art.',
    promptZh:
      '生成一张严格按 4行×4列 均匀排布的 16 宫格赛博柴犬贴纸图。每个格子展示同一个角色的 16 种微信高频聊天反应。纯白或纯绿幕干净背景，不要画网格分割线，格子之间绝对不要重叠越界，高对比度贴纸插画质感。',
    tips: '16 张刚好满足微信表情开放平台标准 16 张专辑档位，切分后可批量注入本工坊的「花字配文」与「刀模白边」。',
  },
];

