// *****************************************************************************
// Copyright (C) 2023 STMicroelectronics and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
// *****************************************************************************

import * as events from 'events';
import * as fs from 'fs-extra';
import * as readline from 'readline';
import yargs from 'yargs';

const matchUntilUnderscoreOrDot = /^([^\.\_])+/;

(async () => {
    const options: PerformanceReportParams = yargs(process.argv)
        .option('ghPagesPath', {
            describe: 'The path where the history of previous gh pages publications are located.',
            default: 'gh-pages',
            type: 'string'
        })
        .option('publishPath', {
            describe: 'The path to which the new gh pages files including history should end up.',
            default: 'public',
            type: 'string'
        })
        .option('performancePublishPath', {
            describe: 'The path relative to `publishPath` for the performance data and report.',
            default: 'performance',
            type: 'string'
        })
        .option('performanceMetricsPath', {
            describe: 'The path where the latest performance metrics are located.',
            default: 'performance-metrics',
            type: 'string'
        })
        .parseSync();
    preparePerformanceReport(options);
})();

interface PerformanceReportParams {
    /** The path where the history of previous gh pages publications are located. */
    ghPagesPath: string;
    /** The path to which the new gh pages files including history should end up. */
    publishPath: string;
    /** The path relative to `publishPath` for the performance data and report. */
    performancePublishPath: string;
    /** The path where the latest performance metrics are located. */
    performanceMetricsPath: string;
}

export async function preparePerformanceReport({
    publishPath,
    ghPagesPath,
    performancePublishPath,
    performanceMetricsPath
}: PerformanceReportParams) {
    // copy history from the current gh-pages folder to new publish path
    console.log('Copying history');
    fs.emptyDirSync(publishPath);
    fs.copySync(ghPagesPath, publishPath, { filter: (src, dest) => !src.includes('.git') });
    // harmonize file names and copy latest performance metrics into performance publish path
    console.log('Copying performance metrics');
    harmonizeFileNames(performanceMetricsPath);
    fs.ensureDirSync(`${publishPath}/${performancePublishPath}`);
    fs.copySync(performanceMetricsPath, `${publishPath}/${performancePublishPath}`);
    // generate performance report
    console.log('Generating performance report');
    generatePerformanceReport(`${publishPath}/${performancePublishPath}`);
}

/**
 * We expect all files in this path to be measurements of the same job but from different runs.
 * Thus they may have slightly different timestamps. In order to have a consistent dataset,
 * we harmonize the timestamp of their file names and just distinguish them by their run number.
 * @param path Path to the performance metrics files.
 */
function harmonizeFileNames(path: string) {
    const files = fs.readdirSync(path).sort(sortByDateAndRunNumber);
    if (files.length <= 1) {
        return;
    }
    let referenceFileName = files.find(f => f.match(matchUntilUnderscoreOrDot))?.match(matchUntilUnderscoreOrDot);
    if (!referenceFileName || referenceFileName.length < 1) {
        return;
    }
    for (const file of files) {
        const fileNameWithoutExtension = file.substring(0, file.lastIndexOf('.'));
        const runNumber = getRunNumber(fileNameWithoutExtension);
        if (runNumber >= 0) {
            fs.renameSync(`${path}/${file}`, `${path}/${referenceFileName[0]}_${runNumber}.txt`);
        }
    }
}

interface ValueHistoryEntry {
    entryLabel: string;
    value: number;
    best?: number;
    combinesRuns?: string[];
}
interface ValueHistory {
    valueLabel: string;
    history: ValueHistoryEntry[];
}

export async function generatePerformanceReport(path: string) {
    const reportPath = path + '/index.html';
    if (fs.existsSync(path + '/index.html')) {
        fs.removeSync(reportPath);
    }

    const values = await readValuesFromHistory(path, [
        'playwright_total_time',
        'process_cpu_seconds_total',
        'theia_measurements/frontend',
        'theia_measurements/startContributions',
        'theia_measurements/waitForDeployment',
        'theia_measurements/revealShell',
        'theia_measurements/deployPlugins',
        'theia_measurements/syncPlugins',
        'theia_measurements/loadPlugins',
        'theia_measurements/startPlugins',

    ]);

    const processedValues = processValues(values);

    const charts: string[] = [];
    for (const [valueLabel, valueHistory] of processedValues) {
        const data = valueHistory.history.map(entry => ({ x: entry.entryLabel, y: entry.value }));
        const best = valueHistory.history.map(entry => ({ x: entry.entryLabel, y: entry.best ?? entry.value }));
        const valueId = valueLabel.replace('/', '_');
        const graphLabel = toGraphLablel(valueLabel);
        charts.push(`
        <div class="chart">
        <h2>${graphLabel}</h2>
        <canvas id="${valueId}" style="width:100%;max-height: 500px;"></canvas>
        <script>
        const ctx${valueId} = document.getElementById('${valueId}');
        new Chart(ctx${valueId}, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: '${graphLabel} (average of 10 runs)',
                        data: ${JSON.stringify(data)}
                    },
                    {
                        label: '${graphLabel} (best of 10 runs)',
                        data: ${JSON.stringify(best)}
                    },
                ]
            },
            options: {
                scales: {
                    yAxes: [{
                        type: 'logarithmic'
                    }]
                }
            }
        });
        </script>
        </div>
        `);
    }

    const html = `
        <!doctype html>
        <head>
        <meta charset="utf-8">
        <title>Theia Performance Report</title>
        <meta name="description" content="Theia Performance Report"/>
        <meta http-equiv="Permissions-Policy" content="interest-cohort=(), user-id=()" />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.3.3/chart.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.3.3/chart.umd.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/chartjs-plugin-annotation/3.0.1/chartjs-plugin-annotation.min.js"></script>
        </head>
        
        <body>
        <h1>Theia Performance Report</h1>
        <div class="charts">
        ${charts.join(' ')}
        </div>    
        </script>
        </body>
        </html>
    `;

    fs.writeFileSync(reportPath, html);
}

export async function readValuesFromHistory(path: string, values: string[]): Promise<Map<string, ValueHistory>> {
    const valueHistoryMap = initializeValueHistoryMap(values);
    const files = fs.readdirSync(path).filter(hasTxtExtension).sort(sortByDateAndRunNumber);
    for (const file of files) {
        const entryLabel = file.substring(0, file.indexOf('.'));
        const entries = await readEntries(path + '/' + file, values);
        entries.forEach(entry =>
            valueHistoryMap.get(entry.valueLabel)?.history.push({ entryLabel, value: entry.entryValue })
        );
    }
    return valueHistoryMap;
}

export function hasTxtExtension(file: string): unknown {
    return file.endsWith('.txt');
}

export function sortByDateAndRunNumber(a: string, b: string): number {
    const runNumberA = extractRunNumber(a);
    const runNumberB = extractRunNumber(b);
    const dateStringA = extractDateString(a, runNumberA);
    const dateStringB = extractDateString(b, runNumberB);
    const dateComparison = toDate(dateStringA).getTime() - toDate(dateStringB).getTime();
    return dateComparison !== 0 ? dateComparison : runNumberA - runNumberB;
}

export function extractRunNumber(fileName: string) {
    return getRunNumber(fileName.replace('.txt', ''));
}

export function extractDateString(fileName: string, runNumber: number) {
    return runNumber < 0 ? fileName : fileName.substring(0, fileName.indexOf(`_${runNumber}`));
}

export function initializeValueHistoryMap(values: string[]) {
    const valueHistoryMap = new Map<string, ValueHistory>();
    for (const value of values) {
        const history: ValueHistoryEntry[] = [];
        valueHistoryMap.set(value, { valueLabel: value, history });
    }
    return valueHistoryMap;
}

export function toDate(fileName: string): Date {
    const [date, timeString] = fileName.replace('.txt', '').split('T');
    const dateFragments = date.split('-').map(str => Number.parseInt(str));
    const timeFragments = timeString.split('-').map(str => Number.parseInt(str));
    return new Date(dateFragments[0], dateFragments[1], dateFragments[2], timeFragments[0], timeFragments[1], timeFragments[2]);
}

const nameAttribute = 'name="';
export async function readEntries(path: string, values: string[]): Promise<{ valueLabel: string, entryValue: number }[]> {
    const entries: { valueLabel: string, entryValue: number }[] = [];
    try {
        const rl = readline.createInterface({ input: fs.createReadStream(path), crlfDelay: Infinity });
        rl.on('line', (line: string) => {
            for (const valueLabel of values) {
                const positionOfSlashInValueLabel = valueLabel.indexOf('/');
                const isComplexLabel = positionOfSlashInValueLabel > -1;
                const expectedLineStartForValueLabel = !isComplexLabel ? valueLabel + ' ' : valueLabel.substring(0, positionOfSlashInValueLabel) + '{';
                if (line.startsWith(expectedLineStartForValueLabel)) {
                    if (isComplexLabel && line.indexOf(nameAttribute) > -1) {
                        const valueName = valueLabel.substring(positionOfSlashInValueLabel + 1);
                        const lineStartingWithName = line.substring(line.indexOf(nameAttribute) + nameAttribute.length);
                        if (lineStartingWithName.startsWith(valueName)) {
                            const lineFragments = line.split(' ');
                            const entryValue = Number.parseFloat(lineFragments[lineFragments.length - 1]);
                            entries.push({ valueLabel, entryValue });
                        }
                    } else {
                        const entryValue = Number.parseFloat(line.split(' ')[1]);
                        entries.push({ valueLabel, entryValue });
                    }
                }
            }
        });
        await events.once(rl, 'close');
    } catch (err) {
        console.error(err);
    }
    return entries;
}

/**
 * Post-processes the values read from the metrics files.
 * 
 * The input is a map of value labels (e.g. `'theia_measurements/frontend`) to the history of values for this label.
 * Each history element has itself a label, which denotes the date and optionally the run, e.g. `2023-10-1T19-39-3_2`,
 * whereas the measurement has been recorded on Oct 1st of 2023 at 19:39:03 in the second run (`_2`).
 * 
 * All runs for a single measurement will be combined into a single entry. Measurements that don't belong to a run will
 * remain a single entry.
 * The algorithm for combining multiple runs into a single entry is strongly based on the assumption that the
 * list of `ValueHistoryEntry` instances is sorted by date so that multiple runs with the same date are occurring in a sequence.
 * Otherwise this function may produce bogus.
 * 
 * This function walks through all value labels and each history element for that value label and applies the following:
 * * If the entry represents the measurement of a single run (i.e. ends with `_X`) and has the same entry label as the previous entry, track it to be combined into one entry.
 * * If the entry does not represent a single run (i.e. does not end with `_X`) or has a different entry label, conclude the previous collection and start a new one.
 * Concluding the previous collection means computing the average and the best of ten value and putting it into a single `ValueHistoryEntry` that combines all runs of the current
 * collection. The first element of the collection determines the label of the entire collection.
 * 
 * @param values raw values as read from performance metrics files (key is the label of the value, value is the history of values),
 *               whereas the ValueHistory.history` of each entry must be sorted ascending by date and run.
 * @returns post processed values with the average values and best of ten values of multiple runs.
 */
export function processValues(values: Map<string, ValueHistory>): Map<string, ValueHistory> {
    const processedValues = new Map<string, ValueHistory>();
    for (const [valueLabel, valueHistory] of values) {
        const currentValueHistory = { valueLabel, history: new Array<ValueHistoryEntry>() }

        let currentCollection: ValueHistoryEntry[] | undefined = undefined;
        let previousEntryLabel: string | undefined = undefined;
        for (const entry of valueHistory.history) {

            const entryLabelMatchArray = entry.entryLabel.match(matchUntilUnderscoreOrDot);
            const currentEntryLabel = entryLabelMatchArray ? entryLabelMatchArray[0] : undefined;
            if (currentCollection && currentCollection.length > 0 && currentEntryLabel !== previousEntryLabel) {
                // we have a collection and encountered a new entry label, so combine current collection into a single entry and reset
                currentValueHistory.history.push(toCombinedValueHistoryEntry(currentCollection));
                currentCollection = undefined;
                previousEntryLabel = undefined;
            }

            if (currentCollection && currentEntryLabel === previousEntryLabel) {
                // add to collection
                currentCollection.push(entry);
            } else {
                // start new collection
                currentCollection = [entry];
            }

            previousEntryLabel = currentEntryLabel;
        }

        // combine last collection if there still is one
        if (currentCollection && currentCollection.length > 0) {
            currentValueHistory.history.push(toCombinedValueHistoryEntry(currentCollection));
        }

        processedValues.set(valueLabel, currentValueHistory);
    }
    return processedValues;
}

function getRunNumber(label: string): number {
    const match = label.match(/_([0-9]+)$/)
    return match ? Number.parseInt(match[1]) : -1;
}

function toCombinedValueHistoryEntry(entries: ValueHistoryEntry[]): ValueHistoryEntry {
    const values = entries.map(entry => entry.value);
    const combinesRuns = entries.map(entry => entry.entryLabel);
    const matchArray = combinesRuns[0].match(matchUntilUnderscoreOrDot);
    const entryLabel = matchArray ? matchArray[0] + (entries.length > 1 ? '[]' : '') : combinesRuns[0];
    const value = averageValue(values);
    const best = bestValue(values);
    return {
        entryLabel,
        value,
        best,
        combinesRuns
    }
}

function averageValue(values: number[]): number {
    if (values.length > 1) {
        // remove worst outlier
        values = values.sort();
        values.pop();
    }
    return values.reduce((a, b) => a + b, 0) / values.length;
}

function bestValue(values: number[]): number {
    return Math.min(...values);
}

function toGraphLablel(originalLabel: string): string {
    switch (originalLabel) {
        case 'playwright_total_time':
            return 'Playwright Total Time';
        case 'process_cpu_seconds_total':
            return 'Process Utilization (in seconds)';
        case 'theia_measurements/frontend':
            return 'Theia Frontend Startup Time';
        case 'theia_measurements/startContributions':
            return 'Time to start contributions (frontend)';
        case 'theia_measurements/waitForDeployment':
            return 'Time until plugins are deployed (frontend)';
        case 'theia_measurements/revealShell':
            return 'Time until shell is revealed (frontend)';
        case 'theia_measurements/deployPlugins':
            return 'Time to deploy plugins (backend)';
        case 'theia_measurements/syncPlugins':
            return 'Time to sync plugins (frontend)';
        case 'theia_measurements/loadPlugins':
            return 'Time to load plugins (frontend)';
        case 'theia_measurements/startPlugins':
            return 'Time to start plugins (frontend)';
        default:
            return originalLabel;
    }
}
