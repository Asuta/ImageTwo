export const IMAGE_MODELS = [
  { value: "gpt-image-2.5-flare", label: "Image 2.5 Flare" },
  { value: "gpt-image-2.5-sunburst", label: "Image 2.5 Sunburst" }
];

export const DEFAULT_IMAGE_MODEL = IMAGE_MODELS[0].value;

export function isSupportedImageModel(model) {
  return IMAGE_MODELS.some(option => option.value === model);
}

// 旧历史/画布仍可阅读，重新生成时使用当前可用模型。
export function normalizeImageModel(model) {
  return isSupportedImageModel(model) ? model : DEFAULT_IMAGE_MODEL;
}

// 兼容已有供应商配置，同时保留管理员为其他通道填写的自定义模型。
export function upgradeLegacyImageModel(model) {
  const value = String(model || "").trim();
  return !value || /^gpt-image-2(?:-codex)?$/.test(value)
    ? DEFAULT_IMAGE_MODEL
    : value;
}
