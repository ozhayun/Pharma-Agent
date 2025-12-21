export enum FlowType {
  MEDICATION_INFO = 'medication_info',
  INVENTORY_CHECK = 'inventory_check',
  PRESCRIPTION_CONFIRMATION = 'prescription_confirmation',
}

export enum MedicationInfoStep {
  COLLECT_MEDICATION_NAME = 'collect_medication_name',
  ASK_INFO_TYPE = 'ask_info_type',
  PROVIDE_INFO = 'provide_info',
  COMPLETE = 'complete',
}

export enum InventoryCheckStep {
  COLLECT_MEDICATION_NAME = 'collect_medication_name',
  CHECK_INVENTORY = 'check_inventory',
  PROVIDE_RESULT = 'provide_result',
  COMPLETE = 'complete',
}

export enum PrescriptionConfirmationStep {
  COLLECT_MEDICATION_NAME = 'collect_medication_name',
  CHECK_PRESCRIPTION = 'check_prescription',
  PROVIDE_RESULT = 'provide_result',
  COMPLETE = 'complete',
}

export type FlowStep =
  | MedicationInfoStep
  | InventoryCheckStep
  | PrescriptionConfirmationStep;

export interface LastPresentedText {
  content: string;
  language: 'en' | 'he';
  type: 'medication_info' | 'stock' | 'prescription' | 'dosage' | 'ingredient' | 'general';
}

export interface ParsedUserIntent {
  intent: 'check_stock' | 'request_medication_info' | 'check_prescription' | 'confirm_yes' | 'unknown';
  requestedInfoType?: 'stock' | 'dosage' | 'active_ingredients' | 'prescription';
  refersToLastResponse?: boolean;
  containsMedicationName?: boolean;
  isGreetingOrSmallTalk?: boolean;
  extractedMedicationName?: string | null;
}

export interface FlowSlots {
  medicationName?: string;
  medicationId?: string;
  lastToolResult?: unknown;
  requestedInfoType?: string;
  lastPresentedText?: LastPresentedText;
  pendingIntent?: 'check_stock' | 'request_medication_info' | 'check_prescription' | null;
  pendingInfoType?: 'stock' | 'dosage' | 'active_ingredients' | 'prescription' | null;
  medicationData?: {
    id: string;
    name: string;
    activeIngredients: string[];
    dosageInstructions: string;
    hebrew?: {
      name?: string;
      activeIngredients?: string[];
      dosageInstructions?: string;
    };
  };
}

export interface SingleFlowState {
  step: FlowStep | null;
  slots: Partial<FlowSlots>;
  isActive: boolean;
}

export interface ToolHistoryEntry {
  name: string;
  description: string;
  timestamp: number;
  medicationName?: string;
}

export interface MedicationHistoryEntry {
  name: string;
  timestamp: number;
}

export interface FlowHistoryEntry {
  flowType: FlowType;
  timestamp: number;
  medicationName?: string;
}

export interface StepHistoryEntry {
  step: FlowStep;
  timestamp: number;
  medicationName?: string;
}

export interface FlowState {
  flows: Partial<Record<FlowType, SingleFlowState>>;
  sharedSlots: FlowSlots;
  language: 'en' | 'he';
  toolHistory: ToolHistoryEntry[];
  medicationHistory?: MedicationHistoryEntry[];
  flowHistory?: FlowHistoryEntry[];
  stepHistory?: StepHistoryEntry[];
  _activeFlowType?: FlowType;
}

export interface FlowDefinition {
  type: FlowType;
  steps: FlowStep[];
  requiredSlots: (keyof FlowSlots)[];
  getStepDescription: (step: FlowStep) => string;
  getToolForStep?: (step: FlowStep) => string | null;
  transitions: (currentStep: FlowStep | null, state: FlowState, parsedIntent: ParsedUserIntent) => FlowStep | null;
  isValidIntentForStep?: (step: FlowStep | null, parsedIntent: ParsedUserIntent) => boolean;
}