// Client-side image helpers for chat attachments.

export interface Attachment {
  id: string;
  dataUrl: string; // original — inserted into cards on request
  apiDataUrl: string; // resized copy sent to the model
  thumb: string; // tiny copy persisted in chat history
  width: number;
  height: number;
}

function scaleToDataUrl(img: HTMLImageElement, maxDim: number): string {
  const ratio = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * ratio));
  const h = Math.max(1, Math.round(img.naturalHeight * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export async function fileToAttachment(file: File): Promise<Attachment> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("이미지를 읽을 수 없습니다"));
    el.src = dataUrl;
  });
  return {
    id: crypto.randomUUID(),
    dataUrl,
    apiDataUrl: scaleToDataUrl(img, 1200),
    thumb: scaleToDataUrl(img, 160),
    width: img.naturalWidth,
    height: img.naturalHeight,
  };
}

export function splitDataUrl(dataUrl: string): { mediaType: string; data: string } | null {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  return m ? { mediaType: m[1], data: m[2] } : null;
}
