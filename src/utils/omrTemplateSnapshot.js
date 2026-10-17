export function withOmrTemplateSnapshot(exam, templates, defaultConfig, refresh = false) {
  const template = String(exam.template || '');
  if (template !== 'custom' && !template.startsWith('custom:')) {
    const result = { ...exam };
    delete result.template_config;
    delete result.customConfig;
    return result;
  }
  if (!refresh && (exam.template_config || exam.customConfig)) return exam;
  const config = template === 'custom'
    ? defaultConfig
    : templates.find((item) => String(item.id) === template.slice('custom:'.length))?.config;
  return config ? { ...exam, template_config: { ...defaultConfig, ...config } } : exam;
}
