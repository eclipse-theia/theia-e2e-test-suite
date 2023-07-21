# Theia End-to-End Test Suite ![main](https://github.com/eclipse-theia/theia-e2e-test-suite/actions/workflows/main.yml/badge.svg?branch=main) [![Report](https://img.shields.io/badge/Test-Report-blue.svg)](https://eclipse-theia.github.io/theia-e2e-test-suite) [![Report](https://img.shields.io/badge/Performance-Report-blue.svg)](https://eclipse-theia.github.io/theia-e2e-test-suite/performance)

*A community-driven collection of end-to-end test cases to validate the user-facing behavior of [Theia](https://github.com/eclipse-theia/theia).*

## Overview

The tests are based on [Theia 🎭 Playwright](https://github.com/eclipse-theia/theia/tree/master/examples/playwright) and are located in the folder [`tests`](./tests).
Each test is defined in a dedicated `*.test.ts` file.
The tests run periodically against Theia's `main` branch and is published to the [test report](https://eclipse-theia.github.io/theia-e2e-test-suite).

> This test suite is not maintained by the core committers of Theia, but is a community effort.
> Feel free to add tests and benefit from them being executed periodically against Theia master.
> However, please maintain the test if it needs fixing (see also the [guidelines below](#contributing-and-maintaining-tests)).
> This initiative has a trial period of 2 community releases
> If the maintenance does not work well, the core team might decide to not host the test suite anymore.
> In this case, you are free to fork the suite and continue to use it though.

## Building

Run `yarn` in the root directory of the repository.

## Executing the tests

### Prerequisites

The Theia browser application under test already needs to be running at port 3000.
See [Theia's Quick Start guide](https://github.com/eclipse-theia/theia/blob/master/doc/Developing.md#quick-start) for more details on how to start Theia.

### Running the tests headless

To start the tests run `yarn ui-tests` in this directory.
This will start the tests in a headless execution mode.
There is also a VS Code task available called `Run all tests`.

To only run a single test file, the path of a test file can be set with `yarn ui-tests <path-to-file>` or `yarn ui-tests -g "<partial test file name>"`.
Please note that you can't use the file extension `.ts` in the expression used in `<path-to-file>`.
Either drop the file extension entirely, or use `.js` instead.
See the [Playwright Test command line documentation](https://playwright.dev/docs/intro#command-line).

### Running the tests headful, reporting and debugging

Please check for additional scripts in the [`package.json`](package.json) in order to run tests in headful mode and to generate reports.

To debug a test, open the test file in the code editor and run the `Debug selected test file` configuration inside VS Code.

## Contributing and maintaining tests

This is a community-driven test suite.
So contributions with contributions of additional test cases, as well as fixes and enhancements of existing test cases are very welcome.

Please follow the guidelines below:

* Fork this repository and open a Pull Request with your changes. Make sure you have signed the [Eclipse Contributor Agreement (ECA)](https://www.eclipse.org/legal/ECA.php)
* Make sure your changes pass the continuous integration builds. Every test will be executed against the latest Theia master periodically.
* If tests would benefit from extensions of the [Theia 🎭 Playwright](https://github.com/eclipse-theia/theia/tree/master/examples/playwright) page object model, please consider contributing those extensions directly to Theia first.
* ⚠️ This test suite is not maintained by the core committers of Theia, but are a highly appreciated community effort.
  * If a test you've added breaks because of a bug in Theia or in Theia 🎭 Playwright, please open an issue in Theia with a description of the bug and open an issue in this repository to track the failing test. Make sure to link the issues via comment or directly in their description. Feel free to open a [pull request with a fix for Theia](https://github.com/eclipse-theia/theia/blob/master/CONTRIBUTING.md#pull-requests) too.
  * If a test you've added breaks over time and the test needs to be adapted, please open an issue in this repository and a pull request with a fix.
  * Test cases that broke and haven't been fixed for a longer period of time will be removed.

## More documentation

* [Getting Started with Theia 🎭 Playwright](https://github.com/eclipse-theia/theia/tree/master/examples/playwright/docs/GETTING_STARTED.md)
* [Extensibility of Theia 🎭 Playwright](https://github.com/eclipse-theia/theia/tree/master/examples/playwright/docs/EXTENSIBILITY.md)
* [Playwright - GitHub](https://github.com/microsoft/playwright)
* [Playwright - Website](https://playwright.dev)
* [Playwright - Test Runner](https://playwright.dev/docs/intro)
* [Allure test reports](https://github.com/allure-framework/allure2)
