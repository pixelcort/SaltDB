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

var sumScores = new Transform('reduce', function(inputKey, inputValue) {
  var keySplit = inputKey.split('-');
  var sum = 0;

  console.log(inputValue);

  for (var inputValueKey in inputValue) {
    sum = sum + inputValue[inputValueKey];
  }

  return sum;
});

var topScoreMap = new Transform('map', function(inputKey, inputValue) {
  var keySplit = inputKey.split('-');

  var ret = {};

  ret[keySplit[1]] = inputValue;

  return ret;
});

var topThreeReduce = new Transform('reduce', function(inputKey, inputValue) {
  console.log('TOPTHREEREDUCE: ' + JSON.stringify(inputValue));
  var first, second, third;
  var firstScore = -99999, secondScore = -9999, thirdScore = -99999;
  for (var inputValueKey in inputValue) {
    var score = inputValue[inputValueKey];
    if (score > firstScore) {
      thirdScore = secondScore;
      secondScore = firstScore;
      firstScore = score;
      third = second;
      second = first;
      first = inputValueKey;
    } else if (score > secondScore) {
      thirdScore = secondScore;
      secondScore = score;
      third = second;
      second = inputValueKey;
    } else if (score > thirdScore) {
      thirdScore = score;
      third = inputValueKey;
    }
  }

  return [[first, firstScore], [second, secondScore], [third, thirdScore]];
});

var database = new Database();

database.registerTransform('mapScores','start',mapScores);
database.registerTransform('sumScores','mapScores',sumScores);
database.registerTransform('topScoreMap','sumScores',topScoreMap);

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

for (var i=0; i < 1000; i++) {
  database.put(i+'-vote-bob-orange',i);
}

console.log('sumScores for bob-orange: ' + JSON.stringify(database.getTransformedValue('sumScores','bob-orange')));
database.registerTransform('topThreeReduce','topScoreMap',topThreeReduce);
console.log('topThreeReduce for orange: ' + JSON.stringify(database.getTransformedValue('topThreeReduce','orange')));

exports.database = database;

/////

var repl = require('repl');

var replServer = repl.start();

replServer.context.e = exports;