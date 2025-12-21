export const supportsReasoning = (model: string): boolean => {
    return model.startsWith('o1') || 
           model.startsWith('o3') || 
           model.startsWith('o-') || 
           model.startsWith('gpt-5') ||
           model === 'gpt-5' ||
           model.includes('gpt-5');
  }