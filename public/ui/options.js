export function parseOptions(content) {
  if (!content || typeof content !== 'string') {
    return { text: content || '', options: null };
  }

  try {
    let cleaned = content.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    cleaned = cleaned.trim();
    
    const parsed = JSON.parse(cleaned);
    
    if (typeof parsed.response !== 'string') {
      return { text: content, options: null };
    }
    
    let options = null;
    if (parsed.options !== null && parsed.options !== undefined) {
      if (Array.isArray(parsed.options)) {
        const validOptions = parsed.options.filter(opt => 
          typeof opt === 'string' && opt.trim().length > 0
        );
        if (validOptions.length >= 2) {
          options = validOptions.map(opt => opt.trim());
        }
      }
    }
    
    return {
      text: parsed.response,
      options: options
    };
  } catch (error) {
    return {
      text: content,
      options: null
    };
  }
}

