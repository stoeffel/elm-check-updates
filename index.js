const R = require("ramda");
const Table = require("cli-table");
const chalk = require("chalk");
const fetchCheerioObject = require("fetch-cheerio-object");
const loadJsonFile = require("load-json-file");
const path = require("path");
const semver = require("semver");
const writeJsonFile = require("write-json-file");
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
  return loadJsonFile(path.join(process.cwd(), "elm-package.json"))
    .then(R.prop("dependencies"))
    .then(R.toPairs)
    .then(R.map(fetchPackageInfo))
    .then(allP)
    .then(R.sortBy(R.prop("needsUpdate")));
}

const render = R.pipe(
  R.map(R.pipe(renderEntry, tableAppend)),
  renderTable,
  log
);

const updateDeps = R.curry((deps, data) => {
  let { dependencies } = data;
  data.dependencies = R.mapObjIndexed((_, name) => {
    const { currentVersion } = R.find(R.propEq("userPackage", name))(deps);
    return `${currentVersion} <= v <= ${currentVersion}`;
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

module.exports = {
  checkUpdates,
  handleError,
  hintUpdateConfig,
  noUpdateNeeded,
  render,
  updateElmPackage
};
