import pdf from 'pdf-parse/lib/pdf-parse.js'; // standard esm safe import
import mammoth from 'mammoth';

/**
 * Service to extract text content from various file buffers.
 */
export class ParserService {
  /**
   * Main entrypoint for extracting text based on file format.
   * @param {Buffer} fileBuffer - File buffer from Multer
   * @param {string} originalName - Name of the file with extension
   * @param {string} mimeType - MIME type of the uploaded file
   * @returns {Promise<string>} Clean text contents of the document
   */
  static async extractText(fileBuffer, originalName, mimeType) {
    const extension = originalName.split('.').pop().toLowerCase();

    try {
      if (extension === 'pdf' || mimeType === 'application/pdf') {
        return await this.parsePDF(fileBuffer);
      } else if (
        extension === 'docx' ||
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        return await this.parseDOCX(fileBuffer);
      } else if (extension === 'txt' || mimeType === 'text/plain') {
        return await this.parseTXT(fileBuffer);
      } else {
        throw new Error(`Unsupported file type: .${extension}. Supported formats are PDF, DOCX, and TXT.`);
      }
    } catch (error) {
      console.error(`Error parsing file ${originalName}:`, error);
      throw new Error(`Failed to parse file: ${error.message}`);
    }
  }

  /**
   * Extract text from PDF buffer
   */
  static async parsePDF(fileBuffer) {
    // pdf-parse is sometimes a default export or needs specific import depending on node setup.
    // Using standard pdf-parse default
    const options = {};
    const data = await pdf(fileBuffer, options);
    
    if (!data.text) {
      throw new Error('PDF parsed successfully but no text could be extracted.');
    }
    return data.text;
  }

  /**
   * Extract text from DOCX buffer
   */
  static async parseDOCX(fileBuffer) {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    if (!result || !result.value) {
      throw new Error('DOCX parsed successfully but returned empty content.');
    }
    return result.value;
  }

  /**
   * Extract text from Plain Text (TXT) buffer
   */
  static async parseTXT(fileBuffer) {
    return fileBuffer.toString('utf-8');
  }
}
