# travetto-test-plugin 

This plugin integrates with the travetto frameweork's testing module, to provide realtime feedback of tests in the editor.

## Features

* Realtime feedback in test files
  - Run all tests on file load
  - Run individual tests on file save (depending on current line)
* The ability to debug any test (Ctrl-Shift-T)
  - Will automaticallly add/remove a break point at the current line, and run the test in debug


## Requirements

This plugin only works with the `@travetto/test`, in files with `@Suite()` declarations.

## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.

## Release Notes

### 0.0.x

Alpha development of plugin, continously updating.
