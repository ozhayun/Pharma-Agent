export function detectTextDirection(text) {
  if (!text) return 'ltr';
  return /[\u0590-\u05FF]/.test(text) ? 'rtl' : 'ltr';
}

export function formatFlowName(flowType) {
  return flowType.replace(/_/g, ' ').toUpperCase();
}

export function formatStepName(step) {
  if (!step) return '--';
  return step.replace(/_/g, ' ').toUpperCase();
}

