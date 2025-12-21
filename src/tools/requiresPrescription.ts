import { getMedicationById } from '../db/data';
import type { Tool } from './index';

export interface RequiresPrescriptionInput {
  medicationId: string;
}

export interface RequiresPrescriptionOutput {
  success: boolean;
  id?: string;
  prescriptionRequired?: boolean;
  error?: string;
}

export const requiresPrescriptionTool: Tool = {
  name: 'requiresPrescription',
  description: 'Returns whether a medication requires a prescription by medication ID. Returns a boolean value indicating prescription requirement. Does not validate prescriptions or user eligibility.',
  execute: async (params: Record<string, unknown>): Promise<RequiresPrescriptionOutput> => {
    const { medicationId } = params;

    if (!medicationId || typeof medicationId !== 'string' || medicationId.trim().length === 0) {
      return {
        success: false,
        error: 'Medication ID is required and must be a non-empty string',
      };
    }

    const medication = getMedicationById(medicationId);

    if (!medication) {
      return {
        success: false,
        error: `Medication with ID "${medicationId}" not found in the database`,
      };
    }

    return {
      success: true,
      id: medication.id,
      prescriptionRequired: medication.prescriptionRequired,
    };
  },
};

