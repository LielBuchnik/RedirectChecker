document.getElementById('csvFileInput').addEventListener('change', enableStartButton);
document.getElementById('startButton').addEventListener('click', handleFileUpload);
document.getElementById('clearButton').addEventListener('click', clearLog);

function enableStartButton(event) {
    document.getElementById('startButton').disabled = !event.target.files.length;
}

let OriginColumn = document.getElementById('originColumn');
let TargetColumn = document.getElementById('targetColumn');

function handleFileUpload() {
    const file = document.getElementById('csvFileInput').files[0];
    const outputElement = document.getElementById('output');
    outputElement.innerHTML = "<span>Starting analysis...</span><br>";

    if (!file) {
        outputElement.innerHTML += "<span>No file selected. Please upload a CSV file.</span><br>";
        return;
    }

    const analysisType = document.querySelector('input[name="analysisType"]:checked').value;
    outputElement.innerHTML += `<span>Analysis type selected: ${analysisType}</span><br>`;

    Papa.parse(file, {
        header: true,
        complete: function (results) {
            const data = results.data;
            if (analysisType === "simple") {
                runSimpleDuplicateChecker(data, outputElement);
            } else {
                runEnhancedRedirectAnalysis(data, outputElement);
            }
            scrollToBottom(outputElement);
        }
    });
}

// Helper function to normalize URLs by removing trailing slashes
function normalizeUrl(url) {
    return url.endsWith('/') ? url.slice(0, -1) : url;
}

// Simple duplicate checker for immediate circular redirects
function runSimpleDuplicateChecker(data, outputElement) {
    let rowNumber = 1;
    const redirectMap = new Map();
    const circularRedirects = [];

    outputElement.innerHTML += "<span>Running Simple Duplicate Checker...</span><br>";
    console.log(OriginColumn.value);
    console.log(TargetColumn.value);

    data.forEach(row => {
        const origin = normalizeUrl(row[OriginColumn.value].trim());
        const target = normalizeUrl(row[TargetColumn.value].trim());

        if (rowNumber % 100 === 0) {
            outputElement.innerHTML += `Checking row ${rowNumber}<br>`;
        }

        if (redirectMap.get(target) === origin) {
            circularRedirects.push({ row: rowNumber, origin, target });
        }

        redirectMap.set(origin, target);
        rowNumber++;
    });

    displayResults(circularRedirects, outputElement);
}

// Enhanced analysis for redirects to root paths that may cause too many redirects
function runEnhancedRedirectAnalysis(data, outputElement) {
    let rowNumber = 1;
    const redirectMap = new Map();
    const rootRedirects = [];

    outputElement.innerHTML += "<span>Running Enhanced Redirect Analysis...</span><br>";

    data.forEach(row => {
        const origin = normalizeUrl(row['Origin'].trim());
        const target = normalizeUrl(row['Target'].trim());

        if (rowNumber % 100 === 0) {
            outputElement.innerHTML += `Checking row ${rowNumber}<br>`;
        }

        if (target === "/" || target === "//") {
            rootRedirects.push({ row: rowNumber, origin, target });
        }

        redirectMap.set(origin, target);
        rowNumber++;
    });

    displayResults(rootRedirects, outputElement);
}

// Display results of the analysis and add option to download CSV if issues are found
function displayResults(results, outputElement) {
    let counter = 0
    if (results.length > 0) {
        results.forEach(issue => {
            const issueElement = document.createElement("span");
            issueElement.classList.add("issue");
            issueElement.style.color = "#00e400";
            issueElement.innerText = `Info - Row ${issue.row}: Redirect analyzed successfully - Origin: ${issue.origin} -> Target: ${issue.target}\n`;
            outputElement.appendChild(issueElement);
            counter++;
        });
        createDownloadButton(results);
    } else {
        outputElement.innerHTML += "<span>No issues found.</span><br>";
    }
    outputElement.innerHTML += `<span>Analysis complete, found total of ${counter} issues.</span>`;
}

// Function to scroll to the bottom of the output container
function scrollToBottom(element) {
    element.scrollTop = element.scrollHeight;
}

// Create or update the "Download Results" button with new CSV data
function createDownloadButton(results) {
    let downloadButton = document.getElementById("downloadCSVButton");
    if (!downloadButton) {
        downloadButton = document.createElement("button");
        downloadButton.innerText = "Download Results as CSV";
        downloadButton.style.marginTop = "10px";
        downloadButton.setAttribute("id", "downloadCSVButton");
        document.body.appendChild(downloadButton);
    }

    // Update the click event with the latest results
    downloadButton.onclick = () => downloadCSV(results);
}

// Function to generate CSV content and initiate download
function downloadCSV(data) {
    const csvContent = "data:text/csv;charset=utf-8," +
        ["Row,Origin,Target", ...data.map(issue => `${issue.row},${issue.origin},${issue.target}`)].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "redirect_issues.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Clear Logs
function clearLog() {
    const outputElement = document.getElementById('output');
    outputElement.innerHTML = `
    <span style="color: #a8a8a8;">Created By: Liel Buchnik</span>
    <span style="color: #a8a8a8;">Last Update: 13th November, 2024</span>`;
}