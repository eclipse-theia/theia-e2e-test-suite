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
    // copy latest performance metrics into performance publish path
    console.log('Copying performance metrics');
    fs.ensureDirSync(`${publishPath}/${performancePublishPath}`);
    fs.copySync(performanceMetricsPath, `${publishPath}/${performancePublishPath}`);
    // generate performance report
    console.log('Generating performance report');
    generatePerformanceReport(`${publishPath}/${performancePublishPath}`);
}

interface ValueHistoryEntry {
    entryLabel: string;
    value: number;
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
        'theia_measurements/frontend',
        'theia_measurements/startContributions',
        'theia_measurements/waitForDeployment',
        'theia_measurements/revealShell',
        'theia_measurements/deployPlugins',
        'theia_measurements/syncPlugins',
        'theia_measurements/loadPlugins',
        'theia_measurements/startPlugins',
        'process_cpu_seconds_total',
        'playwright_total_time'
    ]);

    // TODO Post process values:
    // if label ends with _X
    //  take current as label
    //  collect all values until X of _X is smaller than previous or doesn't exist
    //  replace collected with one that has a computed average and best of 1ß value of collected
    // else: set current value as average and best of 10

    const charts: string[] = [];
    for (const [valueLabel, valueHistory] of values) {
        const data = valueHistory.history.map(entry => ({ x: entry.entryLabel, y: entry.value }));
        const valueId = valueLabel.replace('/', '_');
        charts.push(`
        <div class="chart">
        <h2>${valueLabel}</h2>
        <canvas id="${valueId}" style="width:100%;max-height: 500px;"></canvas>
        <script>
        const ctx${valueId} = document.getElementById('${valueId}');
        new Chart(ctx${valueId}, {
            type: 'line',
            data: {
            datasets: [{
                label: '${valueLabel}',
                data: ${JSON.stringify(data)}
            }]
            },
            options: {
                plugins: {
                    annotation: {
                        annotations: {
                            averageLine,
                            stdDerivationUpper,
                            stdDerivationLower
                        }
                    }
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
        <script>
            function lastN(values, n = 10) {
                if (values.length > n) {
                    return values.slice(-n);
                }
                return values;
            }
            function average10(ctx) {
                let values = lastN(ctx.chart.data.datasets[0].data.map((entry) => entry.y));
                return values.reduce((a, b) => a + b, 0) / values.length;
            }
            function standardDeviation10(ctx) {
                const values = lastN(ctx.chart.data.datasets[0].data.map((entry) => entry.y));
                const n = values.length;
                const mean = average10(ctx);
                return Math.sqrt(values.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n);
            }
            const averageLine = {
                type: 'line',
                borderColor: 'rgba(100, 149, 237, 0.5)',
                borderDash: [6, 6],
                borderDashOffset: 0,
                borderWidth: 3,
                label: {
                    display: true,
                    backgroundColor: 'rgba(100, 149, 237, 0.75)',
                    content: (ctx) => 'Average(10): ' + average10(ctx).toFixed(2)
                },
                scaleID: 'y',
                value: (ctx) => average10(ctx)
            };
            const stdDerivationUpper = {
                type: 'line',
                borderColor: 'rgba(102, 102, 102, 0.25)',
                borderDash: [6, 6],
                borderDashOffset: 0,
                borderWidth: 3,
                label: {
                    display: true,
                    backgroundColor: 'rgba(102, 102, 102, 0.5)',
                    color: 'black',
                    content: (ctx) => (average10(ctx) + standardDeviation10(ctx)).toFixed(2),
                    position: 'start',
                    rotation: -90,
                    yAdjust: -28
                },
                scaleID: 'y',
                value: (ctx) => average10(ctx) + standardDeviation10(ctx)
            };
            const stdDerivationLower = {
                type: 'line',
                borderColor: 'rgba(102, 102, 102, 0.25)',
                borderDash: [6, 6],
                borderDashOffset: 0,
                borderWidth: 3,
                label: {
                    display: true,
                    backgroundColor: 'rgba(102, 102, 102, 0.5)',
                    color: 'black',
                    content: (ctx) => (average10(ctx) - standardDeviation10(ctx)).toFixed(2),
                    position: 'end',
                    rotation: 90,
                    yAdjust: 28
                },
                scaleID: 'y',
                value: (ctx) => average10(ctx) - standardDeviation10(ctx)
            };
        </script>
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
    const files = fs.readdirSync(path)
        .filter(file => !file.endsWith('index.html'))
        .sort((a, b) => toDate(a).getTime() - toDate(b).getTime());
    for (const file of files) {
        const entryLabel = file.substring(0, file.indexOf('.'));
        const entries = await readEntries(path + '/' + file, values);
        entries.forEach(entry =>
            valueHistoryMap.get(entry.valueLabel)?.history.push({ entryLabel, value: entry.entryValue })
        );
    }
    return valueHistoryMap;
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
