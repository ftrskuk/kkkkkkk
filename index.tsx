/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {GoogleGenAI} from '@google/genai';

interface Flashcard {
  term: string;
  definition: string;
}

// DOM Elements
const topicInput = document.getElementById('topicInput') as HTMLTextAreaElement;
const generateButton = document.getElementById(
  'generateButton',
) as HTMLButtonElement;
const flashcardsContainer = document.getElementById(
  'flashcardsContainer',
) as HTMLDivElement;
const errorMessage = document.getElementById('errorMessage') as HTMLDivElement;
const themeToggleButton = document.getElementById(
  'theme-toggle',
) as HTMLButtonElement;
const importFileButton = document.getElementById(
  'importFileButton',
) as HTMLButtonElement;
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const exportCsvButton = document.getElementById(
    'exportCsvButton'
) as HTMLButtonElement;


let currentFlashcards: Flashcard[] = [];

// --- Theme Switcher ---
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
const currentTheme = localStorage.getItem('theme');

const applyTheme = (theme: 'dark' | 'light') => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
};

if (currentTheme) {
  applyTheme(currentTheme as 'dark' | 'light');
} else {
  applyTheme(prefersDark.matches ? 'dark' : 'light');
}

themeToggleButton.addEventListener('click', () => {
  const newTheme =
    document.documentElement.getAttribute('data-theme') === 'dark'
      ? 'light'
      : 'dark';
  applyTheme(newTheme);
});

// Listen for system theme changes
prefersDark.addEventListener('change', (e) => {
    // Only apply if user hasn't manually set a theme
    if (!localStorage.getItem('theme')) {
        applyTheme(e.matches ? 'dark' : 'light');
    }
});


// --- File Import ---
importFileButton.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', (event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target?.result;
    if (typeof text === 'string') {
      topicInput.value = text;
      errorMessage.textContent = `File "${file.name}" loaded.`;
      // Clear message after a few seconds
      setTimeout(() => {
        if(errorMessage.textContent === `File "${file.name}" loaded.`) {
            errorMessage.textContent = '';
        }
      }, 3000);
    }
  };
  reader.onerror = () => {
    errorMessage.textContent = `Error reading file: ${reader.error?.message}`;
  };
  reader.readAsText(file);

  // Reset file input so the same file can be loaded again
  target.value = '';
});

// --- CSV Export ---
exportCsvButton.addEventListener('click', () => {
    if (currentFlashcards.length === 0) {
      return;
    }

    // Function to escape CSV fields to handle commas, quotes, and newlines
    const escapeCsvField = (field: string): string => {
      if (/[",\n]/.test(field)) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    const csvHeader = 'Term,Definition\n';
    const csvRows = currentFlashcards.map(card => {
        const term = escapeCsvField(card.term);
        const definition = escapeCsvField(card.definition);
        return `${term},${definition}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.setAttribute('href', url);
    link.setAttribute('download', 'flashcards.csv');
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});


// --- Gemini AI Logic ---
const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

const isUrl = (text: string): boolean => {
  try {
    new URL(text);
    // Basic check for protocol and domain
    return text.startsWith('http://') || text.startsWith('https://');
  } catch (_) {
    return false;
  }
};

const createPrompt = (topic: string): string => {
  if (isUrl(topic)) {
    return `Generate a list of flashcards that summarize the key information from the content at this URL: "${topic}". Each flashcard should have a term and a concise definition. Format the output as a list of "Term: Definition" pairs, with each pair on a new line.
    Example:
    Roman Republic: The period of ancient Roman civilization beginning with the overthrow of the Roman Kingdom.
    Julius Caesar: A Roman general and statesman who played a critical role in the events that led to the demise of the Roman Republic.`;
  }
  return `Generate a list of flashcards for the following topic or text: "${topic}". Each flashcard should have a term and a concise definition. Format the output as a list of "Term: Definition" pairs, with each pair on a new line. Ensure terms and definitions are distinct and clearly separated by a single colon.
  Example output for the topic "Spanish Greetings":
  Hello: Hola
  Goodbye: Adiós`;
};

const displayFlashcards = (flashcards: Flashcard[]) => {
    flashcardsContainer.innerHTML = ''; // Clear previous cards
    currentFlashcards = [];
    exportCsvButton.hidden = true;

    if (flashcards.length > 0) {
        errorMessage.textContent = '';
        currentFlashcards = flashcards;
        exportCsvButton.hidden = false;

        flashcards.forEach((flashcard, index) => {
          const cardDiv = document.createElement('div');
          cardDiv.classList.add('flashcard');
          cardDiv.dataset['index'] = index.toString();
          cardDiv.setAttribute('role', 'button');
          cardDiv.setAttribute('aria-pressed', 'false');
          cardDiv.setAttribute('tabindex', '0');


          const cardInner = document.createElement('div');
          cardInner.classList.add('flashcard-inner');

          const cardFront = document.createElement('div');
          cardFront.classList.add('flashcard-front');
          const termDiv = document.createElement('div');
          termDiv.classList.add('term');
          termDiv.textContent = flashcard.term;

          const cardBack = document.createElement('div');
          cardBack.classList.add('flashcard-back');
          const definitionDiv = document.createElement('div');
          definitionDiv.classList.add('definition');
          definitionDiv.textContent = flashcard.definition;

          cardFront.appendChild(termDiv);
          cardBack.appendChild(definitionDiv);
          cardInner.appendChild(cardFront);
          cardInner.appendChild(cardBack);
          cardDiv.appendChild(cardInner);

          flashcardsContainer.appendChild(cardDiv);

          const flipCard = () => {
             cardDiv.classList.toggle('flipped');
             const isFlipped = cardDiv.classList.contains('flipped');
             cardDiv.setAttribute('aria-pressed', isFlipped.toString());
          };

          cardDiv.addEventListener('click', flipCard);
          cardDiv.addEventListener('keydown', (e) => {
              if(e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  flipCard();
              }
          });
        });
      } else {
        errorMessage.textContent =
          'No valid flashcards could be generated from the response. Please check the format.';
      }
};

generateButton.addEventListener('click', async () => {
  const topic = topicInput.value.trim();
  if (!topic) {
    errorMessage.textContent =
      'Please enter a topic, URL, or import a file.';
    flashcardsContainer.textContent = '';
    return;
  }

  errorMessage.textContent = 'Generating flashcards...';
  flashcardsContainer.textContent = '';
  generateButton.disabled = true;
  exportCsvButton.hidden = true;
  currentFlashcards = [];

  try {
    const prompt = createPrompt(topic);
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    const responseText = result.text ?? '';

    if (responseText) {
      const flashcards: Flashcard[] = responseText
        .split('\n')
        .map((line) => {
          const parts = line.split(':');
          if (parts.length >= 2 && parts[0].trim()) {
            const term = parts[0].trim();
            const definition = parts.slice(1).join(':').trim();
            if (definition) {
              return { term, definition };
            }
          }
          return null;
        })
        .filter((card): card is Flashcard => card !== null);
      
      displayFlashcards(flashcards);

    } else {
      errorMessage.textContent =
        'Failed to generate flashcards or received an empty response. Please try again.';
    }
  } catch (error: unknown) {
    console.error('Error generating content:', error);
    const detailedError =
      (error as Error)?.message || 'An unknown error occurred';
    errorMessage.textContent = `An error occurred: ${detailedError}`;
    flashcardsContainer.textContent = '';
  } finally {
    generateButton.disabled = false;
  }
});