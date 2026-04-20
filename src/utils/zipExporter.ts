import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { processTransparentSticker } from './imageProcessor';

interface ExportOptions {
  albumName: string;
  stickers: { mainBlob: Blob, thumbBlob: Blob }[];
  extras: {
    cover: Blob | null;
    icon: Blob | null;
    banner: Blob | null;
    artist: Blob | null;
    guide: Blob | null;
    thanks: Blob | null;
  };
  dynamicIconSize?: number;
}

export const exportStickersZip = async (options: ExportOptions) => {
  const { albumName, stickers, extras, dynamicIconSize = 50 } = options;
  if (!stickers.length) {
    throw new Error('没有任何主图，无法打包！');
  }

  const zip = new JSZip();

  // 创建顶级根目录：/专辑名字_WeChat
  const baseName = albumName.trim() ? albumName.trim() : `未命名专辑_${Date.now()}`;
  const rootFolder = zip.folder(`${baseName}_WeChat`);
  if (!rootFolder) throw new Error('Root folder creation failed');

  // 1. 表情主图 (01.gif, 02.gif...)
  const mainFolder = rootFolder.folder('表情主体');
  // 2. 缩略图 (01.png, 02.png...)
  const thumbFolder = rootFolder.folder('表情缩略图');

  for (let i = 0; i < stickers.length; i++) {
    const num = String(i + 1).padStart(2, '0');
    // 主图硬核设为 .gif
    mainFolder?.file(`${num}.gif`, stickers[i].mainBlob);
    thumbFolder?.file(`${num}.png`, stickers[i].thumbBlob);
  }

  // 3. 各种大图和小图根目录平铺
  // 封面图: fallback 取第一张大图
  if (extras.cover) {
    rootFolder.file(`封面图_cover.png`, extras.cover);
  } else {
    rootFolder.file(`封面图_cover.png`, stickers[0].mainBlob); // 240x240 PNG is perfect
  }

  // 聊天图标: fallback 将首图实时缩放
  if (extras.icon) {
    rootFolder.file(`聊天图标_icon.png`, extras.icon);
  } else {
    try {
      // 实时调用降维打击，无留白
      const iconRes = await processTransparentSticker(stickers[0].mainBlob, dynamicIconSize, 0);
      rootFolder.file(`聊天图标_icon.png`, iconRes.blob);
    } catch (e) {
      console.warn("Failed to generate fallback icon", e);
    }
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

  // 产出且下载
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  saveAs(zipBlob, `${baseName}_WeChat.zip`);
};
