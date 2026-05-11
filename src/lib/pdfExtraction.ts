/**
 * PDF Text Extraction Utility
 * Extracts text content from PDF files for skill extraction.
 *
 * Note: This is a basic implementation that extracts text streams from PDFs.
 * For production use with complex PDFs, consider using pdf-parse or similar library.
 */

/**
 * Extracts text from a PDF file buffer
 * @param buffer - The PDF file as an ArrayBuffer
 * @returns Promise resolving to extracted text
 * @throws Error if PDF parsing fails
 */
export async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  try {
    // Convert buffer to string to search for text streams
    const view = new Uint8Array(buffer)
    const decoder = new TextDecoder('utf-8', { ignoreBOM: true })

    // Try to decode the entire buffer as UTF-8 (will skip non-text regions)
    let decodedText = ''
    let i = 0

    while (i < view.length) {
      try {
        // Try to decode in chunks to handle binary regions
        const chunk = view.slice(i, Math.min(i + 1024, view.length))
        const decoded = decoder.decode(chunk, { stream: true })
        decodedText += decoded
        i += 1024
      } catch {
        i += 1
      }
    }

    // Extract text from PDF text objects
    // PDFs store text in BT...ET (Begin Text...End Text) blocks
    const textMatches = decodedText.match(/BT[\s\S]*?ET/g) || []

    let extractedText = ''

    for (const block of textMatches) {
      // Extract text strings enclosed in parentheses or angle brackets
      const stringMatches = block.match(/\((.*?)\)|<(.*?)>/g) || []

      for (const match of stringMatches) {
        // Remove delimiters and decode escape sequences
        let text = match.slice(1, -1)

        // Basic decoding of PDF escape sequences
        text = text
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\\(/g, '(')
          .replace(/\\\)/g, ')')
          .replace(/\\\\/g, '\\')
          .replace(/\\([0-7]{1,3})/g, (match, octal) => {
            const charCode = parseInt(octal, 8)
            return String.fromCharCode(charCode)
          })

        extractedText += text + ' '
      }
    }

    // If no text found in text objects, try to extract from the raw decoded text
    if (extractedText.trim().length === 0) {
      // Fall back to cleaning the decoded text
      extractedText = decodedText
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ') // Keep printable ASCII + whitespace
        .replace(/\s+/g, ' ') // Collapse multiple spaces
        .trim()
    }

    if (extractedText.trim().length === 0) {
      throw new Error('No text content found in PDF')
    }

    return extractedText.trim()
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`PDF text extraction failed: ${error.message}`)
    }
    throw new Error('PDF text extraction failed: Unknown error')
  }
}

/**
 * Validates if a buffer is a valid PDF file
 * @param buffer - The file buffer to validate
 * @returns boolean indicating if the buffer is a valid PDF
 */
export function isValidPDF(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) {
    return false
  }

  const view = new Uint8Array(buffer)

  // PDF files start with %PDF
  if (view[0] !== 0x25 || view[1] !== 0x50 || view[2] !== 0x44 || view[3] !== 0x46) {
    return false
  }

  return true
}
