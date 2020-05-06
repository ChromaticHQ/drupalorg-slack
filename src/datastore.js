const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const config = require('./config');

// Setup a new database.
// Persisted using async file storage.
// Security note: the database is saved to the file `db.json` on the local filesystem.
// It's deliberately placed in the `.data` directory which doesn't get copied if
// someone remixes the project.
const adapter = new FileSync('.data/db.json');
const db = low(adapter);

// default data.
db.defaults({
  keyvalues: [
    { name: config.issueCreditCountMaxVarKey, value: null },
    { name: config.marketplaceRankMinVarKey, value: null },
    { name: config.projectsSupportedMaxVarKey, value: null },
  ],
}).write();

/**
 * Get variable from the lowdb datastore.
 *
 * @param  {string} variableName
 *   Variable name to retrieve.
 * @param  {string} collectionName
 *   Collection to retrieve the specified variable from.
 * @return {string}
 *   The retrieved variable value.
 */
const variableGet = (variableName, collectionName = 'keyvalues') => {
  console.log(`variableName: ${variableName}`);
  const { value } = db.get(collectionName).find({ name: variableName }).value();
  if (config.verboseMode) {
    console.log(`${variableName}: ${value}`);
  }
  return value;
};

/**
 * Get variable from the lowdb datastore.
 *
 * @param  {string} variableName
 *   Name of the variable to save.
 * @param  {string} variableValue
 *   Value of the variable to save.
 * @param  {string} collectionName
 *   Name of the collection to save the variable to.
 */
const variableSet = (variableName, variableValue, collectionName = 'keyvalues') => {
  if (config.verboseMode) {
    console.log(`Updating ${variableName}: ${variableValue}`);
  }
  db.get(collectionName)
    .find({ name: variableName })
    .assign({ value: variableValue })
    .write();
};

module.exports = {
  variableGet,
  variableSet,
};
