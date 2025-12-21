import type { FlowState } from '../../flows';
import {
  MedicationInfoStep,
  InventoryCheckStep,
  PrescriptionConfirmationStep,
} from '../../flows';
import { extractMedicationData } from './contextBuilders';

/**
 * Builds context lines for inventory check flow
 */
export function buildInventoryCheckContext(
  flowState: FlowState,
  step: InventoryCheckStep,
  extractedMedicationName?: string
): string[] {
  const contextLines: string[] = [];
  
  if (step === InventoryCheckStep.COLLECT_MEDICATION_NAME) {
    if (extractedMedicationName && !flowState.sharedSlots.medicationName) {
      contextLines.push(
        `The user has provided a medication name: "${extractedMedicationName}". ` +
        `You MUST call getMedicationByName tool with exactly this name: "${extractedMedicationName}". ` +
        `After getting the medication, proceed to check inventory.`
      );
    } else if (!flowState.sharedSlots.medicationName) {
      contextLines.push(`Ask the user which medication they would like to check stock for.`);
    }
  } else if (step === InventoryCheckStep.PROVIDE_RESULT) {
    if (flowState.sharedSlots.lastToolResult) {
      const lastResult = flowState.sharedSlots.lastToolResult;
      if (lastResult &&
          typeof lastResult === 'object' &&
          lastResult !== null &&
          'success' in lastResult &&
          (lastResult as { success: boolean }).success === true) {
        contextLines.push(`Stock data from checkInventory tool: ${JSON.stringify(lastResult)}`);
      }
    }
    contextLines.push(
      `You have stock data from the checkInventory tool (shown above). ` +
      `Report the stock status briefly using that data. ` +
      `DO NOT call any tools - the data is already available in the conversation history.`
    );
  } else if (step === InventoryCheckStep.CHECK_INVENTORY) {
    contextLines.push(`Call checkInventory tool to get stock information.`);
  }
  
  return contextLines;
}

/**
 * Builds context lines for prescription confirmation flow
 */
export function buildPrescriptionConfirmationContext(
  flowState: FlowState,
  step: PrescriptionConfirmationStep
): string[] {
  const contextLines: string[] = [];
  
  if (step === PrescriptionConfirmationStep.PROVIDE_RESULT) {
    if (flowState.sharedSlots.lastToolResult) {
      const lastResult = flowState.sharedSlots.lastToolResult;
      if (lastResult &&
          typeof lastResult === 'object' &&
          lastResult !== null &&
          'success' in lastResult &&
          (lastResult as { success: boolean }).success === true) {
        contextLines.push(
          `Prescription data from requiresPrescription tool: ${JSON.stringify(lastResult)}`
        );
      }
    }
    contextLines.push(
      `You have prescription requirement data from the requiresPrescription tool (shown above). ` +
      `Report the prescription requirement briefly using that data. ` +
      `DO NOT call any tools - the data is already available in the conversation history.`
    );
  } else if (step === PrescriptionConfirmationStep.CHECK_PRESCRIPTION) {
    contextLines.push(`Call requiresPrescription tool to check prescription requirement.`);
  }
  
  return contextLines;
}

/**
 * Builds context lines for medication info flow
 */
export function buildMedicationInfoContext(
  flowState: FlowState,
  step: MedicationInfoStep,
  requestedInfoType?: string,
  extractedMedicationName?: string
): string[] {
  const contextLines: string[] = [];
  
  if (step === MedicationInfoStep.COLLECT_MEDICATION_NAME) {
    if (!flowState.sharedSlots.medicationName) {
      if (extractedMedicationName) {
        contextLines.push(
          `The user has provided a medication name: "${extractedMedicationName}". ` +
          `You MUST call getMedicationByName tool with exactly this name: "${extractedMedicationName}". ` +
          `After getting the medication, ask what information they want: ` +
          `active ingredients, dosage instructions, prescription requirement, or stock availability.`
        );
      } else {
        contextLines.push(
          `Ask the user if they have a specific medication they would like information about. ` +
          `Be conversational and friendly. ` +
          `Do NOT call any tools until the user provides a medication name.`
        );
      }
    } else {
      const hasRequestedInfoType = requestedInfoType;
      if (!hasRequestedInfoType) {
        contextLines.push(
          `You already have the medication (${flowState.sharedSlots.medicationName}). ` +
          `Ask what information they want: active ingredients, dosage instructions, ` +
          `prescription requirement, or stock availability.`
        );
      }
    }
  } else if (step === MedicationInfoStep.COMPLETE) {
    if (flowState.sharedSlots.medicationName) {
      contextLines.push(
        `You have information about ${flowState.sharedSlots.medicationName} available. ` +
        `If the user mentions symptoms or asks unrelated questions, politely explain that ` +
        `you can only provide medication information (active ingredients, dosage, ` +
        `prescription requirement, stock availability) and redirect them to what you can help with.`
      );
    } else {
      contextLines.push(
        `If the user mentions symptoms or asks unrelated questions, politely explain that ` +
        `you can only provide medication information and ask how you can help with medications.`
      );
    }
  } else if (step === MedicationInfoStep.ASK_INFO_TYPE) {
    if (!requestedInfoType) {
      contextLines.push(
        `Ask the user which single type of information they want: ` +
        `active ingredients, dosage instructions, prescription requirement, or stock availability.`
      );
    } else {
      contextLines.push(`The user has selected ${requestedInfoType}. Provide this information now.`);
    }
  } else if (step === MedicationInfoStep.PROVIDE_INFO) {
    const medicationData = extractMedicationData(flowState);
    
    if (medicationData) {
      contextLines.push(`Medication Data: ${JSON.stringify(medicationData)}`);
    }
    
    if (requestedInfoType) {
      if (requestedInfoType === 'stock') {
        contextLines.push(`Call checkInventory tool to get stock information.`);
      } else if (requestedInfoType === 'prescription') {
        contextLines.push(`Call requiresPrescription tool to check prescription requirement.`);
      } else if (requestedInfoType === 'dosage') {
        if (medicationData) {
          contextLines.push(
            `The user wants dosage instructions. Use ONLY the exact dosageInstructions field ` +
            `from the Medication Data above. DO NOT add, modify, or infer any information. ` +
            `Report ONLY what is in the data - do NOT add pediatric dosing, age-specific ` +
            `instructions, or any information not explicitly provided. ` +
            `DO NOT call any tools - the data is already available.`
          );
        } else {
          contextLines.push(
            `The user wants dosage instructions. Find the dosageInstructions field from the ` +
            `getMedicationByName tool result in the conversation history above. ` +
            `Use ONLY that exact data. DO NOT add, modify, or infer any information. ` +
            `Report ONLY what is in the data - do NOT add pediatric dosing, age-specific ` +
            `instructions, or any information not explicitly provided. ` +
            `DO NOT call any tools - the data is in the conversation history.`
          );
        }
      } else if (requestedInfoType === 'active_ingredients') {
        if (medicationData) {
          contextLines.push(
            `The user wants active ingredients. Use ONLY the exact activeIngredients field ` +
            `from the Medication Data above. DO NOT add, modify, or infer any information. ` +
            `DO NOT call any tools - the data is already available.`
          );
        } else {
          contextLines.push(
            `The user wants active ingredients. Find the activeIngredients field from the ` +
            `getMedicationByName tool result in the conversation history above. ` +
            `Use ONLY that exact data. DO NOT add, modify, or infer any information. ` +
            `DO NOT call any tools - the data is in the conversation history.`
          );
        }
      } else {
        contextLines.push(
          `Provide information about ${requestedInfoType} using ONLY the exact data from the ` +
          `Medication Data above. DO NOT add, modify, or infer any information.`
        );
      }
    } else {
      contextLines.push(`Ask the user what information they want to know.`);
    }
  }
  
  return contextLines;
}

