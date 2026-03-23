/**
 * Elysium Vanguard: Semantic Telemetry Middleware
 * Filters raw system noise and extracts high-signal engineering data.
 */

function filterLogcat(rawLog) {
  // Regex to capture stack traces and common error patterns
  const patterns = [
    /Exception/i,
    /Error/i,
    /Fail/i,
    /at\s+[\w\.]+\([\w\.]+\.java:\d+\)/, // Java stack trace line
    /Caused by:/i,
    /FATAL EXCEPTION/i
  ];

  const lines = rawLog.split('\n');
  const filteredLines = lines.filter(line => patterns.some(p => p.test(line)));
  
  if (filteredLines.length === 0) return null; // No relevant signal
  return filteredLines.join('\n');
}

function filterGradle(rawOutput) {
  // Extract build failures and specific task errors
  if (rawOutput.includes('BUILD FAILED')) {
    const errorMatch = rawOutput.match(/> Task (.*) FAILED.*?\n([\s\S]*)/m);
    return errorMatch ? errorMatch[0] : "GRADLE_BUILD_FAILED_UNSPECIFIED";
  }
  
  if (rawOutput.includes('BUILD SUCCESSFUL')) {
    return "GRADLE_BUILD_SUCCESSFUL";
  }

  return null; // Skip non-essential progress logs
}

module.exports = {
  process: (type, data) => {
    if (type === 'logcat') return filterLogcat(data);
    if (type === 'gradle') return filterGradle(data);
    return data; // Default
  }
};
