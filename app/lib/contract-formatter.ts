/**
 * Utility functions for formatting contract content as HTML
 */

// Function to format inline text (bold, italic, etc.)
export const formatInlineText = (text: string): string => {
  return (
    text
      // Bold text - handle both ** and plain bold patterns
      .replace(
        /\*\*(.*?)\*\*/g,
        '<strong class="font-bold text-gray-900">$1</strong>'
      )
      // Italic text
      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
      // Code spans
      .replace(
        /`(.*?)`/g,
        '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">$1</code>'
      )
      // Escaped dollar signs
      .replace(/\\\$/g, "$")
      // Checkboxes - convert [ ] to styled checkboxes
      .replace(
        /\[\s*\]/g,
        '<span class="inline-flex items-center w-4 h-4 border border-gray-400 rounded mr-2"></span>'
      )
      .replace(
        /\[x\]/gi,
        '<span class="inline-flex items-center w-4 h-4 bg-blue-500 border border-blue-500 rounded mr-2 text-white text-xs justify-center">✓</span>'
      )
      // Simple emphasis for caps (but not for single cap words)
      .replace(
        /\b([A-Z]{3,})\b/g,
        '<span class="font-semibold text-gray-800">$1</span>'
      )
      // Currency amounts - style dollar amounts
      .replace(
        /\$([0-9,]+(?:\.[0-9]{2})?)/g,
        '<span class="font-semibold text-green-700">$$$1</span>'
      )
  );
};

// Function to format contract content as HTML
export const formatContractContent = (content: string): string => {
  if (!content) return "";

  const lines = content.split("\n");
  let formattedLines: string[] = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Empty lines
    if (line === "") {
      if (inList) {
        formattedLines.push("</ul>");
        inList = false;
      }
      formattedLines.push("<br/>");
      continue;
    }

    // Horizontal rules (--- lines)
    if (line === "---" || line === "***" || /^-{3,}$/.test(line)) {
      if (inList) {
        formattedLines.push("</ul>");
        inList = false;
      }
      formattedLines.push('<hr class="border-t-2 border-gray-300 my-6"/>');
      continue;
    }

    // Headers (markdown style)
    if (line.startsWith("# ")) {
      if (inList) {
        formattedLines.push("</ul>");
        inList = false;
      }
      formattedLines.push(
        `<h1 class="text-2xl font-bold text-gray-900 mb-4 mt-6">${formatInlineText(
          line.substring(2)
        )}</h1>`
      );
    } else if (line.startsWith("## ")) {
      if (inList) {
        formattedLines.push("</ul>");
        inList = false;
      }
      formattedLines.push(
        `<h2 class="text-xl font-semibold text-gray-900 mb-3 mt-5">${formatInlineText(
          line.substring(3)
        )}</h2>`
      );
    } else if (line.startsWith("### ")) {
      if (inList) {
        formattedLines.push("</ul>");
        inList = false;
      }
      formattedLines.push(
        `<h3 class="text-lg font-medium text-gray-900 mb-2 mt-4">${formatInlineText(
          line.substring(4)
        )}</h3>`
      );
    }
    // Numbered sections (e.g., "1. TERMS", "**1. TERMS**")
    else if (/^\*?\*?(\d+)\.\s*(.+?)\*?\*?$/.test(line)) {
      if (inList) {
        formattedLines.push("</ul>");
        inList = false;
      }
      const match = line.match(/^\*?\*?(\d+)\.\s*(.+?)\*?\*?$/);
      if (match) {
        const [, number, title] = match;
        formattedLines.push(
          `<h3 class="text-lg font-bold text-gray-900 mb-3 mt-6 pb-2 border-b border-gray-200">
            <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded mr-3">${number}</span>
            ${formatInlineText(title)}
          </h3>`
        );
      }
    }
    // List items - detect various list patterns
    else if (
      line.startsWith("- ") ||
      line.startsWith("* ") ||
      /^\d+\.\s/.test(line) ||
      // Detect items that are likely list items (single line, descriptive)
      (/^[A-Z][a-z]/.test(line) &&
        line.length < 80 &&
        !line.includes(":") &&
        i > 0 &&
        lines[i - 1] &&
        (lines[i - 1].includes(":") || lines[i - 1].endsWith("for:")))
    ) {
      if (!inList) {
        formattedLines.push(
          '<ul class="list-disc list-inside mb-4 space-y-2 ml-4">'
        );
        inList = true;
      }
      const content = line.startsWith("- ")
        ? line.substring(2)
        : line.startsWith("* ")
        ? line.substring(2)
        : /^\d+\.\s/.test(line)
        ? line.replace(/^\d+\.\s/, "")
        : line;
      formattedLines.push(
        `<li class="text-gray-700">${formatInlineText(content)}</li>`
      );
    }
    // Field/value pairs (e.g., "Monthly Rent: $2500")
    else if (line.includes(":") && !line.endsWith(":")) {
      if (inList) {
        formattedLines.push("</ul>");
        inList = false;
      }
      const [label, ...valueParts] = line.split(":");
      const value = valueParts.join(":").trim();
      formattedLines.push(
        `<div class="flex flex-wrap items-baseline mb-2">
          <span class="font-medium text-gray-800 mr-2">${formatInlineText(
            label.trim()
          )}:</span>
          <span class="text-gray-700">${formatInlineText(value)}</span>
        </div>`
      );
    }
    // Section headers ending with colon (e.g., "Refundable within 30 days:")
    else if (line.endsWith(":")) {
      if (inList) {
        formattedLines.push("</ul>");
        inList = false;
      }
      formattedLines.push(
        `<h4 class="font-semibold text-gray-800 mb-2 mt-4">${formatInlineText(
          line
        )}</h4>`
      );
    }
    // Bold standalone titles (surrounded by **)
    else if (line.startsWith("**") && line.endsWith("**") && line.length > 4) {
      if (inList) {
        formattedLines.push("</ul>");
        inList = false;
      }
      const title = line.substring(2, line.length - 2);
      // Check if it's a main title (all caps or title case)
      if (title === title.toUpperCase() || title.length < 50) {
        formattedLines.push(
          `<h2 class="text-xl font-bold text-gray-900 mb-4 mt-6 text-center">${formatInlineText(
            title
          )}</h2>`
        );
      } else {
        formattedLines.push(
          `<h3 class="text-lg font-semibold text-gray-900 mb-3 mt-4">${formatInlineText(
            title
          )}</h3>`
        );
      }
    }
    // Regular paragraphs
    else {
      if (inList) {
        formattedLines.push("</ul>");
        inList = false;
      }

      // Check if this looks like a section heading (all caps, short line)
      if (
        line.length < 50 &&
        line === line.toUpperCase() &&
        /^[A-Z\s]+$/.test(line)
      ) {
        formattedLines.push(
          `<h3 class="text-lg font-semibold text-gray-900 mb-3 mt-5 text-center tracking-wide">${line}</h3>`
        );
      } else {
        formattedLines.push(
          `<p class="text-gray-700 mb-3 leading-relaxed">${formatInlineText(
            line
          )}</p>`
        );
      }
    }
  }

  // Close any open list
  if (inList) {
    formattedLines.push("</ul>");
  }

  return formattedLines.join("\n");
};

// Component props for formatted contract content
export interface FormattedContractProps {
  content: string;
  className?: string;
  maxHeight?: string;
}

// Helper function to get formatted contract HTML with container
export const getFormattedContractHTML = (
  content: string,
  maxHeight: string = "max-h-96"
): string => {
  return `<div class="prose max-w-none ${maxHeight} overflow-y-auto">${formatContractContent(
    content
  )}</div>`;
};

// JSX-ready props for dangerouslySetInnerHTML
export const getFormattedContractProps = (content: string) => ({
  dangerouslySetInnerHTML: {
    __html: formatContractContent(content),
  },
});

// Address display component props
export interface AddressDisplayProps {
  address: string;
  maxLength?: number;
  clipboard?: boolean;
  className?: string;
}
