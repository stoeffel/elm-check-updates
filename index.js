const R = require("ramda");
const Table = require("cli-table");
const chalk = require("chalk");
const fetchCheerioObject = require("fetch-cheerio-object");
const loadJsonFile = require("load-json-file");
const path = require("path");
const semver = require("semver");
const { arrowRight, tick, warning } = require("figures");

const log = x => {
  console.log(x);
  return x;
};
const err = x => {
  console.error(x);
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
  head: ["Package", "Current Range", "", "Latest", ""]
});
const tableAppend = x => table.push(x);
const renderTable = () => table.toString();

const findVersion = R.pipe(R.match(/version:\s"(.*)"/), R.nth(1));

const isUpToDate = R.curry((userPackage, range, currentVersion) => ({
  userPackage,
  range,
  currentVersion,
  needsUpdate: !noUpdateNeeded(range, currentVersion)
}));

function fetchPackageInfo([userPackage, range]) {
  const [user, p] = R.split("/", userPackage);
  return fetchCheerioObject(
    `http://package.elm-lang.org/packages/${user}/${p}/latest`
  )
    .then($ => $.html())
    .then(findVersion)
    .then(R.defaultTo("UNKNOWN"))
    .then(isUpToDate(userPackage, range));
}

function renderEntry({ userPackage, range, currentVersion, needsUpdate }) {
  return [
    chalk.bold.black(userPackage),
    range,
    arrowRight,
    currentVersion,
    ifElse(needsUpdate, chalk.red(warning), chalk.green(tick))
  ];
}

function noUpdateNeeded(range, currentVersion) {
  const [[from, opFStr], [opTStr, to]] = R.pipe(
    R.split(" v "),
    R.map(R.split(" ")),
    R.map(R.map(R.trim))
  )(range);
  const opF = opFromString(opFStr);
  const opT = opFromString(opTStr);
  return semver[opF](from, currentVersion) && semver[opT](currentVersion, to);
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
  loadJsonFile(path.join(process.cwd(), "elm-package.json"))
    .then(R.prop("dependencies"))
    .then(R.toPairs)
    .then(R.map(fetchPackageInfo))
    .then(allP)
    .then(R.sortBy(R.prop("needsUpdate")))
    .then(R.map(R.pipe(renderEntry, tableAppend)))
    .then(renderTable)
    .then(log)
    .catch(err);
}

module.exports = {
  checkUpdates,
  noUpdateNeeded
};
