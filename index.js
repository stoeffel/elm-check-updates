const R = require("ramda");
const Table = require("cli-table");
const chalk = require("chalk");
const fetchCheerioObject = require("fetch-cheerio-object");
const loadJsonFile = require("load-json-file");
const path = require("path");
const semver = require("semver");
const writeJsonFile = require("write-json-file");
const { exec } = require("child_process");
const { arrowRight, tick, warning, info } = require("figures");

const log = x => {
  console.log(x);
  return x;
};
const handleError = x => {
  console.error(x);
  process.exit(-1);
  return x;
};
const ifElse = (pred, ifTrue, otherwise) => {
  if (pred) {
    return ifTrue;
  } else {
    return otherwise;
  }
};

const allP = x => Promise.all(x);
const table = new Table({
  head: ["Package", "Current Range", "Current", "", "Latest", ""]
});
const tableAppend = x => table.push(x);
const renderTable = () => table.toString();

const findVersion = R.pipe(R.match(/version:\s"(.*)"/), R.nth(1));

const isUpToDate = R.curry((userPackage, range, current, latest) => ({
  userPackage,
  range,
  latest,
  current,
  needsUpdate: !noUpdateNeeded(range, latest)
}));

const fetchPackageInfo = R.curry((exactDeps, [userPackage, range]) => {
  const [user, p] = R.split("/", userPackage);
  const exactVersion = exactDeps[userPackage];
  return fetchCheerioObject(
    `http://package.elm-lang.org/packages/${user}/${p}/latest`
  )
    .then($ => $.html())
    .then(findVersion)
    .then(R.defaultTo("UNKNOWN"))
    .then(isUpToDate(userPackage, range, exactVersion));
});

function renderEntry({ userPackage, range, latest, needsUpdate, current }) {
  return [
    chalk.bold.black(userPackage),
    range,
    current,
    arrowRight,
    latest,
    ifElse(needsUpdate, chalk.red(warning), chalk.green(tick))
  ];
}

function noUpdateNeeded(range, latest) {
  const [[from, opFStr], [opTStr, to]] = R.pipe(
    R.split(" v "),
    R.map(R.split(" ")),
    R.map(R.map(R.trim))
  )(range);
  const opF = opFromString(opFStr);
  const opT = opFromString(opTStr);
  return semver[opF](from, latest) && semver[opT](latest, to);
}

function opFromString(str) {
  switch (str) {
    case "<=":
      return "lte";
    case "<":
      return "lt";
    case ">=":
      return "gte";
    case ">":
      return "gt";
    default:
      return "lte";
  }
}

function checkUpdates() {
  return loadJsonFile(
    path.join(process.cwd(), "elm-stuff", "exact-dependencies.json")
  ).then(exactDeps =>
    loadJsonFile(path.join(process.cwd(), "elm-package.json"))
      .then(R.prop("dependencies"))
      .then(R.toPairs)
      .then(R.map(fetchPackageInfo(exactDeps)))
      .then(allP)
      .then(R.sortBy(R.prop("needsUpdate"))));
}

const render = deps => {
  R.pipe(R.map(R.pipe(renderEntry, tableAppend)), renderTable, log)(deps);
  return deps;
};

const updateDeps = R.curry((deps, data) => {
  let { dependencies } = data;
  data.dependencies = R.mapObjIndexed((_, name) => {
    const { latest } = R.find(R.propEq("userPackage", name))(deps);
    return `${latest} <= v <= ${latest}`;
  })(dependencies);
  return data;
});

function updateElmPackage(deps) {
  return loadJsonFile(path.join(process.cwd(), "elm-package.json"))
    .then(updateDeps(deps))
    .then(data =>
      writeJsonFile(path.join(process.cwd(), "elm-package.json"), data, {
        indent: 4
      }))
    .then(() => deps);
}
function hintUpdateConfig() {
  console.log(
    chalk.cyan(
      `${info} Run \`elm-check-update -u\` to update \`elm-package.json\`.`
    )
  );
}

function details({ userPackage, current, latest }) {
  if (current === latest) {
    return null;
  }
  return new Promise((resolve, reject) =>
    exec(
      `elm-package diff ${userPackage} ${current} ${latest}`,
      (error, stdout, stderr) => {
        if (error) {
          reject(stderr);
        } else {
          resolve(stdout);
        }
      }
    ));
}

module.exports = {
  allP,
  checkUpdates,
  details,
  handleError,
  hintUpdateConfig,
  log,
  noUpdateNeeded,
  render,
  updateElmPackage
};
