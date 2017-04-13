#!/usr/bin/env node
const {
  checkUpdates,
  render,
  handleError,
  hintUpdateConfig,
  updateElmPackage
} = require("./index.js");
const meow = require("meow");
const R = require("ramda");

const cli = meow(
  `
	Usage
	  $ elm-check-updates

	Options
	  --update-config, -u  Update elm-package.json
	  --detailed -d  Get detailed information about the new release
`,
  {
    alias: {
      u: "update-config",
      d: "detailed"
    }
  }
);
const { updateConfig, detailed } = cli.flags;
checkUpdates()
  .then(R.when(R.always(updateConfig), updateElmPackage))
  .then(render)
  .then(R.when(R.always(!updateConfig), hintUpdateConfig))
  .catch(handleError);
