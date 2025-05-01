const { execSync } = require('child_process');
const fs = require('fs');

// Configuration
const AFTER_TAG = '0.27.10'; // We want commits AFTER this tag (exclusive)
const outputFile = 'CHANGELOG.md';

console.log(`Generating changelog for commits AFTER tag ${AFTER_TAG}...`);

try {
    // Get all tags sorted by version number (newest first)
    console.log('Getting all tags...');
    const allTags = execSync('git tag --sort=-v:refname').toString().trim().split('\n').filter(Boolean);

    // Find index of the "after" tag
    const afterTagIndex = allTags.indexOf(AFTER_TAG);
    if (afterTagIndex === -1) {
        throw new Error(`Tag ${AFTER_TAG} not found in repository`);
    }

    // Get all tags newer than the "after" tag
    const relevantTags = allTags.slice(0, afterTagIndex);
    console.log(`Found ${relevantTags.length} tags after ${AFTER_TAG}: ${relevantTags.join(', ')}`);

    // Get dates for all relevant tags
    const tagDates = {};
    console.log('Getting dates for all tags...');
    relevantTags.forEach(tag => {
        const dateStr = execSync(`git log -1 --format=%ad --date=short ${tag}`).toString().trim();
        tagDates[tag] = dateStr;
        console.log(`Tag ${tag} was created on ${dateStr}`);
    });

    // Initialize changelog content
    let content = `# Knack Toolkit Library Changelog\n\nChanges after version ${AFTER_TAG}\n\n`;

    if (relevantTags.length === 0) {
        console.log('No tags found after the specified tag. Using direct commit range...');

        // Get commits between the tag and HEAD
        const commits = execSync(`git log ${AFTER_TAG}..HEAD --pretty=format:"%s%n%b%n===COMMIT_SEPARATOR==="`).toString()
            .split('===COMMIT_SEPARATOR===').filter(Boolean);

        console.log(`Found ${commits.length} commits after ${AFTER_TAG}`);
        content += `## Unreleased changes\n\n`;

        commits.forEach(commit => {
            const lines = commit.trim().split('\n');
            const subject = lines[0];
            content += `- ${subject}\n`;

            if (lines.length > 1) {
                // Filter out empty lines and add remaining ones as sub-bullets
                const bodyLines = lines.slice(1).filter(line => line.trim());
                bodyLines.forEach(line => {
                    content += `  - ${line.trim()}\n`;
                });
            }
        });
    } else {
        // Process each tag
        for (let i = 0; i < relevantTags.length; i++) {
            const tag = relevantTags[i];
            const nextTag = relevantTags[i + 1]; // Next in array = previous chronologically
            const tagDate = tagDates[tag];

            console.log(`Processing tag: ${tag}`);
            content += `\n## ${tag}    *${tagDate}*\n\n`;

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

            const commitLog = execSync(command).toString();
            const commits = commitLog.split('===COMMIT_SEPARATOR===').filter(Boolean);

            console.log(`Found ${commits.length} commits for tag ${tag}`);

            if (commits.length === 0) {
                content += `- No additional commits for this version\n`;
                continue;
            }

            commits.forEach(commit => {
                const lines = commit.trim().split('\n');
                const subject = lines[0];
                content += `- ${subject}\n`;

                // Add remaining lines as sub-bullets, but filter out empty lines
                if (lines.length > 1) {
                    // Get consecutive empty lines (to remove them)
                    let lastLineWasEmpty = false;
                    lines.slice(1).forEach(line => {
                        const trimmedLine = line.trim();
                        if (trimmedLine) {
                            content += `  - ${trimmedLine}\n`;
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
    }

    fs.writeFileSync(outputFile, content);
    console.log(`Changelog generated in ${outputFile}`);

} catch (error) {
    console.error('Error generating changelog:');
    console.error(error.message);
    console.error(error.stderr ? error.stderr.toString() : '');
}