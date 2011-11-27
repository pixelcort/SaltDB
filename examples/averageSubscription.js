// saltdb
// Copyright (c) 2011 Cortland Klein <me@pixelcort.com>

var Database = require('../models/database.js').Database;
var Transform = require('../models/transform.js').Transform;

exports.Database = Database;
exports.Transform = Transform;

/////

var mapScores = new Transform('map', function(inputKey, inputValue){
  var keySplit = inputKey.split('-');
  if (keySplit[1] !== 'vote') {
    // console.log('skipping because this is not a vote: ' + inputKey);  
    return;
  }
  var mappedKey = keySplit[2]+'-'+keySplit[3];
  // console.log('getting a vote');
  var ret = {};
  ret[mappedKey] = inputValue;
  return ret;
});

var avgScores = new Transform('reduce', function(inputKey, inputValue) {
  var keySplit = inputKey.split('-');
  var sum = 0, count = 0;

  // console.log(inputValue);

  for (var inputValueKey in inputValue) {
    sum = sum + inputValue[inputValueKey];
    count++;
  }

  return Math.floor(sum/count);
});

var database = new Database();

database.registerTransform('mapScores','start',mapScores);
database.registerTransform('avgScores','mapScores',avgScores);

database.subscribeTransformedValue('avgScores','bob-orange',function() {
  console.log('bob-orange avgScores updated to: ' + database.getTransformedValue('avgScores','bob-orange'));
});

database.put('bob-orange','A round fruit.');
database.put('joe-orange','An awesome tasty food.');
database.put('bob-grape', 'Something purple and small.');

database.put('bob-vote-bob-orange', +1);
database.put('joe-vote-bob-orange', -1);
database.put('ron-vote-bob-orange', +2);
database.put('bob-vote-joe-orange', +1);
database.put('joe-vote-joe-orange', +1);
database.put('bob-vote-bob-grape', +1);
database.put('joe-vote-bob-grape', -1);

for (var i=0; i < 10; i++) {
  database.put(i+'-vote-bob-orange',i);
}

console.log('avgScores for bob-orange: ' + JSON.stringify(database.getTransformedValue('avgScores','bob-orange')));

exports.database = database;

/////

var repl = require('repl');

var replServer = repl.start();

replServer.context.e = exports;