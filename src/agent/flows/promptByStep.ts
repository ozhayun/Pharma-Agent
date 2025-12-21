export const STEP_PROMPTS = {
  MEDICATION_INFO: {
    COLLECT_MEDICATION_NAME: `If the user provides a medication name, you MUST immediately call the getMedicationByName tool with that name. Do NOT ask for the medication name again if the user has already provided it. If no medication name has been provided yet, gently ask if they have a specific medication they would like information about. Be conversational and not demanding. CRITICAL: Always end with a follow-up question in the user's language. In English: "Is there a medication you'd like to know about?" or "What medication can I help you with?" In Hebrew: "יש תרופה מסוימת שתרצה לדעת עליה?" or "איזו תרופה אוכל לעזור לך?"`,

    ASK_INFO_TYPE: `Ask which information they want. Keep it brief - one sentence. Do NOT say "you can pick more than one" - users can only select one option at a time. CRITICAL: Always end with a follow-up question in the user's language. In English: "What would you like to know?" or "Which information can I provide?" In Hebrew: "מה תרצה לדעת?" or "איזה מידע אוכל לספק?"`,

    PROVIDE_INFO: `Provide the requested information type (shown in context as requested_info) for the current medication. If the user asks about a different medication but you already have a requested_info type, use that same type for the new medication. Be brief. CRITICAL: Always end with a follow-up question in the user's language. In English: "Is there anything else I can help you with?" or "Would you like to know anything else about this medication?" In Hebrew: "האם יש עוד משהו שאוכל לעזור לך?" or "תרצה לדעת משהו נוסף על התרופה הזו?"`,

    COMPLETE: `Flow complete. CRITICAL: Always end with a follow-up question in the user's language. In English: "Is there anything else I can help you with?" or "How else can I assist you today?" In Hebrew: "האם יש עוד משהו שאוכל לעזור לך?" or "איך עוד אוכל לעזור לך היום?" Be brief and friendly.`,
  },

  INVENTORY_CHECK: {
    COLLECT_MEDICATION_NAME: `Ask for the medication name. End with a follow-up question like "Which medication would you like to check?" or "What medication are you looking for?"`,

    CHECK_INVENTORY: `Execute checkInventory tool.`,

    PROVIDE_RESULT: `Report the stock status briefly. CRITICAL: Always end with a follow-up question in the user's language. In English: "Is there anything else I can help you with?" or "Would you like to check another medication?" In Hebrew: "האם יש עוד משהו שאוכל לעזור לך?" or "תרצה לבדוק תרופה נוספת?"`,

    COMPLETE: `Flow complete. CRITICAL: Always end with a follow-up question in the user's language. In English: "Is there anything else I can help you with?" or "How else can I assist you today?" In Hebrew: "האם יש עוד משהו שאוכל לעזור לך?" or "איך עוד אוכל לעזור לך היום?" Be brief and friendly.`,
  },

  PRESCRIPTION_CONFIRMATION: {
    COLLECT_MEDICATION_NAME: `Ask for the medication name. End with a follow-up question like "Which medication would you like to check?" or "What medication are you asking about?"`,

    CHECK_PRESCRIPTION: `Execute requiresPrescription tool.`,

    PROVIDE_RESULT: `Report the prescription requirement briefly. CRITICAL: Always end with a follow-up question in the user's language. In English: "Is there anything else I can help you with?" or "Would you like to check another medication?" In Hebrew: "האם יש עוד משהו שאוכל לעזור לך?" or "תרצה לבדוק תרופה נוספת?"`,

    COMPLETE: `Flow complete. CRITICAL: Always end with a follow-up question in the user's language. In English: "Is there anything else I can help you with?" or "How else can I assist you today?" In Hebrew: "האם יש עוד משהו שאוכל לעזור לך?" or "איך עוד אוכל לעזור לך היום?" Be brief and friendly.`,
  },

  COMMON: {
    UNKNOWN_STEP: `Unknown step`,
  },
};

