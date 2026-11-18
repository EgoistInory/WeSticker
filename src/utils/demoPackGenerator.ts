/**
 * Procedural Vector-Canvas IP Character Generator & Demo Sprite Sheet Synthesizer
 * Provides an instant, zero-empty-state interactive showcase experience on page load or 1-click trigger.
 */

export type DemoPackId = 'capybara' | 'cybershiba' | 'inkcat';

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
  }

  ctx.lineWidth = Math.max(5, size * 0.026);
  ctx.strokeStyle = bodyStroke;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Ears
  if (packId === 'capybara') {
    // Round little capybara ears
    for (const dir of [-1, 1]) {
      ctx.fillStyle = snoutFill;
      ctx.beginPath();
      ctx.ellipse(cx + dir * r * 0.72, cy - r * 0.72, r * 0.22, r * 0.16, dir * 0.4, 0, Math.PI * 2);
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

  // Eyes & Facial Expressions by Mood
  const eyeY = cy - r * 0.16;
  const eyeOffsetX = r * 0.44;
  ctx.strokeStyle = packId === 'inkcat' ? '#FBBF24' : bodyStroke;
  ctx.fillStyle = packId === 'inkcat' ? '#FBBF24' : bodyStroke;

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
    drawCharacterIllustration(cellCtx, cellSize, meta.id, moods[i], '#F6F3E9');
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
 * Curated AI Prompt Blueprints for generating WeChat-ready 3x3 / 4x4 Sticker Sheets
 */
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
      'A 3x3 grid sticker sheet of a cute chubby capybara office worker, 9 distinct exaggerated expressions (thumbs up, sipping coffee, shocked, crying, angry typing, sleeping, rich with coins, heart eyes, saluting), die-cut vector illustration style, thick clean outlines, flat solid pure white background #FFFFFF, generous spacing between characters, no cropped edges, no text --ar 1:1 --niji 6 --style raw',
    promptZh:
      '3x3 九宫格表情贴纸矩阵，一只可爱的圆润打工水豚，9种夸张且互不相同的表情动作（点赞收到、淡定喝咖啡、瞳孔地震、委屈流泪、暴躁敲键盘、趴桌酣睡、撒币暴富、比心贴贴、敬礼下班），扁平矢量插画风，粗线条勾勒，纯白无暇背景 #FFFFFF，每个角色之间留有充足间距，严禁裁切边缘，不要带乱码文字',
    tips: '生成后直接拖入本工坊「AI 大图切分舱」，开启 3×3 网格与自动去白底，1秒切出 9 张独立透明贴纸。',
  },
  {
    id: 'gpt4o-4x4-sheet',
    title: '4×4 十六宫格全套微信日常高频表情矩阵',
    modelTag: 'GPT-4o / Nano Banana / Flux',
    gridSpec: '4×4 Grid (1:1)',
    promptEn:
      'Create a 4x4 grid containing 16 separate kawaii cyber shiba inu stickers arranged in 4 rows and 4 columns with equal padding. Each cell shows the exact same character with a different daily chat emotion. Pure solid light gray or white background, no overlapping between grid cells, high contrast sticker art.',
    promptZh:
      '生成一张严格按 4行×4列 均匀排布的 16 宫格赛博柴犬贴纸图。每个格子展示同一个角色的 16 种微信高频聊天反应。纯色干净背景，格子之间绝对不要重叠越界，高对比度贴纸插画质感。',
    tips: '16 张刚好满足微信表情开放平台标准 16 张专辑档位，切分后可批量注入本工坊的「花字配文」与「刀模白边」。',
  },
  {
    id: 'promo-banner-prompt',
    title: '微信详情页 750×400 宣传横幅原画指令',
    modelTag: '通用生图模型 (16:9 / 75:40)',
    gridSpec: '750×400 Banner',
    promptEn:
      'Wide promotional banner illustration featuring a cheerful capybara character placed on the right side, clean minimalist pastel studio background on the left side with negative space for typography, vibrant lighting, vector pop art --ar 15:8',
    promptZh:
      '宽幅微信表情横幅插画，主角置于画面右侧三分之一处，左侧保留大面积干净柔和的浅色留白以便排版专辑标题，波普矢量艺术感，色彩明快 --ar 15:8',
    tips: '或者无需单独用 AI 生成横幅——直接在「运营物料合成中心」点击【一键从主图合成全套 6 张运营大图】即可！',
  },
];
