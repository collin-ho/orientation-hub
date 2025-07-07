import React, { useState } from 'react';

function ExpandableText({ text, maxLength = 150, className = "" }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Don't show expand/collapse if text is short enough
  if (!text || text.length <= maxLength) {
    return <p className={className}>{text}</p>;
  }

  const truncatedText = text.slice(0, maxLength);
  const remainingText = text.slice(maxLength);

  return (
    <p className={className}>
      {truncatedText}
      {!isExpanded && (
        <>
          <span>...</span>
          <button
            onClick={() => setIsExpanded(true)}
            className="ml-2 text-sky-400 hover:text-sky-300 font-medium text-sm transition-colors underline decoration-dotted underline-offset-2"
          >
            Show more
          </button>
        </>
      )}
      {isExpanded && (
        <>
          <span>{remainingText}</span>
          <button
            onClick={() => setIsExpanded(false)}
            className="ml-2 text-slate-400 hover:text-slate-300 font-medium text-sm transition-colors underline decoration-dotted underline-offset-2"
          >
            Show less
          </button>
        </>
      )}
    </p>
  );
}

export default ExpandableText; 