import { FormData } from 'form-data';
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const imageParts = formData.getAll('image') as Bio[];
    const isProMode = formData.get('isPro') === 'true';
    const query = formData.get('query') as string;
    const model = isProMode ? (process.env.OPENAI_PRO_MODEL || 'gpt-4o') : (process.env.OPENAI_MODEL || 'gpt-4o-mini');
    const response = await fetch('https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}