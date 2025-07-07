require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { generateReport } = require('./services/report-generator');

const run = async () => {
  const className = process.argv[2];

  if (!className) {
    console.error('Error: Please provide a class name as an argument.');
    console.log('Usage: node run-report.js "Your Class Name"');
    process.exit(1);
  }

  try {
    const pdfBuffer = await generateReport(className);
    if (pdfBuffer) {
      const fileName = `report-${className.replace(/\s+/g, '-')}.pdf`;
      const filePath = path.join(__dirname, fileName);
      await fs.writeFile(filePath, pdfBuffer);
      console.log(`Successfully generated report: ${filePath}`);
    } else {
      console.error('Failed to generate report. See logs for details.');
      process.exit(1);
    }
  } catch (error) {
    console.error('An unexpected error occurred:', error);
    process.exit(1);
  }
};

run(); 