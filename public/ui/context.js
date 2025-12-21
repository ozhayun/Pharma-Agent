import { formatFlowName, formatStepName } from '../utils/dom.js';

let ctxMedication;
let ctxFlow;
let ctxStep;
let ctxLang;
let ctxMedicationDisplay;
let ctxFlowDisplay;
let toolHistoryContainer;
let medicationHistoryContainer;
let flowHistoryContainer;
let stepHistoryContainer;
let contextPanel;
let contextToggle;
let closeContextBtn;
let tabInfo;
let tabHistory;
let tabContentInfo;
let tabContentHistory;

export function initializeContext(elements) {
  ctxMedication = elements.ctxMedication;
  ctxFlow = elements.ctxFlow;
  ctxStep = elements.ctxStep;
  ctxLang = elements.ctxLang;
  ctxMedicationDisplay = elements.ctxMedicationDisplay;
  ctxFlowDisplay = elements.ctxFlowDisplay;
  toolHistoryContainer = elements.toolHistoryContainer;
  medicationHistoryContainer = elements.medicationHistoryContainer;
  flowHistoryContainer = elements.flowHistoryContainer;
  stepHistoryContainer = elements.stepHistoryContainer;
  contextPanel = elements.contextPanel;
  contextToggle = elements.contextToggle;
  closeContextBtn = elements.closeContextBtn;
  tabInfo = elements.tabInfo;
  tabHistory = elements.tabHistory;
  tabContentInfo = elements.tabContentInfo;
  tabContentHistory = elements.tabContentHistory;
}

export function setupContextPanelHandlers() {
  if (contextToggle) {
    contextToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      contextPanel.classList.toggle('active');
    });
  }

  if (closeContextBtn) {
    closeContextBtn.addEventListener('click', () => {
      contextPanel.classList.remove('active');
    });
  }

  // Tab switching
  if (tabInfo && tabHistory && tabContentInfo && tabContentHistory) {
    tabInfo.addEventListener('click', () => {
      tabInfo.classList.add('active');
      tabHistory.classList.remove('active');
      tabContentInfo.classList.add('active');
      tabContentHistory.classList.remove('active');
    });
    
    tabHistory.addEventListener('click', () => {
      tabHistory.classList.add('active');
      tabInfo.classList.remove('active');
      tabContentHistory.classList.add('active');
      tabContentInfo.classList.remove('active');
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && contextPanel && contextPanel.classList.contains('active')) {
      contextPanel.classList.remove('active');
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      if (contextPanel) {
        contextPanel.classList.toggle('active');
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (contextPanel && contextPanel.classList.contains('active')) {
      const isClickInsidePanel = contextPanel.contains(e.target);
      const isClickOnToggle = contextToggle && contextToggle.contains(e.target);
      
    //   if (!isClickInsidePanel && !isClickOnToggle) {
    //     contextPanel.classList.remove('active');
    //   }
    }
  });
}

export function updateContext(newContext) {
  if (!newContext) return;

  if (newContext.flowState) {
    const fs = newContext.flowState;

    if (fs.sharedSlots.medicationName) {
      updateContextItem(ctxMedication, fs.sharedSlots.medicationName);
      if (ctxMedicationDisplay) {
        ctxMedicationDisplay.textContent = fs.sharedSlots.medicationName;
      }
    } else {
      if (ctxMedicationDisplay) {
        ctxMedicationDisplay.textContent = '';
      }
    }

    if (fs._activeFlowType) {
      const flowName = formatFlowName(fs._activeFlowType);
      updateContextItem(ctxFlow, flowName);
      if (ctxFlowDisplay) {
        ctxFlowDisplay.textContent = flowName;
      }
    } else {
      if (ctxFlowDisplay) {
        ctxFlowDisplay.textContent = '';
      }
    }

    if (fs._activeFlowType && fs.flows && fs.flows[fs._activeFlowType]) {
      const activeFlow = fs.flows[fs._activeFlowType];
      if (activeFlow && activeFlow.step) {
        const stepName = formatStepName(activeFlow.step);
        updateContextItem(ctxStep, stepName);
      } else {
        updateContextItem(ctxStep, '--');
      }
    } else {
      updateContextItem(ctxStep, '--');
    }

    if (fs.language) {
      updateContextItem(ctxLang, fs.language === 'en' ? 'English' : 'Hebrew');
    }

    // Update history tabs
    updateToolHistory(fs.toolHistory || []);
    updateMedicationHistory(fs.medicationHistory || []);
    updateFlowHistory(fs.flowHistory || []);
    updateStepHistory(fs.stepHistory || []);
  }

  return newContext;
}

function updateToolHistory(toolHistory) {
  if (!toolHistoryContainer) return;

  const ctxToolHistory = document.getElementById('ctx-tool-history');
  if (!ctxToolHistory) return;

  if (toolHistory.length === 0) {
    toolHistoryContainer.innerHTML = '<div class="tool-history-empty">No tools used yet</div>';
    ctxToolHistory.classList.add('empty');
    return;
  }

  ctxToolHistory.classList.remove('empty');
  
  // Render tool history entries (most recent first)
  toolHistoryContainer.innerHTML = toolHistory.map(entry => {
    const medicationPart = entry.medicationName 
      ? ` <span class="tool-history-medication">(${escapeHtml(entry.medicationName)})</span>`
      : '';
    return `
      <div class="tool-history-entry">${escapeHtml(entry.name)}${medicationPart}</div>
    `;
  }).join('');
}

function updateMedicationHistory(medicationHistory) {
  if (!medicationHistoryContainer) return;

  const ctxMedicationHistory = document.getElementById('ctx-medication-history');
  if (!ctxMedicationHistory) return;

  if (medicationHistory.length === 0) {
    medicationHistoryContainer.innerHTML = '<div class="tool-history-empty">No medications yet</div>';
    ctxMedicationHistory.classList.add('empty');
    return;
  }

  ctxMedicationHistory.classList.remove('empty');
  
  medicationHistoryContainer.innerHTML = medicationHistory.map(entry => {
    return `
      <div class="tool-history-entry">${escapeHtml(entry.name)}</div>
    `;
  }).join('');
}

function updateFlowHistory(flowHistory) {
  if (!flowHistoryContainer) return;

  const ctxFlowHistory = document.getElementById('ctx-flow-history');
  if (!ctxFlowHistory) return;

  if (flowHistory.length === 0) {
    flowHistoryContainer.innerHTML = '<div class="tool-history-empty">No flows yet</div>';
    ctxFlowHistory.classList.add('empty');
    return;
  }

  ctxFlowHistory.classList.remove('empty');
  
  flowHistoryContainer.innerHTML = flowHistory.map(entry => {
    const flowName = formatFlowName(entry.flowType);
    const medicationPart = entry.medicationName 
      ? ` <span class="tool-history-medication">(${escapeHtml(entry.medicationName)})</span>`
      : '';
    return `
      <div class="tool-history-entry">${escapeHtml(flowName)}${medicationPart}</div>
    `;
  }).join('');
}

function updateStepHistory(stepHistory) {
  if (!stepHistoryContainer) return;

  const ctxStepHistory = document.getElementById('ctx-step-history');
  if (!ctxStepHistory) return;

  if (stepHistory.length === 0) {
    stepHistoryContainer.innerHTML = '<div class="tool-history-empty">No steps yet</div>';
    ctxStepHistory.classList.add('empty');
    return;
  }

  ctxStepHistory.classList.remove('empty');
  
  stepHistoryContainer.innerHTML = stepHistory.map(entry => {
    const stepName = formatStepName(entry.step);
    const medicationPart = entry.medicationName 
      ? ` <span class="tool-history-medication">(${escapeHtml(entry.medicationName)})</span>`
      : '';
    return `
      <div class="tool-history-entry">${escapeHtml(stepName)}${medicationPart}</div>
    `;
  }).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updateContextItem(element, value) {
  if (!element) return;
  const valueSpan = element.querySelector('.ctx-value');
  if (valueSpan) valueSpan.textContent = value;
  element.classList.remove('empty');
  element.classList.add('active');

  setTimeout(() => element.classList.remove('active'), 500);
}

