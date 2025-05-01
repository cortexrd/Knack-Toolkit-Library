const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const scriptDir = path.dirname(__filename);
const repoDir = path.resolve(scriptDir, '..');
const changelogPath = path.join(repoDir, 'CHANGELOG.md');

console.log(`Working in repository: ${repoDir}`);
console.log(`Using changelog: ${changelogPath}`);

try {
    // Check if changelog exists and read it
    console.log('Checking for existing changelog...');
    let existingChangelog = '';
    let AFTER_TAG = '';

    if (fs.existsSync(changelogPath)) {
        existingChangelog = fs.readFileSync(changelogPath, 'utf8');
        console.log('Existing changelog found.');

        // Extract most recent tag from changelog
        const tagMatch = existingChangelog.match(/^## ([\d\.]+)/m);
        if (tagMatch) {
            AFTER_TAG = tagMatch[1];
            console.log(`Found most recent tag in changelog: ${AFTER_TAG}`);
        } else {
            console.log('No tag found in existing changelog.');
            // We'll handle this case below
        }
    } else {
        console.log('No existing changelog found. Will create new file.');
    }

    // If no tag found in changelog or file doesn't exist, use a fallback approach
    if (!AFTER_TAG) {
        console.log('No tag reference found. Using default starting tag: 0.27.10');
        AFTER_TAG = '0.27.10';
    }

    // Get all tags sorted by version number (newest first)
    console.log('Getting all tags...');
    const allTags = execSync('git tag --sort=-v:refname', { cwd: repoDir }).toString().trim().split('\n').filter(Boolean);

    // Find index of the "after" tag
    const afterTagIndex = allTags.indexOf(AFTER_TAG);
    if (afterTagIndex === -1) {
        throw new Error(`Tag ${AFTER_TAG} not found in repository`);
    }

    // Get all tags newer than the "after" tag
    const relevantTags = allTags.slice(0, afterTagIndex);
    console.log(`Found ${relevantTags.length} tags after ${AFTER_TAG}: ${relevantTags.join(', ')}`);

    if (relevantTags.length === 0) {
        console.log('No new tags found. Nothing to update.');
        process.exit(0);
    }

    // Get dates for all relevant tags
    const tagDates = {};
    console.log('Getting dates for all tags...');
    relevantTags.forEach(tag => {
        const dateStr = execSync(`git log -1 --format=%ad --date=short ${tag}`, { cwd: repoDir }).toString().trim();
        tagDates[tag] = dateStr;
        console.log(`Tag ${tag} was created on ${dateStr}`);
    });

    // Initialize new content
    let newContent = '';

    // Process each tag
    for (let i = 0; i < relevantTags.length; i++) {
        const tag = relevantTags[i];
        const nextTag = relevantTags[i + 1]; // Next in array = previous chronologically
        const tagDate = tagDates[tag];

        console.log(`Processing tag: ${tag}`);
        newContent += `\n## ${tag}    *${tagDate}*\n\n`;

        // Get commits for this tag
        let command;
        if (i === relevantTags.length - 1) {
            // For the oldest relevant tag (one right after AFTER_TAG),
            // get commits between AFTER_TAG and this tag
            command = `git log ${AFTER_TAG}..${tag} --pretty=format:"%s%n%b%n===COMMIT_SEPARATOR==="`;
        } else if (nextTag) {
            // For tags in the middle, get commits between next tag and this tag
            command = `git log ${nextTag}..${tag} --pretty=format:"%s%n%b%n===COMMIT_SEPARATOR==="`;
        } else {
            // For newest tag, get commits between tag and HEAD
            command = `git log ${tag}..HEAD --pretty=format:"%s%n%b%n===COMMIT_SEPARATOR==="`;
        }

        const commitLog = execSync(command, { cwd: repoDir }).toString();
        const commits = commitLog.split('===COMMIT_SEPARATOR===').filter(Boolean);

        console.log(`Found ${commits.length} commits for tag ${tag}`);

        if (commits.length === 0) {
            newContent += `- No additional commits for this version\n`;
            continue;
        }

        commits.forEach(commit => {
            const lines = commit.trim().split('\n');
            const subject = lines[0];
            newContent += `- ${subject}\n`;

            // Add remaining lines as sub-bullets, but filter out empty lines
            if (lines.length > 1) {
                // Get consecutive empty lines (to remove them)
                let lastLineWasEmpty = false;
                lines.slice(1).forEach(line => {
                    const trimmedLine = line.trim();
                    if (trimmedLine) {
                        newContent += `  - ${trimmedLine}\n`;
                        lastLineWasEmpty = false;
                    } else if (!lastLineWasEmpty) {
                        // Keep single empty lines to maintain paragraph structure
                        // but skip consecutive empty lines
                        lastLineWasEmpty = true;
                    }
                });
            }
        });
    }

    // Create or update the changelog file
    let updatedChangelog = '';
    if (existingChangelog) {
        // Get title and intro from existing changelog
        const headerMatch = existingChangelog.match(/^(# .+?\n\n.+?\n\n)/s);
        const header = headerMatch ? headerMatch[1] : '# Knack Toolkit Library Changelog\n\n';

        // Combine new content with existing changelog
        updatedChangelog = header + newContent + existingChangelog.substring(header.length);
    } else {
        // Create a new changelog
        updatedChangelog = '# Knack Toolkit Library Changelog\n\nChangelog for Knack Toolkit Library\n\n' + newContent;
    }

    // Write updated changelog
    fs.writeFileSync(changelogPath, updatedChangelog);
    console.log(`Changelog updated with ${relevantTags.length} new tags.`);

} catch (error) {
    console.error('Error generating changelog:');
    console.error(error.message);
    console.error(error.stderr ? error.stderr.toString() : '');
}