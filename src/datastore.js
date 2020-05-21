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

// Add "upsert" functionality to lowdb.
// This checks if a value exists, update it if so, or inserts it if it does not.
// @see https://github.com/typicode/lowdb/issues/348
db._.mixin({
  upsert: (collection, obj, key = 'id') => {
    for (let i = 0; i < collection.length; i += 1) {
      const el = collection[i];
      if (el[key] === obj[key]) {
        // eslint-disable-next-line no-param-reassign
        collection[i] = obj;
        return collection;
      }
    }
    collection.push(obj);
    return collection;
  },
});

// Default data.
db.defaults({
  keyvalues: [
    { name: config.keyValueDefaults.issueCreditCountMaxVarKey, value: null },
    { name: config.keyValueDefaults.marketplaceRankMinVarKey, value: null },
    { name: config.keyValueDefaults.projectsSupportedMaxVarKey, value: null },
    { name: config.keyValueDefaults.caseStudiesPublishedMaxVarKey, value: null },
  ],
}).write();

/**
 * Get variable from the lowdb datastore.
 *
 * @param  {string} variableName
 *   Variable name to retrieve.
 * @param  {string} collectionName
 *   Collection to retrieve the specified variable from.
 * @return {mixed}
 *   The retrieved variable value.
 */
const variableGet = (variableName, collectionName = 'keyvalues') => {
  const retrievedVariable = db.get(collectionName).find({ name: variableName });
  if (retrievedVariable.value() === undefined) {
    return null;
  }

  const { value } = retrievedVariable.value();
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
    .upsert({ name: variableName, value: variableValue }, 'name')
    .write();
};

module.exports = {
  variableGet,
  variableSet,
};
