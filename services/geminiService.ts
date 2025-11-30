import { GoogleGenAI } from "@google/genai";
import { Transaction, Account } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateFinancialAdvice = async (
  transactions: Transaction[],
  accounts: Account[],
  userQuery: string
): Promise<string> => {
  
  if (!process.env.API_KEY) {
    return "Error: Gemini API Key is missing. Please check your .env configuration.";
  }

  // Summarize Assets
  const assetsSummary = accounts.map(a => 
    `- ${a.name}: ${a.balance.toFixed(2)} ${a.currency}`
  ).join('\n');

  // Summarize Spending
  const txSummary = transactions.map(t => 
    `- ${t.date.split('T')[0]}: ${t.type.toUpperCase()} of ${t.amount.toFixed(2)} ${t.currency} for ${t.category} (${t.description})`
  ).join('\n');

  const prompt = `
    You are an expert Virtual CFO and financial advisor.
    
    Current Financial Snapshot (Assets):
    ${assetsSummary || "No accounts found."}

    Recent Activity (Last 30 Days):
    ${txSummary || "No transactions found in the last 30 days."}

    User Question: "${userQuery}"

    Instructions:
    1. Analyze the spending patterns AND the current account balances.
    2. If the user asks about affordability, check if they have enough balance in the relevant currency/account.
    3. Provide a concise, friendly, and actionable answer.
    4. Format the response with Markdown for readability.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "I couldn't generate a response at this time.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sorry, I encountered an error while consulting the financial models. Please try again later.";
  }
};