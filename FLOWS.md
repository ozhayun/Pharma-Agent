# Multi-Step Flows

Three deterministic flows executed by the agent. All flow transitions are code-controlled.

## Flow 1: Medication Information

**Example**: "Tell me about Aspirin"  
**Steps**: COLLECT_MEDICATION_NAME → ASK_INFO_TYPE → PROVIDE_INFO → COMPLETE  
**Tool**: `getMedicationByName({name: "Aspirin"})`  
**Output**: Medication details (active ingredients, dosage instructions)

## Flow 2: Inventory Check

**Example**: "Is Ibuprofen in stock?"  
**Steps**: COLLECT_MEDICATION_NAME → CHECK_INVENTORY → PROVIDE_RESULT → COMPLETE  
**Tools**:

1. `getMedicationByName({name: "Ibuprofen"})`
2. `checkInventory({medicationId: "med-002"})`  
   **Output**: Stock status and availability

## Flow 3: Prescription Confirmation

**Example**: "Do I need a prescription for Amoxicillin?"  
**Steps**: COLLECT_MEDICATION_NAME → CHECK_PRESCRIPTION → PROVIDE_RESULT → COMPLETE  
**Tools**:

1. `getMedicationByName({name: "Amoxicillin"})`
2. `requiresPrescription({medicationId: "med-003"})`  
   **Output**: Prescription requirement (yes/no)

## Flow Transitions (Code-Controlled)

| Current Step            | Condition          | Next Step              |
| ----------------------- | ------------------ | ---------------------- |
| COLLECT_MEDICATION_NAME | Name found         | ASK*INFO_TYPE/CHECK*\* |
| ASK_INFO_TYPE           | Info type provided | PROVIDE_INFO           |
| PROVIDE_INFO            | Data provided      | COMPLETE               |
| CHECK_INVENTORY         | Tool executed      | PROVIDE_RESULT         |
| CHECK_PRESCRIPTION      | Tool executed      | PROVIDE_RESULT         |

## Error Handling

- **Medication not found**: Ask for clarification, stay in current step
- **Invalid input**: Request clarification
- **Tool failure**: Report error, ask user to retry

## Flow Switching

Users can switch between flows mid-conversation. Flow switching handled automatically by intent parser based on user's new request.
