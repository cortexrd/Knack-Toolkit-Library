const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const scriptDir = path.dirname(__filename);
const repoDir = path.resolve(scriptDir, '..');
const changelogPath = path.join(repoDir, 'CHANGELOG.md');

const EOL = '\n'; // Force LF line endings regardless of platform

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

    // Process each tag (newest first)
    for (let i = 0; i < relevantTags.length; i++) {
        const tag = relevantTags[i];
        const tagDate = tagDates[tag];

        console.log(`Processing tag: ${tag}`);
        newContent += `\n## ${tag}    *${tagDate}*\n\n`;

        // Get commits for this tag
        let command;
        if (i === 0) {
            // For the newest tag, get commits between the last changelog tag and this tag
            command = `git log ${AFTER_TAG}..${tag} --pretty=format:"%s%n%b%n===COMMIT_SEPARATOR==="`;
        } else {
            // For older tags, get commits between previous tag and this tag
            const previousTag = relevantTags[i - 1];
            command = `git log ${previousTag}..${tag} --pretty=format:"%s%n%b%n===COMMIT_SEPARATOR==="`;
        }

        console.log(`Running command: ${command}`);
        const commitLog = execSync(command, { cwd: repoDir }).toString();
        const commits = commitLog.split('===COMMIT_SEPARATOR===').filter(Boolean);

        console.log(`Found ${commits.length} commits for tag ${tag}`);

        if (commits.length === 0) {
            newContent += `- No additional commits for this version\n`;
            continue;
        }

        // Filter out "Update CHANGELOG.md" and "v-bump" commits and process remaining commits
        const filteredCommits = commits.filter(commit => {
            const subject = commit.trim().split('\n')[0].toLowerCase();
            return !subject.includes('update changelog.md') && !subject.includes('v-bump');
        });

        console.log(`After filtering, ${filteredCommits.length} commits remain for tag ${tag}`);

        if (filteredCommits.length === 0) {
            newContent += `- No additional commits for this version\n`;
            continue;
        }

        filteredCommits.forEach(commit => {
            const lines = commit.trim().split('\n');
            const subject = lines[0];
            newContent += `- ${subject}\n`;

            // Add remaining lines as sub-bullets, but filter out empty lines
            if (lines.length > 1) {
                let lastLineWasEmpty = false;
                lines.slice(1).forEach(line => {
                    const trimmedLine = line.trim();
                    if (trimmedLine) {
                        newContent += `  - ${trimmedLine}\n`;
                        lastLineWasEmpty = false;
                    } else if (!lastLineWasEmpty) {
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
        const headerMatch = existingChangelog.match(/^(# .+?\n\n)/s);
        const header = headerMatch ? headerMatch[1] : '# Knack Toolkit Library Changelog\n\n';

        // Find where the existing content starts (after the header)
        const existingContentStart = existingChangelog.indexOf('\n## ');
        let existingContent = '';
        if (existingContentStart !== -1) {
            existingContent = existingChangelog.substring(existingContentStart);
        }

        // Combine new content with existing changelog
        updatedChangelog = header + newContent + existingContent;
    } else {
        // Create a new changelog
        updatedChangelog = '# Knack Toolkit Library Changelog\n\n' + newContent;
    }

    // Write updated changelog
    updatedChangelog = updatedChangelog.replace(/\r\n/g, EOL);
    fs.writeFileSync(changelogPath, updatedChangelog, { encoding: 'utf8' });

    console.log(`Changelog updated with ${relevantTags.length} new tags.`);

} catch (error) {
    console.error('Error generating changelog:');
    console.error(error.message);
    console.error(error.stderr ? error.stderr.toString() : '');
}