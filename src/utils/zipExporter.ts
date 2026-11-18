import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { processTransparentSticker } from './imageProcessor';

export interface ExportStickerEntry {
  mainBlob: Blob;
  gifBlob?: Blob;
  thumbBlob: Blob;
  name?: string;
  caption?: string;
}

export interface ExportOptions {
  albumName: string;
  stickers: ExportStickerEntry[];
  extras: {
    cover: Blob | null;
    icon: Blob | null;
    banner: Blob | null;
    artist: Blob | null;
    guide: Blob | null;
    thanks: Blob | null;
  };
  dynamicIconSize?: number;
  /** Whether to export true binary GIF89a (.gif) or standard PNG (.png) in /表情主体 */
  mainFormat?: 'gif89a' | 'png';
  includeManifest?: boolean;
}

export const exportStickersZip = async (options: ExportOptions) => {
  const {
    albumName,
    stickers,
    extras,
    dynamicIconSize = 50,
    mainFormat = 'gif89a',
    includeManifest = true,
  } = options;

  if (!stickers.length) {
    throw new Error('没有任何主图，无法打包！');
  }

  const zip = new JSZip();

  // 创建顶级根目录：/专辑名字_WeChat
  const baseName = albumName.trim() ? albumName.trim() : `未命名专辑_${Date.now()}`;
  const rootFolder = zip.folder(`${baseName}_WeChat`);
  if (!rootFolder) throw new Error('Root folder creation failed');

  // 1. 表情主图 (01.gif / 01.png...)
  const mainFolder = rootFolder.folder('表情主体');
  // 2. 缩略图 (01.png, 02.png...)
  const thumbFolder = rootFolder.folder('表情缩略图');

  const ext = mainFormat === 'png' ? 'png' : 'gif';
  const manifestLines: string[] = [
    `==========================================================`,
    `  WeSticker Studio 2.0 · 微信表情开放平台提审免检清单`,
    `==========================================================`,
    `专辑名称: ${baseName}`,
    `导出时间: ${new Date().toLocaleString('zh-CN')}`,
    `表情数量: ${stickers.length} 张 (微信官方标准档位: 8 / 16 / 24 张)`,
    `主图编码: ${mainFormat === 'gif89a' ? 'True Binary GIF89a (含透明通道与2px安全区)' : 'PNG-32 (含透明通道与2px安全区)'}`,
    `----------------------------------------------------------`,
    `[表情主体与缩略图明细]`,
  ];

  for (let i = 0; i < stickers.length; i++) {
    const num = String(i + 1).padStart(2, '0');
    const item = stickers[i];
    const mainPayload = mainFormat === 'gif89a' && item.gifBlob ? item.gifBlob : item.mainBlob;

    mainFolder?.file(`${num}.${ext}`, mainPayload);
    thumbFolder?.file(`${num}.png`, item.thumbBlob);

    manifestLines.push(
      `  #${num} | 主图: ${num}.${ext} (${(mainPayload.size / 1024).toFixed(1)} KB) | 缩略图: ${num}.png (${(item.thumbBlob.size / 1024).toFixed(1)} KB)${item.caption ? ` | 配文: "${item.caption}"` : ''}`
    );
  }

  // 3. 各种大图和小图根目录平铺
  // 封面图: fallback 取第一张大图 PNG
  const coverPayload = extras.cover || stickers[0].mainBlob;
  rootFolder.file(`封面图_cover.png`, coverPayload);

  // 聊天图标: fallback 将首图实时缩放至 50x50
  let iconPayload = extras.icon;
  if (!iconPayload) {
    try {
      const iconRes = await processTransparentSticker(stickers[0].mainBlob, dynamicIconSize, 0, {
        strokeWidth: 0,
        dropShadow: false,
        removeBg: false,
      });
      iconPayload = iconRes.blob;
    } catch (e) {
      console.warn('Failed to generate fallback icon', e);
    }
  }
  if (iconPayload) {
    rootFolder.file(`聊天图标_icon.png`, iconPayload);
  }

  // 横幅、主页、赞赏 (全系 JPG)
  if (extras.banner) {
    rootFolder.file(`横幅图_banner.jpg`, extras.banner);
  }
  if (extras.artist) {
    rootFolder.file(`艺术家主页_artist.jpg`, extras.artist);
  }
  if (extras.guide) {
    rootFolder.file(`赞赏引导_reward_guide.jpg`, extras.guide);
  }
  if (extras.thanks) {
    rootFolder.file(`赞赏致谢_reward_thanks.jpg`, extras.thanks);
  }

  if (includeManifest) {
    manifestLines.push(
      `----------------------------------------------------------`,
      `[运营推广物料状态]`,
      `  - 详情页封面 (封面图_cover.png): ${(coverPayload.size / 1024).toFixed(1)} KB`,
      `  - 聊天面板图标 (聊天图标_icon.png): ${iconPayload ? (iconPayload.size / 1024).toFixed(1) + ' KB' : '未生成'}`,
      `  - 详情页横幅 (横幅图_banner.jpg): ${extras.banner ? (extras.banner.size / 1024).toFixed(1) + ' KB' : '未包含 (选填/可一键合成)'}`,
      `  - 艺术家主页 (艺术家主页_artist.jpg): ${extras.artist ? (extras.artist.size / 1024).toFixed(1) + ' KB' : '未包含 (选填/可一键合成)'}`,
      `  - 赞赏引导图 (赞赏引导_reward_guide.jpg): ${extras.guide ? (extras.guide.size / 1024).toFixed(1) + ' KB' : '未包含 (选填/可一键合成)'}`,
      `  - 赞赏致谢图 (赞赏致谢_reward_thanks.jpg): ${extras.thanks ? (extras.thanks.size / 1024).toFixed(1) + ' KB' : '未包含 (选填/可一键合成)'}`,
      `==========================================================`
    );
    rootFolder.file(`提审自检报告_manifest.txt`, manifestLines.join('\n'));
  }

  // 产出且下载
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  saveAs(zipBlob, `${baseName}_WeChat.zip`);
};
