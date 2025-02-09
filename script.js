// Global redirectMap variable to store redirects for all analysis types
let redirectMap;

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
            redirectMap = new Map();

            if (analysisType === "simple") {
                runSimpleDuplicateChecker(data, outputElement);
            } else if (analysisType === "enhanced") {
                runEnhancedRedirectAnalysis(data, outputElement);
            } else if (analysisType === "trailingSlash") {
                runTrailingSlashRedirectCheck(data, outputElement);
            } else if (analysisType === "multiStepRedirect") {
                runMultiStepRedirectCheck(data, outputElement);
            } else if (analysisType === "comprehensive") {
                runComprehensiveAnalysis(data, outputElement);
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
    const circularRedirects = [];
    outputElement.innerHTML += "<span>Running Simple Duplicate Checker...</span><br>";

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
    const rootRedirects = [];
    outputElement.innerHTML += "<span>Running Enhanced Redirect Analysis...</span><br>";

    data.forEach(row => {
        const origin = normalizeUrl(row[OriginColumn.value].trim());
        const target = normalizeUrl(row[TargetColumn.value].trim());

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

// Trailing Slash Redirect Check
function runTrailingSlashRedirectCheck(data, outputElement) {
    let rowNumber = 1;
    const trailingSlashIssues = [];
    outputElement.innerHTML += "<span>Running Trailing Slash Redirect Check...</span><br>";

    data.forEach(row => {
        const origin = row[OriginColumn.value].trim();
        const target = row[TargetColumn.value].trim();

        if (rowNumber % 100 === 0) {
            outputElement.innerHTML += `Checking row ${rowNumber}<br>`;
        }

        if (normalizeUrl(origin) === normalizeUrl(target) && origin !== target) {
            trailingSlashIssues.push({ row: rowNumber, origin, target });
        }

        rowNumber++;
    });

    displayResults(trailingSlashIssues, outputElement);
}

// Comprehensive Analysis for all types of issues
function runComprehensiveAnalysis(data, outputElement) {
    const simpleResults = [];
    const enhancedResults = [];
    const trailingSlashResults = [];

    outputElement.innerHTML += "<span>Running Comprehensive Analysis...</span><br>";

    data.forEach((row, rowNumber) => {
        const origin = row[OriginColumn.value]?.trim();
        const target = row[TargetColumn.value]?.trim();

        if (!origin || !target) return;

        const normalizedOrigin = normalizeUrl(origin);
        const normalizedTarget = normalizeUrl(target);

        // Run simple duplicate check
        if (redirectMap.get(normalizedTarget) === normalizedOrigin) {
            simpleResults.push({ row: rowNumber + 1, origin, target, issueType: 'Simple Duplicate' });
        }

        // Run enhanced redirect check for root
        if (target === "/" || target === "//") {
            enhancedResults.push({ row: rowNumber + 1, origin, target, issueType: 'Enhanced Redirect to Root' });
        }

        // Run trailing slash check
        if (normalizedOrigin === normalizedTarget && origin !== target) {
            trailingSlashResults.push({ row: rowNumber + 1, origin, target, issueType: 'Trailing Slash' });
        }

        redirectMap.set(normalizedOrigin, normalizedTarget);
    });

    // Run duplicate redirect check
    runMultiStepRedirectCheck(data, outputElement);

    const allResults = [...simpleResults, ...enhancedResults, ...trailingSlashResults];

    displayResults(allResults, outputElement);
}

function runMultiStepRedirectCheck(data, outputElement) {
    const redirectMap = new Map(); // Stores direct redirects (origin -> target)
    const rowNumbers = new Map(); // Stores row numbers for each origin
    const fullPaths = new Map(); // Stores full redirect paths
    const optimizedRedirects = []; // Stores suggested optimized redirects

    outputElement.innerHTML += "<span>Checking for multi-step redirects...</span><br>";

    // Step 1: Build the initial redirect mapping
    data.forEach((row, index) => {
        const originKey = OriginColumn.value.trim();
        const targetKey = TargetColumn.value.trim();
        
        const origin = normalizeUrl(row[originKey]?.trim() || "");
        const target = normalizeUrl(row[targetKey]?.trim() || "");

        if (!origin || !target) {
            console.warn(`Skipping row ${index + 1} due to missing origin/target:`, row);
            return; // Ignore rows with missing values
        }

        if (origin === target) {
            console.warn(`Skipping self-redirect on row ${index + 1}: ${origin} -> ${target}`);
            return; // Skip direct self-redirects
        }

        redirectMap.set(origin, target);
        rowNumbers.set(origin, index + 1); // Store the row number
    });

    // Step 2: Find full redirect paths for each origin
    function getRedirectPath(start) {
        let current = start;
        let path = [current];
        let visited = new Set();

        while (redirectMap.has(current) && !visited.has(current)) {
            visited.add(current);
            current = redirectMap.get(current);
            path.push(current);
        }

        return path; // Return the full path
    }

    // Compute full redirect paths for each origin
    redirectMap.forEach((_, origin) => {
        if (!fullPaths.has(origin)) {
            const path = getRedirectPath(origin);
            fullPaths.set(origin, path);
        }
    });

    // Step 3: Identify and suggest direct redirects
    fullPaths.forEach((path, origin) => {
        if (path.length > 2) {
            const finalTarget = path[path.length - 1];

            // Create structured redirect steps with relevant labels
            const redirectSteps = path.map((step, index) => ({
                step: `Redirect ${index + 1}`,
                origin: step,
                target: path[index + 1] || finalTarget
            }));

            // Add the optimized redirect as a separate issue type
            optimizedRedirects.push({
                row: rowNumbers.get(origin) || "Unknown",
                steps: redirectSteps,
                origin,
                target: finalTarget,
                issueType: `Suggested Redirect: ${origin} → ${finalTarget}`
            });
        }
    });

    displayRedirectPaths(optimizedRedirects, outputElement);
    generateRedirectCSV(optimizedRedirects);
}

// Display redirect paths in an organized way
function displayRedirectPaths(results, outputElement) {
    let counter = 0;

    if (results.length > 0) {
        results.forEach(issue => {
            const issueElement = document.createElement("div");
            issueElement.classList.add("issue");
            issueElement.style.color = "#00e400";
            issueElement.style.marginBottom = "15px";

            let pathDetails = `<strong>Info - Row ${issue.row}: ${issue.issueType}</strong><br>`;

            // Display all redirect steps
            issue.steps.forEach(step => {
                pathDetails += `<span style="color: #ffcc00;">${step.step}:</span> ${step.origin} → ${step.target}<br>`;
            });

            // Display the optimized suggested redirect
            pathDetails += `<span style="color: #ff6666;"><strong>Final Suggested Redirect:</strong></span> ${issue.origin} → ${issue.target}<br>`;

            issueElement.innerHTML = pathDetails;

            outputElement.appendChild(issueElement);
            counter++;
        });

        createDownloadButton(results);
    } else {
        outputElement.innerHTML += "<span>No multi-step redirects found.</span><br>";
    }

    outputElement.innerHTML += `<span>Analysis complete, found total of ${counter} multi-step redirects.</span>`;
}

function generateRedirectCSV(data) {
    if (data.length === 0) return;

    let csvHeaders = ["Row", "Issue Type"];
    let maxRedirectSteps = Math.max(...data.map(issue => issue.steps.length));

    // Add Redirect 1, Redirect 2, Redirect 3... columns dynamically
    for (let i = 0; i < maxRedirectSteps; i++) {
        csvHeaders.push(`Redirect ${i + 1}`);
    }
    csvHeaders.push("Suggested Redirect");

    // Build CSV content
    const csvRows = data.map(issue => {
        let row = [issue.row, issue.issueType];

        // Add each redirect step
        for (let i = 0; i < maxRedirectSteps; i++) {
            if (i < issue.steps.length) {
                row.push(`${issue.steps[i].origin} → ${issue.steps[i].target}`);
            } else {
                row.push(""); // Fill empty columns if needed
            }
        }

        // Add final optimized redirect
        row.push(`${issue.origin} → ${issue.target}`);

        return row.join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [csvHeaders.join(","), ...csvRows].join("\n");
    
    // Create a downloadable link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "multi_step_redirects.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


// Display results of the analysis and add option to download CSV if issues are found
function displayResults(results, outputElement) {
    let counter = 0;
    if (results.length > 0) {
        results.forEach(issue => {
            const issueElement = document.createElement("span");
            issueElement.classList.add("issue");
            issueElement.style.color = "#00e400";
            issueElement.innerText = `Info - Row ${issue.row}: ${issue.issueType} - Origin: ${issue.origin} -> Target: ${issue.target}\n`;
            outputElement.appendChild(issueElement);
            counter++;
        });
        createDownloadButton(results);
    } else {
        outputElement.innerHTML += "<span>No issues found.</span><br>";
    }
    outputElement.innerHTML += `<span>Analysis complete, found total of ${counter} issues.</span>`;
}

// Update CSV download to include issue type
function downloadCSV(data) {
    const csvContent = "data:text/csv;charset=utf-8," +
        ["Row,Origin,Target,Issue Type", ...data.map(issue => `${issue.row},${issue.origin},${issue.target},${issue.issueType}`)].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "redirect_issues.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Function to scroll to the bottom of the output container
function scrollToBottom(element) {
    element.scrollTop = element.scrollHeight;
}

// Create or update the "Download Results" button with new CSV data
function createDownloadButton(results) {
    let downloadButton = document.getElementById("downloadCSVButton");
    if (downloadButton) {
        downloadButton.disabled = false;
    }
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

// Clear Logs
function clearLog() {
    const outputElement = document.getElementById('output');
    outputElement.innerHTML = `
    <span style="color: #a8a8a8;">Created By: Liel Buchnik</span>
    <span style="color: #a8a8a8;">Last Update: 13th November, 2024</span>`;
}