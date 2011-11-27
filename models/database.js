// saltdb
// Copyright (c) 2011 Cortland Klein <me@pixelcort.com>

var Database;

var LOGGING = 0;

var TIMEOUT = 100;

var log = function(l) {
  if (LOGGING) console.log('DATABASE: ' + l);
};

Database = function() {
  this._hashtable = {};
  this._transforms = {};
  this._transformsNextInLine = {};
  this._transformsParentKey = {};
  this._transformsDirtyKeys = {};
  this._putVersion = 0;
  this._transformPutVersion = {};
  this._transformedValue = {};
  this._transformedInternalValue = {}; // For mapped output

  this._transformsSubscriptionCount = {};
  this._transformedSubscriptions = {};
};

Database.prototype.get = function(key) {
  log('get: ' + key);
  return this._hashtable[key];
};

Database.prototype.put = function(key, value) {
  log('put: ' + key + ' / ' + value);
  this._hashtable[key] = value;
  this._putVersion = this._putVersion + 1;
  log('putVersion increment to ' + this._putVersion);
  this._transformsKeyDidChange(key, 'start');
};

Database.prototype.registerTransform = function(transformKey, parentTransformKey, transform) {
  log('registerTransform: ' + transformKey + ' is a child of ' + parentTransformKey);
  if (this._transforms[transformKey]) throw 'already registered';
  this._transforms[transformKey] = transform;
  if (!this._transformsNextInLine[parentTransformKey]) this._transformsNextInLine[parentTransformKey] = {};
  this._transformsNextInLine[parentTransformKey][transformKey]=1;
  this._transformsParentKey[transformKey] = parentTransformKey;

  this._dirtyAllKeysForTransform(transformKey);
};

Database.prototype.updateTransform = function(transformKey, newTransform) {
  log('updateTransform: ' + transformKey);
  this._transforms[transformKey] = newTransform;
  this._dirtyAllKeysForTransform(transformKey);
};

Database.prototype.unregisterTransform = function(transformKey) {
  var parentTransformKey = this._transformsParentKey[transformKey];
  log('unregisterTransform: ' + transformKey + ' is a child of ' + parentTransformKey);
  if (this._transformsNextInLine[transformKey]) {
    for (var badKey in this._transformsNextInLine[transformKey]) throw 'depending transform exists: ' + badKey;
  }
  delete this._transforms[transformKey];
  delete this._transformsNextInLine[parentTransformKey][transformKey];
  delete this._transformsParentKey[transformKey];
  delete this._transformsDirtyKeys[transformKey];
  delete this._transformPutVersion[transformKey];
  delete this._transformedValue[transformKey];
  delete this._transformedInternalValue[transformKey];
};

Database.prototype.getTransformedValue = function(transformKey, transformedKey) {
  log('getTransformedValue: ' + transformKey + '\'s ' + transformedKey);
  // Get transform up to latest version
  this._updateTransformToLatestVersion(transformKey);

  // Return transformedValue
  return this._transformedValue[transformKey][transformedKey];
};

Database.prototype.subscribeTransformedValue = function(transformKey, transformedKey, callback) {
  if (!this._transformsSubscriptionCount[transformKey]) this._transformsSubscriptionCount[transformKey] = 0;
  this._transformsSubscriptionCount[transformKey] = this._transformsSubscriptionCount[transformKey] + 1;
  if (this._transformsParentKey[transformKey]) this.subscribeTransformedValue(this._transformsParentKey[transformKey]);

  if (!transformedKey) return;

  if (!this._transformedSubscriptions[transformKey]) this._transformedSubscriptions[transformKey] = {};
  if (!this._transformedSubscriptions[transformKey][transformedKey]) this._transformedSubscriptions[transformKey][transformedKey] = [];
  this._transformedSubscriptions[transformKey][transformedKey].push(callback);
};

Database.prototype.unsubscribeTransformedValue = function(transformKey, transformedKey, callback) {
  this._transformsSubscriptionCount[transformKey] = this._transformsSubscriptionCount[transformKey] - 1;
  if (this._transformsParentKey[transformKey]) this.unsubscribeTransformedValue(this._transformsParentKey[transformKey]);


  if (!transformedKey) return;


  var index = this._transformedSubscriptions[transformKey][transformedKey].indexOf(callback);
  if (index === -1) throw 'callback not found';
  this._transformedSubscriptions[transformKey][transformedKey].slice(index,1);
};

/////

Database.prototype._dirtyAllKeysForTransform = function(transformKey) {
  var transformParentKey = this._transformsParentKey[transformKey];
  // Figure out if this is dependant on start, or another transform
  var dependsOnStart = transformParentKey==='start';
  log('dirtyAllKeysForTransform: dependsOnStart is ' + dependsOnStart);
  for (var parentOutputtedKey in (dependsOnStart ? this._hashtable : this._transformedValue[transformParentKey])) {
    if (!this._transformsDirtyKeys[transformKey]) this._transformsDirtyKeys[transformKey] = {};
    this._transformsDirtyKeys[transformKey][parentOutputtedKey] = 1;
  }
};

Database.prototype._invokeLaterUpdateTransformToLatestVersion = function(transformKey) {
  var that = this;
  setTimeout(function(){
    that._updateTransformToLatestVersion(transformKey);
  }, TIMEOUT);
};

Database.prototype._updateTransformToLatestVersion = function(transformKey) {
  log('updateTransformToLatestVersion: ' + transformKey);
  if (this._transformPutVersion[transformKey] === this._putVersion) {
    log('updateTransformToLatestVersion: already up to date');
    return;
  }

  // Get parent transform up to latest version before we update ourselves
  log('updateTransformToLatestVersion: updating parent');
  if (this._transformsParentKey[transformKey]) this._updateTransformToLatestVersion(this._transformsParentKey[transformKey]);

  // Get all dirty keys
  log('updateTransformToLatestVersion: iterating over dirtyKeys');
  var dirtyKeys = this._transformsDirtyKeys[transformKey];
  for (var dirtyKey in dirtyKeys) {
    // Run transform on dirtyKey
    this._runTransformOnDirtyKey(transformKey, dirtyKey);
  }
  // Clear all dirty keys
  log('updateTransformToLatestVersion: clearing dirtyKeys');
  this._transformsDirtyKeys[transformKey] = {};

  // Up our version
  log('updateTransformToLatestVersion: upping our version');
  this._transformPutVersion[transformKey] = this._putVersion;
};

Database.prototype._runTransformOnDirtyKey = function(transformKey, dirtyKey) {
  log('runTransformOnDirtyKey: ' + transformKey + ' for dirtyKey ' + dirtyKey);
  var oldTransformedInternalValue = this._transformedInternalValue[transformKey] && this._transformedInternalValue[transformKey][dirtyKey];

  var transform = this._transforms[transformKey];

  var transformParentKey = this._transformsParentKey[transformKey];

  // Figure out if this is dependant on start, or another transform
  var dependsOnStart = transformParentKey==='start';
  log('runTransformOnDirtyKey: dependsOnStart is ' + dependsOnStart);
  var inputValue = dependsOnStart ? this._hashtable[dirtyKey] : this._transformedValue[transformParentKey][dirtyKey];

  log('runTransformOnDirtyKey: computing newTransformedInternalValue...');
  var newTransformedInternalValue = transform._transformFunction(dirtyKey, inputValue);

  // If nothing changed, we're done here
  if (JSON.stringify(oldTransformedInternalValue) === JSON.stringify(newTransformedInternalValue)) return;

  if (!this._transformedInternalValue[transformKey]) this._transformedInternalValue[transformKey] = {};
  this._transformedInternalValue[transformKey][dirtyKey] = newTransformedInternalValue;

  var keysToNotify={};

  if (transform._mapOrReduce === 'map') {
    // Was a map transform, also set each value
    log('runTransformOnDirtyKey: was a map');
    for (var newTransformedValueMappedKey in newTransformedInternalValue) {
      log('runTransformOnDirtyKey: got a newTransformedValueMappedKey' + newTransformedValueMappedKey);
      if (!this._transformedValue[transformKey]) this._transformedValue[transformKey] = {};
      if (!this._transformedValue[transformKey][newTransformedValueMappedKey]) this._transformedValue[transformKey][newTransformedValueMappedKey] = {};
      this._transformedValue[transformKey][newTransformedValueMappedKey][dirtyKey] = newTransformedInternalValue[newTransformedValueMappedKey];
      keysToNotify[newTransformedValueMappedKey]=1;
    }
    // Check for defunct values
    for (var oldTransformedValueMappedKey in oldTransformedInternalValue) {
      if (!newTransformedInternalValue[oldTransformedValueMappedKey]) {
        log('runTransformOnDirtyKey: got a defunct oldTransformedValueMappedKey' + oldTransformedValueMappedKey);
        delete this._transformedValue[transformKey][oldTransformedValueMappedKey][dirtyKey];
        keysToNotify[oldTransformedValueMappedKey]=1;
      }
    }
  } else {
    // Was a reduce transform
    log('runTransformOnDirtyKey: was a reduce');
    if (!this._transformedValue[transformKey]) this._transformedValue[transformKey] = {};
    this._transformedValue[transformKey][dirtyKey] = newTransformedInternalValue;
    keysToNotify[dirtyKey]=1;
  }

  // Notify keysToNotify
  for (var keyToNotify in keysToNotify) this._transformsKeyDidChange(keyToNotify, transformKey);
};

Database.prototype._transformsKeyDidChange = function(key, transformKey) {
  log('transformsKeyDidChange: ' + key + ' / for transformKey ' + transformKey);
  // Dirty this key for all the transformsNextInline
  for (var nextInLineTransformKey in this._transformsNextInLine[transformKey]) {
    log('transformsKeyDidChange: next in line includes ' + nextInLineTransformKey);
    if (!this._transformsDirtyKeys[nextInLineTransformKey]) this._transformsDirtyKeys[nextInLineTransformKey] = {};
    this._transformsDirtyKeys[nextInLineTransformKey][key] = 1;

    // If nextInLineTransformKey has transformsSubscriptionCount, cause it to get queued for _updateTransformToLatestVersion
    if (this._transformsSubscriptionCount[nextInLineTransformKey]) {
      log('transformsKeyDidChange: next in line has subscription count, invoking later');
      this._invokeLaterUpdateTransformToLatestVersion(nextInLineTransformKey);
    } else {
      log('transformsKeyDidChange: next in line doesn\t have subscription count');
    }
  }

  // Notify any callbacks
  if (this._transformedSubscriptions[transformKey] && this._transformedSubscriptions[transformKey][key]) {
    // log('HIT');
    for (var i=0,l=this._transformedSubscriptions[transformKey][key].length;i<l;i++) {
      this._transformedSubscriptions[transformKey][key][i]();
    }
  }

};

exports.Database = Database;