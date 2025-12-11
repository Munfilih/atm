import { jsPDF } from 'jspdf';

// This will be populated with base64 font data
let arialNormalBase64 = '';
let arialBoldBase64 = '';

// Load font files and convert to base64
const loadFontFile = async (fontPath: string): Promise<string> => {
    try {
        const response = await fetch(fontPath);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('Error loading font:', error);
        return '';
    }
};

// Initialize and load Arial fonts
export const initializeArialFonts = async (doc: jsPDF): Promise<boolean> => {
    try {
        // Load fonts if not already loaded
        if (!arialNormalBase64) {
            arialNormalBase64 = await loadFontFile(`${import.meta.env.BASE_URL}Fonts/ArialMT_0.ttf`);
        }
        if (!arialBoldBase64) {
            arialBoldBase64 = await loadFontFile(`${import.meta.env.BASE_URL}Fonts/arialbd.ttf`);
        }

        if (arialNormalBase64 && arialBoldBase64) {
            // Add Arial Normal font
            doc.addFileToVFS('Arial-normal.ttf', arialNormalBase64);
            doc.addFont('Arial-normal.ttf', 'Arial', 'normal');

            // Add Arial Bold font
            doc.addFileToVFS('Arial-bold.ttf', arialBoldBase64);
            doc.addFont('Arial-bold.ttf', 'Arial', 'bold');

            return true;
        }
        return false;
    } catch (error) {
        console.error('Error initializing Arial fonts:', error);
        return false;
    }
};
