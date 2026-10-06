// SPDX-License-Identifier: MPL-2.0
/** File kinds shared by the asset picker and library upload surfaces. */
export const UPLOAD_ACCEPT =
  '.glb,.stl,.3mf,model/3mf,application/vnd.ms-package.3dmanufacturing-3dmodel+xml,model/gltf-binary,.hdr,.exr,image/vnd.radiance,image/x-exr,image/svg+xml,image/png,image/tiff,.tif,.tiff,image/apng,image/jpeg,image/webp,image/gif,image/avif,image/jxl,.jxl,image/heic,image/heif,image/bmp,.bmp,image/x-icon,image/vnd.microsoft.icon,.ico,.cur,.svgz,video/mp4,video/webm,video/x-matroska,.mp4,.webm,.mov,.mkv,audio/*,.mp3,.wav,.ogg,.oga,.opus,.m4a,.aac,.flac,.mid,.midi,.mod,.xm,.it,.s3m,.stm,.mtm,application/json,.json,.lottie,application/pdf,.pdf,application/illustrator,.ai,application/vnd.openxmlformats-officedocument.presentationml.presentation,.pptx,.xlsx,.csv,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/*,.txt,.md,.markdown,.text,.js,.jsx,.mjs,.cjs,.ts,.tsx,.py,.rb,.go,.rs,.java,.c,.h,.hpp,.cc,.cpp,.cs,.swift,.kt,.kts,.php,.pl,.lua,.sql,.scala,.sh,.bash,.zsh,.fish,.yaml,.yml,.toml,.ini,.cfg,.conf,.css,.scss,.less,.html,.htm,.xml,.vue,.svelte,.astro,.log,.jsonl,.ndjson';

/** PDF-compatible Illustrator files use the PDF importer. */
export const isPdfUpload = (file: File): boolean =>
  /\.(pdf|ai)$/i.test(file.name) || /^application\/(pdf|illustrator)$/i.test(file.type);

/** A Photoshop document (.psd or .psb), which Rebrand reads as one slide (plans/289 D2). */
export const isPsdUpload = (file: File): boolean =>
  /\.(psd|psb)$/i.test(file.name) || /^image\/(vnd\.adobe\.photoshop|x-photoshop)$/i.test(file.type);

export const isPptxUpload = (file: File): boolean =>
  /\.pptx$/i.test(file.name) ||
  file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
