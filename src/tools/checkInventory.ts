import { getMedicationById } from '../db/data';
import type { Tool } from './index';

export interface CheckInventoryInput {
  medicationId: string;
}

export interface CheckInventoryOutput {
  success: boolean;
  id?: string;
  stock?: number;
  status?: 'IN_STOCK' | 'OUT_OF_STOCK';
  error?: string;
}

export const checkInventoryTool: Tool = {
  name: 'checkInventory',
  description: 'Returns stock availability for a medication by medication ID. Returns the current stock count. Does not interpret stock levels or provide recommendations.',
  execute: async (params: Record<string, unknown>): Promise<CheckInventoryOutput> => {
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
      stock: medication.stock, // Warehouse System: Return ONLY stock
      status: medication.stock > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
    };
  },
};

